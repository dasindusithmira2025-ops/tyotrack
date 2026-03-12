import { shiftsApi } from './shiftsApi';

const SERVICE_WORKER_PATH = '/shift-notifications-sw.js';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';
let cachedPublicKey: string | null = null;

async function getPublicKey(): Promise<string> {
  if (cachedPublicKey) {
    return cachedPublicKey;
  }

  const envKey = import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY;
  if (envKey) {
    cachedPublicKey = envKey;
    return envKey;
  }

  const response = await fetch(`${API_BASE_URL}/api/push-subscriptions`, {
    method: 'GET',
    credentials: 'include'
  });

  const payload = await response.json().catch(() => ({}));
  const key = payload?.data?.publicKey;
  if (!response.ok || !key) {
    throw new Error('Browser notifications are not configured for this environment');
  }

  cachedPublicKey = key;
  return key;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  const registration = await navigator.serviceWorker.register(SERVICE_WORKER_PATH, { scope: '/' });
  await navigator.serviceWorker.ready;
  return registration;
}

async function ensureSubscription(promptUser: boolean): Promise<string> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('This browser does not support browser notifications');
  }

  if (promptUser) {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return 'Browser notification permission was not granted';
    }
  } else if (Notification.permission !== 'granted') {
    return 'Browser notification permission is not granted';
  }

  const registration = await registerServiceWorker();
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    const publicKey = await getPublicKey();
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    });
  }

  await shiftsApi.subscribeBrowserNotifications(subscription.toJSON());
  return 'Browser notifications enabled';
}

export async function syncBrowserNotificationsSilently(): Promise<void> {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  try {
    await ensureSubscription(false);
  } catch (error) {
    console.warn('browser notification sync failed', error);
  }
}

export async function enableBrowserNotifications(): Promise<string> {
  if (!('Notification' in window)) {
    throw new Error('This browser does not support notifications');
  }

  return ensureSubscription(true);
}
