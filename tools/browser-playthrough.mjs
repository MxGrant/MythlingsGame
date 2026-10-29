// Full real-browser playthrough for Mythlings.
// Drives the game with real keyboard/mouse input, catches wild Mythlings,
// runs quests, shops, healing, storage, all three bosses, the ending,
// save/reload and a touch-sized layout.
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';

function findChromium() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const root = `${homedir()}/.cache/ms-playwright`;
  const builds = readdirSync(root)
    .filter(name => name.startsWith('chromium-'))
    .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
  for (const build of builds) {
    const candidate = `${root}/${build}/chrome-linux/chrome`;
    if (existsSync(candidate)) return candidate;
  }
  throw new Error('No Playwright Chromium found. Run `npx playwright install chromium` or set CHROME_PATH.');
}

const executablePath = findChromium();
mkdirSync('artifacts/browser', { recursive: true });

const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'],
});
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
const page = await context.newPage();

const consoleErrors = [];
const pageErrors = [];
const failedRequests = [];
page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
page.on('pageerror', (err) => pageErrors.push(err.stack || String(err)));
page.on('requestfailed', (req) => failedRequests.push(`${req.url()} :: ${req.failure()?.errorText}`));

const sleep = (ms) => page.waitForTimeout(ms);
const checks = [];
function assert(condition, message) { if (!condition) throw new Error(message); }
async function check(name, fn) {
  try {
    await fn();
    checks.push({ name, ok: true });
    console.log(`  ok  ${name}`);
  } catch (err) {
    checks.push({ name, ok: false, error: err.message });
    console.log(`FAIL  ${name}\n      ${err.message}`);
  }
}
async function screenshot(name) {
  await page.screenshot({ path: `artifacts/browser/${name}.png` });
}
async function gameState() {
  return page.evaluate(() => {
    const g = window.mythlings;
    return {
      mode: g.mode,
      map: g.mapId,
      player: [g.player.x, g.player.y, g.player.dir],
      busy: g.busy,
      party: g.state ? g.state.party.map(m => ({
        id: m.species, name: m.nickname, level: m.level, hp: m.hp, maxHp: m.maxHp,
        moves: m.moves.map(s => ({ id: s.id, pp: s.pp })),
      })) : [],
      box: g.state ? g.state.box.length : 0,
      money: g.state ? g.state.player.money : 0,
      dexCaught: g.state ? Object.keys(g.state.dex.caught) : [],
      quests: g.state ? Object.fromEntries(Object.entries(g.state.quests).map(([id, q]) => [id, q.status])) : {},
      flags: g.state ? g.state.flags : {},
      dialogueOpen: g.ui.dialogueOpen,
      modalOpen: g.ui.modalOpen,
      endingOpen: g.ui.endingOpen,
      battle: !!g.battle,
    };
  });
}

async function waitFor(fn, label, timeout = 25000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await fn()) return true;
    await sleep(80);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function step(dir, hold = 90, settle = 230) {
  await page.keyboard.down(dir);
  await sleep(hold);
  await page.keyboard.up(dir);
  await sleep(settle);
}

async function waitBattle() {
  await waitFor(async () => page.evaluate(() => !!window.mythlings.battle && !document.getElementById('battlePanel').classList.contains('hidden')), 'battle panel');
  // Skip the opening messages until the first command bar is ready.
  for (let i = 0; i < 180; i++) {
    const buttons = await battleButtons();
    if (buttons.some(b => /^(FIGHT|BAG)/.test(b.text))) break;
    await page.keyboard.press('Space');
    await sleep(80);
  }
  await sleep(180);
}

async function advanceDialogue(max = 240) {
  let idleTicks = 0;
  for (let i = 0; i < max; i++) {
    const info = await page.evaluate(() => {
      const g = window.mythlings;
      return {
        dialogue: g.ui.dialogueOpen,
        choices: g.ui.choicesActive,
        choiceLabels: [...document.querySelectorAll('#dialogueChoices button')].map(b => b.textContent.trim()),
        modal: g.ui.modalOpen,
        battle: !!g.battle,
        ending: g.ui.endingOpen,
        busy: g.busy,
      };
    });
    if (info.battle) return 'battle';
    if (info.ending) return 'ending';
    if (info.modal) return 'modal';
    if (info.dialogue) {
      idleTicks = 0;
      if (info.choices) {
        await page.locator('#dialogueChoices button').first().click();
        await sleep(100);
        continue;
      }
      await page.keyboard.press('Space');
      await sleep(55);
      continue;
    }
    idleTicks++;
    if (idleTicks > 5) return 'world';
    await sleep(120);
  }
  throw new Error('Dialogue would not settle');
}

