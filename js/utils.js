// js/utils.js

export function roundRect(ctx, x, y, w, h, r) {
  // Clamp radius so it can never exceed half the shape's own width/height —
  // an oversized radius (e.g. 999 for a "pill" button) makes the corner
  // curves overshoot and self-intersect, producing a huge malformed wedge
  // instead of a rounded rect. Clamping keeps a fully-rounded pill safe.
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function fmt(s) {
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}
