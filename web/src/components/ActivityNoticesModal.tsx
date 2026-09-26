import { useEffect } from "react";
import type { Activity } from "shared";
import { fmtLong } from "../lib/format";

export function ActivityNoticesModal({
  activities, isNew, onClose,
}: {
  activities: Activity[];
  isNew: (a: Activity) => boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Activiteiten op je werkdagen">
        <h3>Activiteiten op je werkdagen</h3>
        <div className="sub note">Geplande activiteiten op dagen dat je ingeroosterd staat.</div>
        {activities.length === 0 ? (
          <div className="empty">Geen activiteiten gepland op je komende werkdagen.</div>
        ) : (
          activities.map((a) => (
            <div className="activityrow" key={a.id}>
              <div className="body">
                <div className="ttl">
                  {fmtLong(a.date)} — {a.title}
                  {isNew(a) && <span className="newtag">nieuw</span>}
                </div>
                {a.note && <div className="note">{a.note}</div>}
                <div className="note">
                  Hele dag · gepland door {a.createdBy}
                  {a.updatedBy && ` · aangepast door ${a.updatedBy}`}
                </div>
              </div>
            </div>
          ))
        )}
        <div className="modalactions">
          <button className="btn primary" onClick={onClose}>Sluiten</button>
        </div>
      </div>
    </div>
  );
}
