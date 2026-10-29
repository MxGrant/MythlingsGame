// Turn-based battle engine. Pure logic: the UI drives it and animates the events.
import { MOVES, getMove, STRUGGLE } from '../data/moves.js';
import { typeMultiplier, effectivenessText } from '../data/types.js';
import {
  SPECIES, expNeeded, expYield, refreshStats, evolveCreature, learnMove,
} from '../data/species.js';
import { ITEMS } from '../data/items.js';

const STAGE_MULT = { '-2': 0.5, '-1': 0.67, '0': 1, '1': 1.5, '2': 2 };
function stageMult(stage) {
  return STAGE_MULT[String(Math.max(-2, Math.min(2, stage || 0)))] || 1;
}

function msg(text) { return { t: 'msg', text }; }

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

export function calcDamage(attacker, defender, move, rng = Math.random) {
  const atkSp = SPECIES[attacker.species];
  const defSp = SPECIES[defender.species];
  if (!atkSp || !defSp) return { damage: 0, crit: false, eff: 1, stab: 1 };
  let atk = attacker.atk * stageMult(attacker.stages && attacker.stages.atk);
  if (attacker.status && attacker.status.name === 'burn') atk *= 0.75;
  const def = Math.max(1, defender.def * stageMult(defender.stages && defender.stages.def));
  const eff = typeMultiplier(move.type, [defSp.type]);
  if (eff === 0 || !move.power) return { damage: 0, crit: false, eff, stab: 1 };
  const base = Math.floor(Math.floor((2 * attacker.level / 5 + 2) * move.power * Math.max(1, atk) / def) / 50) + 2;
  const stab = move.type === atkSp.type ? 1.2 : 1;
  const crit = rng() < 0.06;
  const rand = 0.85 + rng() * 0.15;
  const raw = base * stab * eff * (crit ? 1.5 : 1) * rand;
  return { damage: Math.max(1, Math.floor(raw)), crit, eff, stab };
}

export function captureChance(foe, orbId, rng = Math.random) {
  const sp = SPECIES[foe.species];
  const orb = ITEMS[orbId];
  const hpFactor = (3 * foe.maxHp - 2 * foe.hp) / (3 * foe.maxHp);
  const statusBonus = foe.status ? 1.5 : 1;
  const chance = (sp.catchRate / 255) * hpFactor * (orb && orb.orbMult ? orb.orbMult : 1) * statusBonus;
  return clamp(chance, 0.02, 0.97);
}

export class Battle {
  constructor({ party, bag, foe, trainer = null, rng = Math.random }) {
    this.party = party;
    this.bag = bag;
    this.trainer = trainer;
    this.foeTeam = trainer ? trainer.team : [foe];
    this.foeIndex = 0;
    this.active = party.findIndex(m => m.hp > 0);
    if (this.active < 0) this.active = 0;
    this.rng = rng;
    this.turn = 0;
    this.ended = false;
    this.result = null;
    this.escapeAttempts = 0;
  }

  get mon() { return this.party[this.active]; }
  get foeMon() { return this.foeTeam[this.foeIndex]; }
  get isTrainer() { return !!this.trainer; }
  get foeRemaining() { return this.foeTeam.filter(m => m.hp > 0).length; }

  begin() {
    const ev = [];
    if (this.trainer) {
      ev.push(msg(`${this.trainer.name} wants to battle!`));
      ev.push(msg(`${this.trainer.name} sent out ${this.foeMon.name}!`));
    } else {
      ev.push(msg(`A wild ${this.foeMon.name} appeared!`));
    }
    ev.push(msg(`Go, ${this.mon.nickname}!`));
    ev.push({ t: 'sfx', name: 'encounter' });
    return ev;
  }

  canAct() {
    return !this.ended && this.mon && this.mon.hp > 0;
  }

