import { Router } from "express";
import { prisma } from "../db/prisma";
import { requireLosSession, requirePermission } from "../middleware/auth";

export const dashboardRouter = Router();
dashboardRouter.use(requireLosSession);

dashboardRouter.get("/", requirePermission("TICKET_VIEW"), async (req, res, next) => {
  try {
    const scope = { clientId: req.losUser!.clientId, projectId: req.losUser!.projectId };
    const statuses = await prisma.ticketStatus.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });

    const [total, byStatus, myOpen, assignedToMe, recentlyCreated, recentlyUpdated, highPriority, slaBreached] = await Promise.all([
      prisma.ticket.count({ where: scope }),
      Promise.all(
        statuses.map(async (s) => ({ status: s.name, count: await prisma.ticket.count({ where: { ...scope, statusId: s.id } }) }))
      ),
      prisma.ticket.count({ where: { ...scope, createdById: req.losUser!.userMappingId, status: { isClosed: false } } }),
      prisma.ticket.count({ where: { ...scope, assignedToId: req.losUser!.userMappingId, status: { isClosed: false } } }),
      prisma.ticket.findMany({ where: scope, orderBy: { createdAt: "desc" }, take: 5, include: { status: true, priority: true } }),
      prisma.ticket.findMany({ where: scope, orderBy: { updatedAt: "desc" }, take: 5, include: { status: true, priority: true } }),
      prisma.ticket.count({ where: { ...scope, priority: { name: { in: ["High", "Critical"] } }, status: { isClosed: false } } }),
      prisma.ticket.count({ where: { ...scope, slaBreached: true, status: { isClosed: false } } }),
    ]);

    res.json({
      total,
      byStatus,
      myOpenTickets: myOpen,
      assignedToMe,
      recentlyCreated: recentlyCreated.map((t) => ({ id: t.id, ticketNumber: t.ticketNumber, subject: t.subject, status: t.status.name, priority: t.priority.name })),
      recentlyUpdated: recentlyUpdated.map((t) => ({ id: t.id, ticketNumber: t.ticketNumber, subject: t.subject, status: t.status.name, priority: t.priority.name })),
      highPriorityOpen: highPriority,
      slaBreached,
    });
  } catch (err) {
    next(err);
  }
});

dashboardRouter.get("/user-wise", requirePermission("REPORTS_VIEW"), async (req, res, next) => {
  try {
    const scope = { clientId: req.losUser!.clientId, projectId: req.losUser!.projectId };
    const users = await prisma.losUserMapping.findMany({ where: { clientId: req.losUser!.clientId, projectId: req.losUser!.projectId, active: true } });
    const rows = await Promise.all(
      users.map(async (u) => {
        const [total, open, pending, resolved, closed] = await Promise.all([
          prisma.ticket.count({ where: { ...scope, createdById: u.id } }),
          prisma.ticket.count({ where: { ...scope, createdById: u.id, status: { name: "Open" } } }),
          prisma.ticket.count({ where: { ...scope, createdById: u.id, status: { name: { startsWith: "Pending" } } } }),
          prisma.ticket.count({ where: { ...scope, createdById: u.id, status: { name: "Resolved" } } }),
          prisma.ticket.count({ where: { ...scope, createdById: u.id, status: { isClosed: true } } }),
        ]);
        return { user: u.displayName, total, open, pending, resolved, closed };
      })
    );
    res.json(rows.filter((r) => r.total > 0));
  } catch (err) {
    next(err);
  }
});

dashboardRouter.get("/assignee-wise", requirePermission("REPORTS_VIEW"), async (req, res, next) => {
  try {
    const scope = { clientId: req.losUser!.clientId, projectId: req.losUser!.projectId };
    const assignees = await prisma.assigneeMapping.findMany({ where: { projectId: req.losUser!.projectId, active: true } });
    const rows = await Promise.all(
      assignees.map(async (a) => {
        const mapping = await prisma.losUserMapping.findFirst({ where: { projectId: req.losUser!.projectId, redmineUserId: a.redmineUserId } });
        if (!mapping) return { assignee: a.displayName, open: 0, inProgress: 0, pending: 0, resolved: 0 };
        const [open, inProgress, pending, resolved] = await Promise.all([
          prisma.ticket.count({ where: { ...scope, assignedToId: mapping.id, status: { name: "Open" } } }),
          prisma.ticket.count({ where: { ...scope, assignedToId: mapping.id, status: { name: "In Progress" } } }),
          prisma.ticket.count({ where: { ...scope, assignedToId: mapping.id, status: { name: { startsWith: "Pending" } } } }),
          prisma.ticket.count({ where: { ...scope, assignedToId: mapping.id, status: { name: "Resolved" } } }),
        ]);
        return { assignee: a.displayName, open, inProgress, pending, resolved };
      })
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

dashboardRouter.get("/project-wise", requirePermission("REPORTS_VIEW"), async (req, res, next) => {
  try {
    // Scoped to the current project only - project-wise here means module-wise breakdown
    // within the isolated project, since a user never sees another project's data.
    const modules = await prisma.ticketModule.findMany({ where: { active: true } });
    const rows = await Promise.all(
      modules.map(async (m) => ({
        module: m.name,
        count: await prisma.ticket.count({ where: { clientId: req.losUser!.clientId, projectId: req.losUser!.projectId, moduleId: m.id } }),
      }))
    );
    res.json(rows.filter((r) => r.count > 0));
  } catch (err) {
    next(err);
  }
});
