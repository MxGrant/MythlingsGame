// Procedural pixel art: creatures, townsfolk, terrain tiles, buildings and props.
// Everything is drawn into small canvases at native pixel resolution and scaled up
// with smoothing disabled, which keeps the retro look crisp.

const OUTLINE = '#251b2f';

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function P(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
}

function ell(ctx, cx, cy, rx, ry, color) {
  ctx.fillStyle = color;
  const irx = Math.max(1, Math.round(rx));
  const iry = Math.max(1, Math.round(ry));
  for (let y = -iry; y <= iry; y++) {
    const k = 1 - (y * y) / (iry * iry);
    const w = Math.round(irx * Math.sqrt(Math.max(0, k)));
    if (w > 0) ctx.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2, 1);
  }
}

function ring(ctx, cx, cy, rx, ry, color, phase = 0) {
  ctx.fillStyle = color;
  const irx = Math.max(1, Math.round(rx));
  const iry = Math.max(1, Math.round(ry));
  for (let y = -iry; y <= iry; y += 2) {
    const k = 1 - (y * y) / (iry * iry);
    const w = Math.round(irx * Math.sqrt(Math.max(0, k)));
    if (w > 0) {
      ctx.fillRect(Math.round(cx - w + ((y + phase) % 4 === 0 ? 1 : 0)), Math.round(cy + y), 1, 1);
      ctx.fillRect(Math.round(cx + w - 1), Math.round(cy + y), 1, 1);
    }
  }
}

function tri(ctx, x, y, w, h, color, dir = 1) {
  ctx.fillStyle = color;
  for (let i = 0; i < h; i++) {
    const width = Math.max(1, Math.round(w * (1 - i / h)));
    ctx.fillRect(Math.round(dir > 0 ? x : x + Math.round(w * i / h)), y + i, width, 1);
  }
}

function line(ctx, x1, y1, x2, y2, color, thick = 2) {
  const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
  ctx.fillStyle = color;
  for (let i = 0; i <= steps; i++) {
    const t = steps === 0 ? 0 : i / steps;
    ctx.fillRect(Math.round(x1 + (x2 - x1) * t), Math.round(y1 + (y2 - y1) * t), thick, thick);
  }
}

function darken(hex, amount = 0.35) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.round(((n >> 16) & 255) * (1 - amount)));
  const g = Math.max(0, Math.round(((n >> 8) & 255) * (1 - amount)));
  const b = Math.max(0, Math.round((n & 255) * (1 - amount)));
  return `rgb(${r},${g},${b})`;
}

