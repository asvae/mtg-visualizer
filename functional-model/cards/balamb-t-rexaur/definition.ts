import type { CardDefinition, Effect } from '../../card';

export const balambTRexaur: CardDefinition = {
  name: 'Balamb T-Rexaur',
  manaCost: '{4}{G}{G}',
  typeLine: 'Creature — Dinosaur',

  pt: [6, 6],
  keywords: ['Trample'],

  triggers: [
    {
      name: 'onEnter',
      effects: [{ kind: 'gainLife', amount: 3 } satisfies Effect],
    },
  ],

  // Forestcycling {2} (ENGINE_GAPS.md gap #23, closed 2026-09-14) — see
  // cloudbound-moogle/definition.ts's own comment for the full real,
  // structured mechanism; same shape, searching for a Forest.
  abilities: [
    {
      name: 'cycling',
      cost: '{2}, Discard this card',
      effects: [{ kind: 'move', owner: 'you', from: 'Library', to: 'Hand', qty: 1, target: true, validType: 'land', subtype: 'Forest', shuffleAfter: true } satisfies Effect],
    },
  ],
};
