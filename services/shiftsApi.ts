import { ShiftImportPreviewResult, ShiftMutationInput, ShiftRecord } from '../types/shifts';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: BodyInit | null;
  headers?: HeadersInit;
}

async function request<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    credentials: 'include',
    headers: options.headers,
    body: options.body
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || 'Request failed');
  }

  return payload.data as T;
}

function jsonRequest<T>(path: string, method: ApiOptions['method'], body?: unknown): Promise<T> {
  return request<T>(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
}

export const shiftsApi = {
  list: async (params: Record<string, string | boolean | undefined>) => {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      search.set(key, String(value));
    });
    return request<ShiftRecord[]>(`/api/shifts?${search.toString()}`);
  },

  create: async (body: ShiftMutationInput) => jsonRequest<ShiftRecord>('/api/shifts', 'POST', body),

  update: async (id: string, body: Partial<ShiftMutationInput>) =>
    jsonRequest<ShiftRecord>(`/api/shifts/${id}`, 'PATCH', body),

  remove: async (id: string) => jsonRequest<{ id: string; status: string }>(`/api/shifts/${id}`, 'DELETE'),

  previewImport: async (file: File, tenantId?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (tenantId) {
      formData.append('tenantId', tenantId);
    }

    return request<ShiftImportPreviewResult>('/api/shifts/import/preview', {
      method: 'POST',
      body: formData
    });
  },

  confirmImport: async (rows: ShiftImportPreviewResult['rows'], fileName?: string, tenantId?: string) =>
    jsonRequest<ShiftRecord[]>('/api/shifts/import/confirm', 'POST', {
      tenantId,
      fileName,
      rows
    }),

  subscribeBrowserNotifications: async (subscription: PushSubscriptionJSON, tenantId?: string) =>
    jsonRequest<{ id: string; endpoint: string }>('/api/push-subscriptions', 'POST', {
      tenantId,
      endpoint: subscription.endpoint,
      keys: subscription.keys
    }),

  removeBrowserSubscription: async (endpoint: string) =>
    jsonRequest<{ deleted: boolean }>('/api/push-subscriptions', 'DELETE', { endpoint })
};
