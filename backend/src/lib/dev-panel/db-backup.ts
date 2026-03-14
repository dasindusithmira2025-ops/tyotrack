import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import JSZip from "jszip";
import { DbBackupStatus, PrismaClient } from "@prisma/client";
import { ApiError } from "@/lib/http";
import type { BackupTriggerSource } from "@/lib/dev-panel/auth";

export type BackupExportType = "sql-full" | "sql-schema" | "json" | "csv-zip";

export interface BackupArtifact {
  exportType: BackupExportType;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  durationMs: number;
  buffer: Buffer;
  filePath: string | null;
}

interface CreateExportInput {
  prisma: PrismaClient;
  exportType: BackupExportType;
  triggeredBy: BackupTriggerSource;
  saveToBackupsDir: boolean;
}

function toIsoSafe(value: unknown): string | null {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return null;
}

function normalizeCell(value: unknown): unknown {
  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
}

function toCsvValue(value: unknown): string {
  const normalized = normalizeCell(value);
  if (normalized === null || normalized === undefined) {
    return "";
  }

  const asString = typeof normalized === "string" ? normalized : JSON.stringify(normalized);
  if (/[",\n\r]/.test(asString)) {
    return `"${asString.replace(/"/g, '""')}"`;
  }

  return asString;
}

function buildCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) {
    return "";
  }

  const headerSet = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      headerSet.add(key);
    }
  }

  const headers = Array.from(headerSet);
  const lines = [headers.map((header) => toCsvValue(header)).join(",")];

  for (const row of rows) {
    lines.push(headers.map((header) => toCsvValue(row[header])).join(","));
  }

  return `${lines.join("\n")}\n`;
}

