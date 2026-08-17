import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { env } from "../config/env";
import { redmineClient, RedmineIssue } from "../services/redmineClient";
import { ApiError } from "../middleware/errorHandler";
import { validateUploadedFile } from "../utils/fileValidation";

// Deliberately unauthenticated: this router talks straight to Redmine (through the
// backend, so the Redmine API key never reaches the browser) with no login, no
// session, no client/project isolation. Anyone who can reach these routes can create,
// assign, and update real Redmine issues - only appropriate because the operator
// chose not to gate this URL behind any access control. Do not link this from, or
// confuse it with, the LOS-facing /api/* routes, which remain fully authenticated.
export const openRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: env.maxUploadBytes } });

function serializeIssue(issue: RedmineIssue) {
  return {
    id: issue.id,
    project: issue.project,
    tracker: issue.tracker,
    status: issue.status,
    priority: issue.priority,
    author: issue.author,
    assignedTo: issue.assigned_to ?? null,
    subject: issue.subject,
    description: issue.description,
    createdOn: issue.created_on,
    updatedOn: issue.updated_on,
    closedOn: issue.closed_on ?? null,
    comments: (issue.journals ?? [])
      .filter((j) => j.notes)
      .map((j) => ({ id: j.id, author: j.user.name, body: j.notes, createdOn: j.created_on })),
    attachments: (issue.attachments ?? []).map((a) => ({
      id: a.id,
      fileName: a.filename,
      fileSize: a.filesize,
      contentType: a.content_type,
      downloadUrl: a.content_url,
      createdOn: a.created_on,
    })),
  };
}

// Public, non-secret info only (never the API key) - lets a static frontend build a
// "view in Redmine" link without hardcoding the Redmine host.
openRouter.get("/config", (_req, res) => {
  res.json({ redmineBaseUrl: env.redmineBaseUrl.replace(/\/$/, "") });
});

function slimIssue(issue: RedmineIssue) {
  return {
    id: issue.id,
    project: { name: issue.project.name },
    tracker: { name: issue.tracker.name },
    status: { name: issue.status.name },
    assigned_to: issue.assigned_to ? { name: issue.assigned_to.name } : null,
    subject: issue.subject,
    created_on: issue.created_on,
    due_date: issue.due_date ?? null,
  };
}

const ALL_ISSUES_CACHE_TTL_MS = 30_000;
let allIssuesCache: { data: ReturnType<typeof slimIssue>[]; expiresAt: number } | null = null;

// Cross-project dashboard feed. Cached briefly since this is unauthenticated and a
// full cross-project pull can be a lot of paginated Redmine requests.
openRouter.get("/issues/all", async (_req, res, next) => {
  try {
    if (allIssuesCache && allIssuesCache.expiresAt > Date.now()) {
      return res.json(allIssuesCache.data);
    }
    const issues = await redmineClient.getAllIssues();
    const slim = issues.map(slimIssue);
    allIssuesCache = { data: slim, expiresAt: Date.now() + ALL_ISSUES_CACHE_TTL_MS };
    res.json(slim);
  } catch (err) {
    next(err);
  }
});

openRouter.get("/projects", async (_req, res, next) => {
  try {
    res.json(await redmineClient.getProjects());
  } catch (err) {
    next(err);
  }
});

openRouter.get("/users", async (_req, res, next) => {
  try {
    res.json(await redmineClient.getUsers());
  } catch (err) {
    next(err);
  }
});

// Assignee candidates for a specific project - works for any account with access to
// the project, unlike /users.json which requires a Redmine admin API key.
openRouter.get("/projects/:projectId/members", async (req, res, next) => {
  try {
    const projectId = Number(req.params.projectId);
    if (!projectId) throw new ApiError(400, "INVALID_REQUEST", "Invalid projectId.");
    res.json(await redmineClient.getProjectMembers(projectId));
  } catch (err) {
    next(err);
  }
});

openRouter.get("/trackers", async (_req, res, next) => {
  try {
    res.json(await redmineClient.getTrackers());
  } catch (err) {
    next(err);
  }
});