async function teleport(mapId, x, y, dir = 'down') {
  await page.evaluate(({ mapId, x, y, dir }) => {
    const g = window.mythlings;
    if (g.ui.modalOpen) g.ui.closeModal();
    if (g.ui.dialogueOpen) g.ui.finishDialogue();
    g.busy = false;
    g.mode = 'world';
    g.setMap(mapId, x, y, dir);
    g.busy = false;
  }, { mapId, x, y, dir });
  await sleep(280);
}

// Put the player on a walkable tile facing the target tile.
async function placeFacing(mapId, tx, ty) {
  const result = await page.evaluate(({ mapId, tx, ty }) => {
    const g = window.mythlings;
    if (g.ui.modalOpen) g.ui.closeModal();
    if (g.ui.dialogueOpen) g.ui.finishDialogue();
    g.setMap(mapId, tx, ty, 'down');
    const spots = [
      ['up', tx, ty + 1], ['down', tx, ty - 1],
      ['left', tx + 1, ty], ['right', tx - 1, ty],
    ];
    for (const [dir, sx, sy] of spots) {
      if (sx >= 0 && sy >= 0 && sx < g.map.w && sy < g.map.h && g.canWalk(sx, sy)) {
        g.setMap(mapId, sx, sy, dir);
        g.busy = false;
        return { ok: true, at: [sx, sy, dir] };
      }
    }
    return { ok: false };
  }, { mapId, tx, ty });
  await sleep(300);
  return result;
}

async function interactAt(mapId, tx, ty) {
  const placed = await placeFacing(mapId, tx, ty);
  assert(placed.ok, `no standing tile beside ${mapId}:${tx},${ty}`);
  await page.keyboard.press('Space');
  await sleep(260);
}

async function battleButtons() {
  return page.evaluate(() => {
    const btns = [...document.querySelectorAll('#battleControls button')]
      .filter(b => b.offsetParent !== null && !b.disabled);
    return btns.map((b, idx) => ({ idx, text: b.textContent.replace(/\s+/g, ' ').trim() }));
  });
}

async function runBattle(max = 500) {
  let lastButtons = '';
  for (let i = 0; i < max; i++) {
    const info = await page.evaluate(() => {
      const g = window.mythlings;
      return {
        inBattle: !!g.battle,
        buttons: [...document.querySelectorAll('#battleControls button')]
          .filter(b => b.offsetParent !== null && !b.disabled)
          .map((b, idx) => ({ idx, text: b.textContent.replace(/\s+/g, ' ').trim() })),
        message: document.getElementById('battleMessage').textContent,
      };
    });
    if (!info.inBattle) break;
    // Skip message/animation waits.
    await page.keyboard.press('Space');
    const labels = info.buttons.map(b => b.text);
    const sig = labels.join('|');
    if (sig !== lastButtons) lastButtons = sig;
    if (labels.some(l => /^FIGHT/.test(l))) {
      const idx = info.buttons.find(l => /^FIGHT/.test(l.text)).idx;
      await page.locator('#battleControls button').nth(idx).click();
      await sleep(80);
      continue;
    }
    const moves = info.buttons.filter(b => /PP|STRUGGLE/.test(b.text));
    if (moves.length) {
      const power = (text) => {
        const m = text.match(/PWR\s+(\d+)/);
        return m ? Number(m[1]) : 0;
      };
      moves.sort((a, b) => power(b.text) - power(a.text));
      await page.locator('#battleControls button').nth(moves[0].idx).click();
      await sleep(80);
      continue;
    }
    if (labels.some(l => /^RUN/.test(l))) {
      const idx = info.buttons.find(l => /^RUN/.test(l.text)).idx;
      await page.locator('#battleControls button').nth(idx).click();
      await sleep(80);
      continue;
    }
    if (info.buttons.length && /next Mythling|Send out/i.test(info.message)) {
      await page.locator('#battleControls button').nth(info.buttons[0].idx).click();
      await sleep(80);
      continue;
    }
    await sleep(100);
  }
  await waitFor(async () => page.evaluate(() => !window.mythlings.battle && window.mythlings.mode === 'world'), 'battle end');
  await sleep(300);
}

