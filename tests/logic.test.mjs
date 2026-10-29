// Headless logic tests for Mythlings: content integrity, battle math, world connectivity.
import assert from 'node:assert/strict';
import {
  TYPES, TYPE_INFO, typeMultiplier, strongAgainst, weakAgainst,
} from '../js/data/types.js';
import { MOVES } from '../js/data/moves.js';
import {
  SPECIES, SPECIES_LIST, createCreature, statCalc, expNeeded, refreshStats,
  evolveCreature, learnMove, healFull, movesForLevel, statusLabel,
} from '../js/data/species.js';
import { ITEMS, SHOP_STOCK, EMBER_SHOP_STOCK } from '../js/data/items.js';
import {
  MAPS, getMap, START_MAP, isBlockedTile, tileAt, npcAt, objectAt,
} from '../js/data/world.js';
import { QUESTS, QUEST_ORDER } from '../js/data/quests.js';
import { Battle, calcDamage, captureChance } from '../js/engine/battle.js';

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    failed++;
    console.error(`FAIL  ${name}`);
    console.error(`      ${err.message}`);
  }
}

function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (Math.imul(a, 1664525) + 1013904223) >>> 0;
    return a / 4294967296;
  };
}

function battleUntilOver(battle, action = { type: 'move', index: 0 }, maxTurns = 60) {
  const log = [];
  let guard = 0;
  while (!battle.ended && guard++ < maxTurns) {
    if (!battle.party.some(m => m.hp > 0)) break;
    let res;
    if (battle.mon.hp <= 0) {
      const idx = battle.party.findIndex(m => m.hp > 0);
      battle.active = idx;
      continue;
    }
    res = battle.choose(action);
    log.push(...res.events);
    if (res.needsSwitch) {
      const next = battle.party.findIndex(m => m.hp > 0);
      if (next >= 0) battle.active = next;
    }
    if (res.ended) break;
  }
  return log;
}

console.log('\nMythlings logic tests\n');

// ---------------------------------------------------------------- Content
test('bestiary has 26 fully-formed creatures', () => {
  assert.equal(SPECIES_LIST.length, 26);
  const names = new Set();
  const nums = new Set();
  for (const sp of SPECIES_LIST) {
    assert.ok(sp.id && sp.name, 'missing id/name');
    assert.ok(!names.has(sp.name), `duplicate name ${sp.name}`);
    names.add(sp.name);
    assert.ok(!nums.has(sp.num), `duplicate num ${sp.num}`);
    nums.add(sp.num);
    assert.ok(TYPES.includes(sp.type), `${sp.name} has invalid type ${sp.type}`);
    assert.ok(sp.catchRate > 0 && sp.catchRate <= 255);
    assert.ok(sp.expYield > 0);
    assert.ok(sp.dex.length > 15, `${sp.name} needs a dex entry`);
    for (const k of ['hp', 'atk', 'def', 'spd']) {
      assert.ok(Number.isFinite(sp.base[k]) && sp.base[k] > 0, `${sp.name}.${k} invalid`);
    }
  }
});

test('every species has a valid procedural sprite spec', () => {
  const kinds = new Set(['beast', 'drake', 'blob', 'fish', 'bug', 'golem', 'wisp', 'bird']);
  const hex = /^#[0-9a-fA-F]{6}$/;
  const features = new Set(['ears', 'horns', 'wings', 'tail', 'fin', 'crest', 'cap', 'sprout', 'spots', 'gem', 'crown', 'flame', 'glow', 'antenna', 'whiskers', 'legs', 'mane']);
  for (const sp of SPECIES_LIST) {
    assert.ok(kinds.has(sp.sprite.kind), `${sp.name} sprite kind ${sp.sprite.kind}`);
    for (const key of ['main', 'shade', 'light', 'accent', 'eye']) {
      assert.match(sp.sprite[key], hex, `${sp.name} ${key} colour`);
    }
    assert.ok(Array.isArray(sp.sprite.features));
    for (const f of sp.sprite.features) assert.ok(features.has(f), `${sp.name} unknown feature ${f}`);
    assert.ok(sp.sprite.size >= 0.7 && sp.sprite.size <= 1.4);
  }
});

test('evolution chains point at real species and progress levels', () => {
  let links = 0;
  for (const sp of SPECIES_LIST) {
    if (!sp.evolve) continue;
    links++;
    assert.ok(SPECIES[sp.evolve.to], `${sp.name} evolves into missing ${sp.evolve.to}`);
    assert.ok(sp.evolve.level > 1);
    assert.ok(sp.evolve.level <= 60);
    assert.notEqual(sp.evolve.to, sp.id);
  }
  assert.equal(links, 16, 'expected 16 evolution links across 8 three-stage lines');
});

