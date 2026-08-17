import { prisma } from "../db/prisma";

export async function computeSlaDueAt(projectId: string, priorityId: string, from: Date = new Date()): Promise<Date | null> {
  const rule =
    (await prisma.slaRule.findFirst({ where: { projectId, priorityId, active: true } })) ??
    (await prisma.slaRule.findFirst({ where: { projectId: null, priorityId, active: true } }));

  if (!rule) return null;
  return new Date(from.getTime() + rule.resolveMins * 60_000);
}

export function slaState(slaDueAt: Date | null, isClosed: boolean): "NONE" | "WITHIN_SLA" | "AT_RISK" | "BREACHED" {
  if (!slaDueAt || isClosed) return slaDueAt ? "WITHIN_SLA" : "NONE";
  const now = Date.now();
  const due = slaDueAt.getTime();
  if (now > due) return "BREACHED";
  const remainingMs = due - now;
  if (remainingMs < 2 * 60 * 60 * 1000) return "AT_RISK"; // within 2 hours of breach
  return "WITHIN_SLA";
}
