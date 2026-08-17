import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { env } from "../config/env";
import { requireLosSession, getSessionCookieName } from "../middleware/auth";
import { signSessionToken } from "../utils/jwt";
import { ApiError } from "../middleware/errorHandler";

export const projectsRouter = Router();

// All projects this LOS user has ever been launched into for their client. When there is
// only one, the frontend renders a static "Project: X" label instead of a dropdown.
projectsRouter.get("/", requireLosSession, async (req, res, next) => {
  try {
    const mappings = await prisma.losUserMapping.findMany({
      where: { clientId: req.losUser!.clientId, losUserId: req.losUser!.losUserId, active: true },
      include: { project: true },
    });
    res.json({
      current: req.losUser!.projectId,
      projects: mappings.map((m) => ({ id: m.project.id, code: m.project.code, name: m.project.name })),
    });
  } catch (err) {
    next(err);
  }
});

const switchSchema = z.object({ projectId: z.string().uuid() });

// Switches the active session to a project the user already has a provisioned mapping
// for. This never grants access to a new project - it only re-points the session at an
// existing mapping row created by a prior launch.
projectsRouter.post("/switch", requireLosSession, async (req, res, next) => {
  try {
    const parsed = switchSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "INVALID_REQUEST", "projectId is required.");

    const mapping = await prisma.losUserMapping.findFirst({
      where: {
        clientId: req.losUser!.clientId,
        losUserId: req.losUser!.losUserId,
        projectId: parsed.data.projectId,
        active: true,
      },
    });
    if (!mapping) throw new ApiError(403, "PROJECT_DENIED", "You are not authorized for that project.");

    const sessionToken = signSessionToken({
      userMappingId: mapping.id,
      losUserId: mapping.losUserId,
      clientId: mapping.clientId,
      projectId: mapping.projectId,
    });
    res.cookie(getSessionCookieName(), sessionToken, {
      httpOnly: true,
      secure: env.isProd,
      sameSite: env.isProd ? "none" : "lax",
      maxAge: env.sessionTtlHours * 60 * 60 * 1000,
      path: "/",
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
