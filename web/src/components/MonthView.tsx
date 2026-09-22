import { type DateKey } from "shared";
import type { DayRoster } from "../lib/api";
import { Dot } from "./Badges";

const MINI_LABEL: Record<string, string> = { am: "och", pm: "mid", day: "" };

export function MonthView({
  days, month, today, onOpenDay,
}: {
  days: DayRoster[];
  month: number; // 0-based month this grid represents; days outside it render dimmed
  today: DateKey;
  onOpenDay: (k: DateKey) => void;
}) {
  return (
    <div className="monthgrid">
      {["ma", "di", "wo", "do", "vr", "za", "zo"].map((h) => <div className="mhead" key={h}>{h}</div>)}
      {days.map((day) => {
        const d = new Date(day.date + "T00:00:00");
        const other = d.getMonth() !== month;
        const isToday = day.date === today;
        const isWeekendLike = day.shifts.length === 1 && day.shifts[0].part === "day";
        return (
          <button
            key={day.date}
            className={
              "mcell" + (other ? " other" : "") + (isWeekendLike ? " wknd" : "") + (isToday ? " istoday" : "")
            }
            onClick={() => onOpenDay(day.date)}
          >
            <div className="d">{d.getDate()}</div>
            {day.holiday && <div className="holiday" style={{ padding: 0 }}>{day.holiday.name}</div>}
            {day.activities.map((a) => <div className="activity" key={a.id} title={a.title}>{a.title}</div>)}
            {day.shifts.map((sh) =>
              sh.slots.map((slot, i) => {
                const name = slot.state === "pending" ? slot.original : slot.actual ?? "—";
                const cls = slot.state === "normal" ? "" : slot.state === "pending" ? "t-draft" : slot.actual ? "" : "t-empty";
                return (
                  <div className="mini" key={sh.part + i}>
                    {MINI_LABEL[sh.part] && <span className="lbl">{MINI_LABEL[sh.part]}</span>}
                    {(slot.actual || slot.state === "pending") && <Dot person={name} />}
                    <span className={"nm" + (cls ? " " + cls : "")}>{name}</span>
                  </div>
                );
              }),
            )}
          </button>
        );
      })}
    </div>
  );
}
