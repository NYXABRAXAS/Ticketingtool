import { env } from "../config/env";
import { logger } from "../utils/logger";

// All Redmine REST calls are centralized here. The API key is read once from
// process.env and is never returned to, or accepted from, any caller/request body.
// Nothing in this file is imported by frontend code.

export class RedmineError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

interface RedmineRequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  isForm?: boolean;
}

async function redmineRequest<T>(opts: RedmineRequestOptions): Promise<T> {
  const url = new URL(opts.path.replace(/^\//, ""), env.redmineBaseUrl.endsWith("/") ? env.redmineBaseUrl : env.redmineBaseUrl + "/");
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.redmineTimeoutMs);

  try {
    const res = await fetch(url.toString(), {
      method: opts.method ?? "GET",
      headers: {
        "X-Redmine-API-Key": env.redmineApiKey,
        ...(opts.body ? { "Content-Type": "application/json" } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    });

    if (res.status === 404) throw new RedmineError("Redmine resource not found", 404);
    if (res.status === 401 || res.status === 403) throw new RedmineError("Redmine authentication/authorization failed", res.status);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new RedmineError(`Redmine API error ${res.status}: ${text.slice(0, 300)}`, res.status);
    }

    if (res.status === 204) return {} as T;
    const text = await res.text();
    return (text ? JSON.parse(text) : {}) as T;
  } catch (err: any) {
    if (err.name === "AbortError") throw new RedmineError("Redmine request timed out");
    if (err instanceof RedmineError) throw err;
    throw new RedmineError(`Redmine request failed: ${err.message}`);
  } finally {
    clearTimeout(timeout);
  }
}

export interface RedmineIssue {
  id: number;
  project: { id: number; name: string };
  tracker: { id: number; name: string };
  status: { id: number; name: string };
  priority: { id: number; name: string };
  author: { id: number; name: string };
  assigned_to?: { id: number; name: string };
  subject: string;
  description: string;
  created_on: string;
  updated_on: string;
  closed_on?: string;
  journals?: RedmineJournal[];
  attachments?: RedmineAttachment[];
}

export interface RedmineJournal {
  id: number;
  user: { id: number; name: string };
  notes: string;
  created_on: string;
  details?: { property: string; name: string; old_value?: string; new_value?: string }[];
}

export interface RedmineAttachment {
  id: number;
  filename: string;
  filesize: number;
  content_type: string;
  content_url: string;
  created_on: string;
}

export interface RedmineProject {
  id: number;
  identifier: string;
  name: string;
  status: number;
}

export interface RedmineUser {
  id: number;
  login: string;
  firstname: string;
  lastname: string;
  mail?: string;
}

async function paginateAll<T>(path: string, key: string, query: Record<string, string | number | undefined> = {}): Promise<T[]> {
  const limit = 100;
  let offset = 0;
  const all: T[] = [];
  // Redmine collection endpoints only ever return a page at a time; we page until
  // total_count is exhausted rather than assuming a single response has everything.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const page = await redmineRequest<{ total_count: number } & Record<string, T[]>>({
      path,
      query: { ...query, limit, offset },
    });
    const items = page[key] as unknown as T[];
    all.push(...items);
    offset += limit;
    if (offset >= page.total_count || items.length === 0) break;
  }
  return all;
}

export const redmineClient = {
  async testConnection(): Promise<{ ok: boolean; message: string }> {
    try {
      await redmineRequest({ path: "users/current.json" });
      return { ok: true, message: "Connected to Redmine" };
    } catch (err: any) {
      logger.error("redmine_connection_test_failed", { message: err.message });
      return { ok: false, message: "Redmine connection failed" };
    }
  },

  async getProjects(): Promise<RedmineProject[]> {
    return paginateAll<RedmineProject>("projects.json", "projects");
  },

  async getUsers(): Promise<RedmineUser[]> {
    return paginateAll<RedmineUser>("users.json", "users");
  },

  async getIssue(redmineIssueId: number): Promise<RedmineIssue> {
    const data = await redmineRequest<{ issue: RedmineIssue }>({
      path: `issues/${redmineIssueId}.json`,
      query: { include: "journals,attachments" },
    });
    return data.issue;
  },

  async getProjectIssues(redmineProjectId: number, updatedSince?: string): Promise<RedmineIssue[]> {
    return paginateAll<RedmineIssue>("issues.json", "issues", {
      project_id: redmineProjectId,
      status_id: "*",
      ...(updatedSince ? { updated_on: `>=${updatedSince}` } : {}),
    });
  },

  async createIssue(params: {
    projectId: number;
    subject: string;
    description: string;
    trackerName?: string;
    priorityId?: number;
    assignedToId?: number;
    authorId?: number;
    customFields?: { id: number; value: string }[];
  }): Promise<RedmineIssue> {
    const data = await redmineRequest<{ issue: RedmineIssue }>({
      method: "POST",
      path: "issues.json",
      body: {
        issue: {
          project_id: params.projectId,
          subject: params.subject,
          description: params.description,
          priority_id: params.priorityId,
          assigned_to_id: params.assignedToId,
          custom_fields: params.customFields,
        },
      },
    });
    return data.issue;
  },

  async updateIssue(redmineIssueId: number, fields: Record<string, unknown>, notes?: string): Promise<void> {
    await redmineRequest({
      method: "PUT",
      path: `issues/${redmineIssueId}.json`,
      body: { issue: { ...fields, notes } },
    });
  },

  async assignIssue(redmineIssueId: number, assignedToRedmineUserId: number): Promise<void> {
    await this.updateIssue(redmineIssueId, { assigned_to_id: assignedToRedmineUserId });
  },

  async updateStatus(redmineIssueId: number, statusId: number, notes?: string): Promise<void> {
    await this.updateIssue(redmineIssueId, { status_id: statusId }, notes);
  },

  async updatePriority(redmineIssueId: number, priorityId: number): Promise<void> {
    await this.updateIssue(redmineIssueId, { priority_id: priorityId });
  },

  async addComment(redmineIssueId: number, notes: string): Promise<void> {
    await this.updateIssue(redmineIssueId, {}, notes);
  },

  // Two-step Redmine attachment flow: upload raw bytes to /uploads.json to get a token,
  // then attach that token to the issue via a normal update.
  async uploadAttachment(fileBuffer: Buffer, filename: string, contentType: string): Promise<{ token: string; id: number }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.redmineTimeoutMs);
    try {
      const url = new URL("uploads.json", env.redmineBaseUrl.endsWith("/") ? env.redmineBaseUrl : env.redmineBaseUrl + "/");
      url.searchParams.set("filename", filename);
      const res = await fetch(url.toString(), {
        method: "POST",
        headers: {
          "X-Redmine-API-Key": env.redmineApiKey,
          "Content-Type": "application/octet-stream",
        },
        body: fileBuffer,
        signal: controller.signal,
      });
      if (!res.ok) throw new RedmineError(`Redmine upload failed: ${res.status}`, res.status);
      const data = (await res.json()) as { upload: { id: number; token: string } };
      return data.upload;
    } finally {
      clearTimeout(timeout);
    }
  },

  async attachUploadToIssue(redmineIssueId: number, uploadToken: string, filename: string, contentType: string, description?: string): Promise<void> {
    await redmineRequest({
      method: "PUT",
      path: `issues/${redmineIssueId}.json`,
      body: {
        issue: {
          uploads: [{ token: uploadToken, filename, content_type: contentType, description }],
        },
      },
    });
  },
};
