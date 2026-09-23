import type { Person } from "shared";
import { Dot } from "./Badges";
import type { DayRoster } from "../lib/api";

type Slot = DayRoster["shifts"][number]["slots"][number];

/**
 * Dagdelen om te tonen. Zonder het volledige rooster alleen de afwijkingen:
 * iemand is vrij (met of zonder vervanger) of heeft een openstaande aanvraag.
 */
export function visibleShifts(day: DayRoster, showRoster: boolean): DayRoster["shifts"] {
  if (showRoster) return day.shifts;
  return day.shifts
    .map((sh) => ({ ...sh, slots: sh.slots.filter((s) => s.state !== "normal") }))
    .filter((sh) => sh.slots.length > 0);
}

export function SlotView({ slot }: { slot: Slot }) {
  if (slot.state === "normal") {
    return (
      <div className="slot">
        <Dot person={slot.actual as Person} />
        <span className="nm">{slot.actual}</span>
      </div>
    );
  }
  if (slot.state === "pending") {
    return (
      <div className="slot pending">
        <Dot person={slot.original} />
        <span className="nm">{slot.original}</span>
        <span className="tagline t-draft">aanvraag</span>
        {slot.actual && <span className="nm note">→ {slot.actual}</span>}
      </div>
    );
  }
  // state === "away": goedgekeurd, dus vervangen (of open)
  if (!slot.actual) {
    return (
      <div className="slot replaced">
        <span className="was">{slot.original}</span>
        <span className="tagline t-empty">geen vervanger</span>
      </div>
    );
  }
  return (
    <div className="slot replaced">
      <Dot person={slot.actual} />
      <span className="nm">{slot.actual}</span>
      <span className="was">{slot.original}</span>
    </div>
  );
}
