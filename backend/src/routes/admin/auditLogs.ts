import { Router } from "express";
import { prisma } from "../../db/prisma";

export const adminAuditLogsRouter = Router();

adminAuditLogsRouter.get("/", async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize ?? 50)));
    const action = req.query.action as string | undefined;

    const where = action ? { action } : undefined;
    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { actor: true },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({
      items: items.map((l) => ({ id: l.id, actor: l.actor?.displayName ?? "System", action: l.action, entityType: l.entityType, entityId: l.entityId, result: l.result, detail: l.detail, ipAddress: l.ipAddress, createdAt: l.createdAt })),
      total,
      page,
      pageSize,
    });
  } catch (err) {
    next(err);
  }
});
