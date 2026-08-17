import { Router } from "express";
import { prisma } from "../db/prisma";
import { requireLosSession } from "../middleware/auth";

export const meRouter = Router();

meRouter.get("/", requireLosSession, async (req, res, next) => {
  try {
    const mapping = await prisma.losUserMapping.findUnique({
      where: { id: req.losUser!.userMappingId },
      include: { client: true, project: true },
    });
    if (!mapping) return res.status(404).json({ error: "NOT_FOUND" });

    res.json({
      user: {
        displayName: mapping.displayName,
        losUsername: mapping.losUsername,
        email: mapping.email,
        role: mapping.role,
        permissions: req.losUser!.permissions,
      },
      client: { code: mapping.client.code, name: mapping.client.name },
      project: { id: mapping.project.id, code: mapping.project.code, name: mapping.project.name },
    });
  } catch (err) {
    next(err);
  }
});
