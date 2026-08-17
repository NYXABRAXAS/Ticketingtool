import { prisma } from "../db/prisma";
import { redmineClient } from "./redmineClient";
import { computeSlaDueAt } from "./slaService";
import { logger } from "../utils/logger";
import { ApiError } from "../middleware/errorHandler";

interface TicketScope {
  userMappingId: string;
  clientId: string;
  projectId: string;
}

async function nextTicketNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `TKT-${year}-`;
  const count = await prisma.ticket.count({ where: { ticketNumber: { startsWith: prefix } } });
  let seq = count + 1;
  // Retry on the rare race where two creates land on the same sequence number.
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = `${prefix}${String(seq).padStart(6, "0")}`;
    const exists = await prisma.ticket.findUnique({ where: { ticketNumber: candidate } });
    if (!exists) return candidate;
    seq += 1;
  }
  throw new ApiError(500, "TICKET_NUMBER_GENERATION_FAILED", "Could not allocate a ticket number, please retry.");
}

export interface CreateTicketInput {
  ticketTypeName: string;
  moduleName: string;
  priorityName: string;
  subject: string;
  description: string;
  environment: string;
  applicationNumber?: string;
  loanNumber?: string;
  assignedToRedmineUserId?: number;
  losContext?: Record<string, string | undefined>;
}

