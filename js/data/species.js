// The Mythling bestiary: 26 original creatures with sprites, stats and evolutions.
import { MOVES } from './moves.js';

const S = (num, name, type, base, catchRate, expYield, evolve, learn, sprite, dex, habitat) => ({
  num, id: name.toLowerCase(), name, type, base, catchRate, expYield, evolve, learn, sprite, dex, habitat,
});

// sprite kinds: beast | drake | blob | fish | bug | wisp | golem | bird
export const SPECIES = {};
function add(sp) { SPECIES[sp.id] = sp; }

add(S(1, 'Cindit', 'Fire', { hp: 42, atk: 48, def: 38, spd: 62 }, 190, 58,
  { to: 'pyrolynx', level: 14 },
  [[1, 'tackle'], [4, 'ember'], [7, 'growl'], [10, 'flamefang'], [13, 'swiftdash'], [16, 'kindle'], [19, 'cinderrush']],
  { kind: 'beast', main: '#ff9457', shade: '#c14a1e', light: '#ffd3a8', accent: '#ffe066', eye: '#2b1c2e', features: ['ears', 'tail', 'flame'], size: 0.86 },
  'A pocket-sized ember fox. Its tail-tip smoulders brighter the happier it feels.', 'Willowbrook outskirts'));

add(S(2, 'Pyrolynx', 'Fire', { hp: 64, atk: 74, def: 54, spd: 86 }, 80, 128,
  { to: 'solmara', level: 30 },
  [[1, 'tackle'], [1, 'ember'], [1, 'flamefang'], [1, 'swiftdash'], [20, 'kindle'], [23, 'cinderrush'], [26, 'bodyslam'], [29, 'inferno']],
  { kind: 'beast', main: '#ff7a45', shade: '#9e3413', light: '#ffc08c', accent: '#ffd23f', eye: '#3a1420', features: ['ears', 'tail', 'flame', 'spots', 'mane'], size: 1.0 },
  'Tufts of living flame line its shoulders. Rangers say a Pyrolynx can read a campfire\'s mood.', 'Sunbaked ridges'));

add(S(3, 'Solmara', 'Fire', { hp: 92, atk: 100, def: 78, spd: 96 }, 30, 208, null,
  [[1, 'flamefang'], [1, 'cinderrush'], [1, 'kindle'], [1, 'bodyslam'], [32, 'inferno'], [36, 'focus'], [40, 'smokeblast']],
  { kind: 'beast', main: '#ffb347', shade: '#b25311', light: '#ffe9b0', accent: '#fff1a8', eye: '#5a2210', features: ['horns', 'tail', 'flame', 'crown', 'mane'], size: 1.12 },
  'The sun-maned guardian of dry hills. Its roar is said to make the horizon ripple.', 'Scorched plateau'));

add(S(4, 'Ashlit', 'Fire', { hp: 48, atk: 52, def: 46, spd: 40 }, 180, 60,
  { to: 'cindrake', level: 15 },
  [[1, 'tackle'], [4, 'ember'], [8, 'harden'], [11, 'smokeblast'], [14, 'flamefang'], [17, 'focus'], [20, 'inferno']],
  { kind: 'blob', main: '#e8603c', shade: '#8f2f1d', light: '#ffb08a', accent: '#ffd166', eye: '#2b1218', features: ['horns', 'flame'], size: 0.86 },
  'A coal-grey lump with a stubborn flame inside. It sneezes soot when startled.', 'Glowing cinder pits'));

add(S(5, 'Cindrake', 'Fire', { hp: 68, atk: 76, def: 64, spd: 58 }, 75, 132,
  { to: 'volkaryx', level: 32 },
  [[1, 'ember'], [1, 'flamefang'], [1, 'harden'], [22, 'cinderrush'], [25, 'kindle'], [28, 'bodyslam'], [31, 'inferno']],
  { kind: 'drake', main: '#e0553a', shade: '#7d2a1c', light: '#ff9b76', accent: '#ffcf5c', eye: '#2b1218', features: ['wings', 'horns', 'tail', 'flame'], size: 1.02 },
  'Small drakes that nest in warm stone. They hoard shiny pebbles under their wings.', 'Cinder pits and lava seams'));

