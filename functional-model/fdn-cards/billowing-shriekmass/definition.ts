import type { CardDefinition, Effect } from '../../card';

export const billowingShriekmass: CardDefinition = {
  name: 'Billowing Shriekmass',
  manaCost: '{3}{B}',
  typeLine: 'Creature — Spirit',
  pt: [2, 3],

  keywords: ['Flying'],

  triggers: [
    {
      name: 'onEnter',
      on: 'enter',
      effects: [
        {
          kind: 'mill',
          owner: 'you',
          amount: 3,
        } satisfies Effect,
      ],
    },
  ],

  // Migrated from `staticAbilities` to `missingSchemaFunctionality`
  // (2026-09-18, FDN schema-tightness redesign) — the `continuousPTGrants`
  // entry below is UNCONDITIONAL (no threshold-gating field exists on that
  // type at all), so this card is currently approximated as ALWAYS having
  // +2/+1, not gated on the real 7+-graveyard-cards condition — same
  // established "approximate as always-on when no conditional mechanism
  // exists" simplification Crypt Feaster's own Threshold trigger already
  // documents, not a silent, undocumented bug.
  missingSchemaFunctionality: [
    {
      clause: 'Threshold — This creature gets +2/+1 as long as there are seven or more cards in your graveyard.',
      demand: 'A CONDITIONAL variant of `continuousPTGrants` — today\'s entries apply unconditionally; need a graveyard-count (or general board-state) threshold gate on a self-targeting P/T grant, since the unconditional `{power:2, toughness:1, includeSelf:true}` entry below is only an approximation of the real always-checked Threshold condition.',
    },
  ],

  // Threshold condition: +2/+1 if 7+ cards in graveyard (see the real,
  // unconditional-approximation gap declared above)
  continuousPTGrants: [
    {
      power: 2,
      toughness: 1,
      includeSelf: true,
    },
  ],
};
