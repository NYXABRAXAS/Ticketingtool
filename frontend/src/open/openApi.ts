const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}/api/open${path}`, {
    ...init,
    headers: {
      ...(init?.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    let message = "Request failed.";
    try {
      message = (await res.json()).message ?? message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export interface RedmineProjectOption { id: number; name: string; identifier: string }
export interface RedmineUserOption { id: number; firstname: string; lastname: string }
export interface RedmineOption { id: number; name: string }

export interface OpenIssue {
  id: number;
  project: { id: number; name: string };
  tracker: { id: number; name: string };
  status: { id: number; name: string };
  priority: { id: number; name: string };
  author: { id: number; name: string };
  assignedTo: { id: number; name: string } | null;
  subject: string;
  description: string;
  createdOn: string;
  updatedOn: string;
  closedOn: string | null;
  comments: { id: number; author: string; body: string; createdOn: string }[];
  attachments: { id: number; fileName: string; fileSize: number; contentType: string; downloadUrl: string; createdOn: string }[];
}

export const openApi = {
  getProjects: () => request<RedmineProjectOption[]>("/projects"),
  getUsers: () => request<RedmineUserOption[]>("/users"),
  getTrackers: () => request<RedmineOption[]>("/trackers"),
  getStatuses: () => request<RedmineOption[]>("/statuses"),
  getPriorities: () => request<RedmineOption[]>("/priorities"),
  getProjectMembers: (projectId: number) => request<RedmineOption[]>(`/projects/${projectId}/members`),
  getIssues: (projectId: number) => request<OpenIssue[]>(`/issues?projectId=${projectId}`),
  getIssue: (id: number) => request<OpenIssue>(`/issues/${id}`),
  createIssue: (body: { projectId: number; subject: string; description: string; trackerId?: number; priorityId?: number; assignedToId?: number }) =>
    request<{ id: number }>("/issues", { method: "POST", body: JSON.stringify(body) }),
  updateIssue: (id: number, body: Record<string, unknown>) => request<{ ok: true }>(`/issues/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  addComment: (id: number, body: string) => request<{ ok: true }>(`/issues/${id}/comments`, { method: "POST", body: JSON.stringify({ body }) }),
  uploadAttachment: (id: number, form: FormData) => request<{ ok: true }>(`/issues/${id}/attachments`, { method: "POST", body: form }),
};
