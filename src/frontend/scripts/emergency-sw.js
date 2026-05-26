const CACHE_NAME = 'accelzero-v2';
const STATIC_CACHES = [
  '/',
  '/index.html',
  '/styles/main.css',
  '/scripts/emergency.js',
  '/pages/emergency.html',
  '/images/logo.png',
  '/images/chatbot-avatar.png'
];

const OFFLINE_EMERGENCY_DB = 'accelzero-emergency';
const DB_VERSION = 1;

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_CACHES).catch(() => {
        return Promise.resolve();
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkWithFallback(event.request));
    return;
  }

  if (url.pathname.match(/\.(js|css|html)$/)) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).then(response => {
        if (response.ok && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        if (url.pathname.includes('/pages/emergency')) {
          return caches.match('/pages/emergency.html');
        }
        if (url.pathname.includes('.html')) {
          return caches.match('/index.html');
        }
        return new Response('Offline', { status: 503 });
      });
    })
  );
});

function networkFirst(request) {
  return fetch(request).then(response => {
    if (response.ok && response.type === 'basic') {
      const clone = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
    }
    return response;
  }).catch(() => {
    return caches.match(request).then(cached => {
      return cached || new Response('Offline', { status: 503 });
    });
  });
}

function networkWithFallback(request) {
  return fetch(request).then(response => {
    if (response.ok) {
      const clone = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
    }
    return response;
  }).catch(() => {
    return new Response(JSON.stringify({ offline: true, message: 'You are offline' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  });
}

self.addEventListener('message', event => {
  if (event.data?.type === 'SYNC_EMERGENCY') {
    syncPendingEmergency();
  }
});

async function syncPendingEmergency() {
  try {
    const db = await openEmergencyDB();
    const tx = db.transaction('pending', 'readonly');
    const store = tx.objectStore('pending');
    const all = await store.getAll();

    for (const item of all) {
      try {
        const res = await fetch('/api/v1/emergency/sos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item.data)
        });
        if (res.ok) {
          const deleteTx = db.transaction('pending', 'readwrite');
          deleteTx.objectStore('pending').delete(item.id);
          await deleteTx.done;

          const clients = await self.clients.matchAll();
          clients.forEach(client => {
            client.postMessage({ type: 'EMERGENCY_SYNCED', id: item.id });
          });
        }
      } catch (e) {
        break;
      }
    }
  } catch (e) {}
}

function openEmergencyDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(OFFLINE_EMERGENCY_DB, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('pending')) {
        db.createObjectStore('pending', { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

self.addEventListener('sync', event => {
  if (event.tag === 'sync-emergency') {
    event.waitUntil(syncPendingEmergency());
  }
});
