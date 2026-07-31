// js/vr-controllers.js
// Quest controller models/rays + raycasting the panel via controller pose
// (instead of the mouse), reusing the same hit-testing and click handling
// from interaction.js so there's exactly one "what did I click" code path.

import * as THREE from 'three';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import { renderer, scene } from './three-setup.js';
import { state, State } from './state.js';
import { raycaster, getHitUV, hitToButtonIndex, handlePanelClick, redrawPanel } from './interaction.js';

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

/* VR controller hover — called every frame from the render loop */
export function updateVRHover() {
  if (!renderer.xr.isPresenting || !state.panelMesh) return;
  let found = null;
  let panelHit = false;
  for (const { ctrl } of controllerLines) {
    const mat = new THREE.Matrix4().extractRotation(ctrl.matrixWorld);
    const dir = new THREE.Vector3(0, 0, -1).applyMatrix4(mat);
    const pos = new THREE.Vector3().setFromMatrixPosition(ctrl.matrixWorld);
    raycaster.set(pos, dir);
    const uv = getHitUV();
    if (!uv) continue;
    panelHit = true;
    const activeButtons = state.appState === State.DECISION ? state.panelButtons : state.transportButtons;
    const idx = hitToButtonIndex(uv, activeButtons);
    if (idx >= 0) { found = state.appState === State.DECISION ? idx : activeButtons[idx].id; break; }
  }

  const wasHovered = state.isPanelHovered;
  state.isPanelHovered = panelHit;

  if (found !== state.hoveredBtn || wasHovered !== state.isPanelHovered) {
    state.hoveredBtn = found;
    redrawPanel();
  }
}
