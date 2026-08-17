import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma";
import { ApiError } from "../../middleware/errorHandler";

export const adminOriginsRouter = Router();

adminOriginsRouter.get("/", async (_req, res, next) => {
  try {
    res.json(await prisma.allowedOrigin.findMany({ include: { client: true }, orderBy: { origin: "asc" } }));
  } catch (err) {
    next(err);
  }
});

const createSchema = z.object({ origin: z.string().url(), clientId: z.string().uuid().optional() });

adminOriginsRouter.post("/", async (req, res, next) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "INVALID_REQUEST", "A valid origin URL is required.");
    res.status(201).json(await prisma.allowedOrigin.create({ data: parsed.data }));
  } catch (err: any) {
    if (err.code === "P2002") return next(new ApiError(409, "DUPLICATE", "This origin is already allow-listed."));
    next(err);
  }
});

adminOriginsRouter.put("/:id", async (req, res, next) => {
  try {
    const parsed = z.object({ active: z.boolean() }).safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "INVALID_REQUEST", "Invalid fields.");
    res.json(await prisma.allowedOrigin.update({ where: { id: req.params.id }, data: parsed.data }));
  } catch (err) {
    next(err);
  }
});
