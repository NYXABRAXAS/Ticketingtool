import { Router } from "express";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { z } from "zod";
import { prisma } from "../../db/prisma";
import { ApiError } from "../../middleware/errorHandler";

export const adminIntegrationSecretsRouter = Router();

adminIntegrationSecretsRouter.get("/", async (req, res, next) => {
  try {
    const clientId = req.query.clientId as string | undefined;
    const secrets = await prisma.integrationSecret.findMany({ where: clientId ? { clientId } : undefined, include: { client: true } });
    // Only metadata - the hash itself is never returned.
    res.json(secrets.map((s) => ({ id: s.id, client: s.client.code, label: s.label, active: s.active, createdAt: s.createdAt, lastUsedAt: s.lastUsedAt })));
  } catch (err) {
    next(err);
  }
});

const createSchema = z.object({ clientId: z.string().uuid(), label: z.string().min(1).max(120) });

// The plaintext secret is generated here, returned exactly once in this response, and
// never stored or logged in recoverable form - only its bcrypt hash is persisted.
adminIntegrationSecretsRouter.post("/", async (req, res, next) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "INVALID_REQUEST", "clientId and label are required.");

    const plaintext = randomBytes(32).toString("base64url");
    const secretHash = await bcrypt.hash(plaintext, 12);
    const record = await prisma.integrationSecret.create({ data: { clientId: parsed.data.clientId, label: parsed.data.label, secretHash } });

    res.status(201).json({ id: record.id, secret: plaintext, warning: "This secret is shown once. Store it securely in your LOS backend configuration - it cannot be retrieved again." });
  } catch (err) {
    next(err);
  }
});

adminIntegrationSecretsRouter.put("/:id/revoke", async (req, res, next) => {
  try {
    res.json(await prisma.integrationSecret.update({ where: { id: req.params.id }, data: { active: false } }));
  } catch (err) {
    next(err);
  }
});
