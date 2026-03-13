import { useEffect } from 'react';
import { notificationsApi } from '../services/notificationsApi';

const POLL_INTERVAL_MS = 30000;

function canDisplayBrowserNotifications() {
  return typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted';
}

export const ShiftPushRegistrar: React.FC = () => {
  useEffect(() => {
    const user = localStorage.getItem('tyo_user');
    if (!user) {
      return;
    }

    let stopped = false;

    const poll = async () => {
      if (!canDisplayBrowserNotifications()) {
        return;
      }

      try {
        const unread = await notificationsApi.listUnread(20);
        if (!unread.length) {
          return;
        }

        for (const item of unread) {
          try {
            new Notification(item.title, {
              body: item.message,
              tag: `tyotrack-${item.id}`
            });
          } catch (error) {
            console.warn('failed to show browser notification', error);
          }
        }

        await notificationsApi.markRead(unread.map((item) => item.id));
      } catch (error) {
        console.warn('notification polling failed', error);
      }
    };

    void poll();
    const handle = window.setInterval(() => {
      if (!stopped) {
        void poll();
      }
    }, POLL_INTERVAL_MS);

    return () => {
      stopped = true;
      window.clearInterval(handle);
    };
  }, []);

  return null;
};

