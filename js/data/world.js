// Overworld content: towns, routes, a forest, a cave, and the NPCs who live there.
import { SPECIES } from './species.js';

export const TILE = 16;

export const BLOCKED_TILES = new Set(['#', 'M', '~', 'X', 'w', 'P', 'T', 'k', ' ']);
export const ENCOUNTER_TILES = new Set([',']);

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function paintMap(w, h, fn) {
  const g = Array.from({ length: h }, () => Array(w).fill('.'));
  const api = {
    g, w, h,
    set(x, y, ch) { if (x >= 0 && y >= 0 && x < w && y < h) g[y][x] = ch; },
    get(x, y) { return (x >= 0 && y >= 0 && x < w && y < h) ? g[y][x] : '#'; },
    fill(ch) { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) g[y][x] = ch; },
    rect(x, y, ww, hh, ch) { for (let yy = y; yy < y + hh; yy++) for (let xx = x; xx < x + ww; xx++) api.set(xx, yy, ch); },
    border(ch) {
      for (let x = 0; x < w; x++) { api.set(x, 0, ch); api.set(x, h - 1, ch); }
      for (let y = 0; y < h; y++) { api.set(0, y, ch); api.set(w - 1, y, ch); }
    },
    vline(x, y1, y2, ch) { for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) api.set(x, y, ch); },
    hline(y, x1, x2, ch) { for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) api.set(x, y, ch); },
    scatter(ch, x, y, ww, hh, count, rng) {
      let tries = 0;
      while (count > 0 && tries < count * 40) {
        tries++;
        const xx = x + Math.floor(rng() * ww);
        const yy = y + Math.floor(rng() * hh);
        if (api.get(xx, yy) === '.') { api.set(xx, yy, ch); count--; }
      }
    },
  };
  fn(api);
  return g;
}

function finalize(m, rows) {
  const floor = m.floorChar || '.';
  const safe = new Set([...m.warps.map(w => `${w.x},${w.y}`),
    ...(m.npcs || []).map(n => `${n.x},${n.y}`),
    ...(m.objects || []).map(o => `${o.x},${o.y}`)]);
  for (const key of safe) {
    const [x, y] = key.split(',').map(Number);
    if (rows[y] && rows[y][x] === undefined) continue;
    if (rows[y] && BLOCKED_TILES.has(rows[y][x])) rows[y][x] = floor;
  }
  m.terrain = rows.map(r => r.join(''));
  return m;
}

const MAPS = {};

// ---------------------------------------------------------------- Willowbrook
{
  const rng = mulberry32(1337);
  const rows = paintMap(26, 20, t => {
    t.fill('.'); t.border('#');
    t.scatter('#', 1, 1, 3, 8, 5, rng);
    t.scatter('#', 22, 6, 3, 5, 4, rng);
    t.scatter('#', 1, 12, 3, 7, 5, rng);
    t.scatter('#', 22, 12, 3, 7, 5, rng);
    t.scatter('f', 2, 2, 8, 5, 6, rng);
    t.scatter('f', 14, 2, 7, 6, 4, rng);
    t.rect(21, 2, 4, 4, '~');
    t.rect(20, 2, 1, 4, '.');
    // main routes
    t.rect(2, 9, 22, 2, '=');
    t.rect(12, 1, 2, 18, '=');
    t.rect(4, 17, 18, 1, '=');
    t.vline(6, 6, 8, '='); t.vline(18, 6, 8, '=');
    t.vline(6, 15, 16, '='); t.vline(18, 15, 16, '=');
    t.hline(17, 6, 18, '=');
    t.set(6, 5, '='); t.set(18, 5, '='); t.set(6, 14, '='); t.set(18, 14, '=');
    t.rect(12, 0, 2, 1, '=');
    t.rect(9, 3, 2, 1, 'f');
    t.rect(2, 16, 2, 1, 'f');
    t.rect(21, 8, 3, 1, 'f');
  });
  MAPS.willowbrook = finalize({
    id: 'willowbrook', name: 'Willowbrook Town', w: 26, h: 20, theme: 'town',
    music: 'town', floorChar: '.',
    buildings: [
      { x: 4, y: 3, w: 5, h: 3, kind: 'clinic', label: 'CLINIC', door: { x: 6, y: 5 }, warp: true },
      { x: 16, y: 3, w: 5, h: 3, kind: 'lab', label: 'LINDEN LAB', door: { x: 18, y: 5 }, warp: true },
      { x: 4, y: 12, w: 5, h: 3, kind: 'shop', label: 'MARKET', door: { x: 6, y: 14 }, warp: true },
      { x: 16, y: 12, w: 5, h: 3, kind: 'house', label: 'HOME', door: { x: 18, y: 14 }, warp: true },
    ],
    warps: [
      { x: 12, y: 0, to: 'route1', tx: 13, ty: 18, dir: 'up' },
      { x: 13, y: 0, to: 'route1', tx: 14, ty: 18, dir: 'up' },
      { x: 6, y: 5, to: 'clinic', tx: 6, ty: 7, dir: 'up' },
      { x: 18, y: 5, to: 'lab', tx: 6, ty: 7, dir: 'up' },
      { x: 6, y: 14, to: 'market', tx: 6, ty: 7, dir: 'up' },
      { x: 18, y: 14, to: 'house', tx: 6, ty: 7, dir: 'up' },
    ],
    npcs: [
      {
        id: 'mira', x: 10, y: 11, dir: 'down', name: 'Mira',
        look: { skin: '#f0b98a', hair: '#5a3320', shirt: '#e2677f', pants: '#3b3f63', accent: '#ffe066', hat: 'none' },
        lines: [
          'Morning, Rune! The Professor has been pacing around the lab all week.',
          'Tall grass is where wild Mythlings hide. Walk through it and you might get a surprise!',
          'Weaken one in battle first, then toss a Capture Orb. Works every time... almost.',
        ],
      },
      {
        id: 'finn', x: 20, y: 8, dir: 'left', name: 'Finn',
        look: { skin: '#c98a5a', hair: '#2f2a2a', shirt: '#4fa9ff', pants: '#3c4b5e', accent: '#ffd447', hat: 'cap' },
        lines: [
          'Fire burns Grass. Grass drinks Water. Water douses Fire.',
          'And don\'t forget Electric! It zaps Water something fierce.',
          'Shadow is the odd one. It creeps up on Electric and Grass, but Fire and Water scare it.',
        ],
      },
      {
        id: 'townbird', x: 22, y: 12, dir: 'down', name: 'Cindit', creature: 'cindit',
        lines: ['A stray Cindit naps in the sun. Its tail flicks contentedly.'],
      },
    ],
    objects: [
      { id: 'sign-north', x: 11, y: 2, kind: 'sign', text: ['WILLOWBROOK TOWN', 'North: Fernwood Trail. Mind the tall grass!'] },
      { id: 'sign-south', x: 5, y: 18, kind: 'sign', text: ['Willowbrook Market: orbs, potions, and friendly gossip.'] },
    ],
  }, rows);
}

