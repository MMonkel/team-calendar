import { useEffect, type ReactNode } from "react";

export function Modal({
  title, sub, children, confirmLabel, onConfirm, onClose, confirmDisabled,
}: {
  title: string;
  sub?: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  confirmDisabled?: boolean;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <h3>{title}</h3>
        {sub && <div className="sub note">{sub}</div>}
        <div>{children}</div>
        <div className="modalactions">
          <button className="btn" onClick={onClose}>Annuleren</button>
          <button className="btn primary" onClick={onConfirm} disabled={confirmDisabled}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
