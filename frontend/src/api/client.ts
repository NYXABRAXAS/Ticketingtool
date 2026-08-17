const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export class ApiClientError extends Error {
  status: number;
  code: string;
  referenceId?: string;
  constructor(status: number, code: string, message: string, referenceId?: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.referenceId = referenceId;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  if (!res.ok) {
    let body: any = {};
    try {
      body = await res.json();
    } catch {
      // non-JSON error body
    }
    throw new ApiClientError(res.status, body.error ?? "UNKNOWN_ERROR", body.message ?? "Something went wrong.", body.referenceId);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  upload: <T>(path: string, form: FormData) => request<T>(path, { method: "POST", body: form }),
};
