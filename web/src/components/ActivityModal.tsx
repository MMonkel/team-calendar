import { useState } from "react";
import { type Activity, type DateKey, isValidKey } from "shared";
import { Modal } from "./Modal";
import { fmtLong } from "../lib/format";
import { api, ApiError } from "../lib/api";

/** Nieuwe activiteit plannen op `date`, of met `activity` een bestaande aanpassen. */
export function ActivityModal({
  date, activity, onClose, onCreated,
}: {
  date: DateKey;
  activity?: Activity;
  onClose: () => void;
  onCreated: () => void;
}) {
  const editing = !!activity;
  const [day, setDay] = useState<DateKey>(activity?.date ?? date);
  const [title, setTitle] = useState(activity?.title ?? "");
  const [note, setNote] = useState(activity?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!title.trim()) { setError("Geef de activiteit een naam."); return; }
    if (!isValidKey(day)) { setError("Kies een datum."); return; }
    setBusy(true);
    setError(null);
    try {
      const body = { date: day, title: title.trim(), note: note.trim() };
      if (activity) await api.updateActivity(activity.id, body);
      else await api.createActivity(body);
      onCreated();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Opslaan mislukte. Probeer het nog eens.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={editing ? "Activiteit aanpassen" : "Activiteit plannen"}
      sub={editing
        ? "Hele dag. Iedereen ziet de wijziging direct in de kalender."
        : `${fmtLong(date)} — hele dag. Iedereen ziet dit in de kalender; het rooster verandert niet.`}
      confirmLabel={busy ? "Bezig…" : editing ? "Opslaan" : "Plannen"}
      confirmDisabled={busy}
      onConfirm={submit}
      onClose={onClose}
    >
      {error && <div className="errorbar">{error}</div>}
      {editing && (
        <div className="field">
          <label htmlFor="act-date">Datum</label>
          <input id="act-date" type="date" value={day} onChange={(e) => setDay(e.target.value)} />
        </div>
      )}
      <div className="field">
        <label htmlFor="act-title">Naam</label>
        <input
          id="act-title"
          type="text"
          value={title}
          maxLength={120}
          autoFocus={!editing}
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
