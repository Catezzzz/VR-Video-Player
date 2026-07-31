// js/panel-mesh.js
// Creation/disposal of the single shared panel mesh (re-used for both the
// transport bar and the decision panel — only its canvas size/content
// changes), plus its camera-relative follow behaviour and opacity animation.

import * as THREE from 'three';
import { scene, camera } from './three-setup.js';
import { state, State } from './state.js';
import { TRANSPORT, DECISION, LIBRARY, PANEL_FOLLOW, TRANSPORT_OPACITY_IDLE, TRANSPORT_OPACITY_ACTIVE } from './config.js';

export function disposePanelMesh() {
  if (state.panelMesh) {
    scene.remove(state.panelMesh);
    state.panelMesh.geometry.dispose();
    state.panelMesh.material.dispose();
    if (state.panelTex) state.panelTex.dispose();
    state.panelMesh = null;
    state.panelTex  = null;
  }
}

export function createPanel(worldW, worldH, canvasW, canvasH) {
  disposePanelMesh();
  state.panelCanvas = document.createElement('canvas');
  state.panelCanvas.width  = canvasW;
  state.panelCanvas.height = canvasH;
  state.panelCtx = state.panelCanvas.getContext('2d');
  state.panelTex = new THREE.CanvasTexture(state.panelCanvas);
  state.panelTex.colorSpace = THREE.SRGBColorSpace;

  const geo = new THREE.PlaneGeometry(worldW, worldH);
  const mat = new THREE.MeshBasicMaterial({ map: state.panelTex, transparent: true, depthWrite: false });
  state.panelMesh = new THREE.Mesh(geo, mat);
  scene.add(state.panelMesh);
}

// Reusable scratch object for computing the panel's "ideal" orientation
// without allocating a new Object3D every frame.
const _panelTarget = new THREE.Object3D();

export function positionPanel(dt = 1 / 60) {
  if (!state.panelMesh) return;
  const cfg = state.appState === State.PLAYING ? TRANSPORT
            : state.appState === State.LIBRARY ? LIBRARY
            : DECISION;

  const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  dir.y = 0;
  dir.normalize();

  const camPos = camera.getWorldPosition(new THREE.Vector3());
  const idealPos = camPos.clone().addScaledVector(dir, cfg.distance);
  idealPos.y += cfg.height;

  _panelTarget.position.copy(idealPos);
  _panelTarget.lookAt(camPos);
  const idealQuat = _panelTarget.quaternion;

  // Right after (re)creating the panel mesh, snap into place instead of
  // easing in from nowhere — avoids a weird slide-in on every scene change.
  if (!state.panelMesh.userData.followInit) {
    state.panelMesh.position.copy(idealPos);
    state.panelMesh.quaternion.copy(idealQuat);
    state.panelMesh.userData.followInit = true;
    return;
  }

  // Deadzone: only start chasing once the ideal spot has drifted far
  // enough from where the panel currently sits.
  if (PANEL_FOLLOW.deadzoneDeg > 0) {
    const toPanel = state.panelMesh.position.clone().sub(camPos).normalize();
    const angle = THREE.MathUtils.radToDeg(dir.angleTo(toPanel));
    if (angle < PANEL_FOLLOW.deadzoneDeg) return;
  }

  // Frame-rate independent exponential smoothing, so motion feels the same
  // whether the headset renders at 72Hz or 90Hz.
  const posT = 1 - Math.exp(-PANEL_FOLLOW.posLambda * dt);
  const rotT = 1 - Math.exp(-PANEL_FOLLOW.rotLambda * dt);
  state.panelMesh.position.lerp(idealPos, posT);
  state.panelMesh.quaternion.slerp(idealQuat, rotT);
}

/* Update panel mesh opacity based on hover state (transport bar only) */
export function updatePanelOpacity() {
  if (!state.panelMesh) return;
  if (state.appState === State.PLAYING) {
    const target = state.isPanelHovered ? TRANSPORT_OPACITY_ACTIVE : TRANSPORT_OPACITY_IDLE;
    const current = state.panelMesh.material.opacity;
    state.panelMesh.material.opacity = current + (target - current) * 0.12;
  } else {
    // Decision panel is always fully opaque
    state.panelMesh.material.opacity = 1.0;
  }
}
