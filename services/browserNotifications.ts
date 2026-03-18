import type { AppNotification } from '../types/notifications';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';
const SERVICE_WORKER_PATH = '/shift-notifications-sw.js';
const WEB_PUSH_PUBLIC_KEY = (import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY ?? '').trim();

let serviceWorkerRegistrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;

function supportsBrowserNotifications() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

function supportsPushManager() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
}

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);

  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }

  return output;
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

async function syncPushSubscription(subscription: PushSubscription): Promise<void> {
  const payload = subscription.toJSON();
  const endpoint = payload.endpoint;
  const p256dh = payload.keys?.p256dh;
  const auth = payload.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    throw new Error('Push subscription is missing required keys');
  }

  const response = await fetch(`${API_BASE_URL}/api/push-subscriptions`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      endpoint,
      keys: {
        p256dh,
        auth
      }
    })
  });

  if (!response.ok) {
    const payloadData = await response.json().catch(() => ({}));
    throw new Error(payloadData?.error || 'Failed to register push subscription');
  }
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

  const registration = await registerNotificationServiceWorker();
  if (!registration) {
    return 'Browser notifications enabled';
  }

  if (!supportsPushManager()) {
    return 'Browser notifications enabled (push not supported on this browser)';
  }

  if (!WEB_PUSH_PUBLIC_KEY) {
    return 'Browser notifications enabled (configure VITE_WEB_PUSH_PUBLIC_KEY for background push)';
  }

  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(WEB_PUSH_PUBLIC_KEY)
    }));

  await syncPushSubscription(subscription);
  return 'Browser push notifications enabled';
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