// ---------------------------------------------------------------- Lab
{
  const rows = paintMap(12, 9, t => {
    t.fill('i'); t.border('w');
    t.rect(3, 2, 2, 1, 'k'); t.rect(8, 2, 2, 1, 'k');
    t.set(4, 3, 'T'); t.set(5, 3, 'T'); t.set(7, 3, 'T'); t.set(8, 3, 'T');
    t.set(6, 8, 'i');
    t.set(1, 7, 'P'); t.set(10, 7, 'P');
  });
  MAPS.lab = finalize({
    id: 'lab', name: 'Linden Lab', w: 12, h: 9, theme: 'lab', music: 'town', floorChar: 'i',
    buildings: [],
    warps: [{ x: 6, y: 8, to: 'willowbrook', tx: 18, ty: 6, dir: 'down' }],
    npcs: [
      {
        id: 'professor', x: 6, y: 3, dir: 'down', name: 'Prof. Linden',
        look: { skin: '#e8b48c', hair: '#cfd6e6', shirt: '#f9f6ef', pants: '#4a4360', accent: '#b07bd6', hat: 'none', coat: true },
        onTalk: async (g) => {
          if (g.questState('research') === 'active') {
            const caught = g.state.dex.caughtCount || 0;
            await g.say([
              `Your Index is filling up nicely — ${Math.min(caught, 3)} of 3 Mythlings logged.`,
              'The tall grass north of town is the best place to start. Weaken a Mythling, then use a Capture Orb.',
              'Come back when you have three. Or don\'t! The journey is yours.',
            ], 'Prof. Linden');
            return;
          }
          if (g.questState('research') === 'done' && !g.flag('profThanks')) {
            g.setFlag('profThanks');
            await g.say([
              'Three Mythlings already! Splendid! Your field notes are the talk of the valley.',
              'I hear Ranger Bramble in Fernwood Forest is looking for a challenger. And Emberhold...',
              'Something restless stirs beneath Emberhold. If you feel ready, follow the northern road.',
            ], 'Prof. Linden');
            return;
          }
          await g.say([
            'Every Mythling carries a spark of the old world. Fire, Water, Grass, Electric, Shadow.',
            'My Index records them all. Twenty-six pages, Rune. Twenty-six!',
            'Go on, fill it in. I will be here, drinking cold tea and worrying.',
          ], 'Prof. Linden');
        },
      },
    ],
    objects: [
      { id: 'pc-lab', x: 10, y: 2, kind: 'pc' },
      { id: 'books-lab', x: 3, y: 2, kind: 'books', text: ['MYTHLING MORPHOLOGY, VOL. III', 'A note is tucked inside: "Shadow types hate bright sparks. Electric hates the dark."'] },
    ],
  }, rows);
}

