// End-to-end DOM smoke test using jsdom with a stubbed 2D context.
// Verifies that the real Game/UI wiring boots, starts a journey, opens menus,
// moves the player, runs a full battle through the UI, shops and saves.
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const html = readFileSync('index.html', 'utf8');
const dom = new JSDOM(html, {
  url: 'http://localhost:3000/',
  pretendToBeVisual: true,
  runScripts: 'outside-only',
});

globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.KeyboardEvent = dom.window.KeyboardEvent;
globalThis.MouseEvent = dom.window.MouseEvent;

// ---- 2D context stub -------------------------------------------------------
const NOOP_METHODS = new Set([
  'save', 'restore', 'translate', 'scale', 'rotate', 'setTransform', 'resetTransform',
  'beginPath', 'closePath', 'moveTo', 'lineTo', 'arc', 'ellipse', 'fill', 'stroke',
  'fillRect', 'clearRect', 'strokeRect', 'drawImage', 'putImageData',
  'fillText', 'strokeText', 'clip', 'setLineDash',
]);
function makeCtx() {
  const state = {};
  return new Proxy(state, {
    get(target, prop) {
      if (prop === 'getImageData') {
        return (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h });
      }
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient' || prop === 'createPattern') {
        return () => ({ addColorStop() {} });
      }
      if (prop === 'measureText') return () => ({ width: 10 });
      if (NOOP_METHODS.has(prop)) return () => {};
      if (prop === 'canvas') return null;
      return target[prop];
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    },
  });
}
dom.window.HTMLCanvasElement.prototype.getContext = function getContext() { return makeCtx(); };

// ---- rAF pump (the real game loop needs frames for fades and movement) -----
const rafQueue = [];
let virtualNow = 1000;
globalThis.requestAnimationFrame = (cb) => { rafQueue.push(cb); return rafQueue.length; };
globalThis.cancelAnimationFrame = () => {};
const pump = setInterval(() => {
  virtualNow += 16;
  const queued = rafQueue.splice(0);
  for (const cb of queued) {
    try { cb(virtualNow); } catch (err) { errors.push(err); }
  }
}, 8);
pump.unref();

const errors = [];
let reportingFailure = false;
const originalConsoleError = console.error;
console.error = (...args) => {
  if (!reportingFailure) errors.push(args.map(a => (a && a.stack) || String(a)).join(' '));
  originalConsoleError(...args);
};
dom.window.addEventListener('error', (e) => errors.push(String(e.error || e.message)));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const $ = (sel) => dom.window.document.querySelector(sel);
const $$ = (sel) => [...dom.window.document.querySelectorAll(sel)];
const clickByText = (sel, text) => {
  const el = $$(sel).find(n => n.textContent.trim().toUpperCase().includes(text.toUpperCase()));
  if (!el) throw new Error(`No ${sel} containing "${text}"`);
  el.click();
  return el;
};
let passed = 0;
let failed = 0;
async function check(name, fn) {
  try { await fn(); passed++; console.log(`  ok  ${name}`); }
  catch (err) {
    failed++;
    reportingFailure = true;
    console.error(`FAIL  ${name}\n      ${err.message}`);
    reportingFailure = false;
  }
}
function assert(cond, message) { if (!cond) throw new Error(message); }

async function advanceDialogue(max = 60) {
  for (let i = 0; i < max; i++) {
    if ($('#dialogue').classList.contains('hidden')) return;
    $('#dialogue').click();
    await sleep(28);
  }
  throw new Error('Dialogue would not close');
}
async function waitFor(fn, timeout = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (fn()) return true;
    await sleep(30);
  }
  return false;
}

console.log('\nMythlings DOM smoke test\n');

const { Game } = await import('../js/game.js');
const game = new Game($('#gameCanvas'));
await sleep(60);

await check('boots to title screen', () => {
  assert(!$('#titleScreen').classList.contains('hidden'), 'title screen should be visible');
  assert($('#gameCanvas'), 'canvas exists');
});

await check('title shows three starter choices after New Journey', async () => {
  $('#newGameBtn').click();
  await sleep(40);
  assert(!$('#starterScreen').classList.contains('hidden'), 'starter screen should open');
  assert($$('.starter-card').length === 3, `expected 3 starter cards, got ${$$('.starter-card').length}`);
});
await sleep(40);

$('.starter-card button').click();
await sleep(400);
await check('journey starts with one partner and a quest', () => {
  assert(game.state, 'state should exist');
  assert(game.state.party.length === 1, 'starter should be on the team');
  assert(game.state.party[0].level === 5, 'starter should be level 5');
  assert(game.currentDirection() === null);
  assert(game.questState('research') === 'active', 'research quest should be active');
});
await advanceDialogue();
await sleep(120);

