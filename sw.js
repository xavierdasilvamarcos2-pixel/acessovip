// Service Worker - Acesso VIP PWA
// Versão: v17 - Ícone com URL absoluta + fallback para data.image
const CACHE_NAME = 'acesso-vip-v17';
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
  // Ícone: usar data.icon, depois data.image, depois URL absoluta do app (nunca path relativo)
  const defaultIcon = 'https://acessoplatafomas.com.br/icons/icon-192.png';
  const notifIcon = (data.icon && data.icon.startsWith('http')) ? data.icon
    : (data.image && data.image.startsWith('http')) ? data.image
    : defaultIcon;
  const options = {
    body: data.body || data.message || 'Confira as plataformas em alta agora!',
    icon: notifIcon,
    badge: (data.badge && data.badge.startsWith('http')) ? data.badge : 'https://acessoplatafomas.com.br/icons/notif-icon-mono.png',
    tag: data.tag || 'acesso-vip',
    renotify: true,
    requireInteraction: false,
    data: {
      url: data.url || 'https://acessoplatafomas.com.br/?tab=hot',
      platId: data.platId || null,
    },
  };
  if (data.image && data.image.startsWith('http')) {
    options.image = data.image;
  }
  event.waitUntil(self.registration.showNotification(title, options));
});

// ============================================================
// Clique na notificação - abrir a URL correta
// ============================================================
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const notifData = event.notification.data || {};
  const notifUrl = notifData.url || 'https://acessoplatafomas.com.br/?tab=hot';
  const platId = notifData.platId || null;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Se o app já está aberto, focar e navegar via postMessage
      for (const client of windowClients) {
        if (client.url.includes('acessoplatafomas.com.br') && 'focus' in client) {
          client.focus();
          try {
            const urlObj = new URL(notifUrl);
            const tab = urlObj.searchParams.get('tab') || 'hot';
            const msg = { type: 'NAVIGATE_TAB', tab: tab };
            if (platId) msg.platId = platId;
            client.postMessage(msg);
          } catch(e) {
            client.navigate(notifUrl);
          }
          return;
        }
      }
      // App fechado: abrir com o URL correto (incluir platId se disponível)
      if (clients.openWindow) {
        let openUrl = notifUrl;
        if (platId) {
          try {
            const u = new URL(notifUrl);
            u.searchParams.set('plataforma', String(platId));
            openUrl = u.toString();
          } catch(e) {}
        }
        return clients.openWindow(openUrl);
      }
    })
  );
});