  choose(action) {
    if (this.ended) return { events: [], ended: true, needsSwitch: false };
    const events = [];
    this.turn++;

    if (action.type === 'run') {
      if (this.trainer) {
        events.push(msg("You can't run from a trainer battle!"));
        return { events, ended: false, needsSwitch: false };
      }
      this.escapeAttempts++;
      const chance = clamp(0.55 + this.escapeAttempts * 0.12, 0, 0.95);
      if (this.rng() < chance) {
        events.push({ t: 'sfx', name: 'run' });
        events.push(msg('Got away safely!'));
        this.ended = true; this.result = 'fled';
        events.push({ t: 'end', result: 'fled' });
        return { events, ended: true, needsSwitch: false, result: 'fled' };
      }
      events.push(msg("Couldn't get away!"));
      this.execEnemyTurn(events);
      const needsSwitch = this.checkFaints(events);
      return { events, ended: this.ended, needsSwitch, result: this.result };
    }

    if (action.type === 'item') {
      const item = ITEMS[action.itemId];
      if (!item) return { events: [msg('That item is not available.')], ended: false, needsSwitch: false };
      if ((this.bag[item.id] || 0) <= 0) {
        events.push(msg(`You have no ${item.name} left!`));
        return { events, ended: false, needsSwitch: false };
      }
      if (item.kind === 'orb') {
        if (this.trainer) {
          events.push(msg("You can't catch another trainer's Mythling!"));
          return { events, ended: false, needsSwitch: false };
        }
        this.bag[item.id]--;
        events.push(msg(`You tossed a ${item.name}!`));
        events.push({ t: 'sfx', name: 'orb' });
        const chance = captureChance(this.foeMon, item.id, this.rng);
        const success = this.rng() < chance;
        const shakes = success ? 3 : Math.min(2, Math.floor(this.rng() * 3));
        events.push({ t: 'orb', orb: item.id, shakes, success, chance });
        if (success) {
          events.push(msg(`Gotcha! ${this.foeMon.name} was caught!`));
          events.push({ t: 'sfx', name: 'catch' });
          this.ended = true;
          this.result = 'caught';
          this.caught = this.foeMon;
          events.push({ t: 'end', result: 'caught' });
          return { events, ended: true, needsSwitch: false, result: 'caught' };
        }
        events.push(msg(`Oh no! ${this.foeMon.name} broke free!`));
        this.execEnemyTurn(events);
        const needsSwitch = this.checkFaints(events);
        return { events, ended: this.ended, needsSwitch, result: this.result };
      }
      const target = this.mon;
      const applied = this.applyItem(item.id, target, events);
      if (!applied) {
        return { events, ended: false, needsSwitch: false };
      }
      this.execEnemyTurn(events);
      const needsSwitch = this.checkFaints(events);
      return { events, ended: this.ended, needsSwitch, result: this.result };
    }

    if (action.type === 'switch') {
      if (action.index === this.active) return { events: [msg('That Mythling is already fighting!')], ended: false, needsSwitch: false };
      const next = this.party[action.index];
      if (!next || next.hp <= 0) return { events: [msg('That Mythling cannot fight!')], ended: false, needsSwitch: false };
      this.switchTo(action.index, events);
      this.execEnemyTurn(events);
      const needsSwitch = this.checkFaints(events);
      return { events, ended: this.ended, needsSwitch, result: this.result };
    }

    if (action.type === 'move') {
      let slot = this.mon.moves[action.index];
      if (!slot || slot.pp <= 0) {
        slot = this.mon.moves.find(m => m.pp > 0) || { id: 'struggle', pp: 1 };
      }
      const enemySlot = this.pickEnemyMove();
      const playerMove = getMove(slot.id);
      const enemyMove = enemySlot ? getMove(enemySlot.id) : STRUGGLE;
      const pp = playerMove.priority || 0;
      const ep = enemyMove.priority || 0;
      const playerSpeed = this.mon.spd * stageMult(this.mon.stages.spd) * (this.mon.status?.name === 'paralyze' ? 0.5 : 1);
      const enemySpeed = this.foeMon.spd * stageMult(this.foeMon.stages.spd) * (this.foeMon.status?.name === 'paralyze' ? 0.5 : 1);
      const playerFirst = pp !== ep ? pp > ep : (playerSpeed === enemySpeed ? this.rng() < 0.5 : playerSpeed > enemySpeed);
      const order = playerFirst ? ['me', 'foe'] : ['foe', 'me'];
      for (const side of order) {
        if (this.mon.hp <= 0 || this.foeMon.hp <= 0) break;
        if (side === 'me') {
          if (slot.id === 'struggle') this.execMove(events, 'me', { id: 'struggle', pp: 1 });
          else {
            const realSlot = this.mon.moves.find(m => m.id === slot.id && m.pp > 0) || slot;
            this.execMove(events, 'me', realSlot);
          }
        } else {
          this.execMove(events, 'foe', enemySlot);
        }
      }
      this.endOfTurn(events);
      const needsSwitch = this.checkFaints(events);
      return { events, ended: this.ended, needsSwitch, result: this.result };
    }

    return { events: [msg('Nothing happened.')], ended: false, needsSwitch: false };
  }

