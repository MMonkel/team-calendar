import { useEffect, useState } from "react";
import { ADMINS, isAdmin, isPerson, type Person } from "shared";
import { setCurrentUser } from "./api";

export function useSession() {
  const [me, setMe] = useState<Person>(() => {
    const stored = localStorage.getItem("teams.me");
    const initial = stored && isPerson(stored) ? stored : ADMINS[0];
    // Direct zetten, niet pas in de effect hieronder: effects van kinderen
    // (zoals de eerste roster-fetch van CalendarPage) draaien vóór die van de
    // ouder, en zouden anders zonder 'x-user' header gaan.
    setCurrentUser(initial);
    return initial;
  });

  useEffect(() => {
    setCurrentUser(me);
  }, [me]);

  return { me, setMe, admin: isAdmin(me) };
}
