export interface AppNotification {
  id: string;
  type: 'SHIFT_REMINDER';
  title: string;
  message: string;
  payload: Record<string, unknown> | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