test('learnsets reference real moves and are ordered', () => {
  for (const sp of SPECIES_LIST) {
    assert.ok(sp.learn.length >= 4, `${sp.name} needs at least four moves`);
    let last = 0;
    const seen = new Set();
    for (const [level, id] of sp.learn) {
      assert.ok(MOVES[id], `${sp.name} learns missing move ${id}`);
      assert.ok(level >= last, `${sp.name} learnset out of order`);
      last = level;
      assert.ok(!seen.has(id), `${sp.name} learns ${id} twice`);
      seen.add(id);
    }
    const starterMoves = movesForLevel(sp, 5);
    assert.ok(starterMoves.length >= 1 && starterMoves.length <= 4);
    for (const id of starterMoves) assert.ok(MOVES[id]);
  }
});

test('type chart is symmetric in strengths and weaknesses', () => {
  for (const t of TYPES.filter(t => t !== 'Neutral')) {
    assert.equal(typeMultiplier(t, [t]), 0.5, `${t} should resist itself`);
    assert.equal(strongAgainst(t).length, 2, `${t} should be strong against two types`);
    assert.equal(weakAgainst(t).length, 2, `${t} should be weak to two types`);
    for (const other of strongAgainst(t)) {
      assert.equal(typeMultiplier(t, [other]), 2, `${t} should be strong against ${other}`);
    }
    for (const other of weakAgainst(t)) {
      assert.equal(typeMultiplier(other, [t]), 2, `${other} should be strong against ${t}`);
    }
    assert.ok(!strongAgainst(t).includes(t));
  }
  assert.equal(typeMultiplier('Fire', ['Grass']), 2);
  assert.equal(typeMultiplier('Water', ['Fire']), 2);
  assert.equal(typeMultiplier('Grass', ['Water']), 2);
  assert.equal(typeMultiplier('Electric', ['Water']), 2);
  assert.equal(typeMultiplier('Shadow', ['Electric']), 2);
  assert.equal(typeMultiplier('Fire', ['Water']), 0.5);
  assert.equal(typeMultiplier('Neutral', ['Shadow']), 1);
  for (const t of TYPES) assert.ok(TYPE_INFO[t].color);
});

test('all shop stock exists and is priced', () => {
  for (const id of [...SHOP_STOCK, ...EMBER_SHOP_STOCK]) {
    assert.ok(ITEMS[id], `shop lists missing item ${id}`);
    assert.ok(ITEMS[id].price > 0, `${id} needs a price`);
  }
  for (const item of Object.values(ITEMS)) {
    assert.ok(item.name && item.desc);
    if (item.kind === 'orb') assert.ok(item.orbMult >= 1);
  }
});

// ---------------------------------------------------------------- Creatures
test('creature creation calculates stats and moves', () => {
  for (const sp of SPECIES_LIST) {
    const mon = createCreature(sp.id, 7);
    assert.equal(mon.species, sp.id);
    assert.equal(mon.level, 7);
    assert.ok(mon.maxHp > 0);
    assert.equal(mon.hp, mon.maxHp);
    assert.ok(mon.atk > 0 && mon.def > 0 && mon.spd > 0);
    assert.ok(mon.moves.length >= 1 && mon.moves.length <= 4);
    for (const slot of mon.moves) {
      assert.ok(slot.pp > 0 && slot.maxPp >= slot.pp);
      assert.ok(MOVES[slot.id]);
    }
    healFull(mon);
    assert.equal(mon.hp, mon.maxHp);
  }
});

test('higher levels mean more HP and steeper exp costs', () => {
  const low = statCalc(SPECIES.cindit.base, 5);
  const high = statCalc(SPECIES.cindit.base, 20);
  assert.ok(high.hp > low.hp);
  assert.ok(high.atk > low.atk);
  for (let lvl = 2; lvl < 60; lvl++) {
    assert.ok(expNeeded(lvl) > expNeeded(lvl - 1), `exp curve at ${lvl}`);
  }
});

test('levelling and evolution update stats', () => {
  const mon = createCreature('spriglin', 13);
  const before = mon.maxHp;
  mon.level = 14;
  refreshStats(mon);
  assert.ok(mon.maxHp > before);
  const evolved = evolveCreature(mon);
  assert.equal(mon.species, 'bramblepaw');
  assert.equal(evolved.name, 'Bramblepaw');
  assert.ok(mon.maxHp > 0);
});

