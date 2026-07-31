// js/library.js
// In-VR scenario library. Fetches the manifest and renders it onto the
// shared panel mesh, reusing the panel/raycaster machinery from the
// decision panel so selecting a scenario is just another button click —
// no page navigation, so a live WebXR session is never touched.

import { state, State } from './state.js';
import { MANIFEST_URL, LIBRARY, LIBRARY_LAYOUT, FONT_HEAD, FONT_MONO, COLOURS, FONT_SIZES } from './config.js';
import { roundRect } from './utils.js';
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

function computeLibraryDims(count) {
  const rows = Math.max(count, 1);
  const idealH = LIBRARY_LAYOUT.headerH + rows * (LIBRARY_LAYOUT.cardH + LIBRARY_LAYOUT.cardGap);
  const canvasH = Math.max(LIBRARY_LAYOUT.minCanvasH, Math.min(LIBRARY_LAYOUT.maxCanvasH, idealH));
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

  const dims = computeLibraryDims(entries.length);
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
  ctx.beginPath(); ctx.moveTo(48, 140); ctx.lineTo(W - 48, 140); ctx.stroke();

  state.panelButtons = [];

  const top = LIBRARY_LAYOUT.headerH;
  const marginX = 48;
  const cardW = W - marginX * 2;
  const cardH = LIBRARY_LAYOUT.cardH;
  const gap = LIBRARY_LAYOUT.cardGap;

  if (!entries || entries.length === 0) {
    ctx.fillStyle = COLOURS.subtext;
    ctx.font = `400 ${FONT_SIZES.emptyState}px ${FONT_HEAD}`;
    ctx.textAlign = 'center';
    ctx.fillText('No scenarios found. Check scenarios.json.', W / 2, H / 2);
    state.panelTex.needsUpdate = true;
    return;
  }

  entries.forEach((entry, i) => {
    const by = top + i * (cardH + gap);
    const isHover = hovered === state.panelButtons.length;

    if (isHover) {
      const haloPad = [16, 8, 3];
      const haloAlpha = [0.01, 0.05, 0.1];
      for (let h = 0; h < haloPad.length; h++) {
        const p = haloPad[h];
        ctx.fillStyle = `rgba(76,111,255,${haloAlpha[h]})`;
        roundRect(ctx, marginX - p, by - p, cardW + p * 2, cardH + p * 2, 18 + p);
        ctx.fill();
      }
    }

    roundRect(ctx, marginX, by, cardW, cardH, 18);
    ctx.fillStyle = isHover ? COLOURS.btnHover : COLOURS.bgOption;
    ctx.fill();
    ctx.strokeStyle = isHover ? COLOURS.accent : COLOURS.border;
    ctx.lineWidth = isHover ? 1.5 : 1;
    roundRect(ctx, marginX, by, cardW, cardH, 18);
    ctx.stroke();

    ctx.fillStyle = isHover ? '#ffffff' : COLOURS.text;
    ctx.font = `${isHover ? 700 : 600} ${FONT_SIZES.choiceLabel}px ${FONT_HEAD}`;
    ctx.textAlign = 'left';
    ctx.fillText(entry.title || entry.id, marginX + 32, by + cardH / 2 + 8);

    if (isHover) {
      ctx.fillStyle = COLOURS.success;
      ctx.font = `500 ${FONT_SIZES.choiceArrow}px ${FONT_HEAD}`;
      ctx.textAlign = 'right';
      ctx.fillText('→', marginX + cardW - 32, by + cardH / 2 + 8);
    }

    state.panelButtons.push({
      x: marginX, y: by, w: cardW, h: cardH,
      id: state.panelButtons.length, label: entry.title || entry.id,
      action: 'goto', next: entry.intro,
    });
  });

  state.panelTex.needsUpdate = true;
}