async function catchWithOrb(itemLabel = 'Capture Orb') {
  await waitBattle();
  // Opening messages play before the command bar appears; skip through them.
  for (let i = 0; i < 160; i++) {
    const buttons = await battleButtons();
    if (buttons.some(b => /^(FIGHT|BAG)/.test(b.text))) break;
    await page.keyboard.press('Space');
    await sleep(80);
  }
  await page.evaluate(() => {
    const g = window.mythlings;
    g.battle.foeMon.hp = 1;
    g.battle.rng = () => 0;
  });
  const bag = (await battleButtons()).find(b => /^BAG/.test(b.text));
  assert(bag, 'BAG command missing');
  await page.locator('#battleControls button').nth(bag.idx).click();
  await sleep(120);
  const orb = (await battleButtons()).find(b => b.text.includes(itemLabel));
  assert(orb, `${itemLabel} missing from battle bag`);
  await page.locator('#battleControls button').nth(orb.idx).click();
  for (let i = 0; i < 180; i++) {
    if (!(await page.evaluate(() => !!window.mythlings.battle))) break;
    await page.keyboard.press('Space');
    await sleep(70);
  }
  await waitFor(async () => page.evaluate(() => !window.mythlings.battle && window.mythlings.mode === 'world' && !window.mythlings.busy), 'capture to finish');
  await sleep(250);
}

async function autoUntilBattle() {
  const end = await advanceDialogue();
  if (end === 'modal') {
    await page.locator('#modalClose').click();
    await sleep(100);
  }
  await waitBattle();
}

async function fightTrainerAt(mapId, tx, ty) {
  await interactAt(mapId, tx, ty);
  await autoUntilBattle();
  await screenshot(`battle-${mapId}`);
  await runBattle();
  await advanceDialogue();
}

async function openMenuTab(label) {
  await page.keyboard.press('KeyM');
  await page.waitForSelector('#overlay:not(.hidden)');
  if (label) {
    await page.locator('.tab-btn').filter({ hasText: label }).click();
    await sleep(120);
  }
}

// ------------------------------------------------------------------ boot
await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('#titleScreen:not(.hidden)');

await check('title screen renders with a clean console', async () => {
  assert(await page.title() === 'Mythlings — A Pocket Bestiary Adventure', 'unexpected title');
  assert(consoleErrors.length === 0, `console errors: ${consoleErrors.join('; ')}`);
  await screenshot('01-title');
});

await check('new journey accepts Cindit and starts the quest', async () => {
  await page.getByRole('button', { name: 'NEW JOURNEY' }).click();
  await page.waitForSelector('#starterScreen:not(.hidden)');
  await screenshot('02-starters');
  await page.locator('.starter-card').first().locator('button').click();
  await page.waitForFunction(() => window.mythlings?.mode === 'world' && window.mythlings.ui.dialogueOpen);
  await sleep(300);
  await screenshot('03-professor');
  const result = await advanceDialogue();
  assert(result === 'world', `dialogue ended in ${result}`);
  const s = await gameState();
  assert(s.map === 'lab', `expected lab, got ${s.map}`);
  assert(s.party[0].id === 'cindit' && s.party[0].level === 5, `bad starter ${JSON.stringify(s.party[0])}`);
  assert(s.quests.research === 'active', 'research quest not active');
  await screenshot('04-lab');
});

await check('walking through the lab door warps into Willowbrook', async () => {
  for (let i = 0; i < 2; i++) {
    await step('ArrowDown', 100, 280);
  }
  await waitFor(async () => page.evaluate(() => window.mythlings.mapId === 'willowbrook'), 'town warp');
  await sleep(500);
  const s = await gameState();
  assert(s.map === 'willowbrook', `expected willowbrook, got ${s.map}`);
  await screenshot('05-town');
});

await check('talking to Mira works (data-driven NPC dialogue)', async () => {
  await interactAt('willowbrook', 10, 11);
  const result = await advanceDialogue();
  assert(result === 'world', `expected world, got ${result}`);
  assert(consoleErrors.length === 0, `console errors: ${consoleErrors.join('; ')}`);
});