test('learning a fifth move forgets the weakest', () => {
  const mon = createCreature('cindit', 25);
  assert.equal(mon.moves.length, 4);
  const result = learnMove(mon, 'inferno');
  assert.equal(result.learned, true);
  assert.ok(result.forgotten);
  assert.equal(mon.moves.length, 4);
  assert.ok(mon.moves.some(m => m.id === 'inferno'));
});

// ---------------------------------------------------------------- Battle math
test('super-effective hits out-damage resisted hits', () => {
  const rng = () => 0.5;
  const attacker = createCreature('cindit', 12);
  const defender = createCreature('spriglin', 12);
  const fire = calcDamage(attacker, defender, { type: 'Fire', power: 50 }, rng);
  const water = calcDamage(attacker, defender, { type: 'Water', power: 50 }, rng);
  const neutral = calcDamage(attacker, defender, { type: 'Neutral', power: 50 }, rng);
  assert.equal(fire.eff, 2);
  assert.equal(water.eff, 0.5);
  assert.ok(fire.damage > neutral.damage);
  assert.ok(neutral.damage > water.damage);
  assert.ok(water.damage >= 1);
});

test('damage scales with level and stats sensibly', () => {
  const low = createCreature('cindit', 5);
  const high = createCreature('cindit', 30);
  const targetLow = createCreature('spriglin', 5);
  const targetHigh = createCreature('spriglin', 30);
  const move = { type: 'Fire', power: 60 };
  const a = calcDamage(low, targetLow, move, () => 0.5);
  const b = calcDamage(high, targetHigh, move, () => 0.5);
  assert.ok(b.damage > a.damage);
  const hpHigh = createCreature('spriglin', 30).maxHp;
  assert.ok(b.damage < hpHigh, 'a single hit should not one-shot an equal-level foe');
});

test('capture odds improve with damage and better orbs', () => {
  const healthy = createCreature('spriglin', 5);
  const weak = createCreature('spriglin', 5);
  weak.hp = 1;
  const cHealthy = captureChance(healthy, 'orb');
  const cWeak = captureChance(weak, 'orb');
  const cGreat = captureChance(weak, 'greatorb');
  const cMythic = captureChance(weak, 'mythicorb');
  assert.ok(cWeak > cHealthy);
  assert.ok(cGreat > cWeak);
  assert.ok(cMythic >= cGreat);
  assert.ok(cHealthy > 0);
  weak.status = { name: 'sleep', turns: 2 };
  assert.ok(captureChance(weak, 'orb') >= cWeak);
});

// ---------------------------------------------------------------- Battle flow
test('a wild battle runs to victory and grants EXP', () => {
  const party = [createCreature('cindit', 12)];
  const foe = createCreature('spriglin', 4);
  const battle = new Battle({ party, bag: { orb: 2 }, foe, rng: seeded(7) });
  const intro = battle.begin();
  assert.ok(intro.some(e => e.t === 'msg' && /wild/i.test(e.text)));
  const events = battleUntilOver(battle);
  assert.equal(battle.result, 'victory');
  assert.ok(events.some(e => e.t === 'exp' || e.t === 'level'));
  assert.ok(party[0].exp > 0 || party[0].level > 12);
});

test('catching a weakened Mythling works and ends the battle', () => {
  const party = [createCreature('cindit', 10)];
  const foe = createCreature('spriglin', 5);
  foe.hp = 1;
  const bag = { orb: 2 };
  const battle = new Battle({ party, bag, foe, rng: () => 0 });
  battle.begin();
  const res = battle.choose({ type: 'item', itemId: 'orb' });
  assert.equal(res.result, 'caught');
  assert.equal(bag.orb, 1);
  assert.equal(battle.caught, foe);
  assert.ok(res.events.some(e => e.t === 'orb' && e.success));
});

test('failed capture gives the foe a turn and does not end the battle', () => {
  const party = [createCreature('cindit', 10)];
  const foe = createCreature('spriglin', 5);
  const bag = { orb: 1 };
  const battle = new Battle({ party, bag, foe, rng: () => 0.999 });
  battle.begin();
  const res = battle.choose({ type: 'item', itemId: 'orb' });
  assert.equal(res.ended, false);
  assert.equal(bag.orb, 0);
  assert.ok(res.events.some(e => e.t === 'orb' && !e.success));
  assert.notEqual(battle.result, 'caught');
});

