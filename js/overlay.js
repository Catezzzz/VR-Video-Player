// js/overlay.js
// DOM overlay (loading screen, play/menu buttons, error message) — the
// only part of the UI that lives outside the Three.js scene, since it's
// only ever shown on the flat desktop view before/between VR sessions.

import { VERSION, MENU_URL } from './config.js';
import { video } from './three-setup.js';

export const overlay   = document.getElementById('overlay');
export const titleEl   = document.getElementById('scene-title');
export const descEl    = document.getElementById('scene-desc');
export const errorEl   = document.getElementById('error-msg');
export const playBtnEl = document.getElementById('play-btn');
export const menuBtnEl = document.getElementById('menu-btn');
export const loadBar   = document.getElementById('loading-bar');
export const vrBtnEl   = document.getElementById('vr-btn');

const footerEl = document.getElementById('version-txt');
footerEl.textContent = VERSION;

export function showOverlay(title, desc) {
  titleEl.textContent = title;
  descEl.textContent  = desc;
  overlay.classList.remove('hidden');
}
export function hideOverlay() { overlay.classList.add('hidden'); }
export function setLoadProgress(p) { loadBar.style.width = `${p * 100}%`; }

playBtnEl.addEventListener('click', () => { video.play(); hideOverlay(); });
menuBtnEl.addEventListener('click', () => { if (MENU_URL) location.href = MENU_URL; });
