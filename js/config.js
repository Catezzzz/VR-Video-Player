// js/config.js
// All tunable constants and URL params live here so behaviour/design tweaks
// don't require hunting through logic files.

export const VERSION = '0.10';
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
export const LIBRARY_LAYOUT = {
  headerH:    160,   // kicker + title + top divider
  cardH:      130,   // per-scenario card height
  cardGap:    18,
  minCanvasH: 640,
  maxCanvasH: 1200,
};

/* URL params */
const params = new URLSearchParams(location.search);
// Raw value (no fallback) — lets main.js tell "load this scenario" apart
// from "no scenario given, show the library" instead of always falling
// back to a default scenario.
export const SCENARIO_PARAM = params.get('scenario');
export const ROOT_JSON = SCENARIO_PARAM || 'scenarios/catching-the-bus/intro.json';
export const MENU_URL  = params.get('menu') || 'Menu.html';
