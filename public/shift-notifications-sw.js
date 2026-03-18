self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  const raw = event.data?.text() ?? '{}';
  let payload = {};

  try {
    payload = JSON.parse(raw);
  } catch {
    payload = {
      title: 'TyoTrack Notification',
      body: raw
    };
  }

  const title = payload.title || 'TyoTrack Notification';
  const body = payload.body || '';
  const route = payload.route || '/#/my-shifts';
  const tag = payload.shiftId ? `tyotrack-shift-${payload.shiftId}` : 'tyotrack-notification';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      badge: '/favicon.ico',
      icon: '/favicon.ico',
      data: {
        route
      }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const route = event.notification.data?.route || '/#/my-shifts';
  const targetUrl = new URL(route, self.location.origin).toString();

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('navigate' in client) {
          return client.navigate(targetUrl).then(() => client.focus());
        }

        if ('focus' in client) {
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }

      return undefined;
    })
  );
});
