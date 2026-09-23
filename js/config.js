// js/config.js
// All tunable constants and URL params live here so behaviour/design tweaks
// don't require hunting through logic files.

import { state } from './state.js';

export const VERSION = '0.15';

// Bump this when you push a content change (new/edited scenario or video)
// that installed offline copies should pick up. Separate from VERSION
// above, which is just your own visual "did this device update" check —
// bumping CACHE_VERSION forces the Service Worker to drop its old cache
// and redownload the full scenario tree on next launch. Must be kept in
// sync with the matching CACHE_VERSION constant in sw.js.
export const CACHE_VERSION = 'v2';

export const SPHERE_RADIUS = 50;

// Transport bar config
export const TRANSPORT = {
  distance:  3.5,    // metres in front of viewer
  height:   -2.1,    // y offset in world space
  worldW:    5.5,    // world-space width
  worldH:    0.6,    // world-space height
  canvasW:   2048,   // canvas pixel width
  canvasH:   234,    // canvas pixel height
  padX:      60,     // left/right margin inside canvas
  padY:      30,     // top margin for progress bar
};

// Decision panel config — worldH/canvasH are no longer fixed; they're derived
// per-scene from DECISION_LAYOUT based on how many choices the node has.
export const DECISION = {
  distance:  5.5,
  height:   -0.3,
  worldW:    4,
  canvasW:   1078,
};

// Controls how the decision panel's HEIGHT scales with choice count.
export const DECISION_LAYOUT = {
  headerH:        180,   // kicker + prompt/hint + top divider
  choiceBtnH:     120,   // ideal height per choice button
  choiceGap:      16,    // gap between choice buttons
  utilAreaH:      140,   // divider + Replay/Previous/Menu row + bottom margin
  minCanvasH:     620,   // floor, so a 0-1 choice panel isn't a tiny sliver
  maxCanvasH:     1000,  // ceiling, so a 6-choice panel doesn't dwarf the player
  pixelsPerMeter: 260,   // keeps text/button scale consistent across sizes
};

// Opacity levels for transport bar
export const TRANSPORT_OPACITY_IDLE   = 0.18;  // when not hovered
export const TRANSPORT_OPACITY_ACTIVE = 1.0;   // when hovered

// Panel follow behaviour — instead of snapping to be exactly in front of the
// camera every frame, the panel eases toward its "ideal" spot, and can also
// sit still until you've turned away past a deadzone angle.
export const PANEL_FOLLOW = {
  posLambda:   1.0,   // higher = snappier catch-up, lower = laggier/floatier
  rotLambda:   1.0,
  deadzoneDeg: 3.5,    // panel stays put until you look away more than this; 0 disables
};

// Subtitle strip. Placed by ANGLE below the view direction rather than a
// fixed world height, so it holds position across distance settings.
export const SUBTITLES = {
  distance:  3.0,
  pitchDeg: -18,     // degrees below the horizon; negative = below
  worldW:    3.4,
  canvasW:   1024,
  canvasH:   256,
  padX:      36,
  padY:      22,
  lineGap:   10,
  maxLines:  3,
  bgColour:  'rgba(10,14,28,0.62)',
};

// Three follow behaviours to try on device. Switch with ?subfollow=…
export const SUBTITLE_FOLLOW_MODES = {
  stationary: { posLambda: 0,  rotLambda: 0,  deadzoneDeg: 0,  followPitch: false },
  lazy:       { posLambda: 1,  rotLambda: 1,  deadzoneDeg: 3.5, followPitch: false },
  locked:     { posLambda: 40, rotLambda: 40, deadzoneDeg: 0,  followPitch: true  },
};

// Guided Coach design tokens (indigo accent, dark navy panels, Space Grotesk
// for headings/labels, IBM Plex Mono for kickers & timestamps).
export const COLOURS = {
  bg:          '#141a2e',
  bgOption:    'rgba(22,28,52,0.8)',
  border:      'rgba(143,163,255,0)',
  borderHover: 'rgba(143,163,255,0.35)',
  accent:      '#4c6fff',
  accentSoft:  '#a6b6ff',
  success:     '#22d3a8',
  heading:     '#f4f6ff',
  text:        '#e9edff',
  muted:       '#aab3d6',
  subtext:     '#8b93b8',
  badgeBg:     'rgba(143,163,255,0.16)',
  badgeText:   '#c3ccff',
  btnBg:       'rgba(22,28,52,0.9)',
  btnHover:    'rgba(76,111,255,0.1)',
  utilHover:   'rgba(143, 163, 255,0.5)',
  btnPress:    '#4c6fff',
  btnPressText:'#ffffff',
  ghostBg:     'rgba(143,163,255,0.1)',
  ghostBorder: 'rgba(143,163,255,0.3)',
  danger:      '#ff6b6b',
  progress:    '#4c6fff',
  progressBg:  'rgba(143,163,255,0.16)',
};

// Canvas font stacks (fallback to system fonts if webfonts haven't painted yet)
export const FONT_HEAD = "'Space Grotesk', system-ui, sans-serif";
export const FONT_MONO = "'IBM Plex Mono', monospace";

