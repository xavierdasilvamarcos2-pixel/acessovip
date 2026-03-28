// OneSignal Service Worker - ACESSO VIP
// Importar o SDK do OneSignal (OBRIGATÓRIO para push notifications)
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");

// ===== FIREBASE POLLING PARA NOTIFICAÇÕES =====
const FIREBASE_DB_URL = 'https://acessovip-fb4c3-default-rtdb.firebaseio.com';
const FIREBASE_API_KEY = 'AIzaSyD5rgvnm8Ytu0XqISzq7fYCk0p_PYEiuI4';
const APP_ICON = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663105165765/agqsVYAvwswSLNhYS3MGCB/acesso-vip-logo-bUbTNEga7afwRGFoEPyva6.webp';

// Guarda o timestamp da última notificação exibida para não repetir
let lastNotifTimestamp = 0;

async function checkPendingNotifications() {
  try {
    const resp = await fetch(`${FIREBASE_DB_URL}/pending_notifications.json?auth=${FIREBASE_API_KEY}`);
    if (!resp.ok) return;
    const data = await resp.json();
    if (!data) return;

    const now = Date.now();
    // Ordenar por timestamp para processar na ordem certa
    const entries = Object.entries(data).sort((a, b) =>
      (a[1].timestamp || 0) - (b[1].timestamp || 0)
    );

    for (const [key, notif] of entries) {
      if (!notif || notif.sent) continue;
      if (!notif.timestamp) continue;
      // Só notificações dos últimos 5 minutos e mais novas que a última exibida
      if ((now - notif.timestamp) > 300000) continue;
      if (notif.timestamp <= lastNotifTimestamp) continue;

      // Montar opções da notificação
      const options = {
        body: notif.body || notif.message || '',
        icon: APP_ICON,
        badge: APP_ICON,
        data: { url: notif.url || 'https://xavierdasilvamarcos2-pixel.github.io/acessovip/' },
        requireInteraction: false,
        tag: key,
        vibrate: [200, 100, 200],
      };
      if (notif.image) options.image = notif.image;

      // Exibir a notificação
      await self.registration.showNotification(notif.title || 'ACESSO VIP', options);
      lastNotifTimestamp = notif.timestamp;

      // Marcar como enviada no Firebase
      fetch(`${FIREBASE_DB_URL}/pending_notifications/${key}.json?auth=${FIREBASE_API_KEY}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sent: true })
      }).catch(() => {});
    }
  } catch(e) {}
}

// ===== ESTRATÉGIA DE POLLING =====
// Service workers são suspensos pelo browser quando não há atividade.
// A solução é usar o evento 'fetch' como gatilho: toda vez que o app
// faz qualquer requisição de rede, o SW acorda e verifica notificações.
let lastPollTime = 0;
const POLL_COOLDOWN = 20000; // No mínimo 20s entre verificações

self.addEventListener('fetch', (event) => {
  const now = Date.now();

  // Verificar notificações pendentes a cada 20s quando o app está ativo
  if (now - lastPollTime > POLL_COOLDOWN) {
    lastPollTime = now;
    // Não bloqueia o fetch — roda em paralelo
    event.waitUntil(checkPendingNotifications());
  }

  // Lógica normal de cache
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.hostname.includes('firebase') || url.hostname.includes('googleapis') ||
      url.hostname.includes('onesignal') || url.hostname.includes('gstatic') ||
      url.hostname.includes('cloudfront') || url.hostname.includes('googletagmanager')) {
    return;
  }
  event.respondWith(
    fetch(event.request, { cache: 'no-cache' })
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open('acesso-vip-v6').then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// Instalar e ativar
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter(k => k !== 'acesso-vip-v6').map(k => caches.delete(k)));
      await self.clients.claim();
      // Verificar imediatamente ao ativar
      await checkPendingNotifications();
    })()
  );
});

// Verificar quando o app envia mensagem explícita
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CHECK_NOTIFICATIONS') {
    checkPendingNotifications();
  }
});

// Handler de clique na notificação
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) ||
              'https://xavierdasilvamarcos2-pixel.github.io/acessovip/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('acessovip') && 'focus' in client) {
          client.postMessage({ type: 'NOTIFICATION_CLICK', url });
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