// ---------------------------------------------------------------- Clinic
{
  const rows = paintMap(12, 9, t => {
    t.fill('i'); t.border('w');
    t.set(4, 3, 'T'); t.set(5, 3, 'T'); t.set(7, 3, 'T'); t.set(8, 3, 'T');
    t.set(6, 8, 'i');
    t.set(2, 6, 'T'); t.set(9, 6, 'T');
    t.set(1, 7, 'P'); t.set(10, 7, 'P');
  });
  MAPS.clinic = finalize({
    id: 'clinic', name: 'Willowbrook Clinic', w: 12, h: 9, theme: 'clinic', music: 'town', floorChar: 'i',
    buildings: [],
    warps: [{ x: 6, y: 8, to: 'willowbrook', tx: 6, ty: 6, dir: 'down' }],
    npcs: [
      {
        id: 'nurse', x: 6, y: 3, dir: 'down', name: 'Nurse Petal',
        look: { skin: '#f2c39c', hair: '#e9859b', shirt: '#fff7f9', pants: '#f4a8b8', accent: '#ff5f8a', hat: 'nurse' },
        onTalk: async (g) => {
          await g.say(['Welcome to the Willowbrook Clinic! Shall I tend to your Mythlings?'], 'Nurse Petal');
          const hurt = g.teamNeedsHealing();
          if (!hurt) {
            await g.say(['Everyone is fighting fit! Remember, rest is part of training too.'], 'Nurse Petal');
            return;
          }
          await g.healParty();
          await g.say(['There we go — everyone is patched up, rested and ready.', 'I saved your progress as well. Come back any time!'], 'Nurse Petal');
        },
      },
    ],
    objects: [
      { id: 'pc-clinic', x: 10, y: 2, kind: 'pc' },
      { id: 'poster', x: 1, y: 2, kind: 'books', text: ['A cheerful poster: "A WELL-RESTED MYTHLING IS A BRAVE MYTHLING."', 'Someone drew a tiny Cindit in the corner.'] },
    ],
  }, rows);
}

// ---------------------------------------------------------------- Market
{
  const rows = paintMap(12, 9, t => {
    t.fill('i'); t.border('w');
    t.set(3, 2, 'k'); t.set(4, 2, 'k'); t.set(8, 2, 'k'); t.set(9, 2, 'k');
    t.set(4, 3, 'T'); t.set(5, 3, 'T'); t.set(7, 3, 'T'); t.set(8, 3, 'T');
    t.set(6, 8, 'i');
    t.set(1, 7, 'P'); t.set(10, 7, 'P');
  });
  MAPS.market = finalize({
    id: 'market', name: 'Willowbrook Market', w: 12, h: 9, theme: 'market', music: 'town', floorChar: 'i',
    buildings: [],
    warps: [{ x: 6, y: 8, to: 'willowbrook', tx: 6, ty: 15, dir: 'down' }],
    npcs: [
      {
        id: 'shopkeeper', x: 6, y: 3, dir: 'down', name: 'Bram',
        look: { skin: '#d99b6c', hair: '#6b3f22', shirt: '#7c9fc4', pants: '#39465a', accent: '#ffb347', hat: 'cap' },
        onTalk: async (g) => {
          await g.say(['Orbs, potions, balms! Fresh stock, fair prices, no haggling.', 'What catches your eye?'], 'Bram');
          g.openShop('market');
        },
      },
    ],
    objects: [],
  }, rows);
}

// ---------------------------------------------------------------- House
{
  const rows = paintMap(12, 9, t => {
    t.fill('i'); t.border('w');
    t.set(3, 3, 'T'); t.set(4, 3, 'T');
    t.set(8, 2, 'k');
    t.set(6, 8, 'i');
    t.set(1, 7, 'P'); t.set(10, 7, 'P');
  });
  MAPS.house = finalize({
    id: 'house', name: 'Rune\'s House', w: 12, h: 9, theme: 'house', music: 'town', floorChar: 'i',
    buildings: [],
    warps: [{ x: 6, y: 8, to: 'willowbrook', tx: 18, ty: 15, dir: 'down' }],
    npcs: [
      {
        id: 'mum', x: 6, y: 3, dir: 'down', name: 'Mum',
        look: { skin: '#e9b184', hair: '#8a4b2a', shirt: '#d98c8c', pants: '#4a4360', accent: '#ffe066', hat: 'none' },
        onTalk: async (g) => {
          if (!g.flag('mumGift')) {
            g.setFlag('mumGift');
            g.give('potion', 3);
            await g.say([
              'You are off on an adventure, and I am not crying. This is rain. Indoors.',
              'Take these Potions. And wear a scarf. And write. Well — send a Mythling with a note.',
            ], 'Mum');
            await g.say(['Received 3 Potions!'], '');
            return;
          }
          await g.say(['Your room is exactly as you left it. Much tidier, actually. I had help from a very smug Murklit.'], 'Mum');
        },
      },
    ],
    objects: [
      { id: 'home-books', x: 8, y: 2, kind: 'books', text: ['A shelf of well-loved books about faraway mountains.', 'One spine reads: "SO YOU FOUND A SHADOW MYTHLING." It looks unread.'] },
    ],
  }, rows);
}