// Canvas text sizes (px). Centralised here so panel typography can be
// tuned in one place instead of hunting through draw calls.
export const FONT_SIZES = {
  // Decision panel
  kicker:          20,
  prompt:          54,
  hint:            24,
  badge:           28,
  choiceLabel:     24,
  choiceDesc:      20,
  choiceLabelOnly: 32,
  choiceArrow:     24,
  emptyState:      26,
  utilButton:      28,
  subtitle:        34,

  // Transport bar
  transportTime:   19,
  transportIcon:   22,
};

// Path to the manifest listing all available scenarios — shared by
// Menu.html's flat grid and the in-VR library panel.
export const MANIFEST_URL = 'scenarios/scenarios.json';

// In-VR library panel placement/sizing (same idea as TRANSPORT/DECISION).
export const LIBRARY = {
  distance: 4.5,
  height:  -0.2,
  worldW:   4.2,
  canvasW:  1200,
};
// Fixed-page grid: cols x rows scenarios per page, with a thumbnail +
// title on each card and prev/next paging instead of scroll (raycasted
// panels have no wheel/scrollbar input, so paging is the simpler fit).
export const LIBRARY_LAYOUT = {
  headerH:    140,   // kicker + title + top divider
  gridTopGap: 20,    // gap between header divider and first row of cards
  cols:       2,
  rows:       3,
  marginX:    48,    // left/right margin for the grid
  colGap:     24,
  rowGap:     24,
  cardThumbH: 176,   // thumbnail box height inside each card
  cardTitleH: 60,    // title-bar height under the thumbnail
  navGapTop:  20,    // gap between grid and the prev/next row
  navH:       90,    // height reserved for the prev/next row
  navBtnW:    150,
  navBtnH:    60,
  navBtnGap:  70,    // gap from panel center to each button's inner edge
};

// In-VR settings panel placement/sizing (same idea as TRANSPORT/DECISION).
// It replaces whichever panel is currently showing rather than sitting
// beside it, so it gets its own distance/height like DECISION does —
// centered in front of the camera regardless of which panel it replaced.
export const SETTINGS = {
  distance: 5.5,
  height:  -0.3,
  worldW:   2.6,
  canvasW:  820,
};
export const SETTINGS_LAYOUT = {
  canvasH:        740,  // fixed — content is static (3 controls + action row), not choice-count dependent
  pixelsPerMeter: 300,
};

// Small persistent "⚙" button shown beside the decision panel only —
// this one stays a side-offset child of the decision panel, unaffected
// by the settings panel's own placement above.
export const GEAR_BUTTON = {
  worldSize:  0.45,
  canvasSize: 220,
  gap:        0.25,
};

// Discrete font-size steps: 2 smaller, default in the middle, 2 bigger.
export const FONT_SCALE_STEPS = [
  { label: 'XS', scale: 0.8 },
  { label: 'S',  scale: 0.9 },
  { label: 'M',  scale: 1.0 },
  { label: 'L',  scale: 1.1 },
  { label: 'XL', scale: 1.2 },
];

// Discrete panel-distance steps (metres, added to each panel's base
// `.distance`): a non-continuous slider with 11 fixed stops, default
// (offset 0) exactly in the middle, left closer, right farther.
export const DISTANCE_STEPS = Array.from({ length: 11 }, (_, i) => ({
  offset: (i - 5) * 0.4, // index 5 (the middle of 0..10) => 0
}));

// On/Off segmented control for the subtitles toggle — same drawStepRow()
// widget the font-size row uses, just with two steps instead of five.
export const SUBTITLE_STEPS = [
  { label: 'Off', value: false },
  { label: 'On',  value: true  },
];

export const SETTINGS_DEFAULTS = { fontStepIndex: 2, distanceStepIndex: 5, subtitlesOn: false };
export const SETTINGS_STORAGE_KEY = 'vrplayer.settings.v1';

/* Scaled copy of FONT_SIZES reflecting the user's committed font-size
   setting. Callers do `const FONT_SIZES = getFontSizes();` at the top of
   a draw function so every existing `FONT_SIZES.xxx` reference below it
   keeps working unchanged. */
export function getFontSizes() {
  const step = FONT_SCALE_STEPS[state.settings.fontStepIndex] || FONT_SCALE_STEPS[2];
  const scaled = {};
  for (const key in FONT_SIZES) scaled[key] = FONT_SIZES[key] * step.scale;
  return scaled;
}

/* Extra metres to add to a panel's base `.distance`, reflecting the user's
   committed panel-distance setting. */
export function getDistanceOffset() {
  const step = DISTANCE_STEPS[state.settings.distanceStepIndex] || DISTANCE_STEPS[5];
  return step.offset;
}

/* URL params */
const params = new URLSearchParams(location.search);
// Raw value (no fallback) — lets main.js tell "load this scenario" apart
// from "no scenario given, show the library" instead of always falling
// back to a default scenario.
export const SCENARIO_PARAM = params.get('scenario');
export const SUBTITLE_FOLLOW_MODE = params.get('subfollow') || 'lazy';
export const ROOT_JSON = SCENARIO_PARAM || 'scenarios/catching-the-bus/intro.json';
export const MENU_URL  = params.get('menu') || 'Menu.html';
