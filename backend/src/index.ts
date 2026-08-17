import { env } from "./config/env";
import { createApp } from "./app";
import { prisma } from "./db/prisma";
import { logger } from "./utils/logger";
import { primeOriginCache } from "./middleware/corsPolicy";
import { startScheduledJobs } from "./jobs/scheduler";

async function main() {
  await prisma.$connect();
  await primeOriginCache();

  const app = createApp();
  app.listen(env.port, "0.0.0.0", () => {
    logger.info("server_started", { port: env.port, env: env.nodeEnv });
  });

  startScheduledJobs();
}

main().catch((err) => {
  logger.error("startup_failed", { message: err?.message, stack: err?.stack });
  process.exit(1);
});
