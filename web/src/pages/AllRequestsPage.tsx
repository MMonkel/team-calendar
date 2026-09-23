import { useEffect, useState } from "react";
import type { AnyRequest } from "shared";
import { api, ApiError } from "../lib/api";
import { RequestsTable } from "../components/RequestsTable";
import { PrintButton, PrintHeader } from "../components/Print";
import { useAdminRequestActions } from "../components/AdminRequestModals";

const FILTER_LABEL: Record<Filter, string> = {
  alle: "alle statussen", draft: "concept", approved: "definitief", rejected: "afgekeurd", cancelled: "teruggezet", deleted: "verwijderd",
};

type Filter = "alle" | "draft" | "approved" | "rejected" | "cancelled" | "deleted";

export function AllRequestsPage({ refreshSignal = 0 }: { refreshSignal?: number }) {
  const [filter, setFilter] = useState<Filter>("alle");
  const [rows, setRows] = useState<AnyRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const admin = useAdminRequestActions(() => setReload((n) => n + 1));

  useEffect(() => {
    let cancelled = false;
    api.requests(filter === "alle" ? {} : { status: filter })
      .then((r) => { if (!cancelled) { setRows(r.sort((a, b) => b.from.localeCompare(a.from))); setError(null); } })
      .catch((e) => { if (!cancelled) setError(e instanceof ApiError ? e.message : "Laden mislukte."); });
    return () => { cancelled = true; };
  }, [filter, refreshSignal, reload]);

  return (
    <>
      <PrintHeader title="Alle aanvragen" sub={`Filter: ${FILTER_LABEL[filter]}`} />
      <div className="periodbar">
        <h2>Alle aanvragen</h2>
        <div className="spacer" />
        <select value={filter} onChange={(e) => setFilter(e.target.value as Filter)} style={{ width: "auto" }}>
          <option value="alle">Alle statussen</option>
          <option value="draft">Concept</option>
          <option value="approved">Definitief</option>
          <option value="rejected">Afgekeurd</option>
          <option value="cancelled">Teruggezet</option>
          <option value="deleted">Verwijderd</option>
        </select>
        <PrintButton />
      </div>
      {error && <div className="errorbar">{error}</div>}
      <div className="card">
        {rows === null ? <div className="empty">Bezig met laden…</div> : (
          <RequestsTable requests={rows} showPerson onEdit={admin.edit} onRemove={admin.remove} />
        )}
      </div>
      {admin.modals}
    </>
  );
}
