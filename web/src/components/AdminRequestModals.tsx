import { useState } from "react";
import type { AbsenceKind, AbsenceRequest, Replacements } from "shared";
import { Modal } from "./Modal";
import { ReplacementPicker } from "./ReplacementPicker";
import { fmtRange } from "../lib/format";
import { api, ApiError } from "../lib/api";

/**
 * Alleen voor admins: een vrije dag of vakantie direct aanpassen of
 * verplaatsen. Gaat niet opnieuw langs de beoordeling; de oude versie blijft
 * in de geschiedenis van de aanvraag staan.
 */
export function EditRequestModal({
  target, onClose, onSaved,
}: {
  target: AbsenceRequest;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [kind, setKind] = useState<AbsenceKind>(target.kind);
  const [from, setFrom] = useState(target.from);
  const [to, setTo] = useState(target.to);
  const [replacements, setReplacements] = useState<Replacements>(target.replacements);
  const [note, setNote] = useState(target.note);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const effectiveTo = kind === "vacation" ? to : from;
  const validRange = !!from && !!effectiveTo && effectiveTo >= from;

  async function submit() {
    if (!validRange) { setError("Controleer de datums."); return; }
    setBusy(true);
    setError(null);
    try {
      await api.updateRequest(target.id, {
        kind, from, to: effectiveTo, replacements, note: note.trim(), reason: reason.trim(),
      });
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Opslaan mislukte. Probeer het nog eens.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Aanvraag van ${target.person} aanpassen`}
      sub={`Nu: ${fmtRange(target.from, target.to)}. De wijziging gaat direct in; de oorspronkelijke aanvraag blijft terug te zien.`}
      confirmLabel={busy ? "Bezig…" : "Opslaan"}
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
          <label htmlFor="efrom">Van</label>
          <input id="efrom" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        {kind === "vacation" && (
          <div style={{ flex: "1 1 9rem" }}>
            <label htmlFor="eto">Tot en met</label>
            <input id="eto" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        )}
      </div>

      <div className="field">
        <label>Vervangers</label>
        {validRange && (
          <ReplacementPicker person={target.person} from={from} to={effectiveTo} value={replacements} onChange={setReplacements} />
        )}
      </div>

      <div className="field">
        <label htmlFor="enote">Toelichting van {target.person}</label>
        <textarea id="enote" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>

      <div className="field">
        <label htmlFor="ereason">Reden van de wijziging (optioneel)</label>
        <textarea id="ereason" value={reason} onChange={(e) => setReason(e.target.value)}
          placeholder="Komt in de geschiedenis van de aanvraag" />
      </div>
    </Modal>
  );
}

/** Alleen voor admins: aanvraag laten vervallen. Blijft zichtbaar als "Verwijderd". */
export function RemoveRequestModal({
  target, onClose, onRemoved,
}: {
  target: AbsenceRequest;
  onClose: () => void;
  onRemoved: () => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api.removeRequest(target.id, { reason: reason.trim() });
      onRemoved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Verwijderen mislukte. Probeer het nog eens.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Aanvraag van ${target.person} verwijderen`}
      sub={`${fmtRange(target.from, target.to)}. De dagdelen worden weer gewone werkdagen. De aanvraag blijft als "Verwijderd" in het overzicht staan.`}
      confirmLabel={busy ? "Bezig…" : "Verwijderen"}
      confirmDisabled={busy}
      onConfirm={submit}
      onClose={onClose}
    >
      {error && <div className="errorbar">{error}</div>}
      <div className="field">
        <label htmlFor="rreason">Reden (optioneel)</label>
        <textarea id="rreason" value={reason} onChange={(e) => setReason(e.target.value)}
          placeholder="Komt in de geschiedenis van de aanvraag" />
      </div>
    </Modal>
  );
}

/**
 * Admin-acties op een aanvraag, gedeeld door de kalender en de overzichten:
 * `edit(r)` en `remove(r)` openen het juiste venster, `modals` rendert het.
 */
export function useAdminRequestActions(onChanged: () => void) {
  const [editing, setEditing] = useState<AbsenceRequest | null>(null);
  const [removing, setRemoving] = useState<AbsenceRequest | null>(null);
  const modals = (
    <>
      {editing && (
        <EditRequestModal target={editing} onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); onChanged(); }} />
      )}
      {removing && (
        <RemoveRequestModal target={removing} onClose={() => setRemoving(null)}
          onRemoved={() => { setRemoving(null); onChanged(); }} />
      )}
    </>
  );
  return { edit: setEditing, remove: setRemoving, modals };
}

/** Kan een admin deze aanvraag nog aanpassen of verwijderen? */
export function adminCanChange(r: { type: string; status: string }): boolean {
  return r.type === "absence" && (r.status === "draft" || r.status === "approved");
}