function outlineCanvas(canvas, color) {
  const ctx = canvas.getContext('2d');
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const src = new Uint8ClampedArray(img.data);
  const out = img.data;
  const w = canvas.width;
  const h = canvas.height;
  const alphaAt = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : src[(y * w + x) * 4 + 3];
  const c = color.match(/^#(..)(..)(..)$/);
  const r = c ? parseInt(c[1], 16) : 37, g = c ? parseInt(c[2], 16) : 27, b = c ? parseInt(c[3], 16) : 47;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (src[i + 3] > 40) continue;
      if (alphaAt(x - 1, y) > 100 || alphaAt(x + 1, y) > 100 || alphaAt(x, y - 1) > 100 || alphaAt(x, y + 1) > 100) {
        out[i] = r; out[i + 1] = g; out[i + 2] = b; out[i + 3] = 255;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}

function eyes(ctx, spots, style, c) {
  const eyeColor = c.eye || '#241a2b';
  for (const [x, y] of spots) {
    if (style === 'sleepy') {
      P(ctx, x - 1, y, 3, 1, eyeColor);
      continue;
    }
    if (style === 'glow') {
      P(ctx, x, y, 2, 2, c.accent || '#ffe066');
      P(ctx, x, y, 1, 1, '#ffffff');
      continue;
    }
    if (style === 'angry') {
      P(ctx, x, y + 1, 2, 2, eyeColor);
      P(ctx, x - 1, y - 1, 3, 1, darken(eyeColor, 0.2));
      P(ctx, x, y + 1, 1, 1, '#ffffff');
      continue;
    }
    // round / cute
    P(ctx, x, y, 2, 2, eyeColor);
    P(ctx, x, y, 1, 1, '#ffffff');
  }
  if (style === 'cute') {
    for (const [x, y] of spots) P(ctx, x - 2, y + 3, 2, 1, 'rgba(255,120,150,0.55)');
  }
}

function flame(ctx, x, y, h, c, t = 0) {
  const sway = (t % 2 === 0) ? 0 : 1;
  const hh = Math.max(3, h);
  tri(ctx, x - 1, y - hh, 4, hh, c.accent, 1);
  tri(ctx, x + sway, y - hh + 1, 2, hh - 2, c.light, 1);
  P(ctx, x, y - 2, 1, 1, '#ffffff');
}

function horns(ctx, x1, x2, y, c, big = false) {
  const h = big ? 8 : 6;
  line(ctx, x1, y, x1 - 2, y - h, c.light || c.accent, 2);
  line(ctx, x1 - 2, y - h + 1, x1 - 3, y - h + 3, c.accent, 1);
  line(ctx, x2, y, x2 + 2, y - h, c.light || c.accent, 2);
  line(ctx, x2 + 2, y - h + 1, x2 + 3, y - h + 3, c.accent, 1);
}

function wing(ctx, x, y, size, dir, c, flap = 0) {
  // dir 1 = wing sweeping back-left, -1 mirrored
  const h = size + flap;
  tri(ctx, x - size, y - h, size, h, c.shade, dir);
  tri(ctx, x - size + 2, y - h + 2, size - 3, h - 4, c.accent, dir);
  line(ctx, x - 1, y - h + 1, x - size, y, darken(c.shade, 0.25), 1);
}

function tailBeast(ctx, c, feat, bob) {
  if (!feat.includes('tail')) return;
  const pts = [[13, 34 + bob], [9, 33 + bob], [7, 29 + bob], [9, 25 + bob]];
  for (let i = 0; i < pts.length - 1; i++) line(ctx, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], c.shade, 3);
  if (feat.includes('flame')) flame(ctx, 9, 24 + bob, 5, c);
  else ell(ctx, 9, 24 + bob, 3, 3, c.accent);
}

function drawBeast(ctx, c, feat, frame) {
  const bob = [0, 0, -1, 0][frame % 4];
  const wingFlap = frame % 2 === 0 ? 2 : 0;
  if (feat.includes('wings')) wing(ctx, 22, 26 + bob, 17, 1, c, wingFlap);
  tailBeast(ctx, c, feat, bob);
  // legs
  P(ctx, 13, 38 + bob, 4, 5, c.shade);
  P(ctx, 19, 39 + bob, 4, 4, c.shade);
  P(ctx, 27, 38 + bob, 4, 5, c.shade);
  P(ctx, 32, 39 + bob, 4, 4, c.shade);
  P(ctx, 13, 41 + bob, 4, 2, c.light);
  P(ctx, 27, 41 + bob, 4, 2, c.light);
  // body
  ell(ctx, 23, 33 + bob, 12, 8, c.shade);
  ell(ctx, 22, 32 + bob, 11, 7, c.main);
  ell(ctx, 21, 30 + bob, 7, 4, c.light);
  // a big ruff of fur behind the head, for the elder stages
  if (feat.includes('mane')) {
    for (let i = 0; i < 9; i++) {
      const ang = 0.15 + (i / 8) * 2.4;
      const mx = 29 + Math.cos(ang) * 10;
      const my = 26 + Math.sin(ang) * 8;
      ell(ctx, mx, my + bob, 3, 3, i % 2 ? c.accent : c.light);
    }
    ell(ctx, 28, 27 + bob, 9, 7, c.light);
  }
  // head
  ell(ctx, 32, 23 + bob, 9, 7, c.shade);
  ell(ctx, 32, 22 + bob, 8, 6, c.main);
  ell(ctx, 36, 25 + bob, 4, 3, c.light);
  P(ctx, 40, 24 + bob, 2, 1, c.shade);
  // ears
  if (feat.includes('ears')) {
    tri(ctx, 24, 17 + bob, 5, 7, c.main, 1);
    tri(ctx, 26, 19 + bob, 2, 4, c.accent, 1);
    tri(ctx, 34, 16 + bob, 5, 7, c.main, 1);
    tri(ctx, 35, 18 + bob, 2, 4, c.accent, 1);
  }
  if (feat.includes('horns')) horns(ctx, 28, 38, 18 + bob, c, true);
  if (feat.includes('crest')) {
    tri(ctx, 29, 15 + bob, 3, 6, c.accent, 1);
    tri(ctx, 33, 14 + bob, 3, 7, c.accent, 1);
    tri(ctx, 37, 16 + bob, 2, 5, c.accent, 1);
  }
  if (feat.includes('crown')) {
    P(ctx, 28, 17 + bob, 12, 2, c.accent);
    for (let i = 0; i < 4; i++) P(ctx, 28 + i * 3, 14 + bob, 2, 4, c.light);
  }
  if (feat.includes('sprout')) {
    line(ctx, 33, 16 + bob, 33, 10 + bob, c.shade, 1);
    ell(ctx, 31, 10 + bob, 3, 2, c.accent);
    ell(ctx, 36, 9 + bob, 3, 2, c.light);
  }
  if (feat.includes('spots')) {
    P(ctx, 19, 30 + bob, 3, 2, c.accent);
    P(ctx, 25, 35 + bob, 2, 1, c.accent);
    P(ctx, 17, 35 + bob, 2, 1, c.accent);
  }
  if (feat.includes('gem')) {
    P(ctx, 24, 35 + bob, 2, 2, c.accent);
    P(ctx, 23, 36 + bob, 4, 1, c.light);
  }
  if (feat.includes('flame') && !feat.includes('tail')) flame(ctx, 23, 24 + bob, 6, c);
  if (feat.includes('flame')) flame(ctx, 38, 20 + bob, 4, c);
  eyes(ctx, [[33, 21 + bob], [38, 22 + bob]], c.eyeStyle || 'round', c);
  P(ctx, 39, 27 + bob, 2, 1, darken(c.shade, 0.2));
}

function drawDrake(ctx, c, feat, frame) {
  const bob = [0, 0, -1, 0][frame % 4];
  const flap = frame % 2 === 0 ? 3 : 0;
  if (feat.includes('wings')) {
    wing(ctx, 24, 28 + bob, 21, 1, c, flap);
    wing(ctx, 22, 28 + bob, 12, 1, { shade: c.light, accent: c.main, eye: c.eye }, flap + 1);
  }
  // tail
  line(ctx, 13, 35 + bob, 6, 37 + bob, c.shade, 4);
  line(ctx, 6, 37 + bob, 3, 30 + bob, c.shade, 3);
  tri(ctx, 1, 26 + bob, 5, 6, c.accent, 1);
  // legs
  P(ctx, 16, 39 + bob, 4, 4, c.shade);
  P(ctx, 28, 39 + bob, 4, 4, c.shade);
  P(ctx, 16, 42 + bob, 5, 1, c.light);
  P(ctx, 28, 42 + bob, 5, 1, c.light);
  // body
  ell(ctx, 24, 34 + bob, 12, 9, c.shade);
  ell(ctx, 23, 33 + bob, 11, 8, c.main);
  ell(ctx, 22, 31 + bob, 7, 4, c.light);
  // neck and head
  line(ctx, 29, 28 + bob, 33, 19 + bob, c.main, 6);
  ell(ctx, 35, 16 + bob, 8, 6, c.shade);
  ell(ctx, 35, 15 + bob, 7, 5, c.main);
  ell(ctx, 39, 17 + bob, 4, 2, c.light);
  P(ctx, 42, 16 + bob, 1, 1, c.shade);
  // horns
  if (feat.includes('horns')) horns(ctx, 31, 39, 11 + bob, c, true);
  if (feat.includes('crown')) {
    P(ctx, 31, 10 + bob, 10, 2, c.accent);
    for (let i = 0; i < 3; i++) P(ctx, 31 + i * 4, 7 + bob, 2, 4, c.light);
  }
  // belly scales
  for (let i = 0; i < 3; i++) P(ctx, 21 + i * 4, 37 + bob, 3, 1, c.accent);
  if (feat.includes('flame')) flame(ctx, 38, 12 + bob, 6, c);
  if (feat.includes('gem')) {
    P(ctx, 24, 34 + bob, 2, 3, c.accent);
    P(ctx, 23, 35 + bob, 4, 1, c.light);
  }
  eyes(ctx, [[33, 14 + bob], [39, 15 + bob]], c.eyeStyle || 'angry', c);
  P(ctx, 40, 20 + bob, 3, 1, darken(c.shade, 0.2));
}

function drawBlob(ctx, c, feat, frame) {
  const bob = [0, 0, -1, 0][frame % 4];
  // feet
  ell(ctx, 17, 42 + bob, 4, 2, c.shade);
  ell(ctx, 31, 42 + bob, 4, 2, c.shade);
  // body
  ell(ctx, 24, 33 + bob, 14, 10, c.shade);
  ell(ctx, 24, 32 + bob, 13, 9, c.main);
  ell(ctx, 20, 28 + bob, 6, 4, c.light);
  // tiny arms
  ell(ctx, 11, 34 + bob, 3, 5, c.shade);
  ell(ctx, 37, 34 + bob, 3, 5, c.shade);
  if (feat.includes('horns')) horns(ctx, 18, 30, 23 + bob, c);
  if (feat.includes('sprout')) {
    line(ctx, 24, 24 + bob, 24, 14 + bob, c.shade, 2);
    ell(ctx, 19, 15 + bob, 4, 2, c.accent);
    ell(ctx, 29, 13 + bob, 4, 2, c.light);
    P(ctx, 23, 11 + bob, 2, 2, c.accent);
  }
  if (feat.includes('cap')) {
    ell(ctx, 24, 24 + bob, 15, 8, c.shade);
    ell(ctx, 24, 23 + bob, 14, 7, c.accent || c.main);
    for (const [x, y] of [[17, 21], [28, 20], [22, 26], [32, 25]]) {
      if (x < 36) ell(ctx, x, y + bob, 2, 1, c.light);
    }
  }
  if (feat.includes('flame')) flame(ctx, 24, 21 + bob, 7, c);
  if (feat.includes('fin')) {
    tri(ctx, 33, 22 + bob, 5, 8, c.accent, 1);
    tri(ctx, 10, 28 + bob, 5, 6, c.shade, -1);
  }
  if (feat.includes('spots')) {
    P(ctx, 15, 33 + bob, 3, 2, c.accent);
    P(ctx, 29, 36 + bob, 2, 2, c.accent);
    P(ctx, 24, 30 + bob, 2, 1, c.accent);
  }
  eyes(ctx, [[18, 29 + bob], [27, 29 + bob]], c.eyeStyle || 'cute', c);
  P(ctx, 22, 35 + bob, 4, 1, darken(c.shade, 0.25));
  P(ctx, 23, 36 + bob, 2, 1, darken(c.shade, 0.25));
}

function drawFish(ctx, c, feat, frame) {
  const bob = [0, 0, -1, 0][frame % 4];
  const sway = frame % 2 === 0 ? 1 : -1;
  // tail
  tri(ctx, 2, 22 + bob + sway, 12, 14, c.shade, 1);
  tri(ctx, 4, 25 + bob + sway, 8, 8, c.accent, 1);
  // dorsal fin
  tri(ctx, 18, 14 + bob, 5, 10, c.accent, 1);
  tri(ctx, 21, 17 + bob, 3, 7, c.light, 1);
  // body
  ell(ctx, 23, 29 + bob, 15, 10, c.shade);
  ell(ctx, 23, 28 + bob, 14, 9, c.main);
  ell(ctx, 22, 25 + bob, 8, 4, c.light);
  // side fin
  tri(ctx, 24, 33 + bob, 7, 6, c.accent, 1);
  // face
  P(ctx, 36, 28 + bob, 2, 2, darken(c.shade, 0.3));
  if (feat.includes('horns')) horns(ctx, 24, 32, 19 + bob, c);
  if (feat.includes('spots')) {
    P(ctx, 18, 27 + bob, 2, 2, c.accent);
    P(ctx, 25, 30 + bob, 2, 1, c.accent);
    P(ctx, 20, 33 + bob, 2, 1, c.accent);
  }
  if (feat.includes('whiskers')) {
    line(ctx, 39, 28 + bob, 45, 25 + bob, c.accent, 1);
    line(ctx, 39, 30 + bob, 45, 31 + bob, c.accent, 1);
  }
  ell(ctx, 33, 26 + bob, 3, 3, '#ffffff');
  eyes(ctx, [[32, 25 + bob]], c.eyeStyle || 'cute', c);
}

function drawBug(ctx, c, feat, frame) {
  const bob = [0, 0, -1, 0][frame % 4];
  // legs
  for (const x of [16, 20, 28, 32]) P(ctx, x, 37 + bob, 2, 5, c.shade);
  // body
  ell(ctx, 24, 34 + bob, 10, 8, c.shade);
  ell(ctx, 24, 33 + bob, 9, 7, c.main);
  ell(ctx, 21, 30 + bob, 5, 3, c.light);
  if (feat.includes('cap')) {
    ell(ctx, 24, 25 + bob, 16, 10, c.shade);
    ell(ctx, 24, 23 + bob, 15, 9, c.accent || c.main);
    for (const [x, y] of [[16, 21], [27, 18], [33, 24], [21, 27]]) ell(ctx, x, y + bob, 2, 1, c.light);
    P(ctx, 23, 18 + bob, 1, 2, c.light);
  }
  if (feat.includes('antenna')) {
    line(ctx, 20, 27 + bob, 16, 17 + bob, c.shade, 1);
    line(ctx, 28, 27 + bob, 32, 16 + bob, c.shade, 1);
    P(ctx, 15, 16 + bob, 2, 2, c.accent);
    P(ctx, 32, 15 + bob, 2, 2, c.accent);
  }
  if (feat.includes('spots')) {
    P(ctx, 19, 35 + bob, 2, 2, c.accent);
    P(ctx, 28, 36 + bob, 2, 1, c.accent);
  }
  eyes(ctx, [[20, 33 + bob], [27, 33 + bob]], c.eyeStyle || 'sleepy', c);
  P(ctx, 23, 37 + bob, 3, 1, darken(c.shade, 0.25));
}

function drawGolem(ctx, c, feat, frame) {
  const bob = [0, 0, -1, 0][frame % 4];
  // legs
  P(ctx, 16, 38 + bob, 6, 6, c.shade);
  P(ctx, 27, 38 + bob, 6, 6, c.shade);
  P(ctx, 16, 42 + bob, 7, 2, c.main);
  P(ctx, 27, 42 + bob, 7, 2, c.main);
  // arms
  P(ctx, 8, 25 + bob, 6, 13, c.shade);
  P(ctx, 35, 25 + bob, 6, 13, c.shade);
  P(ctx, 9, 26 + bob, 4, 6, c.main);
  P(ctx, 36, 26 + bob, 4, 6, c.main);
  // torso
  P(ctx, 13, 24 + bob, 23, 15, c.shade);
  P(ctx, 14, 24 + bob, 21, 13, c.main);
  P(ctx, 15, 25 + bob, 19, 2, c.light);
  // head
  P(ctx, 17, 13 + bob, 14, 11, c.shade);
  P(ctx, 18, 14 + bob, 12, 9, c.main);
  P(ctx, 19, 15 + bob, 10, 2, c.light);
  // cracks
  line(ctx, 20, 28 + bob, 24, 33 + bob, darken(c.shade, 0.2), 1);
  line(ctx, 30, 26 + bob, 28, 30 + bob, darken(c.shade, 0.2), 1);
  if (feat.includes('gem')) {
    P(ctx, 23, 29 + bob, 4, 4, c.accent);
    P(ctx, 24, 28 + bob, 2, 6, c.light);
    P(ctx, 22, 30 + bob, 6, 2, c.accent);
  }
  if (feat.includes('cap')) {
    ell(ctx, 24, 13 + bob, 17, 8, c.shade);
    ell(ctx, 24, 12 + bob, 16, 7, c.accent || c.main);
    for (const [x, y] of [[15, 11], [26, 8], [33, 12], [21, 15]]) ell(ctx, x, y + bob, 2, 1, c.light);
  }
  if (feat.includes('horn') || feat.includes('horns')) horns(ctx, 18, 30, 13 + bob, c);
  if (feat.includes('fin')) tri(ctx, 34, 22 + bob, 5, 9, c.accent, 1);
  // glowing eyes
  P(ctx, 21, 19 + bob, 3, 2, c.eye || '#ffe066');
  P(ctx, 28, 19 + bob, 3, 2, c.eye || '#ffe066');
  P(ctx, 22, 19 + bob, 1, 1, '#ffffff');
  P(ctx, 29, 19 + bob, 1, 1, '#ffffff');
  P(ctx, 22, 22 + bob, 6, 1, darken(c.shade, 0.35));
}

function drawWisp(ctx, c, feat, frame) {
  const bob = [0, -1, 0, 1][frame % 4];
  ring(ctx, 24, 28 + bob, 19, 15, c.accent + '55', frame);
  // trailing wisps
  line(ctx, 19, 37 + bob, 17, 43 + bob, c.shade, 2);
  line(ctx, 24, 38 + bob, 24, 44 + bob, c.shade, 2);
  line(ctx, 29, 37 + bob, 31, 42 + bob, c.shade, 2);
  // body
  ell(ctx, 24, 28 + bob, 11, 11, c.shade);
  ell(ctx, 24, 27 + bob, 10, 10, c.main);
  ell(ctx, 20, 23 + bob, 5, 4, c.light);
  // little arms
  ell(ctx, 13, 30 + bob, 3, 5, c.shade);
  ell(ctx, 35, 30 + bob, 3, 5, c.shade);
  if (feat.includes('horns')) horns(ctx, 19, 29, 19 + bob, c);
  if (feat.includes('wings')) {
    wing(ctx, 18, 24 + bob, 14, 1, c, frame % 2 === 0 ? 2 : 0);
  }
  if (feat.includes('tail')) line(ctx, 33, 33 + bob, 40, 37 + bob, c.accent, 2);
  if (feat.includes('gem')) {
    P(ctx, 23, 30 + bob, 3, 3, c.accent);
    P(ctx, 24, 29 + bob, 1, 5, c.light);
  }
  if (feat.includes('glow')) {
    P(ctx, 16, 33 + bob, 1, 1, c.accent);
    P(ctx, 33, 22 + bob, 1, 1, c.accent);
    P(ctx, 12, 24 + bob, 1, 1, c.light);
  }
  eyes(ctx, [[19, 26 + bob], [28, 26 + bob]], c.eyeStyle || 'glow', c);
  P(ctx, 23, 32 + bob, 3, 1, darken(c.shade, 0.25));
}

function drawBird(ctx, c, feat, frame) {
  const bob = [0, 0, -1, 0][frame % 4];
  const flap = frame % 2 === 0 ? 4 : 0;
  if (feat.includes('wings')) {
    wing(ctx, 20, 28 + bob, 16 + flap, 1, c, 0);
    wing(ctx, 25, 28 + bob, 12 + flap, -1, { shade: c.light, accent: c.main, eye: c.eye }, 0);
  }
  // tail feathers
  tri(ctx, 3, 27 + bob, 10, 8, c.shade, 1);
  tri(ctx, 4, 29 + bob, 7, 4, c.accent, 1);
  // legs
  line(ctx, 22, 40 + bob, 22, 44 + bob, c.accent, 1);
  line(ctx, 28, 40 + bob, 28, 44 + bob, c.accent, 1);
  P(ctx, 19, 44 + bob, 4, 1, c.accent);
  P(ctx, 28, 44 + bob, 4, 1, c.accent);
  // body
  ell(ctx, 24, 33 + bob, 12, 10, c.shade);
  ell(ctx, 24, 32 + bob, 11, 9, c.main);
  ell(ctx, 21, 28 + bob, 6, 3, c.light);
  // head
  ell(ctx, 35, 21 + bob, 8, 7, c.shade);
  ell(ctx, 35, 20 + bob, 7, 6, c.main);
  // beak
  tri(ctx, 41, 19 + bob, 5, 4, c.accent, 1);
  P(ctx, 41, 20 + bob, 3, 1, c.light);
  if (feat.includes('crest')) {
    tri(ctx, 31, 12 + bob, 3, 7, c.accent, 1);
    tri(ctx, 36, 11 + bob, 3, 8, c.accent, 1);
  }
  if (feat.includes('crown')) {
    P(ctx, 30, 13 + bob, 12, 2, c.accent);
    for (let i = 0; i < 4; i++) P(ctx, 30 + i * 3, 10 + bob, 2, 4, c.light);
  }
  if (feat.includes('ears')) {
    tri(ctx, 30, 13 + bob, 4, 6, c.main, 1);
    tri(ctx, 37, 13 + bob, 4, 6, c.main, 1);
  }
  if (feat.includes('glow')) {
    P(ctx, 12, 25 + bob, 1, 1, c.accent);
    P(ctx, 42, 33 + bob, 1, 1, c.accent);
  }
  if (feat.includes('spots')) {
    P(ctx, 20, 33 + bob, 3, 2, c.accent);
    P(ctx, 27, 36 + bob, 2, 2, c.accent);
  }
  eyes(ctx, [[35, 18 + bob], [40, 19 + bob]], c.eyeStyle || 'round', c);
}

const KIND_DRAW = {
  beast: drawBeast, drake: drawDrake, blob: drawBlob,
  fish: drawFish, bug: drawBug, golem: drawGolem, wisp: drawWisp, bird: drawBird,
};

const SPRITE_CACHE = new Map();

export function creatureSprite(speciesId, sp, frame = 0) {
  const key = `${speciesId}|${frame}`;
  if (SPRITE_CACHE.has(key)) return SPRITE_CACHE.get(key);
  const canvas = makeCanvas(48, 48);
  const ctx = canvas.getContext('2d');
  const c = {
    main: sp.sprite.main, shade: sp.sprite.shade, light: sp.sprite.light,
    accent: sp.sprite.accent, eye: sp.sprite.eye, eyeStyle: sp.sprite.eyeStyle,
  };
  const feat = sp.sprite.features || [];
  const draw = KIND_DRAW[sp.sprite.kind] || drawBeast;
  ctx.save();
  draw(ctx, c, feat, frame);
  ctx.restore();
  applyDetails(ctx, sp, frame);
  outlineCanvas(canvas, sp.sprite.outline || darken(sp.sprite.shade, 0.5));
  SPRITE_CACHE.set(key, canvas);
  return canvas;
}

function applyDetails(ctx, sp, frame) {
  // A soft glint on the eyes and a tiny ground-coloured tummy patch helps small
  // sprites read better at 2x.
  const c = sp.sprite;
  if (c.kind === 'golem' || c.kind === 'blob') return;
}

export function drawCreature(ctx, sp, x, y, scale = 2, opts = {}) {
  const frame = opts.frame || 0;
  const canvas = creatureSprite(sp.id, sp, frame);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (opts.flip) {
    ctx.translate(x + 48 * scale, y);
    ctx.scale(-1, 1);
    ctx.drawImage(canvas, 0, 0, 48 * scale, 48 * scale);
  } else {
    ctx.drawImage(canvas, Math.round(x), Math.round(y), 48 * scale, 48 * scale);
  }
  ctx.restore();
}

export function creatureThumbCanvas(sp, scale = 2, frame = 0) {
  const src = creatureSprite(sp.id, sp, frame);
  const c = makeCanvas(48 * scale, 48 * scale);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 0, 0, 48 * scale, 48 * scale);
  return c;
}

