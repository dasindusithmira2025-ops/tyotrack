import React, { useEffect, useMemo, useState } from 'react';
import { devPanelApi, verifyDevPanelPassword, type DevExportType } from '../services/devPanelApi';

const SESSION_FLAG_KEY = 'tyo_dev_panel_unlocked';

const containerStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: '#050505',
  color: '#d1f7d6',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  padding: '20px'
};

const panelStyle: React.CSSProperties = {
  border: '1px solid #2f4f2f',
  borderRadius: 8,
  background: '#0b0f0b',
  padding: 14
};

const sectionTitle: React.CSSProperties = {
  fontSize: 13,
  textTransform: 'uppercase',
  letterSpacing: 1,
  color: '#8be98b',
  marginBottom: 10
};

function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatIso(iso: string | null | undefined): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString();
}

export const DevTerminalPanel: React.FC = () => {
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [gateBusy, setGateBusy] = useState(false);
  const [gateError, setGateError] = useState<string | null>(null);

  const [health, setHealth] = useState<any | null>(null);
  const [stats, setStats] = useState<any | null>(null);
  const [audit, setAudit] = useState<any[]>([]);
  const [backupLogs, setBackupLogs] = useState<any[]>([]);
  const [pageBusy, setPageBusy] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  const [dangerConfirm, setDangerConfirm] = useState('');
  const [dangerBusy, setDangerBusy] = useState(false);
  const [dangerResult, setDangerResult] = useState<any | null>(null);

  const [exportBusy, setExportBusy] = useState<DevExportType | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const unlocked = useMemo(() => Boolean(token), [token]);

  const loadAll = async (devToken: string) => {
    setPageBusy(true);
    setPageError(null);
    try {
      const [healthData, statsData, auditData, logsData] = await Promise.all([
        devPanelApi.health(devToken),
        devPanelApi.stats(devToken),
        devPanelApi.audit(devToken),
        devPanelApi.backupLogs(devToken)
      ]);
      setHealth(healthData);
      setStats(statsData);
      setAudit(auditData);
      setBackupLogs(logsData);
    } catch (error: any) {
      setPageError(error.message || 'Failed to load panel data');
    } finally {
      setPageBusy(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    void loadAll(token);
    const handle = window.setInterval(() => {
      void loadAll(token);
    }, 30000);
    return () => window.clearInterval(handle);
  }, [token]);

  const handleUnlock = async () => {
    setGateBusy(true);
    setGateError(null);
    try {
      const result = await verifyDevPanelPassword(password);
      if (!result.valid) {
        throw new Error('Invalid password');
      }
      sessionStorage.setItem(SESSION_FLAG_KEY, '1');
      setToken(password);
      setPassword('');
    } catch (error: any) {
      setGateError(error.message || 'Verification failed');
    } finally {
      setGateBusy(false);
    }
  };

  const handleExport = async (type: DevExportType) => {
    if (!token) return;
    setExportBusy(type);
    setExportError(null);
    try {
      await devPanelApi.downloadExport(token, type);
      await loadAll(token);
    } catch (error: any) {
      setExportError(error.message || 'Export failed');
    } finally {
      setExportBusy(null);
    }
  };

  const handleRunDanger = async () => {
    if (!token) return;
    setDangerBusy(true);
    try {
      const result = await devPanelApi.triggerReminders(token, dangerConfirm);
      setDangerResult(result);
      await loadAll(token);
    } catch (error: any) {
      setDangerResult({ error: error.message || 'Action failed' });
    } finally {
      setDangerBusy(false);
    }
  };

  const lastSuccess = backupLogs.find((log) => log.status === 'SUCCESS') ?? null;

  if (!unlocked) {
    const hasFlag = sessionStorage.getItem(SESSION_FLAG_KEY) === '1';
    return (
      <div style={containerStyle}>
        <div style={{ maxWidth: 520, margin: '5vh auto', ...panelStyle }}>
          <div style={sectionTitle}>Developer Terminal Gate</div>
          <p style={{ color: '#96a399', marginBottom: 12 }}>
            Restricted developer operations panel. Enter DEV_PANEL_PASSWORD to continue.
          </p>
          {hasFlag && (
            <p style={{ color: '#c8ad65', marginBottom: 12 }}>
              Session flag detected in this tab. Re-enter password to continue API operations.
            </p>
          )}
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Developer password"
            style={{
              width: '100%',
              border: '1px solid #405740',
              background: '#060906',
              color: '#d1f7d6',
              padding: 10,
              borderRadius: 6,
              marginBottom: 12
            }}
          />
          <button
            type="button"
            onClick={() => void handleUnlock()}
            disabled={gateBusy || !password}
            style={{
              border: '1px solid #6cad50',
              background: gateBusy ? '#1d3219' : '#284523',
              color: '#d1f7d6',
              padding: '8px 14px',
              borderRadius: 6,
              cursor: gateBusy ? 'not-allowed' : 'pointer'
            }}
          >
            {gateBusy ? 'Verifying...' : 'Unlock'}
          </button>
          {gateError && <p style={{ color: '#ff8f8f', marginTop: 10 }}>{gateError}</p>}
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={{ maxWidth: 1380, margin: '0 auto', display: 'grid', gap: 12 }}>
        <div style={panelStyle}>
          <div style={sectionTitle}>TyoTrack Developer God-Mode Dashboard</div>
          <p style={{ color: '#9ab39f', margin: 0 }}>Hidden operations panel. Token-authenticated APIs only.</p>
          {pageBusy && <p style={{ color: '#d8b56a', marginTop: 8 }}>Refreshing live data...</p>}
          {pageError && <p style={{ color: '#ff8f8f', marginTop: 8 }}>{pageError}</p>}
        </div>

        <div style={{ ...panelStyle, display: 'grid', gap: 6 }}>
          <div style={sectionTitle}>Section 1 - Live System Health</div>
          <div>Users: <strong>{health?.users ?? '-'}</strong></div>
          <div>Companies: <strong>{health?.companies ?? '-'}</strong></div>
          <div>Time Entries: <strong>{health?.timeEntries ?? '-'}</strong></div>
          <div>Shifts: <strong>{health?.shifts ?? '-'}</strong></div>
          <div>Environment: <strong>{health?.environment ?? '-'}</strong></div>
          <div>Node: <strong>{health?.nodeVersion ?? '-'} ({health?.platform ?? '-'})</strong></div>
        </div>

        <div style={{ ...panelStyle, display: 'grid', gap: 6 }}>
          <div style={sectionTitle}>Section 2 - Database Stats</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6 }}>
            {Object.entries(stats?.counts ?? {}).map(([key, value]) => (
              <div key={key}>{key}: <strong>{String(value)}</strong></div>
            ))}
          </div>
          <div>Database Size: <strong>{stats ? `${stats.databaseSizeMb} MB (${stats.databaseSizeBytes} bytes)` : '-'}</strong></div>
          <div>Last Migration: <strong>{stats?.lastMigration?.name ?? '-'}</strong></div>
          <div>Migration Finished: <strong>{formatIso(stats?.lastMigration?.finishedAt)}</strong></div>
        </div>

        <div style={panelStyle}>
          <div style={sectionTitle}>Section 3 - Recent Audit Logs (Last 20)</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  {['Timestamp', 'Action', 'User', 'Resource'].map((label) => (
                    <th key={label} style={{ textAlign: 'left', borderBottom: '1px solid #2f4f2f', padding: '6px 4px', color: '#8be98b' }}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {audit.map((row) => (
                  <tr key={row.id}>
                    <td style={{ borderBottom: '1px solid #1d2f1d', padding: '6px 4px' }}>{formatIso(row.timestamp)}</td>
                    <td style={{ borderBottom: '1px solid #1d2f1d', padding: '6px 4px' }}>{row.action}</td>
                    <td style={{ borderBottom: '1px solid #1d2f1d', padding: '6px 4px' }}>{row.user?.email ?? '-'}</td>
                    <td style={{ borderBottom: '1px solid #1d2f1d', padding: '6px 4px' }}>{row.entity}{row.entityId ? ` (${row.entityId})` : ''}</td>
                  </tr>
                ))}
                {!audit.length && (
                  <tr>
                    <td colSpan={4} style={{ padding: 8, color: '#9ab39f' }}>No audit entries.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div style={panelStyle}>
          <div style={sectionTitle}>Section 4 - Database Backup and Export</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
            <button type="button" onClick={() => void handleExport('sql-full')} disabled={Boolean(exportBusy)} style={{ border: '1px solid #4f7f4f', background: '#112011', color: '#d1f7d6', padding: '8px 10px', borderRadius: 6 }}>
              {exportBusy === 'sql-full' ? 'Exporting...' : 'Export Full SQL Dump'}
            </button>
            <button type="button" onClick={() => void handleExport('sql-schema')} disabled={Boolean(exportBusy)} style={{ border: '1px solid #4f7f4f', background: '#112011', color: '#d1f7d6', padding: '8px 10px', borderRadius: 6 }}>
              {exportBusy === 'sql-schema' ? 'Exporting...' : 'Export Schema-Only SQL'}
            </button>
            <button type="button" onClick={() => void handleExport('json')} disabled={Boolean(exportBusy)} style={{ border: '1px solid #4f7f4f', background: '#112011', color: '#d1f7d6', padding: '8px 10px', borderRadius: 6 }}>
              {exportBusy === 'json' ? 'Exporting...' : 'Export JSON Snapshot'}
            </button>
            <button type="button" onClick={() => void handleExport('csv-zip')} disabled={Boolean(exportBusy)} style={{ border: '1px solid #4f7f4f', background: '#112011', color: '#d1f7d6', padding: '8px 10px', borderRadius: 6 }}>
              {exportBusy === 'csv-zip' ? 'Exporting...' : 'Export CSV ZIP'}
            </button>
          </div>

          {exportError && <p style={{ color: '#ff8f8f', marginBottom: 8 }}>{exportError}</p>}

          <p style={{ color: '#b6c7b8', marginTop: 0 }}>
            Last successful export: <strong>{lastSuccess ? `${formatIso(lastSuccess.createdAt)} (${formatBytes(lastSuccess.fileSizeBytes)})` : '-'}</strong>
          </p>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  {['Timestamp', 'Type', 'Triggered By', 'Status', 'Size', 'Duration', 'Error'].map((label) => (
                    <th key={label} style={{ textAlign: 'left', borderBottom: '1px solid #2f4f2f', padding: '6px 4px', color: '#8be98b' }}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {backupLogs.map((log) => (
                  <tr key={log.id}>
                    <td style={{ borderBottom: '1px solid #1d2f1d', padding: '6px 4px' }}>{formatIso(log.createdAt)}</td>
                    <td style={{ borderBottom: '1px solid #1d2f1d', padding: '6px 4px' }}>{log.exportType}</td>
                    <td style={{ borderBottom: '1px solid #1d2f1d', padding: '6px 4px' }}>{log.triggeredBy}</td>
                    <td style={{ borderBottom: '1px solid #1d2f1d', padding: '6px 4px', color: log.status === 'SUCCESS' ? '#84ff84' : '#ff8f8f' }}>{log.status}</td>
                    <td style={{ borderBottom: '1px solid #1d2f1d', padding: '6px 4px' }}>{formatBytes(log.fileSizeBytes)}</td>
                    <td style={{ borderBottom: '1px solid #1d2f1d', padding: '6px 4px' }}>{log.durationMs ? `${log.durationMs}ms` : '-'}</td>
                    <td style={{ borderBottom: '1px solid #1d2f1d', padding: '6px 4px', color: '#ffb0b0' }}>{log.errorMessage ?? '-'}</td>
                  </tr>
                ))}
                {!backupLogs.length && (
                  <tr>
                    <td colSpan={7} style={{ padding: 8, color: '#9ab39f' }}>No backup logs yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ ...panelStyle, borderColor: '#6b3f3f' }}>
          <div style={{ ...sectionTitle, color: '#ffb375' }}>Section 5 - Danger Zone</div>
          <p style={{ color: '#d8c0a0' }}>Manual shift reminder runner trigger. Type <strong>CONFIRM</strong> to execute.</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              type="text"
              value={dangerConfirm}
              onChange={(event) => setDangerConfirm(event.target.value)}
              placeholder="Type CONFIRM"
              style={{ border: '1px solid #6b4d3f', background: '#120b08', color: '#ffd1a8', padding: 10, borderRadius: 6, minWidth: 220 }}
            />
            <button
              type="button"
              onClick={() => void handleRunDanger()}
              disabled={dangerBusy || dangerConfirm !== 'CONFIRM'}
              style={{ border: '1px solid #a56d4a', background: '#2f1b12', color: '#ffd1a8', padding: '8px 12px', borderRadius: 6 }}
            >
              {dangerBusy ? 'Executing...' : 'Run Reminder Dispatch'}
            </button>
          </div>

          {dangerResult && (
            <pre style={{ marginTop: 10, background: '#0c0807', border: '1px solid #5b3f35', borderRadius: 6, padding: 10, overflowX: 'auto', color: '#ffd1a8' }}>
              {JSON.stringify(dangerResult, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
};
