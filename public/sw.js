const CACHE_VERSION = 'dev-v6'; // __SW_VERSION_OVERRIDE__
const CACHE_NAME = `aerostrike-omega-${CACHE_VERSION}`;

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/icon.svg',
  '/icon-maskable.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-192.png',
  '/icon-maskable-512.png',
  '/apple-touch-icon.png',
]; // __SW_PRECACHE_OVERRIDE__

function isHashedAsset(pathname) {
  return pathname.startsWith('/assets/');
}

function isStaticAppResource(pathname) {
  return (
    pathname === '/manifest.json' ||
    pathname === '/favicon.svg' ||
    pathname === '/apple-touch-icon.png' ||
    pathname.startsWith('/icon') ||
    pathname.startsWith('/icons/') ||
    pathname.startsWith('/screenshots/')
  );
}

self.addEventListener('install', (event) => {
  const isFirstInstall = !self.registration.active;

  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.allSettled(
        PRECACHE_ASSETS.map(async (asset) => {
          try {
            const req = isHashedAsset(asset)
              ? new Request(asset)
              : new Request(asset, { cache: 'reload' });
            const res = await fetch(req);
            if (res && res.ok) {
              await cache.put(asset, res);
            }
          } catch (err) {
            console.warn('[SW] Precache skipped:', asset, err);
          }
        })
      );
    })
  );

  if (isFirstInstall) {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME && key.startsWith('aerostrike-omega-')) {
              return caches.delete(key);
            }
            return undefined;
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;

  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (data.type === 'GET_CACHE_STATUS') {
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.keys())
      .then((keys) => {
        const payload = {
          type: 'CACHE_STATUS',
          version: CACHE_VERSION,
          cachedCount: keys.length,
        };
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage(payload);
        } else if (event.source && typeof event.source.postMessage === 'function') {
          event.source.postMessage(payload);
        }
      })
      .catch(() => {
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({
            type: 'CACHE_STATUS',
            version: CACHE_VERSION,
            cachedCount: 0,
          });
        }
      });
  }
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) {
    return;
  }

  let requestUrl;
  try {
    requestUrl = new URL(event.request.url);
  } catch {
    return;
  }

  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  // Always bypass cache for sw.js itself so update checks are reliable
  if (requestUrl.pathname === '/sw.js') {
    return;
  }

  const isNavigation =
    event.request.mode === 'navigate' ||
    event.request.headers.get('accept')?.includes('text/html');

  // 1. Navigation / HTML shell: Network-first with resilient offline app-shell fallback
  if (isNavigation) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put('/index.html', clone).catch(() => {});
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          const cachedExact = await caches.match(event.request, { ignoreSearch: true });
          if (cachedExact) return cachedExact;
          const appShell =
            (await caches.match('/index.html')) || (await caches.match('/'));
          if (appShell) return appShell;
          return new Response('Offline — AEROSTRIKE app shell unavailable', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain' },
          });
        })
    );
    return;
  }

  // 2. Hashed build chunks (/assets/*): Cache-first for instant native boot
  if (isHashedAsset(requestUrl.pathname)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse && networkResponse.ok) {
            cache.put(event.request, networkResponse.clone()).catch(() => {});
          }
          return networkResponse;
        } catch {
          return new Response('Offline — Asset unavailable', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain' },
          });
        }
      })
    );
    return;
  }

  // 3. Static icons, manifest, screenshots: Stale-While-Revalidate
  if (isStaticAppResource(requestUrl.pathname)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request, { ignoreSearch: true });
        const networkPromise = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.ok) {
              cache.put(event.request, networkResponse.clone()).catch(() => {});
            }
            return networkResponse;
          })
          .catch(() => null);

        if (cached) {
          event.waitUntil(networkPromise);
          return cached;
        }

        const networkResponse = await networkPromise;
        if (networkResponse) return networkResponse;
        return new Response('Offline — Resource unavailable', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'text/plain' },
        });
      })
    );
    return;
  }

  // 4. Everything else same-origin: Network-first with cache fallback
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.ok) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone).catch(() => {});
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) return cachedResponse;
        return new Response('Offline — Asset unavailable', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'text/plain' },
        });
      })
  );
});