// ---------------------------------------------------------------- Route 1
{
  const rng = mulberry32(4242);
  const rows = paintMap(26, 20, t => {
    t.fill('.'); t.border('#');
    t.scatter('#', 1, 1, 3, 9, 8, rng);
    t.scatter('#', 21, 1, 4, 6, 7, rng);
    t.scatter('#', 1, 12, 3, 7, 7, rng);
    t.scatter('f', 10, 15, 5, 3, 5, rng);
    t.rect(19, 15, 5, 4, '~');
    t.rect(18, 15, 1, 4, '.');
    // tall grass
    t.rect(2, 8, 6, 4, ',');
    t.rect(16, 6, 8, 6, ',');
    t.rect(10, 3, 4, 3, ',');
    t.rect(17, 15, 1, 2, ',');
    // paths
    t.rect(5, 0, 2, 6, '=');
    t.rect(5, 5, 6, 2, '=');
    t.rect(9, 6, 2, 7, '=');
    t.rect(9, 12, 6, 2, '=');
    t.rect(13, 13, 2, 7, '=');
    t.set(13, 19, '='); t.set(14, 19, '=');
    t.hline(13, 13, 14, '=');
    t.scatter('M', 24, 12, 2, 5, 4, rng);
  });
  MAPS.route1 = finalize({
    id: 'route1', name: 'Fernwood Trail', w: 26, h: 20, theme: 'route', music: 'route', floorChar: '.',
    buildings: [],
    warps: [
      { x: 5, y: 0, to: 'fernwood', tx: 5, ty: 20, dir: 'up' },
      { x: 6, y: 0, to: 'fernwood', tx: 6, ty: 20, dir: 'up' },
      { x: 13, y: 19, to: 'willowbrook', tx: 12, ty: 1, dir: 'down' },
      { x: 14, y: 19, to: 'willowbrook', tx: 13, ty: 1, dir: 'down' },
    ],
    encounters: { rate: 0.15, min: 3, max: 6, pool: ['spriglin', 'cindit', 'sparkit', 'dewfin', 'spriglin', 'puddip'] },
    npcs: [
      {
        id: 'lira', x: 16, y: 11, dir: 'left', name: 'Scout Lira', kind: 'trainer',
        look: { skin: '#8d5a3b', hair: '#231f20', shirt: '#6fbf73', pants: '#3d4a2e', accent: '#ffd447', hat: 'cap' },
        intro: [
          'Hold it! A new face on the Fernwood Trail means one thing: battle.',
          'I am Lira, scout of the ranger corps. Show me what your partner can do!',
        ],
        team: [['sparkit', 6], ['spriglin', 7]],
        reward: 180, beatenFlag: 'liraBeaten',
        post: ['Good instincts! Fernwood Forest is just north. Ranger Bramble is tougher than me — much tougher.'],
      },
      {
        id: 'tobin', x: 9, y: 8, dir: 'right', name: 'Hiker Tobin',
        look: { skin: '#c98a5a', hair: '#4b3223', shirt: '#c9a227', pants: '#5b4a2f', accent: '#ff7a45', hat: 'wide' },
        lines: [
          'Wild Mythlings get bolder the deeper you go. My knees can confirm this.',
          'If one of yours faints, a Potion fixes it right up. Nurse Petal in town does it for free, too.',
        ],
      },
    ],
    objects: [
      { id: 'sign-r1', x: 15, y: 17, kind: 'sign', text: ['FARNWOOD TRAIL', 'South: Willowbrook Town. North: Fernwood Forest.'] },
      { id: 'r1-potion', x: 21, y: 13, kind: 'pickup', item: 'potion', qty: 2, flag: 'pickup_r1_potion' },
    ],
  }, rows);
}

// ---------------------------------------------------------------- Fernwood Forest
{
  const rng = mulberry32(9090);
  const rows = paintMap(30, 22, t => {
    t.fill('.'); t.border('#');
    t.scatter('#', 1, 1, 4, 10, 14, rng);
    t.scatter('#', 25, 1, 4, 9, 12, rng);
    t.scatter('#', 1, 12, 4, 9, 12, rng);
    t.scatter('#', 25, 12, 4, 9, 12, rng);
    t.scatter('#', 9, 2, 18, 3, 12, rng);
    t.scatter('#', 18, 13, 8, 8, 12, rng);
    t.scatter('f', 8, 7, 6, 3, 6, rng);
    t.rect(20, 18, 3, 3, '~');
    // paths
    t.rect(5, 14, 2, 8, '=');
    t.rect(5, 14, 10, 2, '=');
    t.rect(14, 7, 2, 9, '=');
    t.rect(14, 9, 16, 2, '=');
    t.set(29, 9, '='); t.set(29, 10, '=');
    t.hline(20, 4, 7, '=');
    // tall grass
    t.rect(2, 17, 3, 3, ',');
    t.rect(8, 7, 4, 3, ',');
    t.rect(17, 4, 7, 4, ',');
    t.rect(22, 13, 5, 4, ',');
    t.rect(7, 11, 4, 2, ',');
  });
  MAPS.fernwood = finalize({
    id: 'fernwood', name: 'Fernwood Forest', w: 30, h: 22, theme: 'forest', music: 'forest', floorChar: '.',
    buildings: [],
    warps: [
      { x: 5, y: 21, to: 'route1', tx: 5, ty: 1, dir: 'down' },
      { x: 6, y: 21, to: 'route1', tx: 6, ty: 1, dir: 'down' },
      { x: 29, y: 9, to: 'route2', tx: 1, ty: 10, dir: 'right' },
      { x: 29, y: 10, to: 'route2', tx: 1, ty: 11, dir: 'right' },
    ],
    encounters: { rate: 0.17, min: 5, max: 9, pool: ['spriglin', 'sporelle', 'murklit', 'cindit', 'puddip', 'bramblepaw'] },
    npcs: [
      {
        id: 'willow', x: 16, y: 8, dir: 'down', name: 'Willow',
        look: { skin: '#f0c8a0', hair: '#8b5e3c', shirt: '#a8d8a0', pants: '#3c5b3a', accent: '#ff8fb1', hat: 'bandana' },
        onTalk: async (g) => {
          if (g.questState('berries') === 'done') {
            await g.say(['The Glowberry tarts turned out perfectly. I saved you one!', 'Oh — I ate it. I saved you the recipe instead.'], 'Willow');
            return;
          }
          if (g.countItem('berry') >= 3) {
            await g.say(['Three Glowberries! You wonderful person!', 'Here, take these Super Potions. And some coin for your trouble.'], 'Willow');
            g.takeItem('berry', 3);
            g.give('superpotion', 3);
            g.addMoney(200);
            await g.completeQuest('berries');
            return;
          }
          g.startQuest('berries');
          await g.say([
            'Oh! A trainer! Perfect timing. I am baking Glowberry tarts and I am three berries short.',
            'The bushes in this forest glow a little when you get close. Look for the sparkle!',
            'Bring me three and I will make it worth your while.',
          ], 'Willow');
        },
      },
      {
        id: 'bramble', x: 24, y: 10, dir: 'left', name: 'Ranger Bramble', kind: 'trainer',
        look: { skin: '#b7794f', hair: '#3b5c2f', shirt: '#7a6a45', pants: '#3a4a2c', accent: '#ffe066', hat: 'wide' },
        intro: [
          'Halt, wanderer. Fernwood does not open its paths to the untested.',
          'I am Bramble, ranger of this wood. Beat me, and the eastern road is yours by right.',
        ],
        team: [['spriglin', 10], ['sporelle', 10], ['bramblepaw', 13]],
        reward: 500, beatenFlag: 'brambleBeaten',
        questId: 'bramble',
        post: [
          'Ha! The forest likes you. I can feel it in the roots.',
          'Take the eastern road to Route 2. Emberhold lies beyond, and their Pyromancer has been... difficult.',
        ],
      },
      {
        id: 'fern-sporelle', x: 11, y: 12, dir: 'right', name: 'Sporelle', creature: 'sporelle',
        lines: ['A Sporelle wobbles hopefully. It smells faintly of warm bread.'],
      },
    ],
    objects: [
      { id: 'berry1', x: 8, y: 16, kind: 'berry' },
      { id: 'berry2', x: 19, y: 5, kind: 'berry' },
      { id: 'berry3', x: 26, y: 14, kind: 'berry' },
      { id: 'sign-fern', x: 7, y: 19, kind: 'sign', text: ['FERNWOOD FOREST', 'Rangers ask that you do not feed the Bramblepaws. They become insufferable.'] },
      { id: 'fern-potion', x: 11, y: 18, kind: 'pickup', item: 'superpotion', qty: 1, flag: 'pickup_fern_potion' },
    ],
  }, rows);
}

