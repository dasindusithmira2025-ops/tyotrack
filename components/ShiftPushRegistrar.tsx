import { useEffect } from 'react';
import { syncBrowserNotificationsSilently } from '../services/browserNotifications';

export const ShiftPushRegistrar: React.FC = () => {
  useEffect(() => {
    const user = localStorage.getItem('tyo_user');
    if (!user) {
      return;
    }

    void syncBrowserNotificationsSilently();
  }, []);

  return null;
};
