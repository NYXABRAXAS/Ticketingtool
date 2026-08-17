import { Router } from "express";
import { prisma } from "../db/prisma";
import { requireLosSession } from "../middleware/auth";

export const configRouter = Router();
configRouter.use(requireLosSession);

configRouter.get("/ticket-types", async (_req, res, next) => {
  try {
    res.json(await prisma.ticketType.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }));
  } catch (err) {
    next(err);
  }
});

configRouter.get("/modules", async (_req, res, next) => {
  try {
    res.json(await prisma.ticketModule.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }));
  } catch (err) {
    next(err);
  }
});

configRouter.get("/priorities", async (_req, res, next) => {
  try {
    res.json(await prisma.ticketPriority.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }));
  } catch (err) {
    next(err);
  }
});

configRouter.get("/statuses", async (_req, res, next) => {
  try {
    res.json(await prisma.ticketStatus.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }));
  } catch (err) {
    next(err);
  }
});

// Only assignees explicitly mapped to the caller's current project are ever returned -
// this is what keeps "Assign To" from leaking the full Redmine user directory.
configRouter.get("/assignees", async (req, res, next) => {
  try {
    const assignees = await prisma.assigneeMapping.findMany({
      where: { projectId: req.losUser!.projectId, active: true },
      orderBy: { displayName: "asc" },
    });
    res.json(assignees.map((a) => ({ redmineUserId: a.redmineUserId, displayName: a.displayName })));
  } catch (err) {
    next(err);
  }
});
