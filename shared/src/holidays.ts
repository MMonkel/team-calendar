import { addDays, type DateKey, fromKey, toKey } from "./dates.js";

export interface Holiday {
  name: string;
  // true = alleen Alexandra en Marc werken (1e/2e Kerstdag).
  // false = het team werkt gewoon, dit is puur een label in de kalender.
  adminsOnly: boolean;
}

// Meeus/Jones/Butcher-algoritme voor eerste paasdag (gregoriaanse kalender).
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

const cache = new Map<number, Record<DateKey, Holiday>>();

export function holidaysForYear(year: number): Record<DateKey, Holiday> {
  const cached = cache.get(year);
  if (cached) return cached;

  const easter = easterSunday(year);
  const out: Record<DateKey, Holiday> = {};
  const add = (d: Date, name: string, adminsOnly = false) => {
    out[toKey(d)] = { name, adminsOnly };
  };

  add(addDays(easter, -2), "Goede Vrijdag");
  add(easter, "1e Paasdag");
  add(addDays(easter, 1), "2e Paasdag");
  add(addDays(easter, 39), "Hemelvaartsdag");
  add(addDays(easter, 49), "1e Pinksterdag");
  add(addDays(easter, 50), "2e Pinksterdag");
  // Koningsdag is 27 april, behalve wanneer die op een zondag valt: dan
  // schuift hij naar 26 april.
  const kingsDay = new Date(year, 3, 27);
  add(kingsDay.getDay() === 0 ? new Date(year, 3, 26) : kingsDay, "Koningsdag");
  add(new Date(year, 4, 4), "Dodenherdenking");
  add(new Date(year, 4, 5), "Bevrijdingsdag");
  add(new Date(year, 11, 25), "1e Kerstdag", true);
  add(new Date(year, 11, 26), "2e Kerstdag", true);

  cache.set(year, out);
  return out;
}

export function holidayFor(k: DateKey): Holiday | null {
  return holidaysForYear(fromKey(k).getFullYear())[k] ?? null;
}
