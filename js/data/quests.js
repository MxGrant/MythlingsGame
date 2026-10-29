// Side quests and the main story thread.
export const QUESTS = {
  research: {
    id: 'research', title: 'Field Notes',
    giver: 'Prof. Linden',
    desc: 'Catch 3 different Mythlings so the Professor can add them to the Index.',
    hint: 'Wild Mythlings live in the tall grass on Fernwood Trail. Weaken one, then toss a Capture Orb.',
    rewardText: '300 coin and 5 Capture Orbs',
    reward: { money: 300, items: { orb: 5 } },
  },
  berries: {
    id: 'berries', title: 'Sweet Glow',
    giver: 'Willow',
    desc: 'Find 3 Glowberries in Fernwood Forest for Willow\'s tarts.',
    hint: 'Glowing bushes in Fernwood hide berries. Look for the sparkle.',
    rewardText: '3 Super Potions and 200 coin',
  },
  bramble: {
    id: 'bramble', title: 'The Ranger\'s Test',
    giver: 'Ranger Bramble',
    desc: 'Defeat Ranger Bramble to earn the eastern road.',
    hint: 'Bramble waits on the east path of Fernwood Forest.',
    rewardText: '500 coin and 2 Great Orbs',
  },
  cinder: {
    id: 'cinder', title: 'A Test of Flame',
    giver: 'Pyromancer Cinder',
    desc: 'Defeat Pyromancer Cinder and earn passage into Gloomhollow Cave.',
    hint: 'Cinder stands in the plaza of Emberhold, north of the main road.',
    rewardText: '800 coin and a Mythic Orb',
  },
  umbra: {
    id: 'umbra', title: 'The Hollow Star',
    giver: 'Shadow Adept Umbra',
    desc: 'Face the Shadow Adept in the heart of the Shadow Sanctum.',
    hint: 'Follow the moss-lit path to the very top of Gloomhollow Cave.',
    rewardText: 'The valley\'s gratitude',
  },
};

export const QUEST_ORDER = ['research', 'berries', 'bramble', 'cinder', 'umbra'];

export function questProgressLine(id, state) {
  if (id === 'research') {
    const caught = Math.min(3, (state.dex && state.dex.caughtCount) || 0);
    return `Mythlings logged: ${caught}/3`;
  }
  if (id === 'berries') {
    return `Glowberries: ${Math.min(3, (state.bag && state.bag.berry) || 0)}/3`;
  }
  return null;
}