test('trainer battles send out the next team member and end on victory', () => {
  const party = [createCreature('solmara', 30)];
  const team = [createCreature('murklit', 4), createCreature('spriglin', 4)];
  const battle = new Battle({
    party, bag: {}, foe: team[0], trainer: { name: 'Tester', team }, rng: seeded(3),
  });
  battle.begin();
  const events = battleUntilOver(battle);
  assert.equal(battle.result, 'victory');
  assert.ok(events.some(e => e.t === 'foeOut'), 'a second foe should be sent out');
  assert.ok(events.some(e => e.t === 'msg' && /defeated Tester/i.test(e.text)));
});

test('switching resets stages and consumes the turn', () => {
  const party = [createCreature('cindit', 15), createCreature('dewfin', 15)];
  const foe = createCreature('spriglin', 15);
  const battle = new Battle({ party, bag: {}, foe, rng: seeded(11) });
  battle.begin();
  battle.mon.stages.atk = 2;
  const res = battle.choose({ type: 'switch', index: 1 });
  assert.equal(battle.active, 1);
  assert.equal(party[0].stages.atk, 0);
  assert.ok(res.events.some(e => e.t === 'switchIn'));
});

test('status ailments tick and can faint a creature', () => {
  const party = [createCreature('cindit', 20)];
  const foe = createCreature('spriglin', 20);
  const battle = new Battle({ party, bag: {}, foe, rng: seeded(5) });
  battle.begin();
  const events = [];
  party[0].status = { name: 'poison', turns: 0 };
  party[0].hp = 3;
  battle.endOfTurn(events);
  assert.equal(party[0].hp, 0);
  assert.ok(events.some(e => e.t === 'dmg' && e.statusTick));
  assert.equal(statusLabel(party[0]), 'PSN');
});

test('experience can level a creature several times', () => {
  const party = [createCreature('cindit', 5)];
  const foe = createCreature('solmara', 25);
  const battle = new Battle({ party, bag: {}, foe, rng: seeded(9) });
  battle.begin();
  const events = [];
  battle.awardExp(events);
  assert.ok(party[0].level > 5);
  assert.ok(events.some(e => e.t === 'level'));
  assert.ok(party[0].moves.length <= 4);
});

test('evolving during a level-up is emitted as an event', () => {
  const party = [createCreature('spriglin', 13)];
  party[0].exp = expNeeded(14) - 1;
  const foe = createCreature('solmara', 25);
  const battle = new Battle({ party, bag: {}, foe, rng: seeded(21) });
  battle.begin();
  const events = [];
  battle.awardExp(events);
  assert.ok(party[0].level >= 14);
  assert.ok(events.some(e => e.t === 'evolve'), 'expected an evolution event');
  assert.ok(['bramblepaw', 'verdantler'].includes(party[0].species));
});

// ---------------------------------------------------------------- World
test('maps are rectangular and have required metadata', () => {
  for (const [id, map] of Object.entries(MAPS)) {
    assert.equal(map.id, id);
    assert.ok(map.name && map.theme && map.floorChar);
    assert.equal(map.terrain.length, map.h, `${id} height`);
    for (let y = 0; y < map.h; y++) {
      assert.equal(map.terrain[y].length, map.w, `${id} row ${y} width`);
    }
    assert.ok(Array.isArray(map.warps) && map.warps.length > 0, `${id} needs warps`);
  }
});

test('every warp lands somewhere walkable and every map is reachable', () => {
  for (const [id, map] of Object.entries(MAPS)) {
    for (const w of map.warps) {
      assert.ok(MAPS[w.to], `${id} warp to missing map ${w.to}`);
      const target = getMap(w.to);
      assert.ok(w.tx >= 0 && w.ty >= 0 && w.tx < target.w && w.ty < target.h, `${id}->${w.to} out of bounds`);
      assert.equal(isBlockedTile(target, w.tx, w.ty), false, `${id}->${w.to} lands on blocked tile (${w.tx},${w.ty})`);
      assert.equal(!!npcAt(target, w.tx, w.ty, {}), false, `${id}->${w.to} lands on an NPC`);
      assert.equal(!!objectAt(target, w.tx, w.ty), false, `${id}->${w.to} lands on an object`);
    }
  }
  const seen = new Set([START_MAP]);
  const queue = [START_MAP];
  while (queue.length) {
    const map = getMap(queue.shift());
    for (const w of map.warps) {
      if (!seen.has(w.to)) { seen.add(w.to); queue.push(w.to); }
    }
  }
  assert.equal(seen.size, Object.keys(MAPS).length, `unreachable maps: ${Object.keys(MAPS).filter(m => !seen.has(m))}`);
});