add(S(6, 'Volkaryx', 'Fire', { hp: 96, atk: 104, def: 84, spd: 76 }, 25, 212, null,
  [[1, 'cinderrush'], [1, 'flamefang'], [1, 'bodyslam'], [1, 'kindle'], [34, 'inferno'], [38, 'focus'], [42, 'smokeblast']],
  { kind: 'drake', main: '#f2603a', shade: '#6d2416', light: '#ffb08a', accent: '#ffe066', eye: '#ffe9a8', features: ['wings', 'horns', 'tail', 'flame', 'crown'], size: 1.16 },
  'A volcanic elder-drake. Each wingbeat sends a wave of warm air across the valley.', 'Volcanic caldera'));

add(S(7, 'Dewfin', 'Water', { hp: 46, atk: 42, def: 44, spd: 56 }, 190, 56,
  { to: 'riptail', level: 14 },
  [[1, 'tackle'], [4, 'splash'], [7, 'growl'], [10, 'aquajet'], [13, 'swiftdash'], [16, 'mistveil'], [19, 'torrent']],
  { kind: 'fish', main: '#66ccf0', shade: '#1f6f9c', light: '#c8f3ff', accent: '#a8f0e0', eye: '#12303f', features: ['fin', 'tail', 'spots'], size: 0.84 },
  'A palm-sized river fish that hums when it is content. Its fins sparkle like wet glass.', 'Riverbank shallows'));

add(S(8, 'Riptail', 'Water', { hp: 68, atk: 66, def: 58, spd: 74 }, 80, 126,
  { to: 'tidalisk', level: 30 },
  [[1, 'splash'], [1, 'aquajet'], [1, 'gnaw'], [20, 'mistveil'], [23, 'torrent'], [26, 'soak'], [29, 'tidalcrash']],
  { kind: 'beast', main: '#46b3de', shade: '#1a5f86', light: '#aeeaff', accent: '#d9fbff', eye: '#0f2c3d', features: ['fin', 'tail', 'whiskers', 'spots'], size: 0.98 },
  'An otter-like swimmer with a paddle tail. It leaves trails of bubbles wherever it races.', 'Fast river bends'));

add(S(9, 'Tidalisk', 'Water', { hp: 94, atk: 90, def: 86, spd: 84 }, 30, 206, null,
  [[1, 'aquajet'], [1, 'torrent'], [1, 'mistveil'], [1, 'bodyslam'], [32, 'tidalcrash'], [36, 'soak'], [40, 'harden']],
  { kind: 'drake', main: '#3f8fe0', shade: '#173a6b', light: '#9ed4ff', accent: '#6ff0d0', eye: '#d9fbff', features: ['fin', 'tail', 'horns', 'wings'], size: 1.12 },
  'A sinuous tide-drake ringed with pearl scales. Sailors treat its distant song as safe passage.', 'Deep river gorges'));

add(S(10, 'Puddip', 'Water', { hp: 52, atk: 44, def: 54, spd: 36 }, 200, 54,
  { to: 'marshfin', level: 15 },
  [[1, 'tackle'], [4, 'splash'], [8, 'harden'], [11, 'soak'], [14, 'aquajet'], [17, 'mistveil'], [20, 'tidalcrash']],
  { kind: 'blob', main: '#7fd8e8', shade: '#2f7d9e', light: '#d8fbff', accent: '#ffe066', eye: '#12303f', features: ['fin', 'spots'], size: 0.88 },
  'A puddle with opinions. It wobbles toward anyone carrying a snack.', 'Rain pools and marsh edges'));

