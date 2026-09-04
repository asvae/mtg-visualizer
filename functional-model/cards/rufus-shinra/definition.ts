import type { CardDefinition, Effect } from '../../card';

// Real script (rufus_shinra.txt): the attack trigger is gated
// `IsPresent$ Creature.YouCtrl+namedDarkstar | PresentCompare$ EQ0` — "if
// you don't control a creature named Darkstar." No Effect field checks "a
// specific NAMED creature already controlled" declaratively, but
// `createToken`'s own `amount` is `Computed<number>` — the narrow, real
// escape hatch this exact shape is for (see card.ts's own doc comment on
// `Computed`) — so the gate lives there instead of a `custom` wrapping the
// whole effect. NOTE: no `PlayerState` field can seed a creature with a
// SPECIFIC real name (every generated filler card is named
// `<player>-creature-...`), so only the "you don't control Darkstar"
// (amount 1) branch is scenario-testable — same class of gap
// summon-fenrir's own land-search comment already documents for an
// unseedable real-card fact.
export const rufusShinra: CardDefinition = {
  name: 'Rufus Shinra',
  manaCost: '{1}{W}{B}',
  typeLine: 'Legendary Creature — Human Noble',

  pt: [2, 4],

  triggers: [
    {
      name: 'onAttacks',
      effects: [
        {
          kind: 'createToken',
          token: { name: 'Darkstar', manaCost: '0', types: ['Legendary', 'Creature', 'Dog'], basePower: 2, baseToughness: 2 },
          amount: (ctx) => (ctx.you.getCreaturesInPlay().some((c) => c.getName() === 'Darkstar') ? 0 : 1),
        } satisfies Effect,
      ],
    },
  ],
};
