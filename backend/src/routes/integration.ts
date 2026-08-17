import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { env } from "../config/env";
import { signLaunchToken } from "../utils/jwt";
import { ApiError } from "../middleware/errorHandler";
import { recordAudit } from "../services/auditService";

export const integrationRouter = Router();

const launchTokenRequestSchema = z.object({
  losUserId: z.string().min(1).max(128),
  losUsername: z.string().min(1).max(128),
  displayName: z.string().min(1).max(200),
  email: z.string().email().optional(),
  projectCode: z.string().min(1).max(64),
  role: z.string().max(64).optional(),
  losContext: z
    .object({
      losVersion: z.string().max(64).optional(),
      environment: z.string().max(32).optional(),
      module: z.string().max(64).optional(),
      applicationNumber: z.string().max(64).optional(),
      loanNumber: z.string().max(64).optional(),
    })
    .optional(),
});

// POST /api/integration/launch-token
// Server-to-server only. Called by the LOS backend using its own authenticated
// session context for the user - never called directly from a browser.
// Auth: `X-Client-Code` header identifies the tenant, `Authorization: Bearer <secret>`
// carries the pre-shared integration secret issued to that LOS (see admin > LOS Integration).
integrationRouter.post("/launch-token", async (req, res, next) => {
  try {
    const clientCode = req.header("X-Client-Code");
    const authHeader = req.header("Authorization");
    const providedSecret = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;

    if (!clientCode || !providedSecret) {
      throw new ApiError(401, "INTEGRATION_UNAUTHORIZED", "Missing X-Client-Code or Authorization header.");
    }

    const client = await prisma.client.findUnique({ where: { code: clientCode } });
    if (!client || !client.active) {
      throw new ApiError(401, "INTEGRATION_UNAUTHORIZED", "Unknown or inactive client.");
    }

    const secrets = await prisma.integrationSecret.findMany({ where: { clientId: client.id, active: true } });
    let matchedSecretId: string | null = null;
    for (const secret of secrets) {
      // eslint-disable-next-line no-await-in-loop
      if (await bcrypt.compare(providedSecret, secret.secretHash)) {
        matchedSecretId = secret.id;
        break;
      }
    }
    if (!matchedSecretId) {
      await recordAudit({ action: "LAUNCH_TOKEN_REQUEST", entityType: "Client", entityId: client.id, result: "FAILURE", detail: { reason: "bad_secret" }, ipAddress: req.ip });
      throw new ApiError(401, "INTEGRATION_UNAUTHORIZED", "Invalid integration secret.");
    }

    const parsed = launchTokenRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, "INVALID_REQUEST", parsed.error.errors.map((e) => e.message).join(", "));
    }
    const body = parsed.data;

    const project = await prisma.project.findFirst({
      where: { clientId: client.id, code: body.projectCode, active: true },
    });
    if (!project) {
      throw new ApiError(400, "INVALID_PROJECT", `Project '${body.projectCode}' is not configured for client '${clientCode}'.`);
    }

    const { token } = signLaunchToken({
      losUserId: body.losUserId,
      losUsername: body.losUsername,
      displayName: body.displayName,
      email: body.email,
      clientCode: client.code,
      projectCode: project.code,
      role: body.role,
      losContext: body.losContext,
    });

    await prisma.integrationSecret.update({ where: { id: matchedSecretId }, data: { lastUsedAt: new Date() } });
    await recordAudit({
      action: "LAUNCH_TOKEN_ISSUED",
      entityType: "Client",
      entityId: client.id,
      result: "SUCCESS",
      detail: { losUserId: body.losUserId, projectCode: project.code },
      ipAddress: req.ip,
    });

    res.json({ launchUrl: `${env.publicAppUrl}/launch?token=${token}` });
  } catch (err) {
    next(err);
  }
});
