import { useEffect, useState } from "react";
import { ADMINS, isAdmin, isPerson, type Person } from "shared";
import { api, ApiError, reloginOnce, setCurrentUser } from "./api";

export type Session =
  | { status: "loading" }
  | { status: "ready"; me: Person; admin: boolean; devMode: boolean; setMe: (p: Person) => void }
  | { status: "not_in_team"; message: string }
  | { status: "error"; message: string };

/**
 * Wie er is ingelogd. In Azure komt dat van Entra ID via /api/me; lokaal
 * (devMode) kies je het zelf met de personenkiezer en onthoudt de browser het.
 * De app rendert pas iets zodra dit 'ready' is, zodat geen enkele fetch
 * zonder bekende gebruiker vertrekt.
 */
export function useSession(): Session {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "ready"; me: Person; devMode: boolean }
    | { status: "not_in_team"; message: string }
    | { status: "error"; message: string }
  >({ status: "loading" });

  useEffect(() => {
    api.me()
      .then(({ person, devMode }) => {
        if (devMode) {
          const stored = localStorage.getItem("teams.me");
          const me = stored && isPerson(stored) ? stored : ADMINS[0];
          setCurrentUser(me);
          setState({ status: "ready", me, devMode });
        } else if (person) {
          setState({ status: "ready", me: person, devMode });
        } else {
          setState({ status: "error", message: "Onbekende gebruiker." });
        }
      })
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.code === "not_in_team") {
          setState({ status: "not_in_team", message: e.message });
        } else if (e instanceof ApiError && e.status === 401) {
          reloginOnce();
          setState({ status: "error", message: "Je bent niet ingelogd." });
        } else {
          setState({ status: "error", message: "Kon niet ophalen wie je bent. Probeer het later opnieuw." });
        }
      });
  }, []);

  if (state.status !== "ready") return state;
  return {
    ...state,
    admin: isAdmin(state.me),
    setMe: (p: Person) => {
      setCurrentUser(p);
      setState({ ...state, me: p });
    },
  };
}
