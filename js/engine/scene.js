// Canvas rendering for the overworld, battle stage and title ambience.
import { TILE, tileAt, buildingAt, isBlockedTile, npcAt, objectAt, visibleNpcs } from '../data/world.js';
import { SPECIES } from '../data/species.js';
import { TYPE_INFO } from '../data/types.js';
import { drawTile, drawBuilding, drawProp, drawPerson, drawCreature, drawTrainerMarker } from './art.js';

export const VIEW_W = 288;
export const VIEW_H = 192;

const PLAYER_LOOK = {
  skin: '#eeb98c', hair: '#4b3223', shirt: '#3fc7bb', pants: '#3b3f63',
  accent: '#ffe066', hat: 'cap',
};

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

export function cameraFor(map, player) {
  const mapW = map.w * TILE;
  const mapH = map.h * TILE;
  let camX = player.px * TILE + 8 - VIEW_W / 2;
  let camY = player.py * TILE + 8 - VIEW_H / 2;
  camX = mapW <= VIEW_W ? -(VIEW_W - mapW) / 2 : clamp(camX, 0, mapW - VIEW_W);
  camY = mapH <= VIEW_H ? -(VIEW_H - mapH) / 2 : clamp(camY, 0, mapH - VIEW_H);
  return { x: Math.round(camX), y: Math.round(camY) };
}

