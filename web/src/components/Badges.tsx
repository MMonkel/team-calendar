import type { AnyRequest, Person, RequestStatus } from "shared";

const COLOR: Record<Person, string> = {
  Alexandra: "#6b4fa0", Marc: "#2f6aa8", Nicole: "#1f8a70",
  Celestine: "#a8552f", Mariska: "#9a2f6b", Robin: "#4a7a1f", Marielle: "#8a6b1f",
  Jim: "#1f7a8a",
};

export function Dot({ person }: { person: Person | string }) {
  return <span className="dot" style={{ background: COLOR[person as Person] ?? "#888" }} />;
}

const STATUS_META: Record<RequestStatus, [string, string]> = {
  draft: ["p-draft", "Concept"],
  approved: ["p-approved", "Definitief"],
  rejected: ["p-rejected", "Afgekeurd"],
  cancelled: ["p-cancelled", "Teruggezet"],
  deleted: ["p-deleted", "Verwijderd"],
};

export function StatusPill({ status }: { status: RequestStatus }) {
  const [cls, label] = STATUS_META[status];
  return <span className={"pill " + cls}>{label}</span>;
}

// Staat in shared, zodat de e-mails van de API dezelfde namen gebruiken.
export { typeLabel } from "shared";