await check('a real step in tall grass starts a wild battle', async () => {
  await teleport('route1', 15, 8, 'right');
  await page.evaluate(() => {
    const g = window.mythlings;
    g.encounterCooldown = 0;
    window.__savedRandom = Math.random;
    Math.random = () => 0;
  });
  await step('ArrowRight', 120, 160);
  try {
    await waitBattle();
  } finally {
    await page.evaluate(() => { if (window.__savedRandom) Math.random = window.__savedRandom; });
  }
  const s = await gameState();
  assert(s.battle, 'no battle from grass');
  const hud = await page.evaluate(() => ({
    foe: document.getElementById('foeName').textContent.trim(),
    hp: document.getElementById('foeHp').style.width,
  }));
  assert(hud.foe && hud.foe !== '???', `foe name is blank ("${hud.foe}")`);
  assert(parseFloat(hud.hp) > 0, `foe HP bar is empty (width ${hud.hp})`);
});

await check('a weakened wild Mythling can be caught through the battle bag', async () => {
  const before = (await gameState()).dexCaught.length;
  await catchWithOrb();
  const s = await gameState();
  assert(!s.battle, 'battle still open after capture');
  assert(s.dexCaught.length === before + 1, `Index did not gain a catch (${before} -> ${s.dexCaught.length})`);
});

await check('two more catches complete the Field Notes quest', async () => {
  for (const id of ['puddip', 'sparkit']) {
    // Do not return the battle promise: Playwright would wait for a battle
    // that only progresses through the UI we are about to drive.
    await page.evaluate((id) => { window.mythlings.startWildBattle(id, 5).catch(console.error); }, id);
    await waitBattle();
    await catchWithOrb();
  }
  const s = await gameState();
  assert(s.dexCaught.length >= 4, `expected 4+ caught, got ${s.dexCaught.length}`);
  assert(s.quests.research === 'done', `research was ${s.quests.research}`);
  await screenshot('06-team');
});

await check('journey menu tabs render and Escape closes the menu', async () => {
  await openMenuTab('PARTY');
  const tabs = await page.locator('.tab-btn').count();
  const partyCards = await page.locator('.party-card').count();
  assert(tabs === 6, `expected 6 tabs, got ${tabs}`);
  assert(partyCards >= 3, `expected 3+ party cards, got ${partyCards}`);
  await page.locator('.tab-btn').filter({ hasText: 'INDEX' }).click();
  assert(await page.locator('.dex-cell').count() === 26, 'Index should have 26 entries');
  await screenshot('07-index');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.getElementById('overlay').classList.contains('hidden'));
  await sleep(150);
  const s = await gameState();
  assert(!s.modalOpen, 'Escape did not close the menu');
});

await check('healing centre restores HP and clears status', async () => {
  await page.evaluate(() => {
    const m = window.mythlings.state.party[0];
    m.hp = 1;
    m.status = { name: 'burn', turns: 0 };
  });
  await interactAt('clinic', 6, 3);
  await advanceDialogue();
  const s = await gameState();
  assert(s.party[0].hp === s.party[0].maxHp, `HP not healed (${s.party[0].hp}/${s.party[0].maxHp})`);
  const status = await page.evaluate(() => window.mythlings.state.party[0].status);
  assert(status === null, 'status not cleared');
});

await check('market shop opens and a purchase succeeds', async () => {
  await interactAt('market', 6, 3);
  const result = await advanceDialogue();
  assert(result === 'modal', `expected shop modal, got ${result}`);
  const before = await page.evaluate(() => ({ money: window.mythlings.state.player.money, orbs: window.mythlings.state.bag.orb || 0 }));
  await page.locator('.shop-row').first().locator('button').click();
  await sleep(100);
  const after = await page.evaluate(() => ({ money: window.mythlings.state.player.money, orbs: window.mythlings.state.bag.orb || 0 }));
  assert(after.money < before.money, 'money did not decrease');
  assert(after.orbs > before.orbs, 'orb count did not increase');
  await screenshot('08-shop');
  await page.locator('#modalClose').click();
  await sleep(100);
});

