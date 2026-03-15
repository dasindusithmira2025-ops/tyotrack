import type { AppNotification } from '../types/notifications';

const SERVICE_WORKER_PATH = '/shift-notifications-sw.js';

let serviceWorkerRegistrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;

function supportsBrowserNotifications() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

async function registerNotificationServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  if (!serviceWorkerRegistrationPromise) {
    serviceWorkerRegistrationPromise = navigator.serviceWorker
      .register(SERVICE_WORKER_PATH, { scope: '/' })
      .catch((error) => {
        console.warn('failed to register notification service worker', error);
        serviceWorkerRegistrationPromise = null;
        return null;
      });
  }

  return serviceWorkerRegistrationPromise;
}

export async function enableBrowserNotifications(): Promise<string> {
  if (!supportsBrowserNotifications()) {
    throw new Error('This browser does not support notifications');
  }

  const permission = await Notification.requestPermission();

  if (permission !== 'granted') {
    if (permission === 'denied') {
      return 'Browser notification permission was denied';
    }

    return 'Browser notification permission is pending';
  }

  await registerNotificationServiceWorker();
  return 'Browser notifications enabled';
}

export async function showBrowserNotification(notification: AppNotification): Promise<boolean> {
  if (!supportsBrowserNotifications() || Notification.permission !== 'granted') {
    return false;
  }

  const route = typeof notification.payload?.route === 'string' ? notification.payload.route : '/#/my-shifts';
  const registration = await registerNotificationServiceWorker();

  if (registration && 'showNotification' in registration) {
    try {
      await registration.showNotification(notification.title, {
        body: notification.message,
        tag: `tyotrack-${notification.id}`,
        badge: '/favicon.ico',
        icon: '/favicon.ico',
        data: {
          route
        }
      });
      return true;
    } catch (error) {
      console.warn('failed to display service worker notification', error);
    }
  }

  try {
    new Notification(notification.title, {
      body: notification.message,
      tag: `tyotrack-${notification.id}`
    });
    return true;
  } catch (error) {
    console.warn('failed to display browser notification', error);
    return false;
  }
}
