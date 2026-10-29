// DOM-driven interface: dialogue, menus, bestiary, shop, and battle controls.
import { SPECIES, SPECIES_LIST, expNeeded, statusLabel } from './data/species.js';
import { MOVES } from './data/moves.js';
import { ITEMS, ITEM_LIST } from './data/items.js';
import { TYPE_INFO, strongAgainst, weakAgainst } from './data/types.js';
import { QUESTS, QUEST_ORDER, questProgressLine } from './data/quests.js';
import { creatureThumbCanvas } from './engine/art.js';
import { audio } from './engine/audio.js';
import { lastSavedLabel } from './engine/save.js';

const $ = (id) => document.getElementById(id);

function typeChip(type) {
  const info = TYPE_INFO[type] || TYPE_INFO.Neutral;
  return `<span class="type-chip" style="background:${info.color};color:#1b1226">${type}</span>`;
}

function hpPercent(mon) {
  return Math.max(0, Math.min(100, (mon.hp / mon.maxHp) * 100));
}

function hpColor(pct) {
  if (pct > 50) return '#67d98a';
  if (pct > 20) return '#ffc857';
  return '#ff6b6b';
}

function spriteFor(mon) {
  return SPECIES[mon.species];
}

export class UI {
  constructor(game) {
    this.game = game;
    this.touch = !!game.touchMode;
    this.dialogueOpen = false;
    this.modalOpen = false;
    this.titleOpen = true;
    this.starterOpen = false;
    this.endingOpen = false;
    this.dialogueQueue = [];
    this.dialogueResolve = null;
    this.askResolve = null;
    this.typing = false;
    this.choicesActive = false;
    this.fullText = '';
    this.typeTimer = null;
    this.menuTab = 'party';
    this.dexSelected = null;
    this.pendingItem = null;
    this.modalMode = 'menu';
    this.battleActionResolve = null;
    this.forcedSwitchResolve = null;
    this.endingCallbacks = null;

    this.el = {
      canvas: $('gameCanvas'),
      titleScreen: $('titleScreen'),
      starterScreen: $('starterScreen'),
      endingScreen: $('endingScreen'),
      starterCards: $('starterCards'),
      newGameBtn: $('newGameBtn'),
      continueBtn: $('continueBtn'),
      howToBtn: $('howToBtn'),
      menuBtn: $('menuBtn'),
      muteBtn: $('muteBtn'),
      dialogue: $('dialogue'),
      dialogueName: $('dialogueName'),
      dialogueText: $('dialogueText'),
      dialogueChoices: $('dialogueChoices'),
      dialogueHint: $('dialogueHint'),
      toastArea: $('toastArea'),
      worldHud: $('worldHud'),
      mapName: $('mapName'),
      interactHint: $('interactHint'),
      battleHud: $('battleHud'),
      battlePanel: $('battlePanel'),
      battleMessage: $('battleMessage'),
      battleControls: $('battleControls'),
      foeName: $('foeName'),
      foeLevel: $('foeLevel'),
      foeHp: $('foeHp'),
      foeStatus: $('foeStatus'),
      foeTeam: $('foeTeam'),
      allyName: $('allyName'),
      allyLevel: $('allyLevel'),
      allyHp: $('allyHp'),
      allyHpText: $('allyHpText'),
      allyStatus: $('allyStatus'),
      allyExp: $('allyExp'),
      locationName: $('locationName'),
      moneyLabel: $('moneyLabel'),
      questHint: $('questHint'),
      overlay: $('overlay'),
      modal: $('modal'),
      modalTitle: $('modalTitle'),
      modalTabs: $('modalTabs'),
      modalBody: $('modalBody'),
      modalClose: $('modalClose'),
      endingStats: $('endingStats'),
      endingCopy: $('endingCopy'),
      endingContinue: $('endingContinue'),
      endingNew: $('endingNew'),
      touchA: $('touchA'),
      touchB: $('touchB'),
    };

    this.bind();
    this.el.continueBtn.disabled = true;
    if (this.touch) {
      const statusLine = document.getElementById('statusLine');
      if (statusLine) statusLine.textContent = 'D-pad to move · A to interact · B for menu';
      const titleHint = document.querySelector('.title-hint');
      if (titleHint) titleHint.textContent = 'Touch controls appear once your journey begins';
    }
  }

  // -------------------------------------------------------------- Events
  bind() {
    this.el.dialogue.addEventListener('click', (e) => {
      if (e.target.closest('.choice-btn')) return;
      this.advance();
    });
    this.el.newGameBtn.addEventListener('click', () => {
      audio.ensure(); audio.sfx('confirm');
      this.game.newGameRequest();
    });
    this.el.continueBtn.addEventListener('click', () => {
      audio.ensure(); audio.sfx('confirm');
      this.game.continueRequest();
    });
    this.el.howToBtn.addEventListener('click', () => {
      audio.ensure(); audio.sfx('open');
      this.showHowTo();
    });
    this.el.menuBtn.addEventListener('click', () => {
      if (this.dialogueOpen) return;
      this.game.openMenu(this.menuTab || 'party');
    });
    this.el.muteBtn.addEventListener('click', () => {
      const muted = audio.toggleMuted();
      this.el.muteBtn.textContent = muted ? '♪̸' : '♪';
      this.el.muteBtn.title = muted ? 'Sound off' : 'Sound on';
      if (!muted) audio.sfx('select');
    });
    this.el.muteBtn.textContent = audio.muted ? '♪̸' : '♪';
    this.el.modalClose.addEventListener('click', () => this.closeModal());
    this.el.overlay.addEventListener('click', (e) => {
      if (e.target.dataset.close) this.closeModal();
    });
    this.el.endingContinue.addEventListener('click', () => {
      if (this.endingCallbacks) this.endingCallbacks.continue();
    });
    this.el.endingNew.addEventListener('click', () => {
      if (this.endingCallbacks) this.endingCallbacks.newGame();
    });

    window.addEventListener('keydown', (e) => this.onKeyDown(e));

    // touch controls
    const dpadButtons = document.querySelectorAll('.dbtn');
    dpadButtons.forEach(btn => {
      const dir = btn.dataset.dir;
      const down = (ev) => { ev.preventDefault(); btn.setPointerCapture?.(ev.pointerId); this.game.setVirtualDirection(dir, true); };
      const up = (ev) => { ev.preventDefault(); this.game.setVirtualDirection(dir, false); };
      btn.addEventListener('pointerdown', down);
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointercancel', up);
      btn.addEventListener('pointerleave', up);
    });
    this.el.touchA.addEventListener('click', () => {
      if (this.dialogueOpen) { this.advance(); return; }
      if (this.modalOpen) { this.closeModal(); return; }
      this.game.interact();
    });
    this.el.touchB.addEventListener('click', () => {
      if (this.modalOpen) { this.closeModal(); return; }
      if (this.dialogueOpen) { this.advance(); return; }
      this.game.openMenu(this.menuTab || 'party');
    });
  }