// ---------------------------------------------------------------- Route 2
{
  const rng = mulberry32(555);
  const rows = paintMap(30, 20, t => {
    t.fill('.'); t.border('#');
    t.scatter('#', 1, 1, 4, 7, 9, rng);
    t.scatter('#', 25, 1, 4, 7, 9, rng);
    t.scatter('#', 1, 13, 4, 6, 9, rng);
    t.scatter('#', 25, 13, 4, 6, 9, rng);
    t.scatter('#', 9, 2, 5, 3, 6, rng);
    t.rect(14, 2, 3, 18, '~');
    t.rect(14, 10, 3, 2, 'B');
    t.rect(0, 10, 14, 2, '=');
    t.rect(17, 10, 13, 2, '=');
    t.set(0, 10, '='); t.set(0, 11, '='); t.set(29, 10, '='); t.set(29, 11, '=');
    t.rect(3, 4, 6, 4, ',');
    t.rect(20, 3, 7, 4, ',');
    t.rect(20, 13, 7, 4, ',');
    t.rect(6, 14, 5, 3, ',');
    t.rect(8, 6, 4, 2, ',');
    t.scatter('f', 2, 8, 6, 2, 4, rng);
    t.scatter('M', 18, 17, 6, 2, 4, rng);
  });
  MAPS.route2 = finalize({
    id: 'route2', name: 'Route 2', w: 30, h: 20, theme: 'route', music: 'route', floorChar: '.',
    buildings: [],
    warps: [
      { x: 0, y: 10, to: 'fernwood', tx: 28, ty: 9, dir: 'left' },
      { x: 0, y: 11, to: 'fernwood', tx: 28, ty: 10, dir: 'left' },
      { x: 29, y: 10, to: 'emberhold', tx: 1, ty: 10, dir: 'right' },
      { x: 29, y: 11, to: 'emberhold', tx: 1, ty: 11, dir: 'right' },
    ],
    encounters: { rate: 0.16, min: 8, max: 12, pool: ['dewfin', 'puddip', 'sparkit', 'spriglin', 'ashlit', 'sporelle'] },
    npcs: [
      {
        id: 'fen', x: 9, y: 12, dir: 'up', name: 'Angler Fen', kind: 'trainer',
        look: { skin: '#e0a878', hair: '#5a4632', shirt: '#4fa9ff', pants: '#3a4557', accent: '#a8f0e0', hat: 'wide' },
        intro: ['The river is calm, the fish are biting, and then YOU show up.', 'Fine. Let us settle it with Mythlings. My river team versus yours!'],
        team: [['dewfin', 10], ['puddip', 10], ['riptail', 12]],
        reward: 240, beatenFlag: 'fenBeaten',
        post: ['Hah! The river wins again. Or rather, you do. Same thing, really.', 'Mind the bridge. Emberhold is east, just past the bend.'],
      },
      {
        id: 'pip', x: 21, y: 8, dir: 'down', name: 'Volt Kid Pip', kind: 'trainer',
        look: { skin: '#f2c9a0', hair: '#f2d34a', shirt: '#ffe066', pants: '#4a4360', accent: '#ff9f43', hat: 'cap' },
        intro: ['Zzzap! You walked right into my training spot.', 'My Sparkit can outrun a storm. Wanna see?'],
        team: [['sparkit', 9], ['voltyx', 12]],
        reward: 300, beatenFlag: 'pipBeaten',
        post: ['Whoa. You are FAST. I am going to go train on a hilltop until I am even faster.'],
      },
      {
        id: 'r2-wanderer', x: 5, y: 8, dir: 'right', name: 'Wanderer Nou',
        look: { skin: '#c98a5a', hair: '#2b2525', shirt: '#8e7cc3', pants: '#3c3c4e', accent: '#ffd447', hat: 'hood' },
        lines: [
          'I have walked every road in this valley. The cave beneath Emberhold hums at night.',
          'People say the Pyromancer guards the way in. Others say she is testing who is foolish enough to enter.',
          'Either way: bring your best team, and plenty of orbs.',
        ],
      },
    ],
    objects: [
      { id: 'sign-r2', x: 2, y: 9, kind: 'sign', text: ['ROUTE 2', 'West: Fernwood Forest. East: Emberhold.'] },
      { id: 'r2-orb', x: 24, y: 16, kind: 'pickup', item: 'greatorb', qty: 2, flag: 'pickup_r2_orb' },
    ],
  }, rows);
}

