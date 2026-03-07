import React, { useEffect, useMemo, useState } from "react";
import { Layout } from "../components/Layout";
import { Button } from "../components/ui/Button";
import { devApi, DevResource, DevSession } from "../services/devApi";
import { toast } from "sonner";
import { Database, Download, Eye, EyeOff, Play, Save, Shield, Trash2, Upload } from "lucide-react";

type TabKey = "explorer" | "sql" | "schema";

interface ConfirmState {
  title: string;
  phrase: "DELETE" | "TRUNCATE" | "DROP";
  onConfirm: () => Promise<void>;
}

interface SqlSnippet {
  name: string;
  sql: string;
}

const DEV_ACTIVE_KEY = "tyo_dev_mode_active";
const HISTORY_KEY = "tyo_dev_sql_history";
const SNIPPETS_KEY = "tyo_dev_sql_snippets";

function parseJsonObject(input: string): Record<string, unknown> {
  const parsed = JSON.parse(input);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("JSON must be an object");
  }
  return parsed as Record<string, unknown>;
}

function detectDangerPhrase(sql: string): "DELETE" | "TRUNCATE" | "DROP" | null {
  const token = sql.trim().split(/\s+/)[0]?.toUpperCase() ?? "";
  if (token === "DELETE") return "DELETE";
  if (token === "TRUNCATE") return "TRUNCATE";
  if (token === "DROP") return "DROP";
  return null;
}

function toCsv(rows: Array<Record<string, unknown>>, columns: string[]): string {
  const header = columns.join(",");
  const body = rows.map((row) =>
    columns
      .map((column) => {
        const value = row[column];
        const text = value === null || value === undefined ? "" : String(value);
        return `"${text.replace(/"/g, '""')}"`;
      })
      .join(",")
  );
  return [header, ...body].join("\n");
}

