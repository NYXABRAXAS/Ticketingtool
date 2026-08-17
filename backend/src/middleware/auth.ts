import { Request, Response, NextFunction } from "express";
import { verifySessionToken, verifyAdminSessionToken } from "../utils/jwt";
import { prisma } from "../db/prisma";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      losUser?: {
        userMappingId: string;
        losUserId: string;
        clientId: string;
        projectId: string;
        role: string;
        permissions: string[];
      };
      adminUser?: {
        adminUserId: string;
        role: string;
      };
    }
  }
}

const SESSION_COOKIE = "ttk_session";
const ADMIN_COOKIE = "ttk_admin_session";

export function getSessionCookieName() {
  return SESSION_COOKIE;
}

export function getAdminCookieName() {
  return ADMIN_COOKIE;
}

// Resolves the authenticated LOS user from the session cookie and re-hydrates
// role/permissions from the database (never trusts stale claims baked into the JWT).
export async function requireLosSession(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[SESSION_COOKIE];
    if (!token) {
      return res.status(401).json({ error: "UNAUTHENTICATED", message: "No active Ticketing Tool session. Please relaunch from your LOS." });
    }
    const claims = verifySessionToken(token);

    const mapping = await prisma.losUserMapping.findUnique({
      where: { id: claims.userMappingId },
      include: { permissions: true },
    });

    if (!mapping || !mapping.active) {
      return res.status(401).json({ error: "SESSION_INVALID", message: "Your access has been revoked or is inactive." });
    }

    req.losUser = {
      userMappingId: mapping.id,
      losUserId: mapping.losUserId,
      clientId: mapping.clientId,
      projectId: mapping.projectId,
      role: mapping.role,
      permissions: mapping.permissions.map((p) => p.permission),
    };
    next();
  } catch {
    return res.status(401).json({ error: "SESSION_INVALID", message: "Session expired or invalid. Please relaunch from your LOS." });
  }
}

export function requirePermission(...anyOf: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.losUser) return res.status(401).json({ error: "UNAUTHENTICATED" });
    // INTERNAL_ADMIN role (internal support) bypasses fine-grained permission checks
    // but is still subject to client/project isolation on every query.
    if (req.losUser.role === "INTERNAL_ADMIN") return next();
    const has = anyOf.some((p) => req.losUser!.permissions.includes(p));
    if (!has) {
      return res.status(403).json({ error: "FORBIDDEN", message: "You do not have permission to perform this action." });
    }
    next();
  };
}

export async function requireAdminSession(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[ADMIN_COOKIE];
    if (!token) return res.status(401).json({ error: "UNAUTHENTICATED" });
    const claims = verifyAdminSessionToken(token);

    const admin = await prisma.adminUser.findUnique({ where: { id: claims.adminUserId } });
    if (!admin || !admin.active) return res.status(401).json({ error: "SESSION_INVALID" });

    req.adminUser = { adminUserId: admin.id, role: admin.role };
    next();
  } catch {
    return res.status(401).json({ error: "SESSION_INVALID" });
  }
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.adminUser?.role !== "SUPER_ADMIN") {
    return res.status(403).json({ error: "FORBIDDEN", message: "Super admin access required." });
  }
  next();
}