// ---------------------------------------------------------------- Townsfolk
const HATS = ['none', 'cap', 'wide', 'hood', 'nurse', 'bandana'];

export function drawPerson(ctx, look, px, py, dir = 'down', step = 0, opts = {}) {
  const skin = look.skin || '#f0c09a';
  const hair = look.hair || '#4b3223';
  const shirt = look.shirt || '#5b8fd6';
  const pants = look.pants || '#3b3f63';
  const accent = look.accent || '#ffe066';
  const bob = step ? 1 : 0;
  const x = Math.round(px);
  const y = Math.round(py);
  const outline = '#2a2033';

  // shadow
  ctx.fillStyle = 'rgba(20,12,30,0.22)';
  ctx.fillRect(x + 3, y + 15, 10, 1);

  // silhouette
  P(ctx, x + 4, y + 2, 9, 13, outline);
  P(ctx, x + 3, y + 8, 11, 6, outline);

  // legs
  P(ctx, x + 5, y + 13, 2, 3 - (step ? 0 : 1), pants);
  P(ctx, x + 10, y + 13, 2, 3 - (step ? 1 : 0), pants);
  P(ctx, x + 4, y + 15, 3, 1, outline);
  P(ctx, x + 10, y + 14 + (step ? 0 : 1), 3, 1, outline);

  // torso
  P(ctx, x + 5, y + 9, 7, 4, shirt);
  P(ctx, x + 3, y + 9, 2, 4, shirt);
  P(ctx, x + 12, y + 9, 2, 4, shirt);
  P(ctx, x + 3, y + 12, 2, 2, skin);
  P(ctx, x + 12, y + 12, 2, 2, skin);
  // scarf
  P(ctx, x + 5, y + 9, 7, 1, accent);

  // head
  P(ctx, x + 5, y + 3, 7, 6, skin);
  P(ctx, x + 4, y + 2, 9, 3, hair);
  P(ctx, x + 4, y + 4, 1, 3, hair);
  P(ctx, x + 12, y + 4, 1, 2, hair);
  P(ctx, x + 5, y + 5, 7, 1, hair);

  if (dir !== 'up') {
    if (dir === 'left') P(ctx, x + 6, y + 6, 1, 1, outline);
    else if (dir === 'right') P(ctx, x + 10, y + 6, 1, 1, outline);
    else { P(ctx, x + 6, y + 6, 1, 1, outline); P(ctx, x + 10, y + 6, 1, 1, outline); }
  } else {
    P(ctx, x + 5, y + 2, 7, 5, hair);
    P(ctx, x + 4, y + 2, 9, 3, hair);
  }

  // hats
  if (look.hat === 'cap') {
    P(ctx, x + 4, y + 1, 9, 3, accent);
    P(ctx, x + 12, y + 3, 3, 1, accent);
    P(ctx, x + 5, y + 4, 7, 1, darken(accent, 0.25));
  } else if (look.hat === 'wide') {
    P(ctx, x + 2, y + 3, 13, 2, accent);
    P(ctx, x + 5, y + 1, 7, 3, darken(accent, 0.15));
  } else if (look.hat === 'hood') {
    P(ctx, x + 3, y + 1, 11, 4, shirt);
    P(ctx, x + 4, y + 4, 3, 5, shirt);
    P(ctx, x + 10, y + 4, 3, 5, shirt);
    P(ctx, x + 5, y + 4, 6, 4, skin);
    if (dir !== 'up') { P(ctx, x + 6, y + 6, 1, 1, outline); P(ctx, x + 10, y + 6, 1, 1, outline); }
  } else if (look.hat === 'nurse') {
    P(ctx, x + 5, y + 1, 7, 2, '#fdf7fb');
    P(ctx, x + 8, y + 1, 2, 1, accent);
    P(ctx, x + 8, y + 0, 1, 2, accent);
  } else if (look.hat === 'bandana') {
    P(ctx, x + 4, y + 2, 9, 2, accent);
    P(ctx, x + 12, y + 3, 2, 2, accent);
  }

  if (look.coat) {
    P(ctx, x + 4, y + 9, 9, 1, '#f9f6ef');
    P(ctx, x + 4, y + 11, 2, 3, '#f9f6ef');
    P(ctx, x + 11, y + 11, 2, 3, '#f9f6ef');
  }
}

