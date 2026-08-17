import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma";
import { ApiError } from "../../middleware/errorHandler";

export const adminAssigneeMappingsRouter = Router();

adminAssigneeMappingsRouter.get("/", async (req, res, next) => {
  try {
    const projectId = req.query.projectId as string | undefined;
    if (!projectId) throw new ApiError(400, "INVALID_REQUEST", "projectId query parameter is required.");
    res.json(await prisma.assigneeMapping.findMany({ where: { projectId }, orderBy: { displayName: "asc" } }));
  } catch (err) {
    next(err);
  }
});

const createSchema = z.object({
  projectId: z.string().uuid(),
  redmineUserId: z.number().int(),
  displayName: z.string().min(1).max(200),
  email: z.string().email().optional(),
});

adminAssigneeMappingsRouter.post("/", async (req, res, next) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "INVALID_REQUEST", parsed.error.errors.map((e) => e.message).join(", "));
    const mapping = await prisma.assigneeMapping.create({ data: parsed.data });
    res.status(201).json(mapping);
  } catch (err: any) {
    if (err.code === "P2002") return next(new ApiError(409, "DUPLICATE", "This user is already an authorized assignee for the project."));
    next(err);
  }
});

const updateSchema = z.object({ active: z.boolean().optional(), displayName: z.string().min(1).max(200).optional() });

adminAssigneeMappingsRouter.put("/:id", async (req, res, next) => {
  try {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "INVALID_REQUEST", "Invalid fields.");
    res.json(await prisma.assigneeMapping.update({ where: { id: req.params.id }, data: parsed.data }));
  } catch (err) {
    next(err);
  }
});

adminAssigneeMappingsRouter.delete("/:id", async (req, res, next) => {
  try {
    await prisma.assigneeMapping.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
