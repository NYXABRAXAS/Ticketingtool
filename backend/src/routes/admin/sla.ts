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

adminSlaRouter.post("/", async (req, res, next) => {
  try {
    const parsed = upsertSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "INVALID_REQUEST", parsed.error.errors.map((e) => e.message).join(", "));
    const rule = await prisma.slaRule.upsert({
      where: { projectId_priorityId: { projectId: parsed.data.projectId as any, priorityId: parsed.data.priorityId } },
      create: parsed.data,
      update: { responseMins: parsed.data.responseMins, resolveMins: parsed.data.resolveMins },
    });
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
