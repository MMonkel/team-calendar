import { type DateKey, toKey } from "shared";
import { DAY_NAMES } from "../lib/format";
import type { DayRoster } from "../lib/api";
import { SlotView } from "./SlotView";

const PART_LABEL: Record<string, string> = { am: "Ochtend", pm: "Middag", day: "Hele dag" };

export function WeekView({
  days, today, onOpenDay,
}: {
  days: DayRoster[];
  today: DateKey;
  onOpenDay: (k: DateKey) => void;
}) {
  return (
    <div className="weekgrid">
      {days.map((day) => {
        const d = new Date(day.date + "T00:00:00");
        const isToday = day.date === today;
        return (
          <div className="daycol" key={day.date}>
            <button className={"dayhead" + (isToday ? " today" : "")} onClick={() => onOpenDay(day.date)}>
              <span className="dn">{DAY_NAMES[d.getDay()]}</span>
              <span className="dd">{d.getDate()}</span>
            </button>
            {day.holiday && <div className="holiday">{day.holiday.name}</div>}
            {day.activities.map((a) => <div className="activity" key={a.id} title={a.title}>{a.title}</div>)}
            {day.shifts.map((sh) => (
              <div className={"block" + (sh.part === "day" ? " weekendblock" : "")} key={sh.part}>
                <div className="part">{PART_LABEL[sh.part]}</div>
                {sh.slots.map((slot, i) => <SlotView slot={slot} key={i} />)}
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
