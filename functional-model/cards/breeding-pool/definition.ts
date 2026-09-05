import type { CardDefinition, Effect } from '../../card';

export const breedingPool: CardDefinition = {
  name: 'Breeding Pool',
  manaCost: '',
  typeLine: 'Land — Forest Island',

  // Mana ability is documentary (no engine support). "As this land enters,
  // you may pay 2 life. If you don't, it enters tapped." — a real binary
  // choice with no player-decision engine anywhere (same "always takes the
  // action" simplification `optional` fields elsewhere document): modeled
  // as ALWAYS paying the 2 life, never entering tapped — the untapped/
  // paid-life branch, not the tapped/free branch.
  staticAbilities: ['{T}: Add {G} or {U}.'],
  triggers: [{ name: 'onEnter', effects: [{ kind: 'loseLife', owner: 'you', amount: 2 } satisfies Effect] }],
};
