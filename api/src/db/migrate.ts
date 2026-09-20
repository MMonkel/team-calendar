import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./pool.js";

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(here, "schema.sql"), "utf8");

async function main() {
  console.log("Schema toepassen...");
  await pool.query(sql);
  console.log("Klaar.");
  await pool.end();
}

main().catch((err) => {
  console.error("Migratie mislukt:", err);
  process.exit(1);
});
