import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { env } from "../config/env";
import { requireLosSession, requirePermission } from "../middleware/auth";
import { ApiError } from "../middleware/errorHandler";
import { ticketService } from "../services/ticketService";
import { redmineClient } from "../services/redmineClient";
import { validateUploadedFile } from "../utils/fileValidation";
import { slaState } from "../services/slaService";

export const ticketsRouter = Router();
ticketsRouter.use(requireLosSession);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: env.maxUploadBytes } });

function serializeTicket(t: any) {
  return {
    id: t.id,
    ticketNumber: t.ticketNumber,
    redmineIssueId: t.redmineIssueId,
    subject: t.subject,
    description: t.description,
    ticketType: t.ticketType?.name,
    module: t.module?.name,
    priority: t.priority?.name,
    status: t.status?.name,
    environment: t.environment,
    applicationNumber: t.applicationNumber,
    loanNumber: t.loanNumber,
    createdBy: t.createdBy ? { id: t.createdBy.id, name: t.createdBy.displayName } : null,
    assignedTo: t.assignedTo ? { id: t.assignedTo.id, name: t.assignedTo.displayName } : null,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    resolvedAt: t.resolvedAt,
    closedAt: t.closedAt,
    slaDueAt: t.slaDueAt,
    slaState: slaState(t.slaDueAt, Boolean(t.closedAt)),
    syncStatus: t.syncStatus,
  };
}

ticketsRouter.get("/", requirePermission("TICKET_VIEW"), async (req, res, next) => {
  try {
    const q = req.query;
    const result = await ticketService.listTickets(
      { userMappingId: req.losUser!.userMappingId, clientId: req.losUser!.clientId, projectId: req.losUser!.projectId },
      {
        status: q.status as string,
        priority: q.priority as string,
        ticketType: q.ticketType as string,
        module: q.module as string,
        createdById: q.createdBy as string,
        assignedToId: q.assignedTo as string,
        environment: q.environment as string,
        dateFrom: q.dateFrom as string,
        dateTo: q.dateTo as string,
        search: q.search as string,
        page: q.page ? Number(q.page) : undefined,
        pageSize: q.pageSize ? Number(q.pageSize) : undefined,
      }
    );
    res.json({ ...result, items: result.items.map(serializeTicket) });
  } catch (err) {
    next(err);
  }
});

ticketsRouter.get("/mine", requirePermission("TICKET_VIEW"), async (req, res, next) => {
  try {
    const result = await ticketService.listTickets(
      { userMappingId: req.losUser!.userMappingId, clientId: req.losUser!.clientId, projectId: req.losUser!.projectId },
      { createdById: req.losUser!.userMappingId, page: req.query.page ? Number(req.query.page) : undefined }
    );
    res.json({ ...result, items: result.items.map(serializeTicket) });
  } catch (err) {
    next(err);
  }
});

ticketsRouter.get("/assigned-to-me", requirePermission("TICKET_VIEW"), async (req, res, next) => {
  try {
    const result = await ticketService.listTickets(
      { userMappingId: req.losUser!.userMappingId, clientId: req.losUser!.clientId, projectId: req.losUser!.projectId },
      { assignedToId: req.losUser!.userMappingId, page: req.query.page ? Number(req.query.page) : undefined }
    );
    res.json({ ...result, items: result.items.map(serializeTicket) });
  } catch (err) {
    next(err);
  }
});

const createSchema = z.object({
  ticketType: z.string().min(1),
  module: z.string().min(1),
  priority: z.string().min(1),
  subject: z.string().min(3).max(255),
  description: z.string().min(1).max(10000),
  environment: z.enum(["Development", "UAT", "Production"]),
  applicationNumber: z.string().max(64).optional(),
  loanNumber: z.string().max(64).optional(),
  assignedToRedmineUserId: z.number().int().optional(),
  losContext: z.record(z.string().optional()).optional(),
});

