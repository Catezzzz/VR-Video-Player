// js/draw-decision.js
// Canvas 2D drawing for the in-VR decision panel: story choices, the
// terminal "scenario complete" screen, and the Replay/Previous/Menu row.

import { state } from './state.js';
import { COLOURS, FONT_HEAD, FONT_MONO, FONT_SIZES, DECISION, DECISION_LAYOUT, MENU_URL } from './config.js';
import { roundRect } from './utils.js';
import { sphereMat } from './three-setup.js';

/* Compute canvas + world dimensions for the decision panel based on how
   many choices the current node has. Width stays fixed; height grows (up
   to a cap) with choice count. */
export function computeDecisionDims(choiceCount) {
  const L = DECISION_LAYOUT;
  const n = Math.max(choiceCount, 1); // reserve at least one "slot" even for terminal/empty panels

  const choicesTotal = n * L.choiceBtnH + (n - 1) * L.choiceGap;
  let canvasH = L.headerH + choicesTotal + L.utilAreaH;
  canvasH = Math.min(Math.max(canvasH, L.minCanvasH), L.maxCanvasH);

  return {
    canvasW: DECISION.canvasW,
    canvasH,
    worldW:  DECISION.worldW,
    worldH:  canvasH / L.pixelsPerMeter,
  };
}

