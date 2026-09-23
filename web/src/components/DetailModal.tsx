import { Fragment, useEffect, useState } from "react";
import {
  type AbsenceRequest, type Activity, type AnyRequest, PART_LABEL, type Replacements,
  type RequestChange, type RequestSnapshot, toKey,
} from "shared";
import { fmtLong, fmtRange, fmtShort } from "../lib/format";
import { api } from "../lib/api";
import { Dot, StatusPill, typeLabel } from "./Badges";
import { adminCanChange } from "./AdminRequestModals";

/** Wat je in de kalender of een overzicht kunt aantikken om de details te zien. */
export type Detail =
  | { kind: "request"; request: AnyRequest }
  | { kind: "activity"; activity: Activity };

export function DetailModal({
  detail, onClose, onEditActivity, onEditRequest, onRemoveRequest,
}: {
  detail: Detail;
  onClose: () => void;
  /** Alleen voor admins: toont een knop om de activiteit aan te passen. */
  onEditActivity?: (a: Activity) => void;
  /** Alleen voor admins: knoppen om een aanvraag aan te passen of te verwijderen. */
  onEditRequest?: (r: AbsenceRequest) => void;
  onRemoveRequest?: (r: AbsenceRequest) => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const title = detail.kind === "request"
    ? `${typeLabel(detail.request)} — ${detail.request.person}`
    : detail.activity.title;

  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        {detail.kind === "request" ? <RequestDetail r={detail.request} /> : <ActivityDetail a={detail.activity} />}
        <div className="modalactions">
          {detail.kind === "activity" && onEditActivity && (
            <button className="btn" onClick={() => onEditActivity(detail.activity)}>Aanpassen</button>
          )}
          {detail.kind === "request" && detail.request.type === "absence" && adminCanChange(detail.request) && (
            <>
              {onRemoveRequest && (
                <button className="btn" onClick={() => onRemoveRequest(detail.request as AbsenceRequest)}>Verwijderen</button>
              )}
              {onEditRequest && (
                <button className="btn" onClick={() => onEditRequest(detail.request as AbsenceRequest)}>Aanpassen</button>
              )}
            </>
          )}
          <button className="btn primary" onClick={onClose}>Sluiten</button>
        </div>
      </div>
    </div>
  );
}

function ReplacementList({ value }: { value: Replacements }) {
  const reps = Object.entries(value ?? {}).sort();
  if (reps.length === 0) return <span className="note">geen</span>;
  return (
    <>
      {reps.map(([sk, p]) => {
        const [k, part] = sk.split("|");
        return (
          <div key={sk}>
            {fmtShort(k)} {PART_LABEL[part as "am" | "pm" | "day"].toLowerCase()} → <Dot person={p} /> {p}
          </div>
        );
      })}
    </>
  );
}

function RequestDetail({ r }: { r: AnyRequest }) {
  const [changes, setChanges] = useState<RequestChange[]>([]);
  useEffect(() => {
    if (!r.changeCount) return;
    let cancelled = false;
    api.requestChanges(r.id).then((c) => { if (!cancelled) setChanges(c); }).catch(() => {});
    return () => { cancelled = true; };
  }, [r.id, r.changeCount]);

  return (
    <>
      <h3><Dot person={r.person} /> {typeLabel(r)} — {r.person}</h3>
      <dl className="details">
        <dt>Wanneer</dt>
        <dd>
          {fmtRange(r.from, r.to)}
          {r.type === "move" && <div className="note">verplaatst van {fmtRange(r.origFrom, r.origTo)}</div>}
          {r.type === "revert" && <div className="note">betreft {fmtRange(r.origFrom, r.origTo)}</div>}
        </dd>
        <dt>Status</dt>
        <dd>
          <StatusPill status={r.status} />
          {r.shortNotice && <> <span className="tagline t-draft">korte termijn</span></>}
          {r.reviewedBy && <div className="note">beoordeeld door {r.reviewedBy}</div>}
          {r.comment && <div className="note">Reden: {r.comment}</div>}
        </dd>
        {r.type !== "revert" && (
          <>
            <dt>Vervangers</dt>
            <dd><ReplacementList value={r.replacements} /></dd>
          </>
        )}
        <dt>Toelichting</dt>
        <dd className="prewrap">{r.note ? r.note : <span className="note">Geen toelichting.</span>}</dd>
        <dt>Aangevraagd</dt>
        <dd>{fmtLong(toKey(new Date(r.createdAt)))}</dd>
      </dl>
      {changes.length > 0 && <History changes={changes} />}
    </>
  );
}

