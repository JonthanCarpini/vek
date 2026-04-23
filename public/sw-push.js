/* Service Worker — Web Push para o app Delivery.
 * Registrado em /delivery via PushManager quando o usuário autoriza notificações.
 * Recebe payloads JSON com { title, body, icon, url, tag, data }.
 */

self.addEventListener('install', () => {
  // Ativa imediatamente após instalar (evita esperar reload)
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Nova notificação', body: event.data.text() };
  }

  const title = payload.title || 'Mesa Digital';
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icon-192.png',
    badge: payload.badge || '/icon-192.png',
    tag: payload.tag,
    data: {
      url: payload.url || '/delivery/pedidos',
      ...(payload.data || {}),
    },
    // Vibração breve (Android)
    vibrate: [100, 50, 100],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/delivery/pedidos';

  event.waitUntil((async () => {
    const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    // Se uma aba do app já está aberta, foca e navega nela
    for (const client of allClients) {
      if (client.url.includes('/delivery') && 'focus' in client) {
        client.postMessage({ type: 'navigate', url: targetUrl });
        return client.focus();
      }
    }
    // Senão, abre nova aba
    if (clients.openWindow) {
      return clients.openWindow(targetUrl);
    }
  })());
});
