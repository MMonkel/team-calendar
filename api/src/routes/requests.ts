import { Router } from "express";
import { z } from "zod";
import {
  type AbsenceRequest, type AnyRequest, isAdmin, isPerson,
  type MoveRequest, ownShiftsInRange, type RequestChange, type RevertRequest, snapshotOf,
} from "shared";
import { requireAdmin } from "../middleware/auth.js";
import {
  deleteRequest, getRequest, insertChange, insertRequest, listChanges, listRequests, updateRequestFields,
} from "../db/requestsRepo.js";
import {
  assertValidRange, cascadeForApproval, computeShortNotice, sameSnapshot, sanitizeReplacements, ValidationError,
} from "../domain/requestRules.js";

export const requestsRouter = Router();

function newId(): string {
  return "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function newChangeId(): string {
  return "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function handleValidation(res: import("express").Response, err: unknown): boolean {
  if (err instanceof ValidationError) {
    res.status(400).json({ error: "invalid_argument", message: err.message });
    return true;
  }
  return false;
}

/** GET /api/requests?person=&status= — admins mogen elk filter zetten; leden zien alleen zichzelf. */
requestsRouter.get("/", async (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  let person = typeof req.query.person === "string" ? req.query.person : undefined;
  if (!isAdmin(req.user!)) person = req.user!;
  if (person && !isPerson(person)) {
    res.status(400).json({ error: "invalid_argument", message: "Onbekend teamlid." });
    return;
  }
  const rows = await listRequests({ person, status });
  res.json(rows);
});

const absenceSchema = z.object({
  kind: z.enum(["day", "vacation"]),
  from: z.string(),
  to: z.string(),
  note: z.string().max(2000).optional().default(""),
  replacements: z.record(z.string()).optional().default({}),
});

/** POST /api/requests — nieuwe vrije dag of vakantie, altijd voor jezelf, altijd als concept. */
requestsRouter.post("/", async (req, res) => {
  try {
    const body = absenceSchema.parse(req.body);
    assertValidRange(body.from, body.to);
    const person = req.user!;
    const replacements = sanitizeReplacements(person, body.from, body.to, body.replacements);

    const request: AbsenceRequest = {
      id: newId(),
      type: "absence",
      kind: body.kind,
      person,
      from: body.from,
      to: body.to,
      replacements,
      note: body.note,
      status: "draft",
      shortNotice: computeShortNotice(body.from),
      createdAt: new Date().toISOString(),
    };
    await insertRequest(request);
    res.status(201).json(request);
  } catch (err) {
    if (handleValidation(res, err)) return;
    if (err instanceof z.ZodError) { res.status(400).json({ error: "invalid_argument", message: err.message }); return; }
    throw err;
  }
});

/** DELETE /api/requests/:id — intrekken; alleen de eigen concepten. */
requestsRouter.delete("/:id", async (req, res) => {
  const existing = await getRequest(String(req.params.id));
  if (!existing) { res.status(404).json({ error: "not_found" }); return; }
  const owns = existing.person === req.user;
  if (!owns && !isAdmin(req.user!)) { res.status(403).json({ error: "forbidden" }); return; }
  if (existing.status !== "draft") {
    res.status(409).json({ error: "invalid_state", message: "Alleen concepten kunnen worden ingetrokken." });
    return;
  }
  await deleteRequest(String(req.params.id));
  res.status(204).end();
});

const moveSchema = z.object({
  from: z.string(),
  to: z.string(),
  note: z.string().max(2000).optional().default(""),
  replacements: z.record(z.string()).optional().default({}),
});

/** POST /api/requests/:id/move — verplaatsing van een bestaande (draft of approved) absence, zelf ingediend als nieuw concept. */
requestsRouter.post("/:id/move", async (req, res) => {
  try {
    const target = await getRequest(String(req.params.id));
    if (!target || target.type !== "absence") { res.status(404).json({ error: "not_found" }); return; }
    if (target.person !== req.user) { res.status(403).json({ error: "forbidden" }); return; }
    if (target.status !== "draft" && target.status !== "approved") {
      res.status(409).json({ error: "invalid_state", message: "Deze aanvraag staat niet meer open om te verplaatsen." });
      return;
    }
    const body = moveSchema.parse(req.body);
    assertValidRange(body.from, body.to);
    const replacements = sanitizeReplacements(target.person, body.from, body.to, body.replacements);

    const move: MoveRequest = {
      id: newId(),
      type: "move",
      person: target.person,
      targetId: target.id,
      origFrom: target.from,
      origTo: target.to,
      from: body.from,
      to: body.to,
      replacements,
      note: body.note,
      status: "draft",
      shortNotice: computeShortNotice(body.from),
      createdAt: new Date().toISOString(),
    };
    await insertRequest(move);
    res.status(201).json(move);
  } catch (err) {
    if (handleValidation(res, err)) return;
    if (err instanceof z.ZodError) { res.status(400).json({ error: "invalid_argument", message: err.message }); return; }
    throw err;
  }
});

