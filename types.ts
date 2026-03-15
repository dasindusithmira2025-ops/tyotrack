
export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  COMPANY_ADMIN = 'COMPANY_ADMIN',
  EMPLOYEE = 'EMPLOYEE',
}

export enum EntryStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  companyId?: string;
  avatar?: string;
  status?: 'ACTIVE' | 'SUSPENDED';
  autoApproveEntries?: boolean;
}

export interface Company {
  id: string;
  name: string;
  email?: string;     // Added
  timezone: string;
  eveningStart: string; // "18:00"
  eveningEnd: string;   // "22:00"
  nightStart: string;   // "22:00"
  nightEnd: string;     // "06:00"
}

export interface Workspace {
  id: string;
  name: string;
  companyId: string;
  status?: 'ACTIVE' | 'ARCHIVED';
}

export interface Project {
  id: string;
  name: string;
  workspaceId?: string | null;
  color: string;
  status: 'ACTIVE' | 'ARCHIVED';
  totalHoursLogged?: number;
  assignedEmployeeCount?: number;
}

export interface TimeEntry {
  id: string;
  userId: string;
  workspaceId?: string;
  projectId: string;
  startTime: string; // ISO String
  endTime: string;   // ISO String
  notes?: string;
  status: EntryStatus;
  eveningHours: number;
  nightHours: number;
  totalHours: number;
  date: string; // YYYY-MM-DD for grouping
  rejectionReason?: string;
}

export interface EmployeeProfile {
  id: string;
  userId: string;
  backdateLimitDays: number;
  autoApproveEntries?: boolean;
}

export interface AuditLog {
  id: string;
  companyId: string;
  userId: string;
  userName: string;
  action: string;     // e.g., "CREATE_ENTRY", "APPROVE_ENTRY", "UPDATE_POLICY"
  entity: string;     // e.g., "TimeEntry", "CompanyPolicy"
  details: string;
  timestamp: string;
}
