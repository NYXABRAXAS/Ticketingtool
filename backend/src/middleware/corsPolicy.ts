import cors from "cors";
import { env } from "../config/env";
import { prisma } from "../db/prisma";
import { logger } from "../utils/logger";

let cachedOrigins: Set<string> = new Set(env.allowedOrigins);
let lastRefresh = 0;
const REFRESH_MS = 60_000;

async function refreshOrigins() {
  try {
    const rows = await prisma.allowedOrigin.findMany({ where: { active: true } });
    cachedOrigins = new Set([...env.allowedOrigins, ...rows.map((r) => r.origin)]);
    lastRefresh = Date.now();
  } catch (err: any) {
    logger.error("origin_refresh_failed", { message: err.message });
  }
}

export const corsMiddleware = cors({
  origin(origin, callback) {
    // Server-to-server calls (no Origin header, e.g. the LOS backend calling
    // /api/integration/launch-token) are not subject to browser CORS at all.
    if (!origin) return callback(null, true);

    if (Date.now() - lastRefresh > REFRESH_MS) void refreshOrigins();

    if (cachedOrigins.has(origin)) return callback(null, true);
    return callback(new Error("Origin not allowed by CORS policy"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Client-Code"],
});

export async function primeOriginCache() {
  await refreshOrigins();
}