add(S(11, 'Marshfin', 'Water', { hp: 72, atk: 68, def: 68, spd: 54 }, 85, 124,
  { to: 'bogsurge', level: 32 },
  [[1, 'splash'], [1, 'aquajet'], [1, 'soak'], [22, 'torrent'], [25, 'mistveil'], [28, 'bodyslam'], [31, 'tidalcrash']],
  { kind: 'fish', main: '#5aa889', shade: '#2a5c48', light: '#b5e6c9', accent: '#e0ff9e', eye: '#182f26', features: ['fin', 'tail', 'spots', 'horns'], size: 0.98 },
  'A reedy swamp fish with mossy fins. Herons think twice before bothering one.', 'Marshland reeds'));

add(S(12, 'Bogsurge', 'Water', { hp: 104, atk: 88, def: 100, spd: 46 }, 30, 204, null,
  [[1, 'torrent'], [1, 'aquajet'], [1, 'mistveil'], [1, 'bodyslam'], [34, 'tidalcrash'], [38, 'soak'], [42, 'harden']],
  { kind: 'golem', main: '#4c8a6b', shade: '#274735', light: '#a8d6b5', accent: '#c6ff7a', eye: '#d8ffe8', features: ['fin', 'horns', 'gem', 'spots'], size: 1.14 },
  'Mud, stone and old river magic packed into a patient guardian. It moves once a season.', 'Sunken marsh ruins'));

add(S(13, 'Spriglin', 'Grass', { hp: 48, atk: 46, def: 50, spd: 44 }, 195, 56,
  { to: 'bramblepaw', level: 14 },
  [[1, 'tackle'], [4, 'leaftap'], [7, 'growl'], [10, 'vinewhip'], [13, 'photosynth'], [16, 'leechbite'], [19, 'bloomburst']],
  { kind: 'blob', main: '#95dc70', shade: '#3f7a33', light: '#dcf7ae', accent: '#ffd93d', eye: '#233018', features: ['sprout', 'spots'], size: 0.82 },
  'A mossy sprout with a curled leaf hat. It follows sunlight like a sunflower follows the sky.', 'Fernwood Forest floor'));

add(S(14, 'Bramblepaw', 'Grass', { hp: 68, atk: 72, def: 62, spd: 76 }, 80, 128,
  { to: 'verdantler', level: 30 },
  [[1, 'leaftap'], [1, 'vinewhip'], [1, 'leechbite'], [20, 'photosynth'], [23, 'bloomburst'], [26, 'swiftdash'], [29, 'forestwrath']],
  { kind: 'beast', main: '#79c25a', shade: '#356b2e', light: '#c8eea0', accent: '#ff8fb1', eye: '#1e2c16', features: ['ears', 'tail', 'sprout', 'spots'], size: 0.98 },
  'A bramble cat with berry-pink blossoms. It sharpens its claws on fallen branches.', 'Fernwood thickets'));

add(S(15, 'Verdantler', 'Grass', { hp: 94, atk: 92, def: 86, spd: 88 }, 30, 206, null,
  [[1, 'vinewhip'], [1, 'bloomburst'], [1, 'leechbite'], [1, 'photosynth'], [32, 'forestwrath'], [36, 'focus'], [40, 'bodyslam']],
  { kind: 'beast', main: '#6fbe62', shade: '#2d5c2a', light: '#c4efa6', accent: '#ffe066', eye: '#d8ffcc', features: ['horns', 'tail', 'sprout', 'crown', 'mane'], size: 1.14 },
  'An antlered forest lord whose antlers bloom anew each spring. It walks without bending a single fern.', 'Ancient grove'));

add(S(16, 'Sporelle', 'Grass', { hp: 50, atk: 44, def: 58, spd: 38 }, 190, 58,
  { to: 'mycelith', level: 15 },
  [[1, 'tackle'], [4, 'leaftap'], [8, 'spore'], [11, 'harden'], [14, 'leechbite'], [17, 'bloomburst'], [20, 'photosynth']],
  { kind: 'bug', main: '#d98cc0', shade: '#803f6a', light: '#f5c6e4', accent: '#ffe066', eye: '#3a1c30', features: ['cap', 'spots', 'antenna'], size: 0.84 },
  'A shy mushroom with a velvet cap. When nervous it releases a puff of glittering spores.', 'Damp forest logs'));