  switchTo(index, events) {
    this.mon.stages = { atk: 0, def: 0, spd: 0 };
    this.active = index;
    const mon = this.mon;
    mon.stages = { atk: 0, def: 0, spd: 0 };
    events.push(msg(`Go, ${mon.nickname}!`));
    events.push({ t: 'switchIn', index });
  }

  forceSwitch(index) {
    const events = [];
    if (!this.party[index] || this.party[index].hp <= 0) {
      return { events: [msg('That Mythling cannot fight!')], needsSwitch: true };
    }
    this.switchTo(index, events);
    return { events, needsSwitch: false };
  }

  applyItem(itemId, target, events) {
    const item = ITEMS[itemId];
    if (!item) return false;
    if ((this.bag[item.id] || 0) <= 0) {
      events.push(msg(`You have no ${item.name} left!`));
      return false;
    }
    if (item.kind === 'heal') {
      if (target.hp <= 0) { events.push(msg(`${target.nickname} has fainted. Use a Revive Seed!`)); return false; }
      if (target.hp >= target.maxHp) { events.push(msg(`${target.nickname} is already at full health.`)); return false; }
      const heal = Math.min(item.heal, target.maxHp - target.hp);
      target.hp += heal;
      this.bag[item.id]--;
      events.push({ t: 'sfx', name: 'heal' });
      events.push({ t: 'heal', side: 'me', amount: heal });
      events.push(msg(`${target.nickname} recovered ${heal} HP!`));
      return true;
    }
    if (item.kind === 'revive') {
      if (target.hp > 0) { events.push(msg(`${target.nickname} has not fainted.`)); return false; }
      target.hp = Math.floor(target.maxHp / 2);
      target.status = null;
      this.bag[item.id]--;
      events.push({ t: 'heal', side: 'me', amount: 0 });
      events.push(msg(`${target.nickname} revived with ${target.hp} HP!`));
      return true;
    }
    if (item.kind === 'cure') {
      if (!target.status) { events.push(msg(`${target.nickname} has no status ailment.`)); return false; }
      if (!item.cures.includes(target.status.name)) { events.push(msg(`It won't help with that.`)); return false; }
      target.status = null;
      this.bag[item.id]--;
      events.push(msg(`${target.nickname} was cured!`));
      return true;
    }
    events.push(msg('That item cannot be used here.'));
    return false;
  }