// ---------------------------------------------------------------- Emberhold
{
  const rng = mulberry32(7777);
  const rows = paintMap(26, 20, t => {
    t.fill('.'); t.border('M');
    t.scatter('M', 1, 1, 3, 7, 7, rng);
    t.scatter('M', 22, 1, 3, 6, 6, rng);
    t.scatter('M', 1, 12, 2, 7, 5, rng);
    t.scatter('M', 23, 13, 2, 6, 5, rng);
    t.scatter('#', 9, 1, 6, 2, 4, rng);
    t.rect(2, 10, 22, 2, '=');
    t.rect(12, 0, 2, 18, '=');
    t.set(0, 10, '='); t.set(0, 11, '=');
    t.rect(12, 0, 2, 1, '=');
    t.vline(18, 6, 9, '=');
    t.set(18, 5, '=');
    t.rect(1, 17, 5, 1, 'f');
    t.rect(20, 17, 4, 1, 'f');
    t.rect(7, 8, 3, 1, '.');
  });
  MAPS.emberhold = finalize({
    id: 'emberhold', name: 'Emberhold', w: 26, h: 20, theme: 'ember', music: 'town', floorChar: '.',
    buildings: [
      { x: 16, y: 3, w: 5, h: 3, kind: 'shop', label: 'BAZAAR', door: { x: 18, y: 5 }, warp: true },
      { x: 4, y: 3, w: 5, h: 3, kind: 'forge', label: 'FORGE', door: { x: 6, y: 5 }, warp: false },
    ],
    warps: [
      { x: 0, y: 10, to: 'route2', tx: 28, ty: 10, dir: 'left' },
      { x: 0, y: 11, to: 'route2', tx: 28, ty: 11, dir: 'left' },
      { x: 12, y: 0, to: 'cave', tx: 13, ty: 20, dir: 'up' },
      { x: 13, y: 0, to: 'cave', tx: 14, ty: 20, dir: 'up' },
      { x: 18, y: 5, to: 'embermarket', tx: 6, ty: 7, dir: 'up' },
    ],
    npcs: [
      {
        id: 'cinder', x: 16, y: 9, dir: 'down', name: 'Pyromancer Cinder', kind: 'trainer',
        look: { skin: '#c98a5a', hair: '#d94f2b', shirt: '#3a2438', pants: '#2a1a2e', accent: '#ff7a45', hat: 'hood' },
        intro: [
          'You smell of fern and river water. A traveler, then. Or a challenger.',
          'The cave beneath Emberhold has been restless since the Hollow Star stirred. I guard its mouth.',
          'Prove your flame. Prove you can walk into the dark and come back.',
        ],
        team: [['ashlit', 16], ['pyrolynx', 17], ['cindrake', 18]],
        reward: 800, beatenFlag: 'cinderBeaten',
        questId: 'cinder',
        post: [
          'Your fire burns clean. I yield the cave to you.',
          'Look for the moss-lit path north. The Shadow Adept waits at the bottom of everything.',
          'And Rune — if the dark offers you a bargain, do not take it.',
        ],
      },
      {
        id: 'roa', x: 9, y: 9, dir: 'down', name: 'Emberkeeper Roa',
        look: { skin: '#8d5a3b', hair: '#e9e3d6', shirt: '#c25f3a', pants: '#4b3428', accent: '#ffe066', hat: 'wide' },
        onTalk: async (g) => {
          await g.say(['Sit by the fire, traveler. Emberhold hospitality is simple: eat, rest, fight another day.'], 'Emberkeeper Roa');
          if (!g.teamNeedsHealing()) {
            await g.say(['Your team looks ready for anything. The fire approves.'], 'Emberkeeper Roa');
            return;
          }
          await g.healParty();
          await g.say(['There. Warm bellies, full HP. I saved your journey as well.'], 'Emberkeeper Roa');
        },
      },
      {
        id: 'kessa', x: 11, y: 13, dir: 'right', name: 'Kessa',
        look: { skin: '#f0c8a0', hair: '#3b2a24', shirt: '#7c9fc4', pants: '#3a4557', accent: '#ffb347', hat: 'bandana' },
        lines: [
          'Cinder has held that cave mouth for three winters. Nobody gets past without a battle.',
          'The bazaar sells Mythic Orbs. Expensive! But when a Voidra is staring at you, price stops mattering.',
        ],
      },
      {
        id: 'emberkid', x: 6, y: 12, dir: 'down', name: 'Tock',
        look: { skin: '#e0a878', hair: '#8a4b2a', shirt: '#ffd447', pants: '#5b4a2f', accent: '#ff7a45', hat: 'cap' },
        lines: ['I caught a Cindit all by myself! Well. Cinder helped. And it was already asleep.'],
      },
    ],
    objects: [
      { id: 'campfire', x: 8, y: 9, kind: 'campfire' },
      { id: 'forge-sign', x: 7, y: 6, kind: 'sign', text: ['THE FORGE', 'Closed for maintenance. Cinder is out front, glaring at the horizon.'] },
      { id: 'sign-ember', x: 14, y: 2, kind: 'sign', text: ['EMBERHOLD', 'North: Gloomhollow Cave. Rest at the fire.'] },
    ],
  }, rows);
}

