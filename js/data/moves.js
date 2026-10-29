// Every move in Mythlings. power === 0 means a status move.
// effect.status  -> { name, chance }
// effect.stat    -> { target: 'self' | 'foe', key: 'atk'|'def'|'spd', stages }
// effect.heal    -> fraction of max HP restored to the user
// effect.drain   -> fraction of damage dealt restored to the user
// effect.recoil  -> fraction of damage dealt taken by the user
export const MOVES = {
  // ---- Neutral ----
  tackle:      { id: 'tackle',      name: 'Tackle',      type: 'Neutral',  power: 40, accuracy: 100, pp: 35, desc: 'A cheerful full-body charge.' },
  pounce:      { id: 'pounce',      name: 'Pounce',      type: 'Neutral',  power: 55, accuracy: 95,  pp: 25, desc: 'Leaps onto the foe with soft paws.' },
  gnaw:        { id: 'gnaw',        name: 'Gnaw',        type: 'Neutral',  power: 45, accuracy: 100, pp: 30, desc: 'A quick nibble that never misses twice.' },
  bodyslam:    { id: 'bodyslam',    name: 'Body Slam',   type: 'Neutral',  power: 78, accuracy: 90,  pp: 12, desc: 'A heavy slam. The user is hurt a little too.', effect: { recoil: 0.25 } },
  swiftdash:   { id: 'swiftdash',   name: 'Swift Dash',  type: 'Neutral',  power: 45, accuracy: 100, pp: 20, priority: 1, desc: 'Always strikes first.' },
  growl:       { id: 'growl',       name: 'Growl',       type: 'Neutral',  power: 0,  accuracy: 100, pp: 25, desc: "A tiny roar that softens the foe's attack.", effect: { stat: { target: 'foe', key: 'atk', stages: -1 } } },
  harden:      { id: 'harden',      name: 'Harden',      type: 'Neutral',  power: 0,  accuracy: null, pp: 20, desc: 'Tenses up to raise defence.', effect: { stat: { target: 'self', key: 'def', stages: 1 } } },
  focus:       { id: 'focus',       name: 'Focus',       type: 'Neutral',  power: 0,  accuracy: null, pp: 20, desc: 'Steadies the mind to raise attack.', effect: { stat: { target: 'self', key: 'atk', stages: 1 } } },

  // ---- Fire ----
  ember:       { id: 'ember',       name: 'Ember',       type: 'Fire',     power: 40, accuracy: 100, pp: 25, desc: 'A puff of warm sparks.', effect: { status: { name: 'burn', chance: 10 } } },
  flamefang:   { id: 'flamefang',   name: 'Flame Fang',  type: 'Fire',     power: 58, accuracy: 95,  pp: 20, desc: 'A blazing bite.', effect: { status: { name: 'burn', chance: 20 } } },
  cinderrush:  { id: 'cinderrush',  name: 'Cinder Rush', type: 'Fire',     power: 72, accuracy: 95,  pp: 15, desc: 'A scorching tackle wrapped in ash.' },
  kindle:      { id: 'kindle',      name: 'Kindle',      type: 'Fire',     power: 0,  accuracy: null, pp: 15, desc: 'Fans the inner flame to raise attack.', effect: { stat: { target: 'self', key: 'atk', stages: 1 } } },
  inferno:     { id: 'inferno',     name: 'Inferno Bloom', type: 'Fire',   power: 94, accuracy: 85,  pp: 8,  desc: 'A flower of flame bursts open.', effect: { status: { name: 'burn', chance: 30 } } },
  smokeblast:  { id: 'smokeblast',  name: 'Smoke Blast', type: 'Fire',     power: 0,  accuracy: 100, pp: 15, desc: 'Choking smoke lowers the foe\'s attack.', effect: { stat: { target: 'foe', key: 'atk', stages: -1 } } },

  // ---- Water ----
  splash:      { id: 'splash',      name: 'Splash',      type: 'Water',    power: 35, accuracy: 100, pp: 30, desc: 'A sloppy splash of cold water.' },
  aquajet:     { id: 'aquajet',     name: 'Aqua Jet',    type: 'Water',    power: 50, accuracy: 100, pp: 20, priority: 1, desc: 'Rockets forward on a jet of water.' },
  torrent:     { id: 'torrent',     name: 'Torrent',     type: 'Water',    power: 74, accuracy: 95,  pp: 15, desc: 'A rolling wall of water.' },
  mistveil:    { id: 'mistveil',    name: 'Mist Veil',   type: 'Water',    power: 0,  accuracy: null, pp: 15, desc: 'A cloak of mist raises defence.', effect: { stat: { target: 'self', key: 'def', stages: 1 } } },
  tidalcrash:  { id: 'tidalcrash',  name: 'Tidal Crash', type: 'Water',    power: 94, accuracy: 80,  pp: 8,  desc: 'The ocean itself slams down.' },
  soak:        { id: 'soak',        name: 'Soak',        type: 'Water',    power: 0,  accuracy: 100, pp: 15, desc: 'Drenches the foe, lowering speed.', effect: { stat: { target: 'foe', key: 'spd', stages: -1 } } },

  // ---- Grass ----
  leaftap:     { id: 'leaftap',     name: 'Leaf Tap',    type: 'Grass',    power: 35, accuracy: 100, pp: 30, desc: 'A playful swat with a broad leaf.' },
  vinewhip:    { id: 'vinewhip',    name: 'Vine Whip',   type: 'Grass',    power: 54, accuracy: 95,  pp: 22, desc: 'Lashes with a springy vine.' },
  bloomburst:  { id: 'bloomburst',  name: 'Bloom Burst', type: 'Grass',    power: 72, accuracy: 95,  pp: 15, desc: 'Petals explode outward in a ring.' },
  spore:       { id: 'spore',       name: 'Spore Puff',  type: 'Grass',    power: 0,  accuracy: 75,  pp: 12, desc: 'Sleepy spores drift over the foe.', effect: { status: { name: 'sleep', chance: 100 } } },
  photosynth:  { id: 'photosynth',  name: 'Photosynth',  type: 'Grass',    power: 0,  accuracy: null, pp: 10, desc: 'Drinks sunlight to restore health.', effect: { heal: 0.4 } },
  forestwrath: { id: 'forestwrath', name: 'Forest Wrath',type: 'Grass',    power: 94, accuracy: 80,  pp: 8,  desc: 'Ancient roots erupt from below.' },
  leechbite:   { id: 'leechbite',   name: 'Leech Bite',  type: 'Grass',    power: 55, accuracy: 95,  pp: 15, desc: 'Saps vitality with thorny fangs.', effect: { drain: 0.5 } },

  // ---- Electric ----
  spark:       { id: 'spark',       name: 'Spark',       type: 'Electric', power: 38, accuracy: 100, pp: 30, desc: 'A crackling static nip.', effect: { status: { name: 'paralyze', chance: 15 } } },
  zaptail:     { id: 'zaptail',     name: 'Zap Tail',    type: 'Electric', power: 55, accuracy: 95,  pp: 22, desc: 'A tail whip with a live current.', effect: { status: { name: 'paralyze', chance: 10 } } },
  voltlance:   { id: 'voltlance',   name: 'Volt Lance',  type: 'Electric', power: 76, accuracy: 90,  pp: 12, desc: 'A spear of blue lightning.', effect: { status: { name: 'paralyze', chance: 10 } } },
  charge:      { id: 'charge',      name: 'Charge Up',   type: 'Electric', power: 0,  accuracy: null, pp: 15, desc: 'Builds a charge to raise speed.', effect: { stat: { target: 'self', key: 'spd', stages: 1 } } },
  staticfield: { id: 'staticfield', name: 'Static Field',type: 'Electric', power: 0,  accuracy: 85,  pp: 10, desc: 'A field of static paralyses the foe.', effect: { status: { name: 'paralyze', chance: 100 } } },
  thunderstorm:{ id: 'thunderstorm',name: 'Thunderstorm',type: 'Electric', power: 94, accuracy: 80,  pp: 8,  desc: 'A storm gathers in a single bolt.', effect: { status: { name: 'paralyze', chance: 20 } } },

  // ---- Shadow ----
  shadownip:   { id: 'shadownip',   name: 'Shadow Nip',  type: 'Shadow',   power: 36, accuracy: 100, pp: 30, desc: 'A bite from the dark itself.' },
  gloomslash:  { id: 'gloomslash',  name: 'Gloom Slash', type: 'Shadow',   power: 56, accuracy: 95,  pp: 20, desc: 'Claws rake through a smear of gloom.' },
  haunt:       { id: 'haunt',       name: 'Haunt',       type: 'Shadow',   power: 0,  accuracy: 100, pp: 15, desc: 'Creepy whispers lower the foe\'s attack.', effect: { stat: { target: 'foe', key: 'atk', stages: -1 } } },
  nightterror: { id: 'nightterror', name: 'Night Terror',type: 'Shadow',   power: 76, accuracy: 90,  pp: 12, desc: 'A waking nightmare strikes.' },
  lifedrain:   { id: 'lifedrain',   name: 'Life Siphon', type: 'Shadow',   power: 60, accuracy: 95,  pp: 12, desc: 'Steals warmth and returns it as health.', effect: { drain: 0.6 } },
  voidrend:    { id: 'voidrend',    name: 'Void Rend',   type: 'Shadow',   power: 96, accuracy: 80,  pp: 6,  desc: 'Tears a hole in the world.' },
  blight:      { id: 'blight',      name: 'Blight Puff', type: 'Shadow',   power: 0,  accuracy: 85,  pp: 12, desc: 'A cloud of creeping blight poisons the foe.', effect: { status: { name: 'poison', chance: 100 } } },
};

export const MOVE_LIST = Object.values(MOVES);

export const STRUGGLE = {
  id: 'struggle', name: 'Struggle', type: 'Neutral', power: 42, accuracy: null, pp: 1,
  desc: 'A desperate flail used when out of PP.', effect: { recoil: 0.25 },
};

export function getMove(id) {
  return MOVES[id] || STRUGGLE;
}
