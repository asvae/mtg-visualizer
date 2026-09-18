import type { CardDefinition, Effect } from '../../card';

export const vampireSoulcaller: CardDefinition = {
  name: 'Vampire Soulcaller',
  manaCost: '{4}{B}',
  typeLine: 'Creature — Vampire Warlock',
  pt: [3, 2],

  keywords: ['Flying'],
  // Migrated from `staticAbilities` to `missingSchemaFunctionality`
  // (2026-09-18, FDN schema-tightness redesign).
  missingSchemaFunctionality: [
    {
      clause: "This creature can't block.",
      demand: "A can't-block static restriction on a permanent — no vocabulary anywhere in `card.ts` expresses this (a distinct gap from Crystal Barricade's own hexproof/noncombat-damage-prevention gaps, and from Cephalid Inkmage's conditional can't-BE-blocked gap — this one is an unconditional restriction on the permanent's own ability to declare AS a blocker).",
    },
  ],

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
