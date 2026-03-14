-- CreateEnum
CREATE TYPE "DbBackupStatus" AS ENUM ('SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "db_backup_logs" (
    "id" TEXT NOT NULL,
    "triggered_by" TEXT NOT NULL,
    "export_type" TEXT NOT NULL,
    "file_path" TEXT,
    "file_size_bytes" INTEGER,
    "duration_ms" INTEGER,
    "status" "DbBackupStatus" NOT NULL,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "db_backup_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "db_backup_logs_status_created_at_idx" ON "db_backup_logs"("status", "created_at");

-- CreateIndex
CREATE INDEX "db_backup_logs_triggered_by_created_at_idx" ON "db_backup_logs"("triggered_by", "created_at");

-- CreateIndex
CREATE INDEX "db_backup_logs_export_type_created_at_idx" ON "db_backup_logs"("export_type", "created_at");
