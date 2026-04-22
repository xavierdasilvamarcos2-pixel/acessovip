// Service Worker - Acesso VIP PWA
// Versão: v12 - Web Push nativo (sem OneSignal)
const CACHE_NAME = 'acesso-vip-v12';
const STATIC_ASSETS = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request, { cache: 'no-cache' }).then((response) => {
      if (response && response.status === 200) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
      }
      return response;
    }).catch(() => caches.match(event.request))
  );
});

// ============================================================
// Web Push - Receber e exibir notificações
// ============================================================
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'Acesso VIP', body: event.data ? event.data.text() : 'Nova notificação' };
  }

  const title = data.title || '🔥 ACESSO VIP';
  const options = {
    body: data.body || data.message || 'Confira as plataformas em alta agora!',
    icon: data.icon || '/icons/icon-192.png',
    badge: data.badge || '/icons/icon-72.png',
    tag: data.tag || 'acesso-vip',
    renotify: true,
    requireInteraction: false,
    data: {
      url: data.url || 'https://acessoplatafomas.com.br/?tab=hot',
    },
  };

  if (data.image) {
    options.image = data.image;
  }

  event.waitUntil(self.registration.showNotification(title, options));
});

// ============================================================
// Clique na notificação - abrir a URL correta
// ============================================================
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = (event.notification.data && event.notification.data.url)
    ? event.notification.data.url
    : 'https://acessoplatafomas.com.br/?tab=hot';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Se já existe uma janela aberta, focar nela e navegar
      for (const client of windowClients) {
        if (client.url.includes('acessoplatafomas.com.br') && 'focus' in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      // Caso contrário, abrir nova janela
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
