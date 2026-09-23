import { useEffect, useState } from "react";
import { ADMINS, isAdmin, PEOPLE, type Person } from "shared";
import { APP_VERSION } from "../lib/version";

export function TopBar({
  me, onChangeMe, onNewRequest,
}: {
  me: Person;
  onChangeMe: (p: Person) => void;
  onNewRequest: () => void;
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