  pickEnemyMove() {
    const foe = this.foeMon;
    const usable = foe.moves.filter(m => m.pp > 0);
    if (!usable.length) return null;
    let best = null;
    let bestScore = -Infinity;
    for (const slot of usable) {
      const move = getMove(slot.id);
      let score = 1;
      if (move.power > 0) {
        const res = calcDamage(foe, this.mon, move, this.rng);
        score = res.damage * (move.accuracy == null ? 1 : move.accuracy / 100) * 2;
        if (res.eff >= 2) score *= 1.25;
        if (res.eff <= 0.5) score *= 0.6;
      }
      if (move.effect?.status) {
        score += this.mon.status ? -6 : 14;
      }
      if (move.effect?.heal) score += foe.hp < foe.maxHp * 0.45 ? 45 : -4;
      if (move.effect?.stat) {
        const key = move.effect.stat.key;
        const cur = move.effect.stat.target === 'self' ? foe.stages[key] : this.mon.stages[key];
        if (move.effect.stat.target === 'self') score += cur < 2 ? 14 : -8;
        else score += cur > -2 ? 12 : -8;
      }
      if (move.effect?.drain && foe.hp < foe.maxHp * 0.5) score += 10;
      score *= 0.85 + this.rng() * 0.3;
      if (score > bestScore) { bestScore = score; best = slot; }
    }
    return best;
  }

  execEnemyTurn(events) {
    if (this.mon.hp <= 0 || this.foeMon.hp <= 0) return;
    const slot = this.pickEnemyMove();
    this.execMove(events, 'foe', slot || { id: 'struggle', pp: 1 });
  }

  execMove(events, side, slot) {
    const attacker = side === 'me' ? this.mon : this.foeMon;
    const defender = side === 'me' ? this.foeMon : this.mon;
    if (attacker.hp <= 0 || defender.hp <= 0) return;
    const isStruggle = !slot || slot.id === 'struggle';
    const move = isStruggle ? STRUGGLE : getMove(slot.id);
    if (!isStruggle) slot.pp = Math.max(0, slot.pp - 1);
    const aName = side === 'me' ? attacker.nickname : attacker.name;
    const dName = side === 'me' ? defender.name : defender.nickname;

    events.push(msg(`${aName} used ${move.name}!`));

    if (attacker.status && attacker.status.name === 'sleep') {
      attacker.status.turns = (attacker.status.turns || 1) - 1;
      if (attacker.status.turns <= 0) {
        attacker.status = null;
        events.push(msg(`${aName} woke up!`));
      } else {
        events.push(msg(`${aName} is fast asleep...`));
        return;
      }
    }
    if (attacker.status && attacker.status.name === 'paralyze' && this.rng() < 0.25) {
      events.push(msg(`${aName} is paralysed and can't move!`));
      return;
    }
    if (move.accuracy != null && this.rng() * 100 >= move.accuracy) {
      events.push(msg(`${aName}'s attack missed!`));
      return;
    }

    const defenderSp = SPECIES[defender.species];
    const eff = typeMultiplier(move.type, [defenderSp.type]);
    let dealt = 0;

    if (move.power > 0) {
      const res = calcDamage(attacker, defender, move, this.rng);
      dealt = res.damage;
      defender.hp = Math.max(0, defender.hp - dealt);
      events.push({ t: 'dmg', side: side === 'me' ? 'foe' : 'me', amount: dealt, eff, crit: res.crit, type: move.type });
      if (res.crit) events.push(msg('A critical hit!'));
      const et = effectivenessText(eff);
      if (et) events.push(msg(et));
      if (move.type === 'Neutral') events.push({ t: 'sfx', name: 'hit' });
      else events.push({ t: 'sfx', name: eff >= 2 ? 'superhit' : 'hit' });
      if (move.effect?.drain && dealt > 0) {
        const heal = Math.max(1, Math.floor(dealt * move.effect.drain));
        const actual = Math.min(heal, attacker.maxHp - attacker.hp);
        if (actual > 0) {
          attacker.hp += actual;
          events.push({ t: 'heal', side: side === 'me' ? 'me' : 'foe', amount: actual });
          events.push(msg(`${aName} drained ${actual} HP!`));
        }
      }
      if (move.effect?.recoil && dealt > 0) {
        const hurt = Math.max(1, Math.floor(dealt * move.effect.recoil));
        attacker.hp = Math.max(0, attacker.hp - hurt);
        events.push({ t: 'dmg', side, amount: hurt, eff: 1, crit: false, type: 'Neutral', recoil: true });
        events.push(msg(`${aName} is hurt by recoil!`));
      }
      if (move.effect?.status && defender.hp > 0) {
        if (this.rng() * 100 < move.effect.status.chance) {
          this.applyStatus(events, defender, move.effect.status.name, side === 'me' ? 'foe' : 'me');
        }
      }
    } else if (move.effect?.status) {
      this.applyStatus(events, defender, move.effect.status.name, side === 'me' ? 'foe' : 'me');
    }

    if (move.effect?.stat) {
      const target = move.effect.stat.target === 'self' ? attacker : defender;
      const targetSide = move.effect.stat.target === 'self' ? side : (side === 'me' ? 'foe' : 'me');
      this.applyStat(events, target, move.effect.stat.key, move.effect.stat.stages, targetSide);
    }
    if (move.effect?.heal) {
      const heal = Math.floor(attacker.maxHp * move.effect.heal);
      const actual = Math.min(heal, attacker.maxHp - attacker.hp);
      if (actual > 0) {
        attacker.hp += actual;
        events.push({ t: 'heal', side, amount: actual });
        events.push(msg(`${aName} restored ${actual} HP!`));
      } else {
        events.push(msg(`${aName}'s HP is already full!`));
      }
    }
    if (isStruggle) {
      const hurt = Math.max(1, Math.floor(dealt * 0.25));
      attacker.hp = Math.max(0, attacker.hp - hurt);
      events.push({ t: 'dmg', side, amount: hurt, eff: 1, crit: false, type: 'Neutral', recoil: true });
      events.push(msg(`${aName} is hurt by recoil!`));
    }
  }

