import { useState } from "react";
import { todayKey, type Person, type Replacements } from "shared";
import { Modal } from "./Modal";
import { NoticeWarning } from "./NoticeWarning";
import { ReplacementPicker } from "./ReplacementPicker";
import { api, ApiError } from "../lib/api";

export function NewRequestModal({
  me, onClose, onCreated,
}: {
  me: Person;
  onClose: () => void;
  onCreated: () => void;
}) {
  const today = todayKey();
  const [kind, setKind] = useState<"day" | "vacation">("day");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [replacements, setReplacements] = useState<Replacements>({});
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const effectiveTo = kind === "vacation" ? to : from;
  const validRange = !!from && !!effectiveTo && effectiveTo >= from;

  async function submit() {
    if (!validRange) { setError("Controleer de datums."); return; }
    setBusy(true);
    setError(null);
    try {
      await api.createAbsence({ kind, from, to: effectiveTo, note: note.trim(), replacements });
      onCreated();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Opslaan mislukte. Probeer het nog eens.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Nieuwe aanvraag"
      sub={`Aangevraagd door ${me}`}
      confirmLabel={busy ? "Bezig…" : "Indienen als concept"}
      confirmDisabled={busy || !validRange}
      onConfirm={submit}
      onClose={onClose}
    >
      {error && <div className="errorbar">{error}</div>}

      <div className="field">
        <label>Soort</label>
        <div className="radios">
          <label><input type="radio" checked={kind === "day"} onChange={() => setKind("day")} /> Vrije dag</label>
          <label><input type="radio" checked={kind === "vacation"} onChange={() => setKind("vacation")} /> Vakantieperiode</label>
        </div>
      </div>

      <div className="field" style={{ display: "flex", gap: ".7rem", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 9rem" }}>
          <label htmlFor="from">Van</label>
          <input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        {kind === "vacation" && (
          <div style={{ flex: "1 1 9rem" }}>
            <label htmlFor="to">Tot en met</label>
            <input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        )}
      </div>

      <NoticeWarning from={from} />

      <div className="field">
        <label>Wie neemt je dagdelen over?</label>
        {validRange && (
          <ReplacementPicker person={me} from={from} to={effectiveTo} value={replacements} onChange={setReplacements} />
        )}
      </div>

      <div className="field">
        <label htmlFor="note">Toelichting (optioneel)</label>
        <textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
    </Modal>
  );
}
