import { useEffect, useState } from "react";
import { ADMINS, isAdmin, PEOPLE, type Person } from "shared";
import { APP_VERSION } from "../lib/version";

export function TopBar({
  me, onChangeMe, onNewRequest, openCount, onOpenReview,
}: {
  me: Person;
  onChangeMe: (p: Person) => void;
  onNewRequest: () => void;
  openCount: number;
  onOpenReview: () => void;
}) {
  const [about, setAbout] = useState(false);
  return (
    <>
      <header className="topbar">
        {isAdmin(me) ? (
          <button type="button" className="brand brandbtn" onClick={() => setAbout(true)} aria-label="Over Team S">
            <b>Team S</b><span>planning</span>
          </button>
        ) : (
          <div className="brand"><b>Team S</b><span>planning</span></div>
        )}
        <div className="spacer" />
        {isAdmin(me) && (
          <button
            type="button"
            className="bell"
            onClick={onOpenReview}
            aria-label={openCount === 1 ? "1 nieuwe aanvraag" : `${openCount} nieuwe aanvragen`}
            title="Te beoordelen"
          >
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path d="M12 3a6 6 0 0 0-6 6v3.6l-1.7 2.9A1 1 0 0 0 5.2 17h13.6a1 1 0 0 0 .9-1.5L18 12.6V9a6 6 0 0 0-6-6Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
              <path d="M9.5 19.5a2.5 2.5 0 0 0 5 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            {openCount > 0 && <span className="bellcount">{openCount > 99 ? "99+" : openCount}</span>}
          </button>
        )}
        <div className="who">
          <label htmlFor="whoami">Ik ben</label>
          <select id="whoami" value={me} onChange={(e) => onChangeMe(e.target.value as Person)}>
            {PEOPLE.map((p) => (
              <option key={p} value={p}>{p}{(ADMINS as readonly string[]).includes(p) ? " (admin)" : ""}</option>
            ))}
          </select>
        </div>
        <button className="btn primary" onClick={onNewRequest}>Nieuwe aanvraag</button>
      </header>
      {about && <AboutModal onClose={() => setAbout(false)} />}
    </>
  );
}

function AboutModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal about" role="dialog" aria-modal="true" aria-label="Over Team S">
        <h3>Team S</h3>
        <div className="note">Version {APP_VERSION}</div>
        <div className="modalactions">
          <button className="btn primary" onClick={onClose}>Sluiten</button>
        </div>
      </div>
    </div>
  );
}
