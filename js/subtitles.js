// js/subtitles.js
// SRT/VTT subtitles rendered as their own head-following mesh, independent
// of panelMesh (which gets disposed and rebuilt on every panel swap).
// Timing is done here rather than via the browser's TextTrack API: keeps
// cue cleanup between scenes trivial and avoids the CORS coupling that
// <track> has with cross-origin media.

import * as THREE from 'three';
import { scene, camera, video } from './three-setup.js';
import { state, State } from './state.js';
import {
  SUBTITLES, SUBTITLE_FOLLOW_MODES, SUBTITLE_FOLLOW_MODE,
  COLOURS, FONT_HEAD, getFontSizes, getDistanceOffset,
} from './config.js';
import { roundRect } from './utils.js';

/* ─── Parsing ─────────────────────────────────────────────────────────── */

// Matches both SRT (00:00:01,234) and VTT (00:00:01.234) timestamps.
function parseTimestamp(s) {
  const m = s.trim().match(/(\d+):(\d{2}):(\d{2})[,.](\d{1,3})/);
  if (!m) return null;
  return (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) + (+m[4].padEnd(3, '0')) / 1000;
}

export function parseSRT(text) {
  const cues = [];
  const blocks = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').trim().split(/\n\s*\n/);

  for (const block of blocks) {
    const lines = block.split('\n');
    const timeIdx = lines.findIndex(l => l.includes('-->'));
    if (timeIdx === -1) continue;

    const [rawStart, rawEnd] = lines[timeIdx].split('-->');
    const start = parseTimestamp(rawStart);
    const end   = parseTimestamp(rawEnd);
    if (start === null || end === null) continue;

    const body = lines.slice(timeIdx + 1).join('\n')
      .replace(/<[^>]+>/g, '')    // <i>, <b>, <font ...>
      .replace(/\{[^}]*\}/g, '')  // {\an8} style SSA overrides
      .trim();
    if (body) cues.push({ start, end, text: body });
  }

  cues.sort((a, b) => a.start - b.start);
  return cues;
}

/* ─── Mesh ────────────────────────────────────────────────────────────── */

function createSubtitleMesh() {
  disposeSubtitleMesh();

  state.subtitleCanvas = document.createElement('canvas');
  state.subtitleCanvas.width  = SUBTITLES.canvasW;
  state.subtitleCanvas.height = SUBTITLES.canvasH;
  state.subtitleCtx = state.subtitleCanvas.getContext('2d');

  state.subtitleTex = new THREE.CanvasTexture(state.subtitleCanvas);
  state.subtitleTex.colorSpace = THREE.SRGBColorSpace;

  const worldH = SUBTITLES.worldW * (SUBTITLES.canvasH / SUBTITLES.canvasW);
  const geo = new THREE.PlaneGeometry(SUBTITLES.worldW, worldH);
  const mat = new THREE.MeshBasicMaterial({ map: state.subtitleTex, transparent: true, depthWrite: false });

  state.subtitleMesh = new THREE.Mesh(geo, mat);
  state.subtitleMesh.visible = false;
  state.subtitleMesh.renderOrder = 10;
  scene.add(state.subtitleMesh);
}

export function disposeSubtitleMesh() {
  if (!state.subtitleMesh) return;
  scene.remove(state.subtitleMesh);
  state.subtitleMesh.geometry.dispose();
  state.subtitleMesh.material.dispose();
  if (state.subtitleTex) state.subtitleTex.dispose();
  state.subtitleMesh  = null;
  state.subtitleCanvas = null;
  state.subtitleCtx    = null;
  state.subtitleTex    = null;
}

/* ─── Loading ─────────────────────────────────────────────────────────── */

export function resetSubtitles() {
  state.subtitleCues   = [];
  state.subtitleCursor = 0;
  state.subtitleShown  = -1;
  disposeSubtitleMesh();
}

/* Fetches the node's subtitle file if it declares one. Always resolves —
   a missing or malformed subtitle file must never block a scene. */
export async function loadSubtitles(sceneData, base) {
  const ref = sceneData.subtitles;
  if (!ref) return;

  const src = ref.startsWith('http') ? ref : base + ref;
  try {
    const res = await fetch(src);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const cues = parseSRT(await res.text());
    if (!cues.length) throw new Error('no cues parsed');

    state.subtitleCues   = cues;
    state.subtitleCursor = 0;
    state.subtitleShown  = -1;
    createSubtitleMesh();
  } catch (e) {
    console.warn(`[VRPlayer] Subtitles unavailable (${src}):`, e.message);
  }
}

/* ─── Cue lookup ──────────────────────────────────────────────────────── */

/* Cursor-based scan. Cue counts per clip are small, so walking from the
   last known position is cheaper than a binary search and handles seeks
   in both directions without a separate `seeking` listener. */
function activeCueIndex(t) {
  const cues = state.subtitleCues;
  if (!cues.length) return -1;

  let i = state.subtitleCursor;
  if (i < 0 || i >= cues.length) i = 0;

  while (i > 0 && cues[i].start > t) i--;
  while (i < cues.length - 1 && cues[i].end < t) i++;

  state.subtitleCursor = i;
  return (t >= cues[i].start && t <= cues[i].end) ? i : -1;
}