// ---------------------------------------------------------------- Terrain
const THEME = {
  sanctum:{ g1: '#463259', g2: '#3c294d', blade: '#2a1c3d', blade2: '#6d548a', path: '#4a3563', path2: '#38264c', leaf: '#241a33', leafDark: '#1a1226', leafLight: '#4a3860', trunk: '#2f233f', water: '#2fa9bc', waterLight: '#7fe6e0' },
  town:   { g1: '#7ecb63', g2: '#74c15a', blade: '#4e9b3e', blade2: '#a8e08c', path: '#dfc08c', path2: '#c9a877', leaf: '#4f9b46', leafDark: '#347034', leafLight: '#77c463', trunk: '#8a5a3b', water: '#4fa9ff', waterLight: '#a8dcff' },
  route:  { g1: '#79c45a', g2: '#6fb954', blade: '#498f3a', blade2: '#a3dc86', path: '#d9b681', path2: '#c19b67', leaf: '#4c9342', leafDark: '#2f6b30', leafLight: '#74bf58', trunk: '#7c5136', water: '#4fa9ff', waterLight: '#a8dcff' },
  forest: { g1: '#67b95c', g2: '#5cae52', blade: '#3d7c36', blade2: '#93d478', path: '#c9a97c', path2: '#ae8f63', leaf: '#3f8a42', leafDark: '#276229', leafLight: '#63b45c', trunk: '#6b4630', water: '#3f96d6', waterLight: '#8fd0f0' },
  ember:  { g1: '#c9ae74', g2: '#bfa468', blade: '#8f733f', blade2: '#e4cf9a', path: '#b6a5b0', path2: '#9a8792', leaf: '#7a6a45', leafDark: '#5a4a30', leafLight: '#a08a58', trunk: '#6b4a36', water: '#5b7f9e', waterLight: '#9ac0d4' },
  cave:   { g1: '#665475', g2: '#5c4b6b', blade: '#453655', blade2: '#a08ab8', path: '#766289', path2: '#615073', leaf: '#2f2540', leafDark: '#231a33', leafLight: '#4b3d60', trunk: '#3a2f47', water: '#2fa9bc', waterLight: '#7fe6e0' },
};

