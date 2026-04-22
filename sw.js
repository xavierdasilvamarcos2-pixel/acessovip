// Service Worker - Acesso VIP PWA
// Versão: v13 - Sem cache do index.html (sempre atualizado)
const CACHE_NAME = 'acesso-vip-v13';
// Não incluir index.html no cache para garantir que o usuário sempre receba a versão mais recente
const STATIC_ASSETS = ['/manifest.json'];

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

// Estratégia: Network First para HTML, Cache First para outros assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Para o index.html e raiz: sempre buscar da rede (nunca do cache)
  if (url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith(
      fetch(event.request, { cache: 'no-cache' })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }
  
  // Para outros assets: cache first
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});

// Web Push - receber notificações
self.addEventListener('push', (event) => {
  let data = { title: 'ACESSO VIP', body: 'Nova mensagem', url: '/' };
  try {
    if (event.data) {
      const text = event.data.text();
      try { data = JSON.parse(text); } catch { data.body = text; }
    }
  } catch (e) {}

  const options = {
    body: data.body || 'Nova mensagem',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/?tab=hot' },
    requireInteraction: false,
    tag: 'acesso-vip-notif',
    renotify: true,
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'ACESSO VIP', options)
  );
});

// Clique na notificação
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url)
    ? event.notification.data.url
    : '/?tab=hot';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('acessoplatafomas.com.br') && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});
