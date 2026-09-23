import type { Activity, DateKey } from "shared";
import { pool } from "./pool.js";

interface Row {
  id: string;
  date: string;
  title: string;
  note: string;
  created_by: string;
  created_at: string;
  updated_by: string | null;
  updated_at: string | null;
}

// Zie requestsRepo: date-kolommen expliciet als 'YYYY-MM-DD' tekst lezen.
const SELECT_COLUMNS = `id, to_char(date, 'YYYY-MM-DD') as date, title, note, created_by, created_at, updated_by, updated_at`;

function toDomain(row: Row): Activity {
  return {
    id: row.id,
    date: row.date as DateKey,
    title: row.title,
    note: row.note ?? "",
    createdBy: row.created_by as Activity["createdBy"],
    createdAt: row.created_at,
    ...(row.updated_by ? { updatedBy: row.updated_by as Activity["updatedBy"] } : {}),
    ...(row.updated_at ? { updatedAt: row.updated_at } : {}),
  };
}

export async function listActivities(from: DateKey, to: DateKey): Promise<Activity[]> {
  const { rows } = await pool.query<Row>(
    `select ${SELECT_COLUMNS} from activities where date between $1 and $2 order by date, created_at`,
    [from, to],
  );
  return rows.map(toDomain);
}

export async function insertActivity(a: Activity): Promise<void> {
  await pool.query(
    `insert into activities (id, date, title, note, created_by, created_at) values ($1,$2,$3,$4,$5,$6)`,
    [a.id, a.date, a.title, a.note, a.createdBy, a.createdAt],
  );
}

/** Past datum, naam en toelichting aan. Geeft null terug als de activiteit niet (meer) bestaat. */
export async function updateActivity(
  id: string,
  fields: Pick<Activity, "date" | "title" | "note">,
  by: Activity["createdBy"],
): Promise<Activity | null> {
  const { rows } = await pool.query<Row>(
    `update activities set date = $2, title = $3, note = $4, updated_by = $5, updated_at = now()
     where id = $1 returning ${SELECT_COLUMNS}`,
    [id, fields.date, fields.title, fields.note, by],
  );
  return rows[0] ? toDomain(rows[0]) : null;
}

/** Geeft true terug als er een rij is verwijderd. */
export async function deleteActivity(id: string): Promise<boolean> {
  const { rowCount } = await pool.query(`delete from activities where id = $1`, [id]);
  return (rowCount ?? 0) > 0;
}
