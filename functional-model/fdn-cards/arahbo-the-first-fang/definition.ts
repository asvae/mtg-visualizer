import type { CardDefinition, Effect } from '../../card';

export const arahboTheFirstFang: CardDefinition = {
  name: 'Arahbo, the First Fang',
  manaCost: '{2}{W}',
  typeLine: 'Legendary Creature — Cat Avatar',
  pt: [2, 2],

  // Other Cats you control get +1/+1
  continuousPTGrants: [{ power: 1, toughness: 1, includeSelf: false, subtype: 'Cat' }],

  // Whenever Arahbo or another nontoken Cat you control enters, create a 1/1 white Cat creature token.
  // Note: Current engine only models ETB triggers on self; firing when OTHER nontoken Cats enter
  // requires a gap closure (ENGINE_GAPS.md) — no ValidCard$ filter/condition on this trigger yet.
  // The `on: 'enter'` trigger below correctly covers the "Arahbo enters" half of this clause (a
  // real, self-only ETB, `card.ts`'s own documented scope for that `on` value) — the "another
  // nontoken Cat you control enters" half is declared via `missingSchemaFunctionality` (migrated
  // out of `staticAbilities`, 2026-09-18, FDN schema-tightness redesign) rather than left as a
  // comment-only gap, same "declared but with no functional counterpart" shape Inspiring Paladin's
  // own second ability already established this convention for.
  missingSchemaFunctionality: [
    {
      clause: 'Whenever another nontoken Cat you control enters, create a 1/1 white Cat creature token. (the "another...Cat...enters" half specifically — the "Arahbo enters" half is genuinely covered by the on:\'enter\' trigger below)',
      demand: "`Trigger.on:'enter'` only fires for the permanent's OWN entrance, never as a board-wide watch for OTHER matching permanents entering — need either a new `on` value (e.g. `'otherPermanentEnters'` with a type/subtype filter) or a general `ValidCard$`-style filtered watch-trigger mechanism.",
    },
  ],
  triggers: [
    {
      name: 'onEnter',
      on: 'enter',
      effects: [
        {
          kind: 'createToken',
          token: {
            name: 'Cat',
            manaCost: '0',
            types: ['Creature', 'Cat'],
            basePower: 1,
            baseToughness: 1,
          },
          amount: 1,
        } satisfies Effect,
      ],
    },
  ],

  // Coverage-justification manifest — moved out to a real, SPAN-VERIFIED
  // functional-model/fdn-cards/arahbo-the-first-fang/justification.json
  // (2026-09-18, later still — the justification.json redesign, see
  // `.claude/contracts/card-schema.md`). No longer an inline field on
  // CardDefinition at all — see coverage-justification.ts's own header.
  // The "Whenever Arahbo ... enters" trigger clause is a real, checked-in
  // example of a MULTI-SPAN entry (two disjoint real spans — "Whenever
  // Arahbo" and "enters, create a 1/1 white Cat creature token" — under one
  // coverage claim), since the real, uncovered "or another nontoken Cat you
  // control" middle sits between them and can't be included without
  // misrepresenting it as covered.
};
