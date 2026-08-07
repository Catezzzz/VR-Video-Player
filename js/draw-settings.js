// js/draw-settings.js
// Canvas 2D drawing for the settings panel (font size + panel distance
// controls, Apply/Revert/Close) — drawn onto the shared panelCanvas the
// same way the transport bar / decision panel / library panel are, since
// settings REPLACES whichever of those is currently showing rather than
// sitting beside it. Also draws the small gear button that opens it from
// the decision panel, which stays a separate canvas/mesh of its own.

import { state } from './state.js';
import {
  COLOURS, FONT_HEAD, FONT_MONO, getFontSizes,
  SETTINGS, SETTINGS_LAYOUT, FONT_SCALE_STEPS, DISTANCE_STEPS,
} from './config.js';
import { roundRect } from './utils.js';

export function computeSettingsDims() {
  return {
    canvasW: SETTINGS.canvasW,
    canvasH: SETTINGS_LAYOUT.canvasH,
    worldW:  SETTINGS.worldW,
    worldH:  SETTINGS_LAYOUT.canvasH / SETTINGS_LAYOUT.pixelsPerMeter,
  };
}

/* A row of equal-width segmented step buttons (used for the font-size
   control). Pushes each segment into state.panelButtons. */
function drawStepRow(ctx, x, y, w, h, steps, selectedIndex, hoveredId, action, fontSizes) {
  const gap  = 10;
  const segW = (w - gap * (steps.length - 1)) / steps.length;

  steps.forEach((step, i) => {
    const bx = x + i * (segW + gap);
    const idx = state.panelButtons.length;
    const isSelected = i === selectedIndex;
    const isHover    = hoveredId === idx;

    roundRect(ctx, bx, y, segW, h, 14);
    ctx.fillStyle = isSelected ? COLOURS.accent : (isHover ? COLOURS.btnHover : COLOURS.bgOption);
    ctx.fill();
    ctx.strokeStyle = isSelected || isHover ? COLOURS.accent : COLOURS.border;
    ctx.lineWidth   = isSelected || isHover ? 1.5 : 1;
    roundRect(ctx, bx, y, segW, h, 14);
    ctx.stroke();

    ctx.fillStyle = isSelected ? '#ffffff' : COLOURS.badgeText;
    ctx.font      = `${isSelected ? 700 : 500} ${fontSizes.utilButton}px ${FONT_HEAD}`;
    ctx.textAlign = 'center';
    ctx.fillText(step.label, bx + segW / 2, y + h / 2 + 8);

    state.panelButtons.push({ x: bx, y, w: segW, h, id: idx, action, stepIndex: i });
  });
}

/* Non-continuous slider (used for the panel-distance control): a track
   with a fixed tick for every entry in `steps`, a knob snapped to the
   currently selected one, and a single hit region spanning the full
   track width. interaction.js/settings.js map a click's x-position back
   to the nearest tick — see sliderUvToStepIndex in settings.js — rather
   than reading a free continuous value, so it always lands on one of the
   fixed stops. */
