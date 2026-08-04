// js/three-setup.js
// Renderer, scene, camera, the 360° sphere, the <video> element/texture,
// and desktop mouse/touch look controls. Everything else imports its
// THREE primitives from here rather than creating its own — treat this
// as the base layer every other module sits on top of.

import * as THREE from 'three';
import { SPHERE_RADIUS } from './config.js';

export const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.xr.enabled = true;
document.body.appendChild(renderer.domElement);

export const scene  = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 200);
scene.add(camera);

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

/* ─── 360° sphere ─────────────────────────────────────────────────────── */
const sphereGeo = new THREE.SphereGeometry(SPHERE_RADIUS, 64, 32);
sphereGeo.scale(-1, 1, 1); // invert normals
export const sphereMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
export const sphere    = new THREE.Mesh(sphereGeo, sphereMat);
sphere.rotation.y = -Math.PI / 2; // ← tune this per your footage
scene.add(sphere);

/* ─── Video element ───────────────────────────────────────────────────── */
export const video = document.createElement('video');
video.crossOrigin  = 'anonymous';
video.loop         = false;
video.muted        = false;
video.playsInline  = true;
video.preload      = 'auto';

export const videoTexture = new THREE.VideoTexture(video);
videoTexture.colorSpace = THREE.SRGBColorSpace;
renderer.outputColorSpace = THREE.SRGBColorSpace;

/* ─── Optional loading image texture ────────────────────────────────────── */
// The raw image is composited onto a canvas with a solid background, then
// mapped onto the sphere. The sphere uses equirectangular UVs (360° wide,
// 180° tall — a 2:1 aspect ratio), so the canvas MUST also be 2:1 or the
// image will stretch/skew horizontally. A square canvas would double-wide
// on the sphere and skew everything into an oval.
export let loadingTexture = null;

const LOADING_IMAGE_SIZE = 0.35;      // 0–1, fraction of canvas height the image occupies (smaller = smaller image)
const LOADING_BG_COLOR   = '#ffffff'; // background behind the image — set to '#0d0e11' for dark theme

const loadingCanvas = document.createElement('canvas');
loadingCanvas.width  = 2048; // 2:1 aspect to match the sphere's equirectangular UVs
loadingCanvas.height = 1024;
const loadingCtx = loadingCanvas.getContext('2d');

const loadingImg = new Image();
loadingImg.onload = () => {
  const ctx = loadingCtx;
  const cw = loadingCanvas.width, ch = loadingCanvas.height;

  ctx.fillStyle = LOADING_BG_COLOR;
  ctx.fillRect(0, 0, cw, ch);

  // Fit the image within a centered box (sized off canvas HEIGHT, since
  // that's the shorter dimension), preserving its aspect ratio.
  const boxSide = ch * LOADING_IMAGE_SIZE;
  const scale = Math.min(boxSide / loadingImg.width, boxSide / loadingImg.height);
  const drawW = loadingImg.width * scale;
  const drawH = loadingImg.height * scale;
  const dx = (cw - drawW) / 2;
  const dy = (ch - drawH) / 2;

  ctx.drawImage(loadingImg, dx, dy, drawW, drawH);

  loadingTexture = new THREE.CanvasTexture(loadingCanvas);
  loadingTexture.colorSpace = THREE.SRGBColorSpace;
};
loadingImg.onerror = () => {
  // Silently do nothing if loading.png doesn't exist — falls back to white screen.
  console.warn('Optional: Add assets/loading.png for custom loading screen');
};
loadingImg.src = 'assets/loading.png';

/* ─── Desktop look controls (mouse + touch drag) ─────────────────────── */
const euler  = new THREE.Euler(0, 0, 0, 'YXZ');
let dragging = false, lastX = 0, lastY = 0;

renderer.domElement.addEventListener('mousedown', e => { dragging = true; lastX = e.clientX; lastY = e.clientY; });
window.addEventListener('mouseup',   () => { dragging = false; });
window.addEventListener('mousemove', e => {
  if (!dragging) return;
  const dx = (e.clientX - lastX) * 0.003;
  const dy = (e.clientY - lastY) * 0.003;
  lastX = e.clientX; lastY = e.clientY;
  euler.y -= dx;
  euler.x  = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.x - dy));
  camera.quaternion.setFromEuler(euler);
});

let touchLast = null;
renderer.domElement.addEventListener('touchstart', e => { const t = e.touches[0]; touchLast = { x: t.clientX, y: t.clientY }; }, { passive: true });
renderer.domElement.addEventListener('touchmove', e => {
  if (!touchLast) return;
  const t  = e.touches[0];
  const dx = (t.clientX - touchLast.x) * 0.003;
  const dy = (t.clientY - touchLast.y) * 0.003;
  touchLast = { x: t.clientX, y: t.clientY };
  euler.y -= dx;
  euler.x  = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.x - dy));
  camera.quaternion.setFromEuler(euler);
}, { passive: true });
renderer.domElement.addEventListener('touchend', () => { touchLast = null; }, { passive: true });