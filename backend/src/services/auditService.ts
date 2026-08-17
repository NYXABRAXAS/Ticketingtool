import { prisma } from "../db/prisma";

export async function recordAudit(params: {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  result: "SUCCESS" | "FAILURE";
  detail?: Record<string, unknown>;
  ipAddress?: string | null;
}) {
  await prisma.auditLog.create({
    data: {
      actorId: params.actorId ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      result: params.result,
      detail: params.detail as any,
      ipAddress: params.ipAddress ?? null,
    },
  });
}