ticketsRouter.post("/", requirePermission("TICKET_CREATE"), async (req, res, next) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "INVALID_REQUEST", parsed.error.errors.map((e) => e.message).join(", "));

    const ticket = await ticketService.createTicket(
      { userMappingId: req.losUser!.userMappingId, clientId: req.losUser!.clientId, projectId: req.losUser!.projectId },
      {
        ticketTypeName: parsed.data.ticketType,
        moduleName: parsed.data.module,
        priorityName: parsed.data.priority,
        subject: parsed.data.subject,
        description: parsed.data.description,
        environment: parsed.data.environment,
        applicationNumber: parsed.data.applicationNumber,
        loanNumber: parsed.data.loanNumber,
        assignedToRedmineUserId: parsed.data.assignedToRedmineUserId,
        losContext: parsed.data.losContext,
      }
    );
    res.status(201).json({ id: ticket.id, ticketNumber: ticket.ticketNumber });
  } catch (err) {
    next(err);
  }
});

ticketsRouter.get("/:id", requirePermission("TICKET_VIEW"), async (req, res, next) => {
  try {
    const ticket = await ticketService.getTicketDetail(
      { userMappingId: req.losUser!.userMappingId, clientId: req.losUser!.clientId, projectId: req.losUser!.projectId },
      req.params.id
    );
    if (!ticket) throw new ApiError(404, "NOT_FOUND", "Ticket not found.");
    res.json({
      ...serializeTicket(ticket),
      comments: ticket.comments.map((c) => ({ id: c.id, body: c.body, author: c.author.displayName, source: c.source, createdAt: c.createdAt })),
      attachments: ticket.attachments.map((a) => ({
        id: a.id,
        fileName: a.fileName,
        fileSize: a.fileSize,
        uploadedBy: a.uploadedBy.displayName,
        createdAt: a.createdAt,
        downloadUrl: a.redmineDownloadUrl,
      })),
      history: ticket.history.map((h) => ({ id: h.id, action: h.action, fromValue: h.fromValue, toValue: h.toValue, reason: h.reason, actor: h.actor?.displayName ?? "System", createdAt: h.createdAt })),
    });
  } catch (err) {
    next(err);
  }
});

const editSchema = z.object({
  subject: z.string().min(3).max(255).optional(),
  description: z.string().min(1).max(10000).optional(),
  environment: z.enum(["Development", "UAT", "Production"]).optional(),
  applicationNumber: z.string().max(64).optional(),
  loanNumber: z.string().max(64).optional(),
  ticketType: z.string().optional(),
  module: z.string().optional(),
});

ticketsRouter.put("/:id", requirePermission("TICKET_EDIT"), async (req, res, next) => {
  try {
    const parsed = editSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "INVALID_REQUEST", parsed.error.errors.map((e) => e.message).join(", "));
    const updated = await ticketService.updateTicketFields(
      { userMappingId: req.losUser!.userMappingId, clientId: req.losUser!.clientId, projectId: req.losUser!.projectId },
      req.params.id,
      req.losUser!.userMappingId,
      { ...parsed.data, ticketTypeName: parsed.data.ticketType, moduleName: parsed.data.module }
    );
    res.json(serializeTicket(updated));
  } catch (err) {
    next(err);
  }
});

const commentSchema = z.object({ body: z.string().min(1).max(5000) });

ticketsRouter.post("/:id/comments", requirePermission("TICKET_COMMENT"), async (req, res, next) => {
  try {
    const parsed = commentSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "INVALID_REQUEST", "Comment body is required.");
    const comment = await ticketService.addComment(
      { userMappingId: req.losUser!.userMappingId, clientId: req.losUser!.clientId, projectId: req.losUser!.projectId },
      req.params.id,
      req.losUser!.userMappingId,
      parsed.data.body
    );
    res.status(201).json(comment);
  } catch (err) {
    next(err);
  }
});

ticketsRouter.post("/:id/attachments", requirePermission("TICKET_ATTACHMENT"), upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) throw new ApiError(400, "NO_FILE", "No file was uploaded.");
    const validation = validateUploadedFile(req.file.originalname, req.file.mimetype, req.file.size, env.maxUploadBytes);
    if (!validation.ok) throw new ApiError(400, "INVALID_FILE", validation.reason);

    const scope = { userMappingId: req.losUser!.userMappingId, clientId: req.losUser!.clientId, projectId: req.losUser!.projectId };
    const ticket = await ticketService.assertVisible(scope, req.params.id);

    let redmineAttachmentId: number | undefined;
    let redmineDownloadUrl: string | undefined;
    if (ticket.redmineIssueId) {
      const uploaded = await redmineClient.uploadAttachment(req.file.buffer, req.file.originalname, req.file.mimetype);
      await redmineClient.attachUploadToIssue(ticket.redmineIssueId, uploaded.token, req.file.originalname, req.file.mimetype);
      redmineAttachmentId = uploaded.id;
    }

    const attachment = await ticketService.addAttachmentRecord(scope, req.params.id, req.losUser!.userMappingId, {
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      redmineAttachmentId,
      redmineDownloadUrl,
    });
    res.status(201).json(attachment);
  } catch (err) {
    next(err);
  }
});

