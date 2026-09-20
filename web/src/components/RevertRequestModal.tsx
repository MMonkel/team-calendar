import { useState } from "react";
import type { AbsenceRequest } from "shared";
import { Modal } from "./Modal";
import { typeLabel } from "./Badges";
import { fmtRange } from "../lib/format";
import { api, ApiError } from "../lib/api";

export function RevertRequestModal({
  target, onClose, onCreated,
}: {
  target: AbsenceRequest;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api.revertRequest(target.id, { note: note.trim() });
      onCreated();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Opslaan mislukte. Probeer het nog eens.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Terugzetten naar gewone werkdag"
      sub={`${typeLabel(target)} · ${fmtRange(target.from, target.to)}`}
      confirmLabel={busy ? "Bezig…" : "Terugzetten indienen"}
      confirmDisabled={busy}
      onConfirm={submit}
      onClose={onClose}
    >
      {error && <div className="errorbar">{error}</div>}
      <p className="note">
        Je dient dit in als concept. Na goedkeuring vervalt de vrije periode en draai je die dagdelen
        weer zelf; eventuele vervangers komen te vervallen.
      </p>
      <div className="field">
        <label htmlFor="rnote">Toelichting (optioneel)</label>
        <textarea id="rnote" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
    </Modal>
  );
}