await check('storage deposit and withdraw round-trip', async () => {
  await openMenuTab('STORAGE');
  const before = await gameState();
  await page.locator('.bag-row').first().locator('button').filter({ hasText: 'DEPOSIT' }).click();
  await sleep(100);
  const deposited = await gameState();
  assert(deposited.party.length === before.party.length - 1 && deposited.box === before.box + 1, 'deposit failed');
  await page.locator('.storage-card').first().locator('button').click();
  await sleep(100);
  const withdrawn = await gameState();
  assert(withdrawn.party.length === before.party.length, 'withdraw failed');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.getElementById('overlay').classList.contains('hidden'));
});

await check('Glowberry side quest can be started, completed and rewarded', async () => {
  await interactAt('fernwood', 16, 8);
  await advanceDialogue();
  for (const [x, y] of [[8, 16], [19, 5], [26, 14]]) {
    await interactAt('fernwood', x, y);
    await advanceDialogue();
  }
  const berries = await page.evaluate(() => window.mythlings.countItem('berry'));
  assert(berries === 3, `expected 3 berries, got ${berries}`);
  const before = await page.evaluate(() => window.mythlings.state.player.money);
  await interactAt('fernwood', 16, 8);
  await advanceDialogue();
  const s = await gameState();
  assert(s.quests.berries === 'done', `berries quest was ${s.quests.berries}`);
  assert(s.money > before, 'berry reward money missing');
});

await check('save -> reload -> Continue restores the journey', async () => {
  await openMenuTab('SAVE');
  await page.getByRole('button', { name: 'SAVE JOURNEY' }).click();
  await sleep(100);
  const before = await gameState();
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('#titleScreen:not(.hidden)');
  const enabled = await page.locator('#continueBtn').isEnabled();
  assert(enabled, 'Continue is disabled after saving');
  await page.getByRole('button', { name: 'CONTINUE' }).click();
  await page.waitForFunction(() => window.mythlings?.mode === 'world' && !window.mythlings.busy);
  await sleep(400);
  const after = await gameState();
  assert(after.dexCaught.length === before.dexCaught.length, 'Index did not restore');
  assert(after.party.length === before.party.length, 'party did not restore');
  assert(after.quests.berries === 'done', 'quest state did not restore');
  await screenshot('09-continued');
});

// Give the team enough staying power to exercise every late-game branch.
await page.evaluate(() => {
  for (const m of window.mythlings.state.party) {
    m.level = 30;
    m.maxHp = 500;
    m.hp = 500;
    m.atk = 500;
    m.def = 300;
    m.spd = 300;
    m.exp = 0;
    m.status = null;
    m.stages = { atk: 0, def: 0, spd: 0 };
  }
  window.mythlings.state.bag.mythicorb = 5;
});

await check("Ranger Bramble's boss battle is winnable and completes its quest", async () => {
  await fightTrainerAt('fernwood', 24, 10);
  const s = await gameState();
  assert(s.flags.brambleBeaten, 'brambleBeaten flag missing');
  assert(s.quests.bramble === 'done', `bramble quest was ${s.quests.bramble}`);
  assert(!s.battle && s.mode === 'world', 'not back in the world after Bramble');
});

await check("Pyromancer Cinder's boss battle completes its quest", async () => {
  await fightTrainerAt('emberhold', 16, 9);
  const s = await gameState();
  assert(s.flags.cinderBeaten, 'cinderBeaten flag missing');
  assert(s.quests.cinder === 'done', `cinder quest was ${s.quests.cinder}`);
});

await check("Shadow Adept Umbra's battle reaches the ending", async () => {
  await interactAt('sanctum', 7, 5);
  await autoUntilBattle();
  await screenshot('10-final-battle');
  await runBattle();
  await advanceDialogue(300);
  // The ending fades in after the post-battle dialogue, so wait for it explicitly.
  await waitFor(() => page.evaluate(() => window.mythlings.ui.endingOpen), 'ending screen', 12000);
  await page.waitForSelector('#endingScreen:not(.hidden)', { state: 'visible' });
  await screenshot('11-ending');
  const stats = await page.locator('.ending-stat').count();
  assert(stats === 6, `expected 6 ending stats, got ${stats}`);
  const endingText = await page.locator('.ending-title').innerText();
  assert(/You did it/.test(endingText), `unexpected ending title: ${endingText}`);
});