const assignSchema = z.object({ redmineUserId: z.number().int(), reason: z.string().max(500).optional() });

ticketsRouter.put("/:id/assign", requirePermission("TICKET_ASSIGN"), async (req, res, next) => {
  try {
    const parsed = assignSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "INVALID_REQUEST", "redmineUserId is required.");
    const scope = { userMappingId: req.losUser!.userMappingId, clientId: req.losUser!.clientId, projectId: req.losUser!.projectId };
    const updated = await ticketService.assign(scope, req.params.id, req.losUser!.userMappingId, parsed.data.redmineUserId, false, parsed.data.reason);
    res.json(serializeTicket(updated));
  } catch (err) {
    next(err);
  }
});

ticketsRouter.put("/:id/reassign", requirePermission("TICKET_REASSIGN"), async (req, res, next) => {
  try {
    const parsed = assignSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "INVALID_REQUEST", "redmineUserId is required.");
    const scope = { userMappingId: req.losUser!.userMappingId, clientId: req.losUser!.clientId, projectId: req.losUser!.projectId };
    const updated = await ticketService.assign(scope, req.params.id, req.losUser!.userMappingId, parsed.data.redmineUserId, true, parsed.data.reason);
    res.json(serializeTicket(updated));
  } catch (err) {
    next(err);
  }
});

const statusSchema = z.object({ status: z.string().min(1), notes: z.string().max(1000).optional() });

ticketsRouter.put("/:id/status", requirePermission("TICKET_STATUS_CHANGE"), async (req, res, next) => {
  try {
    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "INVALID_REQUEST", "status is required.");
    if (parsed.data.status === "Closed" && !req.losUser!.permissions.includes("TICKET_CLOSE") && req.losUser!.role !== "INTERNAL_ADMIN") {
      throw new ApiError(403, "FORBIDDEN", "You are not authorized to close tickets.");
    }
    const scope = { userMappingId: req.losUser!.userMappingId, clientId: req.losUser!.clientId, projectId: req.losUser!.projectId };
    const updated = await ticketService.changeStatus(scope, req.params.id, req.losUser!.userMappingId, parsed.data.status, parsed.data.notes);
    res.json(serializeTicket(updated));
  } catch (err) {
    next(err);
  }
});

const prioritySchema = z.object({ priority: z.string().min(1) });

ticketsRouter.put("/:id/priority", requirePermission("TICKET_PRIORITY_CHANGE"), async (req, res, next) => {
  try {
    const parsed = prioritySchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "INVALID_REQUEST", "priority is required.");
    const scope = { userMappingId: req.losUser!.userMappingId, clientId: req.losUser!.clientId, projectId: req.losUser!.projectId };
    const updated = await ticketService.changePriority(scope, req.params.id, req.losUser!.userMappingId, parsed.data.priority);
    res.json(serializeTicket(updated));
  } catch (err) {
    next(err);
  }
});

ticketsRouter.get("/:id/history", requirePermission("TICKET_VIEW"), async (req, res, next) => {
  try {
    const scope = { userMappingId: req.losUser!.userMappingId, clientId: req.losUser!.clientId, projectId: req.losUser!.projectId };
    await ticketService.assertVisible(scope, req.params.id);
    const history = await prisma.ticketHistory.findMany({ where: { ticketId: req.params.id }, include: { actor: true }, orderBy: { createdAt: "asc" } });
    res.json(history.map((h) => ({ id: h.id, action: h.action, fromValue: h.fromValue, toValue: h.toValue, reason: h.reason, actor: h.actor?.displayName ?? "System", createdAt: h.createdAt })));
  } catch (err) {
    next(err);
  }
});
