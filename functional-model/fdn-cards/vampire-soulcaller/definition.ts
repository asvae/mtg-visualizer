import type { CardDefinition, Effect } from '../../card';

export const vampireSoulcaller: CardDefinition = {
  name: 'Vampire Soulcaller',
  manaCost: '{4}{B}',
  typeLine: 'Creature — Vampire Warlock',
  pt: [3, 2],

  // Real "This creature can't block." `'CantBlock'` is now a real `Keyword`
  // union member (2026-09-18, schema-completeness pass) — recognized-but-
  // inert, same treatment `'Unblockable'` already gets: real enforcement
  // would need `engine.ts`'s own `canBlock`/`declareBlockers` (509.1) to
  // check this keyword on the PROPOSED BLOCKER, which they don't yet (Ward
  // pattern — see `engine-support-registry.ts`'s own
  // `cant-block-not-enforced` entry).
  keywords: ['Flying', 'CantBlock'],

  triggers: [
    {
      name: 'onEnter',
      on: 'enter',
      effects: [
        {
          kind: 'move',
          from: 'Graveyard',
          to: 'Hand',
          qty: 1,
          validType: 'creature',
          owner: 'you',
          target: true,
        } satisfies Effect,
      ],
    },
  ],
};
