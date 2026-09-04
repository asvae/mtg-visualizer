import type { CardDefinition, Effect } from '../../card';

// Real script (the_wandering_minstrel.txt).
export const theWanderingMinstrel: CardDefinition = {
  name: 'The Wandering Minstrel',
  manaCost: '{G}{U}',
  typeLine: 'Legendary Creature — Human Bard',

  pt: [1, 3],

  // "Lands you control enter untapped." Real `R:Event$ Moved | ...` — a
  // replacement effect, an explicitly out-of-scope deferred gap (no
  // cost-reduction/replacement-effect machinery anywhere in this model) —
  // kept as real, structured text.
  staticAbilities: ['Lands you control enter untapped.'],

  triggers: [
    {
      // "The Minstrel's Ballad — At the beginning of combat on your turn,
      // if you control five or more Towns, create a 2/2 Elemental creature
      // token that's all colors." Same `Computed`-on-`amount` gate
      // rufus-shinra's own identical "if you control [X]" shape already
      // uses. NOTE: no `PlayerState` field can seed a land's SUBTYPE
      // (Town) — every generic `landsCount` filler is subtype-less — so
      // only the below-five-Towns (amount 0) branch is scenario-testable,
      // same unseedable-real-fact gap this batch's other cards hit.
      name: 'onBeginCombat',
      effects: [
        {
          kind: 'createToken',
          token: { name: 'Elemental', manaCost: '0', types: ['Creature', 'Elemental'], basePower: 2, baseToughness: 2 },
          amount: (ctx) => (ctx.you.getCardsIn('Battlefield').filter((c) => c.isLand() && c.hasSubtype('Town')).length >= 5 ? 1 : 0),
        } satisfies Effect,
      ],
    },
  ],

  // "{3}{W}{U}{B}{R}{G}: Other creatures you control get +X/+X until end
  // of turn, where X is the number of Towns you control." Same Town-count
  // read as the trigger above, on `pumpAll`'s own `power`/`toughness`
  // Computed fields — same unseedable-Town-subtype testability gap.
  activationCost: '{3}{W}{U}{B}{R}{G}',
  effects: [
    {
      kind: 'pumpAll',
      predicate: 'creatures-you-control',
      notSelf: true,
      power: (ctx) => ctx.you.getCardsIn('Battlefield').filter((c) => c.isLand() && c.hasSubtype('Town')).length,
      toughness: (ctx) => ctx.you.getCardsIn('Battlefield').filter((c) => c.isLand() && c.hasSubtype('Town')).length,
    } satisfies Effect,
  ],
};
