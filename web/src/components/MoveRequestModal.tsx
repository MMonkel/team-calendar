import { useState } from "react";
import { daysBetweenKeys, type AbsenceRequest, type Replacements } from "shared";
import { Modal } from "./Modal";
import { NoticeWarning } from "./NoticeWarning";
import { ReplacementPicker } from "./ReplacementPicker";
import { fmtRange } from "../lib/format";
import { api, ApiError } from "../lib/api";

export function MoveRequestModal({
  target, onClose, onCreated,
}: {
  target: AbsenceRequest;
  onClose: () => void;
  onCreated: () => void;
}) {
  const span = daysBetweenKeys(target.from, target.to);
  const [from, setFrom] = useState(target.from);
  const [to, setTo] = useState(target.to);
  const [replacements, setReplacements] = useState<Replacements>({});
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const validRange = !!from && !!to && to >= from;

  function onFromChange(v: string) {
    setFrom(v);
    // Nieuwe einddatum meeschuiven zodat de periode even lang blijft, tenzij de gebruiker 'm net zelf aanpaste.
    const [y, m, d] = v.split("-").map(Number);
    const nd = new Date(y, m - 1, d);
    nd.setDate(nd.getDate() + span);
    setTo(nd.toISOString().slice(0, 10));
  }

  async function submit() {
    if (!validRange) { setError("Controleer de datums."); return; }
    setBusy(true);
    setError(null);
    try {
      await api.moveRequest(target.id, { from, to, note: note.trim(), replacements });
      onCreated();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Opslaan mislukte. Probeer het nog eens.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Vrije periode verplaatsen"
      sub={`Nu: ${fmtRange(target.from, target.to)}`}
      confirmLabel={busy ? "Bezig…" : "Verplaatsing indienen"}
      confirmDisabled={busy || !validRange}
      onConfirm={submit}
      onClose={onClose}
    >
      {error && <div className="errorbar">{error}</div>}
      <p className="note">
        Je dient een verplaatsing in als concept. Na goedkeuring door Alexandra of Marc schuift de
        oorspronkelijke aanvraag mee.
      </p>

      <div className="field" style={{ display: "flex", gap: ".7rem", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 9rem" }}>
          <label htmlFor="mfrom">Nieuwe startdatum</label>
          <input id="mfrom" type="date" value={from} onChange={(e) => onFromChange(e.target.value)} />
        </div>
        <div style={{ flex: "1 1 9rem" }}>
          <label htmlFor="mto">Nieuwe einddatum</label>
          <input id="mto" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      <NoticeWarning from={from} />

      <div className="field">
        <label>Vervangers voor de nieuwe dagen</label>
        {validRange && (
          <ReplacementPicker person={target.person} from={from} to={to} value={replacements} onChange={setReplacements} />
        )}
      </div>

      <div className="field">
        <label htmlFor="mnote">Toelichting (optioneel)</label>
        <textarea id="mnote" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
    </Modal>
  );
}