const revertSchema = z.object({ note: z.string().max(2000).optional().default("") });

/** POST /api/requests/:id/revert — terugzetten naar gewone werkdag, ook als nieuw concept. */
requestsRouter.post("/:id/revert", async (req, res) => {
  const target = await getRequest(String(req.params.id));
  if (!target || target.type !== "absence") { res.status(404).json({ error: "not_found" }); return; }
  if (target.person !== req.user) { res.status(403).json({ error: "forbidden" }); return; }
  if (target.status !== "draft" && target.status !== "approved") {
    res.status(409).json({ error: "invalid_state", message: "Deze aanvraag staat niet meer open om terug te zetten." });
    return;
  }
  const body = revertSchema.parse(req.body);
  const revert: RevertRequest = {
    id: newId(),
    type: "revert",
    person: target.person,
    targetId: target.id,
    origFrom: target.from,
    origTo: target.to,
    from: target.from,
    to: target.to,
    replacements: {},
    note: body.note,
    status: "draft",
    shortNotice: computeShortNotice(target.from),
    createdAt: new Date().toISOString(),
  };
  await insertRequest(revert);
  res.status(201).json(revert);
});

const editSchema = z.object({
  kind: z.enum(["day", "vacation"]),
  from: z.string(),
  to: z.string(),
  note: z.string().max(2000).optional().default(""),
  replacements: z.record(z.string()).optional().default({}),
  reason: z.string().max(2000).optional().default(""),
});

/**
 * PUT /api/requests/:id — alleen admins. Een vrije dag of vakantie direct
 * aanpassen of verplaatsen, zonder nieuwe beoordeling. De toestand ervóór
 * gaat de geschiedenis in.
 */
requestsRouter.put("/:id", requireAdmin, async (req, res) => {
  try {
    const target = await getRequest(String(req.params.id));
    if (!target || target.type !== "absence") { res.status(404).json({ error: "not_found" }); return; }
    if (target.status !== "draft" && target.status !== "approved") {
      res.status(409).json({ error: "invalid_state", message: "Alleen concept- of definitieve aanvragen kun je aanpassen." });
      return;
    }
    const body = editSchema.parse(req.body);
    assertValidRange(body.from, body.to);
    const fields = {
      kind: body.kind,
      from: body.from,
      to: body.to,
      replacements: sanitizeReplacements(target.person, body.from, body.to, body.replacements),
      note: body.note.trim(),
    };
    const before = snapshotOf(target);
    if (sameSnapshot(before, { ...before, ...fields })) {
      res.status(400).json({ error: "invalid_argument", message: "Er is niets gewijzigd." });
      return;
    }
    await updateRequestFields(target.id, fields);
    const after = snapshotOf((await getRequest(target.id))!);
    await insertChange({
      id: newChangeId(), requestId: target.id, action: "edit", by: req.user!,
      at: new Date().toISOString(), reason: body.reason.trim(), before, after,
    });
    res.json(await getRequest(target.id));
  } catch (err) {
    if (handleValidation(res, err)) return;
    if (err instanceof z.ZodError) { res.status(400).json({ error: "invalid_argument", message: err.message }); return; }
    throw err;
  }
});

const removeSchema = z.object({ reason: z.string().max(2000).optional().default("") });

/**
 * POST /api/requests/:id/remove — alleen admins. Zet een vrije dag of vakantie
 * op 'deleted': hij telt niet meer mee, maar blijft met geschiedenis zichtbaar.
 * Openstaande verplaatsingen of terugzettingen ervan vervallen.
 */
