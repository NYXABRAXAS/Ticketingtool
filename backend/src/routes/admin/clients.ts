import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma";
import { ApiError } from "../../middleware/errorHandler";

export const adminClientsRouter = Router();

adminClientsRouter.get("/", async (_req, res, next) => {
  try {
    res.json(await prisma.client.findMany({ include: { projects: true }, orderBy: { name: "asc" } }));
  } catch (err) {
    next(err);
  }
});

const createSchema = z.object({ code: z.string().min(2).max(32), name: z.string().min(2).max(200) });

adminClientsRouter.post("/", async (req, res, next) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "INVALID_REQUEST", parsed.error.errors.map((e) => e.message).join(", "));
    const client = await prisma.client.create({ data: { code: parsed.data.code.toUpperCase(), name: parsed.data.name } });
    res.status(201).json(client);
  } catch (err: any) {
    if (err.code === "P2002") return next(new ApiError(409, "DUPLICATE", "A client with this code already exists."));
    next(err);
  }
});

const updateSchema = z.object({ name: z.string().min(2).max(200).optional(), active: z.boolean().optional() });

adminClientsRouter.put("/:id", async (req, res, next) => {
  try {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "INVALID_REQUEST", "Invalid fields.");
    const client = await prisma.client.update({ where: { id: req.params.id }, data: parsed.data });
    res.json(client);
  } catch (err) {
    next(err);
  }
});
