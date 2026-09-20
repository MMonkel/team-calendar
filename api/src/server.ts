import express from "express";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PEOPLE } from "shared";
import { resolveUser } from "./middleware/auth.js";
import { requestsRouter } from "./routes/requests.js";
import { rosterRouter } from "./routes/roster.js";
import { overviewRouter } from "./routes/overview.js";

const here = dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT ?? 8080);

app.use(express.json());

// Probe die Azure Container Apps gebruikt om te zien of de revisie gezond is.
// Bewust vóór de auth-middleware: deze mag nooit afhangen van inloggen.
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

app.get("/api/info", (_req, res) => {
  res.json({
    environment: process.env.APP_ENV ?? "local",
    revision: process.env.CONTAINER_APP_REVISION ?? "local",
    time: new Date().toISOString(),
  });
});

// Team-samenstelling, zodat de frontend niet los in sync hoeft te blijven.
app.get("/api/team", (_req, res) => {
  res.json({ people: PEOPLE });
});

app.use("/api/requests", resolveUser, requestsRouter);
app.use("/api/roster", resolveUser, rosterRouter);
app.use("/api/overview", resolveUser, overviewRouter);

// In de container staat de gebouwde frontend naast de gecompileerde API.
const staticDir = join(here, "..", "public");
if (existsSync(staticDir)) {
  app.use(express.static(staticDir));
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(join(staticDir, "index.html"));
  });
}

// Centrale foutafhandeling: onverwachte fouten nooit als HTML-stacktrace lekken.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "internal_error", message: "Er ging iets mis." });
});

app.listen(port, () => {
  console.log(`api listening on :${port}`);
});
