import type { AbsenceKind, AnyRequest, DateKey, Replacements, RequestChange, RequestStatus } from "shared";
import { pool } from "./pool.js";

interface Row {
  id: string;
  type: "absence" | "move" | "revert";
  kind: "day" | "vacation" | null;
  person: string;
  target_id: string | null;
  orig_from: string | null;
  orig_to: string | null;
  from_date: string;
  to_date: string;
  replacements: Replacements;
  note: string;
  status: RequestStatus;
  short_notice: boolean;
  created_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  comment: string | null;
  change_count: number;
}

// node-postgres geeft 'date'-kolommen terug als JS Date; we willen overal
// platte 'YYYY-MM-DD' strings, dus lezen we date-kolommen expliciet als text.
const SELECT_COLUMNS = `
  id, type, kind, person, target_id,
  to_char(orig_from, 'YYYY-MM-DD') as orig_from,
  to_char(orig_to, 'YYYY-MM-DD') as orig_to,
  to_char(from_date, 'YYYY-MM-DD') as from_date,
  to_char(to_date, 'YYYY-MM-DD') as to_date,
  replacements, note, status, short_notice,
  created_at, reviewed_by, reviewed_at, comment,
  (select count(*)::int from request_changes c where c.request_id = requests.id) as change_count
`;

function toDomain(row: Row): AnyRequest {
  const base = {
    id: row.id,
    person: row.person as AnyRequest["person"],
    from: row.from_date as DateKey,
    to: row.to_date as DateKey,
    replacements: row.replacements ?? {},
    note: row.note ?? "",
    status: row.status,
    shortNotice: row.short_notice,
    createdAt: row.created_at,
    ...(row.reviewed_by ? { reviewedBy: row.reviewed_by as AnyRequest["person"] } : {}),
    ...(row.reviewed_at ? { reviewedAt: row.reviewed_at } : {}),
    ...(row.comment != null ? { comment: row.comment } : {}),
    ...(row.change_count > 0 ? { changeCount: row.change_count } : {}),
  };

  if (row.type === "absence") {
    return { ...base, type: "absence", kind: row.kind ?? "day" } as AnyRequest;
  }
  return {
    ...base,
    type: row.type,
    targetId: row.target_id as string,
    origFrom: row.orig_from as DateKey,
    origTo: row.orig_to as DateKey,
  } as AnyRequest;
}

export async function listRequests(filter?: { person?: string; status?: string }): Promise<AnyRequest[]> {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filter?.person) { params.push(filter.person); clauses.push(`person = $${params.length}`); }
  if (filter?.status) { params.push(filter.status); clauses.push(`status = $${params.length}`); }
  const where = clauses.length ? `where ${clauses.join(" and ")}` : "";
  const { rows } = await pool.query<Row>(
    `select ${SELECT_COLUMNS} from requests ${where} order by from_date desc`,
    params,
  );
  return rows.map(toDomain);
}

export async function getRequest(id: string): Promise<AnyRequest | null> {
  const { rows } = await pool.query<Row>(`select ${SELECT_COLUMNS} from requests where id = $1`, [id]);
  return rows[0] ? toDomain(rows[0]) : null;
}

export async function insertRequest(r: AnyRequest): Promise<void> {
  const isAbsence = r.type === "absence";
  await pool.query(
    `insert into requests
       (id, type, kind, person, target_id, orig_from, orig_to, from_date, to_date,
        replacements, note, status, short_notice, created_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [
      r.id,
      r.type,
      isAbsence ? r.kind : null,
      r.person,
      isAbsence ? null : r.targetId,
      isAbsence ? null : r.origFrom,
      isAbsence ? null : r.origTo,
      r.from,
      r.to,
      JSON.stringify(r.replacements),
      r.note,
      r.status,
      r.shortNotice,
      r.createdAt,
    ],
  );
}

/** Gebruikt voor de kaskade-effecten van een goedkeuring: from/to en/of status van een bestaande rij aanpassen. */
export async function updateRequestFields(
  id: string,
  fields: Partial<{
    kind: AbsenceKind; from: DateKey; to: DateKey; replacements: Replacements; note: string;
    status: AnyRequest["status"]; reviewedBy: string; reviewedAt: string; comment: string;
  }>,
): Promise<void> {
  const set: string[] = [];
  const params: unknown[] = [];
  const push = (col: string, val: unknown) => { params.push(val); set.push(`${col} = $${params.length}`); };

  if (fields.kind !== undefined) push("kind", fields.kind);
  if (fields.from !== undefined) push("from_date", fields.from);
  if (fields.to !== undefined) push("to_date", fields.to);
  if (fields.replacements !== undefined) push("replacements", JSON.stringify(fields.replacements));
  if (fields.note !== undefined) push("note", fields.note);
  if (fields.status !== undefined) push("status", fields.status);
  if (fields.reviewedBy !== undefined) push("reviewed_by", fields.reviewedBy);
  if (fields.reviewedAt !== undefined) push("reviewed_at", fields.reviewedAt);
  if (fields.comment !== undefined) push("comment", fields.comment);
  if (set.length === 0) return;

  params.push(id);
  await pool.query(`update requests set ${set.join(", ")} where id = $${params.length}`, params);
}

export async function deleteRequest(id: string): Promise<void> {
  await pool.query(`delete from requests where id = $1`, [id]);
}

interface ChangeRow {
  id: string;
  request_id: string;
  action: RequestChange["action"];
  changed_by: string;
  changed_at: string;
  reason: string;
  before: RequestChange["before"];
  after: RequestChange["after"];
}

export async function insertChange(c: RequestChange): Promise<void> {
  await pool.query(
    `insert into request_changes (id, request_id, action, changed_by, changed_at, reason, before, after)
     values ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [c.id, c.requestId, c.action, c.by, c.at, c.reason, JSON.stringify(c.before), c.after ? JSON.stringify(c.after) : null],
  );
}

/** Geschiedenis van één aanvraag, oudste eerst. */
export async function listChanges(requestId: string): Promise<RequestChange[]> {
  const { rows } = await pool.query<ChangeRow>(
    `select id, request_id, action, changed_by, changed_at, reason, before, after
     from request_changes where request_id = $1 order by changed_at`,
    [requestId],
  );
  return rows.map((r) => ({
    id: r.id,
    requestId: r.request_id,
    action: r.action,
    by: r.changed_by as RequestChange["by"],
    at: r.changed_at,
    reason: r.reason,
    before: r.before,
    after: r.after,
  }));
}
