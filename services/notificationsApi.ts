import type { AppNotification } from '../types/notifications';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

interface ApiOptions {
  method?: 'GET' | 'PATCH';
  body?: unknown;
}

async function request<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json'
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || 'Request failed');
  }

  return payload.data as T;
}

export const notificationsApi = {
  listUnread: async (limit = 20) => request<AppNotification[]>(`/api/notifications?unreadOnly=true&limit=${Math.max(1, Math.min(100, Math.trunc(limit)))}`),

  markRead: async (ids: string[]) => {
    if (!ids.length) {
      return { updated: 0 };
    }

    return request<{ updated: number }>('/api/notifications', {
      method: 'PATCH',
      body: {
        markAll: false,
        ids
      }
    });
  }
};

