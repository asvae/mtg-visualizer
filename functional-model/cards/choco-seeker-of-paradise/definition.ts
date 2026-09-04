import type { CardDefinition, Effect } from '../../card';

export const chocoSeekerOfParadise: CardDefinition = {
  name: 'Choco, Seeker of Paradise',
  manaCost: '{1}{G}{W}{U}',
  typeLine: 'Legendary Creature — Bird',

  pt: [3, 5],

  triggers: [
    {
      // Real script chains TWO `DB$ Dig`s: look at X (X = attacking Birds),
      // take up to 1 to hand, put the REST back near the top; then dig
      // again into THAT SAME remainder, moving any lands among it to the
      // battlefield tapped and the rest to the graveyard. `Actions.dig`
      // only returns the cards it TOOK (to hand) — the remainder it puts
      // to the bottom of library is never handed back to the caller, so a
      // `custom` effect has no way to inspect/re-sort those same cards a
      // second time. The land-to-battlefield-tapped/rest-to-graveyard half
      // is a real, cited gap; the "look at X, take up to 1 to hand" half is
      // fully real and built below. X is a real trigger-fixed fact (how
      // many Birds attacked) supplied via `triggerInput`, same convention
      // kain-traitorous-dragoon's own damage amount uses.
      name: 'onBirdsAttack',
      effects: [
        {
          kind: 'dig',
          qty: (ctx) => (ctx.triggerInput?.attackingBirdsCount as number) ?? 0,
          take: 1,
        } satisfies Effect,
      ],
    },
    {
      name: 'onLandfall',
      effects: [{ kind: 'pumpSelf', power: 1, toughness: 0 } satisfies Effect],
    },
  ],
};
