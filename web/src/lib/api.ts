import type { AnyRequest, DateKey, ExtraDayEntry, FreeDayEntry, Holiday, Person, Replacements } from "shared";

// TODO Entra ID: dit stuurt nu alleen wie de gebruiker beweert te zijn, in
// een header die de API vertrouwt zonder bewijs (zie api/src/middleware/auth.ts).
// Zodra MSAL is aangesloten, vervangt dit een 'Authorization: Bearer <token>'
// header met een echt id-token, en verdwijnt de handmatige personenkiezer.
let currentUser: Person | null = null;
export function setCurrentUser(p: Person) {
  currentUser = p;
  localStorage.setItem("teams.me", p);
}
export function getCurrentUser(): Person | null {
  return currentUser;
}

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch("/api" + path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(currentUser ? { "x-user": currentUser } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, body.error ?? "unknown", body.message ?? res.statusText);
  }
  return body as T;
}

export interface DayRoster {
  date: DateKey;
  holiday: Holiday | null;
  shifts: Array<{
    part: "am" | "pm" | "day";
    slots: Array<{ original: Person; actual: Person | null; state: "normal" | "pending" | "away"; request: AnyRequest | null }>;
  }>;
}

export const api = {
  team: () => request<{ people: Person[] }>("/team"),

  roster: (from: DateKey, to: DateKey) =>
    request<DayRoster[]>(`/roster?from=${from}&to=${to}`),

  requests: (params: { person?: string; status?: string } = {}) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return request<AnyRequest[]>(`/requests${qs ? "?" + qs : ""}`);
  },

  createAbsence: (body: { kind: "day" | "vacation"; from: DateKey; to: DateKey; note: string; replacements: Replacements }) =>
    request<AnyRequest>("/requests", { method: "POST", body: JSON.stringify(body) }),

  cancelRequest: (id: string) => request<void>(`/requests/${id}`, { method: "DELETE" }),

  moveRequest: (id: string, body: { from: DateKey; to: DateKey; note: string; replacements: Replacements }) =>
    request<AnyRequest>(`/requests/${id}/move`, { method: "POST", body: JSON.stringify(body) }),

  revertRequest: (id: string, body: { note: string }) =>
    request<AnyRequest>(`/requests/${id}/revert`, { method: "POST", body: JSON.stringify(body) }),

  decide: (id: string, body: { approve: boolean; comment?: string }) =>
    request<AnyRequest>(`/requests/${id}/decision`, { method: "POST", body: JSON.stringify(body) }),

  freeDays: (year: number, person?: string) =>
    request<FreeDayEntry[]>(`/overview/free-days?year=${year}${person ? "&person=" + person : ""}`),

  extraDays: (year: number, person?: string) =>
    request<ExtraDayEntry[]>(`/overview/extra-days?year=${year}${person ? "&person=" + person : ""}`),
};
