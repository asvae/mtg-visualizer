import type { CardDefinition, Effect } from '../../card';

export const cephalidInkmage: CardDefinition = {
  name: 'Cephalid Inkmage',
  manaCost: '{2}{U}',
  typeLine: 'Creature — Octopus Wizard',
  pt: [2, 2],

  // Real Forge (cephalid_inkmage.txt) has NO `K:` lines at all — neither
  // "Surveil" nor "Threshold" is a real printed keyword here (Surveil is
  // just the triggered ability's own effect verb, already modeled below
  // via `kind:'surveil'`; Threshold is prose naming the static ability's
  // own condition, not a `K:` line) — neither belongs in the closed
  // `Keyword` union.
  //
  // Real Forge: `S:Mode$ CantBlockBy | ValidAttacker$ Card.Self |
  // Condition$ Threshold` — "Threshold — This creature can't be blocked as
  // long as there are seven or more cards in your graveyard." Modeled as a
  // SELF-only `continuousKeywordGrants` entry granting the pre-existing
  // `'Unblockable'` keyword (the real "can't BE blocked" fact — distinct
  // from `'CantBlock'`, the opposite combat-declaration side), gated on the
  // new `condition` field (`BoardStateCondition.kind:'graveyardCountAtLeast'`,
  // 2026-09-18 schema-completeness pass). Declaratively real but NOT itself
  // engine-enforced, for TWO independent reasons: `qualifiesForContinuousGrant`
  // never checks `condition` at all yet (Ward pattern — see
  // `engine-support-registry.ts`'s own `board-state-condition-not-enforced`
  // entry), AND separately, `engine.ts`'s own `canBlock` checks
  // `attacker.keywords.includes('Unblockable')` directly off the RAW
  // per-card `keywords` array, never `effectiveKeywords(state, card)` — so
  // even an UNCONDITIONAL `continuousKeywordGrants`-granted `'Unblockable'`
  // would not affect blocking legality today, a real, pre-existing
  // `canBlock` gap this authoring pass surfaces but does not fix (out of
  // this schema/authoring lane — `engine.ts` is `engine`-owned).
  continuousKeywordGrants: [
    {
      keywords: ['Unblockable'],
      includeSelf: true,
      condition: { kind: 'graveyardCountAtLeast', min: 7 },
    },
  ],

  triggers: [
    {
      name: 'onEnter',
      on: 'enter',
      effects: [
        {
          kind: 'surveil',
          qty: 3,
        } satisfies Effect,
      ],
    },
  ],
};
