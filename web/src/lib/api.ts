import type {
  AbsenceKind, Activity, AnyRequest, DateKey, ExtraDayEntry, FreeDayEntry, Holiday, Person, Replacements, RequestChange,
} from "shared";

// In Azure logt Container Apps-auth de gebruiker in via Entra ID en weet de
// API zelf wie er is. Alleen lokaal (devMode) kies je met de personenkiezer
// wie je bent; dat gaat mee in de 'x-user'-header, die de API in Azure negeert.
let currentUser: Person | null = null;
export function setCurrentUser(p: Person) {
  currentUser = p;
  localStorage.setItem("teams.me", p);
}
export function getCurrentUser(): Person | null {
  return currentUser;
}

// Sessie verlopen: herladen laat Container Apps-auth opnieuw inloggen. Hooguit
// eens per halve minuut, zodat een structureel probleem geen herlaadlus wordt.
export function reloginOnce() {
  try {
    const last = Number(sessionStorage.getItem("teams.relogin") ?? 0);
    if (Date.now() - last < 30_000) return;
    sessionStorage.setItem("teams.relogin", String(Date.now()));
  } catch {
    // Geen sessionStorage: gewoon herladen.
  }
  window.location.reload();
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
      // Hiermee geeft Container Apps-auth bij een verlopen sessie een kale
      // 403 terug in plaats van een redirect naar de loginpagina.
      "X-Requested-With": "XMLHttpRequest",
      ...(currentUser ? { "x-user": currentUser } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  // Een 401, of een 403 zonder foutcode (die komt van Container Apps-auth, niet
  // van onze API): de sessie is verlopen en de gebruiker moet opnieuw inloggen.
  if (res.status === 401 || (res.status === 403 && !body.error)) {
    if (!path.startsWith("/me")) reloginOnce();
    throw new ApiError(res.status, "login_required", "Je bent niet (meer) ingelogd.");
  }
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
  activities: Activity[];
}

export const api = {
  team: () => request<{ people: Person[] }>("/team"),
  me: () => request<{ person: Person | null; devMode: boolean }>("/me"),

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

  // Alleen admins: direct aanpassen/verplaatsen of verwijderen, met geschiedenis.
  updateRequest: (id: string, body: { kind: AbsenceKind; from: DateKey; to: DateKey; note: string; replacements: Replacements; reason: string }) =>
    request<AnyRequest>(`/requests/${id}`, { method: "PUT", body: JSON.stringify(body) }),

  removeRequest: (id: string, body: { reason: string }) =>
    request<AnyRequest>(`/requests/${id}/remove`, { method: "POST", body: JSON.stringify(body) }),

  requestChanges: (id: string) => request<RequestChange[]>(`/requests/${id}/changes`),

  decide: (id: string, body: { approve: boolean; comment?: string }) =>
    request<AnyRequest>(`/requests/${id}/decision`, { method: "POST", body: JSON.stringify(body) }),

  createActivity: (body: { date: DateKey; title: string; note: string }) =>
    request<Activity>("/activities", { method: "POST", body: JSON.stringify(body) }),

  updateActivity: (id: string, body: { date: DateKey; title: string; note: string }) =>
    request<Activity>(`/activities/${id}`, { method: "PUT", body: JSON.stringify(body) }),

  deleteActivity: (id: string) => request<void>(`/activities/${id}`, { method: "DELETE" }),

  freeDays: (year: number, person?: string) =>
    request<FreeDayEntry[]>(`/overview/free-days?year=${year}${person ? "&person=" + person : ""}`),

  extraDays: (year: number, person?: string) =>
    request<ExtraDayEntry[]>(`/overview/extra-days?year=${year}${person ? "&person=" + person : ""}`),
};
