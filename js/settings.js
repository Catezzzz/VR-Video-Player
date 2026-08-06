// js/settings.js
// Settings overlay: font size + panel distance preferences. When opened,
// it REPLACES whichever panel is currently showing (transport bar,
// decision panel, or library) — drawn onto the same shared panelMesh via
// createPanel(), exactly the way switching from the transport bar to the
// decision panel already works elsewhere. Because of that it also
// inherits the main panel's normal soft-follow positioning for free, at
// its own SETTINGS.distance/height (config.js), so it centers in front
// of the camera the same way the decision panel does — regardless of
// which panel it replaced.
//
// Edits are staged in state.pendingSettings and only take effect on
// Apply; Revert resets the draft to factory defaults (a subsequent Apply
// is still needed to make that live — one committal action, always);
// Close discards the draft and hands control back to whichever panel was
// showing before, via a caller-supplied `resume` callback — settings.js
// can't import transitionToPlaying/transitionToDecision/enterLibrary
// directly without creating a circular import, since scene-loader.js and
// library.js both already depend on this module for the gear button.
//
// The small "⚙" gear button (shown only during the decision panel) is
// unaffected by any of this — it stays its own small mesh, a child of
// panelMesh, disposed generically by panel-mesh.js whenever panelMesh is
// recreated (including when settings itself replaces the panel).

import * as THREE from 'three';
import { state, State } from './state.js';
import { SETTINGS_DEFAULTS, DISTANCE_STEPS, GEAR_BUTTON } from './config.js';
import { drawSettingsPanel, computeSettingsDims, drawGearButton } from './draw-settings.js';
import { saveSettings } from './settings-store.js';
import { createPanel, positionPanel } from './panel-mesh.js';
import { video } from './three-setup.js';

function disposeMeshChild(mesh) {
  if (!mesh) return;
  if (mesh.parent) mesh.parent.remove(mesh);
  mesh.geometry.dispose();
  mesh.material.dispose();
  if (mesh.material.map) mesh.material.map.dispose();
}

export function disposeGearMesh() {
  disposeMeshChild(state.gearMesh);
  state.gearMesh    = null;
  state.gearCanvas  = null;
  state.gearCtx     = null;
  state.gearTex     = null;
  state.gearHovered = false;
}

/* Small persistent "⚙" button shown beside the decision panel only.
   Called from scene-loader.js right after the decision panel mesh exists. */
export function createGearButton() {
  disposeGearMesh();
  if (!state.panelMesh) return;

  state.gearCanvas = document.createElement('canvas');
  state.gearCanvas.width  = GEAR_BUTTON.canvasSize;
  state.gearCanvas.height = GEAR_BUTTON.canvasSize;
  state.gearCtx = state.gearCanvas.getContext('2d');
  state.gearTex = new THREE.CanvasTexture(state.gearCanvas);
  state.gearTex.colorSpace = THREE.SRGBColorSpace;

  const geo = new THREE.PlaneGeometry(GEAR_BUTTON.worldSize, GEAR_BUTTON.worldSize);
  const mat = new THREE.MeshBasicMaterial({ map: state.gearTex, transparent: true, depthWrite: false });
  state.gearMesh = new THREE.Mesh(geo, mat);

  const mainW = state.panelMesh.geometry.parameters.width;
  state.gearMesh.position.set(mainW / 2 + GEAR_BUTTON.gap + GEAR_BUTTON.worldSize / 2, 0, 0);
  state.panelMesh.add(state.gearMesh);

  drawGearButton(false);
}

export function openSettings() {
  if (state.settingsOpen) return;
  // Nothing to replace yet, and no sensible way to resume afterwards.
  if (state.appState === State.BOOT || state.appState === State.LOADING) return;

  // Pause playback while settings is up — otherwise the video could end
  // and swap the panel over to a decision screen out from under the user.
  // Only resume on Close if it was actually playing beforehand.
  state.settingsWasPlaying = !video.paused;
  video.pause();

  state.pendingSettings = { ...state.settings };
  state.hoveredBtn      = null;
  state.settingsOpen    = true;

  const dims = computeSettingsDims();
  createPanel(dims.worldW, dims.worldH, dims.canvasW, dims.canvasH);
  if (state.panelMesh) state.panelMesh.material.opacity = 1.0;
  positionPanel();
  drawSettingsPanel(state.pendingSettings, null);
}

/* `resume` rebuilds whichever panel (transport/decision/library) was
   showing before settings opened — supplied by interaction.js, which is
   the one module that can safely import all three without a cycle. */
export function closeSettings(resume) {
  state.settingsOpen    = false;
  state.pendingSettings = null;
  state.hoveredBtn      = null;

  if (state.settingsWasPlaying) video.play().catch(() => {});
  state.settingsWasPlaying = false;

  if (typeof resume === 'function') resume();
}

export function toggleSettings(resume) {
  if (state.settingsOpen) closeSettings(resume);
  else openSettings();
}

export function applySettings() {
  if (!state.pendingSettings) return;
  state.settings = { ...state.pendingSettings };
  saveSettings();
  if (state.panelMesh) state.panelMesh.userData.followInit = false; // Panel stops following for a bit to allow changes to be made
  // Nothing else is visible while settings is open, so there's no other
  // panel to redraw here — the new font/distance values take effect the
  // moment Close rebuilds whatever panel comes back.
  drawSettingsPanel(state.pendingSettings, state.hoveredBtn);
}

export function revertSettings() {
  // Resets the DRAFT to factory defaults — not to the committed settings —
  // so "revert to default" always means the same thing. Apply is still
  // required to make it live, consistent with font/distance edits.
  state.pendingSettings = { ...SETTINGS_DEFAULTS };
  drawSettingsPanel(state.pendingSettings, state.hoveredBtn);
}

/* Maps a click's canvas x-position back to the nearest fixed slider stop,
   using the button's own x/w (set in draw-settings.js to exactly match the
   track). Click-to-jump-to-nearest-stop, not click-and-drag — the same
   interaction the existing video scrubber already uses. */
function sliderUvToStepIndex(btn, uv) {
  const cx = uv.x * state.panelCanvas.width;
  const t  = Math.max(0, Math.min(1, (cx - btn.x) / btn.w));
  return Math.round(t * (DISTANCE_STEPS.length - 1));
}

/* Click routing — called from interaction.js once it knows a click landed
   on the settings panel, with the hit button index (from state.panelButtons,
   same hit list every other panel uses) and the raw click uv, needed to
   place the distance slider's knob. `resume` is forwarded to Close. */
export function handleSettingsButtonClick(idx, uv, resume) {
  const btn = state.panelButtons[idx];
  if (!btn || !state.pendingSettings) return;

  if (btn.action === 'apply')  { applySettings();       return; }
  if (btn.action === 'revert') { revertSettings();      return; }
  if (btn.action === 'close')  { closeSettings(resume); return; }

  if (btn.action === 'font') {
    state.pendingSettings.fontStepIndex = btn.stepIndex;
  } else if (btn.action === 'distance-slider') {
    state.pendingSettings.distanceStepIndex = sliderUvToStepIndex(btn, uv);
  }
  drawSettingsPanel(state.pendingSettings, state.hoveredBtn);
}

export function handleGearClick(resume) {
  toggleSettings(resume);
}
