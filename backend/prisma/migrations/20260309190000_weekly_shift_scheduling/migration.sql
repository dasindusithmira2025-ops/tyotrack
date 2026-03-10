-- CreateEnum
CREATE TYPE "ShiftSourceType" AS ENUM ('MANUAL', 'IMPORT');

-- CreateEnum
CREATE TYPE "ShiftStatus" AS ENUM ('ACTIVE', 'DELETED');

-- CreateEnum
CREATE TYPE "ShiftNotificationChannel" AS ENUM ('EMAIL', 'PUSH');

-- CreateEnum
CREATE TYPE "ShiftNotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "shifts" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "worker_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "week_range" TEXT NOT NULL,
    "week_start_date" TEXT NOT NULL,
    "week_end_date" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "day_of_week" TEXT NOT NULL,
    "location" TEXT,
    "start_time" TEXT,
    "end_time" TEXT,
    "shift_start_at_utc" TIMESTAMP(3),
    "shift_end_at_utc" TIMESTAMP(3),
    "reminder_due_at_utc" TIMESTAMP(3),
    "is_day_off" BOOLEAN NOT NULL DEFAULT false,
    "notification_sent" BOOLEAN NOT NULL DEFAULT false,
    "notification_sent_at" TIMESTAMP(3),
    "source_type" "ShiftSourceType" NOT NULL,
    "source_file_name" TEXT,
    "source_row_number" INTEGER,
    "status" "ShiftStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_notification_deliveries" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "shift_id" TEXT NOT NULL,
    "channel" "ShiftNotificationChannel" NOT NULL,
    "status" "ShiftNotificationStatus" NOT NULL DEFAULT 'PENDING',
    "provider_message_id" TEXT,
    "error_message" TEXT,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth_secret" TEXT NOT NULL,
    "user_agent" TEXT,
    "last_seen_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shifts_tenant_id_date_idx" ON "shifts"("tenant_id", "date");

-- CreateIndex
CREATE INDEX "shifts_tenant_id_worker_id_date_idx" ON "shifts"("tenant_id", "worker_id", "date");

-- CreateIndex
CREATE INDEX "shifts_tenant_id_week_start_date_idx" ON "shifts"("tenant_id", "week_start_date");

-- CreateIndex
CREATE INDEX "shifts_tenant_id_reminder_due_at_utc_notification_sent_idx" ON "shifts"("tenant_id", "reminder_due_at_utc", "notification_sent");

-- CreateIndex
CREATE INDEX "shifts_tenant_id_status_date_idx" ON "shifts"("tenant_id", "status", "date");

-- CreateIndex
CREATE INDEX "shift_notification_deliveries_tenant_id_status_created_at_idx" ON "shift_notification_deliveries"("tenant_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "shift_notification_deliveries_tenant_id_shift_id_idx" ON "shift_notification_deliveries"("tenant_id", "shift_id");

-- CreateIndex
CREATE UNIQUE INDEX "shift_notification_deliveries_shift_id_channel_key" ON "shift_notification_deliveries"("shift_id", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscriptions_tenant_id_user_id_idx" ON "push_subscriptions"("tenant_id", "user_id");

-- CreateIndex
CREATE INDEX "push_subscriptions_tenant_id_updated_at_idx" ON "push_subscriptions"("tenant_id", "updated_at");

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "companies"("tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_notification_deliveries" ADD CONSTRAINT "shift_notification_deliveries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "companies"("tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_notification_deliveries" ADD CONSTRAINT "shift_notification_deliveries_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "companies"("tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

