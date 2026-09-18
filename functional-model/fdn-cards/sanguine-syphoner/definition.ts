import type { CardDefinition, Effect } from '../../card';

export const sanguineSyphoner: CardDefinition = {
  name: 'Sanguine Syphoner',
  manaCost: '{1}{B}',
  typeLine: 'Creature — Vampire Warlock',
  pt: [1, 3],

  // Real Forge: `Mode$ Attacks | ValidCard$ Card.Self` — a real self-attack
  // auto-fire trigger.
  triggers: [
    {
      name: 'onAttack',
      on: 'attacks',
      effects: [
        {
          kind: 'loseLife',
          owner: 'opponents',
          amount: 1,
        } satisfies Effect,
        {
          kind: 'gainLife',
          amount: 1,
        } satisfies Effect,
      ],
    },
  ],
};
