// js/main.js
// Boots the engine: pulls in every module for its side effects (scene
// setup, DOM wiring, input listeners, controller setup), then owns the
// single render loop and kicks off the first scene load. This is the
// only file that should grow if you add a genuinely new subsystem —
// everything else should be a module main.js wires in.

import './three-setup.js';
import './overlay.js';
import './interaction.js';
import { scene, camera, renderer } from './three-setup.js';
import { state, State } from './state.js';
import { SCENARIO_PARAM, ROOT_JSON } from './config.js';
import { loadScene } from './scene-loader.js';
import { positionPanel, updatePanelOpacity } from './panel-mesh.js';
import { drawTransportBar } from './draw-transport.js';
import { updateVRHover } from './vr-controllers.js';

/* ─── Render loop ─────────────────────────────────────────────────────── */
let lastTransportUpdate = 0;
let lastFrameTime = 0;

renderer.setAnimationLoop((time) => {
  // time is a raw timestamp (ms), not elapsed time — derive dt in seconds,
  // clamped so a tab switch or XR session hiccup can't cause a huge jump.
  const dt = lastFrameTime ? Math.min((time - lastFrameTime) / 1000, 0.1) : 1 / 60;
  lastFrameTime = time;

  updateVRHover();

  // Keep panel easing toward the camera-relative "ideal" spot
  if (state.panelMesh) positionPanel(dt);

  // Smoothly animate transport bar opacity every frame
  updatePanelOpacity();

  // Update transport bar every ~250 ms while playing
  if (state.appState === State.PLAYING && time - lastTransportUpdate > 250) {
    lastTransportUpdate = time;
    drawTransportBar(state.hoveredBtn);
  }

  renderer.render(scene, camera);
});

/* ─── Boot ─────────────────────────────────────────────────────────────── */
if (SCENARIO_PARAM) {
  loadScene(ROOT_JSON);
}
// else: idle boot. Used by Menu.html, and by Player.html opened with no
// ?scenario=. The shared Enter VR handler in scene-loader.js drops
// straight into the in-VR library instead of playing a video.
