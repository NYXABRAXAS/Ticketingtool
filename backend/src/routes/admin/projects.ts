import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma";
import { ApiError } from "../../middleware/errorHandler";
import { redmineClient } from "../../services/redmineClient";

export const adminProjectsRouter = Router();

adminProjectsRouter.get("/", async (req, res, next) => {
  try {
    const clientId = req.query.clientId as string | undefined;
    res.json(await prisma.project.findMany({ where: clientId ? { clientId } : undefined, include: { client: true }, orderBy: { name: "asc" } }));
  } catch (err) {
    next(err);
  }
});

// Convenience endpoint for the admin UI to pick a Redmine project by name instead of
// having to know its numeric id / identifier up front.
adminProjectsRouter.get("/redmine-projects", async (_req, res, next) => {
  try {
    res.json(await redmineClient.getProjects());
  } catch (err) {
    next(err);
  }
});

const createSchema = z.object({
  clientId: z.string().uuid(),
  code: z.string().min(2).max(64),
  name: z.string().min(2).max(200),
  redmineProjectId: z.number().int(),
  redmineProjectIdent: z.string().min(1),
});

adminProjectsRouter.post("/", async (req, res, next) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "INVALID_REQUEST", parsed.error.errors.map((e) => e.message).join(", "));
    const project = await prisma.project.create({ data: parsed.data });
    res.status(201).json(project);
  } catch (err: any) {
    if (err.code === "P2002") return next(new ApiError(409, "DUPLICATE", "A project with this code already exists for the client."));
    next(err);
  }
});

const updateSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  redmineProjectId: z.number().int().optional(),
  redmineProjectIdent: z.string().optional(),
  active: z.boolean().optional(),
});

adminProjectsRouter.put("/:id", async (req, res, next) => {
  try {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "INVALID_REQUEST", "Invalid fields.");
    const project = await prisma.project.update({ where: { id: req.params.id }, data: parsed.data });
    res.json(project);
  } catch (err) {
    next(err);
  }
});