  onKeyDown(e) {
    const key = e.code;
    if (this.dialogueOpen) {
      if (key === 'Space' || key === 'Enter' || key === 'KeyZ') {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (this.choicesActive) return;
        this.advance();
        return;
      }
      if (this.choicesActive && /^Digit[1-6]$/.test(key)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        const idx = Number(key.slice(5)) - 1;
        const buttons = this.el.dialogueChoices.querySelectorAll('button');
        if (buttons[idx]) buttons[idx].click();
        return;
      }
      if (key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
    }
    if (this.modalOpen) {
      if (key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        audio.sfx('cancel');
        this.closeModal();
      }
      return;
    }
    if (!this.game || this.game.mode !== 'battle') return;
    if (this.el.battleControls && !this.el.battlePanel.classList.contains('hidden')) {
      if (/^Digit[1-9]$/.test(key)) {
        const idx = Number(key.slice(5)) - 1;
        const buttons = this.el.battleControls.querySelectorAll('button:not(:disabled)');
        if (buttons[idx]) {
          e.preventDefault();
          buttons[idx].click();
        }
      }
    }
  }

  isBlocking() {
    return this.dialogueOpen || this.modalOpen || this.titleOpen || this.starterOpen || this.endingOpen;
  }

  // -------------------------------------------------------------- Dialogue
  say(lines, speaker = '') {
    const list = Array.isArray(lines) ? lines : [lines];
    const filtered = list.filter(l => l !== undefined && l !== null && l !== '');
    return new Promise((resolve) => {
      if (this.dialogueOpen) this.finishDialogue();
      this.dialogueOpen = true;
      this.choicesActive = false;
      this.dialogueQueue = filtered.slice();
      this.dialogueResolve = resolve;
      this.el.dialogueName.textContent = speaker || '';
      this.el.dialogueChoices.innerHTML = '';
      this.el.dialogueHint.style.visibility = 'visible';
      this.el.dialogue.classList.remove('hidden');
      audio.sfx('open');
      this.nextLine();
    });
  }

  nextLine() {
    if (!this.dialogueQueue.length) {
      this.finishDialogue();
      return;
    }
    const text = this.dialogueQueue.shift();
    this.typeText(text);
  }

  typeText(text) {
    clearInterval(this.typeTimer);
    this.fullText = text;
    this.charIndex = 0;
    this.typing = true;
    this.el.dialogueText.textContent = '';
    this.el.dialogueHint.textContent = this.touch ? 'A ▸' : 'SPACE ▸';
    this.typeTimer = setInterval(() => {
      this.charIndex += 2;
      this.el.dialogueText.textContent = text.slice(0, this.charIndex);
      if (this.charIndex >= text.length) {
        clearInterval(this.typeTimer);
        this.typeTimer = null;
        this.typing = false;
        this.el.dialogueText.textContent = text;
      }
    }, 14);
  }

  advance() {
    if (!this.dialogueOpen || this.choicesActive) return;
    if (this.typing) {
      clearInterval(this.typeTimer);
      this.typeTimer = null;
      this.typing = false;
      this.el.dialogueText.textContent = this.fullText;
      audio.sfx('select');
      return;
    }
    if (this.dialogueQueue.length) {
      audio.sfx('select');
      this.nextLine();
    } else {
      this.finishDialogue();
    }
  }

  finishDialogue() {
    clearInterval(this.typeTimer);
    this.typeTimer = null;
    this.typing = false;
    this.dialogueOpen = false;
    this.choicesActive = false;
    this.el.dialogue.classList.add('hidden');
    this.el.dialogueChoices.innerHTML = '';
    this.el.dialogueHint.style.visibility = 'visible';
    const resolve = this.dialogueResolve;
    this.dialogueResolve = null;
    this.game.lastAdvanceAt = performance.now();
    if (resolve) resolve();
  }

  ask(prompt, options, speaker = '') {
    return new Promise((resolve) => {
      if (this.dialogueOpen) this.finishDialogue();
      this.dialogueOpen = true;
      this.typing = false;
      this.choicesActive = true;
      this.askResolve = resolve;
      this.el.dialogueName.textContent = speaker || '';
      this.el.dialogueText.textContent = prompt;
      this.el.dialogueHint.style.visibility = 'hidden';
      this.el.dialogueChoices.innerHTML = '';
      this.el.dialogue.classList.remove('hidden');
      options.forEach((label, i) => {
        const b = document.createElement('button');
        b.className = 'choice-btn';
        b.textContent = label;
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          audio.sfx('confirm');
          this.dialogueOpen = false;
          this.choicesActive = false;
          this.el.dialogue.classList.add('hidden');
          const r = this.askResolve;
          this.askResolve = null;
          this.game.lastAdvanceAt = performance.now();
          if (r) r(i);
        });
        this.el.dialogueChoices.appendChild(b);
      });
      audio.sfx('open');
    });
  }

  // -------------------------------------------------------------- Meta UI
  setLocation(name) {
    this.el.worldHud.classList.remove('hidden');
    this.el.locationName.textContent = name;
    this.el.mapName.textContent = name;
    this.el.mapName.classList.remove('show');
    void this.el.mapName.offsetWidth;
    this.el.mapName.classList.add('show');
    clearTimeout(this.mapTimer);
    this.mapTimer = setTimeout(() => this.el.mapName.classList.remove('show'), 2600);
  }

  setMoney(value) {
    this.el.moneyLabel.textContent = `${value}g`;
  }

  setQuestHint(text) {
    this.el.questHint.textContent = text || '';
    this.el.questHint.title = text || '';
  }

  setInteractHint(text) {
    if (!text) {
      this.el.interactHint.classList.remove('show');
      this.el.interactHint.textContent = '';
      return;
    }
    this.el.interactHint.textContent = text;
    this.el.interactHint.classList.add('show');
  }

  toast(text, tone = '') {
    if (!text) return;
    const el = document.createElement('div');
    el.className = `toast ${tone}`.trim();
    el.textContent = text;
    this.el.toastArea.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transition = 'opacity 0.3s';
      setTimeout(() => el.remove(), 320);
    }, 3000);
    while (this.el.toastArea.children.length > 4) this.el.toastArea.firstChild.remove();
  }

  showTitle(hasSave) {
    this.titleOpen = true;
    this.el.titleScreen.classList.remove('hidden');
    this.el.starterScreen.classList.add('hidden');
    this.el.continueBtn.disabled = !hasSave;
  }

  hideTitle() {
    this.titleOpen = false;
    this.el.titleScreen.classList.add('hidden');
  }

  showStarter(callback) {
    this.titleOpen = false;
    this.starterOpen = true;
    this.el.titleScreen.classList.add('hidden');
    this.el.starterScreen.classList.remove('hidden');
    this.el.starterCards.innerHTML = '';
    const picks = ['cindit', 'dewfin', 'spriglin'];
    let chosen = false;
    for (const id of picks) {
      const sp = SPECIES[id];
      const card = document.createElement('div');
      card.className = 'starter-card';
      const stats = sp.base;
      card.innerHTML = `
        <canvas></canvas>
        <h3>${sp.name}</h3>
        <div class="starter-type">${typeChip(sp.type)}</div>
        <div class="starter-desc">${sp.dex}</div>
        <div class="starter-stats"><span>HP ${stats.hp}</span><span>ATK ${stats.atk}</span><span>SPD ${stats.spd}</span></div>
        <button class="menu-btn primary">CHOOSE</button>
      `;
      const thumb = creatureThumbCanvas(sp, 3, 0);
      const c = card.querySelector('canvas');
      c.replaceWith(thumb);
      const choose = () => {
        if (chosen) return;
        chosen = true;
        audio.sfx('confirm');
        this.starterOpen = false;
        this.el.starterScreen.classList.add('hidden');
        callback(id);
      };
      card.querySelector('button').addEventListener('click', (e) => {
        e.stopPropagation();
        choose();
      });
      card.addEventListener('click', (e) => {
        if (!e.target.closest('button')) choose();
      });
      this.el.starterCards.appendChild(card);
    }
  }

  hideStarter() {
    this.starterOpen = false;
    this.el.starterScreen.classList.add('hidden');
  }

  showEnding(state, stats, callbacks) {
    this.endingOpen = true;
    this.endingCallbacks = callbacks;
    this.el.endingScreen.classList.remove('hidden');
    this.el.endingCopy.textContent = stats.copy;
    this.el.endingStats.innerHTML = [
      ['Mythlings caught', `${stats.caught} / ${SPECIES_LIST.length}`],
      ['Team levels', stats.team],
      ['Journey time', stats.playtime],
      ['Steps taken', stats.steps],
      ['Coin', `${state.player.money}g`],
      ['Final partner', stats.partner],
    ].map(([k, v]) => `<div class="ending-stat"><span>${k}</span><b>${v}</b></div>`).join('');
  }

  hideEnding() {
    this.endingOpen = false;
    this.el.endingScreen.classList.add('hidden');
  }

  showHowTo() {
    this.openModalShell('HOW TO PLAY', 'help');
    const body = this.el.modalBody;
    body.innerHTML = `
      <div class="hint-strip">Mythlings is a turn-based creature-collecting RPG. Explore the valley, catch wild Mythlings and raise a team of six.</div>
      <p class="section-title">CONTROLS</p>
      <div class="controls-list">
        <b>WASD / ARROWS</b><span>Walk around the overworld</span>
        <b>SPACE / ENTER</b><span>Talk, read signs, advance dialogue</span>
        <b>M / X</b><span>Open your journey menu</span>
        <b>ESC</b><span>Close menus</span>
        <b>1–4</b><span>Pick a battle action or move</span>
        ${this.touch ? '<b>TOUCH</b><span>D-pad to move · A to interact · B for menu</span>' : ''}
      </div>
      <p class="section-title" style="margin-top:16px">BATTLES</p>
      <div class="hint-strip">Pick FIGHT to attack, BAG to use an orb or potion, PARTY to switch, RUN to escape (not in trainer battles). Weaken a wild Mythling and lower its HP to improve your Capture Orb odds.</div>
      <p class="section-title">TYPE MATCHUPS</p>
      <div class="type-table">
        ${['Fire', 'Water', 'Grass', 'Electric', 'Shadow'].map(t => `
          <div class="type-row">
            ${typeChip(t)}
            <span>strong vs ${strongAgainst(t).map(x => TYPE_INFO[x] ? x : x).join(', ') || '—'}</span>
            <span style="color:#8b7aa6">· weak to ${weakAgainst(t).join(', ')}</span>
          </div>`).join('')}
      </div>
      <p class="section-title" style="margin-top:16px">YOUR JOURNEY</p>
      <div class="hint-strip">The clinic heals your team for free and saves your journey. Shops sell orbs and potions. Professor Linden's Index tracks all 26 Mythlings. Three bosses stand between you and the Hollow Star.</div>
      <div style="margin-top:14px"><button class="menu-btn primary" id="helpClose">GOT IT</button></div>
    `;
    $('helpClose').addEventListener('click', () => this.closeModal());
  }

  // -------------------------------------------------------------- Modal shell
  openModalShell(title, mode = 'menu') {
    this.modalOpen = true;
    this.modalMode = mode;
    this.el.overlay.classList.remove('hidden');
    this.el.modalTitle.textContent = title;
    this.el.modalTabs.classList.toggle('hidden', mode !== 'menu');
    this.el.modalBody.scrollTop = 0;
    audio.sfx('open');
  }

  closeModal() {
    this.modalOpen = false;
    this.pendingItem = null;
    this.el.overlay.classList.add('hidden');
    if (this.modalMode === 'shop') {
      this.modalMode = 'menu';
    }
    if (this.forcedSwitchResolve) {
      const r = this.forcedSwitchResolve;
      this.forcedSwitchResolve = null;
      r(null);
    }
    this.game.lastMenuCloseAt = performance.now();
  }

  openMenu(game, tab = 'party') {
    if (!game.state) return;
    this.menuTab = tab || 'party';
    this.pendingItem = null;
    this.openModalShell('JOURNEY', 'menu');
    this.renderMenu(game);
  }

  renderMenu(game) {
    const tabs = [
      ['party', 'PARTY'], ['bag', 'BAG'], ['dex', 'INDEX'],
      ['quests', 'QUESTS'], ['box', 'STORAGE'], ['save', 'SAVE'],
    ];
    this.el.modalTabs.innerHTML = '';
    for (const [id, label] of tabs) {
      const b = document.createElement('button');
      b.className = `tab-btn ${this.menuTab === id ? 'active' : ''}`;
      b.textContent = label;
      b.addEventListener('click', () => {
        audio.sfx('select');
        this.menuTab = id;
        this.pendingItem = null;
        this.renderMenu(game);
      });
      this.el.modalTabs.appendChild(b);
    }
    this.renderMenuBody(game);
  }

  renderMenuBody(game) {
    const body = this.el.modalBody;
    body.innerHTML = '';
    if (this.menuTab === 'party') this.renderPartyTab(game, body);
    else if (this.menuTab === 'bag') this.renderBagTab(game, body);
    else if (this.menuTab === 'dex') this.renderDexTab(game, body);
    else if (this.menuTab === 'quests') this.renderQuestsTab(game, body);
    else if (this.menuTab === 'box') this.renderBoxTab(game, body);
    else if (this.menuTab === 'save') this.renderSaveTab(game, body);
  }

  renderPartyTab(game, body) {
    const state = game.state;
    const wrap = document.createElement('div');
    wrap.innerHTML = `<div class="column-header"><p class="section-title" style="margin:0">YOUR TEAM · ${state.party.length}/6</p><span class="dex-counter">${statusSummary(state)}</span></div>`;
    if (!state.party.length) {
      wrap.innerHTML += '<p class="empty-note">You have no Mythlings. Find the Professor!</p>';
      body.appendChild(wrap);
      return;
    }
    const grid = document.createElement('div');
    grid.className = 'party-grid';
    state.party.forEach((mon, idx) => {
      const sp = spriteFor(mon);
      const pct = hpPercent(mon);
      const card = document.createElement('div');
      card.className = `party-card ${mon.hp <= 0 ? 'fainted' : ''} ${idx === 0 ? 'lead' : ''}`;
      card.innerHTML = `
        <div>
          <div class="pc-name"><span>${mon.nickname}</span><span style="color:#ffd166">Lv.${mon.level}</span></div>
          <div class="pc-meta">${typeChip(sp.type)}${mon.status ? `<span class="status-badge ${statusLabel(mon)}">${statusLabel(mon)}</span>` : ''}<span>${Math.max(0, mon.hp)}/${mon.maxHp} HP</span></div>
          <div class="hp-track"><div class="hp-fill" style="width:${pct}%;background:${hpColor(pct)}"></div></div>
          <div class="pc-actions"></div>
        </div>
        <div class="moves"></div>
      `;
      const canvas = creatureThumbCanvas(sp, 1.6, idx % 4);
      card.insertBefore(canvas, card.firstChild);
      const actions = card.querySelector('.pc-actions');
      if (idx !== 0) {
        const leadBtn = document.createElement('button');
        leadBtn.className = 'mini-btn gold';
        leadBtn.textContent = 'MAKE LEAD';
        leadBtn.disabled = mon.hp <= 0;
        leadBtn.addEventListener('click', () => {
          game.makeLead(idx);
          this.renderMenu(game);
        });
        actions.appendChild(leadBtn);
      }
      const moves = card.querySelector('.moves');
      for (const slot of mon.moves) {
        const mv = MOVES[slot.id];
        if (!mv) continue;
        const pill = document.createElement('span');
        pill.className = 'move-pill';
        pill.innerHTML = `<b>${mv.name}</b> ${typeChip(mv.type)} <span class="pp">${slot.pp}/${slot.maxPp}</span>`;
        moves.appendChild(pill);
      }
      grid.appendChild(card);
    });
    wrap.appendChild(grid);
    body.appendChild(wrap);
  }

  renderBagTab(game, body) {
    const state = game.state;
    const held = ITEM_LIST.filter(i => (state.bag[i.id] || 0) > 0);
    const wrapper = document.createElement('div');
    const balance = `<div class="column-header"><p class="section-title" style="margin:0">BAG</p><span class="dex-counter">${state.player.money}g</span></div>`;
    wrapper.innerHTML = balance;
    const note = document.createElement('div');
    note.className = 'hint-strip';
    note.textContent = this.pendingItem
      ? 'Choose a Mythling to use this item on.'
      : 'Capture Orbs can only be thrown in battle. Potions, tonics and Revive Seeds work anywhere.';
    wrapper.appendChild(note);
    if (this.pendingItem) {
      const item = ITEMS[this.pendingItem];
      const list = document.createElement('div');
      list.className = 'bag-list';
      state.party.forEach((mon, idx) => {
        const row = document.createElement('div');
        row.className = 'bag-row';
        row.innerHTML = `
          <div>
            <div class="bag-name">${mon.nickname} <span style="color:#8b7aa6">Lv.${mon.level}</span></div>
            <div class="bag-desc">${Math.max(0, mon.hp)}/${mon.maxHp} HP · ${mon.status ? mon.status.name : 'healthy'}</div>
          </div>
          <button class="mini-btn teal">USE ${item.name.toUpperCase()}</button>
        `;
        const btn = row.querySelector('button');
        btn.disabled = mon.hp <= 0 && item.kind !== 'revive';
        btn.addEventListener('click', () => {
          const msg = game.useItemOutside(item.id, idx);
          if (msg) {
            this.toast(msg, 'good');
            this.pendingItem = null;
            this.renderMenu(game);
          }
        });
        list.appendChild(row);
      });
      const back = document.createElement('button');
      back.className = 'mini-btn';
      back.textContent = '← BACK TO BAG';
      back.style.marginTop = '8px';
      back.addEventListener('click', () => { this.pendingItem = null; this.renderMenu(game); });
      wrapper.appendChild(list);
      wrapper.appendChild(back);
    } else if (!held.length) {
      const p = document.createElement('p');
      p.className = 'empty-note';
      p.textContent = 'Your bag is empty. Visit a market, or find supplies on the road.';
      wrapper.appendChild(p);
    } else {
      const list = document.createElement('div');
      list.className = 'bag-list';
      for (const item of held) {
        const row = document.createElement('div');
        row.className = 'bag-row';
        row.innerHTML = `
          <div>
            <div class="bag-name">${item.name} <span style="color:#8b7aa6;font-size:9px">${item.kind === 'orb' ? `catch ×${item.orbMult}` : item.kind}</span></div>
            <div class="bag-desc">${item.desc}</div>
          </div>
          <div class="bag-right"><span class="bag-count">×${state.bag[item.id]}</span></div>
        `;
        const right = row.querySelector('.bag-right');
        if (item.kind !== 'orb' && item.kind !== 'quest') {
          const use = document.createElement('button');
          use.className = 'mini-btn teal';
          use.textContent = 'USE';
          use.addEventListener('click', () => {
            this.pendingItem = item.id;
            this.renderMenu(game);
          });
          right.appendChild(use);
        }
        list.appendChild(row);
      }
      wrapper.appendChild(list);
    }
    body.appendChild(wrapper);
  }

  renderDexTab(game, body) {
    const state = game.state;
    const caughtCount = Object.keys(state.dex.caught).length;
    const seenCount = Object.keys(state.dex.seen).length;
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div class="column-header">
        <p class="section-title" style="margin:0">THE MYTHLING INDEX</p>
        <span class="dex-counter">CAUGHT ${caughtCount}/${SPECIES_LIST.length} · SEEN ${seenCount}</span>
      </div>
    `;
    const grid = document.createElement('div');
    grid.className = 'dex-grid';
    for (const sp of SPECIES_LIST) {
      const seen = !!state.dex.seen[sp.id];
      const caught = !!state.dex.caught[sp.id];
      if (!this.dexSelected) this.dexSelected = sp.id;
      const cell = document.createElement('div');
      cell.className = `dex-cell ${caught ? '' : seen ? 'seen' : 'locked'} ${this.dexSelected === sp.id ? 'selected' : ''}`;
      const num = document.createElement('span');
      num.className = 'dex-num';
      num.textContent = seen ? `#${String(sp.num).padStart(3, '0')}` : '#???';
      cell.appendChild(num);
      if (seen) {
        const c = creatureThumbCanvas(sp, 1.25, 0);
        cell.appendChild(c);
      } else {
        const mystery = document.createElement('div');
        mystery.className = 'dex-mystery';
        mystery.textContent = '?';
        cell.appendChild(mystery);
      }
      const nm = document.createElement('span');
      nm.className = 'dex-name';
      nm.textContent = caught ? sp.name : seen ? sp.name : '???';
      cell.appendChild(nm);
      cell.addEventListener('click', () => {
        if (!seen) return;
        this.dexSelected = sp.id;
        this.renderMenu(game);
      });
      grid.appendChild(cell);
    }
    wrap.appendChild(grid);
    const sel = SPECIES[this.dexSelected];
    if (sel && state.dex.seen[sel.id]) {
      const detail = document.createElement('div');
      detail.className = 'dex-detail';
      const caught = !!state.dex.caught[sel.id];
      const evo = sel.evolve ? `Evolves into ${SPECIES[sel.evolve.to].name} at Lv.${sel.evolve.level}` : 'Final form';
      detail.innerHTML = `
        <canvas></canvas>
        <div>
          <h3>${caught ? sel.name : '???'} <span style="font-size:9px;color:#8b7aa6">#${String(sel.num).padStart(3, '0')}</span></h3>
          <div>${typeChip(sel.type)} <span style="font-size:9px;color:#9f8fb8">${sel.habitat}</span></div>
          <p class="dex-flavor">${caught ? sel.dex : 'Catch this Mythling to complete its Index entry.'}</p>
          <div class="dex-stats">
            <div class="stat-box"><span>HP</span><b>${sel.base.hp}</b></div>
            <div class="stat-box"><span>ATK</span><b>${sel.base.atk}</b></div>
            <div class="stat-box"><span>DEF</span><b>${sel.base.def}</b></div>
            <div class="stat-box"><span>SPD</span><b>${sel.base.spd}</b></div>
          </div>
          <div class="dex-evo">${evo} · strong vs ${strongAgainst(sel.type).join(', ') || '—'} · weak to ${weakAgainst(sel.type).join(', ')}</div>
        </div>
      `;
      const c = creatureThumbCanvas(sel, 2.5, 0);
      detail.querySelector('canvas').replaceWith(c);
      wrap.appendChild(detail);
    }
    body.appendChild(wrap);
  }

  renderQuestsTab(game, body) {
    const state = game.state;
    const wrap = document.createElement('div');
    wrap.innerHTML = '<div class="hint-strip">Quests are logged automatically. Progress updates as you explore, catch and battle.</div>';
    const list = document.createElement('div');
    list.className = 'quest-list';
    for (const id of QUEST_ORDER) {
      const q = QUESTS[id];
      const status = state.quests[id] ? state.quests[id].status : 'locked';
      const card = document.createElement('div');
      card.className = `quest-card ${status}`;
      const progress = status === 'active' ? questProgressLine(id, state) : null;
      card.innerHTML = `
        <div class="quest-top">
          <span class="quest-title">${q.title}</span>
          <span class="quest-status ${status}">${status === 'active' ? 'ACTIVE' : status === 'done' ? 'COMPLETE' : 'NOT STARTED'}</span>
        </div>
        <div class="quest-desc">${status === 'locked' ? 'Talk to someone in the valley to begin this thread.' : q.desc}</div>
        ${progress ? `<div class="quest-line">${progress}</div>` : ''}
        ${status === 'done' ? '<div class="quest-line">✓ Complete</div>' : `<div class="quest-reward">Reward: ${q.rewardText}</div>`}
      `;
      list.appendChild(card);
    }
    wrap.appendChild(list);
    body.appendChild(wrap);
  }

  renderBoxTab(game, body) {
    const state = game.state;
    const wrap = document.createElement('div');
    wrap.innerHTML = '<div class="hint-strip">Caught Mythlings join your team while there is room. Extra friends rest safely in storage and can be swapped in at any time.</div>';
    const boxTitle = document.createElement('p');
    boxTitle.className = 'section-title';
    boxTitle.textContent = `STORAGE · ${state.box.length}`;
    wrap.appendChild(boxTitle);
    if (!state.box.length) {
      const p = document.createElement('p');
      p.className = 'empty-note';
      p.textContent = 'Storage is empty.';
      wrap.appendChild(p);
    } else {
      const grid = document.createElement('div');
      grid.className = 'storage-grid';
      state.box.forEach((mon, idx) => {
        const sp = spriteFor(mon);
        const card = document.createElement('div');
        card.className = 'storage-card';
        const c = creatureThumbCanvas(sp, 1, 0);
        card.appendChild(c);
        card.insertAdjacentHTML('beforeend', `<div class="sc-name">${mon.nickname}</div><div class="sc-lvl">Lv.${mon.level} ${typeChip(sp.type)}</div>`);
        const btn = document.createElement('button');
        btn.className = 'mini-btn teal';
        btn.textContent = 'WITHDRAW';
        btn.disabled = state.party.length >= 6;
        btn.addEventListener('click', () => {
          game.withdraw(idx);
          this.renderMenu(game);
        });
        card.appendChild(btn);
        grid.appendChild(card);
      });
      wrap.appendChild(grid);
    }
    const partyTitle = document.createElement('p');
    partyTitle.className = 'section-title';
    partyTitle.style.marginTop = '14px';
    partyTitle.textContent = `TEAM · ${state.party.length}/6`;
    wrap.appendChild(partyTitle);
    const list = document.createElement('div');
    list.className = 'bag-list';
    state.party.forEach((mon, idx) => {
      const row = document.createElement('div');
      row.className = 'bag-row';
      row.innerHTML = `
        <div>
          <div class="bag-name">${mon.nickname} <span style="color:#8b7aa6">Lv.${mon.level}</span></div>
          <div class="bag-desc">${Math.max(0, mon.hp)}/${mon.maxHp} HP · ${spriteFor(mon).name}</div>
        </div>
      `;
      const right = document.createElement('div');
      right.className = 'bag-right';
      const btn = document.createElement('button');
      btn.className = 'mini-btn';
      btn.textContent = 'DEPOSIT';
      btn.disabled = state.party.length <= 1;
      btn.addEventListener('click', () => {
        game.deposit(idx);
        this.renderMenu(game);
      });
      right.appendChild(btn);
      row.appendChild(right);
      list.appendChild(row);
    });
    wrap.appendChild(list);
    body.appendChild(wrap);
  }

  renderSaveTab(game, body) {
    const state = game.state;
    const wrap = document.createElement('div');
    wrap.className = 'save-panel';
    wrap.innerHTML = `
      <div class="hint-strip">Saving stores your team, bag, quests, flags and position in this browser. Automatic saves also happen at clinics and after big wins.</div>
      <div class="save-meta">
        <div>Journey time: <b style="color:#ffd166">${formatTime(state.playtime || 0)}</b></div>
        <div>Steps taken: <b style="color:#ffd166">${state.steps || 0}</b></div>
        <div>Coin: <b style="color:#ffd166">${state.player.money}g</b></div>
        <div>${lastSavedLabel()}</div>
      </div>
      <div><button class="menu-btn primary" id="saveNow">SAVE JOURNEY</button></div>
      <div class="hint-strip" style="border-color:#6b5a86">Controls: WASD/arrows to move · SPACE to interact · M for menu</div>
    `;
    wrap.querySelector('#saveNow').addEventListener('click', () => {
      game.save();
      this.renderMenu(game);
    });
    body.appendChild(wrap);
  }

  // -------------------------------------------------------------- Shop
  openShop(game) {
    if (!game.state) return;
    this.openModalShell(`${game.getShopName()} · BAZAAR`, 'shop');
    this.el.modalTabs.classList.add('hidden');
    this.renderShopBody(game);
  }

  renderShopBody(game) {
    const state = game.state;
    const stock = game.getShopStock();
    const body = this.el.modalBody;
    body.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.innerHTML = `<div class="shop-balance">YOUR COIN: ${state.player.money}g</div>`;
    for (const id of stock) {
      const item = ITEMS[id];
      if (!item) continue;
      const row = document.createElement('div');
      row.className = 'shop-row';
      row.innerHTML = `
        <div>
          <div class="bag-name">${item.name} <span style="color:#8b7aa6;font-size:9px">${item.kind === 'orb' ? `catch ×${item.orbMult}` : item.kind}</span></div>
          <div class="bag-desc">${item.desc}</div>
        </div>
        <span class="price">${item.price}g</span>
      `;
      const btn = document.createElement('button');
      btn.className = 'mini-btn gold';
      btn.textContent = 'BUY';
      btn.disabled = state.player.money < item.price;
      btn.addEventListener('click', () => {
        if (game.buyItem(item.id)) {
          audio.sfx('confirm');
          this.renderShopBody(game);
        }
      });
      row.appendChild(btn);
      wrap.appendChild(row);
    }
    const own = ITEM_LIST.filter(i => (state.bag[i.id] || 0) > 0 && !stock.includes(i.id));
    if (own.length) {
      wrap.insertAdjacentHTML('beforeend', `<p class="empty-note" style="margin-top:10px">Also in your bag: ${own.map(i => `${i.name} ×${state.bag[i.id]}`).join(', ')}</p>`);
    }
    body.appendChild(wrap);
  }

  // -------------------------------------------------------------- Battle UI
  enterBattle() {
    this.el.worldHud.classList.add('hidden');
    this.el.battleHud.classList.remove('hidden');
    this.el.battlePanel.classList.remove('hidden');
    this.el.canvas.closest('.screen-frame')?.classList.add('battle-mode');
    this.el.dialogue.classList.add('hidden');
    this.el.battleControls.innerHTML = '';
    this.el.battleControls.classList.add('empty');
    this.setBattleMessage('The air crackles with anticipation...');
    if (typeof this.el.battlePanel.scrollIntoView === 'function') {
      this.el.battlePanel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  exitBattle() {
    this.el.battleHud.classList.add('hidden');
    this.el.battlePanel.classList.add('hidden');
    this.el.canvas.closest('.screen-frame')?.classList.remove('battle-mode');
    this.el.battleControls.innerHTML = '';
    this.el.battleControls.classList.remove('empty');
    this.el.worldHud.classList.remove('hidden');
    this.battleActionResolve = null;
  }

  setBattleMessage(text) {
    this.el.battleMessage.textContent = text;
  }

  syncBattle(battle) {
    if (!battle) return;
    const foe = battle.foeMon;
    const ally = battle.mon;
    if (foe) {
      const sp = SPECIES[foe.species];
      this.el.foeName.textContent = foe.name || sp.name;
      this.el.foeLevel.textContent = `Lv.${foe.level}`;
      const pct = hpPercent(foe);
      this.el.foeHp.style.width = `${pct}%`;
      this.el.foeHp.style.background = hpColor(pct);
      this.el.foeStatus.innerHTML = foe.status ? `<span class="status-badge ${statusLabel(foe)}">${statusLabel(foe)}</span>` : '';
      this.el.foeTeam.textContent = battle.isTrainer ? `${battle.foeRemaining} left` : (sp ? sp.habitat : '');
    }
    if (ally) {
      const sp = SPECIES[ally.species];
      this.el.allyName.textContent = ally.nickname;
      this.el.allyLevel.textContent = `Lv.${ally.level}`;
      const pct = hpPercent(ally);
      this.el.allyHp.style.width = `${pct}%`;
      this.el.allyHp.style.background = hpColor(pct);
      this.el.allyHpText.textContent = `${Math.max(0, ally.hp)}/${ally.maxHp}`;
      this.el.allyStatus.innerHTML = ally.status ? `<span class="status-badge ${statusLabel(ally)}">${statusLabel(ally)}</span>` : (sp ? typeChip(sp.type) : '');
      const req = expNeeded(ally.level) || 1;
      const expPct = Math.min(100, (ally.exp / req) * 100);
      this.el.allyExp.style.width = `${expPct}%`;
    }
  }

  battleControls(buttons, mode = '') {
    const wrap = this.el.battleControls;
    wrap.innerHTML = '';
    wrap.classList.toggle('empty', !buttons.length);
    wrap.classList.toggle('move-grid', mode === 'moves');
    buttons.forEach((def) => {
      const btn = document.createElement('button');
      btn.className = `action-btn ${def.className || ''}`.trim();
      btn.disabled = !!def.disabled;
      btn.innerHTML = `
        <span class="label">${def.label}</span>
        ${def.sub ? `<span class="sub">${def.sub}</span>` : ''}
        ${def.chip ? typeChip(def.chip) : ''}
      `;
      btn.addEventListener('click', () => {
        audio.sfx('select');
        def.action();
      });
      wrap.appendChild(btn);
    });
  }

  battleCommand(battle) {
    return new Promise((resolve) => {
      this.battleActionResolve = resolve;
      this.showMainCommands(battle);
    });
  }

  resolveAction(action) {
    const r = this.battleActionResolve;
    this.battleActionResolve = null;
    this.battleControls([], '');
    if (r) r(action);
  }

  showMainCommands(battle) {
    this.setBattleMessage('What will you do?');
    this.battleControls([
      { label: 'FIGHT', sub: 'Choose a move', action: () => this.showMoves(battle) },
      { label: 'BAG', sub: 'Orbs & potions', action: () => this.showBattleBag(battle) },
      { label: 'PARTY', sub: 'Switch partner', action: () => this.showBattleParty(battle) },
      {
        label: 'RUN',
        sub: battle.isTrainer ? 'No escape' : 'Try to flee',
        disabled: battle.isTrainer,
        className: 'back',
        action: () => this.resolveAction({ type: 'run' }),
      },
    ]);
  }

  showMoves(battle) {
    const mon = battle.mon;
    const buttons = mon.moves.map((slot, idx) => {
      const mv = MOVES[slot.id];
      return {
        label: mv.name,
        sub: `${slot.pp}/${slot.maxPp} PP · ${mv.power ? `PWR ${mv.power}` : 'status'}`,
        chip: mv.type,
        disabled: slot.pp <= 0,
        action: () => this.resolveAction({ type: 'move', index: idx }),
      };
    });
    if (mon.moves.every(m => m.pp <= 0)) {
      buttons.length = 0;
      buttons.push({
        label: 'STRUGGLE',
        sub: 'Out of PP',
        disabled: false,
        action: () => this.resolveAction({ type: 'move', index: 0 }),
      });
    }
    buttons.push({ label: 'BACK', sub: 'Command menu', className: 'back', action: () => this.showMainCommands(battle) });
    this.setBattleMessage(`${mon.nickname}'s moves — choose carefully.`);
    this.battleControls(buttons, 'moves');
  }

  showBattleBag(battle) {
    const game = this.game;
    const items = ITEM_LIST.filter(i => (battle.bag[i.id] || 0) > 0);
    const buttons = [];
    for (const item of items) {
      if (!['orb', 'heal', 'cure', 'revive'].includes(item.kind)) continue;
      if (item.kind === 'orb' && battle.isTrainer) continue;
      if (item.kind === 'heal' && battle.mon.hp >= battle.mon.maxHp) continue;
      if (item.kind === 'revive' && battle.mon.hp > 0) continue;
      if (item.kind === 'cure' && !battle.mon.status) continue;
      buttons.push({
        label: item.name,
        sub: `×${battle.bag[item.id]}${item.kind === 'orb' ? ` · catch ×${item.orbMult}` : ''}`,
        action: () => this.resolveAction({ type: 'item', itemId: item.id }),
      });
    }
    if (!buttons.length) {
      this.setBattleMessage('Your bag has nothing useful right now.');
    } else {
      this.setBattleMessage('Use an item. Using one takes your turn.');
    }
    buttons.push({ label: 'BACK', sub: 'Command menu', className: 'back', action: () => this.showMainCommands(battle) });
    this.battleControls(buttons);
  }

  showBattleParty(battle) {
    const buttons = [];
    this.game.state.party.forEach((mon, idx) => {
      if (idx === battle.active) return;
      const sp = SPECIES[mon.species];
      buttons.push({
        label: mon.nickname,
        sub: `Lv.${mon.level} · ${Math.max(0, mon.hp)}/${mon.maxHp} HP`,
        chip: sp ? sp.type : null,
        disabled: mon.hp <= 0,
        action: () => this.resolveAction({ type: 'switch', index: idx }),
      });
    });
    if (!buttons.length) {
      this.setBattleMessage('You have no other Mythlings ready.');
    } else {
      this.setBattleMessage('Send out which Mythling?');
    }
    buttons.push({ label: 'BACK', sub: 'Command menu', className: 'back', action: () => this.showMainCommands(battle) });
    this.battleControls(buttons);
  }

  choosePartyForSwitch(battle) {
    return new Promise((resolve) => {
      this.forcedSwitchResolve = resolve;
      const buttons = [];
      this.game.state.party.forEach((mon, idx) => {
        if (mon.hp <= 0) return;
        const sp = SPECIES[mon.species];
        buttons.push({
          label: mon.nickname,
          sub: `Lv.${mon.level} · ${mon.hp}/${mon.maxHp} HP`,
          chip: sp ? sp.type : null,
          disabled: idx === battle.active,
          action: () => {
            const r = this.forcedSwitchResolve;
            this.forcedSwitchResolve = null;
            this.battleControls([], '');
            if (r) r(idx);
          },
        });
      });
      this.setBattleMessage('Send out your next Mythling!');
      this.battleControls(buttons);
    });
  }

  // -------------------------------------------------------------- Helpers
  refreshMeta(state) {
    if (!state) return;
    this.setMoney(state.player.money);
  }
}

function statusSummary(state) {
  const caught = Object.keys(state.dex.caught).length;
  return `INDEX ${caught}/${SPECIES_LIST.length}`;
}

export function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s % 60}s`;
}
