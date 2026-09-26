import { useCallback, useEffect, useState } from "react";
import { addDays, fromKey, toKey, todayKey, type Activity, type Person } from "shared";
import { api } from "./api";

const HORIZON_DAYS = 365;

function seenKey(me: Person): string {
  return `teams.seenActivities.${me}`;
}

/** Een aangepaste activiteit telt weer als nieuw. */
function versionOf(a: Activity): string {
  return `${a.id}|${a.updatedAt ?? a.createdAt}`;
}

function readSeen(me: Person): Set<string> {
  try {
    const raw = localStorage.getItem(seenKey(me));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function writeSeen(me: Person, seen: Set<string>) {
  try { localStorage.setItem(seenKey(me), JSON.stringify([...seen])); } catch { /* niet erg */ }
}

/**
 * Komende activiteiten op dagen dat 'me' zelf ingeroosterd staat (na vervangingen),
 * en welke daarvan nog niet bekeken zijn.
 */
export function useActivityNotices(me: Person, enabled: boolean, refreshSignal: number) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [seen, setSeen] = useState<Set<string>>(() => readSeen(me));

  useEffect(() => {
    setSeen(readSeen(me));
    if (!enabled) { setActivities([]); return; }
    let alive = true;
    const load = () => {
      const from = todayKey();
      const to = toKey(addDays(fromKey(from), HORIZON_DAYS));
      api.roster(from, to)
        .then((days) => {
          if (!alive) return;
          const mine = days
            .filter((d) => d.activities.length > 0)
            .filter((d) => d.shifts.some((s) => s.slots.some((slot) => slot.actual === me)))
            .flatMap((d) => d.activities);
          setActivities(mine);
        })
        .catch(() => {});
    };
    load();
    const timer = setInterval(load, 5 * 60_000);
    const onVisible = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [me, enabled, refreshSignal]);

  const unseen = activities.filter((a) => !seen.has(versionOf(a)));

  const markAllSeen = useCallback(() => {
    // Alleen actuele versies bewaren, zodat de lijst niet eindeloos groeit.
    const next = new Set(activities.map(versionOf));
    writeSeen(me, next);
    setSeen(next);
  }, [activities, me]);

  return { activities, unseen, isNew: (a: Activity) => !seen.has(versionOf(a)), markAllSeen };
}
