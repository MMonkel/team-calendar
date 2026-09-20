import "dotenv/config";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  // Faalt hard en direct bij opstarten, in plaats van pas bij de eerste query.
  throw new Error(
    "DATABASE_URL ontbreekt. Lokaal: zet 'm in api/.env (zie .env.example). " +
      "Op Azure komt deze uit Key Vault via de Container App-secret.",
  );
}

// Azure Database for PostgreSQL Flexible Server vereist TLS; de standaard
// certificaatketen van Alpine/Debian-images kent de Azure-CA niet altijd,
// dus staan we hier verbindingen toe zonder de keten te verifiëren. Dit is
// alsnog een versleutelde verbinding (sslmode=require), niet onversleuteld.
export const pool = new pg.Pool({
  connectionString,
  ssl: connectionString.includes("localhost") ? false : { rejectUnauthorized: false },
  max: 10,
});

pool.on("error", (err) => {
  console.error("Onverwachte fout op een idle database-connectie", err);
});
