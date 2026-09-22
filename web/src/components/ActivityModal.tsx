import { useState } from "react";
import type { DateKey } from "shared";
import { Modal } from "./Modal";
import { fmtLong } from "../lib/format";
import { api, ApiError } from "../lib/api";

export function ActivityModal({
  date, onClose, onCreated,
}: {
  date: DateKey;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!title.trim()) { setError("Geef de activiteit een naam."); return; }
    setBusy(true);
    setError(null);
    try {
      await api.createActivity({ date, title: title.trim(), note: note.trim() });
      onCreated();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Opslaan mislukte. Probeer het nog eens.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Activiteit plannen"
      sub={`${fmtLong(date)} — hele dag. Iedereen ziet dit in de kalender; het rooster verandert niet.`}
      confirmLabel={busy ? "Bezig…" : "Plannen"}
      confirmDisabled={busy}
      onConfirm={submit}
      onClose={onClose}
    >
      {error && <div className="errorbar">{error}</div>}
      <div className="field">
        <label htmlFor="act-title">Naam</label>
        <input
          id="act-title"
          type="text"
          value={title}
          maxLength={120}
          autoFocus
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Bijvoorbeeld: teamuitje, training, audit"
        />
      </div>
      <div className="field">
        <label htmlFor="act-note">Toelichting (optioneel)</label>
        <textarea
          id="act-note"
          value={note}
          maxLength={2000}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Waar moet het team rekening mee houden?"
        />
      </div>
    </Modal>
  );
}