export const ticketService = {
  async createTicket(scope: TicketScope, input: CreateTicketInput) {
    const [project, ticketType, module, priority, openStatus] = await Promise.all([
      prisma.project.findUnique({ where: { id: scope.projectId } }),
      prisma.ticketType.findFirst({ where: { name: input.ticketTypeName, active: true } }),
      prisma.ticketModule.findFirst({ where: { name: input.moduleName, active: true } }),
      prisma.ticketPriority.findFirst({ where: { name: input.priorityName, active: true } }),
      prisma.ticketStatus.findFirst({ where: { name: "Open", active: true } }),
    ]);
    if (!project) throw new ApiError(403, "PROJECT_DENIED", "Invalid project.");
    if (!ticketType) throw new ApiError(400, "INVALID_TYPE", "Invalid or disabled ticket type.");
    if (!module) throw new ApiError(400, "INVALID_MODULE", "Invalid or disabled module.");
    if (!priority) throw new ApiError(400, "INVALID_PRIORITY", "Invalid or disabled priority.");
    if (!openStatus) throw new ApiError(500, "CONFIG_ERROR", "Default 'Open' status is not configured.");

    let assignedTo = null;
    if (input.assignedToRedmineUserId) {
      const allowed = await prisma.assigneeMapping.findFirst({
        where: { projectId: scope.projectId, redmineUserId: input.assignedToRedmineUserId, active: true },
      });
      if (!allowed) throw new ApiError(400, "INVALID_ASSIGNEE", "Selected assignee is not authorized for this project.");
      assignedTo = await prisma.losUserMapping.findFirst({
        where: { clientId: scope.clientId, projectId: scope.projectId, redmineUserId: input.assignedToRedmineUserId },
      });
    }

    const ticketNumber = await nextTicketNumber();
    const slaDueAt = await computeSlaDueAt(scope.projectId, priority.id);

    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        clientId: scope.clientId,
        projectId: scope.projectId,
        createdById: scope.userMappingId,
        assignedToId: assignedTo?.id,
        ticketTypeId: ticketType.id,
        moduleId: module.id,
        priorityId: priority.id,
        statusId: openStatus.id,
        subject: input.subject,
        description: input.description,
        environment: input.environment,
        applicationNumber: input.applicationNumber,
        loanNumber: input.loanNumber,
        losContext: input.losContext as any,
        slaDueAt,
        syncStatus: "PENDING_SYNC",
      },
    });

    await prisma.ticketHistory.create({
      data: { ticketId: ticket.id, actorId: scope.userMappingId, action: "CREATE", toValue: ticketNumber },
    });

    // Fire-and-forget sync to Redmine; on failure the ticket stays PENDING_SYNC and the
    // background sync job (see syncService) retries without creating a duplicate issue.
    void this.syncTicketToRedmine(ticket.id).catch((err) => logger.error("initial_sync_failed", { ticketId: ticket.id, message: err.message }));

    return ticket;
  },

  async syncTicketToRedmine(ticketId: string) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { project: true, priority: true, createdBy: true, assignedTo: true },
    });
    if (!ticket || ticket.redmineIssueId) return; // already synced - never create a duplicate

    try {
      const issue = await redmineClient.createIssue({
        projectId: ticket.project.redmineProjectId,
        subject: `[${ticket.ticketNumber}] ${ticket.subject}`,
        description: ticket.description,
        priorityId: ticket.priority.redminePriorityId ?? undefined,
        assignedToId: ticket.assignedTo?.redmineUserId ?? undefined,
      });
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { redmineIssueId: issue.id, syncStatus: "SYNCED", lastSyncedAt: new Date(), syncError: null },
      });
      await prisma.ticketHistory.create({ data: { ticketId: ticket.id, action: "SYNC", toValue: `Redmine #${issue.id}` } });
    } catch (err: any) {
      await prisma.ticket.update({ where: { id: ticket.id }, data: { syncStatus: "SYNC_FAILED", syncError: err.message?.slice(0, 500) } });
      throw err;
    }
  },

  async assertVisible(scope: TicketScope, ticketId: string) {
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket || ticket.clientId !== scope.clientId || ticket.projectId !== scope.projectId) {
      // Deliberately identical to a plain 404 so guessing another tenant's ticket id
      // (or hand-editing the client/project in a request) cannot be used to probe existence.
      throw new ApiError(404, "NOT_FOUND", "Ticket not found.");
    }
    return ticket;
  },

  async listTickets(
    scope: TicketScope,
    filters: {
      status?: string;
      priority?: string;
      ticketType?: string;
      module?: string;
      createdById?: string;
      assignedToId?: string;
      environment?: string;
      dateFrom?: string;
      dateTo?: string;
      search?: string;
      page?: number;
      pageSize?: number;
    }
  ) {
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 25));

    const where: any = { clientId: scope.clientId, projectId: scope.projectId };
    if (filters.status) where.status = { name: filters.status };
    if (filters.priority) where.priority = { name: filters.priority };
    if (filters.ticketType) where.ticketType = { name: filters.ticketType };
    if (filters.module) where.module = { name: filters.module };
    if (filters.createdById) where.createdById = filters.createdById;
    if (filters.assignedToId) where.assignedToId = filters.assignedToId;
    if (filters.environment) where.environment = filters.environment;
    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo);
    }
    if (filters.search) {
      const term = filters.search.trim();
      where.OR = [
        { ticketNumber: { contains: term, mode: "insensitive" } },
        { subject: { contains: term, mode: "insensitive" } },
        { description: { contains: term, mode: "insensitive" } },
        { applicationNumber: { contains: term, mode: "insensitive" } },
        { loanNumber: { contains: term, mode: "insensitive" } },
        ...(Number.isFinite(Number(term)) ? [{ redmineIssueId: Number(term) }] : []),
      ];
    }

    const [items, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        include: { ticketType: true, module: true, priority: true, status: true, createdBy: true, assignedTo: true },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.ticket.count({ where }),
    ]);

    return { items, total, page, pageSize };
  },

  async getTicketDetail(scope: TicketScope, ticketId: string) {
    await this.assertVisible(scope, ticketId);
    return prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        ticketType: true,
        module: true,
        priority: true,
        status: true,
        createdBy: true,
        assignedTo: true,
        comments: { include: { author: true }, orderBy: { createdAt: "asc" } },
        attachments: { include: { uploadedBy: true }, orderBy: { createdAt: "asc" } },
        history: { include: { actor: true }, orderBy: { createdAt: "asc" } },
      },
    });
  },

  async updateTicketFields(
    scope: TicketScope,
    ticketId: string,
    actorId: string,
    fields: Partial<Pick<CreateTicketInput, "subject" | "description" | "environment" | "applicationNumber" | "loanNumber">> & {
      ticketTypeName?: string;
      moduleName?: string;
    }
  ) {
    const ticket = await this.assertVisible(scope, ticketId);
    const data: any = {};
    if (fields.subject !== undefined) data.subject = fields.subject;
    if (fields.description !== undefined) data.description = fields.description;
    if (fields.environment !== undefined) data.environment = fields.environment;
    if (fields.applicationNumber !== undefined) data.applicationNumber = fields.applicationNumber;
    if (fields.loanNumber !== undefined) data.loanNumber = fields.loanNumber;
    if (fields.ticketTypeName) {
      const t = await prisma.ticketType.findFirst({ where: { name: fields.ticketTypeName, active: true } });
      if (!t) throw new ApiError(400, "INVALID_TYPE", "Invalid ticket type.");
      data.ticketTypeId = t.id;
    }
    if (fields.moduleName) {
      const m = await prisma.ticketModule.findFirst({ where: { name: fields.moduleName, active: true } });
      if (!m) throw new ApiError(400, "INVALID_MODULE", "Invalid module.");
      data.moduleId = m.id;
    }

    const updated = await prisma.ticket.update({ where: { id: ticket.id }, data });
    await prisma.ticketHistory.create({ data: { ticketId: ticket.id, actorId, action: "EDIT" } });

    if (ticket.redmineIssueId) {
      void redmineClient
        .updateIssue(ticket.redmineIssueId, { subject: data.subject ? `[${ticket.ticketNumber}] ${data.subject}` : undefined, description: data.description })
        .catch((err) => logger.error("redmine_sync_edit_failed", { ticketId: ticket.id, message: err.message }));
    }
    return updated;
  },

  async assign(scope: TicketScope, ticketId: string, actorId: string, redmineUserId: number, isReassign: boolean, reason?: string) {
    const ticket = await this.assertVisible(scope, ticketId);
    const allowed = await prisma.assigneeMapping.findFirst({ where: { projectId: scope.projectId, redmineUserId, active: true } });
    if (!allowed) throw new ApiError(400, "INVALID_ASSIGNEE", "Selected assignee is not authorized for this project.");

    const newAssignee = await prisma.losUserMapping.findFirst({ where: { clientId: scope.clientId, projectId: scope.projectId, redmineUserId } });
    const oldAssigneeId = ticket.assignedToId;

    const updated = await prisma.ticket.update({ where: { id: ticket.id }, data: { assignedToId: newAssignee?.id ?? null } });
    await prisma.ticketHistory.create({
      data: {
        ticketId: ticket.id,
        actorId,
        action: isReassign ? "REASSIGN" : "ASSIGN",
        fromValue: oldAssigneeId ?? undefined,
        toValue: allowed.displayName,
        reason,
      },
    });

    if (ticket.redmineIssueId) {
      void redmineClient.assignIssue(ticket.redmineIssueId, redmineUserId).catch((err) => logger.error("redmine_sync_assign_failed", { ticketId: ticket.id, message: err.message }));
    }
    return updated;
  },

  async changeStatus(scope: TicketScope, ticketId: string, actorId: string, statusName: string, notes?: string) {
    const ticket = await this.assertVisible(scope, ticketId);
    const currentStatus = await prisma.ticketStatus.findUnique({ where: { id: ticket.statusId } });
    const newStatus = await prisma.ticketStatus.findFirst({ where: { name: statusName, active: true } });
    if (!newStatus) throw new ApiError(400, "INVALID_STATUS", "Invalid status.");

    if (currentStatus) {
      const transitionAllowed = await prisma.statusTransition.findFirst({ where: { fromStatusId: currentStatus.id, toStatusId: newStatus.id } });
      if (!transitionAllowed && currentStatus.id !== newStatus.id) {
        throw new ApiError(409, "INVALID_TRANSITION", `Cannot move a ticket from '${currentStatus.name}' to '${newStatus.name}'.`);
      }
    }

    const data: any = { statusId: newStatus.id };
    if (newStatus.name === "Resolved") data.resolvedAt = new Date();
    if (newStatus.isClosed) data.closedAt = new Date();

    const updated = await prisma.ticket.update({ where: { id: ticket.id }, data });
    await prisma.ticketHistory.create({
      data: {
        ticketId: ticket.id,
        actorId,
        action: newStatus.isClosed ? "CLOSE" : newStatus.name === "Resolved" ? "RESOLVE" : newStatus.name === "Reopened" ? "REOPEN" : "STATUS_CHANGE",
        fromValue: currentStatus?.name,
        toValue: newStatus.name,
        reason: notes,
      },
    });

    if (ticket.redmineIssueId && newStatus.redmineStatusId) {
      void redmineClient.updateStatus(ticket.redmineIssueId, newStatus.redmineStatusId, notes).catch((err) => logger.error("redmine_sync_status_failed", { ticketId: ticket.id, message: err.message }));
    }
    return updated;
  },

  async changePriority(scope: TicketScope, ticketId: string, actorId: string, priorityName: string) {
    const ticket = await this.assertVisible(scope, ticketId);
    const currentPriority = await prisma.ticketPriority.findUnique({ where: { id: ticket.priorityId } });
    const newPriority = await prisma.ticketPriority.findFirst({ where: { name: priorityName, active: true } });
    if (!newPriority) throw new ApiError(400, "INVALID_PRIORITY", "Invalid priority.");

    const slaDueAt = await computeSlaDueAt(scope.projectId, newPriority.id, ticket.createdAt);
    const updated = await prisma.ticket.update({ where: { id: ticket.id }, data: { priorityId: newPriority.id, slaDueAt } });
    await prisma.ticketHistory.create({
      data: { ticketId: ticket.id, actorId, action: "PRIORITY_CHANGE", fromValue: currentPriority?.name, toValue: newPriority.name },
    });

    if (ticket.redmineIssueId && newPriority.redminePriorityId) {
      void redmineClient.updatePriority(ticket.redmineIssueId, newPriority.redminePriorityId).catch((err) => logger.error("redmine_sync_priority_failed", { ticketId: ticket.id, message: err.message }));
    }
    return updated;
  },

  async addComment(scope: TicketScope, ticketId: string, actorId: string, body: string) {
    const ticket = await this.assertVisible(scope, ticketId);
    const comment = await prisma.ticketComment.create({ data: { ticketId: ticket.id, authorId: actorId, body, source: "TICKETING_TOOL" } });
    await prisma.ticketHistory.create({ data: { ticketId: ticket.id, actorId, action: "COMMENT" } });

    if (ticket.redmineIssueId) {
      void redmineClient.addComment(ticket.redmineIssueId, body).catch((err) => logger.error("redmine_sync_comment_failed", { ticketId: ticket.id, message: err.message }));
    }
    return comment;
  },

  async addAttachmentRecord(
    scope: TicketScope,
    ticketId: string,
    actorId: string,
    file: { fileName: string; fileSize: number; mimeType: string; redmineAttachmentId?: number; redmineDownloadUrl?: string }
  ) {
    const ticket = await this.assertVisible(scope, ticketId);
    const attachment = await prisma.ticketAttachment.create({
      data: {
        ticketId: ticket.id,
        uploadedById: actorId,
        fileName: file.fileName,
        fileSize: file.fileSize,
        mimeType: file.mimeType,
        redmineAttachmentId: file.redmineAttachmentId,
        redmineDownloadUrl: file.redmineDownloadUrl,
      },
    });
    await prisma.ticketHistory.create({ data: { ticketId: ticket.id, actorId, action: "ATTACHMENT", toValue: file.fileName } });
    return attachment;
  },
};
