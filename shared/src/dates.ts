// Datums als 'YYYY-MM-DD' strings, altijd in lokale/kalendertijd (geen tijdzone-
// omrekening). Dit is de enige representatie die door de app heen gaat, zodat
// de client en de server nooit een dag kunnen verschuiven door tijdzones.

export type DateKey = string; // 'YYYY-MM-DD'

const pad = (n: number) => String(n).padStart(2, "0");

export function toKey(d: Date): DateKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromKey(k: DateKey): Date {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function isValidKey(k: string): k is DateKey {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) return false;
  const d = fromKey(k);
  return toKey(d) === k;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function addMonths(d: Date, n: number): Date {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
}

export function startOfWeek(d: Date): Date {
  const weekday = (d.getDay() + 6) % 7; // maandag = 0
  return addDays(d, -weekday);
}

export function daysBetweenKeys(a: DateKey, b: DateKey): number {
  return Math.round((fromKey(b).getTime() - fromKey(a).getTime()) / 86_400_000);
}

export function eachDateKey(fromK: DateKey, toK: DateKey): DateKey[] {
  const out: DateKey[] = [];
  let d = fromKey(fromK);
  const end = fromKey(toK);
  while (d <= end) {
    out.push(toKey(d));
    d = addDays(d, 1);
  }
  return out;
}

export function todayKey(): DateKey {
  return toKey(new Date());
}
