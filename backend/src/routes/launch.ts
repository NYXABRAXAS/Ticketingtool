import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { env } from "../config/env";
import { verifyLaunchToken, signSessionToken } from "../utils/jwt";
import { ApiError } from "../middleware/errorHandler";
import { getSessionCookieName } from "../middleware/auth";
import { defaultPermissionsForRole } from "../constants/permissions";
import { recordAudit } from "../services/auditService";

export const launchRouter = Router();

const validateSchema = z.object({ token: z.string().min(10) });

// POST /api/launch/validate
// Redeems a short-lived launch token exactly once and establishes a browser session.
launchRouter.post("/validate", async (req, res, next) => {
  try {
    const parsed = validateSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "INVALID_REQUEST", "Missing token.");

    let claims;
    try {
      claims = verifyLaunchToken(parsed.data.token);
    } catch {
      throw new ApiError(401, "TOKEN_INVALID", "This launch link is invalid or has expired. Please reopen the Ticketing Tool from your LOS.");
    }

    // Replay protection: a launch token nonce may only ever be redeemed once.
    const alreadyUsed = await prisma.usedLaunchNonce.findUnique({ where: { nonce: claims.nonce } });
    if (alreadyUsed) {
      await recordAudit({ action: "LAUNCH_TOKEN_REPLAY", entityType: "LaunchToken", result: "FAILURE", detail: { losUserId: claims.losUserId }, ipAddress: req.ip });
      throw new ApiError(401, "TOKEN_REPLAYED", "This launch link has already been used. Please reopen the Ticketing Tool from your LOS.");
    }
    await prisma.usedLaunchNonce.create({
      data: { nonce: claims.nonce, expiresAt: new Date(Date.now() + env.launchTokenTtlSeconds * 1000 + 60_000) },
    });

    const client = await prisma.client.findUnique({ where: { code: claims.clientCode } });
    if (!client || !client.active) throw new ApiError(403, "CLIENT_DENIED", "This client is not configured for ticketing access.");

    const project = await prisma.project.findFirst({ where: { clientId: client.id, code: claims.projectCode, active: true } });
    if (!project) throw new ApiError(403, "PROJECT_DENIED", "This project is not configured for ticketing access.");

    let mapping = await prisma.losUserMapping.findUnique({
      where: { clientId_projectId_losUserId: { clientId: client.id, projectId: project.id, losUserId: claims.losUserId } },
    });

    if (!mapping) {
      const role = claims.role && ["LOS_USER", "LOS_SUPPORT"].includes(claims.role) ? claims.role : "LOS_USER";
      mapping = await prisma.losUserMapping.create({
        data: {
          clientId: client.id,
          projectId: project.id,
          losUserId: claims.losUserId,
          losUsername: claims.losUsername,
          displayName: claims.displayName,
          email: claims.email,
          role,
          permissions: { create: defaultPermissionsForRole(role).map((permission) => ({ permission })) },
        },
      });
    } else if (!mapping.active) {
      throw new ApiError(403, "USER_DEACTIVATED", "Your ticketing access has been deactivated. Contact your administrator.");
    } else {
      mapping = await prisma.losUserMapping.update({
        where: { id: mapping.id },
        data: { displayName: claims.displayName, email: claims.email ?? mapping.email, lastLoginAt: new Date() },
      });
    }

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

    await recordAudit({ actorId: mapping.id, action: "LAUNCH", entityType: "LosUserMapping", entityId: mapping.id, result: "SUCCESS", ipAddress: req.ip });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

launchRouter.post("/logout", (req, res) => {
  res.clearCookie(getSessionCookieName(), { path: "/" });
  res.json({ ok: true });
});
