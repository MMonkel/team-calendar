import {
  type AnyRequest, type DateKey, isPerson, isShortNotice, isValidKey,
  ownShiftsInRange, type Person, type Replacements, shiftKey,
} from "shared";

export class ValidationError extends Error {}

export function assertValidRange(from: string, to: string): asserts from is DateKey {
  if (!isValidKey(from) || !isValidKey(to)) {
    throw new ValidationError("Datum moet het formaat YYYY-MM-DD hebben.");
  }
  if (to < from) {
    throw new ValidationError("De einddatum ligt voor de begindatum.");
  }
}

/**
 * Vervangers mogen alleen worden opgegeven voor dagdelen die daadwerkelijk
 * van de aanvrager zijn, en een vervanger moet een bestaand teamlid zijn dat
 * niet zichzelf vervangt. Onbekende sleutels worden genegeerd (nooit blind
 * doorgezet), zodat een gemanipuleerd verzoek geen dagdelen van iemand
 * anders kan aanpassen.
 */
export function sanitizeReplacements(
  person: Person,
  from: DateKey,
  to: DateKey,
  input: unknown,
): Replacements {
  if (input == null || typeof input !== "object") return {};
  const validKeys = new Set(
    ownShiftsInRange(person, from, to).map((s) => shiftKey(s.date, s.part)),
  );
  const out: Replacements = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (!validKeys.has(k)) continue;
    if (typeof v !== "string" || !isPerson(v) || v === person) continue;
    out[k] = v;
  }
  return out;
}

export function computeShortNotice(from: DateKey): boolean {
  return isShortNotice(from);
}

/**
 * Past de kaskade-effecten van een goedkeuring toe op het doel-verzoek van
 * een move/revert, en geeft de velden terug die op dat doel-verzoek
 * bijgewerkt moeten worden (of null als er niets te doen is, bijv. het doel
 * bestaat niet meer).
 */
export function cascadeForApproval(
  decision: AnyRequest,
  target: AnyRequest | null,
  reviewedBy: Person,
  reviewedAt: string,
): Partial<{
  from: DateKey; to: DateKey; replacements: Replacements;
  status: AnyRequest["status"]; reviewedBy: string; reviewedAt: string;
}> | null {
  if (!target) return null;
  if (decision.type === "move") {
    return {
      from: decision.from,
      to: decision.to,
      replacements: decision.replacements,
      status: "approved",
      reviewedBy,
      reviewedAt,
    };
  }
  if (decision.type === "revert") {
    return { status: "cancelled", reviewedBy, reviewedAt };
  }
  return null;
}