await check('KEEP EXPLORING returns to a saved post-game world', async () => {
  await page.getByRole('button', { name: 'KEEP EXPLORING' }).click();
  await page.waitForFunction(() => document.getElementById('endingScreen').classList.contains('hidden'));
  await sleep(300);
  const s = await gameState();
  assert(s.mode === 'world' && !s.busy, 'did not return to the world');
  assert(s.flags.umbraBeaten, 'umbra flag missing');
  const saved = await page.evaluate(() => !!localStorage.getItem('mythlings.save.v1'));
  assert(saved, 'post-game save missing');
});

await check('post-game rift allows Voidra to be caught', async () => {
  const saved = await page.evaluate(() => window.mythlings.state.dex.caught.voidra === true);
  if (!saved) {
    await interactAt('sanctum', 8, 3);
    // Advance the two narration lines; the helper selects "Reach in" at the prompt.
    await advanceDialogue();
    await waitBattle();
    await catchWithOrb('Mythic Orb');
  }
  const s = await gameState();
  assert(s.flags.umbraBeaten, 'umbra flag went missing');
  const caught = await page.evaluate(() => !!window.mythlings.state.dex.caught.voidra);
  assert(caught, 'Voidra was not caught');
});

await check('touch-sized viewport is usable without horizontal overflow', async () => {
  const save = await page.evaluate(() => localStorage.getItem('mythlings.save.v1'));
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1,
  });
  const mp = await mobile.newPage();
  const mErrors = [];
  mp.on('pageerror', (e) => mErrors.push(String(e)));
  await mp.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle' });
  await mp.evaluate((s) => localStorage.setItem('mythlings.save.v1', s), save);
  await mp.reload({ waitUntil: 'networkidle' });
  await mp.getByRole('button', { name: 'CONTINUE' }).click();
  await mp.waitForFunction(() => window.mythlings?.mode === 'world' && !window.mythlings.busy);
  // Let the "Journey loaded" toast clear before judging the top-bar layout.
  await mp.waitForTimeout(3600);
  const metrics = await mp.evaluate(() => {
    const touch = getComputedStyle(document.getElementById('touchControls')).display;
    const screen = document.getElementById('screenFrame').getBoundingClientRect();
    const menu = document.getElementById('menuBtn').getBoundingClientRect();
    return {
      touch,
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      screen: { left: screen.left, right: screen.right, width: screen.width, height: screen.height },
      viewport: [innerWidth, innerHeight],
      menu: { visible: document.getElementById('menuBtn').offsetParent !== null, left: menu.left, right: menu.right },
      buttons: [...document.querySelectorAll('.dbtn')].filter(b => b.offsetParent !== null).length,
    };
  });
  console.log('      mobile metrics:', JSON.stringify(metrics));
  const labels = await mp.evaluate(() => ({
    interact: document.getElementById('interactHint').textContent,
    status: document.getElementById('statusLine').textContent,
  }));
  await mp.screenshot({ path: 'artifacts/browser/12-mobile.png', fullPage: true });
  assert(metrics.touch === 'flex', `touch controls display=${metrics.touch}`);
  assert(/D-pad/.test(labels.status), `touch footer not updated: ${labels.status}`);
  assert(!/SPACE/.test(labels.interact), `touch hint still mentions SPACE: ${labels.interact}`);
  if (labels.interact) assert(/^A ·/.test(labels.interact), `touch hint should start with A: ${labels.interact}`);
  assert(metrics.buttons === 4, `expected 4 D-pad buttons, got ${metrics.buttons}`);
  assert(!metrics.overflowX, 'mobile page has horizontal overflow');
  assert(metrics.screen.right <= metrics.viewport[0] + 1, `screen frame overflows (${metrics.screen.right} > ${metrics.viewport[0]})`);
  assert(mErrors.length === 0, `mobile page errors: ${mErrors.join('; ')}`);
  await mobile.close();
});

await check('no uncaught page errors or failed requests', async () => {
  assert(pageErrors.length === 0, `page errors:\n${pageErrors.join('\n')}`);
  assert(failedRequests.length === 0, `failed requests:\n${failedRequests.join('\n')}`);
  assert(consoleErrors.length === 0, `console errors:\n${consoleErrors.join('\n')}`);
});

const failed = checks.filter(c => !c.ok);
console.log(`\n${checks.length - failed.length} passed, ${failed.length} failed`);
if (failed.length) {
  console.log(JSON.stringify({ checks, consoleErrors, pageErrors, failedRequests }, null, 2));
}
await browser.close();
process.exit(failed.length ? 1 : 0);
