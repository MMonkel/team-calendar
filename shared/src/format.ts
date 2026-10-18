// Nederlandse datumweergave, gedeeld door de frontend en de e-mails van de API.
import { type DateKey, fromKey } from "./dates.js";

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

export function typeLabel(r: { type: string; kind?: string }): string {
  if (r.type === "absence") return r.kind === "vacation" ? "Vakantie" : "Vrije dag";
  if (r.type === "move") return "Verplaatsing";
  if (r.type === "revert") return "Terug naar werkdag";
  return r.type;
}
