import { ADMINS, PEOPLE, type Person } from "shared";

export function TopBar({
  me, onChangeMe, onNewRequest,
}: {
  me: Person;
  onChangeMe: (p: Person) => void;
  onNewRequest: () => void;
}) {
  return (
    <header className="topbar">
      <div className="brand"><b>Team S</b><span>planning</span></div>
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
  );
}
