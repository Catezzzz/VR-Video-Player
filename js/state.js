// js/state.js
// Shared mutable app state. Every module imports the same `state` object,
// so mutating a property (state.appState = ...) is visible everywhere —
// this replaces the module-scope `let` variables from the single-file version.

export const State = { BOOT: 'boot', LOADING: 'loading', PLAYING: 'playing', DECISION: 'decision', ENDED: 'ended', LIBRARY: 'library' };

export const state = {
  appState:    State.BOOT,
  currentJSON: null,   // parsed JSON for active scene
  currentPath: null,   // path of active scene JSON

  // Cached scenarios.json manifest, once fetched by the in-VR library panel.
  libraryEntries: null,

  // Stack of decision-node paths the user has passed through, used by the
  // "Previous Options" button. Pushed on a story choice, popped on back-nav.
  decisionHistory: [],

  // Track whether pointer/controller ray is over the panel at all (for opacity)
  isPanelHovered: false,
  hoveredBtn: null,
  isMuted: false,

  // Panel mesh (shared, swaps canvas depending on transport vs decision view)
  panelMesh:   null,
  panelCanvas: null,
  panelCtx:    null,
  panelTex:    null,
  panelButtons:     [], // [{ x, y, w, h, id, label, next }] in canvas coords
  transportButtons: [],
};
