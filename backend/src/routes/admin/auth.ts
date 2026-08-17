import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { prisma } from "../../db/prisma";
import { env } from "../../config/env";
import { signAdminSessionToken } from "../../utils/jwt";
import { ApiError } from "../../middleware/errorHandler";
import { getAdminCookieName, requireAdminSession } from "../../middleware/auth";
import { recordAudit } from "../../services/auditService";

export const adminAuthRouter = Router();

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });

const loginSchema = z.object({ username: z.string().min(1), password: z.string().min(1) });

// This is the ONLY password-based login in the whole system - reserved for internal
// ticketing administrators. Normal LOS users never see a login form (see /launch).
adminAuthRouter.post("/login", loginLimiter, async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "INVALID_REQUEST", "Username and password are required.");

    const admin = await prisma.adminUser.findUnique({ where: { username: parsed.data.username } });
    if (!admin || !admin.active || !(await bcrypt.compare(parsed.data.password, admin.passwordHash))) {
      await recordAudit({ action: "ADMIN_LOGIN", entityType: "AdminUser", result: "FAILURE", detail: { username: parsed.data.username }, ipAddress: req.ip });
      throw new ApiError(401, "INVALID_CREDENTIALS", "Invalid username or password.");
    }

    const token = signAdminSessionToken({ adminUserId: admin.id, role: admin.role });
    res.cookie(getAdminCookieName(), token, {
      httpOnly: true,
      secure: env.isProd,
      sameSite: "lax",
      maxAge: 8 * 60 * 60 * 1000,
      path: "/",
    });
    await prisma.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
    await recordAudit({ action: "ADMIN_LOGIN", entityType: "AdminUser", entityId: admin.id, result: "SUCCESS", ipAddress: req.ip });

    res.json({ user: { username: admin.username, displayName: admin.displayName, role: admin.role } });
  } catch (err) {
    next(err);
  }
});

adminAuthRouter.post("/logout", (req, res) => {
  res.clearCookie(getAdminCookieName(), { path: "/" });
  res.json({ ok: true });
});

adminAuthRouter.get("/me", requireAdminSession, async (req, res, next) => {
  try {
    const admin = await prisma.adminUser.findUnique({ where: { id: req.adminUser!.adminUserId } });
    if (!admin) throw new ApiError(404, "NOT_FOUND", "Admin not found.");
    res.json({ username: admin.username, displayName: admin.displayName, role: admin.role });
  } catch (err) {
    next(err);
  }
});
