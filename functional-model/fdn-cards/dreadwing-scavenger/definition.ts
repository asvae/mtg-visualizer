import type { CardDefinition, Effect } from '../../card';

// Real Forge (dreadwing_scavenger.txt): two triggers (`Mode$ ChangesZone`
// self-ETB and `Mode$ Attacks | ValidCard$ Card.Self`, both `Execute$
// TrigDraw`) sharing the identical real effect body — modeled as two
// separate real `on:'enter'`/`on:'attacks'` triggers rather than one
// (this schema has no single trigger that dispatches on either event).
// `S:Mode$ Continuous | ... | Condition$ Threshold` is the real, now-
// modelable Threshold template (`ContinuousGrantTargeting.condition`,
// 2026-09-18 schema-completeness pass).
export const dreadwingScavenger: CardDefinition = {
  name: 'Dreadwing Scavenger',
  manaCost: '{1}{U}{B}',
  typeLine: 'Creature — Nightmare Bird',
  pt: [2, 2],
  keywords: ['Flying'],

  continuousPTGrants: [{ power: 1, toughness: 1, includeSelf: true, condition: { kind: 'graveyardCountAtLeast', min: 7 } }],
  continuousKeywordGrants: [{ keywords: ['Deathtouch'], includeSelf: true, condition: { kind: 'graveyardCountAtLeast', min: 7 } }],

  triggers: [
    {
      name: 'onEnter',
      on: 'enter',
      effects: [{ kind: 'drawCard', amount: 1 } satisfies Effect, { kind: 'discard', owner: 'you', qty: 1 } satisfies Effect],
    },
    {
      name: 'onAttacks',
      on: 'attacks',
      effects: [{ kind: 'drawCard', amount: 1 } satisfies Effect, { kind: 'discard', owner: 'you', qty: 1 } satisfies Effect],
    },
  ],
};
