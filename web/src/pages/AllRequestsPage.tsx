import { useEffect, useState } from "react";
import type { AnyRequest } from "shared";
import { api, ApiError } from "../lib/api";
import { RequestsTable } from "../components/RequestsTable";

type Filter = "alle" | "draft" | "approved" | "rejected" | "cancelled";

export function AllRequestsPage() {
  const [filter, setFilter] = useState<Filter>("alle");
  const [rows, setRows] = useState<AnyRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.requests(filter === "alle" ? {} : { status: filter })
      .then((r) => { if (!cancelled) { setRows(r.sort((a, b) => b.from.localeCompare(a.from))); setError(null); } })
      .catch((e) => { if (!cancelled) setError(e instanceof ApiError ? e.message : "Laden mislukte."); });
    return () => { cancelled = true; };
  }, [filter]);

  return (
    <>
      <div className="periodbar">
        <h2>Alle aanvragen</h2>
        <div className="spacer" />
        <select value={filter} onChange={(e) => setFilter(e.target.value as Filter)} style={{ width: "auto" }}>
          <option value="alle">Alle statussen</option>
          <option value="draft">Concept</option>
          <option value="approved">Definitief</option>
          <option value="rejected">Afgekeurd</option>
          <option value="cancelled">Teruggezet</option>
        </select>
      </div>
      {error && <div className="errorbar">{error}</div>}
      <div className="card">
        {rows === null ? <div className="empty">Bezig met laden…</div> : (
          <RequestsTable requests={rows} showPerson />
        )}
      </div>
    </>
  );
}
