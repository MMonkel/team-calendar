import { ownShiftsInRange, PART_LABEL, PEOPLE, shiftKey, type DateKey, type Person, type Replacements } from "shared";
import { fmtShort } from "../lib/format";

export function ReplacementPicker({
  person, from, to, value, onChange,
}: {
  person: Person;
  from: DateKey;
  to: DateKey;
  value: Replacements;
  onChange: (next: Replacements) => void;
}) {
  const shifts = ownShiftsInRange(person, from, to);
  if (shifts.length === 0) {
    return <p className="note">In deze periode staan geen dagdelen van {person} in het rooster.</p>;
  }
  return (
    <>
      {shifts.map((s) => {
        const sk = shiftKey(s.date, s.part);
        return (
          <div className="repl" key={sk}>
            <div className="when">{fmtShort(s.date)} · {PART_LABEL[s.part].toLowerCase()}</div>
            <select
              value={value[sk] ?? ""}
              onChange={(e) => {
                const next = { ...value };
                if (e.target.value) next[sk] = e.target.value as Person;
                else delete next[sk];
                onChange(next);
              }}
            >
              <option value="">— nog geen vervanger —</option>
              {PEOPLE.filter((p) => p !== person).map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        );
      })}
    </>
  );
}
