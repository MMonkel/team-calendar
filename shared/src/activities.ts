import type { DateKey } from "./dates.js";
import type { Person } from "./team.js";

/** Een door een admin geplande activiteit op een hele dag. Puur informatief: raakt het rooster niet. */
export interface Activity {
  id: string;
  date: DateKey;
  title: string;
  note: string;
  createdBy: Person;
  createdAt: string;
  updatedBy?: Person; // laatste admin die hem aanpaste
  updatedAt?: string;
}