/* ─── Drawing ─────────────────────────────────────────────────────────── */

function wrapLines(ctx, text, maxW) {
  const out = [];
  for (const para of text.split('\n')) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) continue;
    let line = words[0];
    for (let i = 1; i < words.length; i++) {
      const test = `${line} ${words[i]}`;
      if (ctx.measureText(test).width > maxW) { out.push(line); line = words[i]; }
      else line = test;
    }
    out.push(line);
  }
  return out.slice(0, SUBTITLES.maxLines);
}

function drawSubtitle(text) {
  const ctx = state.subtitleCtx;
  if (!ctx) return;

  const { canvasW, canvasH, padX, padY, lineGap } = SUBTITLES;
  const fontPx = getFontSizes().subtitle;

  ctx.clearRect(0, 0, canvasW, canvasH);
  if (!text) { state.subtitleTex.needsUpdate = true; return; }

  ctx.font = `600 ${fontPx}px ${FONT_HEAD}`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';

  const lines  = wrapLines(ctx, text, canvasW - padX * 4);
  const lineH  = fontPx + lineGap;
  const blockH = lines.length * lineH;
  const widest = Math.max(...lines.map(l => ctx.measureText(l).width));

  // Backing plate sized to the text, bottom-aligned in the canvas
  const bgW = Math.min(widest + padX * 2, canvasW);
  const bgH = blockH + padY * 2;
  const bgX = (canvasW - bgW) / 2;
  const bgY = canvasH - bgH - padY;

  roundRect(ctx, bgX, bgY, bgW, bgH, 18);
  ctx.fillStyle = SUBTITLES.bgColour;
  ctx.fill();

  lines.forEach((line, i) => {
    const y = bgY + padY + lineH * i + lineH / 2;
    ctx.lineWidth   = Math.max(3, fontPx * 0.12);
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.lineJoin    = 'round';
    ctx.strokeText(line, canvasW / 2, y);
    ctx.fillStyle   = COLOURS.heading;
    ctx.fillText(line, canvasW / 2, y);
  });

  state.subtitleTex.needsUpdate = true;
}

/* ─── Positioning ─────────────────────────────────────────────────────── */

const _subTarget = new THREE.Object3D();
const _camPos    = new THREE.Vector3();
const _dir       = new THREE.Vector3();
const _idealPos  = new THREE.Vector3();
const _idealDir  = new THREE.Vector3();
const _toMesh    = new THREE.Vector3();

function positionSubtitles(dt) {
  const mesh = state.subtitleMesh;
  const cfg  = SUBTITLE_FOLLOW_MODES[SUBTITLE_FOLLOW_MODE] || SUBTITLE_FOLLOW_MODES.lazy;

  _dir.set(0, 0, -1).applyQuaternion(camera.quaternion);
  if (!cfg.followPitch) _dir.y = 0;
  _dir.normalize();

  camera.getWorldPosition(_camPos);

  // Offset by a fixed ANGLE below the view direction rather than a fixed
  // world-space height, so the placement holds when the user changes the
  // panel-distance setting.
  const dist = SUBTITLES.distance + getDistanceOffset();
  _idealPos.copy(_camPos).addScaledVector(_dir, dist);
  _idealPos.y += Math.tan(THREE.MathUtils.degToRad(SUBTITLES.pitchDeg)) * dist;

  _subTarget.position.copy(_idealPos);
  _subTarget.lookAt(_camPos);

  if (!mesh.userData.followInit) {
    mesh.position.copy(_idealPos);
    mesh.quaternion.copy(_subTarget.quaternion);
    mesh.userData.followInit = true;
    return;
  }

  if (cfg.posLambda <= 0) return; // stationary mode: snapped once, never moves

  // Deadzone is measured against the IDEAL direction, not the raw view
  // direction. The ideal spot sits pitchDeg below the view, so comparing
  // to the view direction would read a permanent ~18° error and chase
  // every frame, defeating the deadzone entirely.
  if (cfg.deadzoneDeg > 0) {
    _idealDir.copy(_idealPos).sub(_camPos).normalize();
    _toMesh.copy(mesh.position).sub(_camPos).normalize();
    if (THREE.MathUtils.radToDeg(_idealDir.angleTo(_toMesh)) < cfg.deadzoneDeg) return;
  }

  mesh.position.lerp(_idealPos, 1 - Math.exp(-cfg.posLambda * dt));
  mesh.quaternion.slerp(_subTarget.quaternion, 1 - Math.exp(-cfg.rotLambda * dt));
}

/* ─── Per-frame entry point ───────────────────────────────────────────── */

export function updateSubtitles(dt) {
  const mesh = state.subtitleMesh;
  if (!mesh) return;

  const visible = state.subtitlesOn
    && state.appState === State.PLAYING
    && !state.settingsOpen;

  if (!visible) { mesh.visible = false; return; }

  const idx = activeCueIndex(video.currentTime);

  // Only touch the canvas when the cue actually changes. Texture uploads
  // are the expensive part on Quest.
  if (idx !== state.subtitleShown) {
    state.subtitleShown = idx;
    drawSubtitle(idx >= 0 ? state.subtitleCues[idx].text : '');
  }

  mesh.visible = idx >= 0;
  if (mesh.visible) positionSubtitles(dt);
}