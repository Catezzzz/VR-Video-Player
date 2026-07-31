// js/interaction.js
// Raycasting against the panel mesh (desktop mouse) + shared click/hover
// handling used by both mouse and VR-controller input — vr-controllers.js
// aims its own ray and then calls getHitUV/hitToButtonIndex/handlePanelClick
// directly, so hit-testing logic only lives in one place.

import * as THREE from 'three';
import { renderer, camera, video } from './three-setup.js';
import { state, State } from './state.js';
import { MENU_URL } from './config.js';
import { drawDecisionPanel, computeDecisionDims } from './draw-decision.js';
import { drawTransportBar } from './draw-transport.js';
import { createPanel, positionPanel } from './panel-mesh.js';
import { loadScene } from './scene-loader.js';

export const raycaster = new THREE.Raycaster();
const mouse2D = new THREE.Vector2();

export function hitToButtonIndex(uv, buttonList) {
  const cx = uv.x * state.panelCanvas.width;
  const cy = (1 - uv.y) * state.panelCanvas.height;
  for (let i = 0; i < buttonList.length; i++) {
    const b = buttonList[i];
    if (cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h) return i;
  }
  return -1;
}

export function getHitUV() {
  if (!state.panelMesh) return null;
  const hits = raycaster.intersectObject(state.panelMesh);
  if (!hits.length) return null;
  return hits[0].uv;
}

// Desktop mouse interaction
renderer.domElement.addEventListener('mousemove', e => {
  mouse2D.x =  (e.clientX / innerWidth)  * 2 - 1;
  mouse2D.y = -(e.clientY / innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse2D, camera);

  const uv = getHitUV();
  const wasHovered = state.isPanelHovered;
  state.isPanelHovered = !!uv;

  if (!uv) {
    state.hoveredBtn = null;
    if (wasHovered !== state.isPanelHovered) redrawPanel();
    return;
  }

  const activeButtons = state.appState === State.DECISION ? state.panelButtons : state.transportButtons;
  const idx = hitToButtonIndex(uv, activeButtons);
  const id  = idx >= 0 ? (state.appState === State.DECISION ? idx : activeButtons[idx].id) : null;

  if (id !== state.hoveredBtn || wasHovered !== state.isPanelHovered) {
    state.hoveredBtn = id;
    redrawPanel();
  }
});

renderer.domElement.addEventListener('click', e => {
  mouse2D.x =  (e.clientX / innerWidth)  * 2 - 1;
  mouse2D.y = -(e.clientY / innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse2D, camera);
  handlePanelClick();
});

export function handlePanelClick() {
  const uv = getHitUV();
  if (!uv) return;
  if (state.appState === State.DECISION) {
    const idx = hitToButtonIndex(uv, state.panelButtons);
    if (idx < 0) return;
    onChoiceSelected(state.panelButtons[idx]);
  } else if (state.appState === State.PLAYING) {
    const idx = hitToButtonIndex(uv, state.transportButtons);
    if (idx < 0) return;
    onTransportAction(state.transportButtons[idx], uv);
  }
}

function onChoiceSelected(btn) {
  if (btn.action === 'menu') {
    if (MENU_URL) location.href = MENU_URL;
    return;
  }
  if (btn.action === 'replay') {
    // Restart the video for the current scene.
    loadScene(state.currentPath);
    return;
  }
  if (btn.action === 'previous') {
    goToPreviousOptions();
    return;
  }
  // Normal story choice — remember where we came from, then move on.
  state.decisionHistory.push(state.currentPath);
  loadScene(btn.next);
}

/* Jump straight back to the previous decision panel without replaying its
   video — the user already watched it on the way forward. */
async function goToPreviousOptions() {
  if (state.decisionHistory.length === 0) return;
  const prevPath = state.decisionHistory.pop();

  try {
    const res = await fetch(prevPath);
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${prevPath}`);
    const data = await res.json();

    state.currentJSON = data;
    state.currentPath = prevPath;

    video.pause();
    state.appState = State.DECISION;
    state.hoveredBtn = null;
    state.isPanelHovered = false;
    const choiceCount = data.decision?.choices?.length || 0;
    const dims = computeDecisionDims(choiceCount);
    createPanel(dims.worldW, dims.worldH, dims.canvasW, dims.canvasH);
    if (state.panelMesh) state.panelMesh.material.opacity = 1.0;
    positionPanel();
    drawDecisionPanel(state.currentJSON, null);
  } catch (e) {
    console.error('[VRPlayer] Failed to go back to previous options:', e);
    // Put the path back on the stack since we failed to navigate to it.
    state.decisionHistory.push(prevPath);
  }
}

function onTransportAction(btn, uv) {
  if (btn.id === 'playpause') {
    video.paused ? video.play() : video.pause();
  } else if (btn.id === 'mute') {
    state.isMuted = !state.isMuted; video.muted = state.isMuted;
  } else if (btn.id === 'seek') {
    const cx = uv.x * state.panelCanvas.width;
    const pX = 60, pW = state.panelCanvas.width - 120;
    const t  = Math.max(0, Math.min(1, (cx - pX) / pW));
    video.currentTime = t * (video.duration || 0);
  }
  redrawPanel();
}

export function redrawPanel() {
  if (!state.panelCtx) return;
  if (state.appState === State.DECISION || state.appState === State.ENDED) {
    drawDecisionPanel(state.currentJSON, state.hoveredBtn);
  } else if (state.appState === State.PLAYING) {
    drawTransportBar(state.hoveredBtn);
  }
}
