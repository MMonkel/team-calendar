import { type DateKey, toKey } from "shared";
import { DAY_NAMES } from "../lib/format";
import type { DayRoster } from "../lib/api";
import type { Detail } from "./DetailModal";
import { SlotView, visibleShifts } from "./SlotView";

const PART_LABEL: Record<string, string> = { am: "Ochtend", pm: "Middag", day: "Hele dag" };

export function WeekView({
  days, today, showRoster, onOpenDay, onOpenDetail,
}: {
  days: DayRoster[];
  today: DateKey;
  showRoster: boolean;
  onOpenDay: (k: DateKey) => void;
  onOpenDetail: (d: Detail) => void;
}) {
  return (
    <div className="weekgrid">
      {days.map((day) => {
        const d = new Date(day.date + "T00:00:00");
        const isToday = day.date === today;
        const isWeekendLike = day.shifts.length === 1 && day.shifts[0].part === "day";
        const shifts = visibleShifts(day, showRoster);
        return (
          <div className="daycol" key={day.date}>
            <button className={"dayhead" + (isToday ? " today" : "")} onClick={() => onOpenDay(day.date)}>
              <span className="dn">{DAY_NAMES[d.getDay()]}</span>
              <span className="dd">{d.getDate()}</span>
            </button>
            {day.holiday && <div className="holiday">{day.holiday.name}</div>}
            {day.activities.map((a) => (
              <button type="button" className="activity tappable" key={a.id} title={a.title}
                onClick={() => onOpenDetail({ kind: "activity", activity: a })}>{a.title}</button>
            ))}
            {shifts.length === 0 && day.activities.length === 0 && (
              <div className={"block emptyday" + (isWeekendLike ? " weekendblock" : "")} />
            )}
            {shifts.map((sh) => (
              <div className={"block" + (sh.part === "day" ? " weekendblock" : "")} key={sh.part}>
                <div className="part">{PART_LABEL[sh.part]}</div>
                {sh.slots.map((slot, i) => <SlotView slot={slot} key={i} onOpen={(r) => onOpenDetail({ kind: "request", request: r })} />)}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

export function toKeySafe(d: Date): DateKey {
  return toKey(d);
}