add(S(17, 'Mycelith', 'Grass', { hp: 70, atk: 64, def: 76, spd: 56 }, 78, 130,
  { to: 'fungolem', level: 32 },
  [[1, 'leaftap'], [1, 'spore'], [1, 'leechbite'], [22, 'bloomburst'], [25, 'photosynth'], [28, 'gnaw'], [31, 'forestwrath']],
  { kind: 'bug', main: '#b879d6', shade: '#5c3272', light: '#e5c4f5', accent: '#a8f0d8', eye: '#2c1a3a', features: ['cap', 'spots', 'antenna', 'legs'], size: 1.0 },
  'Its cap glows faintly in the dark, guiding lost travelers to the safest path through the woods.', 'Old growth hollows'));

add(S(18, 'Fungolem', 'Grass', { hp: 104, atk: 86, def: 102, spd: 44 }, 28, 210, null,
  [[1, 'bloomburst'], [1, 'spore'], [1, 'leechbite'], [1, 'harden'], [34, 'forestwrath'], [38, 'photosynth'], [42, 'bodyslam']],
  { kind: 'golem', main: '#8f7abf', shade: '#463264', light: '#cbb8e8', accent: '#9ef0b8', eye: '#d8ffe8', features: ['cap', 'spots', 'gem'], size: 1.16 },
  'A walking stone shrine overgrown with luminous fungus. Entire bird families nest in its shoulders.', 'Forgotten shrines'));

add(S(19, 'Sparkit', 'Electric', { hp: 44, atk: 52, def: 42, spd: 68 }, 185, 60,
  { to: 'voltyx', level: 14 },
  [[1, 'tackle'], [4, 'spark'], [7, 'charge'], [10, 'swiftdash'], [13, 'zaptail'], [16, 'growl'], [19, 'voltlance']],
  { kind: 'beast', main: '#ffe066', shade: '#b88a17', light: '#fff6c4', accent: '#ff9f43', eye: '#3a2a10', features: ['ears', 'tail', 'crest'], size: 0.82 },
  'A chattery thunder-mouse with a lightning-bolt crest. It stores static in its cheek pouches.', 'Windmill fields'));

add(S(20, 'Voltyx', 'Electric', { hp: 64, atk: 76, def: 56, spd: 90 }, 72, 132,
  { to: 'galvanox', level: 32 },
  [[1, 'spark'], [1, 'zaptail'], [1, 'swiftdash'], [20, 'charge'], [23, 'voltlance'], [26, 'staticfield'], [29, 'thunderstorm']],
  { kind: 'beast', main: '#ffd23f', shade: '#a07012', light: '#fff2a8', accent: '#ff7043', eye: '#2c2208', features: ['ears', 'tail', 'crest', 'spots'], size: 1.0 },
  'It races along fence lines just before a storm, sparks trailing from its whiskers.', 'Stormy hilltops'));

add(S(21, 'Galvanox', 'Electric', { hp: 88, atk: 100, def: 76, spd: 106 }, 22, 214, null,
  [[1, 'voltlance'], [1, 'thunderstorm'], [1, 'charge'], [1, 'swiftdash'], [32, 'staticfield'], [36, 'bodyslam'], [40, 'focus']],
  { kind: 'beast', main: '#ffdf4f', shade: '#8a5c0a', light: '#fffbd0', accent: '#8fd8ff', eye: '#fffbe0', features: ['horns', 'tail', 'crest', 'wings'], size: 1.16 },
  'A storm-wolf that gallops on arcs of lightning. Villagers hang bells to keep it away from roofs.', 'High thunder plains'));

