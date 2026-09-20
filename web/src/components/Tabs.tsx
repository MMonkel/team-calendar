import type { ReactNode } from "react";

export type TabId = "kalender" | "mijn" | "beoordelen" | "alle";

export function Tabs({
  tab, onChange, admin, openCount,
}: {
  tab: TabId;
  onChange: (t: TabId) => void;
  admin: boolean;
  openCount: number;
}) {
  const items: Array<[TabId, React.ReactNode]> = [
    ["kalender", "Kalender"],
    ["mijn", "Mijn overzicht"],
  ];
  if (admin) {
    items.push(["beoordelen", <>Te beoordelen{openCount > 0 && <span className="badge">{openCount}</span>}</>]);
    items.push(["alle", "Alle aanvragen"]);
  }
  return (
    <nav className="tabs">
      {items.map(([id, label]) => (
        <button key={id} data-active={tab === id} onClick={() => onChange(id)}>{label}</button>
      ))}
    </nav>
  );
}
