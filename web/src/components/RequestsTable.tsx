import type { AnyRequest } from "shared";
import { Dot, StatusPill, typeLabel } from "./Badges";
import { fmtRange, fmtShort } from "../lib/format";
import { PART_LABEL } from "shared";

export function RequestsTable({
  requests, showPerson, onWithdraw, onMove, onRevert,
}: {
  requests: AnyRequest[];
  showPerson: boolean;
  onWithdraw?: (r: AnyRequest) => void;
  onMove?: (r: AnyRequest) => void;
  onRevert?: (r: AnyRequest) => void;
}) {
  if (requests.length === 0) return <div className="empty">Niets gevonden.</div>;
  return (
    <div className="tablewrap">
      <table>
        <thead>
          <tr>
            <th>Soort</th>
            <th>Wanneer</th>
            <th>Status</th>
            <th>Vervangers</th>
            {(onWithdraw || onMove || onRevert) && <th className="actcol"></th>}
          </tr>
        </thead>
        <tbody>
          {requests.map((r) => {
            const reps = Object.entries(r.replacements ?? {}).sort();
            const canAct = r.type === "absence" && (r.status === "draft" || r.status === "approved");
            let target = null;
            if (r.type === "move") target = <div className="note">van {fmtRange(r.origFrom, r.origTo)}</div>;
            if (r.type === "revert") target = <div className="note">betreft {fmtRange(r.origFrom, r.origTo)}</div>;
            return (
              <tr key={r.id}>
                <td>
                  {typeLabel(r)}{" "}
                  {r.shortNotice && (
                    <span className="tagline t-draft" title="Minder dan 3 maanden van tevoren aangevraagd">korte termijn</span>
                  )}
                  {showPerson && <div className="note"><Dot person={r.person} /> {r.person}</div>}
                </td>
                <td className="num">{fmtRange(r.from, r.to)}{target}</td>
                <td>
                  <StatusPill status={r.status} />
                  {r.comment && <div className="note">{r.comment}</div>}
                  {r.reviewedBy && <div className="note">door {r.reviewedBy}</div>}
                </td>
                <td>
                  {reps.length === 0
                    ? <span className="note">—</span>
                    : reps.map(([sk, p]) => {
                        const [k, part] = sk.split("|");
                        return <div className="note" key={sk}>{fmtShort(k)} {PART_LABEL[part as "am" | "pm" | "day"].toLowerCase()} → {p}</div>;
                      })}
                  {r.note && <div className="note">“{r.note}”</div>}
                </td>
                {(onWithdraw || onMove || onRevert) && (
                  <td className="actcol">
                    <div className="rowactions">
                      {onWithdraw && r.status === "draft" && (
                        <button className="btn small" onClick={() => onWithdraw(r)}>Intrekken</button>
                      )}
                      {onMove && canAct && (
                        <button className="btn small" onClick={() => onMove(r)}>Verplaatsen</button>
                      )}
                      {onRevert && canAct && (
                        <button className="btn small" onClick={() => onRevert(r)}>Terugzetten</button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
