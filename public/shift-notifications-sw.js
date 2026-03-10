self.addEventListener('push', (event) => {
  if (!event.data) {
    return;
  }

  const payload = event.data.json();
  event.waitUntil(
    self.registration.showNotification(payload.title || 'TyoTrack', {
      body: payload.body || 'You have an upcoming shift reminder.',
      tag: payload.tag || 'tyotrack-shift-reminder',
      data: payload.data || {}
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => 'focus' in client);
      if (existing) {
        return existing.focus();
      }
      return self.clients.openWindow('/#/my-shifts');
    })
  );
});