test('NPCs and objects stand on open ground', () => {
  for (const [id, map] of Object.entries(MAPS)) {
    for (const npc of map.npcs || []) {
      assert.equal(isBlockedTile(map, npc.x, npc.y), false, `${id} NPC ${npc.name} on blocked tile`);
      assert.ok(tileAt(map, npc.x, npc.y) !== undefined);
    }
    for (const obj of map.objects || []) {
      assert.equal(isBlockedTile(map, obj.x, obj.y), false, `${id} object ${obj.id} on blocked tile`);
    }
  }
});

test('building doors always match their warps', () => {
  for (const [id, map] of Object.entries(MAPS)) {
    for (const b of map.buildings || []) {
      assert.ok(b.door, `${id} building without door`);
      const warp = map.warps.find(w => w.x === b.door.x && w.y === b.door.y);
      if (b.warp) {
        assert.ok(warp, `${id} ${b.kind} door (${b.door.x},${b.door.y}) needs a warp`);
      } else {
        assert.equal(!!warp, false, `${id} decorative door should not warp`);
      }
    }
  }
});

test('the player starts on a safe tile in the lab', () => {
  const lab = getMap('lab');
  assert.equal(isBlockedTile(lab, 6, 6), false);
  assert.equal(isBlockedTile(lab, 6, 8), false, 'exit warp must be enterable');
  assert.equal(isBlockedTile(lab, 6, 3), false, 'professor should stand on the floor');
  const clinic = getMap('clinic');
  assert.equal(isBlockedTile(clinic, 6, 6), false);
  assert.equal(isBlockedTile(clinic, 6, 3), false);
});

test('all encounters reference real species and sensible levels', () => {
  let encounterMaps = 0;
  for (const [id, map] of Object.entries(MAPS)) {
    const enc = map.encounters;
    if (!enc) continue;
    encounterMaps++;
    assert.ok(enc.rate > 0 && enc.rate <= 1, `${id} encounter rate`);
    assert.ok(enc.min >= 1 && enc.max >= enc.min);
    assert.ok(enc.pool.length > 0);
    for (const speciesId of enc.pool) assert.ok(SPECIES[speciesId], `${id} wild species ${speciesId}`);
    if (enc.rare) {
      assert.ok(SPECIES[enc.rare.id]);
      assert.ok(enc.rare.chance > 0 && enc.rare.chance <= 1);
    }
  }
  assert.ok(encounterMaps >= 4, 'expected several encounter maps');
});

test('trainer teams reference real species and quests resolve', () => {
  for (const [id, map] of Object.entries(MAPS)) {
    for (const npc of map.npcs || []) {
      if (npc.kind !== 'trainer' || !npc.team) continue;
      assert.ok(npc.team.length >= 1, `${npc.name} needs a team`);
      for (const [speciesId, level] of npc.team) {
        assert.ok(SPECIES[speciesId], `${npc.name} uses missing ${speciesId}`);
        assert.ok(level > 0 && level <= 60);
      }
      assert.ok(npc.intro && npc.intro.length, `${npc.name} needs intro dialogue`);
      if (npc.questId) assert.ok(QUESTS[npc.questId], `${npc.name} points at missing quest`);
    }
  }
  for (const id of QUEST_ORDER) assert.ok(QUESTS[id], `missing quest ${id}`);
  assert.equal(Object.keys(QUESTS).length, QUEST_ORDER.length);
  for (const q of Object.values(QUESTS)) {
    assert.ok(q.title && q.desc && q.hint && q.rewardText);
  }
  const bosses = Object.values(MAPS)
    .flatMap(m => m.npcs || [])
    .filter(n => n.kind === 'trainer' && n.beatenFlag && n.questId);
  assert.ok(bosses.length >= 3, 'expected at least three boss trainers');
});

test('the full bestiary is obtainable (wild pools, evolutions, rift)', () => {
  const bases = new Set(['cindit', 'dewfin', 'spriglin', 'voidra']);
  for (const map of Object.values(MAPS)) {
    if (!map.encounters) continue;
    for (const id of map.encounters.pool) bases.add(id);
    if (map.encounters.rare) bases.add(map.encounters.rare.id);
  }
  const obtainable = new Set(bases);
  let changed = true;
  while (changed) {
    changed = false;
    for (const id of [...obtainable]) {
      const sp = SPECIES[id];
      if (sp.evolve && !obtainable.has(sp.evolve.to)) {
        obtainable.add(sp.evolve.to);
        changed = true;
      }
    }
  }
  const missing = SPECIES_LIST.filter(sp => !obtainable.has(sp.id)).map(sp => sp.name);
  assert.deepEqual(missing, [], `not obtainable: ${missing.join(', ')}`);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
