import { ShiftSourceType, ShiftStatus } from "@prisma/client";
import { z } from "zod";
import { CLOCK_PATTERN } from "./time";

const optionalClockSchema = z.string().regex(CLOCK_PATTERN).optional().nullable();

export const shiftCreateSchema = z.object({
  tenantId: z.string().min(1).optional(),
  workerId: z.string().min(1),
  weekRange: z.string().max(100).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dayOfWeek: z.string().max(20).optional(),
  location: z.string().max(255).optional().nullable(),
  startTime: optionalClockSchema,
  endTime: optionalClockSchema,
  isDayOff: z.boolean().optional().default(false),
  sourceType: z.nativeEnum(ShiftSourceType).optional().default(ShiftSourceType.MANUAL),
  sourceFileName: z.string().max(255).optional().nullable(),
  sourceRowNumber: z.number().int().positive().optional().nullable()
});

export const shiftUpdateSchema = shiftCreateSchema.partial().extend({
  status: z.nativeEnum(ShiftStatus).optional()
});

export const shiftListSchema = z.object({
  tenantId: z.string().optional(),
  workerId: z.string().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.nativeEnum(ShiftStatus).optional(),
  includeDeleted: z.boolean().optional().default(false),
  upcomingOnly: z.boolean().optional().default(false)
});

export const shiftBulkDeleteSchema = z
  .object({
    tenantId: z.string().optional(),
    workerId: z.string().min(1),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
  })
  .refine((payload) => payload.endDate >= payload.startDate, {
    message: "endDate must be on or after startDate",
    path: ["endDate"]
  });

export const shiftReminderSettingsUpdateSchema = z.object({
  tenantId: z.string().optional(),
  emailRemindersEnabled: z.boolean()
});

export const shiftImportPreviewRowSchema = z.object({
  workerId: z.string().min(1),
  workerName: z.string().min(1),
  workerEmail: z.string().email(),
  weekRange: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dayOfWeek: z.string().min(1),
  location: z.string().max(255).nullable().optional(),
  startTime: optionalClockSchema,
  endTime: optionalClockSchema,
  isDayOff: z.boolean(),
  sourceRowNumber: z.number().int().positive(),
  sourceFileName: z.string().max(255).nullable().optional(),
  sourceType: z.nativeEnum(ShiftSourceType).default(ShiftSourceType.IMPORT)
});

export const shiftImportConfirmSchema = z.object({
  tenantId: z.string().optional(),
  fileName: z.string().max(255).optional().nullable(),
  rows: z.array(shiftImportPreviewRowSchema).min(1)
});

export type ShiftCreateInput = z.infer<typeof shiftCreateSchema>;
export type ShiftUpdateInput = z.infer<typeof shiftUpdateSchema>;
export type ShiftImportPreviewRowInput = z.infer<typeof shiftImportPreviewRowSchema>;
export type ShiftBulkDeleteInput = z.infer<typeof shiftBulkDeleteSchema>;
export type ShiftReminderSettingsUpdateInput = z.infer<typeof shiftReminderSettingsUpdateSchema>;