  applyStatus(events, target, name, side) {
    const displayName = target.name || target.nickname;
    if (target.status) {
      events.push(msg(`${displayName} is already affected!`));
      return;
    }
    const sp = SPECIES[target.species];
    if (name === 'burn' && sp.type === 'Fire') {
      events.push(msg(`It doesn't affect ${displayName}...`));
      return;
    }
    if (name === 'paralyze' && sp.type === 'Electric') {
      events.push(msg(`It doesn't affect ${displayName}...`));
      return;
    }
    const turns = name === 'sleep' ? 1 + Math.floor(this.rng() * 3) : 0;
    target.status = { name, turns };
    events.push({ t: 'status', side, status: name });
    events.push({ t: 'sfx', name: 'status' });
    const label = target.name || target.nickname;
    if (name === 'burn') events.push(msg(`${label} was burned!`));
    if (name === 'poison') events.push(msg(`${label} was poisoned!`));
    if (name === 'paralyze') events.push(msg(`${label} is paralysed! It may not move!`));
    if (name === 'sleep') events.push(msg(`${label} fell asleep!`));
  }

  applyStat(events, target, key, stages, side) {
    const cur = target.stages[key] || 0;
    const next = clamp(cur + stages, -2, 2);
    const label = target.name || target.nickname;
    if (next === cur) {
      events.push(msg(`${label}'s ${key} won't go any ${stages > 0 ? 'higher' : 'lower'}!`));
      return;
    }
    target.stages[key] = next;
    events.push({ t: 'stat', side, key, delta: next - cur });
    events.push({ t: 'sfx', name: 'stat' });
    const statName = { atk: 'Attack', def: 'Defence', spd: 'Speed' }[key];
    events.push(msg(`${label}'s ${statName} ${next > cur ? 'rose' : 'fell'}!`));
  }

