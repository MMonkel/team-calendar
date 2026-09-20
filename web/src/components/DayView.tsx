import type { AnyRequest, DateKey } from "shared";
import { fmtLong, fmtRange } from "../lib/format";
import type { DayRoster } from "../lib/api";
import { SlotView } from "./SlotView";
import { Dot, StatusPill, typeLabel } from "./Badges";

const PART_LABEL: Record<string, string> = { am: "Ochtend", pm: "Middag", day: "Hele dag" };

export function DayView({ day, related }: { day: DayRoster; related: AnyRequest[] }) {
  const isWeekendLike = day.shifts.length === 1 && day.shifts[0].part === "day";
  return (
    <>
      <div className="card">
        <h3>{fmtLong(day.date)}</h3>
        {day.holiday && (
          <div className="sub">
            {day.holiday.name}
            {day.holiday.adminsOnly ? " — Alexandra en Marc draaien deze dag." : " — het team werkt deze dag gewoon."}
          </div>
        )}
        {!day.holiday && isWeekendLike && <div className="sub">Weekenddag: Alexandra en Marc.</div>}
        {day.shifts.map((sh) => (
          <div className="shiftrow" key={sh.part}>
            <div className="lab">{PART_LABEL[sh.part]}</div>
            <div className="people">{sh.slots.map((s, i) => <SlotView slot={s} key={i} />)}</div>
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
                  <tr key={r.id}>
                    <td><Dot person={r.person} /> {r.person}</td>
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
