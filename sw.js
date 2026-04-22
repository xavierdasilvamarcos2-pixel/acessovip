// Service Worker - Acesso VIP PWA
// Versão: v15 - NUNCA cacheia index.html (sempre busca versão mais recente)
const CACHE_NAME = 'acesso-vip-v15';
// NÃO incluir index.html nem / no cache - sempre buscar do servidor
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
      Promise.all(keys.map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  
  const url = new URL(event.request.url);
  
  // NUNCA cachear index.html ou a raiz - sempre buscar do servidor
  if (url.pathname === '/' || url.pathname === '/index.html' || url.pathname.endsWith('/index.html')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .catch(() => caches.match(event.request))
    );
    return;
  }
  
  // Para outros recursos: network first, fallback para cache
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
    badge: data.badge || '/icons/icon-192.png',
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
      for (const client of windowClients) {
        if (client.url.includes('acessoplatafomas.com.br') && 'focus' in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
