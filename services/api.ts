import { EntryStatus, Company, Project, TimeEntry, User, UserRole, Workspace } from "../types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

interface ApiOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
}

async function request<T>(path: string, options: ApiOptions = {}): Promise<T> {
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
    throw new Error(payload?.error || "Request failed");
  }

  return payload.data as T;
}

async function resolveCompany(ref: string): Promise<any | null> {
  if (!ref) {
    return null;
  }

  try {
    return await request<any>(`/api/companies/${ref}`);
  } catch {
    try {
      const list = await request<any[]>(`/api/companies?tenantId=${encodeURIComponent(ref)}`);
      return list[0] ?? null;
    } catch {
      return null;
    }
  }
}

async function getActivePolicy(tenantId: string): Promise<any | null> {
  if (!tenantId) {
    return null;
  }

  return request<any>(`/api/policies?tenantId=${encodeURIComponent(tenantId)}`);
}

function mapWorkspace(workspace: any): Workspace {
  return {
    id: workspace.id,
    name: workspace.name,
    companyId: workspace.tenantId ?? workspace.companyId,
    status: workspace.status
  };
}

function mergeCompanyPolicy(company: any, policy: any): Company {
  return {
    id: company.id,
    name: company.name,
    email: company.email,
    timezone: company.timezone,
    eveningStart: policy?.eveningStart ?? "18:00",
    eveningEnd: policy?.eveningEnd ?? "22:00",
    nightStart: policy?.nightStart ?? "22:00",
    nightEnd: policy?.nightEnd ?? "06:00"
  };
}

async function getTenantId(companyIdOrTenantId: string): Promise<string> {
  if (!companyIdOrTenantId) {
    throw new Error("Tenant context is missing");
  }

  const storedUser = JSON.parse(localStorage.getItem("tyo_user") || "null");
  if (storedUser?.role && storedUser.role !== "SUPER_ADMIN" && storedUser.companyId) {
    return storedUser.companyId;
  }

  const company = await resolveCompany(companyIdOrTenantId);
  return company?.tenantId ?? companyIdOrTenantId;
}

