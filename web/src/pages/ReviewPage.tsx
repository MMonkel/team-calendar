import { useEffect, useState } from "react";
import { ownShiftsInRange, PART_LABEL, shiftKey, type AnyRequest } from "shared";
import { api, ApiError } from "../lib/api";
import { fmtRange, fmtShort } from "../lib/format";
import { Dot } from "../components/Badges";
import { RejectModal } from "../components/RejectModal";

export function ReviewPage({ onCountChange }: { onCountChange: (n: number) => void }) {
  const [drafts, setDrafts] = useState<AnyRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<AnyRequest | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    api.requests({ status: "draft" })
      .then((rows) => {
        const sorted = rows.sort((a, b) => a.from.localeCompare(b.from));
        setDrafts(sorted);
        onCountChange(sorted.length);
        setError(null);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Laden mislukte."));
  }

  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function approve(r: AnyRequest) {
    setBusyId(r.id);
    try { await api.decide(r.id, { approve: true }); load(); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Goedkeuren mislukte."); }
    finally { setBusyId(null); }
  }

  if (drafts === null) return <div className="card"><div className="empty">Bezig met laden…</div></div>;

  return (
    <>
      <div className="periodbar"><h2>Te beoordelen</h2></div>
      {error && <div className="errorbar">{error}</div>}
      {drafts.length === 0 ? (
        <div className="card"><div className="empty">Geen openstaande aanvragen.</div></div>
      ) : (
        drafts.map((r) => (
          <ReviewCard
            key={r.id}
            request={r}
            busy={busyId === r.id}
            onApprove={() => approve(r)}
            onReject={() => setRejectTarget(r)}
          />
        ))
      )}
      {rejectTarget && (
        <RejectModal
          request={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onDecided={() => { setRejectTarget(null); load(); }}
        />
      )}
    </>
  );
}

function typeLabel(r: AnyRequest): string {
  if (r.type === "absence") return r.kind === "vacation" ? "Vakantie" : "Vrije dag";
  if (r.type === "move") return "Verplaatsing";
  return "Terug naar werkdag";
}

function ReviewCard({
  request: r, busy, onApprove, onReject,
}: {
  request: AnyRequest;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const shifts = r.type !== "revert" ? ownShiftsInRange(r.person, r.from, r.to) : [];
  const uncovered = shifts.filter((s) => !(r.replacements ?? {})[shiftKey(s.date, s.part)]);

  return (
    <div className="card">
      <h3><Dot person={r.person} /> {r.person} — {typeLabel(r)}</h3>
      <div className="sub">{fmtRange(r.from, r.to)} · aangevraagd op {fmtShort(r.createdAt.slice(0, 10))}</div>

      {r.shortNotice && (
        <div className="warn"><b>Korte termijn</b>Aangevraagd binnen 3 maanden voor de eerste dag.</div>
      )}
      {r.type !== "revert" && uncovered.length > 0 && (
        <div className="warn"><b>{uncovered.length} dagdeel(en) zonder vervanger</b>Goedkeuren kan, maar die blijven dan open staan.</div>
      )}
      {r.note && <p className="note">“{r.note}”</p>}

      {r.type === "absence" && (
        <div className="tablewrap">
          <table>
            <thead><tr><th>Dagdeel</th><th>Vervanger</th></tr></thead>
            <tbody>
              {shifts.length === 0 ? (
                <tr><td colSpan={2} className="note">Deze periode raakt geen ingeroosterde dagdelen.</td></tr>
              ) : shifts.map((s) => {
                const p = r.replacements[shiftKey(s.date, s.part)];
                return (
                  <tr key={shiftKey(s.date, s.part)}>
                    <td className="num">{fmtShort(s.date)} · {PART_LABEL[s.part].toLowerCase()}</td>
                    <td>{p ? <><Dot person={p} /> {p}</> : <span className="tagline t-empty">nog niemand</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {r.type === "move" && (
        <>
          <p className="note">Verplaatsen van {fmtRange(r.origFrom, r.origTo)} naar {fmtRange(r.from, r.to)}.</p>
          {Object.entries(r.replacements).length > 0 && (
            <div className="tablewrap">
              <table>
                <tbody>
                  {Object.entries(r.replacements).sort().map(([sk, p]) => {
                    const [k, part] = sk.split("|");
                    return (
                      <tr key={sk}>
                        <td className="num">{fmtShort(k)} · {PART_LABEL[part as "am" | "pm" | "day"].toLowerCase()}</td>
                        <td><Dot person={p} /> {p}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {r.type === "revert" && (
        <p className="note">
          De vrije periode van {fmtRange(r.origFrom, r.origTo)} vervalt; {r.person} draait die dagdelen weer zelf.
        </p>
      )}

      <div className="modalactions">
        <button className="btn" disabled={busy} onClick={onReject}>Afkeuren…</button>
        <button className="btn primary" disabled={busy} onClick={onApprove}>Goedkeuren</button>
      </div>
    </div>
  );
}
