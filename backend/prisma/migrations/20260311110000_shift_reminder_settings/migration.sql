-- CreateTable
CREATE TABLE "shift_reminder_settings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "email_reminders_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_reminder_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shift_reminder_settings_tenant_id_key" ON "shift_reminder_settings"("tenant_id");

-- AddForeignKey
ALTER TABLE "shift_reminder_settings" ADD CONSTRAINT "shift_reminder_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "companies"("tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;
