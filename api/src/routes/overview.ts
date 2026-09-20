import { Router } from "express";
import { extraDaysForYear, freeDaysForYear, isAdmin, isPerson } from "shared";
import { listRequests } from "../db/requestsRepo.js";

export const overviewRouter = Router();

function resolvePerson(req: import("express").Request, res: import("express").Response): string | null {
  const q = typeof req.query.person === "string" ? req.query.person : undefined;
  const person = q && isAdmin(req.user!) ? q : req.user!;
  if (!isPerson(person)) {
    res.status(400).json({ error: "invalid_argument", message: "Onbekend teamlid." });
    return null;
  }
  return person;
}

function resolveYear(req: import("express").Request): number {
  const y = Number(req.query.year);
  return Number.isInteger(y) ? y : new Date().getFullYear();
}

/** GET /api/overview/free-days?year=&person= (person alleen voor admins) */
overviewRouter.get("/free-days", async (req, res) => {
  const person = resolvePerson(req, res);
  if (!person) return;
  const year = resolveYear(req);
  const all = await listRequests({ person });
  res.json(freeDaysForYear(person as any, year, all));
});

/** GET /api/overview/extra-days?year=&person= */
overviewRouter.get("/extra-days", async (req, res) => {
  const person = resolvePerson(req, res);
  if (!person) return;
  const year = resolveYear(req);
  // Vervangingen kunnen op elk verzoek staan, niet alleen die van 'person' zelf.
  const all = await listRequests();
  res.json(extraDaysForYear(person as any, year, all));
});