function getTimestampLabel(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${y}-${m}-${d}-${hh}-${mm}-${ss}`;
}

function parseDatabaseUrl(databaseUrl: string) {
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new ApiError(500, "DATABASE_URL is invalid");
  }

  if (!parsed.pathname || parsed.pathname === "/") {
    throw new ApiError(500, "DATABASE_URL does not include a database name");
  }

  return {
    host: parsed.hostname,
    port: parsed.port || "5432",
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: decodeURIComponent(parsed.pathname.replace(/^\//, ""))
  };
}

async function runPgDumpFile(exportType: BackupExportType): Promise<{ filePath: string; sizeBytes: number }> {
  const databaseUrl = process.env.DATABASE_URL ?? "";
  if (!databaseUrl) {
    throw new ApiError(500, "DATABASE_URL is not configured");
  }

  const conn = parseDatabaseUrl(databaseUrl);
  const tmpDir = path.join(os.tmpdir(), "tyotrack-pgdump");
  await fs.mkdir(tmpDir, { recursive: true });

  const timestamp = getTimestampLabel();
  const filePath = path.join(tmpDir, `tyotrack-${exportType}-${timestamp}.sql`);

  const args = [
    "--host",
    conn.host,
    "--port",
    conn.port,
    "--username",
    conn.user,
    "--dbname",
    conn.database,
    "--encoding=UTF8",
    "--no-owner",
    "--no-acl",
    "--clean",
    "--if-exists",
    "--quote-all-identifiers",
    "--file",
    filePath
  ];

  if (exportType === "sql-schema") {
    args.unshift("--schema-only");
  }

  const stderr: string[] = [];

  await new Promise<void>((resolve, reject) => {
    const child = spawn("pg_dump", args, {
      env: {
        ...process.env,
        PGPASSWORD: conn.password
      },
      stdio: ["ignore", "ignore", "pipe"]
    });

    child.stderr.on("data", (chunk) => {
      stderr.push(String(chunk));
    });

    child.on("error", (error) => {
      reject(new ApiError(500, `pg_dump execution failed: ${String(error.message || error)}`));
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new ApiError(500, `pg_dump failed with code ${code}: ${stderr.join("").trim()}`));
        return;
      }
      resolve();
    });
  });

  const stats = await fs.stat(filePath);
  return {
    filePath,
    sizeBytes: stats.size
  };
}

async function getDbSizeBytes(prisma: PrismaClient): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ bytes: bigint | number }>>`SELECT pg_database_size(current_database()) AS bytes`;
  const raw = rows[0]?.bytes;
  if (typeof raw === "bigint") {
    return Number(raw);
  }
  if (typeof raw === "number") {
    return raw;
  }
  return 0;
}

async function getLastMigration(prisma: PrismaClient): Promise<{ name: string | null; finishedAt: string | null }> {
  try {
    const rows = await prisma.$queryRaw<Array<{ migration_name: string; finished_at: Date | null }>>`
      SELECT migration_name, finished_at
      FROM _prisma_migrations
      WHERE finished_at IS NOT NULL
      ORDER BY finished_at DESC
      LIMIT 1
    `;

    const row = rows[0];
    if (!row) {
      return { name: null, finishedAt: null };
    }

    return {
      name: row.migration_name,
      finishedAt: toIsoSafe(row.finished_at)
    };
  } catch {
    return { name: null, finishedAt: null };
  }
}

function getVersionHint(): string | null {
  return process.env.npm_package_version ?? null;
}

async function createJsonSnapshot(prisma: PrismaClient): Promise<Buffer> {
  const [
    users,
    companies,
    timeEntries,
    shifts,
    auditLogs,
    dbBackupLogs,
    dbSizeBytes,
    lastMigration
  ] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        tenantId: true,
        name: true,
        email: true,
        role: true,
        status: true,
        backdateLimitDays: true,
        autoApproveEntries: true,
        createdAt: true,
        updatedAt: true
      }
    }),
    prisma.company.findMany(),
    prisma.timeEntry.findMany(),
    prisma.shift.findMany(),
    prisma.auditLog.findMany(),
    prisma.dbBackupLog.findMany(),
    getDbSizeBytes(prisma),
    getLastMigration(prisma)
  ]);

  const snapshot = {
    metadata: {
      exportedAt: new Date().toISOString(),
      source: "TyoTrack",
      version: getVersionHint(),
      databaseSizeBytes: dbSizeBytes,
      databaseSizeMb: Number((dbSizeBytes / (1024 * 1024)).toFixed(2)),
      lastMigration,
      rowCounts: {
        users: users.length,
        companies: companies.length,
        timeEntries: timeEntries.length,
        shifts: shifts.length,
        auditLogs: auditLogs.length,
        dbBackupLogs: dbBackupLogs.length
      }
    },
    data: {
      users,
      companies,
      timeEntries,
      shifts,
      auditLogs,
      dbBackupLogs
    }
  };

  return Buffer.from(JSON.stringify(snapshot, null, 2), "utf8");
}

async function createCsvZip(prisma: PrismaClient): Promise<Buffer> {
  const zip = new JSZip();
  const tables = [
    "users",
    "companies",
    "time_entries",
    "shifts",
    "shift_notification_deliveries",
    "push_subscriptions",
    "audit_logs",
    "db_backup_logs"
  ];

  for (const table of tables) {
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`SELECT * FROM "${table}" ORDER BY 1`);
    const csv = buildCsv(rows);
    zip.file(`${table}.csv`, csv);
  }

  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 9 } });
}

async function writeToBackupsDir(fileName: string, buffer: Buffer): Promise<string> {
  const directory = process.env.BACKUPS_DIR?.trim() || "/backups";
  await fs.mkdir(directory, { recursive: true });
  const filePath = path.join(directory, fileName);
  await fs.writeFile(filePath, buffer);
  return filePath;
}

export async function createBackupArtifact(input: CreateExportInput): Promise<BackupArtifact> {
  const startedAt = Date.now();
  const timestamp = getTimestampLabel();

  try {
    let fileName = "";
    let contentType = "application/octet-stream";
    let buffer: Buffer;
    let generatedPath: string | null = null;

    if (input.exportType === "sql-full" || input.exportType === "sql-schema") {
      const dump = await runPgDumpFile(input.exportType);
      generatedPath = dump.filePath;
      buffer = await fs.readFile(dump.filePath);
      fileName = `tyotrack-backup-${timestamp}${input.exportType === "sql-schema" ? "-schema" : ""}.sql`;
      contentType = "application/sql; charset=utf-8";
    } else if (input.exportType === "json") {
      buffer = await createJsonSnapshot(input.prisma);
      fileName = `tyotrack-backup-${timestamp}.json`;
      contentType = "application/json; charset=utf-8";
    } else {
      buffer = await createCsvZip(input.prisma);
      fileName = `tyotrack-backup-${timestamp}-tables.zip`;
      contentType = "application/zip";
    }

    const savedFilePath = input.saveToBackupsDir ? await writeToBackupsDir(fileName, buffer) : null;
    const durationMs = Date.now() - startedAt;

    await input.prisma.dbBackupLog.create({
      data: {
        triggeredBy: input.triggeredBy,
        exportType: input.exportType,
        filePath: savedFilePath,
        fileSizeBytes: buffer.length,
        durationMs,
        status: DbBackupStatus.SUCCESS,
        errorMessage: null
      }
    });

    if (generatedPath) {
      void fs.unlink(generatedPath).catch(() => {
        // Ignore cleanup errors for temp dump files.
      });
    }

    return {
      exportType: input.exportType,
      fileName,
      contentType,
      sizeBytes: buffer.length,
      durationMs,
      buffer,
      filePath: savedFilePath
    };
  } catch (error: any) {
    const durationMs = Date.now() - startedAt;
    await input.prisma.dbBackupLog.create({
      data: {
        triggeredBy: input.triggeredBy,
        exportType: input.exportType,
        filePath: null,
        fileSizeBytes: null,
        durationMs,
        status: DbBackupStatus.FAILED,
        errorMessage: String(error?.message || error || "Backup export failed")
      }
    });

    throw error;
  }
}

export function parseExportType(value: string | null | undefined, fallback: BackupExportType = "sql-full"): BackupExportType {
  if (!value) {
    return fallback;
  }

  if (value === "sql-full" || value === "sql-schema" || value === "json" || value === "csv-zip") {
    return value;
  }

  throw new ApiError(400, "Invalid export type");
}

export async function getSystemStats(prisma: PrismaClient) {
  const [
    userCount,
    companyCount,
    timeEntryCount,
    shiftCount,
    shiftDeliveryCount,
    pushSubCount,
    auditCount,
    backupCount,
    dbSizeBytes,
    lastMigration
  ] = await Promise.all([
    prisma.user.count(),
    prisma.company.count(),
    prisma.timeEntry.count(),
    prisma.shift.count(),
    prisma.shiftNotificationDelivery.count(),
    prisma.pushSubscription.count(),
    prisma.auditLog.count(),
    prisma.dbBackupLog.count(),
    getDbSizeBytes(prisma),
    getLastMigration(prisma)
  ]);

  return {
    counts: {
      users: userCount,
      companies: companyCount,
      timeEntries: timeEntryCount,
      shifts: shiftCount,
      shiftNotificationDeliveries: shiftDeliveryCount,
      pushSubscriptions: pushSubCount,
      auditLogs: auditCount,
      dbBackupLogs: backupCount
    },
    databaseSizeBytes: dbSizeBytes,
    databaseSizeMb: Number((dbSizeBytes / (1024 * 1024)).toFixed(2)),
    lastMigration
  };
}