add(S(22, 'Murklit', 'Shadow', { hp: 46, atk: 50, def: 44, spd: 54 }, 180, 60,
  { to: 'duskwing', level: 14 },
  [[1, 'tackle'], [4, 'shadownip'], [7, 'haunt'], [10, 'gloomslash'], [13, 'harden'], [16, 'blight'], [19, 'nightterror']],
  { kind: 'wisp', main: '#8a6bbf', shade: '#4b2e72', light: '#c9aef0', accent: '#7fffd4', eye: '#e8ffe8', features: ['glow', 'horns'], size: 0.82 },
  'A shy shadow that hides in coat pockets and under teacups. It purrs like a kettle.', 'Gloomhollow Cave'));

add(S(23, 'Duskwing', 'Shadow', { hp: 66, atk: 74, def: 58, spd: 84 }, 72, 134,
  { to: 'nocturnyx', level: 32 },
  [[1, 'shadownip'], [1, 'gloomslash'], [1, 'haunt'], [20, 'lifedrain'], [23, 'nightterror'], [26, 'blight'], [29, 'voidrend']],
  { kind: 'bird', main: '#7b5aa6', shade: '#3a2157', light: '#b99bd8', accent: '#ff6fb5', eye: '#ffe066', features: ['wings', 'ears', 'tail', 'glow'], size: 0.98 },
  'Its wings leave a trail of violet dusk. It hunts moths by moonlight and never misses.', 'Cavern ceilings'));

add(S(24, 'Nocturnyx', 'Shadow', { hp: 90, atk: 98, def: 80, spd: 94 }, 22, 216, null,
  [[1, 'gloomslash'], [1, 'nightterror'], [1, 'lifedrain'], [1, 'haunt'], [32, 'voidrend'], [36, 'bodyslam'], [40, 'focus']],
  { kind: 'drake', main: '#5f3f8f', shade: '#241238', light: '#a184c9', accent: '#ff5fa2', eye: '#ffe066', features: ['wings', 'horns', 'tail', 'gem'], size: 1.14 },
  'A dragon woven from the hour between sunset and stars. It grants one silent wish per century.', 'The deepest dark'));

add(S(25, 'Voidra', 'Shadow', { hp: 112, atk: 106, def: 98, spd: 100 }, 6, 340, null,
  [[1, 'voidrend'], [1, 'nightterror'], [1, 'lifedrain'], [1, 'blight'], [36, 'haunt'], [40, 'bodyslam'], [44, 'focus']],
  { kind: 'wisp', main: '#4a3470', shade: '#160c26', light: '#7c63a8', accent: '#ff3f8f', eye: '#ff5fa2', features: ['horns', 'tail', 'gem', 'wings', 'glow'], size: 1.2 },
  'The Hollow Star. It eats light and dreams, and only the bravest trainers have ever met its gaze.', 'Rift between worlds'));

add(S(26, 'Luminox', 'Electric', { hp: 106, atk: 110, def: 92, spd: 114 }, 8, 340, null,
  [[1, 'thunderstorm'], [1, 'voltlance'], [1, 'charge'], [1, 'bodyslam'], [36, 'swiftdash'], [40, 'staticfield'], [44, 'focus']],
  { kind: 'bird', main: '#fff1a8', shade: '#c9a227', light: '#ffffff', accent: '#6fe0ff', eye: '#2c2208', features: ['wings', 'crest', 'crown', 'tail'], size: 1.2 },
  'A dawn-bird said to carry the first lightning of spring. It appears only to the patient.', 'Sunlit cloud peaks'));

export const SPECIES_LIST = Object.values(SPECIES).sort((a, b) => a.num - b.num);

export const TYPE_LOOKUP = {};
for (const sp of SPECIES_LIST) TYPE_LOOKUP[sp.id] = sp.type;

export function statCalc(base, level) {
  return {
    hp: Math.floor(base.hp * 2 * level / 100) + level + 10,
    atk: Math.floor(base.atk * 2 * level / 100) + 5,
    def: Math.floor(base.def * 2 * level / 100) + 5,
    spd: Math.floor(base.spd * 2 * level / 100) + 5,
  };
}

