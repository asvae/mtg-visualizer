import type { CardDefinition, Effect } from '../../card';

export const gutlessPlunderer: CardDefinition = {
  name: 'Gutless Plunderer',
  manaCost: '{2}{B}',
  typeLine: 'Creature — Skeleton Pirate',
  pt: [2, 2],

  keywords: ['Deathtouch'],

  // Migrated from `staticAbilities` to `missingSchemaFunctionality`
  // (2026-09-18, FDN schema-tightness redesign).
  missingSchemaFunctionality: [
    {
      clause: 'Raid — When this creature enters, if you attacked this turn, look at the top three cards of your library. You may put one of those cards back on top of your library. Put the rest into your graveyard.',
      demand: 'A Raid-style precondition gate on a `Trigger` ("did you attack this turn") — same missing conditional-trigger-gating capability Crypt Feaster\'s own Threshold gap names, applied to an ETB dig effect instead of a P/T pump; without it, this creature\'s own `dig` effect below fires unconditionally on every ETB, never actually checking Raid.',
    },
  ],

  triggers: [
    {
      name: 'onEnter',
      on: 'enter',
      effects: [
        {
          kind: 'dig',
          qty: 3,
          take: 1,
          optional: true,
        } satisfies Effect,
      ],
    },
  ],
};
