// js/settings-store.js
// Persists the user's committed settings (font size, panel distance) to
// localStorage. Scoped to the page's origin, so it survives normal
// commits/pushes/redeploys — it only breaks if the storage key's shape
// changes, which is why every read is defensively validated against
// SETTINGS_DEFAULTS rather than trusted blindly.

import { state } from './state.js';
import { SETTINGS_STORAGE_KEY, SETTINGS_DEFAULTS, FONT_SCALE_STEPS, DISTANCE_STEPS } from './config.js';

function isValidStepIndex(n, stepCount) {
  return Number.isInteger(n) && n >= 0 && n < stepCount;
}

/* Reads localStorage into state.settings, falling back to defaults for
   anything missing, malformed, or from an older/unrecognised schema
   version. Safe to call even if localStorage is unavailable (e.g. private
   browsing edge cases) — falls back to defaults rather than throwing. */
export function loadSettings() {
  let parsed = null;
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) parsed = JSON.parse(raw);
  } catch (e) {
    console.warn('[Settings] Failed to read stored settings, using defaults:', e);
  }

  if (!parsed || typeof parsed !== 'object' || parsed.version !== 1) {
    state.settings = { ...SETTINGS_DEFAULTS };
    return;
  }

  state.settings = {
    fontStepIndex: isValidStepIndex(parsed.fontStepIndex, FONT_SCALE_STEPS.length)
      ? parsed.fontStepIndex : SETTINGS_DEFAULTS.fontStepIndex,
    distanceStepIndex: isValidStepIndex(parsed.distanceStepIndex, DISTANCE_STEPS.length)
      ? parsed.distanceStepIndex : SETTINGS_DEFAULTS.distanceStepIndex,
  };
}

/* Writes the current committed state.settings to localStorage. */
export function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ version: 1, ...state.settings }));
  } catch (e) {
    console.warn('[Settings] Failed to save settings:', e);
  }
}
