// js/draw-transport.js
// Canvas 2D drawing for the always-visible playback transport bar
// (progress scrubber, play/pause, mute).

import { state } from './state.js';
import { COLOURS, FONT_MONO, FONT_SIZES, TRANSPORT } from './config.js';
import { roundRect, fmt } from './utils.js';
import { video } from './three-setup.js';

export function drawTransportBar(hovered = null) {
  if (!state.panelCtx) return;
  const ctx = state.panelCtx;
  const W   = TRANSPORT.canvasW;
  const H   = TRANSPORT.canvasH;
  const pX  = TRANSPORT.padX;
  const pW  = W - pX * 2;
  ctx.clearRect(0, 0, W, H);

  // Background — dark navy card; slightly more transparent when idle.
  // The canvas itself is always drawn at full alpha; the THREE material
  // opacity handles the actual fade.
  ctx.fillStyle = state.isPanelHovered ? COLOURS.bg : 'rgba(20,26,46,0.6)';
  roundRect(ctx, 4, 4, W - 8, H - 8, 18);
  ctx.fill();
  ctx.strokeStyle = COLOURS.border; ctx.lineWidth = 1;
  roundRect(ctx, 4, 4, W - 8, H - 8, 18);
  ctx.stroke();

  state.transportButtons = [];

  // Progress bar
  const pY = TRANSPORT.padY, pH = 8;
  ctx.fillStyle = COLOURS.progressBg;
  roundRect(ctx, pX, pY, pW, pH, 4); ctx.fill();

  const dur  = video.duration || 1;
  const cur  = video.currentTime || 0;
  const prog = Math.min(cur / dur, 1);
  if (prog > 0) {
    ctx.fillStyle = COLOURS.progress;
    roundRect(ctx, pX, pY, pW * prog, pH, 4); ctx.fill();
  }

  // Scrubber knob — indigo with a hand-drawn halo (no ctx.shadowBlur; see note above)
  const knobX = pX + pW * prog, knobY = pY + pH / 2;
  ctx.fillStyle = 'rgba(76,111,255,0.25)';
  ctx.beginPath(); ctx.arc(knobX, knobY, 16, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(76,111,255,0.4)';
  ctx.beginPath(); ctx.arc(knobX, knobY, 11, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(knobX, knobY, 8, 0, Math.PI * 2); ctx.fill();
  state.transportButtons.push({ x: pX - 8, y: pY - 10, w: pW + 16, h: pH + 20, id: 'seek', label: 'seek' });

  // Time label
  ctx.fillStyle = COLOURS.accentSoft; ctx.font = `400 ${FONT_SIZES.transportTime}px ${FONT_MONO}`; ctx.textAlign = 'left';
  ctx.fillText(`${fmt(cur)} / ${fmt(dur)}`, pX, 78);

  // Buttons: Play/Pause | Mute — square icon tiles per the "Icon 40²" component
  const BTN_W = 72, BTN_H = 54, BTN_Y = 96;

  const btns = [
    { id: 'playpause', label: video.paused ? '▶' : '⏸', x: pX },
    { id: 'mute',      label: state.isMuted ? '🔇' : '🔊', x: pX + 88 },
  ];

  btns.forEach(b => {
    const isH = hovered === b.id;
    roundRect(ctx, b.x, BTN_Y, BTN_W, BTN_H, 12);
    ctx.fillStyle   = isH ? COLOURS.btnHover : COLOURS.btnBg; ctx.fill();
    ctx.strokeStyle = isH ? COLOURS.accent : COLOURS.border; ctx.lineWidth = isH ? 1.5 : 1; ctx.stroke();
    ctx.fillStyle   = isH ? COLOURS.accentSoft : COLOURS.badgeText;
    ctx.font        = `${FONT_SIZES.transportIcon}px system-ui, sans-serif`; ctx.textAlign = 'center';
    ctx.fillText(b.label, b.x + BTN_W / 2, BTN_Y + BTN_H / 2 + 8);
    state.transportButtons.push({ x: b.x, y: BTN_Y, w: BTN_W, h: BTN_H, id: b.id, label: b.label });
  });

  state.panelTex.needsUpdate = true;
}
