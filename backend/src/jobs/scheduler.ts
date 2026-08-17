import { env } from "../config/env";
import { pollRedmineForUpdates, retryPendingTicketSync } from "../services/syncService";
import { logger } from "../utils/logger";

let timer: NodeJS.Timeout | null = null;

export function startScheduledJobs() {
  if (!env.syncEnabled) {
    logger.info("sync_disabled");
    return;
  }

  const run = async () => {
    try {
      await retryPendingTicketSync();
      await pollRedmineForUpdates();
    } catch (err: any) {
      logger.error("scheduled_sync_failed", { message: err.message });
    }
  };

  timer = setInterval(run, env.syncPollIntervalMs);
  logger.info("sync_scheduled", { intervalMs: env.syncPollIntervalMs });
  void run();
}

export function stopScheduledJobs() {
  if (timer) clearInterval(timer);
}
