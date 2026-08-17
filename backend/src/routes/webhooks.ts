import { Router } from "express";
import { createHmac, timingSafeEqual } from "crypto";
import { env } from "../config/env";
import { syncSingleIssueFromRedmine } from "../services/syncService";
import { logger } from "../utils/logger";
import { ApiError } from "../middleware/errorHandler";

export const webhooksRouter = Router();

function isValidSignature(rawBody: string, signatureHeader: string | undefined): boolean {
  if (!env.redmineWebhookSecret) return true; // signature verification optional if no secret configured
  if (!signatureHeader) return false;
  const expected = createHmac("sha256", env.redmineWebhookSecret).update(rawBody).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
  } catch {
    return false;
  }
}

// Accepts Redmine's outgoing webhook payload and re-syncs just the referenced issue.
// Payload shape varies by plugin, so a few common shapes are tolerated.
webhooksRouter.post("/redmine", async (req, res, next) => {
  try {
    const signature = req.header("X-Redmine-Signature") ?? req.header("X-Hub-Signature-256");
    if (!isValidSignature(JSON.stringify(req.body), signature)) {
      throw new ApiError(401, "INVALID_SIGNATURE", "Webhook signature verification failed.");
    }

    const body = req.body ?? {};
    const issueId: number | undefined = body?.issue?.id ?? body?.payload?.issue?.id ?? body?.id;

    if (!issueId) {
      logger.warn("redmine_webhook_no_issue_id", { body });
      return res.status(202).json({ ok: true, ignored: true });
    }

    await syncSingleIssueFromRedmine(issueId);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
