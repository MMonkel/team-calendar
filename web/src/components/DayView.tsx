import { useState } from "react";
import type { Activity, AnyRequest } from "shared";
import { fmtLong, fmtRange } from "../lib/format";
import type { DayRoster } from "../lib/api";
import { SlotView, visibleShifts } from "./SlotView";
import { Dot, StatusPill, typeLabel } from "./Badges";
import { ActivityModal } from "./ActivityModal";
import type { Detail } from "./DetailModal";
import { api, ApiError } from "../lib/api";

const PART_LABEL: Record<string, string> = { am: "Ochtend", pm: "Middag", day: "Hele dag" };

export function DayView({
  day, related, admin, showRoster, onChanged, onOpenDetail,
}: {
  day: DayRoster;
  showRoster: boolean;
  related: AnyRequest[];
  admin: boolean;
  onChanged: () => void;
  onOpenDetail: (d: Detail) => void;
}) {
  const isWeekendLike = day.shifts.length === 1 && day.shifts[0].part === "day";
  const shifts = visibleShifts(day, showRoster);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function remove(a: Activity) {
    if (!confirm(`Activiteit "${a.title}" verwijderen?`)) return;
    setError(null);
    try {
      await api.deleteActivity(a.id);
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Verwijderen mislukte. Probeer het nog eens.");
    }
  }

  return (
    <>
      <div className="card">
        <div style={{ display: "flex", gap: ".75rem", alignItems: "baseline", flexWrap: "wrap" }}>
          <h3>{fmtLong(day.date)}</h3>
          <div style={{ flex: 1 }} />
          {admin && <button className="btn small" onClick={() => setAdding(true)}>Activiteit plannen</button>}
        </div>
        {day.holiday && (
          <div className="sub">
            {day.holiday.name}
            {showRoster && (day.holiday.adminsOnly ? " — Alexandra en Marc draaien deze dag." : " — het team werkt deze dag gewoon.")}
          </div>
        )}
        {showRoster && !day.holiday && isWeekendLike && <div className="sub">Weekenddag: Alexandra en Marc.</div>}
        {error && <div className="errorbar">{error}</div>}
        {day.activities.map((a) => (
          <div className="activityrow" key={a.id}>
            <div className="body">
              <div className="ttl">{a.title}</div>
              {a.note && <div className="note">{a.note}</div>}
              <div className="note">
                Hele dag · gepland door {a.createdBy}
                {a.updatedBy && ` · aangepast door ${a.updatedBy}`}
              </div>
            </div>
            {admin && (
              <div className="rowactions">
                <button className="btn small" onClick={() => setEditing(a)}>Aanpassen</button>
                <button className="btn small" onClick={() => remove(a)}>Verwijderen</button>
              </div>
            )}
          </div>
        ))}
        {shifts.length === 0 && day.activities.length === 0 && (
          <div className="empty">Geen bijzonderheden: niemand vrij of gewisseld.</div>
        )}
        {shifts.map((sh) => (
          <div className="shiftrow" key={sh.part}>
            <div className="lab">{PART_LABEL[sh.part]}</div>
            <div className="people">{sh.slots.map((s, i) => <SlotView slot={s} key={i} onOpen={(r) => onOpenDetail({ kind: "request", request: r })} />)}</div>
          </div>
        ))}
      </div>

      {related.length > 0 && (
        <div className="card">
          <h3>Aanvragen die deze dag raken</h3>
          <div className="tablewrap">
            <table>
              <tbody>
                {related.map((r) => (
                  <tr key={r.id} className="tappable" onClick={() => onOpenDetail({ kind: "request", request: r })}>
                    <td>
                      <Dot person={r.person} /> {r.person}
                      {r.note && <div className="note prewrap">“{r.note}”</div>}
                    </td>
                    <td>{typeLabel(r)}</td>
                    <td className="num">{fmtRange(r.from, r.to)}</td>
                    <td><StatusPill status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editing && (
        <ActivityModal
          date={editing.date}
          activity={editing}
          onClose={() => setEditing(null)}
          onCreated={() => { setEditing(null); onChanged(); }}
        />
      )}

      {adding && (
        <ActivityModal
          date={day.date}
          onClose={() => setAdding(false)}
          onCreated={() => { setAdding(false); onChanged(); }}
        />
      )}
    </>
  );
}

export function relatedRequests(day: DayRoster): AnyRequest[] {
  const byId = new Map<string, AnyRequest>();
  for (const sh of day.shifts) {
    for (const slot of sh.slots) {
      if (slot.request && (slot.request.status === "draft" || slot.request.status === "approved")) {
        byId.set(slot.request.id, slot.request);
      }
    }
  }
  return [...byId.values()];
}