export const api = {
  login: async (email: string, password: string): Promise<User> => {
    return request<User>("/api/auth/login", {
      method: "POST",
      body: { email, password }
    });
  },

  loginAsRole: async (role: UserRole): Promise<User> => {
    return request<User>("/api/auth/login", {
      method: "POST",
      body: { testRole: role }
    });
  },

  logout: async () => {
    await request<{ success: boolean }>("/api/auth/logout", { method: "POST" });
  },

  me: async (): Promise<User | null> => {
    return request<User | null>("/api/auth/me");
  },

  getUserByEmail: async (_email: string) => {
    const me = await api.me();
    if (!me) {
      throw new Error("User not found in database");
    }
    return me;
  },

  getAllCompanies: async (): Promise<Company[]> => {
    const companies = await request<any[]>("/api/companies");
    const enriched = await Promise.all(
      companies.map(async (company) => {
        const policy = await getActivePolicy(company.tenantId);
        return mergeCompanyPolicy(company, policy);
      })
    );
    return enriched;
  },

  createCompany: async (name: string, email: string, _password?: string): Promise<Company> => {
    const created = await request<any>("/api/companies", {
      method: "POST",
      body: { name, email }
    });

    const policy = await getActivePolicy(created.company.tenantId);
    return mergeCompanyPolicy(created.company, policy);
  },

  createCompanyAdmin: async (companyId: string, name: string, email: string, password?: string): Promise<User> => {
    const tenantId = await getTenantId(companyId);
    return request<User>("/api/users", {
      method: "POST",
      body: {
        tenantId,
        name,
        email,
        password: password ?? "password123",
        role: "COMPANY_ADMIN"
      }
    });
  },

  createEmployee: async (companyId: string, name: string, email: string, password?: string): Promise<User> => {
    const tenantId = await getTenantId(companyId);
    return request<User>("/api/users", {
      method: "POST",
      body: {
        tenantId,
        name,
        email,
        password: password ?? "password123",
        role: "EMPLOYEE"
      }
    });
  },

  getCompanyAdmins: async (companyId: string): Promise<User[]> => {
    const tenantId = await getTenantId(companyId);
    return request<User[]>(`/api/users?tenantId=${encodeURIComponent(tenantId)}&role=COMPANY_ADMIN`);
  },

  getCompany: async (id: string): Promise<Company | undefined> => {
    const company = await resolveCompany(id);
    if (!company) {
      return undefined;
    }

    const policy = await getActivePolicy(company.tenantId);
    return mergeCompanyPolicy(company, policy);
  },

  updateCompanyPolicy: async (id: string, updates: Partial<Company>, _adminName: string): Promise<Company | undefined> => {
    const company = await resolveCompany(id);
    if (!company) {
      return undefined;
    }

    await request("/api/policies", {
      method: "PATCH",
      body: {
        tenantId: company.tenantId,
        eveningStart: updates.eveningStart,
        eveningEnd: updates.eveningEnd,
        nightStart: updates.nightStart,
        nightEnd: updates.nightEnd
      }
    });

    return api.getCompany(id);
  },

  getWorkspaces: async (companyId: string): Promise<Workspace[]> => {
    const tenantId = await getTenantId(companyId);
    const workspaces = await request<any[]>(`/api/workspaces?tenantId=${encodeURIComponent(tenantId)}&status=ACTIVE`);
    return workspaces.map(mapWorkspace);
  },

  getAllWorkspaces: async (companyId: string): Promise<Workspace[]> => {
    const tenantId = await getTenantId(companyId);
    const workspaces = await request<any[]>(`/api/workspaces?tenantId=${encodeURIComponent(tenantId)}`);
    return workspaces.map(mapWorkspace);
  },

  createWorkspace: async (companyId: string, name: string): Promise<Workspace> => {
    const tenantId = await getTenantId(companyId);
    const workspace = await request<any>("/api/workspaces", {
      method: "POST",
      body: {
        tenantId,
        name: name.trim()
      }
    });

    return mapWorkspace(workspace);
  },

  updateWorkspaceStatus: async (workspaceId: string, status: "ACTIVE" | "ARCHIVED"): Promise<Workspace> => {
    const workspace = await request<any>(`/api/workspaces/${workspaceId}`, {
      method: "PATCH",
      body: { status }
    });
    return mapWorkspace(workspace);
  },

  getProjects: async (workspaceId: string): Promise<Project[]> => {
    if (!workspaceId) {
      return [];
    }
    return request<Project[]>(
      `/api/projects?workspaceId=${encodeURIComponent(workspaceId)}&status=ACTIVE`
    );
  },

  getAllCompanyProjects: async (companyId: string): Promise<Project[]> => {
    const tenantId = await getTenantId(companyId);
    return request<Project[]>(`/api/projects?tenantId=${encodeURIComponent(tenantId)}`);
  },

  createProject: async (workspaceId: string, name: string, color: string): Promise<Project> => {
    return request<Project>("/api/projects", {
      method: "POST",
      body: { workspaceId, name, color }
    });
  },

  toggleProjectStatus: async (projectId: string) => {
    const existing = await request<Project[]>("/api/projects");
    const target = existing.find((project) => project.id === projectId);
    if (!target) {
      throw new Error("Project not found");
    }

    await request(`/api/projects/${projectId}`, {
      method: "PATCH",
      body: {
        status: target.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE"
      }
    });
  },

  getTimeEntries: async (userId: string | undefined, companyId: string): Promise<TimeEntry[]> => {
    const tenantId = await getTenantId(companyId);
    const query = new URLSearchParams({ tenantId });
    if (userId) {
      query.set("userId", userId);
    }
    return request<TimeEntry[]>(`/api/time-entries?${query.toString()}`);
  },

  getEmployees: async (companyId: string) => {
    const tenantId = await getTenantId(companyId);
    const users = await request<any[]>(`/api/users?tenantId=${encodeURIComponent(tenantId)}&role=EMPLOYEE`);

    return users
      .filter((user) => user.role === "EMPLOYEE")
      .map((user) => ({
        ...user,
        companyId: user.tenantId,
        profile: {
          backdateLimitDays: user.backdateLimitDays ?? 7
        }
      }));
  },

  updateEmployeeProfile: async (userId: string, data: { backdateLimitDays: number }) => {
    return request(`/api/users/${userId}`, {
      method: "PATCH",
      body: {
        backdateLimitDays: data.backdateLimitDays
      }
    });
  },

  updateUser: async (
    userId: string,
    data: {
      name?: string;
      email?: string;
      status?: "ACTIVE" | "SUSPENDED";
      backdateLimitDays?: number;
      role?: UserRole;
    }
  ) => {
    return request<User>(`/api/users/${userId}`, {
      method: "PATCH",
      body: data
    });
  },

  createTimeEntry: async (
    userId: string,
    workspaceId: string,
    projectId: string,
    localDate: string,
    startClock: string,
    endClock: string,
    notes?: string
  ) => {
    const tenantId = await getTenantId(workspaceId);
    return request<TimeEntry[]>("/api/time-entries", {
      method: "POST",
      body: {
        tenantId,
        userId,
        workspaceId,
        projectId,
        localDate,
        startClock,
        endClock,
        notes
      }
    });
  },

  updateEntryStatus: async (entryId: string, status: EntryStatus, reason?: string) => {
    return request(`/api/time-entries/${entryId}/status`, {
      method: "PATCH",
      body: {
        status,
        reason
      }
    });
  },

  changePassword: async (userId: string, current: string | undefined, newPass: string) => {
    const body: { newPassword: string; currentPassword?: string } = { newPassword: newPass };
    if (current) {
      body.currentPassword = current;
    }

    return request(`/api/users/${userId}/change-password`, {
      method: "POST",
      body
    });
  },

  getAuditLogs: async (companyId: string) => {
    const tenantId = await getTenantId(companyId);
    return request<any[]>(`/api/audit-logs?tenantId=${encodeURIComponent(tenantId)}`);
  }
};
