// Renders the game's real canvas art to PNGs using a native canvas backend.
// Run with: node tools/preview.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { createCanvas } from '@napi-rs/canvas';

// art.js/species.js only need document.createElement('canvas') at module scope.
globalThis.document = {
  createElement(tag) {
    if (tag === 'canvas') return createCanvas(4, 4);
    throw new Error(`Unsupported element: ${tag}`);
  },
};

const { SPECIES_LIST, createCreature } = await import('../js/data/species.js');
const { getMap } = await import('../js/data/world.js');
const { TYPE_INFO } = await import('../js/data/types.js');
const art = await import('../js/engine/art.js');
const scene = await import('../js/engine/scene.js');

mkdirSync('artifacts', { recursive: true });

function save(canvas, name) {
  writeFileSync(`artifacts/${name}`, canvas.toBuffer('image/png'));
  console.log(`wrote artifacts/${name}`);
}

// ------------------------------------------------------------ Bestiary sheet
{
  const cols = 7;
  const rows = Math.ceil(SPECIES_LIST.length / cols);
  const cw = 156;
  const ch = 186;
  const canvas = createCanvas(cols * cw, rows * ch + 58);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#161022';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#fdf3d8';
  ctx.font = 'bold 26px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('MYTHLINGS · THE PIXEL BESTIARY', 24, 40);
  ctx.fillStyle = '#9f8fb8';
  ctx.font = '12px monospace';
  ctx.textAlign = 'right';
  ctx.fillText('26 creatures · 8 evolution lines · 5 elements', canvas.width - 24, 39);
  ctx.textAlign = 'center';

  SPECIES_LIST.forEach((sp, i) => {
    const cx = (i % cols) * cw;
    const cy = 58 + Math.floor(i / cols) * ch;
    ctx.fillStyle = '#241a35';
    ctx.fillRect(cx + 5, cy + 5, cw - 10, ch - 10);
    ctx.strokeStyle = '#3a2b50';
    ctx.lineWidth = 2;
    ctx.strokeRect(cx + 5, cy + 5, cw - 10, ch - 10);
    ctx.fillStyle = TYPE_INFO[sp.type].color;
    ctx.fillRect(cx + 5, cy + 5, cw - 10, 4);
    art.drawCreature(ctx, sp, cx + cw / 2 - 48, cy + 18, 2, { frame: i % 4 });
    ctx.fillStyle = '#fdf3d8';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(sp.name.toUpperCase(), cx + cw / 2, cy + 138);
    ctx.fillStyle = TYPE_INFO[sp.type].color;
    ctx.font = '10px monospace';
    ctx.fillText(sp.type.toUpperCase(), cx + cw / 2, cy + 154);
    ctx.fillStyle = '#8b7aa6';
    ctx.font = '9px monospace';
    ctx.fillText(`#${String(sp.num).padStart(3, '0')}  ·  ${sp.evolve ? `evolves at ${sp.evolve.level}` : 'final form'}`, cx + cw / 2, cy + 169);
  });
  save(canvas, 'bestiary.png');
}

// ------------------------------------------------------------ Scene sheet
function fx() {
  return {
    foeFlash: 0, allyFlash: 0, foeShake: 0, allyShake: 0, shake: 0, flash: 0,
    foeScale: 1, allyScale: 1, foeAlpha: 1, allyAlpha: 1,
    foeY: 0, allyY: 0, foeHold: false, allyHold: false, hideFoe: false,
    particles: [], numbers: [], orb: null,
  };
}

function worldGame(mapId, x, y, dir = 'down') {
  const map = getMap(mapId);
  return {
    map,
    mode: 'world',
    busy: false,
    fadeAlpha: 0,
    state: { flags: {}, dex: { seen: {}, caught: {} } },
    player: { x, y, px: x, py: y, dir, stepPhase: 0 },
    facingTile: () => ({ x: x + 1, y }),
  };
}

function battleGame(theme, foeId, allyId, allyLevel = 14) {
  const game = {
    battleTheme: theme,
    fadeAlpha: 0,
    fx: fx(),
    battle: {
      foeMon: createCreature(foeId, 15),
      mon: createCreature(allyId, allyLevel),
      isTrainer: false,
      foeRemaining: 1,
    },
  };
  return game;
}

const SCENES = [
  ['WILLOWBROOK TOWN', 'town', worldGame('willowbrook', 12, 10)],
  ['FERNWOOD FOREST', 'world', worldGame('fernwood', 16, 10)],
  ['EMBERHOLD', 'world', worldGame('emberhold', 12, 9)],
  ['GLOOMHOLLOW CAVE', 'world', worldGame('cave', 12, 18)],
  ['BATTLE · FERNWOOD TRAIL', 'battle', battleGame('route', 'spriglin', 'cindit', 12)],
  ['BATTLE · SHADOW SANCTUM', 'battle', battleGame('sanctum', 'voidra', 'pyrolynx', 20)],
];

{
  const sw = 288;
  const sh = 192;
  const scale = 2;
  const cellW = sw * scale;
  const cellH = sh * scale + 34;
  const cols = 2;
  const canvas = createCanvas(cellW * cols + 48, 74 + Math.ceil(SCENES.length / cols) * cellH + 20);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#120d1c';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#4fe0c4';
  ctx.font = 'bold 22px monospace';
  ctx.fillText('MYTHLINGS · IN-GAME SCENES', 24, 40);
  ctx.fillStyle = '#8b7aa6';
  ctx.font = '11px monospace';
  ctx.fillText('Rendered from the real scene renderer · 288×192 native, shown at 2×', 24, 58);

  SCENES.forEach(([label, type, game], i) => {
    const scratch = createCanvas(sw, sh);
    const sctx = scratch.getContext('2d');
    sctx.imageSmoothingEnabled = false;
    const t = 1.7 + i * 0.23;
    if (type === 'battle') scene.renderBattle(sctx, game, t);
    else scene.renderWorld(sctx, game, t);

    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = 24 + col * cellW;
    const y = 74 + row * cellH;
    ctx.fillStyle = '#241a35';
    ctx.fillRect(x - 6, y - 6, cellW + 12, cellH + 12);
    ctx.strokeStyle = '#3a2b50';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 6, y - 6, cellW + 12, cellH + 12);
    ctx.drawImage(scratch, x, y, cellW, cellH - 34);
    ctx.strokeStyle = '#120b1c';
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, cellW, cellH - 34);
    ctx.fillStyle = '#fdf3d8';
    ctx.font = 'bold 13px monospace';
    ctx.fillText(label, x + 4, y + cellH - 10);
  });

  save(canvas, 'scenes.png');
}
