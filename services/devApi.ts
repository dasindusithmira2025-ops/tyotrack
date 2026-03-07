const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

type RequestMethod = "GET" | "POST" | "PATCH" | "DELETE";

interface DevRequestOptions {
  method?: RequestMethod;
  body?: unknown;
}

async function devRequest<T>(path: string, options: DevRequestOptions = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || "Developer API request failed");
  }

  return payload.data as T;
}

export interface DevSession {
  email: string;
  role: "GOD";
  expiresAt?: number;
}

export interface DevResourceField {
  name: string;
  type: string;
  kind: string;
  isId: boolean;
  isUnique: boolean;
  isRequired: boolean;
  isList: boolean;
  hasDefaultValue: boolean;
  default: unknown;
  relationName: string | null;
  relationFromFields: string[];
  relationToFields: string[];
}

export interface DevResource {
  name: string;
  delegate: string;
  dbName: string;
  primaryKey: { field: string; type: string; required: boolean } | null;
  fields: DevResourceField[];
  relationFields: Array<{
    name: string;
    type: string;
    relationName: string | null;
    relationFromFields: string[];
    relationToFields: string[];
  }>;
}

export interface DevDataResponse {
  items: Array<Record<string, unknown>>;
  total: number;
  page: number;
  pageSize: number;
}

export const devApi = {
  login: async (email: string, password: string) =>
    devRequest<DevSession>("/api/dev/auth/login", {
      method: "POST",
      body: { email, password }
    }),

  logout: async () =>
    devRequest<{ success: boolean }>("/api/dev/auth/logout", {
      method: "POST"
    }),

  me: async () => devRequest<DevSession>("/api/dev/auth/me"),

  getResources: async () => devRequest<DevResource[]>("/api/dev/resources"),

  getResourceData: async (params: {
    resource: string;
    page: number;
    pageSize: number;
    sort?: string;
    order?: "asc" | "desc";
    filters?: Record<string, unknown>;
  }) => {
    const query = new URLSearchParams({
      page: String(params.page),
      pageSize: String(params.pageSize)
    });

    if (params.sort) {
      query.set("sort", params.sort);
    }
    if (params.order) {
      query.set("order", params.order);
    }
    if (params.filters && Object.keys(params.filters).length > 0) {
      query.set("filters", JSON.stringify(params.filters));
    }

    return devRequest<DevDataResponse>(`/api/dev/data/${encodeURIComponent(params.resource)}?${query.toString()}`);
  },

  createRecord: async (resource: string, data: Record<string, unknown>) =>
    devRequest<Record<string, unknown>>(`/api/dev/data/${encodeURIComponent(resource)}`, {
      method: "POST",
      body: { data }
    }),

  updateRecord: async (resource: string, id: string, data: Record<string, unknown>) =>
    devRequest<Record<string, unknown>>(`/api/dev/data/${encodeURIComponent(resource)}/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: { data }
    }),

  deleteRecord: async (resource: string, id: string) =>
    devRequest<{ deleted: boolean; id: string }>(`/api/dev/data/${encodeURIComponent(resource)}/${encodeURIComponent(id)}`, {
      method: "DELETE"
    }),

  bulkAction: async (resource: string, payload: {
    action: "update" | "delete";
    ids?: string[];
    filters?: Record<string, unknown>;
    data?: Record<string, unknown>;
  }) =>
    devRequest<{ affected: number }>(`/api/dev/data/${encodeURIComponent(resource)}/bulk`, {
      method: "POST",
      body: payload
    }),

  executeSql: async (sql: string, mode: "auto" | "query" | "execute" = "auto") =>
    devRequest<{ mode: "query" | "execute"; rows?: unknown[]; affected?: number }>("/api/dev/sql/execute", {
      method: "POST",
      body: { sql, mode }
    })
};