export function drawDecisionPanel(sceneData, hovered = null) {
  const ctx = state.panelCtx;
  const W   = state.panelCanvas.width;
  const H   = state.panelCanvas.height;
  ctx.clearRect(0, 0, W, H);
  sphereMat.color.setRGB(0.35, 0.35, 0.35); // dim background to about 35% brightness

  // Background — dark navy card with soft radial lift, per design tokens
  const bgGrad = ctx.createRadialGradient(W / 2, H * 0.3, 0, W / 2, H * 0.3, W * 0.75);
  bgGrad.addColorStop(0, 'rgba(143,163,255,0.01)');
  ctx.fillStyle = bgGrad;
  roundRect(ctx, 4, 4, W - 8, H - 8, 24);
  ctx.fill();

  ctx.strokeStyle = COLOURS.border;
  ctx.lineWidth   = 1.5;
  roundRect(ctx, 4, 4, W - 8, H - 8, 24);
  ctx.stroke();

  // Prompt text & hint
  const decision = sceneData.decision;
  const choices  = decision?.choices || [];
  const prompt   = decision?.prompt || 'What happens next?';
  const hint     = decision?.hint;

  ctx.fillStyle     = COLOURS.accentSoft;
  ctx.font          = `500 ${FONT_SIZES.kicker}px ${FONT_MONO}`;
  ctx.textAlign     = 'center';
  ctx.letterSpacing = '3px';
  ctx.fillText(decision ? (hint ? '' : 'CHOOSE YOUR PATH') : 'SCENARIO COMPLETE', W / 2, 56);
  ctx.letterSpacing = '0px';

  if (hint) {
    // --- TWO-LINE LAYOUT (Prompt + Hint) ---
    ctx.fillStyle = COLOURS.heading;
    ctx.font      = `800 ${FONT_SIZES.prompt}px ${FONT_HEAD}`;
    ctx.fillText(decision ? prompt : '— End of scenario —', W / 2, 100);

    ctx.fillStyle = COLOURS.accentSoft;
    ctx.font      = `300 ${FONT_SIZES.hint}px ${FONT_HEAD}`;
    ctx.fillText(hint, W / 2, 145);
  } else {
    // --- SINGLE-LINE FALLBACK (If hint is missing/empty) ---
    ctx.fillStyle = COLOURS.heading;
    ctx.font      = `700 ${FONT_SIZES.prompt}px ${FONT_HEAD}`;
    ctx.fillText(decision ? prompt : '— End of scenario —', W / 2, 112);
  }

  // Divider
  ctx.strokeStyle = COLOURS.border;
  ctx.lineWidth   = 1;
  ctx.beginPath(); ctx.moveTo(60, 140); ctx.lineTo(W - 60, 140); ctx.stroke();

  /* Utility row geometry (Replay / Previous Options / Menu) — reserved at a
     fixed position near the bottom so it shows up consistently whether or
     not there are story choices. */
  const UTIL_H   = 64;
  const utilY    = H - 96;
  const dividerY = utilY - 20;

  state.panelButtons = [];

  /* Story choices (or terminal message) fill the middle area */
  const choiceAreaTop    = 180;
  const choiceAreaBottom = dividerY - 24;
  const gap              = 16;

  if (choices.length > 0) {
    const available     = choiceAreaBottom - choiceAreaTop;
    const naturalTotal   = choices.length * 80 + (choices.length - 1) * gap;
    const btnH = naturalTotal > available
      ? (available - (choices.length - 1) * gap) / choices.length
      : DECISION_LAYOUT.choiceBtnH;
    const btnX = 60;
    const btnW = W - 120;

    choices.forEach((choice, i) => {
      const by      = choiceAreaTop + i * (btnH + gap);
      const isHover = hovered === i;
      const letter  = String.fromCharCode(65 + i); // A, B, C…

      // Selected/hovered glow — hand-drawn halo instead of ctx.shadowBlur.
      // Native canvas shadowBlur is unreliable on the Quest/Oculus browser,
      // so we fake the glow with a few oversized, low-opacity rounded rects.
      if (isHover) {
        const haloPad   = [18, 10, 4];
        const haloAlpha = [0.01, 0.05, 0.1];
        for (let h = 0; h < haloPad.length; h++) {
          const p = haloPad[h];
          ctx.fillStyle = `rgba(76,111,255,${haloAlpha[h]})`;
          roundRect(ctx, btnX - p, by - p + 4, btnW + p * 2, btnH + p * 2, 30 + p);
          ctx.fill();
        }
      }

      roundRect(ctx, btnX, by, btnW, btnH, 30);
      ctx.fillStyle = isHover ? COLOURS.btnHover : COLOURS.bgOption;
      ctx.fill();

      ctx.strokeStyle = isHover ? COLOURS.accent : COLOURS.border;
      ctx.lineWidth   = isHover ? 1.5 : 1;
      roundRect(ctx, btnX, by, btnW, btnH, 30);
      ctx.stroke();

      // Measure label/desc text so the badge+text group can be centered
      // as a block within the button, instead of pinned to the left.
      const badgeGap = 20;
      ctx.font = choice.desc
        ? `${isHover ? 700 : 600} ${FONT_SIZES.choiceLabel}px ${FONT_HEAD}`
        : `${isHover ? 700 : 200} ${FONT_SIZES.choiceLabelOnly}px ${FONT_HEAD}`;
      let textBlockW = ctx.measureText(choice.label).width;
      if (choice.desc) {
        ctx.font = `400 ${FONT_SIZES.choiceDesc}px ${FONT_HEAD}`;
        textBlockW = Math.max(textBlockW, ctx.measureText(choice.desc).width);
      }

      // Lettered badge
      const badgeSize = 55;
      const groupW    = badgeSize + badgeGap + textBlockW;
      const groupX    = btnX + (btnW - groupW) / 2;
      const badgeX = groupX, badgeY = by + (btnH - badgeSize) / 2;
      roundRect(ctx, badgeX, badgeY, badgeSize, badgeSize, 15);
      ctx.fillStyle = isHover ? COLOURS.accent : COLOURS.badgeBg;
      ctx.fill();
      ctx.fillStyle = isHover ? '#ffffff' : COLOURS.badgeText;
      ctx.font      = `700 ${FONT_SIZES.badge}px ${FONT_HEAD}`;
      ctx.textAlign = 'center';
      ctx.fillText(letter, badgeX + badgeSize / 2, badgeY + badgeSize / 2 + FONT_SIZES.badge / 3);

      // Label X position (shared by label and description)
      const textX = badgeX + badgeSize + badgeGap;

      if (choice.desc) {
        // --- TWO-LINE LAYOUT (Label + Subtext Description) ---
        ctx.fillStyle = isHover ? '#ffffff' : COLOURS.text;
        ctx.font      = `${isHover ? 700 : 600} ${FONT_SIZES.choiceLabel}px ${FONT_HEAD}`;
        ctx.textAlign = 'left';
        ctx.fillText(choice.label, textX, by + btnH / 2 - 6);

        ctx.fillStyle = isHover ? COLOURS.text : COLOURS.subtext;
        ctx.font      = `400 ${FONT_SIZES.choiceDesc}px ${FONT_HEAD}`;
        ctx.fillText(choice.desc, textX, by + btnH / 2 + 24);
      } else {
        // --- SINGLE-LINE FALLBACK (If choice.desc is missing or empty) ---
        ctx.fillStyle = isHover ? '#ffffff' : COLOURS.text;
        ctx.font      = `${isHover ? 700 : 200} ${FONT_SIZES.choiceLabelOnly}px ${FONT_HEAD}`;
        ctx.textAlign = 'left';
        ctx.fillText(choice.label, textX, by + btnH / 2 + 9);
      }

      // Trailing arrow — only lit up on hover/selected
      if (isHover) {
        ctx.fillStyle  = COLOURS.success;
        ctx.font       = `500 ${FONT_SIZES.choiceArrow}px ${FONT_HEAD}`;
        ctx.textAlign  = 'right';
        ctx.fillText('→', btnX + btnW - 24, by + btnH / 2 + 9);
      }

      state.panelButtons.push({
        x: btnX, y: by, w: btnW, h: btnH,
        id: state.panelButtons.length, label: choice.label,
        action: 'goto', next: choice.next
      });
    });
  } else {
    ctx.fillStyle = COLOURS.subtext;
    ctx.font      = `400 ${FONT_SIZES.emptyState}px ${FONT_HEAD}`;
    ctx.textAlign = 'center';
    ctx.fillText('Choose an option below', W / 2, (choiceAreaTop + choiceAreaBottom) / 2 + 8);
  }

  /* Utility divider */
  ctx.strokeStyle = COLOURS.border;
  ctx.lineWidth   = 1;
  ctx.beginPath(); ctx.moveTo(60, dividerY); ctx.lineTo(W - 60, dividerY); ctx.stroke();

  /* Utility buttons: Replay | Previous Options (if any) | Menu */
  const utilItems = [{ action: 'replay', label: '↺  Replay' }];
  if (state.decisionHistory.length > 0) {
    utilItems.push({ action: 'previous', label: '⏮  Previous Options' });
  }
  if (MENU_URL) {
    utilItems.push({ action: 'menu', label: '≡ Menu' });
  }

  const utilMarginX = 60;
  const utilGap     = 16;
  const utilAreaW   = W - utilMarginX * 2;
  const n           = utilItems.length;
  const utilBtnW    = (utilAreaW - (n - 1) * utilGap) / n;

  utilItems.forEach((item, i) => {
    const idx     = state.panelButtons.length;
    const bx      = utilMarginX + i * (utilBtnW + utilGap);
    const isHover = hovered === idx;

    // Ghost pill — bordered, tinted indigo; fills solid indigo on hover
    roundRect(ctx, bx, utilY, utilBtnW, UTIL_H, 999);
    ctx.fillStyle   = isHover ? COLOURS.utilHover : COLOURS.ghostBg;
    ctx.fill();
    ctx.strokeStyle = isHover ? COLOURS.utilHover : COLOURS.ghostBorder;
    ctx.lineWidth   = isHover ? 1.5 : 1;
    roundRect(ctx, bx, utilY, utilBtnW, UTIL_H, 999);
    ctx.stroke();

    ctx.fillStyle = isHover ? '#ffffff' : COLOURS.badgeText;
    ctx.font      = `400 ${FONT_SIZES.utilButton}px ${FONT_HEAD}`;
    ctx.textAlign = 'center';
    ctx.fillText(item.label, bx + utilBtnW / 2, utilY + UTIL_H / 2 + 7);

    state.panelButtons.push({
      x: bx, y: utilY, w: utilBtnW, h: UTIL_H,
      id: idx, label: item.label,
      action: item.action,
      next: item.action === 'menu' ? MENU_URL : null
    });
  });

  state.panelTex.needsUpdate = true;
}