openRouter.get("/statuses", async (_req, res, next) => {
  try {
    res.json(await redmineClient.getIssueStatuses());
  } catch (err) {
    next(err);
  }
});

openRouter.get("/priorities", async (_req, res, next) => {
  try {
    res.json(await redmineClient.getIssuePriorities());
  } catch (err) {
    next(err);
  }
});

openRouter.get("/issues", async (req, res, next) => {
  try {
    const projectId = Number(req.query.projectId);
    if (!projectId) throw new ApiError(400, "INVALID_REQUEST", "projectId query parameter is required.");
    const issues = await redmineClient.getProjectIssues(projectId);
    res.json(issues.map(serializeIssue));
  } catch (err) {
    next(err);
  }
});

openRouter.get("/issues/:id", async (req, res, next) => {
  try {
    const issue = await redmineClient.getIssue(Number(req.params.id));
    res.json(serializeIssue(issue));
  } catch (err) {
    next(err);
  }
});

const createSchema = z.object({
  projectId: z.number().int(),
  subject: z.string().min(1).max(255),
  description: z.string().max(10000).default(""),
  trackerId: z.number().int().optional(),
  priorityId: z.number().int().optional(),
  assignedToId: z.number().int().optional(),
});

openRouter.post("/issues", async (req, res, next) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "INVALID_REQUEST", parsed.error.errors.map((e) => e.message).join(", "));

    const issue = await redmineClient.createIssue({
      projectId: parsed.data.projectId,
      subject: parsed.data.subject,
      description: parsed.data.description,
      priorityId: parsed.data.priorityId,
      assignedToId: parsed.data.assignedToId,
    });

    if (parsed.data.trackerId) {
      await redmineClient.updateIssue(issue.id, { tracker_id: parsed.data.trackerId });
    }

    allIssuesCache = null;
    res.status(201).json({ id: issue.id });
  } catch (err) {
    next(err);
  }
});

const updateSchema = z.object({
  subject: z.string().min(1).max(255).optional(),
  description: z.string().max(10000).optional(),
  statusId: z.number().int().optional(),
  priorityId: z.number().int().optional(),
  assignedToId: z.number().int().nullable().optional(),
  trackerId: z.number().int().optional(),
  notes: z.string().max(5000).optional(),
});

openRouter.put("/issues/:id", async (req, res, next) => {
  try {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "INVALID_REQUEST", parsed.error.errors.map((e) => e.message).join(", "));

    const fields: Record<string, unknown> = {};
    if (parsed.data.subject !== undefined) fields.subject = parsed.data.subject;
    if (parsed.data.description !== undefined) fields.description = parsed.data.description;
    if (parsed.data.statusId !== undefined) fields.status_id = parsed.data.statusId;
    if (parsed.data.priorityId !== undefined) fields.priority_id = parsed.data.priorityId;
    if (parsed.data.assignedToId !== undefined) fields.assigned_to_id = parsed.data.assignedToId;
    if (parsed.data.trackerId !== undefined) fields.tracker_id = parsed.data.trackerId;

    await redmineClient.updateIssue(Number(req.params.id), fields, parsed.data.notes);
    allIssuesCache = null;
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

openRouter.post("/issues/:id/comments", async (req, res, next) => {
  try {
    const parsed = z.object({ body: z.string().min(1).max(5000) }).safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "INVALID_REQUEST", "Comment body is required.");
    await redmineClient.addComment(Number(req.params.id), parsed.data.body);
    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

openRouter.post("/issues/:id/attachments", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) throw new ApiError(400, "NO_FILE", "No file was uploaded.");
    const validation = validateUploadedFile(req.file.originalname, req.file.mimetype, req.file.size, env.maxUploadBytes);
    if (!validation.ok) throw new ApiError(400, "INVALID_FILE", validation.reason);

    const uploaded = await redmineClient.uploadAttachment(req.file.buffer, req.file.originalname, req.file.mimetype);
    await redmineClient.attachUploadToIssue(Number(req.params.id), uploaded.token, req.file.originalname, req.file.mimetype);
    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});