function hash(x, y, seed = 0) {
  let h = x * 374761393 + y * 668265263 + seed * 1274126177;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function drawTile(ctx, ch, px, py, map, tx, ty, time = 0) {
  const th = THEME[map.theme] || THEME.town;
  const r = hash(tx, ty, (map.id || '').length);
  const isInterior = map.theme === 'lab' || map.theme === 'clinic' || map.theme === 'market' || map.theme === 'house';

  if (isInterior) {
    drawInteriorTile(ctx, ch, px, py, map, tx, ty, r);
    return;
  }

  if (ch === ' ' || ch === 'X') {
    P(ctx, px, py, 16, 16, '#2b2038');
    if (ch === 'X') {
      P(ctx, px, py, 16, 16, '#3a2d4d');
      P(ctx, px + 2, py + 3, 5, 3, '#483a5c');
      P(ctx, px + 9, py + 8, 5, 4, '#31253f');
      if (r > 0.6) P(ctx, px + 4, py + 10, 3, 2, '#4e3f62');
      if (r > 0.85) P(ctx, px + 12, py + 2, 2, 4, '#241a30');
    }
    return;
  }

  if (ch === '~') {
    P(ctx, px, py, 16, 16, th.water);
    P(ctx, px, py, 16, 2, th.waterLight);
    const wave = Math.floor(time * 2 + (tx + ty) % 4) % 4;
    P(ctx, px + wave, py + 5, 5, 1, '#ffffff55');
    P(ctx, px + 8 - wave, py + 10, 6, 1, th.waterLight);
    P(ctx, px + ((r * 10) | 0), py + 13, 3, 1, '#2b7fc4');
    return;
  }

  if (ch === 'M') {
    P(ctx, px, py, 16, 16, th.g1);
    if (map.theme === 'ember') P(ctx, px, py, 16, 16, '#a88a5a');
    P(ctx, px + 1, py + 3, 14, 12, '#6b6070');
    P(ctx, px + 2, py + 3, 12, 3, '#8a8090');
    P(ctx, px + 4, py + 7, 6, 4, '#544a5c');
    P(ctx, px + 10, py + 9, 4, 4, '#7a7080');
    P(ctx, px + 2, py + 14, 12, 2, '#4a4152');
    return;
  }

  if (ch === '#') {
    // tree; ground first
    P(ctx, px, py, 16, 16, th.g1);
    if (r > 0.5) P(ctx, px + 2, py + 12, 2, 2, th.g2);
    P(ctx, px + 6, py + 10, 4, 6, th.trunk);
    P(ctx, px + 5, py + 12, 6, 3, th.trunk);
    ell(ctx, px + 8, py + 7, 8, 7, th.leafDark);
    ell(ctx, px + 7, py + 6, 7, 6, th.leaf);
    ell(ctx, px + 5, py + 4, 3, 3, th.leafLight);
    ell(ctx, px + 11, py + 8, 3, 2, th.leafLight);
    if (r > 0.75) P(ctx, px + 10, py + 4, 1, 1, '#ffd447');
    return;
  }

  if (ch === 'f') {
    P(ctx, px, py, 16, 16, th.g1);
    P(ctx, px + 4, py + 10, 1, 3, th.blade);
    P(ctx, px + 9, py + 9, 1, 4, th.blade);
    const colors = ['#ff8fb1', '#ffe066', '#c9a6f0', '#ff9f6e'];
    const col = colors[(r * colors.length) | 0];
    for (const [fx, fy] of [[4, 9], [10, 8], [7, 12]]) {
      P(ctx, px + fx, py + fy, 2, 2, col);
      P(ctx, px + fx, py + fy, 1, 1, '#ffffffaa');
    }
    return;
  }

  // default ground
  P(ctx, px, py, 16, 16, th.g1);
  if (r > 0.5) {
    P(ctx, px + 4, py + 5, 2, 2, th.g2);
    P(ctx, px + 11, py + 11, 3, 2, th.g2);
    P(ctx, px + 2, py + 13, 2, 1, th.blade);
  }
  P(ctx, px + ((r * 12) | 0), py + 8 + ((r * 5) | 0), 1, 2, th.blade);
  if (r > 0.7) P(ctx, px + ((r * 10) | 0), py + 4, 1, 1, th.blade2);

  if (ch === ',') {
    const moss = map.theme === 'cave' || map.theme === 'sanctum';
    const blade1 = moss ? '#3fae94' : th.blade;
    const blade2 = moss ? '#7fffd4' : th.leaf;
    const blade3 = moss ? '#c8fff0' : th.blade2;
    const sway = Math.round(Math.sin(time * 2 + tx + ty) * 1);
    if (moss) {
      ctx.globalAlpha = 0.35 + Math.sin(time * 2 + tx) * 0.1;
      P(ctx, px + 2, py + 10, 12, 4, '#7fffd433');
      ctx.globalAlpha = 1;
    }
    for (let i = 0; i < 4; i++) {
      const bx = px + 2 + i * 4;
      P(ctx, bx, py + 6, 1, 9, blade1);
      P(ctx, bx + 1, py + 4, 1, 10, blade2);
      P(ctx, bx - 1, py + 7, 1, 7, blade3);
      P(ctx, bx + sway, py + 3, 2, 3, blade1);
    }
    P(ctx, px, py + 14, 16, 2, '#00000022');
    return;
  }

  if (ch === '=') {
    P(ctx, px, py, 16, 16, th.path);
    P(ctx, px, py, 16, 1, th.path2);
    P(ctx, px, py + 15, 16, 1, th.path2);
    if (r > 0.55) { P(ctx, px + 2, py + 4, 2, 2, th.path2); P(ctx, px + 11, py + 9, 2, 2, th.path2); }
    if (r > 0.85) P(ctx, px + 6, py + 11, 3, 2, th.path2);
    return;
  }

  if (ch === 'B') {
    P(ctx, px, py, 16, 16, th.water);
    P(ctx, px, py, 16, 16, '#a97a4e');
    for (let i = 0; i < 4; i++) {
      P(ctx, px, py + i * 4, 16, 1, '#7d5636');
      P(ctx, px, py + i * 4 + 1, 16, 1, '#c99a68');
    }
    P(ctx, px, py, 2, 16, '#6b4a2e');
    P(ctx, px + 14, py, 2, 16, '#6b4a2e');
    return;
  }

  if (ch === 'P') {
    P(ctx, px, py, 16, 16, th.g1);
    P(ctx, px + 5, py + 8, 6, 6, '#b06a4a');
    P(ctx, px + 4, py + 7, 8, 2, '#d68a62');
    ell(ctx, px + 8, py + 5, 5, 4, '#4f9b46');
    P(ctx, px + 7, py + 2, 2, 4, '#3d7c36');
    return;
  }
}

function drawInteriorTile(ctx, ch, px, py, map, tx, ty, r) {
  const floors = {
    lab: ['#e9e1f2', '#ded4ea', '#8f7fa6', '#6f5f88'],
    clinic: ['#fff4f4', '#f6e6ec', '#d8b8c4', '#b8909f'],
    market: ['#f3e3c8', '#e9d6b6', '#b99a70', '#977a54'],
    house: ['#f0dfc4', '#e4cfa9', '#b09a72', '#8c7351'],
  };
  const f = floors[map.theme] || floors.house;
  if (ch === 'w') {
    const wall = {
      lab: '#9b86b8', clinic: '#f5c3d0', market: '#8fb3c9', house: '#c9a07c',
    }[map.theme] || '#a08870';
    P(ctx, px, py, 16, 16, darken(wall, 0.35));
    P(ctx, px, py, 16, 13, wall);
    P(ctx, px, py + 13, 16, 3, darken(wall, 0.25));
    P(ctx, px + 2, py + 2, 12, 1, '#ffffff30');
    return;
  }
  P(ctx, px, py, 16, 16, (tx + ty) % 2 ? f[0] : f[1]);
  P(ctx, px, py + 15, 16, 1, f[2]);
  P(ctx, px + 15, py, 1, 16, f[2]);
  if (r > 0.82) P(ctx, px + 4, py + 5, 1, 1, f[2]);

  if (ch === 'k') {
    P(ctx, px + 1, py, 15, 16, '#6b4630');
    P(ctx, px + 2, py + 1, 13, 14, '#8a5a3b');
    for (let i = 0; i < 3; i++) {
      const by = py + 2 + i * 5;
      P(ctx, px + 3, by, 11, 4, '#5a3a26');
      const books = ['#e2677f', '#4fa9ff', '#ffd447', '#7ecb63', '#b07bd6'];
      for (let b = 0; b < 4; b++) {
        P(ctx, px + 4 + b * 2.5, by + 1, 2, 3, books[(b + i + tx) % books.length]);
      }
    }
    return;
  }
  if (ch === 'T') {
    P(ctx, px + 1, py + 3, 14, 11, '#8a5a3b');
    P(ctx, px + 2, py + 3, 13, 9, '#c9915c');
    P(ctx, px + 2, py + 3, 13, 2, '#e0ad74');
    P(ctx, px + 1, py + 12, 14, 2, '#6b4630');
    return;
  }
  if (ch === 'P') {
    P(ctx, px + 5, py + 8, 6, 7, '#b06a4a');
    P(ctx, px + 4, py + 8, 8, 2, '#d68a62');
    ell(ctx, px + 8, py + 5, 5, 4, '#4f9b46');
    ell(ctx, px + 6, py + 3, 2, 2, '#77c463');
    return;
  }
}

// ---------------------------------------------------------------- Buildings
const BUILDING_STYLE = {
  clinic: { roof: '#ef7f9e', roofDark: '#b84d6c', wall: '#fff4ee', trim: '#e6d3c8', sign: '#ff5f8a', icon: 'cross' },
  lab:    { roof: '#9b7bd4', roofDark: '#6b4fa3', wall: '#f3ecfa', trim: '#d9cbe8', sign: '#b07bd6', icon: 'flask' },
  shop:   { roof: '#4fa9ff', roofDark: '#2b6ea8', wall: '#fff1d9', trim: '#e2cda6', sign: '#ffb347', icon: 'awning' },
  house:  { roof: '#e2814d', roofDark: '#a9552a', wall: '#fff2dd', trim: '#e0c8a4', sign: '#c9864e', icon: null },
  forge:  { roof: '#6b6470', roofDark: '#47424f', wall: '#9a8a80', trim: '#73645b', sign: '#ff7a45', icon: 'chimney' },
};

export function drawBuilding(ctx, b, time = 0) {
  const st = BUILDING_STYLE[b.kind] || BUILDING_STYLE.house;
  const px = b.x * 16, py = b.y * 16, pw = b.w * 16, ph = b.h * 16;
  const roofH = 23;
  // shadow
  ctx.fillStyle = 'rgba(25,15,35,0.22)';
  ctx.fillRect(px + 3, py + ph - 1, pw, 5);
  // walls
  P(ctx, px, py + roofH - 4, pw, ph - roofH + 4, '#4a3550');
  P(ctx, px + 1, py + roofH - 3, pw - 2, ph - roofH + 2, st.wall);
  P(ctx, px + 1, py + ph - 4, pw - 2, 3, st.trim);
  // wall shading
  P(ctx, px + 1, py + roofH + (ph - roofH) / 2, pw - 2, 1, '#00000010');
  // roof
  P(ctx, px - 3, py - 2, pw + 6, 4, '#4a3550');
  P(ctx, px - 2, py - 1, pw + 4, roofH + 3, st.roofDark);
  P(ctx, px - 1, py, pw + 2, roofH - 4, st.roof);
  P(ctx, px + 2, py + 1, pw - 4, 3, '#ffffff22');
  for (let i = 1; i < 4; i++) {
    P(ctx, px + 3, py + i * 5, pw - 6, 1, st.roofDark);
  }
  P(ctx, px - 3, py + roofH - 3, pw + 6, 3, st.roofDark);
  P(ctx, px - 3, py + roofH - 1, pw + 6, 1, '#4a3550');
  // door (aligned to the map's door tile)
  if (b.door) {
    const dx = b.door.x * 16, dy = b.door.y * 16;
    P(ctx, dx + 1, dy, 14, 16, '#4a3550');
    P(ctx, dx + 2, dy + 1, 12, 15, '#5b3b2e');
    P(ctx, dx + 3, dy + 2, 10, 13, '#7a4f38');
    P(ctx, dx + 3, dy + 2, 10, 1, '#a06a4a');
    P(ctx, dx + 9, dy + 8, 2, 2, '#ffd447');
    P(ctx, dx, dy + 15, 16, 1, '#6b4a2e');
  }
  // windows
  const winY = py + roofH + 2;
  const spots = [px + 7, px + pw - 19];
  for (const wx of spots) {
    if (b.door && Math.abs(wx + 5 - (b.door.x * 16 + 8)) < 16 && ph < 44) continue;
    P(ctx, wx, winY, 12, 10, '#4a3550');
    P(ctx, wx + 1, winY + 1, 10, 8, '#ffe9a8');
    P(ctx, wx + 1, winY + 1, 10, 3, '#fff8d8');
    P(ctx, wx + 5, winY + 1, 1, 8, '#4a3550');
    P(ctx, wx + 1, winY + 4, 10, 1, '#4a3550');
  }
  // sign / icon
  const signY = py + roofH - 9;
  P(ctx, px + pw / 2 - 7, signY, 14, 6, '#4a3550');
  P(ctx, px + pw / 2 - 6, signY + 1, 12, 4, st.sign);
  if (st.icon === 'cross') {
    P(ctx, px + pw / 2 - 3, signY + 2, 6, 2, '#ffffff');
    P(ctx, px + pw / 2 - 1, signY + 1, 2, 4, '#ffffff');
  } else if (st.icon === 'flask') {
    P(ctx, px + pw / 2 - 2, signY + 1, 4, 1, '#ffffff');
    P(ctx, px + pw / 2 - 1, signY + 2, 2, 1, '#ffffff');
    P(ctx, px + pw / 2 - 2, signY + 3, 4, 1, '#ffffff');
  } else if (st.icon === 'awning') {
    for (let i = 0; i < 4; i++) P(ctx, px + 2 + i * 7, roofH + py - 8, 4, 5, i % 2 ? '#fff4e2' : st.sign);
  } else if (st.icon === 'chimney') {
    P(ctx, px + pw - 12, py - 10, 6, 12, '#5b4a5c');
    P(ctx, px + pw - 12, py - 10, 6, 2, '#7a6878');
    const flicker = Math.sin(time * 4) > 0 ? '#ff7a45' : '#ffb347';
    P(ctx, px + pw - 11, py - 12, 4, 3, flicker);
    P(ctx, px + pw - 10, py - 15, 2, 3, '#ff7a4599');
  }
}

// ---------------------------------------------------------------- Props
export function drawProp(ctx, obj, px, py, time = 0) {
  switch (obj.kind) {
    case 'sign': {
      P(ctx, px + 6, py + 9, 4, 6, '#7a5436');
      P(ctx, px + 1, py + 2, 14, 8, '#4a3550');
      P(ctx, px + 2, py + 3, 12, 6, '#d9b681');
      P(ctx, px + 3, py + 4, 8, 1, '#8a6a44');
      P(ctx, px + 3, py + 6, 10, 1, '#8a6a44');
      break;
    }
    case 'pickup': {
      const bob = Math.round(Math.sin(time * 3 + px) * 1);
      P(ctx, px + 7, py + 8 + bob, 4, 4, '#ffd447');
      P(ctx, px + 6, py + 9 + bob, 6, 3, '#ffe98a');
      P(ctx, px + 8, py + 7 + bob, 2, 2, '#fff8d8');
      if (Math.floor(time * 3) % 3 === 0) P(ctx, px + 4, py + 6 + bob, 1, 1, '#ffffff');
      if (Math.floor(time * 3) % 3 === 1) P(ctx, px + 12, py + 7 + bob, 1, 1, '#ffffff');
      P(ctx, px + 4, py + 14, 8, 1, 'rgba(40,25,50,0.25)');
      break;
    }
    case 'berry': {
      ell(ctx, px + 8, py + 10, 7, 6, '#2f6b38');
      ell(ctx, px + 7, py + 9, 6, 5, '#4f9b46');
      ell(ctx, px + 5, py + 7, 3, 2, '#77c463');
      const glow = 0.45 + Math.sin(time * 2.5 + px) * 0.25;
      ctx.globalAlpha = glow;
      for (const [bx, by] of [[4, 10], [10, 8], [8, 12]]) {
        P(ctx, px + bx, py + by, 2, 2, '#ff8fb1');
        P(ctx, px + bx, py + by, 1, 1, '#fff1f6');
      }
      ctx.globalAlpha = 1;
      P(ctx, px + 7, py + 3, 2, 1, '#8fd86a');
      break;
    }
    case 'pc': {
      P(ctx, px + 2, py + 6, 12, 8, '#4a3550');
      P(ctx, px + 3, py + 7, 10, 5, '#7fe6e0');
      P(ctx, px + 3, py + 7, 10, 2, '#c9fffa');
      P(ctx, px + 4, py + 9, 3, 1, '#2b6d72');
      P(ctx, px + 7, py + 14, 2, 1, '#3a2b44');
      P(ctx, px + 3, py + 15, 10, 1, '#3a2b44');
      break;
    }
    case 'books': {
      const bob = Math.sin(time * 2 + px) * 0.5;
      P(ctx, px + 3, py + 8 + bob, 10, 6, '#7a4f38');
      P(ctx, px + 2, py + 9 + bob, 11, 2, '#e2677f');
      P(ctx, px + 2, py + 11 + bob, 11, 2, '#4fa9ff');
      break;
    }
    case 'campfire': {
      P(ctx, px + 2, py + 10, 12, 4, '#5b4a5c');
      P(ctx, px + 3, py + 11, 10, 2, '#8a6a5c');
      P(ctx, px + 4, py + 8, 8, 3, '#7a4f38');
      const f = Math.sin(time * 6) * 2;
      tri(ctx, px + 7, py + 9, 3, 6 + f, '#ff7a45', 1);
      tri(ctx, px + 8, py + 9, 2, 4 + f * 0.5, '#ffd447', 1);
      P(ctx, px + 8, py + 10, 1, 1, '#fff8d8');
      if (Math.floor(time * 5) % 2 === 0) P(ctx, px + 10, py + 1, 1, 1, '#ffb34788');
      break;
    }
    case 'crystal': {
      const glow = 0.4 + Math.sin(time * 2 + py) * 0.2;
      ctx.globalAlpha = glow;
      ell(ctx, px + 8, py + 11, 8, 4, '#7fffd466');
      ctx.globalAlpha = 1;
      P(ctx, px + 5, py + 5, 6, 10, '#3a2d4d');
      P(ctx, px + 6, py + 4, 4, 10, '#7fffd4');
      P(ctx, px + 6, py + 4, 2, 8, '#d8fff8');
      P(ctx, px + 4, py + 13, 8, 2, '#3a2d4d');
      break;
    }
    default:
      break;
  }
}

export function drawTrainerMarker(ctx, px, py, time) {
  const bob = Math.round(Math.sin(time * 4) * 1.5);
  P(ctx, px + 6, py - 9 + bob, 4, 6, '#4a3550');
  P(ctx, px + 7, py - 8 + bob, 2, 4, '#ffe066');
  P(ctx, px + 7, py - 3 + bob, 2, 1, '#ffe066');
}
