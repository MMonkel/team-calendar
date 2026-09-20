import { type DateKey, fromKey } from "shared";

export const DAY_NAMES = ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"];
export const DAY_SHORT = ["zo", "ma", "di", "wo", "do", "vr", "za"];
export const MONTHS = [
  "januari", "februari", "maart", "april", "mei", "juni",
  "juli", "augustus", "september", "oktober", "november", "december",
];

export function fmtLong(k: DateKey): string {
  const d = fromKey(k);
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function fmtShort(k: DateKey): string {
  const d = fromKey(k);
  return `${DAY_SHORT[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
}

export function fmtRange(a: DateKey, b: DateKey): string {
  return a === b ? fmtShort(a) : `${fmtShort(a)} t/m ${fmtShort(b)}`;
}

export function weekNumber(d: Date): number {
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  t.setDate(t.getDate() + 3 - ((t.getDay() + 6) % 7));
  const first = new Date(t.getFullYear(), 0, 4);
  return 1 + Math.round(((t.getTime() - first.getTime()) / 86_400_000 - 3 + ((first.getDay() + 6) % 7)) / 7);
}
