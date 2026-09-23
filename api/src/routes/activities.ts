import { Router } from "express";
import { z } from "zod";
import { type Activity, isValidKey } from "shared";
import { requireAdmin } from "../middleware/auth.js";
import { deleteActivity, insertActivity, updateActivity } from "../db/activitiesRepo.js";

// Lezen gaat via /api/roster (activiteiten zitten per dag in dat antwoord);
// hier alleen aanmaken, aanpassen en verwijderen, en dat mogen alleen admins.
export const activitiesRouter = Router();

function newId(): string {
  return "a" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

const activitySchema = z.object({
  date: z.string().refine(isValidKey, "Ongeldige datum."),
  title: z.string().trim().min(1, "Geef de activiteit een naam.").max(120),
  note: z.string().trim().max(2000).optional().default(""),
});

/** POST /api/activities — alleen admins. */
activitiesRouter.post("/", requireAdmin, async (req, res) => {
  const parsed = activitySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_argument", message: parsed.error.issues[0]?.message ?? "Ongeldige invoer." });
    return;
  }
  const activity: Activity = {
    id: newId(),
    ...parsed.data,
    createdBy: req.user!,
    createdAt: new Date().toISOString(),
  };
  await insertActivity(activity);
  res.status(201).json(activity);
});

/** PUT /api/activities/:id — alleen admins. Datum, naam en toelichting. */
activitiesRouter.put("/:id", requireAdmin, async (req, res) => {
  const parsed = activitySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_argument", message: parsed.error.issues[0]?.message ?? "Ongeldige invoer." });
    return;
  }
  const updated = await updateActivity(String(req.params.id), parsed.data, req.user!);
  if (!updated) { res.status(404).json({ error: "not_found", message: "Activiteit bestaat niet (meer)." }); return; }
  res.json(updated);
});

/** DELETE /api/activities/:id — alleen admins. */
activitiesRouter.delete("/:id", requireAdmin, async (req, res) => {
  const deleted = await deleteActivity(String(req.params.id));
  if (!deleted) { res.status(404).json({ error: "not_found", message: "Activiteit bestaat niet (meer)." }); return; }
  res.status(204).end();
});