const KIND_LABEL = { day: "Vrije dag", vacation: "Vakantie" } as const;

function actionLabel(c: RequestChange): string {
  if (c.action === "delete") return "Verwijderd";
  if (c.action === "revert") return "Teruggezet naar werkdag";
  const moved = c.after && (c.after.from !== c.before.from || c.after.to !== c.before.to);
  if (c.action === "move") return "Verplaatst op verzoek";
  return moved ? "Verplaatst" : "Aangepast";
}

/** Wat er tussen twee versies veranderd is, als regels "veld: oud → nieuw". */
function Diff({ before, after }: { before: RequestSnapshot; after: RequestSnapshot }) {
  const rows: [string, JSX.Element][] = [];
  if (before.kind && after.kind && before.kind !== after.kind) {
    rows.push(["Soort", <>{KIND_LABEL[before.kind]} → {KIND_LABEL[after.kind]}</>]);
  }
  if (before.from !== after.from || before.to !== after.to) {
    rows.push(["Wanneer", <><s>{fmtRange(before.from, before.to)}</s> → {fmtRange(after.from, after.to)}</>]);
  }
  const sortedJson = (x: Replacements) => JSON.stringify(Object.entries(x ?? {}).sort());
  if (sortedJson(before.replacements) !== sortedJson(after.replacements)) {
    rows.push(["Vervangers", <ReplacementList value={after.replacements} />]);
  }
  if (before.note !== after.note) {
    rows.push(["Toelichting", <span className="prewrap">{after.note || <span className="note">leeg</span>}</span>]);
  }
  if (rows.length === 0) return null;
  return (
    <dl className="details compact">
      {rows.map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd>{v}</dd></Fragment>)}
    </dl>
  );
}

/** De oorspronkelijke aanvraag (zoals vóór de eerste wijziging) en daarna elke wijziging. */
function History({ changes }: { changes: RequestChange[] }) {
  const orig = changes[0].before;
  return (
    <div className="history">
      <h4>Oorspronkelijke aanvraag</h4>
      <dl className="details compact">
        {orig.kind && <><dt>Soort</dt><dd>{KIND_LABEL[orig.kind]}</dd></>}
        <dt>Wanneer</dt><dd>{fmtRange(orig.from, orig.to)}</dd>
        <dt>Vervangers</dt><dd><ReplacementList value={orig.replacements} /></dd>
        <dt>Toelichting</dt>
        <dd className="prewrap">{orig.note || <span className="note">Geen toelichting.</span>}</dd>
      </dl>
      <h4>Wijzigingen</h4>
      {changes.map((c) => (
        <div className="change" key={c.id}>
          <div>
            <b>{actionLabel(c)}</b> door {c.by} op {fmtLong(toKey(new Date(c.at)))}
          </div>
          {c.reason && <div className="note prewrap">“{c.reason}”</div>}
          {c.after && <Diff before={c.before} after={c.after} />}
        </div>
      ))}
    </div>
  );
}

function ActivityDetail({ a }: { a: Activity }) {
  return (
    <>
      <h3>{a.title}</h3>
      <dl className="details">
        <dt>Wanneer</dt>
        <dd>{fmtLong(a.date)} · hele dag</dd>
        <dt>Toelichting</dt>
        <dd className="prewrap">{a.note ? a.note : <span className="note">Geen toelichting.</span>}</dd>
        <dt>Gepland door</dt>
        <dd>{a.createdBy}</dd>
        {a.updatedBy && (
          <>
            <dt>Aangepast door</dt>
            <dd>{a.updatedBy}{a.updatedAt && ` op ${fmtLong(toKey(new Date(a.updatedAt)))}`}</dd>
          </>
        )}
      </dl>
    </>
  );
}