await check('player lands in the lab and the world HUD is visible', () => {
  assert(game.mode === 'world', `mode was ${game.mode}`);
  assert(game.mapId === 'lab', `map was ${game.mapId}`);
  assert(!$('#worldHud').classList.contains('hidden'), 'world HUD visible');
  assert($('#dialogue').classList.contains('hidden'), 'dialogue closed');
});

await check('walking down exits the lab through its warp', async () => {
  const startY = game.player.y;
  dom.window.dispatchEvent(new dom.window.KeyboardEvent('keydown', { code: 'ArrowDown', key: 'ArrowDown', bubbles: true }));
  await sleep(700);
  dom.window.dispatchEvent(new dom.window.KeyboardEvent('keyup', { code: 'ArrowDown', key: 'ArrowDown', bubbles: true }));
  await sleep(650);
  assert(game.mapId === 'willowbrook', `expected town after warp, got ${game.mapId}`);
  assert(game.player.y >= 5, `player should be inside town, y=${game.player.y} (was ${startY})`);
});

await check('menu opens with all six tabs and the party card renders', () => {
  $('#menuBtn').click();
  assert(!$('#overlay').classList.contains('hidden'), 'overlay should open');
  assert($$('.tab-btn').length === 6, `expected 6 tabs, got ${$$('.tab-btn').length}`);
  assert($$('.party-card').length === 1, 'one party card expected');
  assert($('.party-card .pc-name').textContent.includes('Cindit'), 'starter name missing');
});

await check('bag tab lists capture orbs and potions', () => {
  clickByText('.tab-btn', 'BAG');
  assert($$('.bag-row').length >= 2, 'bag should have items');
  assert($('#modalBody').textContent.includes('Capture Orb'), 'orb missing from bag');
});

await check('index tab shows 26 entries and a detail panel', () => {
  clickByText('.tab-btn', 'INDEX');
  assert($$('.dex-cell').length === 26, `expected 26 dex cells, got ${$$('.dex-cell').length}`);
  assert($('.dex-detail'), 'detail panel missing');
});

await check('quest tab lists the main quest', () => {
  clickByText('.tab-btn', 'QUESTS');
  assert($$('.quest-card').length === 5, 'expected five quests');
  assert($('#modalBody').textContent.includes('Field Notes'), 'research quest missing');
});

await check('save tab persists to localStorage', () => {
  clickByText('.tab-btn', 'SAVE');
  clickByText('#modalBody button', 'SAVE JOURNEY');
  assert(dom.window.localStorage.getItem('mythlings.save.v1'), 'save key missing');
});
$('#modalClose').click();
await sleep(40);

await check('battle starts from a wild encounter and offers commands', async () => {
  game.startWildBattle('spriglin', 5);
  await waitFor(() => game.battle && !$('#battlePanel').classList.contains('hidden'), 6000);
  assert(game.battle, 'battle should exist');
  await waitFor(() => $$('#battleControls button').length >= 4, 8000);
  assert($$('#battleControls button').length >= 4, `four battle commands expected, got ${$$('#battleControls button').length}`);
  assert($('#battleHud') && !$('#battleHud').classList.contains('hidden'), 'battle HUD visible');
});
await sleep(900);

async function clickBattle(label) {
  const btn = $$('#battleControls button').find(b => !b.disabled && b.textContent.toUpperCase().includes(label.toUpperCase()));
  if (!btn) return false;
  btn.click();
  return true;
}

await check('fight menu shows four moves with PP', async () => {
  assert(await clickBattle('FIGHT'), 'FIGHT button missing');
  await sleep(120);
  const moveButtons = $$('#battleControls button').filter(b => b.textContent.includes('PP'));
  assert(moveButtons.length >= 1, 'no move buttons');
  assert(moveButtons.length <= 4, 'too many moves');
});

let turns = 0;
while (turns < 24 && game.battle) {
  turns++;
  if ($$('#battleControls button').some(b => b.textContent.includes('PP'))) {
    const usable = $$('#battleControls button').filter(b => !b.disabled && b.textContent.includes('PP'));
    if (usable[0]) usable[0].click();
  } else if ($$('#battleControls button').some(b => b.textContent.toUpperCase().includes('FIGHT'))) {
    await clickBattle('FIGHT');
  } else {
    await clickBattle('FIGHT');
  }
  for (let i = 0; i < 10; i++) {
    if (game.waitSkip) game.waitSkip();
    await sleep(90);
  }
}
await sleep(400);

