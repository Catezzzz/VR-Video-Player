// js/scene-loader.js
// The JSON-driven engine: fetches a node's JSON, loads its video onto the
// sphere, then transitions into either the transport bar (playing) or the
// decision panel (branching / terminal) states. This is the module you'll
// touch when the JSON schema itself changes.

import { state, State } from './state.js';
import { MENU_URL, TRANSPORT, TRANSPORT_OPACITY_IDLE } from './config.js';
import { video, videoTexture, sphereMat, renderer, loadingTexture } from './three-setup.js';
import { createPanel, disposePanelMesh, positionPanel } from './panel-mesh.js';
import { drawDecisionPanel, computeDecisionDims } from './draw-decision.js';
import { drawTransportBar } from './draw-transport.js';
import {
  titleEl, descEl, errorEl, playBtnEl, menuBtnEl, loadBar, vrBtnEl,
  overlay, showOverlay, hideOverlay, setLoadProgress,
} from './overlay.js';
import { enterLibrary } from './library.js';
import { createGearButton } from './settings.js';

export async function loadScene(jsonPath) {
  state.appState = State.LOADING;
  state.hoveredBtn = null;
  state.isPanelHovered = false;
  disposePanelMesh();
  setLoadProgress(0.1);

  // Stop old video
  video.pause();
  video.src = '';
  // Show loading image if available, otherwise white screen
  if (loadingTexture) {
    sphereMat.map = loadingTexture;
  } else {
    sphereMat.map = null;
  }
  sphereMat.needsUpdate = true;

  showOverlay('Loading…', jsonPath);
  playBtnEl.style.display = 'none';
  menuBtnEl.style.display = 'none';
  errorEl.style.display   = 'none';
  vrBtnEl.style.display   = 'none';

  // 1. Fetch JSON
  let sceneData;
  try {
    const res = await fetch(jsonPath);
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${jsonPath}`);
    sceneData = await res.json();
  } catch (e) {
    showError(`Failed to load scene: ${e.message}`);
    return;
  }
  state.currentJSON = sceneData;
  state.currentPath = jsonPath;

  setLoadProgress(0.3);
  titleEl.textContent = sceneData.title || 'Scene';
  descEl.textContent  = 'Loading video…';

  // 2. Derive video path relative to JSON location
  const base     = jsonPath.substring(0, jsonPath.lastIndexOf('/') + 1);
  const videoSrc = sceneData.video.startsWith('http') ? sceneData.video : base + sceneData.video;

  // 3. Load video
  await new Promise((resolve, reject) => {
    video.src = videoSrc;
    video.load();
    video.addEventListener('canplay', resolve, { once: true });
    video.addEventListener('error',   () => reject(new Error(`Cannot load video: ${videoSrc}`)), { once: true });
    setTimeout(() => reject(new Error('Video load timeout')), 30000);
  }).catch(e => { showError(e.message); throw e; });

  setLoadProgress(0.9);

  // Apply video texture to sphere
  videoTexture.image = video;
  videoTexture.needsUpdate = true;
  sphereMat.map = videoTexture;
  sphereMat.needsUpdate = true;

  setLoadProgress(1);

  // 4. Show play prompt (desktop) or just play
  if (renderer.xr.isPresenting) {
    hideOverlay();
    video.play().catch(() => {});
    transitionToPlaying();
  } else {
    showOverlay(sceneData.title || 'Scene', 'Press Play to begin!');
    playBtnEl.style.display = 'inline-block';
    if (navigator.xr) {
      navigator.xr.isSessionSupported('immersive-vr').then(s => { if (s) vrBtnEl.style.display = 'inline-block'; });
    }
    if (MENU_URL) menuBtnEl.style.display = 'inline-block';

    playBtnEl.onclick = () => {
      video.play().then(() => {
        hideOverlay();
        transitionToPlaying();
        vrBtnEl.style.display = 'inline-block';
      }).catch(() => {});
    };
  }

  setTimeout(() => { loadBar.style.width = '0%'; }, 600);
}

export function transitionToPlaying() {
  // Restore sphere background brightness to 100%
  sphereMat.color.setRGB(1.0, 1.0, 1.0);

  state.appState = State.PLAYING;
  state.isPanelHovered = false;
  createPanel(TRANSPORT.worldW, TRANSPORT.worldH, TRANSPORT.canvasW, TRANSPORT.canvasH);
  if (state.panelMesh) state.panelMesh.material.opacity = TRANSPORT_OPACITY_IDLE;
  positionPanel();
  drawTransportBar();
}

export function transitionToDecision() {
  state.appState = State.DECISION;
  state.isPanelHovered = false;
  const choiceCount = state.currentJSON.decision?.choices?.length || 0;
  const dims = computeDecisionDims(choiceCount);
  createPanel(dims.worldW, dims.worldH, dims.canvasW, dims.canvasH);
  if (state.panelMesh) state.panelMesh.material.opacity = 1.0;
  positionPanel();
  drawDecisionPanel(state.currentJSON, null);
  createGearButton();
}

/* Video ended → decide what happens next */
video.addEventListener('ended', () => {
  if (state.currentJSON.decision) {
    transitionToDecision();
  } else if (state.currentJSON.next) {
    loadScene(state.currentJSON.next);
  } else {
    transitionToDecision(); // terminal — shows Replay/Previous/Menu screen
  }
});

function showError(msg) {
  state.appState = State.BOOT;
  titleEl.textContent   = 'Error';
  descEl.textContent    = '';
  errorEl.textContent   = msg;
  errorEl.style.display = 'block';
  overlay.classList.remove('hidden');
  if (MENU_URL) menuBtnEl.style.display = 'inline-block';
  console.error('[VRPlayer]', msg);
}

/* Enter VR button */
if (navigator.xr) {
  navigator.xr.isSessionSupported('immersive-vr').then(supported => {
    if (supported) vrBtnEl.style.display = 'inline-block';
  });
}
vrBtnEl.addEventListener('click', () => {
  if (renderer.xr.isPresenting) return;
  navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor'] })
    .then(session => {
      renderer.xr.setSession(session);
      hideOverlay();
      if (state.appState === State.LOADING || video.readyState >= 3) {
        video.play().catch(() => {});
        transitionToPlaying();
      } else if (state.appState === State.BOOT) {
        // Nothing loaded yet — this is a library entry point (Menu.html,
        // or Player.html opened with no ?scenario=).
        enterLibrary();
      }
    });
});