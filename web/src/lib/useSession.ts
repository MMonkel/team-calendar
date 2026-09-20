import { useEffect, useState } from "react";
import { ADMINS, isAdmin, isPerson, type Person } from "shared";
import { setCurrentUser } from "./api";

export function useSession() {
  const [me, setMe] = useState<Person>(() => {
    const stored = localStorage.getItem("teams.me");
    return stored && isPerson(stored) ? stored : ADMINS[0];
  });

  useEffect(() => {
    setCurrentUser(me);
  }, [me]);

  return { me, setMe, admin: isAdmin(me) };
}
