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
import { loadScene, transitionToPlaying, transitionToDecision } from './scene-loader.js';
import { enterLibrary, drawLibraryPanel } from './library.js';
import { drawGearButton, drawSettingsPanel } from './draw-settings.js';
import { toggleSettings, handleGearClick, handleSettingsButtonClick, createGearButton } from './settings.js';

export const raycaster = new THREE.Raycaster();
const mouse2D = new THREE.Vector2();

export function hitToButtonIndex(uv, buttonList, canvas = state.panelCanvas) {
  const cx = uv.x * canvas.width;
  const cy = (1 - uv.y) * canvas.height;
  for (let i = 0; i < buttonList.length; i++) {
    const b = buttonList[i];
    if (cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h) return i;
  }
  return -1;
}

export function getHitUV() {
  if (!state.panelMesh) return null;
  const hits = raycaster.intersectObject(state.panelMesh, false);
  if (!hits.length) return null;
  return hits[0].uv;
}

/* Tests the gear button and main panel — in that priority order, though
   in practice they never overlap in world space — using whatever ray is
   currently set on `raycaster`. Each mesh is tested individually
   (non-recursive) so the returned uv is always in that mesh's own local
   canvas space, never mixed up with a sibling's. The settings panel has
   no mesh of its own — it's drawn onto panelMesh's canvas like any other
   panel content, so it's covered by the 'main' case below. */
export function getActiveHit() {
  if (state.gearMesh) {
    const hits = raycaster.intersectObject(state.gearMesh, false);
    if (hits.length) return { kind: 'gear', uv: hits[0].uv };
  }
  if (state.panelMesh) {
    const hits = raycaster.intersectObject(state.panelMesh, false);
    if (hits.length) return { kind: 'main', uv: hits[0].uv };
  }
  return null;
}

/* Shared hover dispatch — called after `raycaster` has been aimed, by
   both the desktop mousemove listener and vr-controllers.js's per-frame
   controller polling, so there's exactly one hover code path. */
export function applyHoverHit(hit) {
  const wasHovered = state.isPanelHovered;
  state.isPanelHovered = !!hit;

  const wasGearHover = state.gearHovered;
  state.gearHovered = hit?.kind === 'gear';
  if (wasGearHover !== state.gearHovered) drawGearButton(state.gearHovered);

  if (hit?.kind !== 'main') {
    state.hoveredBtn = null;
    if (wasHovered !== state.isPanelHovered) redrawPanel();
    return;
  }

  // Settings uses the same panelButtons hit list as the decision panel
  // and library, since it's drawn onto the same shared canvas.
  const usesPanelButtons = state.settingsOpen || state.appState === State.DECISION || state.appState === State.LIBRARY;
  const activeButtons = usesPanelButtons ? state.panelButtons : state.transportButtons;
  const idx = hitToButtonIndex(hit.uv, activeButtons);
  const id  = idx >= 0 ? (usesPanelButtons ? idx : activeButtons[idx].id) : null;

  if (id !== state.hoveredBtn || wasHovered !== state.isPanelHovered) {
    state.hoveredBtn = id;
    redrawPanel();
  }
}

// Desktop mouse interaction
renderer.domElement.addEventListener('mousemove', e => {
  mouse2D.x =  (e.clientX / innerWidth)  * 2 - 1;
  mouse2D.y = -(e.clientY / innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse2D, camera);
  applyHoverHit(getActiveHit());
});

renderer.domElement.addEventListener('click', e => {
  mouse2D.x =  (e.clientX / innerWidth)  * 2 - 1;
  mouse2D.y = -(e.clientY / innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse2D, camera);
  handlePanelClick();
});

export function handlePanelClick() {
  const hit = getActiveHit();
  if (!hit) return;

  if (hit.kind === 'gear') { handleGearClick(resumeCurrentPanel); return; }
  if (hit.kind !== 'main') return;

  if (state.settingsOpen) {
    const idx = hitToButtonIndex(hit.uv, state.panelButtons);
    if (idx < 0) return;
    handleSettingsButtonClick(idx, hit.uv, resumeCurrentPanel);
    return;
  }

  if (state.appState === State.DECISION) {
    const idx = hitToButtonIndex(hit.uv, state.panelButtons);
    if (idx < 0) return;
    onChoiceSelected(state.panelButtons[idx]);
  } else if (state.appState === State.PLAYING) {
    const idx = hitToButtonIndex(hit.uv, state.transportButtons);
    if (idx < 0) return;
    onTransportAction(state.transportButtons[idx], hit.uv);
  } else if (state.appState === State.LIBRARY) {
    const idx = hitToButtonIndex(hit.uv, state.panelButtons);
    if (idx < 0) return;
    state.decisionHistory = []; // fresh run starting from the library
    loadScene(state.panelButtons[idx].next);
  }
}

/* Rebuilds whichever panel (transport bar / decision panel / library) was
   showing before settings replaced it — passed into settings.js's
   closeSettings()/toggleSettings() as the `resume` callback, since
   settings.js can't import transitionToPlaying/transitionToDecision/
   enterLibrary directly without creating a circular import. Safe to call
   even outside a settings-close flow, since each of these just rebuilds
   the panel from state already in memory (no re-fetching). */
export function resumeCurrentPanel() {
  if (state.appState === State.PLAYING) {
    transitionToPlaying();
  } else if (state.appState === State.DECISION) {
    transitionToDecision(); // also recreates the gear button
  } else if (state.appState === State.LIBRARY) {
    enterLibrary();
  }
}

function onChoiceSelected(btn) {
  if (btn.action === 'menu') {
    // Presenting in VR: swap the panel back to the library in the same
    // document/session instead of navigating away and ending it. Only
    // fall back to a real page nav for flat/desktop use, where there's
    // no session to protect.
    if (renderer.xr.isPresenting) {
      enterLibrary();
    } else if (MENU_URL) {
      location.href = MENU_URL;
    }
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
    createGearButton();
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
  } else if (btn.id === 'settings') {
    toggleSettings(resumeCurrentPanel);
    return; // openSettings()/closeSettings() already redrew the panel
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
  if (state.settingsOpen) {
    drawSettingsPanel(state.pendingSettings, state.hoveredBtn);
  } else if (state.appState === State.DECISION || state.appState === State.ENDED) {
    drawDecisionPanel(state.currentJSON, state.hoveredBtn);
  } else if (state.appState === State.PLAYING) {
    drawTransportBar(state.hoveredBtn);
  } else if (state.appState === State.LIBRARY) {
    drawLibraryPanel(state.libraryEntries, state.hoveredBtn);
  }
}