await check('battle resolves back to the overworld', () => {
  assert(!game.battle, 'battle should be over');
  assert(game.mode === 'world', `mode was ${game.mode}`);
  assert($('#battlePanel').classList.contains('hidden'), 'battle panel should hide');
});

await check('a weakened wild Mythling can be caught through the bag', async () => {
  game.startWildBattle('puddip', 4);
  await waitFor(() => game.battle && $$('#battleControls button').length >= 4, 9000);
  assert(game.battle, 'second battle did not start');
  game.battle.foeMon.hp = 1;
  game.battle.rng = () => 0;
  game.state.bag.mythicorb = 2;
  const before = game.state.party.length + game.state.box.length;
  assert(await clickBattle('BAG'), 'BAG button missing');
  await sleep(100);
  const orb = $$('#battleControls button').find(b => b.textContent.includes('Mythic Orb'));
  assert(orb, 'Mythic Orb missing from battle bag');
  orb.click();
  for (let i = 0; i < 120 && game.battle; i++) {
    if (game.waitSkip) game.waitSkip();
    await sleep(70);
  }
  assert(!game.battle, 'battle did not finish after catching');
  assert(game.mode === 'world', `mode after catch was ${game.mode}`);
  const after = game.state.party.length + game.state.box.length;
  assert(after === before + 1, `caught creature not added (${before} -> ${after})`);
  assert(game.state.dex.caught.puddip === true, 'new catch missing from the Index');
});

await check('shop opens with stock and buying decrements coin', () => {
  const before = game.state.player.money;
  game.openShop('market');
  assert(!$('#overlay').classList.contains('hidden'), 'shop overlay missing');
  const rows = $$('.shop-row');
  assert(rows.length >= 5, `expected shop rows, got ${rows.length}`);
  const buy = rows[0].querySelector('button:not(:disabled)');
  assert(buy, 'no affordable item');
  const price = Number(rows[0].querySelector('.price').textContent.replace(/[^0-9]/g, ''));
  const name = rows[0].querySelector('.bag-name').textContent.trim();
  buy.click();
  assert(game.state.player.money === before - price, `money did not decrease by ${price}`);
  assert(Object.values(game.state.bag).reduce((a, b) => a + b, 0) >= 3, 'purchase not added to bag');
  assert(name.length > 0);
});
$('#modalClose').click();

await check('healing centre fully restores the team', async () => {
  game.state.party[0].hp = 1;
  game.state.party[0].status = { name: 'burn', turns: 0 };
  await game.healParty();
  assert(game.state.party[0].hp === game.state.party[0].maxHp, 'HP not restored');
  assert(game.state.party[0].status === null, 'status not cleared');
});

await check('storage deposit and withdraw work', async () => {
  const { createCreature } = await import('../js/data/species.js');
  if (game.state.party.length < 2) game.state.party.push(createCreature('spriglin', 5));
  const before = game.state.party.length;
  game.deposit(0);
  assert(game.state.party.length === before - 1, 'deposit failed');
  assert(game.state.box.length >= 1, 'box should hold at least one');
  game.withdraw(0);
  assert(game.state.party.length === before, 'withdraw failed');
});

await check('saved journey reads back from storage with its team', async () => {
  game.save(true);
  const { loadRawSave } = await import('../js/engine/save.js');
  const loaded = loadRawSave();
  assert(loaded, 'no save payload');
  assert(loaded.state.party.length === game.state.party.length, 'party size mismatch');
  assert(loaded.state.player.map === game.mapId, 'map mismatch');
  assert(Object.keys(loaded.state.dex.caught).length >= 1, 'dex not saved');
});

await check('Index progress completes the Field Notes quest and pays out', () => {
  const beforeOrbs = game.countItem('orb');
  game.markCaught('sparkit');
  assert(game.state.dex.caught.sparkit === true);
  assert(game.state.dex.caughtCount >= 3);
  game.checkQuests();
  assert(game.questState('research') === 'done', 'research quest should be complete');
  assert(game.countItem('orb') === beforeOrbs + 5, 'quest reward orbs missing');
  game.markSeen('luminox');
  assert(game.state.dex.seen.luminox === true);
  assert(game.state.dex.caught.luminox !== true, 'seen should not equal caught');
});

await check('no runtime errors were logged', () => {
  assert(errors.length === 0, `errors:\n${errors.join('\n')}`);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
clearInterval(pump);
if (failed > 0) {
  console.error('Smoke test failed.');
  process.exit(1);
}
dom.window.close();
process.exit(0);
