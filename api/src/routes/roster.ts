import { Router } from "express";
import { z } from "zod";
import { eachDateKey, effectiveShiftsFor, holidayFor, isValidKey } from "shared";
import { listRequests } from "../db/requestsRepo.js";
import { listActivities } from "../db/activitiesRepo.js";

export const rosterRouter = Router();

const rangeSchema = z.object({ from: z.string(), to: z.string() });

const MAX_DAYS = 400; // ruim genoeg voor een jaarweergave, klein genoeg om misbruik te voorkomen

/** GET /api/roster?from=YYYY-MM-DD&to=YYYY-MM-DD */
rosterRouter.get("/", async (req, res) => {
  const parsed = rangeSchema.safeParse(req.query);
  if (!parsed.success || !isValidKey(parsed.data.from) || !isValidKey(parsed.data.to)) {
    res.status(400).json({ error: "invalid_argument", message: "Geef from en to mee als YYYY-MM-DD." });
    return;
  }
  const { from, to } = parsed.data;
  if (to < from) { res.status(400).json({ error: "invalid_argument", message: "to ligt voor from." }); return; }

  const days = eachDateKey(from, to);
  if (days.length > MAX_DAYS) {
    res.status(400).json({ error: "invalid_argument", message: `Periode mag hooguit ${MAX_DAYS} dagen zijn.` });
    return;
  }

  // Eén keer alle relevante aanvragen ophalen (niet per dag): een aanvraag
  // die de periode overlapt, moet ook meetellen als hij er net buiten begint of eindigt.
  const [all, activities] = await Promise.all([listRequests(), listActivities(from, to)]);
  const relevant = all.filter((r) => r.from <= to && r.to >= from);

  const result = days.map((date) => ({
    date,
    holiday: holidayFor(date),
    shifts: effectiveShiftsFor(date, relevant),
    activities: activities.filter((a) => a.date === date),
  }));
  res.json(result);
});
