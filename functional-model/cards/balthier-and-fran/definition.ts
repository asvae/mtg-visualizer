import type { CardDefinition, Effect } from '../../card';

export const balthierAndFran: CardDefinition = {
  name: 'Balthier and Fran',
  manaCost: '{1}{R}{G}',
  typeLine: 'Legendary Creature — Human Rabbit',

  pt: [4, 3],
  keywords: ['Reach'],

  // `pumpAll`/`grantKeywordAll`'s `predicate` is fixed to
  // 'creatures-you-control' — a Vehicle isn't a creature (until crewed), so
  // "Vehicles you control get +1/+1 and have reach and vigilance" has no
  // matching predicate to broadcast over. Static text only.
  staticAbilities: ['Vehicles you control get +1/+1 and have reach and vigilance.'],

  triggers: [
    {
      // "there is an additional combat phase" — no turn/phase-structure
      // Effect kind exists anywhere in this model (card.ts's whole `Effect`
      // union is about a single resolution's consequences, not the turn
      // structure itself) — same "no Effect shape exists yet" honest
      // no-op `custom` cecil-dark-knight's own "Protect" ability already
      // uses for an unbuildable keyword grant.
      name: 'onCrewedVehicleAttacksFirstCombat',
      effects: [
        {
          kind: 'custom',
          describe: "you may pay {1}{R}{G}; if you do, after this combat phase, there is an additional combat phase (no phase/turn-structure Effect shape exists here)",
          run: () => {},
        } satisfies Effect,
      ],
    },
  ],
};
