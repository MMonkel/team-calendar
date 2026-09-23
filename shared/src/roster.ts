import { BASE_SCHEDULE, type DayPart, type Person, type Shift } from "./team.js";
import { holidayFor } from "./holidays.js";
import { addMonths, type DateKey, daysBetweenKeys, eachDateKey, fromKey, todayKey } from "./dates.js";

/** Het basisrooster voor één dag, met feestdagen verwerkt. */
export function baseShiftsFor(k: DateKey): Shift[] {
  const holiday = holidayFor(k);
  if (holiday?.adminsOnly) {
    return [{ part: "day", people: ["Alexandra", "Marc"] }];
  }
  const weekday = fromKey(k).getDay();
  return BASE_SCHEDULE[weekday].map((s) => ({ part: s.part, people: [...s.people] }));
}

export function isWeekendLike(k: DateKey): boolean {
  const shifts = baseShiftsFor(k);
  return shifts.length === 1 && shifts[0].part === "day";
}

export function shiftKey(k: DateKey, part: DayPart): string {
  return `${k}|${part}`;
}

/** Alle dagdelen die een persoon in [from, to] van zichzelf heeft, ongeacht aanvragen. */
export function ownShiftsInRange(
  person: Person,
  from: DateKey,
  to: DateKey,
): Array<{ date: DateKey; part: DayPart }> {
  const out: Array<{ date: DateKey; part: DayPart }> = [];
  for (const k of eachDateKey(from, to)) {
    for (const s of baseShiftsFor(k)) {
      if (s.people.includes(person)) out.push({ date: k, part: s.part });
    }
  }
  return out;
}

/**
 * null: geen waarschuwing nodig.
 * { pastDate: true }: de eerste dag ligt al in het verleden.
 * { daysUntil }: de eerste dag ligt binnen 3 maanden vanaf vandaag.
 */
export type NoticeWarning = { pastDate: true } | { daysUntil: number } | null;

export function noticeWarning(fromK: DateKey, today: DateKey = todayKey()): NoticeWarning {
  const start = fromKey(fromK);
  const t = fromKey(today);
  if (start < t) return { pastDate: true };
  const limit = addMonths(t, 3);
  if (start < limit) return { daysUntil: daysBetweenKeys(today, fromK) };
  return null;
}

export function isShortNotice(fromK: DateKey, today: DateKey = todayKey()): boolean {
  const w = noticeWarning(fromK, today);
  return w !== null && !("pastDate" in w);
}

// ---------------------------------------------------------------------------
// Aanvragen
// ---------------------------------------------------------------------------

export type RequestType = "absence" | "move" | "revert";
/** "deleted": door een admin verwijderd; blijft zichtbaar in de overzichten, telt niet meer mee. */
export type RequestStatus = "draft" | "approved" | "rejected" | "cancelled" | "deleted";
export type AbsenceKind = "day" | "vacation";

/** Vervangingen per dagdeel: sleutel is shiftKey(date, part), waarde is de vervanger. */
export type Replacements = Record<string, Person>;

export interface AbsenceRequest {
  id: string;
  type: "absence";
  kind: AbsenceKind;
  person: Person;
  from: DateKey;
  to: DateKey;
  replacements: Replacements;
  note: string;
  status: RequestStatus;
  shortNotice: boolean;
  createdAt: string; // ISO
  reviewedBy?: Person;
  reviewedAt?: string;
  comment?: string; // reden bij afkeuren
  changeCount?: number; // aantal wijzigingen in de geschiedenis
}

export interface MoveRequest {
  id: string;
  type: "move";
  person: Person;
  targetId: string; // id van de AbsenceRequest die verplaatst wordt
  origFrom: DateKey;
  origTo: DateKey;
  from: DateKey; // nieuwe periode
  to: DateKey;
  replacements: Replacements;
  note: string;
  status: RequestStatus;
  shortNotice: boolean;
  createdAt: string;
  reviewedBy?: Person;
  reviewedAt?: string;
  comment?: string;
  changeCount?: number; // aantal wijzigingen in de geschiedenis
}

export interface RevertRequest {
  id: string;
  type: "revert";
  person: Person;
  targetId: string; // id van de AbsenceRequest die vervalt
  origFrom: DateKey;
  origTo: DateKey;
  from: DateKey; // gelijk aan origFrom/origTo, voor uniforme weergave
  to: DateKey;
  replacements: Replacements; // altijd leeg
  note: string;
  status: RequestStatus;
  shortNotice: boolean;
  createdAt: string;
  reviewedBy?: Person;
  reviewedAt?: string;
  comment?: string;
  changeCount?: number; // aantal wijzigingen in de geschiedenis
}

