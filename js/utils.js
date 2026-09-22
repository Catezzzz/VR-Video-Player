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

// Draws `img` into the x/y/w/h box the same way CSS `object-fit: cover`
// would — filling the box completely and cropping whichever axis overflows,
// instead of squashing the image or leaving letterbox bars. Used for the
// scenario thumbnails in the in-VR library grid.
export function drawImageCover(ctx, img, x, y, w, h) {
  const boxRatio = w / h;
  const imgRatio = img.width / img.height;
  let sx, sy, sw, sh;
  if (imgRatio > boxRatio) {
    sh = img.height;
    sw = sh * boxRatio;
    sx = (img.width - sw) / 2;
    sy = 0;
  } else {
    sw = img.width;
    sh = sw / boxRatio;
    sx = 0;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

export function fmt(s) {
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}