// ---------------------------------------------------------------- Ember Bazaar
{
  const rows = paintMap(12, 9, t => {
    t.fill('i'); t.border('w');
    t.set(3, 2, 'k'); t.set(4, 2, 'k'); t.set(8, 2, 'k'); t.set(9, 2, 'k');
    t.set(4, 3, 'T'); t.set(5, 3, 'T'); t.set(7, 3, 'T'); t.set(8, 3, 'T');
    t.set(6, 8, 'i');
    t.set(1, 7, 'P'); t.set(10, 7, 'P');
  });
  MAPS.embermarket = finalize({
    id: 'embermarket', name: 'Emberhold Bazaar', w: 12, h: 9, theme: 'market', music: 'town', floorChar: 'i',
    buildings: [],
    warps: [{ x: 6, y: 8, to: 'emberhold', tx: 18, ty: 6, dir: 'down' }],
    npcs: [
      {
        id: 'kesh', x: 6, y: 3, dir: 'down', name: 'Kesh',
        look: { skin: '#8d5a3b', hair: '#2b2525', shirt: '#c25f3a', pants: '#3a2438', accent: '#ffd447', hat: 'wide' },
        onTalk: async (g) => {
          await g.say(['Rare orbs, strong potions, wares from the deep roads.', 'Money first. Curiosity second.'], 'Kesh');
          g.openShop('ember');
        },
      },
    ],
    objects: [],
  }, rows);
}

// ---------------------------------------------------------------- Gloomhollow Cave
{
  const rng = mulberry32(2020);
  const rows = paintMap(30, 22, t => {
    t.fill('X');
    t.rect(10, 17, 6, 4, 'c');
    t.rect(11, 13, 3, 5, 'c');
    t.rect(7, 9, 11, 5, 'c');
    t.rect(5, 4, 3, 6, 'c');
    t.rect(5, 0, 2, 4, 'c');
    t.rect(3, 2, 8, 4, 'c');
    t.rect(18, 8, 9, 5, 'c');
    t.rect(15, 10, 4, 2, 'c');
    t.rect(5, 0, 2, 3, 'c');
    t.rect(12, 20, 2, 2, 'c');
    // moss patches where wild Mythlings gather
    t.rect(8, 10, 3, 2, ',');
    t.rect(19, 9, 5, 3, ',');
    t.rect(11, 18, 3, 2, ',');
    t.rect(4, 3, 3, 2, ',');
    t.rect(22, 18, 4, 3, 'X');
    t.rect(1, 14, 4, 4, 'X');
    t.scatter('M', 8, 9, 9, 4, 4, rng);
    t.scatter('M', 19, 8, 7, 4, 3, rng);
    t.set(5, 0, 'c'); t.set(6, 0, 'c');
  });
  MAPS.cave = finalize({
    id: 'cave', name: 'Gloomhollow Cave', w: 30, h: 22, theme: 'cave', music: 'cave', floorChar: 'c',
    buildings: [],
    warps: [
      { x: 12, y: 21, to: 'emberhold', tx: 12, ty: 1, dir: 'down' },
      { x: 13, y: 21, to: 'emberhold', tx: 13, ty: 1, dir: 'down' },
      { x: 5, y: 0, to: 'sanctum', tx: 7, ty: 11, dir: 'up' },
      { x: 6, y: 0, to: 'sanctum', tx: 8, ty: 11, dir: 'up' },
    ],
    encounters: { rate: 0.18, min: 12, max: 17, pool: ['murklit', 'sporelle', 'duskwing', 'cindrake', 'bramblepaw'], rare: { id: 'luminox', level: 16, chance: 0.05 } },
    npcs: [
      {
        id: 'rook', x: 14, y: 18, dir: 'left', name: 'Explorer Rook',
        look: { skin: '#b7794f', hair: '#5b4a2f', shirt: '#6b5b8a', pants: '#332b3d', accent: '#7fffd4', hat: 'hood' },
        lines: [
          'Careful. The moss glows because something down here is dreaming.',
          'I have mapped every tunnel except the one at the very top. That one has a door. Doors in caves are never friendly.',
          'My lamp keeps going out when I look at it. I have decided not to look at it.',
        ],
      },
    ],
    objects: [
      { id: 'cave-item', x: 24, y: 11, kind: 'pickup', item: 'hyperpotion', qty: 2, flag: 'pickup_cave_item' },
      { id: 'crystal1', x: 9, y: 9, kind: 'crystal' },
      { id: 'crystal2', x: 23, y: 8, kind: 'crystal' },
      { id: 'crystal3', x: 4, y: 3, kind: 'crystal' },
      { id: 'cave-sign', x: 11, y: 16, kind: 'sign', text: ['A scratched warning: "THE DARK IS POLITE. DO NOT ANSWER IT."'] },
    ],
  }, rows);
}

