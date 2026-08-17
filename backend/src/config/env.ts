import "dotenv/config";

function required(name: string, fallbackForDev?: string): string {
  const value = process.env[name] ?? fallbackForDev;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const isProd = process.env.NODE_ENV === "production";

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  isProd,
  port: Number(process.env.PORT ?? 10000),

  databaseUrl: required("DATABASE_URL", isProd ? undefined : "postgresql://postgres:postgres@localhost:5432/ticketing"),

  redmineBaseUrl: required("REDMINE_BASE_URL", isProd ? undefined : "https://redmine.example.com"),
  redmineApiKey: required("REDMINE_API_KEY", isProd ? undefined : "dev-placeholder-key"),
  redmineTimeoutMs: Number(process.env.REDMINE_TIMEOUT ?? 30000),
  redmineWebhookSecret: process.env.REDMINE_WEBHOOK_SECRET ?? "",

  jwtSecret: required("TICKETING_JWT_SECRET", isProd ? undefined : "dev-only-jwt-secret-do-not-use-in-prod"),
  launchTokenSecret: required("LAUNCH_TOKEN_SECRET", isProd ? undefined : "dev-only-launch-secret-do-not-use-in-prod"),
  losIntegrationSecret: process.env.LOS_INTEGRATION_SECRET ?? "",

  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),

  syncEnabled: (process.env.SYNC_ENABLED ?? "true") === "true",
  syncPollIntervalMs: Number(process.env.SYNC_POLL_INTERVAL_MS ?? 60000),

  launchTokenTtlSeconds: Number(process.env.LAUNCH_TOKEN_TTL_SECONDS ?? 300),
  sessionTtlHours: Number(process.env.SESSION_TTL_HOURS ?? 8),

  maxUploadBytes: Number(process.env.MAX_UPLOAD_MB ?? 15) * 1024 * 1024,

  publicAppUrl: (process.env.PUBLIC_APP_URL ?? "http://localhost:5173").replace(/\/$/, ""),
};

if (env.isProd && (env.jwtSecret.startsWith("dev-only") || env.launchTokenSecret.startsWith("dev-only"))) {
  throw new Error("Refusing to start in production with development secret defaults. Set TICKETING_JWT_SECRET and LAUNCH_TOKEN_SECRET.");
}
