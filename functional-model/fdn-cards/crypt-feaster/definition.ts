import type { CardDefinition, Effect } from '../../card';

export const cryptFeaster: CardDefinition = {
  name: 'Crypt Feaster',
  manaCost: '{3}{B}',
  typeLine: 'Creature — Zombie',
  pt: [3, 4],

  keywords: ['Menace'],

  // Migrated from `staticAbilities` to `missingSchemaFunctionality`
  // (2026-09-18, FDN schema-tightness redesign).
  missingSchemaFunctionality: [
    {
      clause: 'Threshold — Whenever this creature attacks, if there are seven or more cards in your graveyard, this creature gets +2/+0 until end of turn.',
      demand: 'A conditional-trigger gating mechanism on `Trigger` — no field lets a trigger\'s own resolution be gated on a live board-state condition (here, own graveyard count >= 7) before its effects apply; today `on:\'attacks\'` always fires unconditionally once declared, which is why the `onAttack` trigger below applies the pump every attack instead of only past the Threshold.',
    },
  ],

  // Real Forge: `Mode$ Attacks | ValidCard$ Card.Self` — a real self-attack
  // auto-fire trigger, `on: 'attacks'`. The Threshold condition itself (7+
  // cards in graveyard) has no gating mechanism on `Trigger` — same
  // accepted, already-established pool-wide simplification (no
  // conditional-trigger checking exists anywhere in this model), so the
  // pump always applies once this fires.
  triggers: [
    {
      name: 'onAttack',
      on: 'attacks',
      effects: [
        {
          kind: 'pumpSelf',
          power: 2,
          toughness: 0,
          untilEndOfTurn: true,
        } satisfies Effect,
      ],
    },
  ],
};
