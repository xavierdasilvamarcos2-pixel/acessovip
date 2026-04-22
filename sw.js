// Service Worker v14 - Limpa todos os caches antigos, nunca cacheia index.html
const CACHE_NAME = 'acessovip-v14';
const STATIC_ASSETS = [
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// Instalação: criar cache novo
self.addEventListener('install', event => {
  console.log('[SW v14] Instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(() => {});
    })
  );
  // Ativar imediatamente sem esperar tabs fecharem
  self.skipWaiting();
});

// Ativação: deletar TODOS os caches antigos
self.addEventListener('activate', event => {
  console.log('[SW v14] Ativando - limpando caches antigos...');
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => {
          console.log('[SW v14] Deletando cache antigo:', key);
          return caches.delete(key);
        })
      );
    }).then(() => {
      // Tomar controle de todos os clientes imediatamente
      return self.clients.claim();
    })
  );
});

// Fetch: NUNCA cachear index.html - sempre buscar da rede
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // index.html e raiz: SEMPRE da rede (nunca do cache)
  if (url.pathname === '/' || url.pathname === '/index.html' || url.pathname.endsWith('/')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        // Se offline, tentar do cache como último recurso
        return caches.match('/index.html');
      })
    );
    return;
  }
  
  // sw.js: SEMPRE da rede
  if (url.pathname === '/sw.js') {
    event.respondWith(fetch(event.request));
    return;
  }
  
  // Outros assets: cache first
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);
    })
  );
});

// Push notifications
self.addEventListener('push', event => {
  let data = { title: 'ACESSO VIP', body: 'Nova notificação', url: '/?tab=hot' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch(e) {}
  
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: data.url || '/?tab=hot' },
      requireInteraction: false,
      vibrate: [200, 100, 200]
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/?tab=hot';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
