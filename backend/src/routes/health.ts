import { Router } from "express";
import { prisma } from "../db/prisma";
import { redmineClient } from "../services/redmineClient";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  let database: "connected" | "error" = "error";
  let redmine: "connected" | "error" = "error";

  try {
    await prisma.$queryRaw`SELECT 1`;
    database = "connected";
  } catch {
    database = "error";
  }

  try {
    const result = await redmineClient.testConnection();
    redmine = result.ok ? "connected" : "error";
  } catch {
    redmine = "error";
  }

  const status = database === "connected" && redmine === "connected" ? "ok" : "degraded";
  res.status(status === "ok" ? 200 : 503).json({ status, database, redmine });
});
