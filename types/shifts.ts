export type ShiftStatus = 'ACTIVE' | 'DELETED';
export type ShiftSourceType = 'MANUAL' | 'IMPORT';
export type ShiftNotificationChannel = 'EMAIL' | 'PUSH';
export type ShiftNotificationStatus = 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED';

export interface ShiftDeliveryStatus {
  channel: ShiftNotificationChannel;
  status: ShiftNotificationStatus;
  sentAt: string | null;
  errorMessage: string | null;
}

export interface ShiftRecord {
  id: string;
  tenantId: string;
  workerId: string;
  workerName: string;
  workerEmail: string;
  createdById: string;
  weekRange: string;
  weekStartDate: string;
  weekEndDate: string;
  date: string;
  dayOfWeek: string;
  location: string | null;
  startTime: string | null;
  endTime: string | null;
  isDayOff: boolean;
  notificationSent: boolean;
  notificationSentAt: string | null;
  status: ShiftStatus;
  sourceType: ShiftSourceType;
  sourceFileName: string | null;
  sourceRowNumber: number | null;
  shiftStartAtUtc: string | null;
  shiftEndAtUtc: string | null;
  reminderDueAtUtc: string | null;
  createdAt: string;
  updatedAt: string;
  deliveries: ShiftDeliveryStatus[];
}

export interface ShiftMutationInput {
  tenantId?: string;
  workerId: string;
  weekRange?: string;
  date: string;
  dayOfWeek?: string;
  location?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  isDayOff?: boolean;
}

export interface ShiftImportPreviewRow {
  workerId: string;
  workerName: string;
  workerEmail: string;
  weekRange: string;
  date: string;
  dayOfWeek: string;
  location: string | null;
  startTime: string | null;
  endTime: string | null;
  isDayOff: boolean;
  sourceRowNumber: number;
  sourceFileName?: string | null;
  sourceType?: ShiftSourceType;
}

export interface ShiftImportPreviewError {
  rowNumber: number;
  code: string;
  message: string;
  raw: Record<string, string>;
}

export interface ShiftImportPreviewResult {
  fileName: string;
  rows: ShiftImportPreviewRow[];
  errors: ShiftImportPreviewError[];
  validCount: number;
  errorCount: number;
}
