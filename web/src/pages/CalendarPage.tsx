import { useEffect, useMemo, useState } from "react";
import { addDays, addMonths, startOfWeek, toKey, todayKey, type DateKey } from "shared";
import { api, type DayRoster } from "../lib/api";
import { fmtRange, MONTHS, weekNumber } from "../lib/format";
import { WeekView } from "../components/WeekView";
import { MonthView } from "../components/MonthView";
import { DayView, relatedRequests } from "../components/DayView";

type Mode = "day" | "week" | "month";

export function CalendarPage() {
  const [mode, setMode] = useState<Mode>("week");
  const [cursor, setCursor] = useState<Date>(() => new Date());
  const [days, setDays] = useState<DayRoster[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const today = todayKey();

  const { from, to } = useMemo(() => {
    if (mode === "day") {
      const k = toKey(cursor);
      return { from: k, to: k };
    }
    if (mode === "week") {
      const start = startOfWeek(cursor);
      return { from: toKey(start), to: toKey(addDays(start, 6)) };
    }
    // month: render a full 6-week grid so the layout never jumps
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = startOfWeek(first);
    const end = addDays(start, 41);
    return { from: toKey(start), to: toKey(end) };
  }, [mode, cursor]);

  useEffect(() => {
    let cancelled = false;
    api.roster(from, to)
      .then((rows) => { if (!cancelled) { setDays(rows); setError(null); } })
      .catch((e) => { if (!cancelled) setError(e.message ?? "Kon de planning niet laden."); });
    return () => { cancelled = true; };
  }, [from, to]);

  function step(dir: 1 | -1) {
    if (mode === "day") setCursor(addDays(cursor, dir));
    else if (mode === "week") setCursor(addDays(cursor, 7 * dir));
    else setCursor(addMonths(cursor, dir));
  }

  function openDay(k: DateKey) {
    setCursor(new Date(k + "T00:00:00"));
    setMode("day");
  }

  const title =
    mode === "day"
      ? fmtRange(toKey(cursor), toKey(cursor))
      : mode === "month"
      ? `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`
      : (() => {
          const start = startOfWeek(cursor);
          const end = addDays(start, 6);
          return `Week ${weekNumber(start)} · ${fmtRange(toKey(start), toKey(end))}`;
        })();

  return (
    <>
      <div className="periodbar">
        <div className="nav">
          <button className="btn" aria-label="Vorige" onClick={() => step(-1)}>‹</button>
          <button className="btn" aria-label="Volgende" onClick={() => step(1)}>›</button>
          <button className="btn" onClick={() => setCursor(new Date())}>Vandaag</button>
        </div>
        <h2>{title}</h2>
        <div className="spacer" />
        <div className="seg">
          {(["day", "week", "month"] as Mode[]).map((m) => (
            <button key={m} data-active={mode === m} onClick={() => setMode(m)}>
              {{ day: "Dag", week: "Week", month: "Maand" }[m]}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="errorbar">{error}</div>}
      {!days && !error && <div className="empty">Bezig met laden…</div>}

      {days && mode === "week" && <WeekView days={days} today={today} onOpenDay={openDay} />}
      {days && mode === "month" && (
        <MonthView days={days} month={cursor.getMonth()} today={today} onOpenDay={openDay} />
      )}
      {days && mode === "day" && days[0] && (
        <DayView day={days[0]} related={relatedRequests(days[0])} />
      )}
    </>
  );
}
