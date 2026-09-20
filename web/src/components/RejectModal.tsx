import { useState } from "react";
import type { AnyRequest } from "shared";
import { Modal } from "./Modal";
import { typeLabel } from "./Badges";
import { fmtRange } from "../lib/format";
import { api, ApiError } from "../lib/api";

export function RejectModal({
  request, onClose, onDecided,
}: {
  request: AnyRequest;
  onClose: () => void;
  onDecided: () => void;
}) {
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api.decide(request.id, { approve: false, comment: comment.trim() });
      onDecided();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Afkeuren mislukte. Probeer het nog eens.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Aanvraag afkeuren"
      sub={`${request.person} — ${typeLabel(request)}, ${fmtRange(request.from, request.to)}`}
      confirmLabel={busy ? "Bezig…" : "Afkeuren"}
      confirmDisabled={busy}
      onConfirm={submit}
      onClose={onClose}
    >
      {error && <div className="errorbar">{error}</div>}
      <div className="field">
        <label htmlFor="cmt">Reden (wordt bij de aanvraag getoond)</label>
        <textarea
          id="cmt"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Bijvoorbeeld: te weinig bezetting op die vrijdag."
        />
      </div>
    </Modal>
  );
}
