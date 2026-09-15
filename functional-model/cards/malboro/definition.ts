import type { CardDefinition, Effect } from '../../card';
import { basicLandcycling } from '../../cycling';

export const malboro: CardDefinition = {
  name: 'Malboro',
  manaCost: '{4}{B}{B}',
  typeLine: 'Creature — Plant Horror',

  // Swampcycling {2} (ENGINE_GAPS.md gap #23, closed 2026-09-14) — see
  // cloudbound-moogle/definition.ts's own comment for the full real,
  // structured mechanism; same shape, searching for a Swamp. `target: true`
  // removed 2026-09-15, same real bug fix as that card — see its own
  // comment for the full reasoning.
  //
  // Retrofitted onto `cycling.ts`'s own shared `basicLandcycling` factory
  // (2026-09-15, pure refactor — see that module's own doc comment).
  abilities: [basicLandcycling('Swamp', '{2}')],

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
