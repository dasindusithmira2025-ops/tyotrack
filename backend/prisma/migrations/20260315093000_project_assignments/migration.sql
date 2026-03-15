CREATE TABLE "project_assignments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_assignments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "project_assignments_project_id_user_id_key" ON "project_assignments"("project_id", "user_id");
CREATE INDEX "project_assignments_tenant_id_project_id_idx" ON "project_assignments"("tenant_id", "project_id");
CREATE INDEX "project_assignments_tenant_id_user_id_idx" ON "project_assignments"("tenant_id", "user_id");

ALTER TABLE "project_assignments"
ADD CONSTRAINT "project_assignments_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "companies"("tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "project_assignments"
ADD CONSTRAINT "project_assignments_project_id_fkey"
FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_assignments"
ADD CONSTRAINT "project_assignments_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
