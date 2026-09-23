// js/offline-install.js
// Full-tree offline download, gated to the installed Quest app only. A
// normal browser tab (including incognito, your usual dev-testing setup)
// skips all of this and returns immediately — nothing changes there.
//
// Flow for the installed app, on first launch:
//   1. Register the Service Worker (sw.js).
//   2. Crawl the whole scenario tree from scenarios.json to find every
//      reachable JSON node and video URL.
//   3. Download and cache each one, reusing the existing loading overlay
//      to show progress.
//   4. Write a completion marker so future launches skip straight
//      through instead of re-checking every file.

import { CACHE_VERSION, MANIFEST_URL } from './config.js';
import { showOverlay, hideOverlay, setLoadProgress, descEl } from './overlay.js';

const CACHE_NAME = `content-${CACHE_VERSION}`;
const COMPLETE_MARKER = '/__offline_complete__';

export async function ensureOfflineReady() {
  const isInstalledApp = window.matchMedia('(display-mode: standalone)').matches;
  if (!isInstalledApp || !('serviceWorker' in navigator) || !('caches' in window)) {
    return; // desktop/incognito path — untouched, no Service Worker at all
  }

  await navigator.serviceWorker.register('sw.js');
  if (navigator.storage?.persist) {
    await navigator.storage.persist().catch(() => {});
  }

  const cache = await caches.open(CACHE_NAME);
  if (await cache.match(COMPLETE_MARKER)) {
    return; // already fully downloaded for this CACHE_VERSION
  }

  showOverlay('Downloading content…', 'This happens once. Stay on Wi-Fi.');
  setLoadProgress(0);

  const urls = await collectAllUrls();
  let done = 0;
  for (const url of urls) {
    if (!(await cache.match(url))) {
      try {
        const res = await fetch(url);
        if (res.ok) await cache.put(url, res.clone());
      } catch (err) {
        console.warn('[offline-install] failed to cache', url, err);
      }
    }
    done += 1;
    setLoadProgress(done / urls.length);
    descEl.textContent = `This happens once. Stay on Wi-Fi. (${done}/${urls.length})`;
  }

  await cache.put(COMPLETE_MARKER, new Response('ok'));
  await logStorageEstimate();
  hideOverlay();
}

// Walks the whole branching tree from scenarios.json, following every
// decision choice and linear "next", collecting every JSON node and video
// it finds. Mirrors the path-resolution rules in scene-loader.js exactly
// (video is either an absolute URL or relative to its own JSON's folder),
// so a path resolves the same way here as it does during real playback.
async function collectAllUrls() {
  const urls = new Set([MANIFEST_URL]);
  const visited = new Set();

  const manifest = await fetch(MANIFEST_URL).then((r) => r.json());
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
      node = await fetch(jsonPath).then((r) => r.json());
    } catch (err) {
      console.warn('[offline-install] failed to read', jsonPath, err);
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

async function logStorageEstimate() {
  if (!navigator.storage?.estimate) return;
  try {
    const { usage, quota } = await navigator.storage.estimate();
    console.log(`[offline-install] using ${(usage / 1e9).toFixed(2)}GB of ${(quota / 1e9).toFixed(2)}GB available`);
  } catch (err) {
    // best-effort only
  }
}
