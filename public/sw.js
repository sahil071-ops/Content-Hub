/**
 * Axis Content Hub — Service Worker
 *
 * Strategy:
 * - Network-first for all HTML/API requests (always get fresh content)
 * - Cache-first for static assets (_next/static) with long TTL
 * - On version change: notify the page → page shows toast → reloads
 */

const CACHE_NAME = 'axis-content-hub-v1';
const STATIC_CACHE_NAME = 'axis-static-v1';

// Stored version info for detecting updates
let currentBuildId = null;

// ── Install: cache shell ────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(['/']);
    })
  );
  // Take over immediately without waiting for old SW to die
  self.skipWaiting();
});

// ── Activate: clean up old caches ──────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME && key !== STATIC_CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      ),
      // Claim all clients immediately
      self.clients.claim(),
    ])
  );
});

// ── Fetch: network-first for navigation, cache-first for static ─
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and cross-origin requests
  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // Cache-first for Next.js static assets (content-hashed, safe to cache forever)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.open(STATIC_CACHE_NAME).then((cache) =>
        cache.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request).then((response) => {
            if (response.ok) {
              cache.put(request, response.clone());
            }
            return response;
          });
        })
      )
    );
    return;
  }

  // Skip service worker script and manifest
  if (url.pathname === '/sw.js' || url.pathname === '/manifest.json') {
    return;
  }

  // Network-first for everything else (HTML pages, API routes)
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Check version on navigation requests
        if (request.mode === 'navigate') {
          checkForUpdate(response.clone());
        }
        return response;
      })
      .catch(() => {
        // Offline fallback: serve cached version if available
        return caches.match(request) || caches.match('/');
      })
  );
});

// ── Version check logic ─────────────────────────────────────────
async function checkForUpdate(response) {
  try {
    // Fetch version from API
    const versionResponse = await fetch('/api/version');
    if (!versionResponse.ok) return;

    const { buildId, version } = await versionResponse.json();

    if (currentBuildId === null) {
      // First load — store the build ID
      currentBuildId = buildId;
      return;
    }

    if (buildId !== currentBuildId) {
      // Version changed! Notify all clients
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach((client) => {
        client.postMessage({
          type: 'APP_UPDATED',
          version,
          buildId,
        });
      });
      currentBuildId = buildId;
    }
  } catch {
    // Silently ignore version check errors — don't break the app
  }
}

// ── Message handling ────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data?.type === 'GET_VERSION') {
    event.source?.postMessage({
      type: 'VERSION_RESPONSE',
      buildId: currentBuildId,
    });
  }
});
