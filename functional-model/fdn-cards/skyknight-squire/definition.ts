import type { CardDefinition, Effect } from '../../card';

export const skyknightSquire: CardDefinition = {
  name: 'Skyknight Squire',
  manaCost: '{1}{W}',
  typeLine: 'Creature — Cat Scout',
  pt: [1, 1],

  // Real Forge: `T:Mode$ ChangesZone | Origin$ Any | Destination$
  // Battlefield | ValidCard$ Creature.YouCtrl+Other` — "Whenever another
  // creature you control enters, put a +1/+1 counter on this creature." A
  // board-wide watch for some OTHER permanent's own entrance, genuinely
  // distinct from `on:'enter'` (self-only) — now expressed via
  // `Trigger.on:'otherPermanentEnters'` + `otherPermanentEntersMatch`
  // (2026-09-18, schema-completeness pass): `sameController: true`, no
  // `subtype`/`nonToken` filter (every OTHER creature you control
  // qualifies, unlike Arahbo's own narrower "nontoken Cat" filter). NOT
  // itself dispatched by `engine.ts` — no board-wide "any permanent just
  // entered" sweep exists yet for ANY card (Ward pattern — see
  // `engine-support-registry.ts`'s own
  // `other-permanent-enters-trigger-not-enforced` entry).
  triggers: [
    {
      name: 'onOtherCreatureEnters',
      on: 'otherPermanentEnters',
      otherPermanentEntersMatch: { sameController: true },
      effects: [
        {
          kind: 'putCounter',
          target: 'self',
          counterType: '+1/+1',
          amount: 1,
        } satisfies Effect,
      ],
    },
  ],

  // Real Forge static ability: "As long as this creature has three or more
  // +1/+1 counters on it, it has flying and is a Knight in addition to its
  // other types." Modeled as two SELF-only continuous grants (one keyword,
  // one type), each gated on the new `condition` field
  // (`BoardStateCondition.kind:'selfCounterCountAtLeast'`, 2026-09-18
  // schema-completeness pass) — declaratively real but NOT itself engine-
  // enforced yet (`qualifiesForContinuousGrant` never checks `condition`,
  // Ward pattern — see `engine-support-registry.ts`'s own
  // `board-state-condition-not-enforced` entry).
  continuousKeywordGrants: [
    {
      keywords: ['Flying'],
      includeSelf: true,
      condition: { kind: 'selfCounterCountAtLeast', counterType: '+1/+1', min: 3 },
    },
  ],
  continuousTypeGrants: [
    {
      types: ['Knight'],
      includeSelf: true,
      condition: { kind: 'selfCounterCountAtLeast', counterType: '+1/+1', min: 3 },
    },
  ],
};
