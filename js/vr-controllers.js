// js/vr-controllers.js
// Quest controller models/rays + raycasting the panel via controller pose
// (instead of the mouse), reusing the same hit-testing and click handling
// from interaction.js so there's exactly one "what did I click" code path.

import * as THREE from 'three';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import { renderer, scene, video } from './three-setup.js';
import { state, State } from './state.js';
import { raycaster, getActiveHit, applyHoverHit, handlePanelClick, resumeCurrentPanel } from './interaction.js';
import { toggleSettings } from './settings.js';

const controllerModelFactory = new XRControllerModelFactory();
const controllerLines = [];

[0, 1].forEach(i => {
  const ctrl = renderer.xr.getController(i);
  const ray = new THREE.Mesh(
    new THREE.CylinderGeometry(0.002, 0.002, 5, 8),
    new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: 0.4, transparent: true })
  );
  ray.rotation.x = -Math.PI / 2;
  ray.position.z = -2.5;
  ctrl.add(ray);
  controllerLines.push({ ctrl, ray });

  const grip = renderer.xr.getControllerGrip(i);
  grip.add(controllerModelFactory.createControllerModel(grip));
  scene.add(ctrl); scene.add(grip);

  ctrl.addEventListener('selectstart', () => {
    if (!state.panelMesh) return;
    const mat = new THREE.Matrix4().extractRotation(ctrl.matrixWorld);
    const dir = new THREE.Vector3(0, 0, -1).applyMatrix4(mat);
    const pos = new THREE.Vector3().setFromMatrixPosition(ctrl.matrixWorld);
    raycaster.set(pos, dir);
    handlePanelClick();
  });
});

/* VR controller hover — called every frame from the render loop. Tests
   the gear button / main panel (whichever the ray hits first) via the
   same dispatch mouse hover uses, so there's exactly one hover code path
   for both input methods. Settings has no mesh of its own — it's covered
   by the main-panel case since it's drawn onto the same shared canvas. */
export function updateVRHover() {
  if (!renderer.xr.isPresenting || !state.panelMesh) return;
  let hit = null;
  for (const { ctrl } of controllerLines) {
    const mat = new THREE.Matrix4().extractRotation(ctrl.matrixWorld);
    const dir = new THREE.Vector3(0, 0, -1).applyMatrix4(mat);
    const pos = new THREE.Vector3().setFromMatrixPosition(ctrl.matrixWorld);
    raycaster.set(pos, dir);
    hit = getActiveHit();
    if (hit) break;
  }
  applyHoverHit(hit);
  pollJoystickToggle();
}

/* Controller button polling — called every frame from updateVRHover().
   Edge-triggered per inputSource, so each fires once per press, not once
   per frame held down. Works on either hand.
     Thumbstick click (3)           -> settings panel
     Grip / side trigger (1, "R2")  -> show/hide transport bar
     A / X (4)                      -> play/pause
   If R2 should mean the index trigger instead, set TOGGLE_TRANSPORT_BTN to
   0 (it will then also fire the panel click, since trigger = select). */
const TOGGLE_TRANSPORT_BTN = 1;
const wasPressed = {};  // keyed by "inputSourceIndex:buttonIndex"

function edge(i, btn, gp) {
  const key = `${i}:${btn}`;
  const pressed = !!gp?.buttons?.[btn]?.pressed;
  const fired = pressed && !wasPressed[key];
  wasPressed[key] = pressed;
  return fired;
}

function pollJoystickToggle() {
  const session = renderer.xr.getSession?.();
  if (!session) return;
  session.inputSources.forEach((src, i) => {
    const gp = src.gamepad;
    if (edge(i, 3, gp)) toggleSettings(resumeCurrentPanel);
    if (edge(i, TOGGLE_TRANSPORT_BTN, gp)) toggleTransport();
    if (edge(i, 4, gp)) togglePlayPause();
  });
}

function toggleTransport() {
  if (state.appState !== State.PLAYING || state.settingsOpen) return;
  state.transportHidden = !state.transportHidden;
}

function togglePlayPause() {
  if (state.appState !== State.PLAYING || state.settingsOpen) return;
  video.paused ? video.play().catch(() => {}) : video.pause();
}