export function expNeeded(level) {
  return Math.floor(8 * Math.pow(level, 1.6) + 12 * level);
}

export function expYield(sp, level, isTrainer = false) {
  const gain = Math.floor((sp.expYield * level) / 5 + level * 2);
  return Math.max(1, Math.round(gain * (isTrainer ? 1.4 : 1)));
}

let uidCounter = 1;
export function newUid() {
  return `m${Date.now().toString(36)}${(uidCounter++).toString(36)}${Math.floor(Math.random() * 99)}`;
}

export function movesForLevel(sp, level) {
  const ids = [];
  for (const [lvl, id] of sp.learn) {
    if (lvl <= level && !ids.includes(id)) ids.push(id);
  }
  return ids.slice(-4);
}

export function createCreature(speciesId, level = 5, opts = {}) {
  const sp = SPECIES[speciesId];
  if (!sp) throw new Error(`Unknown species: ${speciesId}`);
  const stats = statCalc(sp.base, level);
  const mon = {
    uid: newUid(),
    species: speciesId,
    name: sp.name,
    nickname: opts.nickname || sp.name,
    level,
    exp: 0,
    maxHp: stats.hp,
    hp: stats.hp,
    atk: stats.atk,
    def: stats.def,
    spd: stats.spd,
    stages: { atk: 0, def: 0, spd: 0 },
    status: null,
    moves: movesForLevel(sp, level).map(id => ({ id, pp: MOVES[id].pp, maxPp: MOVES[id].pp })),
    origin: opts.origin || null,
  };
  return mon;
}

export function speciesOf(mon) {
  return SPECIES[mon.species];
}

export function statOf(mon, key) {
  if (key === 'hp') return mon.maxHp;
  return mon[key];
}

export function isFainted(mon) {
  return mon.hp <= 0;
}

export function statusLabel(mon) {
  if (!mon.status) return '';
  return ({ burn: 'BRN', poison: 'PSN', paralyze: 'PAR', sleep: 'SLP' })[mon.status.name] || '';
}

export function healFull(mon) {
  mon.hp = mon.maxHp;
  mon.status = null;
  mon.stages = { atk: 0, def: 0, spd: 0 };
  for (const m of mon.moves) m.pp = m.maxPp;
}

// Recompute stats for the current level while keeping damage taken.
export function refreshStats(mon) {
  const sp = SPECIES[mon.species];
  const stats = statCalc(sp.base, mon.level);
  const diff = stats.hp - mon.maxHp;
  mon.maxHp = stats.hp;
  mon.hp = Math.min(mon.maxHp, mon.hp + Math.max(0, diff));
  mon.atk = stats.atk;
  mon.def = stats.def;
  mon.spd = stats.spd;
}

export function evolveCreature(mon) {
  const sp = SPECIES[mon.species];
  if (!sp || !sp.evolve) return null;
  const from = sp.name;
  mon.species = sp.evolve.to;
  const newSp = SPECIES[mon.species];
  refreshStats(mon);
  mon.nickname = mon.nickname === from ? newSp.name : mon.nickname;
  return newSp;
}

export function learnMove(mon, moveId) {
  if (mon.moves.some(m => m.id === moveId)) return { learned: false, reason: 'known' };
  const move = MOVES[moveId];
  if (mon.moves.length < 4) {
    mon.moves.push({ id: moveId, pp: move.pp, maxPp: move.pp });
    return { learned: true, forgotten: null };
  }
  // Forgets the weakest move to make room.
  const weakest = mon.moves
    .map((m, i) => ({ i, power: (MOVES[m.id].power || 0) }))
    .sort((a, b) => a.power - b.power)[0];
  const forgotten = MOVES[mon.moves[weakest.i].id].name;
  mon.moves[weakest.i] = { id: moveId, pp: move.pp, maxPp: move.pp };
  return { learned: true, forgotten };
}