// ---------------------------------------------------------------- Shadow Sanctum
{
  const rng = mulberry32(31415);
  const rows = paintMap(16, 14, t => {
    t.fill('X');
    t.rect(2, 2, 12, 10, 'c');
    t.rect(7, 12, 2, 2, 'c');
    t.set(7, 13, 'c'); t.set(8, 13, 'c');
    t.scatter('M', 2, 5, 3, 4, 2, rng);
    t.scatter('M', 11, 3, 3, 4, 2, rng);
  });
  MAPS.sanctum = finalize({
    id: 'sanctum', name: 'Shadow Sanctum', w: 16, h: 14, theme: 'sanctum', music: 'sanctum', floorChar: 'c',
    buildings: [],
    warps: [{ x: 7, y: 13, to: 'cave', tx: 5, ty: 2, dir: 'down' }, { x: 8, y: 13, to: 'cave', tx: 6, ty: 2, dir: 'down' }],
    npcs: [
      {
        id: 'umbra', x: 7, y: 5, dir: 'down', name: 'Shadow Adept Umbra', kind: 'trainer', finalBoss: true,
        look: { skin: '#c9b6d8', hair: '#1a1024', shirt: '#2b1a3a', pants: '#1a1024', accent: '#ff3f8f', hat: 'hood' },
        intro: [
          'So the little flame found the bottom of the world.',
          'I have watched a thousand trainers climb down here with lanterns and brave little speeches.',
          'The dark does not hate you, Rune. It simply wants a place to live. I am its landlord.',
          'Show me a bond strong enough to make even the shadows jealous.',
        ],
        team: [['murklit', 19], ['duskwing', 20], ['nocturnyx', 22], ['voidra', 24]],
        reward: 2000, beatenFlag: 'umbraBeaten',
        questId: 'umbra',
        post: [
          '...Ah. There it is. The thing I could not teach.',
          'The Hollow Star is quiet now. Not gone. Quiet. Keep an eye on the sky, trainer.',
          'Take the old road home. Tell them the dark said thank you. They will not believe you.',
        ],
      },
      {
        id: 'altar', x: 8, y: 3, dir: 'down', name: 'Hollow Altar', creature: 'voidra', hiddenUntil: 'umbraBeaten', onTalk: async (g) => { await g.riftEncounter(); },
      },
    ],
    objects: [
      { id: 'sanctum-pillar', x: 2, y: 10, kind: 'crystal' },
      { id: 'sanctum-pillar2', x: 13, y: 10, kind: 'crystal' },
    ],
  }, rows);
}

export { MAPS };
export const START_MAP = 'willowbrook';

export function getMap(id) {
  const map = MAPS[id];
  if (!map) throw new Error(`Unknown map: ${id}`);
  return map;
}

export function tileAt(map, x, y) {
  if (!map || y < 0 || y >= map.h || x < 0 || x >= map.w) return '#';
  return map.terrain[y][x];
}

export function buildingAt(map, x, y) {
  return (map.buildings || []).find(b =>
    x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h);
}

export function isBlockedTile(map, x, y) {
  if (x < 0 || y < 0 || x >= map.w || y >= map.h) return true;
  const ch = tileAt(map, x, y);
  if (BLOCKED_TILES.has(ch)) return true;
  const b = buildingAt(map, x, y);
  if (b) {
    if (b.door && b.door.x === x && b.door.y === y) return !b.warp;
    return true;
  }
  return false;
}

export function warpAt(map, x, y) {
  return (map.warps || []).find(w => w.x === x && w.y === y) || null;
}

export function npcAt(map, x, y, flags = {}) {
  return (map.npcs || []).find(n => n.x === x && n.y === y && (!n.hiddenUntil || flags[n.hiddenUntil])) || null;
}

export function objectAt(map, x, y) {
  return (map.objects || []).find(o => o.x === x && o.y === y) || null;
}

export function visibleNpcs(map, flags = {}) {
  return (map.npcs || []).filter(n => {
    if (n.hiddenUntil) return !!flags[n.hiddenUntil];
    if (n.hideWhenFlag && flags[n.hideWhenFlag]) return false;
    return true;
  });
}

export function creatureChoices() {
  return ['cindit', 'dewfin', 'spriglin'].map(id => SPECIES[id]);
}
