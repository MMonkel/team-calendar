import { useEffect } from "react";
import { type Activity, type AnyRequest, PART_LABEL, toKey } from "shared";
import { fmtLong, fmtRange, fmtShort } from "../lib/format";
import { Dot, StatusPill, typeLabel } from "./Badges";

/** Wat je in de kalender of een overzicht kunt aantikken om de details te zien. */
export type Detail =
  | { kind: "request"; request: AnyRequest }
  | { kind: "activity"; activity: Activity };

export function DetailModal({
  detail, onClose, onEditActivity,
}: {
  detail: Detail;
  onClose: () => void;
  /** Alleen voor admins: toont een knop om de activiteit aan te passen. */
  onEditActivity?: (a: Activity) => void;
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
          <button className="btn primary" onClick={onClose}>Sluiten</button>
        </div>
      </div>
    </div>
  );
}

function RequestDetail({ r }: { r: AnyRequest }) {
  const reps = Object.entries(r.replacements ?? {}).sort();
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
          {r.reviewedBy && <div className="note">door {r.reviewedBy}</div>}
          {r.comment && <div className="note">Reden: {r.comment}</div>}
        </dd>
        {r.type !== "revert" && (
          <>
            <dt>Vervangers</dt>
            <dd>
              {reps.length === 0 ? <span className="note">geen</span> : reps.map(([sk, p]) => {
                const [k, part] = sk.split("|");
                return (
                  <div key={sk}>
                    {fmtShort(k)} {PART_LABEL[part as "am" | "pm" | "day"].toLowerCase()} → <Dot person={p} /> {p}
                  </div>
                );
              })}
            </dd>
          </>
        )}
        <dt>Toelichting</dt>
        <dd className="prewrap">{r.note ? r.note : <span className="note">Geen toelichting.</span>}</dd>
        <dt>Aangevraagd</dt>
        <dd>{fmtLong(toKey(new Date(r.createdAt)))}</dd>
      </dl>
    </>
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
