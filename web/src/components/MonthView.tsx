import { type DateKey } from "shared";
import type { DayRoster } from "../lib/api";
import { Dot } from "./Badges";
import { visibleShifts } from "./SlotView";
import type { Detail } from "./DetailModal";

const MINI_LABEL: Record<string, string> = { am: "och", pm: "mid", day: "" };

export function MonthView({
  days, month, today, showRoster, onOpenDay, onOpenDetail,
}: {
  days: DayRoster[];
  month: number; // 0-based month this grid represents; days outside it render dimmed
  today: DateKey;
  showRoster: boolean;
  onOpenDay: (k: DateKey) => void;
  onOpenDetail: (d: Detail) => void;
}) {
  return (
    <div className="monthgrid">
      {["ma", "di", "wo", "do", "vr", "za", "zo"].map((h) => <div className="mhead" key={h}>{h}</div>)}
      {days.map((day) => {
        const d = new Date(day.date + "T00:00:00");
        const other = d.getMonth() !== month;
        const isToday = day.date === today;
        const isWeekendLike = day.shifts.length === 1 && day.shifts[0].part === "day";
        // Een div i.p.v. <button>: de afwijkingen erin zijn zelf knoppen.
        return (
          <div
            role="button"
            tabIndex={0}
            key={day.date}
            className={
              "mcell" + (other ? " other" : "") + (isWeekendLike ? " wknd" : "") + (isToday ? " istoday" : "")
            }
            onClick={() => onOpenDay(day.date)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenDay(day.date); } }}
          >
            <div className="d">{d.getDate()}</div>
            {day.holiday && <div className="holiday" style={{ padding: 0 }}>{day.holiday.name}</div>}
            {day.activities.map((a) => (
              <button type="button" className="activity tappable" key={a.id} title={a.title}
                onClick={(e) => { e.stopPropagation(); onOpenDetail({ kind: "activity", activity: a }); }}>{a.title}</button>
            ))}
            {visibleShifts(day, showRoster).map((sh) =>
              sh.slots.map((slot, i) => {
                if (slot.state !== "normal" && slot.request) {
                  // Wie er vrij is, en wie het overneemt. Tikken toont de aanvraag.
                  const r = slot.request;
                  return (
                    <button type="button" className="mini tappable" key={sh.part + i}
                      onClick={(e) => { e.stopPropagation(); onOpenDetail({ kind: "request", request: r }); }}>
                      {MINI_LABEL[sh.part] && <span className="lbl">{MINI_LABEL[sh.part]}</span>}
                      <Dot person={slot.original} />
                      <span className={"nm" + (slot.state === "pending" ? " t-draft" : "")}>{slot.original}</span>
                      <span className={"lbl" + (slot.actual ? "" : " t-empty")}>→ {slot.actual ?? "open"}</span>
                    </button>
                  );
                }
                return (
                  <div className="mini" key={sh.part + i}>
                    {MINI_LABEL[sh.part] && <span className="lbl">{MINI_LABEL[sh.part]}</span>}
                    <Dot person={slot.original} />
                    <span className="nm">{slot.original}</span>
                  </div>
                );
              }),
            )}
          </div>
        );
      })}
    </div>
  );
}
