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

type SlotRequest = NonNullable<Slot["request"]>;

/** Een afwijking (vrij, gewisseld, aanvraag) is aan te tikken voor de details. */
export function SlotView({ slot, onOpen }: { slot: Slot; onOpen?: (r: SlotRequest) => void }) {
  const [cls, content] = slotContent(slot);
  if (slot.state !== "normal" && slot.request && onOpen) {
    const r = slot.request;
    return (
      <button type="button" className={cls + " tappable"} onClick={() => onOpen(r)}>{content}</button>
    );
  }
  return <div className={cls}>{content}</div>;
}

function slotContent(slot: Slot): [string, JSX.Element] {
  if (slot.state === "normal") {
    return ["slot", <>
      <Dot person={slot.actual as Person} />
      <span className="nm">{slot.actual}</span>
    </>];
  }
  if (slot.state === "pending") {
    return ["slot pending", <>
      <Dot person={slot.original} />
      <span className="nm">{slot.original}</span>
      <span className="tagline t-draft">aanvraag</span>
      {slot.actual && <span className="nm note">→ {slot.actual}</span>}
    </>];
  }
  // state === "away": goedgekeurd, dus vervangen (of open)
  if (!slot.actual) {
    return ["slot replaced", <>
      <span className="was">{slot.original}</span>
      <span className="tagline t-empty">geen vervanger</span>
    </>];
  }
  // Zelfde volgorde als zonder vervanger: eerst wie er niet is, dan wie het overneemt.
  return ["slot replaced", <>
    <span className="was">{slot.original}</span>
    <Dot person={slot.actual} />
    <span className="nm">{slot.actual}</span>
  </>];
}
