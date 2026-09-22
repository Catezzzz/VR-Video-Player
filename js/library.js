// js/library.js
// In-VR scenario library. Fetches the manifest and renders it onto the
// shared panel mesh, reusing the panel/raycaster machinery from the
// decision panel so selecting a scenario is just another button click —
// no page navigation, so a live WebXR session is never touched.
//
// Laid out as a fixed 2x3 grid of scenario cards (thumbnail + title) per
// page, with prev/next buttons to move between pages — paging instead of
// scrolling, since a raycasted canvas panel has no wheel/scrollbar input.

import { state, State } from './state.js';
import { MANIFEST_URL, LIBRARY, LIBRARY_LAYOUT, FONT_HEAD, FONT_MONO, COLOURS, getFontSizes } from './config.js';
import { roundRect, drawImageCover } from './utils.js';
import { createPanel, positionPanel } from './panel-mesh.js';
import { hideOverlay } from './overlay.js';
import { sphereMat } from './three-setup.js';

let manifestPromise = null;
function getManifest() {
  if (!manifestPromise) {
    manifestPromise = fetch(MANIFEST_URL)
      .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${MANIFEST_URL}`); return res.json(); })
      .catch(err => { manifestPromise = null; throw err; }); // allow retry after a failure
  }
  return manifestPromise;
}

// Thumbnail image cache, keyed by URL — one Image per scenario, loaded
// once and reused across redraws/page turns. A card whose image hasn't
// finished loading (or has none/failed) falls back to a placeholder glyph;
// the panel is redrawn once a pending image lands, same idea as the
// loadingTexture pattern in three-setup.js.
const thumbCache = new Map();
function getThumbnailImage(url) {
  let entry = thumbCache.get(url);
  if (!entry) {
    const img = new Image();
    entry = { img, loaded: false, failed: false };
    img.onload = () => {
      entry.loaded = true;
      if (state.appState === State.LIBRARY) drawLibraryPanel(state.libraryEntries, state.hoveredBtn);
    };
    img.onerror = () => { entry.failed = true; };
    img.src = url;
    thumbCache.set(url, entry);
  }
  return entry;
}

function drawFallbackThumb(ctx, x, y, w, h) {
  ctx.fillStyle = '#0f1424';
  ctx.fillRect(x, y, w, h);
  const cx = x + w / 2, cy = y + h / 2, s = Math.min(w, h) * 0.22;
  ctx.save();
  ctx.strokeStyle = 'rgba(143,163,255,0.4)';
  ctx.lineWidth = 2;
  roundRect(ctx, cx - s, cy - s * 0.7, s * 2, s * 1.4, 4);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx - s * 0.5, cy - s * 0.25, s * 0.16, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - s, cy + s * 0.5);
  ctx.lineTo(cx - s * 0.2, cy - s * 0.1);
  ctx.lineTo(cx + s * 0.3, cy + s * 0.3);
  ctx.lineTo(cx + s, cy - s * 0.2);
  ctx.stroke();
  ctx.restore();
}

function drawNavButton(ctx, x, y, w, h, label, enabled, isHover, FONT_SIZES) {
  roundRect(ctx, x, y, w, h, 999);
  ctx.fillStyle = !enabled ? 'rgba(22,28,52,0.4)' : (isHover ? COLOURS.utilHover : COLOURS.ghostBg);
  ctx.fill();
  ctx.strokeStyle = !enabled ? 'rgba(143,163,255,0.08)' : (isHover ? COLOURS.accent : COLOURS.ghostBorder);
  ctx.lineWidth = isHover ? 1.5 : 1;
  roundRect(ctx, x, y, w, h, 999);
  ctx.stroke();

  ctx.fillStyle = !enabled ? 'rgba(139,147,184,0.35)' : (isHover ? '#ffffff' : COLOURS.badgeText);
  ctx.font = `500 ${FONT_SIZES.utilButton}px ${FONT_HEAD}`;
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + h / 2 + 8);
}

// Fixed page size now (2x3 grid), so unlike before this no longer depends
// on how many scenarios there are — only the page count changes.
function computeLibraryDims() {
  const L = LIBRARY_LAYOUT;
  const cardH = L.cardThumbH + L.cardTitleH;
  const canvasH = L.headerH + L.gridTopGap + L.rows * cardH + (L.rows - 1) * L.rowGap + L.navGapTop + L.navH;
  return { canvasW: LIBRARY.canvasW, canvasH, worldW: LIBRARY.worldW, worldH: LIBRARY.worldW * (canvasH / LIBRARY.canvasW) };
}

/* Show the in-VR (or flat, if not presenting) scenario library. Called on
   a fresh "Enter VR" from Menu.html/Player.html, and from the Player's
   "≡ Menu" button while already in VR — same document, same session. */
export async function enterLibrary() {
  hideOverlay();
  state.appState = State.LIBRARY;
  state.hoveredBtn = null;
  state.isPanelHovered = false;
  state.libraryPage = 0; // always open on page 1
  sphereMat.color.setRGB(0.35, 0.35, 0.35); // dim the sphere, same as the decision panel

  let entries = state.libraryEntries;
  if (!entries) {
    try {
      entries = await getManifest();
      state.libraryEntries = entries;
    } catch (e) {
      entries = [];
      console.error('[Library] Failed to load manifest:', e);
    }
  }

  // Guard against a race: the user might have already picked a scenario
  // while the manifest fetch was still in flight.
  if (state.appState !== State.LIBRARY) return;

  const dims = computeLibraryDims();
  createPanel(dims.worldW, dims.worldH, dims.canvasW, dims.canvasH);
  positionPanel();
  if (state.panelMesh) state.panelMesh.material.opacity = 1.0;
  drawLibraryPanel(entries, null);
}

export function drawLibraryPanel(entries, hovered) {
  const ctx = state.panelCtx;
  if (!ctx) return;
  const W = state.panelCanvas.width;
  const H = state.panelCanvas.height;
  const FONT_SIZES = getFontSizes();
  const L = LIBRARY_LAYOUT;
  ctx.clearRect(0, 0, W, H);

  // Background — same dark navy card treatment as the decision panel
  const bgGrad = ctx.createRadialGradient(W / 2, H * 0.3, 0, W / 2, H * 0.3, W * 0.75);
  bgGrad.addColorStop(0, 'rgba(143,163,255,0.01)');
  ctx.fillStyle = COLOURS.bg;
  roundRect(ctx, 4, 4, W - 8, H - 8, 24);
  ctx.fill();
  ctx.fillStyle = bgGrad;
  roundRect(ctx, 4, 4, W - 8, H - 8, 24);
  ctx.fill();

  ctx.strokeStyle = COLOURS.border;
  ctx.lineWidth = 1.5;
  roundRect(ctx, 4, 4, W - 8, H - 8, 24);
  ctx.stroke();

  ctx.fillStyle = COLOURS.accentSoft;
  ctx.font = `500 ${FONT_SIZES.kicker}px ${FONT_MONO}`;
  ctx.textAlign = 'left';
  ctx.letterSpacing = '3px';
  ctx.fillText('SCENARIO LIBRARY', 48, 56);
  ctx.letterSpacing = '0px';

  ctx.fillStyle = COLOURS.heading;
  ctx.font = `700 ${FONT_SIZES.prompt}px ${FONT_HEAD}`;
  ctx.fillText('Choose a scenario', 48, 112);

  ctx.strokeStyle = COLOURS.border;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(48, L.headerH); ctx.lineTo(W - 48, L.headerH); ctx.stroke();

  state.panelButtons = [];

  const all = entries || [];
  const perPage = L.cols * L.rows;
  const totalPages = Math.max(1, Math.ceil(all.length / perPage));
  if (state.libraryPage > totalPages - 1) state.libraryPage = totalPages - 1;
  if (state.libraryPage < 0) state.libraryPage = 0;
  const page = state.libraryPage;
  const pageEntries = all.slice(page * perPage, page * perPage + perPage);

  const marginX = L.marginX;
  const cardW = (W - marginX * 2 - L.colGap * (L.cols - 1)) / L.cols;
  const cardH = L.cardThumbH + L.cardTitleH;
  const gridTop = L.headerH + L.gridTopGap;

  if (all.length === 0) {
    ctx.fillStyle = COLOURS.subtext;
    ctx.font = `400 ${FONT_SIZES.emptyState}px ${FONT_HEAD}`;
    ctx.textAlign = 'center';
    ctx.fillText('No scenarios found. Check scenarios.json.', W / 2, H / 2);
    state.panelTex.needsUpdate = true;
    return;
  }

  pageEntries.forEach((entry, i) => {
    const row = Math.floor(i / L.cols);
    const col = i % L.cols;
    const cardX = marginX + col * (cardW + L.colGap);
    const cardY = gridTop + row * (cardH + L.rowGap);
    const isHover = hovered === state.panelButtons.length;

    if (isHover) {
      const haloPad = [16, 8, 3];
      const haloAlpha = [0.01, 0.05, 0.1];
      for (let h = 0; h < haloPad.length; h++) {
        const p = haloPad[h];
        ctx.fillStyle = `rgba(76,111,255,${haloAlpha[h]})`;
        roundRect(ctx, cardX - p, cardY - p, cardW + p * 2, cardH + p * 2, 18 + p);
        ctx.fill();
      }
    }

    roundRect(ctx, cardX, cardY, cardW, cardH, 18);
    ctx.fillStyle = isHover ? COLOURS.btnHover : COLOURS.bgOption;
    ctx.fill();
    ctx.strokeStyle = isHover ? COLOURS.accent : COLOURS.border;
    ctx.lineWidth = isHover ? 1.5 : 1;
    roundRect(ctx, cardX, cardY, cardW, cardH, 18);
    ctx.stroke();

    // Thumbnail, clipped to a rounded box inset from the card edges.
    const thumbPad = 10;
    const thumbX = cardX + thumbPad;
    const thumbY = cardY + thumbPad;
    const thumbW = cardW - thumbPad * 2;
    const thumbH = L.cardThumbH - thumbPad;

    ctx.save();
    roundRect(ctx, thumbX, thumbY, thumbW, thumbH, 12);
    ctx.clip();
    const thumb = entry.thumbnail ? getThumbnailImage(entry.thumbnail) : null;
    if (thumb && thumb.loaded) {
      drawImageCover(ctx, thumb.img, thumbX, thumbY, thumbW, thumbH);
      ctx.fillStyle = 'rgba(0,0,0,0.12)'; // slight dim, matches Menu.html's card treatment
      ctx.fillRect(thumbX, thumbY, thumbW, thumbH);
    } else {
      drawFallbackThumb(ctx, thumbX, thumbY, thumbW, thumbH);
    }
    ctx.restore();

    // Title bar, directly under the thumbnail.
    const titleY = cardY + L.cardThumbH;
    ctx.strokeStyle = COLOURS.border;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cardX + 16, titleY); ctx.lineTo(cardX + cardW - 16, titleY); ctx.stroke();

    ctx.fillStyle = isHover ? '#ffffff' : COLOURS.text;
    ctx.font = `${isHover ? 700 : 600} ${FONT_SIZES.choiceLabel}px ${FONT_HEAD}`;
    ctx.textAlign = 'left';
    ctx.fillText(entry.title || entry.id, cardX + 20, titleY + L.cardTitleH / 2 + 8);

    if (isHover) {
      ctx.fillStyle = COLOURS.success;
      ctx.font = `500 ${FONT_SIZES.choiceArrow}px ${FONT_HEAD}`;
      ctx.textAlign = 'right';
      ctx.fillText('→', cardX + cardW - 20, titleY + L.cardTitleH / 2 + 8);
    }

    state.panelButtons.push({
      x: cardX, y: cardY, w: cardW, h: cardH,
      id: state.panelButtons.length, label: entry.title || entry.id,
      action: 'goto', next: entry.intro,
    });
  });

  // Prev/next paging row, centered under the grid.
  const navY = gridTop + L.rows * cardH + (L.rows - 1) * L.rowGap + L.navGapTop;
  const btnY = navY + (L.navH - L.navBtnH) / 2;
  const prevX = W / 2 - L.navBtnGap - L.navBtnW;
  const nextX = W / 2 + L.navBtnGap;
  const canPrev = page > 0;
  const canNext = page < totalPages - 1;

  const prevIdx = state.panelButtons.length;
  drawNavButton(ctx, prevX, btnY, L.navBtnW, L.navBtnH, '‹ Prev', canPrev, canPrev && hovered === prevIdx, FONT_SIZES);
  if (canPrev) state.panelButtons.push({ x: prevX, y: btnY, w: L.navBtnW, h: L.navBtnH, id: prevIdx, action: 'page-prev' });

  ctx.fillStyle = COLOURS.subtext;
  ctx.font = `500 ${FONT_SIZES.utilButton}px ${FONT_MONO}`;
  ctx.textAlign = 'center';
  ctx.fillText(`${page + 1} / ${totalPages}`, W / 2, btnY + L.navBtnH / 2 + 7);

  const nextIdx = state.panelButtons.length;
  drawNavButton(ctx, nextX, btnY, L.navBtnW, L.navBtnH, 'Next ›', canNext, canNext && hovered === nextIdx, FONT_SIZES);
  if (canNext) state.panelButtons.push({ x: nextX, y: btnY, w: L.navBtnW, h: L.navBtnH, id: nextIdx, action: 'page-next' });

  state.panelTex.needsUpdate = true;
}
