// ==========================================================================
// Service Worker — PeladaPro PWA & Push Notifications
// ==========================================================================

const CACHE_NAME = 'peladapro-v5'; // ← Versão incrementada
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
  '/css/main.css',
  '/css/components.css',
  '/css/responsive.css',
  '/style.css',
  '/js/core/utils.js',
  '/js/team_emblems.js',
  '/js/services/pix_ocr.js',
  '/js/core/api.js',
  '/js/core/auth.js',
  '/js/core/router.js',
  '/js/pwa_installer.js',
  '/js/pwa_push.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('[SW] Pre-cache parcial de recursos:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // ✅ CORRIDO: requisições de API passam direto (sem cache)
  if (event.request.url.includes('/api/') || event.request.url.includes('supabase.co')) {
    event.respondWith(fetch(event.request).catch(() => {
      return new Response('Erro de rede', { status: 503 });
    }));
    return;
  }

  // Estratégia: Network First com fallback para cache
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Atualiza o cache com a resposta nova
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, response.clone());
          return response;
        });
      })
      .catch(() => {
        // Se falhou (offline), tenta do cache
        return caches.match(event.request).then((cached) => {
          return cached || new Response('Conteúdo não disponível', { status: 404 });
        });
      })
  );
});

// ==========================================================================
// 🔔 PUSH NOTIFICATIONS LISTENERS
// ==========================================================================

self.addEventListener('push', (event) => {
  let data = {};

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'PeladaPro ⚽', body: event.data.text() };
    }
  } else {
    data = {
      title: 'PeladaPro ⚽',
      body: 'Você recebeu uma novidade sobre a pelada!'
    };
  }

  const title = data.title || 'PeladaPro ⚽';
  const options = {
    body: data.body || 'Nova notificação da pelada!',
    icon: data.icon || '/assets/icons/push-icon-192.png',
    badge: '/assets/icons/push-icon-192.png',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/#/jogador/convocacao',
      dateOfArrival: Date.now()
    },
    actions: [
      { action: 'open', title: '⚽ Ver Pelada' },
      { action: 'close', title: 'Fechar' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') return;

  const urlToOpen = (event.notification.data && event.notification.data.url)
    ? event.notification.data.url
    : '/#/jogador/convocacao';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});