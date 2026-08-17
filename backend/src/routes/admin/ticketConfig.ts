import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma";
import { ApiError } from "../../middleware/errorHandler";

export const adminTicketConfigRouter = Router();

function crud(router: Router, path: string, model: any, extraFields: Record<string, z.ZodTypeAny> = {}) {
  const baseFields = { name: z.string().min(1).max(120), sortOrder: z.number().int().optional(), active: z.boolean().optional() };
  const createSchema = z.object({ ...baseFields, ...extraFields });
  const updateSchema = z.object({ ...baseFields, ...extraFields }).partial();

  router.get(`/${path}`, async (_req, res, next) => {
    try {
      res.json(await model.findMany({ orderBy: { sortOrder: "asc" } }));
    } catch (err) {
      next(err);
    }
  });

  router.post(`/${path}`, async (req, res, next) => {
    try {
      const parsed = createSchema.safeParse(req.body);
      if (!parsed.success) throw new ApiError(400, "INVALID_REQUEST", parsed.error.errors.map((e) => e.message).join(", "));
      res.status(201).json(await model.create({ data: parsed.data }));
    } catch (err: any) {
      if (err.code === "P2002") return next(new ApiError(409, "DUPLICATE", "An item with this name already exists."));
      next(err);
    }
  });

  router.put(`/${path}/:id`, async (req, res, next) => {
    try {
      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) throw new ApiError(400, "INVALID_REQUEST", "Invalid fields.");
      res.json(await model.update({ where: { id: req.params.id }, data: parsed.data }));
    } catch (err) {
      next(err);
    }
  });
}

crud(adminTicketConfigRouter, "ticket-types", prisma.ticketType);
crud(adminTicketConfigRouter, "modules", prisma.ticketModule);
crud(adminTicketConfigRouter, "priorities", prisma.ticketPriority, { redminePriorityId: z.number().int().optional() });
crud(adminTicketConfigRouter, "statuses", prisma.ticketStatus, { redmineStatusId: z.number().int().optional(), isClosed: z.boolean().optional() });

// Configurable status workflow graph (which From -> To transitions are legal)
adminTicketConfigRouter.get("/status-transitions", async (_req, res, next) => {
  try {
    res.json(await prisma.statusTransition.findMany({ include: { fromStatus: true, toStatus: true } }));
  } catch (err) {
    next(err);
  }
});

const transitionSchema = z.object({ fromStatusId: z.string().uuid(), toStatusId: z.string().uuid() });

adminTicketConfigRouter.post("/status-transitions", async (req, res, next) => {
  try {
    const parsed = transitionSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "INVALID_REQUEST", "fromStatusId and toStatusId are required.");
    res.status(201).json(await prisma.statusTransition.create({ data: parsed.data }));
  } catch (err: any) {
    if (err.code === "P2002") return next(new ApiError(409, "DUPLICATE", "This transition already exists."));
    next(err);
  }
});

adminTicketConfigRouter.delete("/status-transitions/:id", async (req, res, next) => {
  try {
    await prisma.statusTransition.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
