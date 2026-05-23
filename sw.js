// Service Worker - Acesso VIP PWA
// Versão: v20 - Força atualização imediata + notifica clientes para recarregar
const CACHE_NAME = 'acesso-vip-v20';
// NÃO incluir index.html nem / no cache - sempre buscar do servidor
const STATIC_ASSETS = ['/manifest.json'];
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS).catch(() => {}))
  );
  // Força ativação imediata sem esperar fechar abas antigas
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => caches.delete(k)))
    ).then(() => {
      // Toma controle imediato de todas as abas/janelas abertas
      return self.clients.claim();
    }).then(() => {
      // Notifica todos os clientes para recarregar a página
      return self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    }).then((clients) => {
      clients.forEach((client) => {
        // Envia mensagem para o app recarregar e pegar o novo HTML
        client.postMessage({ type: 'SW_UPDATED', version: 'v20' });
      });
    })
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
