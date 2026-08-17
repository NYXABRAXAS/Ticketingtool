import { Router } from "express";
import { env } from "../../config/env";
import { redmineClient } from "../../services/redmineClient";
import { recordAudit } from "../../services/auditService";

export const adminRedmineConfigRouter = Router();

// Reports where Redmine is pointed and whether the key works - never the key itself.
adminRedmineConfigRouter.get("/", (_req, res) => {
  res.json({ baseUrl: env.redmineBaseUrl, apiKeyConfigured: Boolean(env.redmineApiKey && !env.redmineApiKey.startsWith("dev-placeholder")) });
});

adminRedmineConfigRouter.post("/test-connection", async (req, res, next) => {
  try {
    const result = await redmineClient.testConnection();
    await recordAudit({
      actorId: null,
      action: "REDMINE_CONNECTION_TEST",
      entityType: "IntegrationSetting",
      result: result.ok ? "SUCCESS" : "FAILURE",
      ipAddress: req.ip,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});