function downloadFile(name: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

export const DevMode = () => {
  const [session, setSession] = useState<DevSession | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("explorer");

  const [loginEmail, setLoginEmail] = useState("dasindusithmira2025@gmail.com");
  const [loginPassword, setLoginPassword] = useState("Dasindu@13#");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [resources, setResources] = useState<DevResource[]>([]);
  const [selectedResource, setSelectedResource] = useState("");
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortField, setSortField] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [filtersText, setFiltersText] = useState("{}");
  const [filtersVersion, setFiltersVersion] = useState(0);
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [createText, setCreateText] = useState("{}");
  const [editId, setEditId] = useState<string | null>(null);
  const [editText, setEditText] = useState("{}");
  const [bulkMode, setBulkMode] = useState<"update" | "delete">("update");
  const [bulkDataText, setBulkDataText] = useState("{}");

  const [sqlText, setSqlText] = useState("SELECT * FROM \"users\" LIMIT 10;");
  const [sqlMode, setSqlMode] = useState<"auto" | "query" | "execute">("auto");
  const [sqlResult, setSqlResult] = useState<unknown>(null);
  const [sqlHistory, setSqlHistory] = useState<string[]>([]);
  const [sqlSnippets, setSqlSnippets] = useState<SqlSnippet[]>([]);
  const [isRunningSql, setIsRunningSql] = useState(false);

  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [confirmInput, setConfirmInput] = useState("");
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const currentResource = useMemo(
    () => resources.find((resource) => resource.name === selectedResource) ?? null,
    [resources, selectedResource]
  );
  const primaryField = currentResource?.primaryKey?.field ?? "id";
  const allColumns = currentResource?.fields.map((field) => field.name) ?? [];

  const parsedFilters = useMemo(() => {
    try {
      return parseJsonObject(filtersText);
    } catch {
      return {};
    }
  }, [filtersText, filtersVersion]);

  const loadData = async () => {
    if (!session || !selectedResource) return;
    try {
      const response = await devApi.getResourceData({
        resource: selectedResource,
        page,
        pageSize,
        sort: sortField || undefined,
        order: sortOrder,
        filters: parsedFilters
      });
      setRows(response.items);
      setTotal(response.total);
      setSelectedIds([]);
    } catch (error: any) {
      toast.error(error?.message || "Failed to load data");
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const me = await devApi.me();
        setSession(me);
        localStorage.setItem(DEV_ACTIVE_KEY, "1");
      } catch {
        setSession(null);
        localStorage.removeItem(DEV_ACTIVE_KEY);
      } finally {
        setSessionLoading(false);
      }
    };

    bootstrap();
    const history = localStorage.getItem(HISTORY_KEY);
    const snippets = localStorage.getItem(SNIPPETS_KEY);
    if (history) {
      try {
        setSqlHistory(JSON.parse(history));
      } catch {
        setSqlHistory([]);
      }
    }
    if (snippets) {
      try {
        setSqlSnippets(JSON.parse(snippets));
      } catch {
        setSqlSnippets([]);
      }
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    (async () => {
      try {
        const list = await devApi.getResources();
        setResources(list);
        if (list.length > 0) {
          setSelectedResource(list[0].name);
          setSortField(list[0].primaryKey?.field ?? "id");
          setVisibleColumns(list[0].fields.slice(0, 8).map((field) => field.name));
        }
      } catch (error: any) {
        toast.error(error?.message || "Failed to load resources");
      }
    })();
  }, [session]);

  useEffect(() => {
    loadData();
  }, [session, selectedResource, page, pageSize, sortField, sortOrder, filtersVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  const openConfirm = (title: string, phrase: "DELETE" | "TRUNCATE" | "DROP", onConfirm: () => Promise<void>) => {
    setConfirmState({ title, phrase, onConfirm });
    setConfirmInput("");
    setConfirmChecked(false);
  };

  const runConfirmAction = async () => {
    if (!confirmState) return;
    if (confirmInput.trim().toUpperCase() !== confirmState.phrase || !confirmChecked) {
      toast.error(`Type ${confirmState.phrase} and enable confirmation`);
      return;
    }
    setConfirmLoading(true);
    try {
      await confirmState.onConfirm();
      setConfirmState(null);
    } finally {
      setConfirmLoading(false);
    }
  };

  const rowId = (row: Record<string, unknown>) => String(row[primaryField] ?? "");

  const doLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoggingIn(true);
    try {
      const result = await devApi.login(loginEmail, loginPassword);
      setSession(result);
      localStorage.setItem(DEV_ACTIVE_KEY, "1");
      toast.success("Developer mode enabled");
    } catch (error: any) {
      toast.error(error?.message || "Dev login failed");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const doLogout = async () => {
    await devApi.logout().catch(() => undefined);
    setSession(null);
    localStorage.removeItem(DEV_ACTIVE_KEY);
  };

  const doCreate = async () => {
    if (!selectedResource) return;
    try {
      const data = parseJsonObject(createText);
      await devApi.createRecord(selectedResource, data);
      toast.success("Created");
      await loadData();
    } catch (error: any) {
      toast.error(error?.message || "Create failed");
    }
  };

  const doUpdate = async () => {
    if (!selectedResource || !editId) return;
    try {
      const data = parseJsonObject(editText);
      await devApi.updateRecord(selectedResource, editId, data);
      toast.success("Updated");
      setEditId(null);
      await loadData();
    } catch (error: any) {
      toast.error(error?.message || "Update failed");
    }
  };

  const doBulk = () => {
    if (!selectedResource) return;
    if (bulkMode === "delete") {
      openConfirm("Bulk delete records", "DELETE", async () => {
        const result = await devApi.bulkAction(selectedResource, {
          action: "delete",
          ids: selectedIds.length > 0 ? selectedIds : undefined,
          filters: selectedIds.length === 0 ? parsedFilters : undefined
        });
        toast.success(`Deleted ${result.affected}`);
        await loadData();
      });
      return;
    }

    try {
      const data = parseJsonObject(bulkDataText);
      openConfirm("Bulk update records", "DELETE", async () => {
        const result = await devApi.bulkAction(selectedResource, {
          action: "update",
          ids: selectedIds.length > 0 ? selectedIds : undefined,
          filters: selectedIds.length === 0 ? parsedFilters : undefined,
          data
        });
        toast.success(`Updated ${result.affected}`);
        await loadData();
      });
    } catch (error: any) {
      toast.error(error?.message || "Invalid bulk JSON");
    }
  };

  const doRunSql = async () => {
    const sql = sqlText.trim();
    if (!sql) {
      toast.error("SQL required");
      return;
    }

    const runNow = async () => {
      setIsRunningSql(true);
      try {
        const result = await devApi.executeSql(sql, sqlMode);
        setSqlResult(result);
        const nextHistory = [sql, ...sqlHistory.filter((item) => item !== sql)].slice(0, 20);
        setSqlHistory(nextHistory);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory));
      } catch (error: any) {
        toast.error(error?.message || "SQL failed");
      } finally {
        setIsRunningSql(false);
      }
    };

    const phrase = detectDangerPhrase(sql);
    if (phrase) {
      openConfirm(`Confirm ${phrase} statement`, phrase, runNow);
      return;
    }
    await runNow();
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedResource || !event.target.files || event.target.files.length === 0) {
      return;
    }

    const file = event.target.files[0];
    const text = await file.text();
    let payload: Array<Record<string, unknown>> = [];

    try {
      if (file.name.toLowerCase().endsWith(".json")) {
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed)) {
          throw new Error("JSON import must be an array of objects");
        }
        payload = parsed as Array<Record<string, unknown>>;
      } else {
        const lines = text.split(/\r?\n/).filter(Boolean);
        if (lines.length < 2) {
          throw new Error("CSV must contain header and data rows");
        }
        const headers = lines[0].split(",").map((item) => item.replace(/^"|"$/g, "").trim());
        payload = lines.slice(1).map((line) => {
          const cells = line.split(",").map((item) => item.replace(/^"|"$/g, "").replace(/""/g, '"'));
          return headers.reduce((acc, header, index) => {
            acc[header] = cells[index] ?? "";
            return acc;
          }, {} as Record<string, unknown>);
        });
      }
    } catch (error: any) {
      toast.error(error?.message || "Import parse failed");
      return;
    }

    try {
      for (const row of payload) {
        await devApi.createRecord(selectedResource, row);
      }
      toast.success(`Imported ${payload.length} rows`);
      await loadData();
    } catch (error: any) {
      toast.error(error?.message || "Import failed");
    } finally {
      event.target.value = "";
    }
  };

  if (sessionLoading) {
    return <Layout><div className="max-w-6xl mx-auto p-8 text-slate-400">Loading developer mode...</div></Layout>;
  }

  if (!session) {
    return (
      <Layout>
        <div className="max-w-md mx-auto pt-8">
          <div className="glass-surface rounded-xl p-6 border border-slate-700">
            <h1 className="text-xl font-bold text-white mb-2 flex items-center gap-2"><Shield className="w-5 h-5 text-amber-300" />Developer Mode</h1>
            <p className="text-slate-400 text-sm mb-4">Dedicated access for full database management.</p>
            <form className="space-y-3" onSubmit={doLogin}>
              <input className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2.5 text-white" type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required />
              <div className="relative">
                <input className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2.5 pr-10 text-white" type={showPassword ? "text" : "password"} value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required />
                <button type="button" className="absolute right-2 top-1.5 p-1.5 text-slate-400" onClick={() => setShowPassword((v) => !v)}>
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <Button className="w-full" type="submit" isLoading={isLoggingIn}>Unlock Dev Mode</Button>
            </form>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto pb-24">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Database className="w-6 h-6 text-cyan-300" />Developer God-Mode Panel</h1>
          <Button variant="outline" onClick={doLogout}>Dev Logout</Button>
        </div>

        <div className="mb-4 flex gap-2">
          <Button variant={tab === "explorer" ? "primary" : "outline"} onClick={() => setTab("explorer")}>Data Explorer</Button>
          <Button variant={tab === "sql" ? "primary" : "outline"} onClick={() => setTab("sql")}>Query Console</Button>
          <Button variant={tab === "schema" ? "primary" : "outline"} onClick={() => setTab("schema")}>Schema Browser</Button>
        </div>

        {tab === "explorer" && (
          <div className="glass-surface rounded-xl border border-slate-700 p-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-3">
              <select className="rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm text-white" value={selectedResource} onChange={(e) => setSelectedResource(e.target.value)}>
                {resources.map((resource) => <option key={resource.name} value={resource.name}>{resource.name}</option>)}
              </select>
              <select className="rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm text-white" value={sortField} onChange={(e) => setSortField(e.target.value)}>
                {allColumns.map((column) => <option key={column} value={column}>{column}</option>)}
              </select>
              <select className="rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm text-white" value={sortOrder} onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}>
                <option value="desc">DESC</option><option value="asc">ASC</option>
              </select>
              <select className="rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm text-white" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
                <option value={10}>10</option><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option>
              </select>
              <div className="text-xs text-slate-400 rounded-lg border border-slate-700 bg-slate-950 p-2 flex items-center">Total: {total}</div>
            </div>

            {allColumns.length > 0 && (
              <details className="mb-3 rounded-lg border border-slate-800 bg-slate-950/50 p-2">
                <summary className="cursor-pointer text-xs text-slate-300">Column Chooser</summary>
                <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
                  {allColumns.map((column) => {
                    const checked = visibleColumns.includes(column);
                    return (
                      <label key={column} className="flex items-center gap-2 text-xs text-slate-300">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setVisibleColumns((list) =>
                              checked ? list.filter((item) => item !== column) : [...list, column]
                            )
                          }
                        />
                        {column}
                      </label>
                    );
                  })}
                </div>
              </details>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-3">
              <textarea className="lg:col-span-2 rounded-lg bg-slate-950 border border-slate-700 p-2 text-xs text-white font-mono h-20" value={filtersText} onChange={(e) => setFiltersText(e.target.value)} />
              <div className="flex flex-col gap-2">
                <Button onClick={() => { setPage(1); setFiltersVersion((v) => v + 1); }}>Apply Filters</Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => downloadFile(`${selectedResource}.json`, JSON.stringify(rows, null, 2), "application/json")} className="flex-1 gap-2"><Download className="w-4 h-4" />JSON</Button>
                  <Button variant="outline" onClick={() => downloadFile(`${selectedResource}.csv`, toCsv(rows, visibleColumns.length > 0 ? visibleColumns : allColumns), "text/csv")} className="flex-1 gap-2"><Download className="w-4 h-4" />CSV</Button>
                </div>
                <label className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-slate-600/70 bg-slate-900/40 hover:bg-slate-800/70 text-slate-200 cursor-pointer text-sm">
                  <Upload className="w-4 h-4" />
                  Import
                  <input type="file" accept=".json,.csv" className="hidden" onChange={handleImportFile} />
                </label>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-800 rounded-xl">
              <table className="w-full text-xs">
                <thead className="bg-slate-900 text-slate-400">
                  <tr>
                    <th className="px-2 py-2 text-left">Select</th>
                    {(visibleColumns.length > 0 ? visibleColumns : allColumns).map((column) => <th key={column} className="px-2 py-2 text-left">{column}</th>)}
                    <th className="px-2 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => {
                    const id = rowId(row);
                    const selected = selectedIds.includes(id);
                    return (
                      <tr key={`${id}-${index}`} className="border-t border-slate-800">
                        <td className="px-2 py-2"><input type="checkbox" checked={selected} onChange={() => setSelectedIds((list) => selected ? list.filter((item) => item !== id) : [...list, id])} /></td>
                        {(visibleColumns.length > 0 ? visibleColumns : allColumns).map((column) => <td key={column} className="px-2 py-2 text-slate-200 whitespace-nowrap">{String(row[column] ?? "")}</td>)}
                        <td className="px-2 py-2 text-right">
                          <div className="flex justify-end gap-2">
                            <button className="p-1.5 rounded hover:bg-slate-800 text-slate-300" onClick={() => { setEditId(id); setEditText(JSON.stringify(row, null, 2)); }}>Edit</button>
                            <button className="p-1.5 rounded hover:bg-rose-500/20 text-rose-300" onClick={() => openConfirm(`Delete record ${id}`, "DELETE", async () => { await devApi.deleteRecord(selectedResource, id); await loadData(); })}><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 mt-4">
              <div className="rounded-xl border border-slate-800 p-3 bg-slate-950/50">
                <h3 className="text-sm font-semibold text-white mb-2">Create (JSON)</h3>
                <textarea className="w-full h-32 rounded-lg bg-slate-950 border border-slate-700 p-2 text-xs text-white font-mono" value={createText} onChange={(e) => setCreateText(e.target.value)} />
                <Button className="mt-2 w-full" onClick={doCreate}>Create</Button>
              </div>
              <div className="rounded-xl border border-slate-800 p-3 bg-slate-950/50">
                <h3 className="text-sm font-semibold text-white mb-2">Edit Row (JSON)</h3>
                <textarea className="w-full h-32 rounded-lg bg-slate-950 border border-slate-700 p-2 text-xs text-white font-mono" value={editText} onChange={(e) => setEditText(e.target.value)} disabled={!editId} />
                <Button className="mt-2 w-full" onClick={doUpdate} disabled={!editId}>Save Update</Button>
              </div>
              <div className="rounded-xl border border-slate-800 p-3 bg-slate-950/50">
                <h3 className="text-sm font-semibold text-white mb-2">Bulk Ops</h3>
                <select className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2 text-xs text-white mb-2" value={bulkMode} onChange={(e) => setBulkMode(e.target.value as "update" | "delete")}><option value="update">Bulk Update</option><option value="delete">Bulk Delete</option></select>
                <textarea className="w-full h-24 rounded-lg bg-slate-950 border border-slate-700 p-2 text-xs text-white font-mono" value={bulkDataText} onChange={(e) => setBulkDataText(e.target.value)} disabled={bulkMode === "delete"} />
                <Button className="mt-2 w-full" variant={bulkMode === "delete" ? "danger" : "primary"} onClick={doBulk}>Run Bulk</Button>
              </div>
            </div>
          </div>
        )}

        {tab === "sql" && (
          <div className="glass-surface rounded-xl border border-slate-700 p-4">
            <div className="flex flex-wrap gap-2 mb-3">
              <select className="rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm text-white" value={sqlMode} onChange={(e) => setSqlMode(e.target.value as "auto" | "query" | "execute")}><option value="auto">Auto</option><option value="query">Query</option><option value="execute">Execute</option></select>
              <Button className="gap-2" onClick={doRunSql} isLoading={isRunningSql}><Play className="w-4 h-4" />Run SQL</Button>
              <Button variant="outline" className="gap-2" onClick={() => { const name = window.prompt("Snippet name"); if (!name) return; const next = [{ name, sql: sqlText }, ...sqlSnippets.filter((s) => s.name !== name)].slice(0, 30); setSqlSnippets(next); localStorage.setItem(SNIPPETS_KEY, JSON.stringify(next)); }}><Save className="w-4 h-4" />Save Snippet</Button>
            </div>
            <textarea className="w-full min-h-[220px] rounded-xl bg-slate-950 border border-slate-700 p-3 text-sm text-white font-mono" value={sqlText} onChange={(e) => setSqlText(e.target.value)} />
            <pre className="mt-3 rounded-xl border border-slate-800 p-3 bg-slate-950/50 text-xs text-slate-300 overflow-auto max-h-[260px]">{sqlResult ? JSON.stringify(sqlResult, null, 2) : "No result yet"}</pre>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
              <div className="rounded-xl border border-slate-800 p-3 bg-slate-950/50">
                <h4 className="text-sm text-white font-semibold mb-2">Saved Snippets</h4>
                <div className="space-y-1 max-h-48 overflow-auto custom-scrollbar">{sqlSnippets.map((snippet) => <button key={snippet.name} className="w-full text-left px-2 py-1 rounded bg-slate-900 text-xs text-slate-200" onClick={() => setSqlText(snippet.sql)}>{snippet.name}</button>)}</div>
              </div>
              <div className="rounded-xl border border-slate-800 p-3 bg-slate-950/50">
                <h4 className="text-sm text-white font-semibold mb-2">History</h4>
                <div className="space-y-1 max-h-48 overflow-auto custom-scrollbar">{sqlHistory.map((query, idx) => <button key={`${idx}-${query}`} className="w-full text-left px-2 py-1 rounded bg-slate-900 text-xs text-slate-200" onClick={() => setSqlText(query)}>{query.slice(0, 100)}</button>)}</div>
              </div>
            </div>
          </div>
        )}

        {tab === "schema" && (
          <div className="glass-surface rounded-xl border border-slate-700 p-4">
            {!currentResource ? (
              <p className="text-slate-400">Select a resource in Data Explorer first.</p>
            ) : (
              <div className="overflow-x-auto">
                <h2 className="text-xl font-bold text-white mb-3">{currentResource.name}</h2>
                <table className="w-full text-sm">
                  <thead className="text-slate-400"><tr><th className="text-left py-2 pr-4">Field</th><th className="text-left py-2 pr-4">Type</th><th className="text-left py-2 pr-4">Kind</th><th className="text-left py-2 pr-4">Required</th><th className="text-left py-2 pr-4">Unique</th><th className="text-left py-2 pr-4">Relation</th></tr></thead>
                  <tbody className="divide-y divide-slate-800">{currentResource.fields.map((field) => <tr key={field.name}><td className="py-2 pr-4 text-white">{field.name}</td><td className="py-2 pr-4 text-slate-300">{field.type}</td><td className="py-2 pr-4 text-slate-300">{field.kind}</td><td className="py-2 pr-4 text-slate-300">{field.isRequired ? "Yes" : "No"}</td><td className="py-2 pr-4 text-slate-300">{field.isUnique ? "Yes" : "No"}</td><td className="py-2 pr-4 text-slate-300">{field.relationName ?? "-"}</td></tr>)}</tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {confirmState && (
        <div className="fixed inset-0 z-[150] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl border border-rose-600/40 bg-slate-900 p-5">
            <h3 className="text-lg font-bold text-white mb-1">{confirmState.title}</h3>
            <p className="text-sm text-slate-400 mb-3">Type {confirmState.phrase} and enable confirmation.</p>
            <input className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2.5 text-white mb-3" value={confirmInput} onChange={(e) => setConfirmInput(e.target.value)} />
            <label className="flex items-center gap-2 text-sm text-slate-300 mb-4"><input type="checkbox" checked={confirmChecked} onChange={(e) => setConfirmChecked(e.target.checked)} />I understand this is destructive.</label>
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => setConfirmState(null)}>Cancel</Button>
              <Button variant="danger" className="flex-1" onClick={runConfirmAction} isLoading={confirmLoading}>Confirm</Button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};