export type AnyRequest = AbsenceRequest | MoveRequest | RevertRequest;

/** Hoe een aanvraag eruitzag vóór (en na) een wijziging; bewaard in de geschiedenis. */
export interface RequestSnapshot {
  kind?: AbsenceKind;
  from: DateKey;
  to: DateKey;
  replacements: Replacements;
  note: string;
  status: RequestStatus;
}

export type ChangeAction =
  | "edit" // aangepast (en/of verplaatst) door een admin
  | "delete" // verwijderd door een admin
  | "move" // verplaatst na goedkeuring van een verplaatsingsaanvraag
  | "revert"; // teruggezet na goedkeuring van een terugzetaanvraag

export interface RequestChange {
  id: string;
  requestId: string;
  action: ChangeAction;
  by: Person;
  at: string; // ISO
  reason: string;
  before: RequestSnapshot;
  after: RequestSnapshot | null; // null bij verwijderen
}

export function snapshotOf(r: AnyRequest): RequestSnapshot {
  return {
    ...(r.type === "absence" ? { kind: r.kind } : {}),
    from: r.from,
    to: r.to,
    replacements: r.replacements,
    note: r.note,
    status: r.status,
  };
}

function coversDate(r: AbsenceRequest, k: DateKey): boolean {
  return k >= r.from && k <= r.to;
}

/** Absence-aanvragen die het rooster daadwerkelijk beïnvloeden (nog niet afgekeurd/teruggezet). */
export function activeAbsences(requests: AnyRequest[]): AbsenceRequest[] {
  return requests.filter(
    (r): r is AbsenceRequest =>
      r.type === "absence" && (r.status === "draft" || r.status === "approved"),
  );
}

export type SlotState = "normal" | "pending" | "away";

export interface EffectiveSlot {
  original: Person;
  actual: Person | null;
  state: SlotState;
  request: AbsenceRequest | null;
}

export interface EffectiveShift {
  part: DayPart;
  slots: EffectiveSlot[];
}

/** Basisrooster + goedgekeurde/openstaande aanvragen = wie er die dag echt staat. */
export function effectiveShiftsFor(k: DateKey, requests: AnyRequest[]): EffectiveShift[] {
  const shifts: EffectiveShift[] = baseShiftsFor(k).map((s) => ({
    part: s.part,
    slots: s.people.map((p) => ({ original: p, actual: p, state: "normal" as SlotState, request: null })),
  }));

  for (const r of activeAbsences(requests)) {
    if (!coversDate(r, k)) continue;
    for (const shift of shifts) {
      for (const slot of shift.slots) {
        if (slot.original !== r.person) continue;
        const replacement = r.replacements[shiftKey(k, shift.part)] ?? null;
        slot.actual = replacement;
        slot.state = r.status === "approved" ? "away" : "pending";
        slot.request = r;
      }
    }
  }
  return shifts;
}

export interface FreeDayEntry {
  date: DateKey;
  part: DayPart;
  kind: AbsenceKind;
  replacement: Person | null;
  status: RequestStatus;
}

/** Alle dagdelen die iemand in een jaar vrij heeft (aangevraagd), voor het jaaroverzicht. */
export function freeDaysForYear(person: Person, year: number, requests: AnyRequest[]): FreeDayEntry[] {
  const out: FreeDayEntry[] = [];
  for (const r of requests) {
    if (r.type !== "absence" || r.person !== person) continue;
    if (r.status !== "draft" && r.status !== "approved") continue;
    for (const k of eachDateKey(r.from, r.to)) {
      if (fromKey(k).getFullYear() !== year) continue;
      for (const s of baseShiftsFor(k)) {
        if (!s.people.includes(person)) continue;
        out.push({
          date: k,
          part: s.part,
          kind: r.kind,
          replacement: r.replacements[shiftKey(k, s.part)] ?? null,
          status: r.status,
        });
      }
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export interface ExtraDayEntry {
  date: DateKey;
  part: DayPart;
  forPerson: Person;
  status: RequestStatus;
}

/** Alle dagdelen die iemand als vervanger draait, buiten het eigen rooster om. */
export function extraDaysForYear(person: Person, year: number, requests: AnyRequest[]): ExtraDayEntry[] {
  const out: ExtraDayEntry[] = [];
  for (const r of requests) {
    if (r.type !== "absence") continue;
    if (r.status !== "draft" && r.status !== "approved") continue;
    for (const [sk, replacement] of Object.entries(r.replacements)) {
      if (replacement !== person) continue;
      const [k, part] = sk.split("|") as [DateKey, DayPart];
      if (fromKey(k).getFullYear() !== year) continue;
      if (k < r.from || k > r.to) continue;
      out.push({ date: k, part, forPerson: r.person, status: r.status });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
