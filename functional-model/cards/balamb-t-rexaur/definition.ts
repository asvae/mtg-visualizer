import type { CardDefinition, Effect } from '../../card';
import { basicLandcycling } from '../../cycling';

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
  // structured mechanism; same shape, searching for a Forest. `target: true`
  // removed 2026-09-15, same real bug fix as that card — see its own
  // comment for the full reasoning.
  //
  // Retrofitted onto `cycling.ts`'s own shared `basicLandcycling` factory
  // (2026-09-15, pure refactor — see that module's own doc comment).
  abilities: [basicLandcycling('Forest', '{2}')],
};