function drawAmbient(ctx, map, cam, time) {
  const theme = map.theme;
  if (theme === 'cave' || theme === 'sanctum') {
    for (let i = 0; i < 14; i++) {
      const x = ((i * 73 + time * 9) % (VIEW_W + 20)) - 10;
      const y = (i * 37 + Math.sin(time + i) * 6) % VIEW_H;
      const a = 0.25 + ((i * 37) % 30) / 100;
      ctx.globalAlpha = a;
      ctx.fillStyle = i % 3 === 0 ? '#7fffd4' : '#c9aef0';
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
    ctx.globalAlpha = 1;
  } else if (theme === 'forest' || theme === 'route') {
    for (let i = 0; i < 8; i++) {
      const x = ((i * 97 + time * 14 + Math.sin(time + i) * 12) % (VIEW_W + 30)) - 15;
      const y = ((i * 41 + time * 8) % (VIEW_H + 20)) - 10;
      ctx.fillStyle = i % 2 ? '#a8e08c' : '#ffe066';
      ctx.globalAlpha = 0.5;
      ctx.fillRect(Math.round(x), Math.round(y), 2, 1);
    }
    ctx.globalAlpha = 1;
  } else if (theme === 'ember') {
    for (let i = 0; i < 10; i++) {
      const x = ((i * 83 + Math.sin(time * 0.8 + i) * 14) % VIEW_W);
      const y = VIEW_H - ((i * 33 + time * 18) % (VIEW_H + 20));
      ctx.fillStyle = i % 2 ? '#ffb347' : '#ff7a45';
      ctx.globalAlpha = 0.45;
      ctx.fillRect(Math.round(x), Math.round(y), 1, 2);
    }
    ctx.globalAlpha = 1;
  } else if (theme === 'town') {
    for (let i = 0; i < 5; i++) {
      const x = ((i * 113 + time * 6) % (VIEW_W + 20)) - 10;
      const y = ((i * 59 + time * 4) % (VIEW_H + 20)) - 10;
      ctx.globalAlpha = 0.5;
      P(ctx, x, y, 2, 2, i % 2 ? '#fff6c4' : '#ffd447');
    }
    ctx.globalAlpha = 1;
  }
}

function P(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

export function renderWorld(ctx, game, time) {
  const map = game.map;
  const player = game.player;
  if (!map) return;
  const cam = cameraFor(map, player);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#16212e';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  const startX = Math.floor(cam.x / TILE) - 1;
  const startY = Math.floor(cam.y / TILE) - 1;
  for (let ty = startY; ty <= startY + VIEW_H / TILE + 2; ty++) {
    for (let tx = startX; tx <= startX + VIEW_W / TILE + 2; tx++) {
      if (tx < 0 || ty < 0 || tx >= map.w || ty >= map.h) continue;
      const ch = map.terrain[ty][tx];
      drawTile(ctx, ch, tx * TILE - cam.x, ty * TILE - cam.y, map, tx, ty, time);
    }
  }

  ctx.save();
  ctx.translate(-cam.x, -cam.y);
  for (const b of map.buildings || []) {
    drawBuilding(ctx, b, time);
  }
  ctx.restore();

  const drawables = [];
  for (const npc of visibleNpcs(map, game.state ? game.state.flags : {})) {
    drawables.push({
      y: npc.y * TILE + 15,
      draw() {
        const sx = npc.x * TILE - cam.x;
        const sy = npc.y * TILE - cam.y;
        if (npc.creature) {
          const sp = SPECIES[npc.creature];
          if (sp) drawCreature(ctx, sp, sx - 4, sy - 10, 0.5, { frame: Math.floor(time * 2) % 4, flip: false });
        } else {
          drawPerson(ctx, npc.look || {}, sx, sy, npc.dir || 'down', 0);
        }
        const beaten = npc.beatenFlag && game.state && game.state.flags[npc.beatenFlag];
        if (npc.kind === 'trainer' && !beaten) drawTrainerMarker(ctx, sx, sy, time);
      },
    });
  }
  for (const obj of map.objects || []) {
    drawables.push({
      y: obj.y * TILE + 15,
      draw() {
        drawProp(ctx, obj, obj.x * TILE - cam.x, obj.y * TILE - cam.y, time);
      },
    });
  }
  drawables.push({
    y: player.py * TILE + 15,
    draw() {
      const sx = Math.round(player.px * TILE - cam.x);
      const sy = Math.round(player.py * TILE - cam.y);
      drawPerson(ctx, PLAYER_LOOK, sx, sy, player.dir, player.stepPhase);
    },
  });
  drawables.sort((a, b) => a.y - b.y);
  for (const d of drawables) d.draw();

  // Interaction marker
  if (game.mode === 'world' && !game.busy) {
    const f = game.facingTile();
    const npc = npcAt(map, f.x, f.y, game.state ? game.state.flags : {});
    const obj = objectAt(map, f.x, f.y);
    if (npc || obj) {
      const bob = Math.round(Math.sin(time * 5) * 1.5);
      P(ctx, f.x * TILE - cam.x + 6, f.y * TILE - cam.y - 8 + bob, 4, 4, '#ffe066');
      P(ctx, f.x * TILE - cam.x + 7, f.y * TILE - cam.y - 4 + bob, 2, 1, '#ffe066');
    }
  }

  drawAmbient(ctx, map, cam, time);

  // soft vignette
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = '#0b1624';
  ctx.fillRect(0, 0, VIEW_W, 3);
  ctx.fillRect(0, VIEW_H - 3, VIEW_W, 3);
  ctx.fillRect(0, 0, 3, VIEW_H);
  ctx.fillRect(VIEW_W - 3, 0, 3, VIEW_H);
  ctx.restore();

  if (game.fadeAlpha > 0.001) {
    ctx.fillStyle = `rgba(9,7,15,${game.fadeAlpha})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
}

// ---------------------------------------------------------------- Battle stage
const THEME_BG = {
  town:    { sky: ['#9adcf0', '#bdebf6', '#dff6fa'], hill: '#6fae74', hill2: '#5b9a64', ground: '#8fcf77', ground2: '#79bb64', prop: 'houses' },
  route:   { sky: ['#8fd8ff', '#b5e8ff', '#e2f7ff'], hill: '#6cb46a', hill2: '#559a5c', ground: '#95d072', ground2: '#7dbb60', prop: 'trees' },
  forest:  { sky: ['#5fa78f', '#88c4a4', '#b9dfc2'], hill: '#3e7d51', hill2: '#2e6543', ground: '#6aa85a', ground2: '#568e4b', prop: 'trees' },
  ember:   { sky: ['#f2a65a', '#e8784a', '#b34a45'], hill: '#7a4a4a', hill2: '#5c3540', ground: '#a37b58', ground2: '#8a6548', prop: 'rocks' },
  cave:    { sky: ['#2b2038', '#372847', '#4a3558'], hill: '#453553', hill2: '#352844', ground: '#5a4a6b', ground2: '#493b58', prop: 'crystals' },
  sanctum: { sky: ['#170f22', '#241432', '#3a1c4a'], hill: '#2b1839', hill2: '#1d1029', ground: '#3a2a52', ground2: '#2c1e40', prop: 'crystals' },
};
const THEME_ALIAS = { lab: 'town', clinic: 'town', market: 'town', house: 'town', sanctum: 'sanctum' };

export function renderBattle(ctx, game, time) {
  const battle = game.battle;
  if (!battle) return;
  const theme = THEME_ALIAS[game.battleTheme] || game.battleTheme || 'route';
  const bg = THEME_BG[theme] || THEME_BG.route;
  const fx = game.fx;
  const shakeX = fx.shake > 0 ? Math.round(Math.sin(time * 70) * 4 * fx.shake) : 0;
  const shakeY = fx.shake > 0 ? Math.round(Math.cos(time * 88) * 2 * fx.shake) : 0;

  ctx.save();
  ctx.translate(shakeX, shakeY);

  // sky bands
  for (let i = 0; i < 5; i++) {
    P(ctx, 0, i * 22, VIEW_W, 24, bg.sky[Math.min(2, Math.floor(i / 2))]);
  }
  // sun / rift glow
  if (theme === 'sanctum') {
    ctx.globalAlpha = 0.5 + Math.sin(time) * 0.15;
    for (let r = 34; r > 8; r -= 6) {
      ctx.fillStyle = r > 20 ? '#ff3f8f22' : '#ff5fa244';
      ctx.beginPath();
      ctx.arc(238, 36, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  } else {
    P(ctx, 214, 22, 30, 30, '#ffffff33');
    P(ctx, 222, 14, 14, 46, '#ffffff22');
  }
  // far hills
  for (const [cx, cy, rx, ry, color] of [
    [40, 96, 95, 46, bg.hill2], [170, 92, 120, 42, bg.hill2],
    [86, 101, 90, 38, bg.hill], [246, 97, 80, 32, bg.hill],
  ]) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, Math.PI, Math.PI * 2);
    ctx.fill();
  }
  // silhouetted props
  if (bg.prop === 'trees') {
    for (const [x, y, s] of [[22, 96, 1.3], [64, 92, 0.9], [132, 88, 1.1], [252, 94, 1.2]]) {
      P(ctx, x - 2, y - 24 * s, 4 * s, 24 * s, '#2f5a3a');
      ctx.fillStyle = '#3b6d46';
      ctx.beginPath(); ctx.arc(x, y - 28 * s, 12 * s, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x - 8 * s, y - 22 * s, 8 * s, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + 8 * s, y - 22 * s, 9 * s, 0, Math.PI * 2); ctx.fill();
    }
  } else if (bg.prop === 'crystals') {
    for (const [x, y, h] of [[26, 110, 22], [52, 108, 14], [272, 106, 18], [248, 110, 11]]) {
      P(ctx, x - 4, y - h, 8, h, '#4a3a63');
      P(ctx, x - 2, y - h + 2, 4, h - 4, '#7fffd4');
      P(ctx, x - 2, y - h + 2, 2, h - 8, '#d8fff8');
    }
  } else if (bg.prop === 'houses') {
    for (const [x, y, w] of [[20, 104, 34], [62, 100, 26], [244, 102, 36]]) {
      P(ctx, x, y - 22, w, 24, '#c98f6a');
      P(ctx, x - 3, y - 30, w + 6, 10, '#a35d51');
      P(ctx, x + 6, y - 16, 8, 8, '#ffe9a8');
    }
  } else if (bg.prop === 'rocks') {
    for (const [x, y, s] of [[24, 112, 16], [58, 110, 10], [264, 108, 18], [242, 112, 9]]) {
      ctx.fillStyle = '#5c3f42';
      ctx.beginPath(); ctx.ellipse(x, y, s, s * 0.6, 0, Math.PI, Math.PI * 2); ctx.fill();
    }
  }

  // ground
  P(ctx, 0, 108, VIEW_W, VIEW_H - 108, bg.ground);
  for (let i = 0; i < 40; i++) {
    const x = (i * 53 + 17) % VIEW_W;
    const y = 112 + ((i * 29) % 76);
    P(ctx, x, y, 2, 1, i % 3 ? bg.ground2 : '#ffffff22');
  }
  P(ctx, 0, 108, VIEW_W, 2, bg.ground2);

  // platforms
  drawPlatform(ctx, 216, 128, 52, 10, theme);
  drawPlatform(ctx, 76, 172, 64, 12, theme);

  const foe = battle.foeMon;
  const ally = battle.mon;
  const foeSp = SPECIES[foe.species];
  const allySp = SPECIES[ally.species];

  // enemy sprite
  if ((foe.hp > 0 && !fx.hideFoe) || fx.foeHold) {
    const size = (foeSp.sprite.size || 1) * (fx.foeScale ?? 1);
    const scale = 2 * size * (1 + (fx.foePulse || 0) * 0.06);
    const w = 48 * scale;
    const bx = 216 - w / 2 + (fx.foeShake > 0 ? Math.sin(time * 60) * 4 : 0) + (fx.foeJump || 0);
    // Feet sit on the enemy platform; the sprite canvas has four transparent pixels below them.
    const by = 128 - 44 * scale + (fx.foeY || 0);
    ctx.save();
    ctx.globalAlpha = fx.foeAlpha ?? 1;
    if (fx.foeFlash > 0) ctx.filter = 'brightness(2.4) saturate(0.3)';
    drawCreature(ctx, foeSp, bx, by, scale, { flip: true, frame: Math.floor(time * 2) % 4 });
    ctx.filter = 'none';
    ctx.restore();
    drawShadow(ctx, 216, 128, 34 * size * (fx.foeScale ?? 1), 7);
  }

  // ally sprite
  if (ally.hp > 0 || fx.allyHold) {
    const size = allySp.sprite.size || 1;
    const scale = 2.15 * size;
    const w = 48 * scale;
    const bx = 76 - w / 2 + (fx.allyShake > 0 ? Math.sin(time * 60) * 4 : 0) + (fx.allyJump || 0);
    const by = 170 - 44 * scale + (fx.allyY || 0);
    ctx.save();
    ctx.globalAlpha = fx.allyAlpha ?? 1;
    if (fx.allyFlash > 0) ctx.filter = 'brightness(2.4) saturate(0.3)';
    drawCreature(ctx, allySp, bx, by, scale, { flip: false, frame: Math.floor(time * 2 + 1) % 4 });
    ctx.filter = 'none';
    ctx.restore();
    drawShadow(ctx, 76, 172, 38 * size, 8);
  }

  // battle particles
  for (const p of fx.particles) {
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.maxLife));
    P(ctx, p.x, p.y, p.size, p.size, p.color);
  }
  ctx.globalAlpha = 1;

  // orb animation
  if (fx.orb) drawOrb(ctx, fx.orb, time, foe);

  // floating damage numbers
  for (const n of fx.numbers) {
    ctx.globalAlpha = Math.max(0, Math.min(1, n.life));
    ctx.font = 'bold 13px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#251b2f';
    ctx.fillText(n.text, n.x + 1, n.y + 1);
    ctx.fillStyle = n.color;
    ctx.fillText(n.text, n.x, n.y);
    ctx.textAlign = 'left';
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  if (fx.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${Math.min(0.85, fx.flash)})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  if (game.fadeAlpha > 0.001) {
    ctx.fillStyle = `rgba(9,7,15,${game.fadeAlpha})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
}

function drawShadow(ctx, cx, cy, rx, ry) {
  ctx.fillStyle = 'rgba(20,12,30,0.22)';
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawPlatform(ctx, cx, cy, rx, ry, theme) {
  const colors = {
    cave: ['#4a3a5e', '#3a2d4b'], sanctum: ['#3a2a52', '#2a1c3d'],
    ember: ['#8a6a54', '#6e5142'],
  };
  const [c1, c2] = colors[theme] || ['#6fae64', '#58904f'];
  ctx.fillStyle = c2;
  ctx.beginPath(); ctx.ellipse(cx, cy + 2, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = c1;
  ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff22';
  ctx.beginPath(); ctx.ellipse(cx - 6, cy - 2, rx * 0.5, ry * 0.4, 0, 0, Math.PI * 2); ctx.fill();
}

function drawOrb(ctx, orb, time, foe) {
  if (orb.mode === 'throw') {
    const t = Math.min(1, orb.t);
    const x = 70 + (216 - 70) * t;
    const y = 150 - Math.sin(t * Math.PI) * 74 + (126 - 150) * t;
    drawOrbSprite(ctx, x, y, t);
  } else if (orb.mode === 'shake') {
    const wob = orb.wobble ? Math.sin(orb.wobble * 14) * 3 : 0;
    drawOrbSprite(ctx, 216 + wob, 112, 1);
  } else if (orb.mode === 'burst') {
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = '#ffe066';
    ctx.beginPath(); ctx.arc(216, 110, 26 * (1 - Math.min(1, orb.t)), 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    drawOrbSprite(ctx, 216, 110, 1);
  }
}

function drawOrbSprite(ctx, x, y, t) {
  P(ctx, x - 6, y - 6, 12, 12, '#251b2f');
  P(ctx, x - 5, y - 5, 10, 10, '#e2677f');
  P(ctx, x - 4, y - 4, 8, 4, '#ff9fb2');
  P(ctx, x - 2, y - 2, 3, 3, '#ffffff');
  P(ctx, x - 1, y + 3, 2, 2, '#ffe066');
}

export function renderTitleBackdrop(ctx, time) {
  const sky = ['#2b2145', '#3b2a5c', '#573a72'];
  for (let i = 0; i < 3; i++) P(ctx, 0, i * 64, VIEW_W, 66, sky[i]);
  for (let i = 0; i < 26; i++) {
    const x = (i * 71 + 13) % VIEW_W;
    const y = (i * 37 + 9) % 100;
    ctx.globalAlpha = 0.3 + ((i * 17) % 50) / 100;
    P(ctx, x, y, 1, 1, i % 4 === 0 ? '#fff1a8' : '#d9b6f2');
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#241a38';
  ctx.beginPath(); ctx.ellipse(30, 150, 110, 52, 0, Math.PI, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2e2247';
  ctx.beginPath(); ctx.ellipse(250, 154, 120, 56, 0, Math.PI, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1d3a2c';
  ctx.beginPath(); ctx.ellipse(140, 190, 230, 70, 0, Math.PI, Math.PI * 2); ctx.fill();
  const cindit = SPECIES.cindit;
  const sparkit = SPECIES.sparkit;
  if (cindit) drawCreature(ctx, cindit, 210, 96 + Math.sin(time * 1.5) * 2, 2, { frame: Math.floor(time * 2) % 4 });
  if (sparkit) drawCreature(ctx, sparkit, 40, 104 + Math.sin(time * 1.5 + 2) * 2, 1.7, { frame: Math.floor(time * 2 + 1) % 4, flip: true });
  for (let i = 0; i < 12; i++) {
    const x = (i * 61 + time * 8) % VIEW_W;
    const y = 20 + ((i * 43 + time * 5) % 110);
    ctx.globalAlpha = 0.4;
    P(ctx, x, y, 1, 1, '#a8f0e0');
  }
  ctx.globalAlpha = 1;
}
