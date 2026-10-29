// Elemental types and the battle effectiveness chart for Mythlings.
export const TYPES = ['Neutral', 'Fire', 'Water', 'Grass', 'Electric', 'Shadow'];

export const TYPE_INFO = {
  Neutral:  { color: '#cfc9b8', dark: '#6f6a5c', light: '#f1ecdd', glyph: '◆' },
  Fire:     { color: '#ff7a45', dark: '#922f12', light: '#ffc59a', glyph: '✦' },
  Water:    { color: '#4fa9ff', dark: '#1c4f85', light: '#b6deff', glyph: '≈' },
  Grass:    { color: '#63c96b', dark: '#22662c', light: '#c2f0a8', glyph: '❧' },
  Electric: { color: '#ffd447', dark: '#9c7304', light: '#fff3b0', glyph: 'ϟ' },
  Shadow:   { color: '#a56bd6', dark: '#4e2570', light: '#ddbcf5', glyph: '✶' },
};

// Attacker type -> defender type. Anything not listed is neutral (1x).
// Every element is strong against two, weak against two, and resists two.
const CHART = {
  Fire:     { Grass: 2, Shadow: 2, Water: 0.5, Electric: 0.5, Fire: 0.5 },
  Grass:    { Water: 2, Electric: 2, Fire: 0.5, Shadow: 0.5, Grass: 0.5 },
  Water:    { Fire: 2, Shadow: 2, Grass: 0.5, Electric: 0.5, Water: 0.5 },
  Electric: { Water: 2, Fire: 2, Grass: 0.5, Shadow: 0.5, Electric: 0.5 },
  Shadow:   { Grass: 2, Electric: 2, Fire: 0.5, Water: 0.5, Shadow: 0.5 },
};

export function typeMultiplier(attackType, defenderTypes = []) {
  let mult = 1;
  for (const def of defenderTypes) {
    const row = CHART[attackType];
    if (row && row[def] != null) mult *= row[def];
  }
  return mult;
}

export function effectivenessText(mult) {
  if (mult >= 2) return "It's super effective!";
  if (mult > 0 && mult <= 0.5) return "It's not very effective...";
  return null;
}

// Matchup hint used by the dex / move list.
export function strongAgainst(type) {
  return TYPES.filter(t => typeMultiplier(type, [t]) === 2);
}
export function weakAgainst(type) {
  return TYPES.filter(t => typeMultiplier(t, [type]) === 2);
}
