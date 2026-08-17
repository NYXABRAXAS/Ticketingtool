import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import swaggerUi from "swagger-ui-express";
import { corsMiddleware } from "./middleware/corsPolicy";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler";
import { openApiSpec } from "./swagger";

import { integrationRouter } from "./routes/integration";
import { launchRouter } from "./routes/launch";
import { meRouter } from "./routes/me";
import { projectsRouter } from "./routes/projects";
import { ticketsRouter } from "./routes/tickets";
import { dashboardRouter } from "./routes/dashboard";
import { configRouter } from "./routes/config";
import { healthRouter } from "./routes/health";
import { webhooksRouter } from "./routes/webhooks";
import { adminRouter } from "./routes/admin";
import { openRouter } from "./routes/open";

export function createApp() {
  const app = express();

  app.set("trust proxy", 1); // required on Render so req.ip / secure cookies behave correctly behind the LB
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(corsMiddleware);
  app.use(cookieParser());
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));

  const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false });
  app.use("/api", apiLimiter);

  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));
  app.get("/health", (_req, res) => res.redirect(307, "/api/health"));
  app.use("/api/health", healthRouter);

  app.use("/api/integration", integrationRouter);
  app.use("/api/launch", launchRouter);
  app.use("/api/me", meRouter);
  app.use("/api/projects", projectsRouter);
  app.use("/api/tickets", ticketsRouter);
  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/config", configRouter);
  app.use("/api/webhooks", webhooksRouter);
  app.use("/api/admin", adminRouter);

  // Unauthenticated Redmine proxy - tighter rate limit since there's no login to
  // discourage abuse behind.
  const openLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false });
  app.use("/api/open", openLimiter, openRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
