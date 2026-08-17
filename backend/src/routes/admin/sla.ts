import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma";
import { ApiError } from "../../middleware/errorHandler";

export const adminSlaRouter = Router();

adminSlaRouter.get("/", async (req, res, next) => {
  try {
    const projectId = req.query.projectId as string | undefined;
    res.json(
      await prisma.slaRule.findMany({
        where: projectId ? { OR: [{ projectId }, { projectId: null }] } : undefined,
        include: { priority: true, project: true },
      })
    );
  } catch (err) {
    next(err);
  }
});

const upsertSchema = z.object({
  projectId: z.string().uuid().nullable(),
  priorityId: z.string().uuid(),
  responseMins: z.number().int().positive(),
  resolveMins: z.number().int().positive(),
});

// Prisma's compound-unique `where` filter rejects `null` for a nullable member
// (projectId here) even though the column itself allows it, so upsert() can't be used
// directly against projectId_priorityId when projectId is null - find then create/update.
adminSlaRouter.post("/", async (req, res, next) => {
  try {
    const parsed = upsertSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "INVALID_REQUEST", parsed.error.errors.map((e) => e.message).join(", "));

    const existing = await prisma.slaRule.findFirst({ where: { projectId: parsed.data.projectId, priorityId: parsed.data.priorityId } });
    const rule = existing
      ? await prisma.slaRule.update({ where: { id: existing.id }, data: { responseMins: parsed.data.responseMins, resolveMins: parsed.data.resolveMins } })
      : await prisma.slaRule.create({ data: parsed.data });

    res.status(201).json(rule);
  } catch (err) {
    next(err);
  }
});

adminSlaRouter.put("/:id", async (req, res, next) => {
  try {
    const parsed = z.object({ responseMins: z.number().int().positive().optional(), resolveMins: z.number().int().positive().optional(), active: z.boolean().optional() }).safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "INVALID_REQUEST", "Invalid fields.");
    res.json(await prisma.slaRule.update({ where: { id: req.params.id }, data: parsed.data }));
  } catch (err) {
    next(err);
  }
});
