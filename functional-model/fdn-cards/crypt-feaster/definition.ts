import type { CardDefinition, Effect } from '../../card';

export const cryptFeaster: CardDefinition = {
  name: 'Crypt Feaster',
  manaCost: '{3}{B}',
  typeLine: 'Creature — Zombie',
  pt: [3, 4],

  keywords: ['Menace'],

  staticAbilities: [
    'Threshold — Whenever this creature attacks, if there are seven or more cards in your graveyard, this creature gets +2/+0 until end of turn.',
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
