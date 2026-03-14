const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

export type DevExportType = 'sql-full' | 'sql-schema' | 'json' | 'csv-zip';

async function parseError(response: Response): Promise<string> {
  const payload = await response.json().catch(() => ({}));
  return payload?.error || payload?.message || `Request failed with ${response.status}`;
}

async function requestJson<T>(path: string, token: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-dev-token': token,
      ...(options.headers ?? {})
    }
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const payload = await response.json().catch(() => ({}));
  return payload.data as T;
}

export async function verifyDevPanelPassword(password: string): Promise<{ valid: boolean; path: string }> {
  const response = await fetch(`${API_BASE_URL}/api/internal/dev-panel/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ password })
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const payload = await response.json().catch(() => ({}));
  return payload.data as { valid: boolean; path: string };
}

export const devPanelApi = {
  health: (token: string) => requestJson<{
    users: number;
    companies: number;
    timeEntries: number;
    shifts: number;
    environment: string;
    nodeVersion: string;
    platform: string;
  }>('/api/internal/dev-panel/health', token),

  stats: (token: string) => requestJson<{
    counts: Record<string, number>;
    databaseSizeBytes: number;
    databaseSizeMb: number;
    lastMigration: { name: string | null; finishedAt: string | null };
  }>('/api/internal/dev-panel/stats', token),

  audit: (token: string) => requestJson<Array<{
    id: string;
    timestamp: string;
    action: string;
    entity: string;
    entityId: string | null;
    user: { id: string; name: string; email: string } | null;
  }>>('/api/internal/dev-panel/audit', token),

  backupLogs: (token: string) => requestJson<Array<{
    id: string;
    triggeredBy: string;
    exportType: string;
    filePath: string | null;
    fileSizeBytes: number | null;
    durationMs: number | null;
    status: string;
    errorMessage: string | null;
    createdAt: string;
  }>>('/api/internal/dev-panel/backup-logs', token),

  triggerReminders: (token: string, confirm: string) =>
    requestJson<{ processed: number; notified: number; skipped: number; failed: number }>(
      '/api/internal/dev-panel/reminders/run',
      token,
      {
        method: 'POST',
        body: JSON.stringify({ confirm })
      }
    ),

  downloadExport: async (token: string, type: DevExportType) => {
    const response = await fetch(`${API_BASE_URL}/api/internal/dev-panel/export?type=${encodeURIComponent(type)}`, {
      method: 'GET',
      headers: {
        'x-dev-token': token
      }
    });

    if (!response.ok) {
      throw new Error(await parseError(response));
    }

    const blob = await response.blob();
    const disposition = response.headers.get('content-disposition') || '';
    const match = disposition.match(/filename="?([^\"]+)"?/i);
    const fileName = match?.[1] ?? `export-${type}`;

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);

    return {
      fileName,
      sizeBytes: blob.size
    };
  }
};
