/* Handlers de Web Push — importado pelo service worker gerado pelo vite-plugin-pwa. */
self.addEventListener('push', event => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = { title: 'Visita IA', body: event.data && event.data.text() }; }
  const title = d.title || 'Visita IA';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: d.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: d.tag || 'crm',
      renotify: true,
      data: { url: d.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if ('focus' in c) { c.navigate(url); return c.focus(); }
      }
      return self.clients.openWindow(url);
    }),
  );
});