  endOfTurn(events) {
    const pairs = [['me', this.mon], ['foe', this.foeMon]];
    for (const [side, mon] of pairs) {
      if (mon.hp <= 0 || !mon.status) continue;
      const label = mon.name || mon.nickname;
      if (mon.status.name === 'burn' || mon.status.name === 'poison') {
        const frac = mon.status.name === 'burn' ? 1 / 16 : 1 / 8;
        const dmg = Math.max(1, Math.floor(mon.maxHp * frac));
        mon.hp = Math.max(0, mon.hp - dmg);
        events.push({ t: 'dmg', side, amount: dmg, eff: 1, crit: false, type: mon.status.name === 'burn' ? 'Fire' : 'Shadow', statusTick: true });
        events.push(msg(`${label} is hurt by ${mon.status.name === 'burn' ? 'its burn' : 'poison'}!`));
      }
    }
  }

  checkFaints(events) {
    let needsSwitch = false;
    if (this.foeMon.hp <= 0) {
      events.push({ t: 'faint', side: 'foe' });
      events.push(msg(`${this.foeMon.name} fainted!`));
      events.push({ t: 'sfx', name: 'faint' });
      this.awardExp(events);
      const nextIndex = this.foeTeam.findIndex((m, i) => i > this.foeIndex && m.hp > 0);
      if (this.trainer && nextIndex >= 0) {
        this.foeIndex = nextIndex;
        events.push(msg(`${this.trainer.name} sent out ${this.foeMon.name}!`));
        events.push({ t: 'foeOut', name: this.foeMon.name, index: this.foeIndex });
      } else {
        this.ended = true;
        this.result = 'victory';
        if (this.trainer) events.push(msg(`You defeated ${this.trainer.name}!`));
        else events.push(msg(`You won the battle!`));
        events.push({ t: 'end', result: 'victory' });
      }
    }
    if (this.mon.hp <= 0) {
      events.push({ t: 'faint', side: 'me' });
      events.push(msg(`${this.mon.nickname} fainted!`));
      events.push({ t: 'sfx', name: 'faint' });
      if (this.party.some(m => m.hp > 0)) {
        needsSwitch = true;
      } else if (!this.ended) {
        this.ended = true;
        this.result = 'defeat';
        events.push(msg('You have no Mythlings left...'));
        events.push({ t: 'end', result: 'defeat' });
      }
    }
    return needsSwitch;
  }

  awardExp(events) {
    const foe = this.foeMon;
    const mon = this.mon;
    if (!mon || mon.hp <= 0) {
      const alive = this.party.find(m => m.hp > 0);
      if (!alive) return;
      // Experience still goes to the active partner.
    }
    const gain = expYield(SPECIES[foe.species], foe.level, !!this.trainer);
    mon.exp += gain;
    events.push({ t: 'exp', amount: gain });
    events.push(msg(`${mon.nickname} gained ${gain} EXP!`));
    let guard = 0;
    while (mon.level < 100 && mon.exp >= expNeeded(mon.level) && guard++ < 20) {
      mon.exp -= expNeeded(mon.level);
      mon.level++;
      refreshStats(mon);
      events.push({ t: 'level', level: mon.level });
      events.push(msg(`${mon.nickname} grew to level ${mon.level}!`));
      events.push({ t: 'sfx', name: 'level' });
      const sp = SPECIES[mon.species];
      for (const [lvl, id] of sp.learn) {
        if (lvl === mon.level) {
          const res = learnMove(mon, id);
          if (res.learned) {
            events.push({ t: 'learn', move: MOVES[id].name, forgotten: res.forgotten });
            events.push(msg(`${mon.nickname} learned ${MOVES[id].name}!`));
            if (res.forgotten) events.push(msg(`It forgot ${res.forgotten}...`));
          }
        }
      }
      const cur = SPECIES[mon.species];
      if (cur.evolve && mon.level >= cur.evolve.level) {
        const evolved = evolveCreature(mon);
        if (evolved) {
          events.push({ t: 'evolve', to: evolved.name, species: evolved.id });
          events.push(msg(`What? ${cur.name} is evolving!`));
          events.push({ t: 'sfx', name: 'evolve' });
          events.push(msg(`${cur.name} evolved into ${evolved.name}!`));
        }
      }
    }
  }
}
