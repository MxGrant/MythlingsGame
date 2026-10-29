// Consumable items and capture orbs.
export const ITEMS = {
  orb: {
    id: 'orb', name: 'Capture Orb', kind: 'orb', price: 25, orbMult: 1,
    desc: 'A glassy orb that draws wild Mythlings inside.',
  },
  greatorb: {
    id: 'greatorb', name: 'Great Orb', kind: 'orb', price: 70, orbMult: 1.8,
    desc: 'A tuned orb with a much better catch rate.',
  },
  mythicorb: {
    id: 'mythicorb', name: 'Mythic Orb', kind: 'orb', price: 400, orbMult: 4,
    desc: 'Legendary glasswork. It rarely fails.',
  },
  potion: {
    id: 'potion', name: 'Potion', kind: 'heal', price: 20, heal: 25,
    desc: 'Restores 25 HP to one Mythling.',
  },
  superpotion: {
    id: 'superpotion', name: 'Super Potion', kind: 'heal', price: 55, heal: 65,
    desc: 'Restores 65 HP to one Mythling.',
  },
  hyperpotion: {
    id: 'hyperpotion', name: 'Hyper Potion', kind: 'heal', price: 140, heal: 150,
    desc: 'Restores 150 HP to one Mythling.',
  },
  revive: {
    id: 'revive', name: 'Revive Seed', kind: 'revive', price: 110,
    desc: 'Wakes a fainted Mythling with half its HP.',
  },
  antidote: {
    id: 'antidote', name: 'Cleanse Tonic', kind: 'cure', price: 18, cures: ['poison', 'burn'],
    desc: 'Cures poison and burns.',
  },
  wakebell: {
    id: 'wakebell', name: 'Wake Bell', kind: 'cure', price: 18, cures: ['sleep'],
    desc: 'Rings a Mythling awake.',
  },
  sparkbalm: {
    id: 'sparkbalm', name: 'Spark Balm', kind: 'cure', price: 18, cures: ['paralyze'],
    desc: 'Loosens paralysed limbs.',
  },
  fullheal: {
    id: 'fullheal', name: 'Full Bloom', kind: 'cure', price: 60, cures: ['poison', 'burn', 'sleep', 'paralyze'],
    desc: 'Clears every status ailment.',
  },
  berry: {
    id: 'berry', name: 'Glowberry', kind: 'quest', price: 0,
    desc: 'A softly glowing forest berry. Willow in Fernwood wants three of these.',
  },
};

export const ITEM_LIST = Object.values(ITEMS);

export const SHOP_STOCK = ['orb', 'greatorb', 'potion', 'superpotion', 'antidote', 'wakebell', 'sparkbalm', 'revive'];
export const EMBER_SHOP_STOCK = ['greatorb', 'mythicorb', 'superpotion', 'hyperpotion', 'fullheal', 'revive'];

export function itemName(id) {
  return ITEMS[id] ? ITEMS[id].name : id;
}
