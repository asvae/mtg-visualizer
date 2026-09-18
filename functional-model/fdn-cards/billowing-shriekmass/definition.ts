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

  // Real Threshold — the "7+ cards in graveyard" gate is now a real
  // `ContinuousGrantTargeting.condition`
  // (`BoardStateCondition.kind:'graveyardCountAtLeast'`, 2026-09-18
  // schema-completeness pass) — declaratively real but NOT itself
  // engine-enforced yet (`qualifiesForContinuousGrant` never checks it,
  // Ward pattern — see `engine-support-registry.ts`'s own
  // `board-state-condition-not-enforced` entry), so this grant still
  // applies unconditionally in practice, same as before this field
  // existed; the real gate is now at least structurally declared instead
  // of silently approximated as always-on.
  continuousPTGrants: [
    {
      power: 2,
      toughness: 1,
      includeSelf: true,
      condition: { kind: 'graveyardCountAtLeast', min: 7 },
    },
  ],
};