requestsRouter.post("/:id/remove", requireAdmin, async (req, res) => {
  const target = await getRequest(String(req.params.id));
  if (!target || target.type !== "absence") { res.status(404).json({ error: "not_found" }); return; }
  if (target.status !== "draft" && target.status !== "approved") {
    res.status(409).json({ error: "invalid_state", message: "Deze aanvraag telt al niet meer mee." });
    return;
  }
  const body = removeSchema.parse(req.body);
  const by = req.user!;
  const at = new Date().toISOString();
  await updateRequestFields(target.id, { status: "deleted" });
  await insertChange({
    id: newChangeId(), requestId: target.id, action: "delete", by, at,
    reason: body.reason.trim(), before: snapshotOf(target), after: null,
  });
  const pending = (await listRequests({ status: "draft" }))
    .filter((r) => r.type !== "absence" && r.targetId === target.id);
  for (const p of pending) {
    await updateRequestFields(p.id, {
      status: "rejected", reviewedBy: by, reviewedAt: at, comment: "De oorspronkelijke aanvraag is verwijderd.",
    });
  }
  res.json(await getRequest(target.id));
});

/** GET /api/requests/:id/changes — geschiedenis van een aanvraag, oudste eerst. */
requestsRouter.get("/:id/changes", async (req, res) => {
  const target = await getRequest(String(req.params.id));
  if (!target) { res.status(404).json({ error: "not_found" }); return; }
  if (!isAdmin(req.user!) && target.person !== req.user) {
    // Teamleden zien de geschiedenis van hun eigen aanvragen; die van anderen alleen via de kalender-details.
    res.json([] satisfies RequestChange[]);
    return;
  }
  res.json(await listChanges(target.id));
});

const decisionSchema = z.object({
  approve: z.boolean(),
  comment: z.string().max(2000).optional(),
});

/** POST /api/requests/:id/decision — alleen admins. Werkt voor alle drie de typen, met de juiste kaskade-effecten. */
requestsRouter.post("/:id/decision", requireAdmin, async (req, res) => {
  const decision = await getRequest(String(req.params.id));
  if (!decision) { res.status(404).json({ error: "not_found" }); return; }
  if (decision.status !== "draft") {
    res.status(409).json({ error: "invalid_state", message: "Deze aanvraag is al beoordeeld." });
    return;
  }
  const body = decisionSchema.parse(req.body);
  const reviewedBy = req.user!;
  const reviewedAt = new Date().toISOString();

  if (!body.approve) {
    await updateRequestFields(decision.id, {
      status: "rejected", reviewedBy, reviewedAt, comment: (body.comment ?? "").trim(),
    });
    res.json(await getRequest(decision.id));
    return;
  }

  if (decision.type === "absence") {
    await updateRequestFields(decision.id, { status: "approved", reviewedBy, reviewedAt });
  } else {
    const target = await getRequest((decision as AnyRequest & { targetId: string }).targetId);
    const cascade = cascadeForApproval(decision, target, reviewedBy, reviewedAt);
    if (cascade && target) {
      await updateRequestFields(target.id, cascade);
      // Vastleggen hoe de oorspronkelijke aanvraag eruitzag vóór de verplaatsing of terugzetting.
      await insertChange({
        id: newChangeId(), requestId: target.id, action: decision.type === "move" ? "move" : "revert",
        by: reviewedBy, at: reviewedAt, reason: decision.note, before: snapshotOf(target),
        after: snapshotOf((await getRequest(target.id))!),
      });
    }
    await updateRequestFields(decision.id, { status: "approved", reviewedBy, reviewedAt });
  }
  res.json(await getRequest(decision.id));
});

/** Hoeveel dagdelen van de aanvrager in [from,to] nog geen vervanger hebben — voor de waarschuwing bij beoordelen. */
requestsRouter.get("/:id/coverage", requireAdmin, async (req, res) => {
  const target = await getRequest(String(req.params.id));
  if (!target) { res.status(404).json({ error: "not_found" }); return; }
  if (target.type !== "absence" && target.type !== "move") {
    res.json({ shifts: [], uncovered: 0 });
    return;
  }
  const shifts = ownShiftsInRange(target.person, target.from, target.to);
  const uncovered = shifts.filter((s) => !target.replacements[`${s.date}|${s.part}`]).length;
  res.json({ shifts, uncovered });
});