function drawDistanceSlider(ctx, x, y, w, steps, selectedIndex, hoveredId, fontSizes) {
  const trackH  = 6;
  const trackY  = y + 20;
  const knobR   = 14;
  const midIdx  = Math.floor((steps.length - 1) / 2);
  const idx     = state.panelButtons.length;
  const isHover = hoveredId === idx;
  const stepX   = i => x + (w * i) / (steps.length - 1);
  const knobX   = stepX(selectedIndex);
  const midX    = stepX(midIdx);

  // Track background
  roundRect(ctx, x, trackY - trackH / 2, w, trackH, trackH / 2);
  ctx.fillStyle = COLOURS.progressBg;
  ctx.fill();

  // Filled portion from the default (middle) tick to the knob, so the
  // direction away from default reads at a glance.
  const fillX = Math.min(midX, knobX);
  const fillW = Math.abs(knobX - midX);
  if (fillW > 0) {
    roundRect(ctx, fillX, trackY - trackH / 2, fillW, trackH, trackH / 2);
    ctx.fillStyle = COLOURS.progress;
    ctx.fill();
  }

  // Tick marks — the middle (default) tick drawn taller/brighter
  steps.forEach((_, i) => {
    const tx = stepX(i);
    const isMid = i === midIdx;
    const tickH = isMid ? 16 : 8;
    ctx.strokeStyle = isMid ? COLOURS.accentSoft : COLOURS.border;
    ctx.lineWidth   = isMid ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(tx, trackY - tickH / 2);
    ctx.lineTo(tx, trackY + tickH / 2);
    ctx.stroke();
  });

  // Knob
  ctx.fillStyle = isHover ? 'rgba(76,111,255,0.32)' : 'rgba(76,111,255,0.18)';
  ctx.beginPath(); ctx.arc(knobX, trackY, knobR + 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = COLOURS.accent;
  ctx.beginPath(); ctx.arc(knobX, trackY, knobR, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(knobX, trackY, knobR, 0, Math.PI * 2); ctx.stroke();

  // End labels
  ctx.fillStyle = COLOURS.subtext;
  ctx.font      = `400 ${fontSizes.utilButton - 6}px ${FONT_HEAD}`;
  ctx.textAlign = 'left';
  ctx.fillText('Closer', x, trackY + 40);
  ctx.textAlign = 'right';
  ctx.fillText('Farther', x + w, trackY + 40);

  // Whole-block hit region — x/w exactly match the track so click position
  // maps directly back to a step in settings.js.
  state.panelButtons.push({ x, y, w, h: 60, id: idx, action: 'distance-slider' });
}

export function drawSettingsPanel(pending, hoveredId = null) {
  const ctx = state.panelCtx;
  if (!ctx || !pending) return;
  const W = state.panelCanvas.width;
  const H = state.panelCanvas.height;
  const FONT_SIZES = getFontSizes();
  ctx.clearRect(0, 0, W, H);

  // Background — same dark navy card treatment as the other panels
  const bgGrad = ctx.createRadialGradient(W / 2, H * 0.3, 0, W / 2, H * 0.3, W * 0.75);
  ctx.fillStyle = COLOURS.bg;
  roundRect(ctx, 4, 4, W - 8, H - 8, 24);
  ctx.fill();
  ctx.fillStyle = bgGrad;
  roundRect(ctx, 4, 4, W - 8, H - 8, 24);
  ctx.fill();
  ctx.strokeStyle = COLOURS.border;
  ctx.lineWidth   = 1.5;
  roundRect(ctx, 4, 4, W - 8, H - 8, 24);
  ctx.stroke();

  ctx.fillStyle     = COLOURS.accentSoft;
  ctx.font          = `500 ${FONT_SIZES.prompt}px ${FONT_MONO}`;
  ctx.textAlign     = 'left';
  ctx.letterSpacing = '3px';
  ctx.fillText('SETTINGS', 40, 60);
  ctx.letterSpacing = '0px';

  ctx.strokeStyle = COLOURS.border;
  ctx.lineWidth   = 1;
  ctx.beginPath(); ctx.moveTo(40, 76); ctx.lineTo(W - 40, 76); ctx.stroke();

  state.panelButtons = [];

  const marginX = 40;
  const rowW    = W - marginX * 2;
  let y = 116;

  // Font size row
  ctx.fillStyle = COLOURS.text;
  ctx.font      = `500 ${FONT_SIZES.utilButton}px ${FONT_HEAD}`;
  ctx.textAlign = 'left';
  ctx.fillText('Font Size', marginX, y);
  y += 30;
  drawStepRow(ctx, marginX, y, rowW, 72, FONT_SCALE_STEPS, pending.fontStepIndex, hoveredId, 'font', FONT_SIZES);
  y += 72 + 52;

  // Panel distance row
  ctx.fillStyle = COLOURS.text;
  ctx.font      = `500 ${FONT_SIZES.utilButton}px ${FONT_HEAD}`;
  ctx.textAlign = 'left';
  ctx.fillText('Panel Distance', marginX, y);
  y += 30;
  drawDistanceSlider(ctx, marginX, y, rowW, DISTANCE_STEPS, pending.distanceStepIndex, hoveredId, FONT_SIZES);
  y += 60 + 40;

  // Divider above the action row
  ctx.strokeStyle = COLOURS.border;
  ctx.lineWidth   = 1;
  ctx.beginPath(); ctx.moveTo(marginX, y); ctx.lineTo(W - marginX, y); ctx.stroke();
  y += 28;

  // Apply / Revert / Close
  const actions = [
    { action: 'apply',  label: '✓  Apply'  },
    { action: 'revert', label: '↺  Revert' },
    { action: 'close',  label: '✕  Close'  },
  ];
  const actGap = 16;
  const actW   = (rowW - actGap * (actions.length - 1)) / actions.length;
  const actH   = 64;

  actions.forEach((item, i) => {
    const idx     = state.panelButtons.length;
    const bx      = marginX + i * (actW + actGap);
    const isHover = hoveredId === idx;
    const isApply = item.action === 'apply';

    roundRect(ctx, bx, y, actW, actH, 999);
    ctx.fillStyle = isApply
      ? (isHover ? COLOURS.accent : 'rgba(76,111,255,0.85)')
      : (isHover ? COLOURS.utilHover : COLOURS.ghostBg);
    ctx.fill();
    ctx.strokeStyle = isApply ? COLOURS.accent : (isHover ? COLOURS.utilHover : COLOURS.ghostBorder);
    ctx.lineWidth   = isHover ? 1.5 : 1;
    roundRect(ctx, bx, y, actW, actH, 999);
    ctx.stroke();

    ctx.fillStyle = isApply || isHover ? '#ffffff' : COLOURS.badgeText;
    ctx.font      = `${isApply ? 700 : 400} ${FONT_SIZES.utilButton}px ${FONT_HEAD}`;
    ctx.textAlign = 'center';
    ctx.fillText(item.label, bx + actW / 2, y + actH / 2 + 7);

    state.panelButtons.push({ x: bx, y, w: actW, h: actH, id: idx, action: item.action });
  });

  state.panelTex.needsUpdate = true;
}

/* Small "⚙" button shown beside the decision panel only. Single hit
   region covering the whole canvas — no button list needed for this one. */
export function drawGearButton(hovered = false) {
  const ctx = state.gearCtx;
  if (!ctx) return;
  const W = state.gearCanvas.width;
  const H = state.gearCanvas.height;
  const FONT_SIZES = getFontSizes();
  ctx.clearRect(0, 0, W, H);

  roundRect(ctx, 6, 6, W - 12, H - 12, 24);
  ctx.fillStyle = hovered ? COLOURS.utilHover : COLOURS.bgOption;
  ctx.fill();
  ctx.strokeStyle = hovered ? COLOURS.accent : COLOURS.ghostBorder;
  ctx.lineWidth   = hovered ? 2 : 1.5;
  roundRect(ctx, 6, 6, W - 12, H - 12, 24);
  ctx.stroke();

  ctx.fillStyle = hovered ? '#ffffff' : COLOURS.badgeText;
  ctx.font      = `${Math.round(FONT_SIZES.prompt * 1.3)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('⚙', W / 2, H / 2 + 18);

  state.gearTex.needsUpdate = true;
}
