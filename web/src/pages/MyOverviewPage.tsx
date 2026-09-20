import { useEffect, useState } from "react";
import type { AbsenceRequest, AnyRequest, ExtraDayEntry, FreeDayEntry, Person } from "shared";
import { PART_LABEL } from "shared";
import { api, ApiError } from "../lib/api";
import { fmtShort } from "../lib/format";
import { Dot, StatusPill } from "../components/Badges";
import { RequestsTable } from "../components/RequestsTable";
import { MoveRequestModal } from "../components/MoveRequestModal";
import { RevertRequestModal } from "../components/RevertRequestModal";

export function MyOverviewPage({ me }: { me: Person }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [mine, setMine] = useState<AnyRequest[] | null>(null);
  const [freeDays, setFreeDays] = useState<FreeDayEntry[] | null>(null);
  const [extraDays, setExtraDays] = useState<ExtraDayEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState<AbsenceRequest | null>(null);
  const [revertTarget, setRevertTarget] = useState<AbsenceRequest | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    Promise.all([
      api.requests({ person: me }),
      api.freeDays(year),
      api.extraDays(year),
    ])
      .then(([reqs, free, extra]) => {
        if (cancelled) return;
        setMine(reqs.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "")));
        setFreeDays(free);
        setExtraDays(extra);
      })
      .catch((e) => { if (!cancelled) setError(e instanceof ApiError ? e.message : "Laden mislukte."); });
    return () => { cancelled = true; };
  }, [me, year, refreshKey]);

  function refresh() { setRefreshKey((k) => k + 1); }

  async function withdraw(r: AnyRequest) {
    if (!confirm("Deze aanvraag intrekken?")) return;
    try { await api.cancelRequest(r.id); refresh(); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Intrekken mislukte."); }
  }

  const years = [year - 2, year - 1, year, year + 1, year + 2];

  return (
    <>
      <div className="periodbar">
        <h2>Mijn overzicht</h2>
        <div className="spacer" />
        <label className="note" htmlFor="yearSel">Jaar&nbsp;</label>
        <select id="yearSel" value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ width: "auto" }}>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {error && <div className="errorbar">{error}</div>}

      <div className="card">
        <h3>Mijn aanvragen</h3>
        <div className="sub">
          Concepten kun je nog intrekken. Definitieve dagen kun je verplaatsen of terugzetten naar een
          gewone werkdag — dat gaat opnieuw langs Alexandra en Marc.
        </div>
        {mine === null ? <div className="empty">Bezig met laden…</div> : (
          <RequestsTable
            requests={mine}
            showPerson={false}
            onWithdraw={withdraw}
            onMove={(r) => { if (r.type === "absence") setMoveTarget(r); }}
            onRevert={(r) => { if (r.type === "absence") setRevertTarget(r); }}
          />
        )}
      </div>

      <div className="card">
        <h3>Vrij genomen in {year}</h3>
        {freeDays && (
          <div className="sub">
            {freeDays.filter((f) => f.status === "approved").length} definitieve dagdelen
            {freeDays.some((f) => f.status === "draft") && `, ${freeDays.filter((f) => f.status === "draft").length} nog in concept`}.
          </div>
        )}
        {freeDays === null ? <div className="empty">Bezig met laden…</div> : freeDays.length === 0 ? (
          <div className="empty">Geen vrije dagen in {year}.</div>
        ) : (
          <div className="tablewrap">
            <table>
              <thead><tr><th>Datum</th><th>Dagdeel</th><th>Soort</th><th>Vervanger</th><th>Status</th></tr></thead>
              <tbody>
                {freeDays.map((f, i) => (
                  <tr key={i}>
                    <td className="num">{fmtShort(f.date)}</td>
                    <td>{PART_LABEL[f.part]}</td>
                    <td>{f.kind === "vacation" ? "Vakantie" : "Vrije dag"}</td>
                    <td>{f.replacement ? <><Dot person={f.replacement} /> {f.replacement}</> : <span className="tagline t-empty">geen</span>}</td>
                    <td><StatusPill status={f.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h3>Extra gewerkt in {year}</h3>
        <div className="sub">Dagdelen die niet in je eigen rooster staan, maar die je als vervanger draait.</div>
        {extraDays === null ? <div className="empty">Bezig met laden…</div> : extraDays.length === 0 ? (
          <div className="empty">Nog geen vervangingen in {year}.</div>
        ) : (
          <div className="tablewrap">
            <table>
              <thead><tr><th>Datum</th><th>Dagdeel</th><th>Voor</th><th>Status</th></tr></thead>
              <tbody>
                {extraDays.map((f, i) => (
                  <tr key={i}>
                    <td className="num">{fmtShort(f.date)}</td>
                    <td>{PART_LABEL[f.part]}</td>
                    <td><Dot person={f.forPerson} /> {f.forPerson}</td>
                    <td><StatusPill status={f.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {moveTarget && (
        <MoveRequestModal
          target={moveTarget}
          onClose={() => setMoveTarget(null)}
          onCreated={() => { setMoveTarget(null); refresh(); }}
        />
      )}
      {revertTarget && (
        <RevertRequestModal
          target={revertTarget}
          onClose={() => setRevertTarget(null)}
          onCreated={() => { setRevertTarget(null); refresh(); }}
        />
      )}
    </>
  );
}
