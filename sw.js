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

// Checks each already-known content URL's ETag against the live one and
// only refetches files that actually changed — an edited video or scenario
// JSON updates on its own, without a manual CACHE_VERSION bump (which
// wipes and redownloads everything). Lives here, not in offline-install.js,
// because a check made from the page would get intercepted by our own
// fetch handler below and just hand back the stale cached copy — a fetch
// the Service Worker makes on its own doesn't re-trigger its own
// interception, so this is the only place it can actually reach network.
const ETAG_MANIFEST_KEY = '/__etag_manifest__';

// Mirrors collectAllUrls() in js/offline-install.js, deliberately
// duplicated rather than shared — this crawl has to run from inside the
// Service Worker itself. If it ran from the page instead, fetching an
// already-cached JSON path would hit our OWN fetch handler below and get
// served the stale cached copy, making the crawl blind to exactly the
// kind of edit (a changed video link inside an existing JSON file) this
// feature exists to catch.
//
// IMPORTANT: MANIFEST_URL here must match MANIFEST_URL in js/config.js.
const MANIFEST_URL = 'scenarios/scenarios.json';

async function collectAllUrls() {
  const urls = new Set([MANIFEST_URL]);
  const visited = new Set();

  const manifest = await fetch(MANIFEST_URL, { cache: 'no-store' }).then((r) => r.json());
  const queue = manifest.map((entry) => entry.intro).filter(Boolean);
  for (const entry of manifest) {
    if (entry.thumbnail) urls.add(entry.thumbnail);
  }

  while (queue.length) {
    const jsonPath = queue.shift();
    if (visited.has(jsonPath)) continue;
    visited.add(jsonPath);
    urls.add(jsonPath);

    let node;
    try {
      node = await fetch(jsonPath, { cache: 'no-store' }).then((r) => r.json());
    } catch (err) {
      continue;
    }

    const base = jsonPath.substring(0, jsonPath.lastIndexOf('/') + 1);
    if (node.video) {
      urls.add(node.video.startsWith('http') ? node.video : base + node.video);
    }
    if (node.subtitles) {
      urls.add(node.subtitles.startsWith('http') ? node.subtitles : base + node.subtitles);
    }
    if (node.next) queue.push(node.next);
    for (const choice of node.decision?.choices || []) {
      if (choice.next) queue.push(choice.next);
    }
  }

  return [...urls];
}

async function readEtagManifest(cache) {
  const res = await cache.match(ETAG_MANIFEST_KEY);
  if (!res) return {};
  try { return await res.json(); } catch { return {}; }
}

async function writeEtagManifest(cache, manifest) {
  await cache.put(ETAG_MANIFEST_KEY, new Response(JSON.stringify(manifest)));
}

async function checkForContentUpdates() {
  const urls = await collectAllUrls(); // always a fresh read, see above
  const cache = await caches.open(CACHE_NAME);
  const manifest = await readEtagManifest(cache);
  const toUpdate = [];

  for (const url of urls) {
    try {
      const head = await fetch(url, { method: 'HEAD', cache: 'no-store' });
      const liveEtag = head.headers.get('etag');
      const knownEtag = manifest[url];

      if (liveEtag && knownEtag && liveEtag !== knownEtag) {
        toUpdate.push(url); // confirmed changed
      } else if (!knownEtag) {
        // No baseline recorded yet — either a brand-new file (new
        // scenario branch) or one cached before this feature existed.
        // Only actually fetch it if we don't already have a cached copy;
        // otherwise just record its ETag as the new baseline, so
        // upgrading to this feature never triggers a surprise mass
        // redownload of an already-complete library.
        const already = await cache.match(url);
        if (!already) {
          toUpdate.push(url);
        } else if (liveEtag) {
          manifest[url] = liveEtag;
        }
      }
    } catch (err) {
      // Offline, or this one file unreachable — leave the cached copy as
      // it is and try again next launch.
    }
  }

  for (const url of toUpdate) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) {
        await cache.put(url, res.clone());
        const etag = res.headers.get('etag');
        if (etag) manifest[url] = etag;
      }
    } catch (err) {
      console.warn('[sw] failed to update', url, err);
    }
  }

  if (toUpdate.length) {
    await writeEtagManifest(cache, manifest);
    console.log(`[sw] content update: refetched ${toUpdate.length} changed file(s)`);
  }

  // Report the result back to the page — this is what actually shows up
  // on screen (next to the version number), since there's no console to
  // check on a standalone headset.
  const clientsList = await self.clients.matchAll();
  for (const client of clientsList) {
    client.postMessage({ type: 'CONTENT_UPDATE_RESULT', checked: urls.length, updated: toUpdate.length });
  }
}

self.addEventListener('message', (event) => {
  if (event.data?.type === 'CHECK_FOR_CONTENT_UPDATES') {
    const promise = checkForContentUpdates();
    if (event.waitUntil) event.waitUntil(promise);
  }
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

// Two different kinds of thing flow through this fetch handler, and they
// need opposite caching strategies:
//  - Content (scenario JSON/srt/thumbnails under /scenarios/, and videos
//    on the R2 host) should be cache-first, deliberately, until you bump
//    CACHE_VERSION — that's the whole point of the offline download.
//  - The app shell (Menu.html, Player.html, everything under js/,
//    manifest.json) should always prefer a fresh network copy, only
//    falling back to cache if actually offline. Treating this like
//    content was the bug: the first-ever launch cached config.js/main.js
//    once and then served that frozen copy forever, no matter what got
//    pushed to GitHub afterward.
function isContentRequest(url) {
  try {
    const u = new URL(url);
    if (u.pathname.includes('/scenarios/')) return true;
    if (u.hostname !== self.location.hostname) return true; // video CDN (R2)
    return false;
  } catch {
    return false;
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);

    if (isContentRequest(req.url)) {
      const cached = await cache.match(req, { ignoreSearch: true, ignoreVary: true });
      if (cached) {
        const range = req.headers.get('range');
        return range ? rangedResponse(cached, range, req.url) : cached;
      }
      try {
        const netRes = await fetch(req);
        if (netRes.ok && netRes.type !== 'opaque') cache.put(req, netRes.clone());
        return netRes;
      } catch (err) {
        return new Response('Offline and not yet cached.', { status: 503 });
      }
    }

    // App shell: network-first, cache only as an offline fallback.
    try {
      const netRes = await fetch(req);
      if (netRes.ok && netRes.type !== 'opaque') cache.put(req, netRes.clone());
      return netRes;
    } catch (err) {
      const cached = await cache.match(req, { ignoreSearch: true, ignoreVary: true });
      return cached || new Response('Offline and not yet cached.', { status: 503 });
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
