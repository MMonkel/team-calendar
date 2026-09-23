import { useEffect, useMemo, useState } from "react";
import { addDays, addMonths, startOfWeek, toKey, todayKey, type DateKey } from "shared";
import { api, type DayRoster } from "../lib/api";
import { fmtLong, fmtRange, MONTHS, weekNumber } from "../lib/format";
import { WeekView } from "../components/WeekView";
import { MonthView } from "../components/MonthView";
import { DayView, relatedRequests } from "../components/DayView";
import { PrintButton, PrintHeader } from "../components/Print";
import { type Detail, DetailModal } from "../components/DetailModal";
import { ActivityModal } from "../components/ActivityModal";
import { useAdminRequestActions } from "../components/AdminRequestModals";
import type { Activity } from "shared";

type Mode = "day" | "workweek" | "week" | "month";

const MODE_LABEL: Record<Mode, string> = { day: "Dag", workweek: "Werkweek", week: "Week", month: "Maand" };
const MODE_SUB: Record<Mode, string> = {
  day: "Dagoverzicht", workweek: "Werkweekoverzicht", week: "Weekoverzicht", month: "Maandoverzicht",
};

export function CalendarPage({ admin, refreshSignal = 0 }: { admin: boolean; refreshSignal?: number }) {
  const [mode, setMode] = useState<Mode>("week");
  const [cursor, setCursor] = useState<Date>(() => new Date());
  const [days, setDays] = useState<DayRoster[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [editActivity, setEditActivity] = useState<Activity | null>(null);
  const requestActions = useAdminRequestActions(() => setReload((n) => n + 1));
  const [showRoster, setShowRoster] = useState(() => {
    try { return localStorage.getItem("teams.showRoster") === "1"; } catch { return false; }
  });
  function toggleRoster() {
    const next = !showRoster;
    setShowRoster(next);
    try { localStorage.setItem("teams.showRoster", next ? "1" : "0"); } catch { /* niet erg */ }
  }
  const today = todayKey();

  const { from, to } = useMemo(() => {
    if (mode === "day") {
      const k = toKey(cursor);
      return { from: k, to: k };
    }
    if (mode === "week" || mode === "workweek") {
      const start = startOfWeek(cursor);
      return { from: toKey(start), to: toKey(addDays(start, mode === "workweek" ? 4 : 6)) };
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
  }, [from, to, reload, refreshSignal]);

  function step(dir: 1 | -1) {
    if (mode === "day") setCursor(addDays(cursor, dir));
    else if (mode === "week" || mode === "workweek") setCursor(addDays(cursor, 7 * dir));
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
          const end = addDays(start, mode === "workweek" ? 4 : 6);
          return `Week ${weekNumber(start)} · ${fmtRange(toKey(start), toKey(end))}`;
        })();

  return (
    <>
      <PrintHeader
        title={`Rooster — ${mode === "day" ? fmtLong(toKey(cursor)) : title}`}
        sub={MODE_SUB[mode] + (showRoster ? "" : " · alleen vrij, gewisseld en activiteiten")}
        landscape={mode !== "day"}
      />
      <div className="periodbar">
        <div className="nav">
          <button className="btn" aria-label="Vorige" onClick={() => step(-1)}>‹</button>
          <button className="btn" aria-label="Volgende" onClick={() => step(1)}>›</button>
          <button className="btn" onClick={() => setCursor(new Date())}>Vandaag</button>
        </div>
        <h2>{title}</h2>
        <div className="spacer" />
        <div className="seg">
          {(["day", "workweek", "week", "month"] as Mode[]).map((m) => (
            <button key={m} data-active={mode === m} onClick={() => setMode(m)}>
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>
        <button className="btn" aria-pressed={showRoster} data-active={showRoster} onClick={toggleRoster}>
          {showRoster ? "Rooster verbergen" : "Rooster tonen"}
        </button>
        <PrintButton label={`Print ${MODE_LABEL[mode].toLowerCase()}`} />
      </div>

      {error && <div className="errorbar">{error}</div>}
      {!days && !error && <div className="empty">Bezig met laden…</div>}

      {days && (mode === "week" || mode === "workweek") && <WeekView days={days} workweek={mode === "workweek"} today={today} showRoster={showRoster} onOpenDay={openDay} onOpenDetail={setDetail} />}
      {days && mode === "month" && (
        <MonthView days={days} month={cursor.getMonth()} today={today} showRoster={showRoster} onOpenDay={openDay} onOpenDetail={setDetail} />
      )}
      {days && mode === "day" && days[0] && (
        <DayView
          day={days[0]}
          related={relatedRequests(days[0])}
          admin={admin}
          showRoster={showRoster}
          onOpenDetail={setDetail}
          onChanged={() => setReload((n) => n + 1)}
        />
      )}
      {detail && (
        <DetailModal
          detail={detail}
          onClose={() => setDetail(null)}
          onEditActivity={admin ? (a) => { setDetail(null); setEditActivity(a); } : undefined}
          onEditRequest={admin ? (r) => { setDetail(null); requestActions.edit(r); } : undefined}
          onRemoveRequest={admin ? (r) => { setDetail(null); requestActions.remove(r); } : undefined}
        />
      )}
      {requestActions.modals}
      {editActivity && (
        <ActivityModal
          date={editActivity.date}
          activity={editActivity}
          onClose={() => setEditActivity(null)}
          onCreated={() => { setEditActivity(null); setReload((n) => n + 1); }}
        />
      )}
    </>
  );
}
