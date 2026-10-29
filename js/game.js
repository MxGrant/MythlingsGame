// Game controller: world state, movement, encounters, battles, quests and saving.
import {
  getMap, START_MAP, isBlockedTile, warpAt, npcAt, objectAt, ENCOUNTER_TILES,
} from './data/world.js';
import {
  SPECIES, SPECIES_LIST, createCreature, healFull, expNeeded,
} from './data/species.js';
import { ITEMS, SHOP_STOCK, EMBER_SHOP_STOCK } from './data/items.js';
import { QUESTS, QUEST_ORDER, questProgressLine } from './data/quests.js';
import { TYPE_INFO } from './data/types.js';
import { Battle } from './engine/battle.js';
import { audio } from './engine/audio.js';
import { saveGame, loadRawSave, hasSave } from './engine/save.js';
import { renderWorld, renderBattle, renderTitleBackdrop } from './engine/scene.js';
import { UI, formatTime } from './ui.js';

const DIRS = {
  up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0],
};
const MOVE_TIME = 0.145;
const PLAYER_LOOK = {
  skin: '#eeb98c', hair: '#4b3223', shirt: '#3fc7bb', pants: '#3b3f63',
  accent: '#ffe066', hat: 'cap',
};

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.touchMode = typeof window.matchMedia === 'function'
      && window.matchMedia('(pointer: coarse)').matches;
    this.ui = new UI(this);
    this.mode = 'title';
    this.state = null;
    this.map = null;
    this.mapId = null;
    this.player = this.blankPlayer(12, 10);
    this.keys = new Set();
    this.virtual = new Set();
    this.keyOrder = [];
    this.time = 0;
    this.lastFrame = performance.now();
    this.playSeconds = 0;
    this.fadeAlpha = 0;
    this.fadeState = null;
    this.fx = this.freshFx();
    this.battle = null;
    this.battleTheme = 'route';
    this.busy = false;
    this.encounterCooldown = 0;
    this.waitSkip = null;
    this.lastBattleResult = null;
    this.lastAdvanceAt = 0;
    this.lastMenuCloseAt = 0;
    this.shopKind = 'market';
    this.lastHint = '';

    this.bindInput();
    this.ui.showTitle(hasSave());
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  blankPlayer(x, y) {
    return {
      x, y, px: x, py: y, dir: 'down',
      fromX: x, fromY: y, toX: x, toY: y,
      moving: false, t: 0, stepPhase: 0,
    };
  }

  freshFx() {
    return {
      foeFlash: 0, allyFlash: 0, foeShake: 0, allyShake: 0, shake: 0, flash: 0,
      foeScale: 1, allyScale: 1, foeAlpha: 1, allyAlpha: 1,
      foeY: 0, allyY: 0, foeHold: false, allyHold: false, hideFoe: false,
      particles: [], numbers: [], orb: null,
    };
  }

  // -------------------------------------------------------------- Input
  bindInput() {
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.onKeyUp(e));
    window.addEventListener('blur', () => { this.keys.clear(); this.virtual.clear(); });
    this.canvas.addEventListener('click', () => {
      if (this.mode === 'battle') { if (this.waitSkip) this.waitSkip(); return; }
      if (this.ui.dialogueOpen) { this.ui.advance(); return; }
      this.interact();
    });
    document.addEventListener('pointerdown', () => {
      // first gesture unlocks WebAudio
      audio.ensure();
      if (this.mode === 'title') audio.playMusic('title');
    }, { once: true });
  }

  onKeyDown(e) {
    if (this.ui.dialogueOpen || this.ui.modalOpen) return;
    if (this.ui.starterOpen || this.ui.endingOpen) return;
    const code = e.code;
    if (this.mode === 'title') return;
    if (this.mode === 'battle') {
      if (code === 'Space' || code === 'Enter') {
        e.preventDefault();
        if (this.waitSkip) this.waitSkip();
      }
      return;
    }
    if (this.mode !== 'world') return;
    if (code === 'Escape') {
      e.preventDefault();
      this.openMenu('party');
      return;
    }
    if (code === 'Space' || code === 'Enter') {
      e.preventDefault();
      if (performance.now() - this.lastAdvanceAt < 180) return;
      this.interact();
      return;
    }
    if (code === 'KeyM' || code === 'KeyX') {
      e.preventDefault();
      this.openMenu('party');
      return;
    }
    if (code === 'KeyB') {
      e.preventDefault();
      this.openMenu('bag');
      return;
    }
    const dir = this.dirFromCode(code);
    if (dir) {
      e.preventDefault();
      this.keys.add(dir);
      this.keyOrder = this.keyOrder.filter(d => d !== dir);
      this.keyOrder.push(dir);
    }
  }

  onKeyUp(e) {
    const dir = this.dirFromCode(e.code);
    if (dir) this.keys.delete(dir);
  }

  dirFromCode(code) {
    if (code === 'ArrowUp' || code === 'KeyW') return 'up';
    if (code === 'ArrowDown' || code === 'KeyS') return 'down';
    if (code === 'ArrowLeft' || code === 'KeyA') return 'left';
    if (code === 'ArrowRight' || code === 'KeyD') return 'right';
    return null;
  }

  setVirtualDirection(dir, down) {
    if (down) {
      this.virtual.add(dir);
      this.keyOrder = this.keyOrder.filter(d => d !== dir);
      this.keyOrder.push(dir);
    } else {
      this.virtual.delete(dir);
    }
  }

  currentDirection() {
    for (let i = this.keyOrder.length - 1; i >= 0; i--) {
      const d = this.keyOrder[i];
      if (this.keys.has(d) || this.virtual.has(d)) return d;
    }
    for (const d of ['up', 'down', 'left', 'right']) {
      if (this.keys.has(d) || this.virtual.has(d)) return d;
    }
    return null;
  }

  facingTile() {
    const [dx, dy] = DIRS[this.player.dir] || DIRS.down;
    return { x: this.player.x + dx, y: this.player.y + dy };
  }

  // -------------------------------------------------------------- Loop
  loop(now) {
    const dt = Math.min(0.05, Math.max(0, (now - this.lastFrame) / 1000));
    this.lastFrame = now;
    this.time += dt;
    this.updateFade(dt);
    this.updateFx(dt);
    if (this.mode === 'world') this.updateWorld(dt);
    else if (this.mode === 'battle' && this.state) this.playSeconds += dt;

    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    if (this.mode === 'battle' && this.battle) {
      renderBattle(ctx, this, this.time);
    } else if (this.map && this.state) {
      renderWorld(ctx, this, this.time);
    } else {
      renderTitleBackdrop(ctx, this.time);
    }
    requestAnimationFrame(this.loop);
  }

  updateFade(dt) {
    if (!this.fadeState) return;
    const f = this.fadeState;
    f.elapsed += dt * 1000;
    const k = clamp(f.elapsed / f.ms, 0, 1);
    this.fadeAlpha = f.from + (f.to - f.from) * k;
    if (k >= 1) {
      const res = f.resolve;
      this.fadeState = null;
      if (res) res();
    }
  }

  fadeTo(target, ms = 220) {
    if (this.fadeState) {
      const old = this.fadeState.resolve;
      this.fadeState = null;
      if (old) old();
    }
    if (Math.abs(this.fadeAlpha - target) < 0.001) {
      this.fadeAlpha = target;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.fadeState = { from: this.fadeAlpha, to: target, ms, elapsed: 0, resolve };
    });
  }

  updateFx(dt) {
    const f = this.fx;
    for (const key of ['foeFlash', 'allyFlash', 'foeShake', 'allyShake', 'shake', 'flash']) {
      f[key] = Math.max(0, f[key] - dt * (key.includes('Shake') ? 3 : 2));
    }
    for (const p of f.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
    }
    f.particles = f.particles.filter(p => p.life > 0);
    for (const n of f.numbers) {
      n.life -= dt * 1.3;
      n.y -= dt * 18;
    }
    f.numbers = f.numbers.filter(n => n.life > 0);
    if (f.orb && f.orb.mode === 'throw') f.orb.t = Math.min(1, f.orb.t + dt / 0.55);
    if (f.orb && f.orb.mode === 'burst') f.orb.t = Math.min(1, f.orb.t + dt * 2);
  }

  // -------------------------------------------------------------- World update
  updateWorld(dt) {
    if (!this.state) return;
    if (!this.ui.isBlocking()) this.playSeconds += dt;
    if (this.encounterCooldown > 0) {
      // cooldown is consumed per step, not per frame
    }
    this.refreshInteractHint();
    if (this.busy || this.ui.isBlocking()) return;
    const p = this.player;
    if (p.moving) {
      p.t += dt / MOVE_TIME;
      const k = Math.min(1, p.t);
      p.px = p.fromX + (p.toX - p.fromX) * k;
      p.py = p.fromY + (p.toY - p.fromY) * k;
      if (k >= 1) {
        p.x = p.toX; p.y = p.toY; p.px = p.x; p.py = p.y;
        p.moving = false;
        this.finishStep();
      }
      return;
    }
    const dir = this.currentDirection();
    if (!dir) {
      p.stepPhase = 0;
      return;
    }
    p.dir = dir;
    const [dx, dy] = DIRS[dir];
    const nx = p.x + dx;
    const ny = p.y + dy;
    if (this.canWalk(nx, ny)) {
      p.moving = true;
      p.t = 0;
      p.fromX = p.x; p.fromY = p.y;
      p.toX = nx; p.toY = ny;
      p.px = p.x; p.py = p.y;
      p.stepPhase = (p.stepPhase + 1) % 2;
    }
  }

  canWalk(x, y) {
    if (!this.map) return false;
    if (isBlockedTile(this.map, x, y)) return false;
    if (npcAt(this.map, x, y, this.state.flags)) return false;
    if (objectAt(this.map, x, y)) return false;
    return true;
  }

  finishStep() {
    const p = this.player;
    this.state.steps = (this.state.steps || 0) + 1;
    if (this.encounterCooldown > 0) this.encounterCooldown--;
    const warp = warpAt(this.map, p.x, p.y);
    if (warp) {
      this.doWarp(warp);
      return;
    }
    this.checkEncounter();
  }

  async doWarp(warp) {
    this.busy = true;
    audio.sfx('open');
    await this.fadeTo(1, 170);
    this.setMap(warp.to, warp.tx, warp.ty, warp.dir);
    await this.fadeTo(0, 200);
    this.busy = false;
    this.save(true);
  }

  setMap(id, x, y, dir = 'down') {
    let map;
    try {
      map = getMap(id);
    } catch (err) {
      console.error(err);
      map = getMap(START_MAP);
      id = START_MAP;
      x = 12; y = 10;
    }
    let px = x, py = y;
    if (isBlockedTile(map, px, py)) {
      const found = this.findFreeTile(map, px, py);
      if (found) { px = found.x; py = found.y; }
    }
    this.map = map;
    this.mapId = id;
    this.player = this.blankPlayer(px, py);
    this.player.dir = dir;
    if (this.state) {
      this.state.player.map = id;
      this.state.player.x = px;
      this.state.player.y = py;
      this.state.player.dir = dir;
    }
    this.ui.setLocation(map.name);
    this.ui.setInteractHint('');
    this.lastHint = '';
    this.ui.setMoney(this.state ? this.state.player.money : 0);
    audio.playMusic(map.music);
    this.refreshHint();
    this.encounterCooldown = 2;
  }

  findFreeTile(map, x, y) {
    for (let r = 1; r <= 6; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= map.w || ny >= map.h) continue;
          if (isBlockedTile(map, nx, ny)) continue;
          if (npcAt(map, nx, ny, this.state ? this.state.flags : {})) continue;
          if (objectAt(map, nx, ny)) continue;
          return { x: nx, y: ny };
        }
      }
    }
    return null;
  }

  refreshInteractHint() {
    if (!this.map || !this.state || this.mode !== 'world' || this.busy || this.ui.isBlocking()) {
      if (this.lastHint) { this.ui.setInteractHint(''); this.lastHint = ''; }
      return;
    }
    const f = this.facingTile();
    const npc = npcAt(this.map, f.x, f.y, this.state.flags);
    const obj = objectAt(this.map, f.x, f.y);
    const action = this.touchMode ? 'A' : 'SPACE';
    let hint = '';
    if (npc) {
      hint = `${action} · Talk to ${npc.name}`;
    } else if (obj) {
      if (obj.kind === 'sign' || obj.kind === 'books') hint = `${action} · Read`;
      else if (obj.kind === 'pc') hint = `${action} · Access storage`;
      else if (obj.kind === 'berry') hint = `${action} · Search bush`;
      else if (obj.kind === 'pickup') hint = `${action} · Pick up`;
      else hint = `${action} · Look closer`;
    }
    if (hint !== this.lastHint) {
      this.ui.setInteractHint(hint);
      this.lastHint = hint;
    }
  }

  // -------------------------------------------------------------- Interact
  interact() {
    this.doInteract().catch((err) => {
      console.error(err);
      this.ui.toast('Something unexpected happened. Try again.', 'bad');
      this.busy = false;
    });
  }

  async doInteract() {
    if (!this.state || this.mode !== 'world' || this.busy) return;
    if (this.ui.isBlocking()) return;
    if (performance.now() - this.lastAdvanceAt < 160) return;
    const f = this.facingTile();
    const npc = npcAt(this.map, f.x, f.y, this.state.flags);
    if (npc) { await this.talkTo(npc); return; }
    const obj = objectAt(this.map, f.x, f.y);
    if (obj) { await this.useObject(obj); return; }
  }

  // Dialogue shortcut used by data-driven NPC callbacks. These receive the game
  // instance (not the UI) and call g.say(...) to open a conversation.
  say(lines, speaker = '') {
    return this.ui.say(lines, speaker);
  }

  async talkTo(npc) {
    if (npc.kind === 'trainer' && npc.team) {
      const beaten = npc.beatenFlag && this.flag(npc.beatenFlag);
      if (beaten) {
        await this.ui.say(npc.post || npc.lines || ['...'], npc.name);
        return;
      }
      if (!this.state.party.some(m => m.hp > 0)) {
        await this.ui.say(['Your team is in no shape to battle. Rest at a clinic or use a Revive Seed.'], npc.name);
        return;
      }
      if (npc.questId) this.startQuest(npc.questId);
      await this.ui.say(npc.intro || npc.lines || ['Let\'s battle!'], npc.name);
      const result = await this.startTrainerBattle(npc);
      if (result === 'victory') {
        if (npc.beatenFlag) this.state.flags[npc.beatenFlag] = true;
        if (npc.questId) this.completeQuest(npc.questId);
        if (npc.reward) {
          this.addMoney(npc.reward);
          this.ui.toast(`Won ${npc.reward}g!`, 'good');
        }
        this.save(true);
        if (npc.post) await this.ui.say(npc.post, npc.name);
        if (npc.finalBoss) await this.showEnding();
      }
      return;
    }
    if (npc.onTalk) {
      await npc.onTalk(this);
    } else {
      await this.ui.say(npc.lines || ['...'], npc.name);
    }
  }

  async useObject(obj) {
    if (obj.kind === 'sign' || obj.kind === 'books') {
      await this.ui.say(obj.text || ['...'], '');
      return;
    }
    if (obj.kind === 'pickup') {
      if (this.flag(obj.flag)) {
        await this.ui.say(['Nothing left here but a flattened patch of grass.'], '');
        return;
      }
      this.setFlag(obj.flag);
      this.give(obj.item, obj.qty || 1);
      await this.ui.say([`You found ${ITEMS[obj.item] ? ITEMS[obj.item].name : 'something'}!`], '');
      return;
    }
    if (obj.kind === 'berry') {
      if (this.flag(obj.id)) {
        await this.ui.say(['The bush is bare now. A few leaves rustle, offended.'], '');
        return;
      }
      this.setFlag(obj.id);
      this.give('berry', 1);
      await this.ui.say(['You part the glowing leaves and find a Glowberry!'], '');
      return;
    }
    if (obj.kind === 'pc') {
      audio.sfx('open');
      this.openMenu('box');
      return;
    }
    if (obj.kind === 'campfire') {
      await this.ui.say(['The campfire crackles warmly. Emberkeep hospitality is hard to beat.'], '');
      return;
    }
    if (obj.kind === 'crystal') {
      await this.ui.say(['A humming crystal. Its light leans toward you, as though listening.'], '');
      return;
    }
    await this.ui.say(['Nothing special.'], '');
  }

  // -------------------------------------------------------------- Encounters / battles
  checkEncounter() {
    const enc = this.map.encounters;
    if (!enc || this.encounterCooldown > 0) return;
    const tile = this.map.terrain[this.player.y] && this.map.terrain[this.player.y][this.player.x];
    if (!tile || !ENCOUNTER_TILES.has(tile)) return;
    if (!this.state.party.some(m => m.hp > 0)) return;
    if (Math.random() > enc.rate) return;
    this.encounterCooldown = 5;
    let speciesId;
    let level;
    if (enc.rare && Math.random() < enc.rare.chance) {
      speciesId = enc.rare.id;
      level = enc.rare.level;
    } else {
      speciesId = enc.pool[Math.floor(Math.random() * enc.pool.length)];
      level = enc.min + Math.floor(Math.random() * (enc.max - enc.min + 1));
    }
    this.startWildBattle(speciesId, level).catch((err) => {
      console.error(err);
      this.ui.toast('The wild Mythling slipped away. Try again.', 'bad');
      this.mode = 'world';
      this.busy = false;
      this.ui.exitBattle();
    });
  }

  markSeen(speciesId) {
    if (!this.state) return;
    if (!this.state.dex.seen[speciesId]) this.state.dex.seen[speciesId] = true;
    this.state.dex.seenCount = Object.keys(this.state.dex.seen).length;
  }

  markCaught(speciesId) {
    if (!this.state) return;
    this.state.dex.seen[speciesId] = true;
    this.state.dex.caught[speciesId] = true;
    this.state.dex.caughtCount = Object.keys(this.state.dex.caught).length;
    this.state.dex.seenCount = Object.keys(this.state.dex.seen).length;
  }

  caughtCount() {
    return this.state ? Object.keys(this.state.dex.caught).length : 0;
  }

  async startWildBattle(speciesId, level) {
    if (!this.state || !SPECIES[speciesId]) return 'fled';
    if (!this.state.party.some(m => m.hp > 0)) return 'defeat';
    const foe = createCreature(speciesId, level);
    this.markSeen(speciesId);
    return this.runBattle({ foe });
  }

  async startTrainerBattle(npc) {
    const team = npc.team.map(([speciesId, level]) => {
      this.markSeen(speciesId);
      return createCreature(speciesId, level);
    });
    return this.runBattle({
      trainer: { name: npc.name, team, reward: npc.reward || 0 },
    });
  }

  async runBattle({ foe, trainer }) {
    if (!this.state.party.some(m => m.hp > 0)) return 'defeat';
    this.busy = true;
    this.mode = 'battle';
    this.battleTheme = this.map ? this.map.theme : 'route';
    this.lastBattleResult = null;
    this.fx = this.freshFx();
    const battle = new Battle({
      party: this.state.party,
      bag: this.state.bag,
      foe: foe || trainer.team[0],
      trainer: trainer || null,
    });
    this.battle = battle;
    this.ui.enterBattle();
    this.ui.syncBattle(battle);
    audio.playMusic('battle');
    this.fadeAlpha = 1;
    await this.fadeTo(0, 220);
    await this.playEvents(battle.begin());
    this.ui.syncBattle(battle);
    await this.battleLoop();
    const result = this.lastBattleResult || battle.result || 'fled';
    await this.endBattle();
    return result;
  }

  async battleLoop() {
    let guard = 0;
    while (this.battle && !this.battle.ended && guard++ < 200) {
      const action = await this.ui.battleCommand(this.battle);
      if (!action || !this.battle) break;
      const res = this.battle.choose(action);
      await this.playEvents(res.events);
      if (res.ended) {
        this.lastBattleResult = res.result || this.battle.result;
        break;
      }
      this.ui.syncBattle(this.battle);
      if (res.needsSwitch) {
        const switched = await this.forceSwitch();
        if (!switched) {
          this.lastBattleResult = 'defeat';
          if (this.battle) this.battle.result = 'defeat';
          break;
        }
      }
    }
    if (this.battle && !this.lastBattleResult) this.lastBattleResult = this.battle.result || 'fled';
  }

  async forceSwitch() {
    if (!this.battle) return false;
    if (!this.state.party.some(m => m.hp > 0)) return false;
    const idx = await this.ui.choosePartyForSwitch(this.battle);
    if (idx == null || !this.battle) return false;
    const res = this.battle.forceSwitch(idx);
    await this.playEvents(res.events);
    if (this.battle) this.ui.syncBattle(this.battle);
    return true;
  }

  async playEvents(events) {
    if (!events) return;
    for (const e of events) {
      if (!this.battle && e.t !== 'end') continue;
      switch (e.t) {
        case 'msg':
          await this.battleWait(e.text);
          break;
        case 'sfx':
          audio.sfx(e.name);
          break;
        case 'dmg':
          await this.animateDamage(e);
          break;
        case 'heal':
          this.spawnBurst(e.side === 'foe' ? 216 : 76, e.side === 'foe' ? 100 : 140, '#a8ffd8', 10);
          if (this.battle) this.ui.syncBattle(this.battle);
          await this.wait(170);
          break;
        case 'status':
          this.fx.flash = Math.max(this.fx.flash, 0.12);
          if (this.battle) this.ui.syncBattle(this.battle);
          break;
        case 'stat':
          this.spawnBurst(76, 140, '#c9aef0', 8);
          break;
        case 'faint':
          await this.animateFaint(e.side);
          break;
        case 'level':
          this.fx.allyFlash = 0.5;
          break;
        case 'evolve':
          await this.animateEvolve();
          if (this.state && SPECIES[e.species]) {
            this.markCaught(e.species);
            this.ui.toast(`Index updated: ${SPECIES[e.species].name}`, 'quest');
            this.checkQuests();
          }
          break;
        case 'orb':
          await this.animateOrb(e);
          break;
        case 'switchIn':
          this.fx.allyFlash = 0.4;
          break;
        case 'foeOut':
          this.fx.foeAlpha = 1;
          this.fx.foeScale = 1;
          this.fx.foeHold = false;
          this.fx.foeFlash = 0.35;
          break;
        case 'end':
          break;
        default:
          break;
      }
      if (this.battle) this.ui.syncBattle(this.battle);
    }
  }

  battleWait(text) {
    if (!text) return Promise.resolve();
    this.ui.setBattleMessage(text);
    if (this.battle) this.ui.syncBattle(this.battle);
    return this.wait(650 + Math.min(850, text.length * 9));
  }

  wait(ms) {
    return new Promise((resolve) => {
      let done = false;
      let timer = null;
      const finish = () => {
        if (done) return;
        done = true;
        if (timer) clearTimeout(timer);
        if (this.waitSkip === finish) this.waitSkip = null;
        resolve();
      };
      timer = setTimeout(finish, ms);
      this.waitSkip = finish;
    });
  }

  spawnBurst(x, y, color, count = 12) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 20 + Math.random() * 70;
      this.fx.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 20,
        gravity: 90,
        life: 0.35 + Math.random() * 0.45,
        maxLife: 0.8,
        color,
        size: Math.random() < 0.4 ? 2 : 1,
      });
    }
    while (this.fx.particles.length > 120) this.fx.particles.shift();
  }

  async animateDamage(e) {
    const isFoe = e.side === 'foe';
    const pos = isFoe ? { x: 216, y: 98 } : { x: 76, y: 138 };
    const color = (TYPE_INFO[e.type] || TYPE_INFO.Neutral).color;
    this.spawnBurst(pos.x, pos.y, color, e.eff >= 2 ? 22 : 12);
    if (isFoe) {
      this.fx.foeFlash = 0.28;
      this.fx.foeShake = 1;
    } else {
      this.fx.allyFlash = 0.28;
      this.fx.allyShake = 1;
    }
    this.fx.shake = Math.min(1, 0.3 + (e.eff >= 2 ? 0.5 : 0));
    this.fx.numbers.push({
      x: pos.x,
      y: pos.y - 20,
      text: `${e.amount}`,
      color: e.crit ? '#ffe066' : e.eff >= 2 ? '#fff6c4' : '#ffffff',
      life: 1,
    });
    if (e.eff >= 2) this.ui.toast("Super effective!", 'good');
    else if (e.eff <= 0.5) this.ui.toast('Not very effective...', '');
    await this.wait(e.eff >= 2 ? 420 : 280);
  }

  async animateFaint(side) {
    audio.sfx('faint');
    if (side === 'foe') {
      this.fx.foeHold = true;
      this.fx.foeAlpha = 0.15;
      this.fx.foeY = 22;
      this.fx.foeScale = 0.7;
    } else {
      this.fx.allyHold = true;
      this.fx.allyAlpha = 0.15;
      this.fx.allyY = 22;
    }
    await this.wait(560);
    if (side === 'foe') {
      this.fx.foeHold = false;
      this.fx.foeAlpha = 1;
      this.fx.foeY = 0;
      this.fx.foeScale = 1;
    } else {
      this.fx.allyHold = false;
      this.fx.allyAlpha = 1;
      this.fx.allyY = 0;
    }
  }

  async animateEvolve() {
    this.fx.flash = 0.9;
    this.fx.allyFlash = 0.6;
    this.spawnBurst(76, 138, '#ffe066', 26);
    await this.wait(650);
    this.fx.allyFlash = 0.3;
    this.fx.flash = 0.45;
    await this.wait(350);
  }

  async animateOrb(e) {
    this.fx.orb = { mode: 'throw', t: 0, wobble: 0 };
    await this.wait(620);
    this.fx.foeScale = 0.2;
    this.fx.orb = { mode: 'shake', t: 0, wobble: 0 };
    for (let i = 0; i < 3; i++) {
      if (this.fx.orb) this.fx.orb.wobble = i + 1;
      await this.wait(230);
      if (this.fx.orb) this.fx.orb.wobble = 0;
      await this.wait(150);
    }
    if (e.success) {
      this.fx.orb = { mode: 'burst', t: 0 };
      this.fx.flash = 0.5;
      this.fx.hideFoe = true;
      this.spawnBurst(216, 112, '#ffe066', 26);
      audio.sfx('catch');
      await this.wait(650);
      this.fx.orb = null;
    } else {
      this.fx.orb = null;
      this.fx.foeScale = 1;
      this.fx.foeFlash = 0.3;
      audio.sfx('hit');
      await this.wait(280);
    }
  }

  async endBattle() {
    const battle = this.battle;
    const result = this.lastBattleResult || (battle && battle.result) || 'fled';
    const caughtMon = result === 'caught' && battle ? battle.caught : null;
    this.battle = null;
    this.mode = 'world';
    this.fx = this.freshFx();
    this.ui.exitBattle();
    audio.playMusic(this.map ? this.map.music : 'town');
    if (caughtMon) this.registerCatch(caughtMon);
    const wiped = !this.state.party.some(m => m.hp > 0);
    if (result === 'defeat' || (result === 'victory' && wiped)) {
      this.busy = true;
      await this.blackout();
    } else {
      this.busy = false;
      if (result === 'victory') this.save(true);
    }
    this.checkQuests();
    if (this.state) this.ui.refreshMeta(this.state);
    this.refreshHint();
  }

  registerCatch(mon) {
    if (!this.state) return;
    const sp = SPECIES[mon.species];
    this.markCaught(mon.species);
    if (this.state.party.length < 6) {
      this.state.party.push(mon);
      this.ui.toast(`${sp.name} joined your team!`, 'good');
    } else {
      this.state.box.push(mon);
      this.ui.toast(`${sp.name} was sent to storage.`, 'good');
    }
    this.ui.toast(`Index updated: ${sp.name} (#${String(sp.num).padStart(3, '0')})`, 'quest');
    audio.sfx('catch');
    this.checkQuests();
    this.save(true);
  }

  async blackout() {
    await this.fadeTo(1, 420);
    const lost = Math.floor((this.state.player.money || 0) / 2);
    this.state.player.money = Math.max(0, this.state.player.money - lost);
    for (const mon of this.state.party) healFull(mon);
    this.setMap('clinic', 6, 6, 'up');
    this.ui.setMoney(this.state.player.money);
    this.ui.setLocation(this.map.name);
    await this.fadeTo(0, 420);
    await this.ui.say([
      'Everything goes dark... then smells of clean linen and herbal tea.',
      lost > 0
        ? `You lost ${lost}g in the scramble, but your team is safe.`
        : 'Your team is safe. Nurse Petal patched everyone up.',
      'No shame in a retreat. The valley will wait for you.',
    ], 'Nurse Petal');
    this.busy = false;
    this.save(true);
    this.refreshHint();
  }

  // -------------------------------------------------------------- Items / party
  give(itemId, qty = 1) {
    if (!this.state || !ITEMS[itemId]) return;
    this.state.bag[itemId] = (this.state.bag[itemId] || 0) + qty;
    this.ui.toast(`Obtained ${ITEMS[itemId].name} ×${qty}`, 'good');
    audio.sfx('confirm');
  }

  takeItem(itemId, qty = 1) {
    if (!this.state) return false;
    const have = this.state.bag[itemId] || 0;
    if (have < qty) return false;
    this.state.bag[itemId] = have - qty;
    if (this.state.bag[itemId] <= 0) delete this.state.bag[itemId];
    return true;
  }

  countItem(itemId) {
    return (this.state && this.state.bag[itemId]) || 0;
  }

  addMoney(amount) {
    if (!this.state) return;
    this.state.player.money = Math.max(0, (this.state.player.money || 0) + amount);
    this.ui.setMoney(this.state.player.money);
  }

  useItemOutside(itemId, index) {
    if (!this.state) return null;
    const item = ITEMS[itemId];
    const mon = this.state.party[index];
    if (!item || !mon) return null;
    if (item.kind === 'heal') {
      if (mon.hp <= 0) return `${mon.nickname} has fainted — use a Revive Seed.`;
      if (mon.hp >= mon.maxHp) return `${mon.nickname} is already at full HP.`;
      const amount = Math.min(item.heal, mon.maxHp - mon.hp);
      mon.hp += amount;
      this.takeItem(item.id, 1);
      audio.sfx('heal');
      this.save(true);
      return `${mon.nickname} recovered ${amount} HP!`;
    }
    if (item.kind === 'revive') {
      if (mon.hp > 0) return `${mon.nickname} has not fainted.`;
      mon.hp = Math.floor(mon.maxHp / 2);
      mon.status = null;
      this.takeItem(item.id, 1);
      audio.sfx('heal');
      this.save(true);
      return `${mon.nickname} revived with ${mon.hp} HP!`;
    }
    if (item.kind === 'cure') {
      if (!mon.status) return `${mon.nickname} has no status ailment.`;
      if (!item.cures.includes(mon.status.name)) return `${item.name} won't help with that.`;
      mon.status = null;
      this.takeItem(item.id, 1);
      audio.sfx('heal');
      this.save(true);
      return `${mon.nickname} was cured!`;
    }
    return 'That item cannot be used here.';
  }

  makeLead(index) {
    if (!this.state || index <= 0 || index >= this.state.party.length) return;
    const [mon] = this.state.party.splice(index, 1);
    if (!mon) return;
    this.state.party.unshift(mon);
    this.ui.toast(`${mon.nickname} will lead the team.`, 'good');
    audio.sfx('confirm');
  }

  deposit(index) {
    if (!this.state || this.state.party.length <= 1) return;
    const mon = this.state.party[index];
    if (!mon) return;
    this.state.party.splice(index, 1);
    this.state.box.push(mon);
    this.ui.toast(`${mon.nickname} moved to storage.`, '');
  }

  withdraw(index) {
    if (!this.state || this.state.party.length >= 6) return;
    const mon = this.state.box[index];
    if (!mon) return;
    this.state.box.splice(index, 1);
    this.state.party.push(mon);
    this.ui.toast(`${mon.nickname} joined the team.`, 'good');
  }

  buyItem(itemId) {
    const item = ITEMS[itemId];
    if (!item || !this.state) return false;
    if (this.state.player.money < item.price) {
      this.ui.toast('Not enough coin.', 'bad');
      audio.sfx('error');
      return false;
    }
    this.state.player.money -= item.price;
    this.state.bag[item.id] = (this.state.bag[item.id] || 0) + 1;
    this.ui.setMoney(this.state.player.money);
    this.ui.toast(`Bought ${item.name}.`, 'good');
    return true;
  }

  openShop(kind = 'market') {
    this.shopKind = kind;
    this.ui.openShop(this);
  }

  getShopStock() {
    return this.shopKind === 'ember' ? EMBER_SHOP_STOCK : SHOP_STOCK;
  }

  getShopName() {
    return this.shopKind === 'ember' ? 'EMBERHOLD' : 'WILLOWBROOK';
  }

  teamNeedsHealing() {
    if (!this.state) return false;
    return this.state.party.some(m => m.hp < m.maxHp || m.status || m.moves.some(s => s.pp < s.maxPp));
  }

  async healParty() {
    if (!this.state) return;
    for (const mon of this.state.party) healFull(mon);
    audio.sfx('heal');
    this.ui.toast('Your Mythlings are fully healed!', 'good');
    this.save(true);
    this.refreshHint();
  }

  // -------------------------------------------------------------- Menus / save
  openMenu(tab = 'party') {
    if (!this.state || this.mode !== 'world' || this.busy) return;
    if (this.ui.isBlocking()) return;
    this.ui.openMenu(this, tab);
  }

  syncState() {
    if (!this.state) return;
    this.state.player.map = this.mapId || this.state.player.map;
    this.state.player.x = this.player.x;
    this.state.player.y = this.player.y;
    this.state.player.dir = this.player.dir;
    this.state.playtime = (this.state.playtime || 0) + this.playSeconds;
    this.playSeconds = 0;
    this.state.dex.caughtCount = Object.keys(this.state.dex.caught).length;
    this.state.dex.seenCount = Object.keys(this.state.dex.seen).length;
  }

  save(silent = false) {
    if (!this.state) return false;
    this.syncState();
    const res = saveGame(this.state);
    if (!silent) {
      if (res.ok) {
        this.ui.toast('Journey saved.', 'good');
        audio.sfx('save');
      } else {
        this.ui.toast('Could not save. Browser storage may be full.', 'bad');
      }
    }
    return res.ok;
  }

  // -------------------------------------------------------------- Quests
  flag(name) {
    return !!(this.state && this.state.flags[name]);
  }

  setFlag(name, value = true) {
    if (!this.state) return;
    this.state.flags[name] = value;
  }

  questState(id) {
    if (!this.state || !this.state.quests[id]) return 'locked';
    return this.state.quests[id].status;
  }

  startQuest(id) {
    if (!this.state || !QUESTS[id] || this.state.quests[id]) return;
    this.state.quests[id] = { status: 'active' };
    this.ui.toast(`Quest started: ${QUESTS[id].title}`, 'quest');
    audio.sfx('quest');
    this.refreshHint();
  }

  completeQuest(id) {
    if (!this.state) return;
    const q = QUESTS[id];
    if (!q) return;
    if (this.state.quests[id] && this.state.quests[id].status === 'done') return;
    this.state.quests[id] = { status: 'done' };
    if (q.reward) {
      if (q.reward.money) this.addMoney(q.reward.money);
      if (q.reward.items) {
        for (const [item, qty] of Object.entries(q.reward.items)) this.give(item, qty);
      }
    }
    this.ui.toast(`Quest complete: ${q.title}!`, 'quest');
    this.ui.toast(`Reward: ${q.rewardText}`, 'good');
    audio.sfx('quest');
    this.refreshHint();
    this.save(true);
  }

  checkQuests() {
    if (!this.state) return;
    if (this.questState('research') === 'active' && this.caughtCount() >= 3) {
      this.completeQuest('research');
    }
  }

  refreshHint() {
    if (!this.state) return;
    const active = QUEST_ORDER.find(id => this.questState(id) === 'active');
    if (active) {
      const q = QUESTS[active];
      const progress = questProgressLine(active, this.state);
      this.ui.setQuestHint(`QUEST · ${q.title}${progress ? ` — ${progress}` : ''}`);
    } else {
      this.ui.setQuestHint(`INDEX · ${this.caughtCount()}/${SPECIES_LIST.length} Mythlings logged`);
    }
  }

  // -------------------------------------------------------------- New / load / ending
  newGameRequest() {
    this.ui.showStarter((id) => {
      this.startNewGame(id).catch((err) => {
        console.error(err);
        this.ui.toast('Could not start the journey. Please reload.', 'bad');
      });
    });
  }

  newState(starterId) {
    const starter = createCreature(starterId, 5, { origin: 'starter' });
    const sp = SPECIES[starterId];
    return {
      player: { name: 'Rune', map: 'lab', x: 6, y: 6, dir: 'up', money: 500 },
      party: [starter],
      box: [],
      bag: { orb: 5, potion: 2 },
      dex: {
        seen: { [starterId]: true },
        caught: { [starterId]: true },
        caughtCount: 1,
        seenCount: 1,
      },
      quests: {},
      flags: {},
      steps: 0,
      playtime: 0,
      startedAt: Date.now(),
    };
  }

  async startNewGame(starterId) {
    if (!SPECIES[starterId]) return;
    this.state = this.newState(starterId);
    this.fadeAlpha = 1;
    this.ui.hideTitle();
    this.ui.hideStarter();
    this.mode = 'world';
    this.busy = true;
    this.applyStateToWorld();
    audio.playMusic('town');
    this.startQuest('research');
    const sp = SPECIES[starterId];
    await this.fadeTo(0, 320);
    await this.ui.say([
      'Ah! There you are, Rune. Come in, come in — mind the papers.',
      `Professor Linden, at your service. And this little one... ${sp.name} has been waiting all morning.`,
      `${sp.dex} I think you two will get along.`,
      'Take these Capture Orbs and a little coin. Out there are twenty-six Mythlings, and only a handful are documented.',
      'Fill the Index. Learn their names. And Rune — if you meet something in the dark that asks for your name, do not give it.',
    ], 'Prof. Linden');
    await this.ui.say([
      'Your first field task: catch three different Mythlings and log them in the Index.',
      'The tall grass north of town is a good place to start. You can also rest at the Clinic, or shop at the Market.',
      'Press M at any time to see your team, bag, Index, quests and storage.',
    ], 'Prof. Linden');
    this.startQuest('research');
    this.ui.toast('Received 5 Capture Orbs and 500g.', 'good');
    this.busy = false;
    this.save(true);
  }

  continueRequest() {
    const data = loadRawSave();
    if (!data) {
      this.ui.toast('No saved journey yet.', 'bad');
      return;
    }
    try {
      this.state = data.state;
      if (!this.state.dex) this.state.dex = { seen: {}, caught: {}, caughtCount: 0, seenCount: 0 };
      if (!this.state.quests) this.state.quests = {};
      if (!this.state.flags) this.state.flags = {};
      if (!this.state.bag) this.state.bag = {};
      if (!Array.isArray(this.state.box)) this.state.box = [];
      if (!Array.isArray(this.state.party)) throw new Error('Invalid save: no party');
      if (!this.state.party.length) throw new Error('Invalid save: empty party');
      // Saves made before display names were stored still need readable battle text.
      for (const mon of [...this.state.party, ...this.state.box]) {
        if (!mon.name && SPECIES[mon.species]) mon.name = SPECIES[mon.species].name;
      }
      this.state.dex.caughtCount = Object.keys(this.state.dex.caught).length;
      this.state.dex.seenCount = Object.keys(this.state.dex.seen).length;
      this.ui.hideTitle();
      this.mode = 'world';
      this.busy = true;
      this.fadeAlpha = 1;
      this.applyStateToWorld();
      this.fadeTo(0, 300).then(() => { this.busy = false; });
      audio.sfx('save');
      this.ui.toast('Journey loaded. Welcome back!', 'good');
      this.refreshHint();
    } catch (err) {
      console.error(err);
      this.state = null;
      this.mode = 'title';
      this.busy = false;
      this.ui.showTitle(hasSave());
      this.ui.toast('That save could not be loaded.', 'bad');
    }
  }

  applyStateToWorld() {
    if (!this.state) return;
    const p = this.state.player || { map: START_MAP, x: 12, y: 10, dir: 'down' };
    let mapId = START_MAP;
    let map = getMap(START_MAP);
    if (p.map) {
      try {
        map = getMap(p.map);
        mapId = p.map;
      } catch (err) {
        console.warn(`Unknown map in save (${p.map}); returning to Willowbrook.`);
      }
    }
    let x = Number.isFinite(p.x) ? p.x : 12;
    let y = Number.isFinite(p.y) ? p.y : 10;
    if (isBlockedTile(map, x, y) || npcAt(map, x, y, this.state.flags) || objectAt(map, x, y)) {
      const found = this.findFreeTile(map, x, y);
      if (found) { x = found.x; y = found.y; }
    }
    this.mapId = mapId;
    this.map = map;
    this.player = this.blankPlayer(x, y);
    this.player.dir = p.dir || 'down';
    this.ui.setLocation(map.name);
    this.ui.setMoney(this.state.player.money || 0);
    this.ui.refreshMeta(this.state);
    this.ui.setInteractHint('');
    this.lastHint = '';
    audio.playMusic(map.music);
    this.refreshHint();
  }

  async riftEncounter() {
    if (this.state && this.state.dex.caught.voidra) {
      await this.ui.say(['The rift is quiet. Voidra is with you now, somewhere between heartbeats.'], 'Hollow Altar');
      return;
    }
    if (this.state && !this.state.party.some(m => m.hp > 0)) {
      await this.ui.say(['The altar hums, but your team is exhausted. Rest before reaching into the dark.'], 'Hollow Altar');
      return;
    }
    await this.ui.say([
      'The altar is cold, but the air above it breathes.',
      'Something unfolds from the space between one heartbeat and the next: Voidra, the Hollow Star.',
    ], 'Hollow Altar');
    const choice = await this.ui.ask('Reach into the rift?', ['Reach in', 'Step back'], 'Hollow Altar');
    if (choice !== 0) {
      await this.ui.say(['You step back. The rift exhales, disappointed, and folds itself shut.'], '');
      return;
    }
    await this.startWildBattle('voidra', 25);
    if (this.state && this.state.dex.caught.voidra) {
      this.ui.toast('Voidra has joined you. The rift is finally quiet.', 'quest');
    }
  }

  async showEnding() {
    await this.fadeTo(1, 900);
    this.save(true);
    audio.playMusic('victory');
    this.busy = true;
    const lead = this.state.party[0];
    const stats = {
      caught: this.caughtCount(),
      team: this.state.party.map(m => `Lv.${m.level}`).join(' · '),
      playtime: formatTime(this.state.playtime || 0),
      steps: this.state.steps || 0,
      partner: lead ? SPECIES[lead.species].name : '—',
      copy: 'The Hollow Star is quiet, and the valley breathes a little easier. Somewhere below, a shadow says thank you and means it. Your Index is still open — twenty-six pages, and the road goes on.',
    };
    this.ui.showEnding(this.state, stats, {
      continue: () => {
        this.ui.hideEnding();
        this.busy = false;
        this.fadeAlpha = 0;
        this.save(true);
        this.refreshHint();
        audio.playMusic(this.map ? this.map.music : 'town');
      },
      newGame: () => {
        this.ui.hideEnding();
        this.state = null;
        this.battle = null;
        this.map = null;
        this.mapId = null;
        this.mode = 'title';
        this.busy = false;
        this.fadeAlpha = 0;
        this.ui.showTitle(hasSave());
        audio.playMusic('title');
      },
    });
  }
}
