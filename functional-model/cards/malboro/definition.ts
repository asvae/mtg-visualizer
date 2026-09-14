import type { CardDefinition, Effect } from '../../card';

export const malboro: CardDefinition = {
  name: 'Malboro',
  manaCost: '{4}{B}{B}',
  typeLine: 'Creature — Plant Horror',

  // Swampcycling {2} (ENGINE_GAPS.md gap #23, closed 2026-09-14) — see
  // cloudbound-moogle/definition.ts's own comment for the full real,
  // structured mechanism; same shape, searching for a Swamp.
  abilities: [
    {
      name: 'cycling',
      cost: '{2}, Discard this card',
      effects: [{ kind: 'move', owner: 'you', from: 'Library', to: 'Hand', qty: 1, target: true, validType: 'land', subtype: 'Swamp', shuffleAfter: true } satisfies Effect],
    },
  ],

  triggers: [
    {
      name: 'onEnter',
      effects: [
        { kind: 'discard', owner: 'opponents', qty: 1 } satisfies Effect,
        { kind: 'loseLife', owner: 'opponents', amount: 2 } satisfies Effect,
        { kind: 'move', owner: 'opponents', from: 'Library', to: 'Exile', qty: 3 } satisfies Effect,
      ],
    },
  ],
};
