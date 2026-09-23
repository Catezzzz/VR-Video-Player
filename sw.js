// sw.js
// Service Worker for the installed Quest app only. Desktop/browser access
// (including your usual incognito testing) never calls register() on this
// — see js/offline-install.js — so this file has zero effect there.
//
// Once registered, it intercepts every fetch for JSON and video assets so
// the installed app can run fully offline after its one-time download.
//
// IMPORTANT: CACHE_VERSION here must match CACHE_VERSION in js/config.js.
// Bump both together whenever a content change (new/edited scenario or
// video) should reach installed devices — that forces old cached data to
// be dropped and refetched on next launch.
const CACHE_VERSION = 'v1';
const CACHE_NAME = `content-${CACHE_VERSION}`;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

// Video elements issue many small Range requests per second while playing,
// not one request for the whole file. Re-reading the full cached file into
// a Blob on every single one of those (as a naive implementation would) is
// what actually caused the near-frozen playback — it wasn't a decode
// problem, it was the Service Worker re-reading a huge file off disk
// dozens of times a second. This map keeps the materialized Blob around
// per URL so repeat Range requests for the same video are effectively
// free. Capped small since only the current (and maybe previous) video
// need to stay warm.
const blobCache = new Map();
const BLOB_CACHE_LIMIT = 2;

async function getBlobFor(url, cachedResponse) {
  if (blobCache.has(url)) return blobCache.get(url);
  const blob = await cachedResponse.blob();
  if (blobCache.size >= BLOB_CACHE_LIMIT) {
    const oldestKey = blobCache.keys().next().value;
    blobCache.delete(oldestKey);
  }
  blobCache.set(url, blob);
  return blob;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req, { ignoreSearch: true, ignoreVary: true });

    if (cached) {
      const range = req.headers.get('range');
      return range ? rangedResponse(cached, range, req.url) : cached;
    }

    // Not cached — shouldn't normally happen once the initial download is
    // done, but covers anything added after the fact. Falls back to
    // network and stashes a copy for next time.
    try {
      const netRes = await fetch(req);
      if (netRes.ok && netRes.type !== 'opaque') {
        cache.put(req, netRes.clone());
      }
      return netRes;
    } catch (err) {
      return new Response('Offline and not yet cached.', { status: 503 });
    }
  })());
});

// Slices a fully-cached Response to satisfy a Range request, so
// scrubbing/seeking on cached video behaves the same as it does streaming
// live. Without this, the video element can only play cached video start
// to finish and seeking breaks.
async function rangedResponse(cachedResponse, rangeHeader, url) {
  const blob = await getBlobFor(url, cachedResponse);
  const size = blob.size;
  const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader) || [];
  let start = match[1] ? parseInt(match[1], 10) : 0;
  let end   = match[2] ? parseInt(match[2], 10) : size - 1;
  end = Math.min(end, size - 1);
  if (start > end) start = 0;

  const slice = blob.slice(start, end + 1);
  const headers = new Headers(cachedResponse.headers);
  headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
  headers.set('Content-Length', String(slice.size));
  headers.set('Accept-Ranges', 'bytes');

  return new Response(slice, { status: 206, statusText: 'Partial Content', headers });
}
