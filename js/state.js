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
  // Current page (0-based) of the in-VR library's fixed 2x3 grid.
  libraryPage: 0,

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

  // Committed user settings (font size, panel distance, subtitles, ...) —
  // persisted to localStorage. fontStepIndex/distanceStepIndex are indices
  // into config.js's FONT_SCALE_STEPS/DISTANCE_STEPS; subtitlesOn is a plain bool.
  settings: { fontStepIndex: 2, distanceStepIndex: 2, subtitlesOn: false },

  // Draft copy edited live while the settings panel is open; only copied
  // into `settings` on Apply. Null whenever the panel is closed.
  pendingSettings: null,
  settingsOpen: false,
  // Whether the video was mid-playback when settings was opened from the
  // transport bar, so Close only resumes it if it was actually playing.
  settingsWasPlaying: false,

  // Small persistent "⚙" button shown beside the decision panel only,
  // attached as a child of panelMesh so it inherits its soft-follow
  // position for free.
  gearMesh:    null,
  gearCanvas:  null,
  gearCtx:     null,
  gearTex:     null,
  gearHovered: false,


    // Subtitles — own mesh, independent of panelMesh's create/dispose cycle.
    // Whether they're shown is state.settings.subtitlesOn (persisted); these
    // are just the runtime cue/mesh bookkeeping.
    subtitleCues:    [],   // [{ start, end, text }] for the active scene
    subtitleCursor:  0,    // index hint for the active-cue scan
    subtitleShown:   -1,   // cue index currently drawn (-1 = none); guards redraws
    subtitleMesh:    null,
    subtitleCanvas:  null,
    subtitleCtx:     null,
    subtitleTex:     null,
};
