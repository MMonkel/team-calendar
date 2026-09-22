// Team-samenstelling en het vaste basisrooster van Team S.
// Wijzig alleen dit bestand als het rooster zelf wijzigt; de logica die
// ermee rekent staat in roster.ts.

export const ADMINS = ["Alexandra", "Marc"] as const;
export const MEMBERS = ["Nicole", "Celestine", "Mariska", "Robin", "Marielle", "Jim"] as const;

export type Person = (typeof ADMINS)[number] | (typeof MEMBERS)[number];

export const PEOPLE: Person[] = [...ADMINS, ...MEMBERS];

export function isAdmin(person: string): person is (typeof ADMINS)[number] {
  return (ADMINS as readonly string[]).includes(person);
}

export function isPerson(value: string): value is Person {
  return (PEOPLE as readonly string[]).includes(value);
}

export type DayPart = "am" | "pm" | "day";

export interface Shift {
  part: DayPart;
  people: Person[];
}

// Basisrooster per weekdag. JS-conventie: 0 = zondag ... 6 = zaterdag.
export const BASE_SCHEDULE: Record<number, Shift[]> = {
  1: [{ part: "am", people: ["Celestine"] }, { part: "pm", people: ["Robin"] }],
  2: [{ part: "am", people: ["Mariska"] }, { part: "pm", people: ["Nicole"] }],
  3: [{ part: "am", people: ["Celestine"] }, { part: "pm", people: ["Alexandra", "Marc"] }],
  4: [{ part: "am", people: ["Robin"] }, { part: "pm", people: ["Mariska"] }],
  5: [{ part: "am", people: ["Nicole"] }, { part: "pm", people: ["Marielle"] }],
  6: [{ part: "day", people: ["Alexandra", "Marc"] }],
  0: [{ part: "day", people: ["Alexandra", "Marc"] }],
};

export const PART_LABEL: Record<DayPart, string> = {
  am: "Ochtend",
  pm: "Middag",
  day: "Hele dag",
};
