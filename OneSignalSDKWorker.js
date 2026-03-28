// OneSignal Service Worker - ACESSO VIP
// Importar o SDK do OneSignal (OBRIGATÓRIO para push notifications)
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");

// ===== FIREBASE POLLING PARA NOTIFICAÇÕES =====
// O admin salva notificações no Firebase, o SW faz polling e exibe localmente
const FIREBASE_DB_URL = 'https://acessovip-fb4c3-default-rtdb.firebaseio.com';
const FIREBASE_API_KEY = 'AIzaSyD5rgvnm8Ytu0XqISzq7fYCk0p_PYEiuI4';
const POLL_INTERVAL = 30000; // 30 segundos
let lastChecked = Date.now() - 60000; // Verificar notificações do último minuto ao iniciar

async function checkPendingNotifications() {
  try {
    const url = `${FIREBASE_DB_URL}/pending_notifications.json?auth=${FIREBASE_API_KEY}`;
    const resp = await fetch(url);
    if (!resp.ok) return;
    const data = await resp.json();
    if (!data) return;

    const now = Date.now();
    const entries = Object.entries(data);
    for (const [key, notif] of entries) {
      // Só processar notificações novas (últimos 5 minutos) e não enviadas
      if (notif && !notif.sent && notif.timestamp && (now - notif.timestamp) < 300000) {
        // Mostrar a notificação
        const notifOptions = {
          body: notif.body || notif.message || '',
          icon: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663105165765/agqsVYAvwswSLNhYS3MGCB/acesso-vip-logo-bUbTNEga7afwRGFoEPyva6.webp',
          badge: 'https://xavierdasilvamarcos2-pixel.github.io/acessovip/icons/icon-72.png',
          data: { url: notif.url || 'https://xavierdasilvamarcos2-pixel.github.io/acessovip/' },
          requireInteraction: false,
          tag: key,
        };
        // Adicionar imagem grande se fornecida
        if (notif.image) {
          notifOptions.image = notif.image;
        }
        await self.registration.showNotification(notif.title || 'ACESSO VIP', notifOptions);

        // Marcar como enviada no Firebase
        try {
          await fetch(`${FIREBASE_DB_URL}/pending_notifications/${key}.json?auth=${FIREBASE_API_KEY}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sent: true })
          });
        } catch(e) {}
      }
    }
    lastChecked = now;
  } catch(e) {
    // Silencioso - não interrompe o SW
  }
}

// Iniciar polling quando o SW ativa
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Limpar caches antigos
      const keys = await caches.keys();
      await Promise.all(keys.filter(k => k !== 'acesso-vip-v5').map(k => caches.delete(k)));
      await self.clients.claim();
      // Verificar notificações imediatamente
      await checkPendingNotifications();
      // Polling a cada 30s
      setInterval(checkPendingNotifications, POLL_INTERVAL);
    })()
  );
});

// Instalar o SW
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Verificar quando o app envia mensagem
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

// Cache do PWA
const CACHE_NAME = 'acesso-vip-v5';

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  // Para Firebase e APIs externas: sempre rede, nunca cache
  if (url.hostname.includes('firebase') || url.hostname.includes('googleapis') ||
      url.hostname.includes('onesignal') || url.hostname.includes('gstatic')) {
    return;
  }
  // Para o app: rede primeiro, cache como fallback
  event.respondWith(
    fetch(event.request, { cache: 'no-cache' })
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
