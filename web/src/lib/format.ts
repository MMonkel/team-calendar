// Datumweergave staat in shared, zodat de e-mails van de API dezelfde woorden gebruiken.
export { DAY_NAMES, DAY_SHORT, MONTHS, fmtLong, fmtShort, fmtRange } from "shared";

export function weekNumber(d: Date): number {
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  t.setDate(t.getDate() + 3 - ((t.getDay() + 6) % 7));
  const first = new Date(t.getFullYear(), 0, 4);
  return 1 + Math.round(((t.getTime() - first.getTime()) / 86_400_000 - 3 + ((first.getDay() + 6) % 7)) / 7);
}
