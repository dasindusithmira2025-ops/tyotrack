import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { notificationsApi } from '../services/notificationsApi';
import { showBrowserNotification } from '../services/browserNotifications';

const POLL_INTERVAL_MS = 5000;

function canPollNotifications() {
  return typeof window !== 'undefined';
}

export const ShiftPushRegistrar: React.FC = () => {
  const displayedIdsRef = useRef<Set<string>>(new Set());
  const pollInFlightRef = useRef(false);

  useEffect(() => {
    const user = localStorage.getItem('tyo_user');
    if (!user || !canPollNotifications()) {
      return;
    }

    let stopped = false;

    const poll = async () => {
      if (stopped || pollInFlightRef.current) {
        return;
      }

      pollInFlightRef.current = true;

      try {
        const unread = await notificationsApi.listUnread(20);
        const freshUnread = unread.filter((item) => !displayedIdsRef.current.has(item.id));
        if (!freshUnread.length) {
          return;
        }

        const deliveredIds: string[] = [];

        for (const item of freshUnread) {
          displayedIdsRef.current.add(item.id);

          try {
            const route = typeof item.payload?.route === 'string' ? item.payload.route : '/#/my-shifts';

            toast.info(item.title, {
              id: item.id,
              description: item.message,
              duration: 12000,
              action: {
                label: 'Open',
                onClick: () => {
                  window.location.hash = route.replace(/^#/, '');
                }
              }
            });

            const displayed = await showBrowserNotification(item);
            if (!displayed) {
              console.warn('browser popup not shown; in-app reminder toast displayed instead');
            }

            deliveredIds.push(item.id);
          } catch (error) {
            displayedIdsRef.current.delete(item.id);
            console.warn('failed to show browser notification', error);
          }
        }

        if (deliveredIds.length) {
          try {
            await notificationsApi.markRead(deliveredIds);
          } catch (error) {
            deliveredIds.forEach((id) => displayedIdsRef.current.delete(id));
            console.warn('failed to mark notifications as read', error);
          }
        }
      } catch (error) {
        console.warn('notification polling failed', error);
      } finally {
        pollInFlightRef.current = false;
      }
    };

    const handleFocus = () => {
      void poll();
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        void poll();
      }
    };

    void poll();
    const handle = window.setInterval(() => {
      void poll();
    }, POLL_INTERVAL_MS);

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopped = true;
      window.clearInterval(handle);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return null;
};
