// OneSignal Service Worker - ACESSO VIP
// Este arquivo combina o OneSignal SDK com o service worker do PWA

// Importar o SDK do OneSignal (OBRIGATÓRIO para push notifications)
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");

// Cache do PWA
const CACHE_NAME = 'acesso-vip-v4';
const STATIC_ASSETS = ['/acessovip/', '/acessovip/index.html', '/acessovip/manifest.json'];

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

// Sempre busca da rede primeiro, cache só como fallback offline
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  
  const url = new URL(event.request.url);
  
  // Para Firebase e APIs externas: sempre rede, nunca cache
  if (url.hostname.includes('firebase') || url.hostname.includes('googleapis') || 
      url.hostname.includes('onesignal')) {
    return; // Deixa passar sem interceptar
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

// Notificação click handler
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
