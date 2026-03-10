import { UserRole } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireAuth, requireRoles, resolveTenant } from "@/lib/auth-guard";
import { jsonError, jsonOk, ApiError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { parseShiftImportPreview } from "@/lib/shift-import/parser";

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    requireRoles(session, [UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN]);

    const form = await req.formData();
    const file = form.get("file");
    const tenantId = resolveTenant(session, typeof form.get("tenantId") === "string" ? String(form.get("tenantId")) : undefined);

    if (!(file instanceof File)) {
      throw new ApiError(400, "Upload file is required");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const preview = await parseShiftImportPreview(prisma, tenantId, file.name, buffer);

    return jsonOk({
      fileName: file.name,
      rows: preview.rows,
      errors: preview.errors,
      validCount: preview.rows.length,
      errorCount: preview.errors.length
    });
  } catch (error) {
    return jsonError(error);
  }
}

