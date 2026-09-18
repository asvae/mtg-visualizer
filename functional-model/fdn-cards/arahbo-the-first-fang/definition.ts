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

  // Coverage-justification manifest (2026-09-18, FDN schema-tightness
  // redesign proof-of-concept — see `.claude/contracts/card-schema.md`).
  // Real printed oracle text: "Other Cats you control get +1/+1.\nWhenever
  // Arahbo or another nontoken Cat you control enters, create a 1/1 white
  // Cat creature token." — 2 sentences, the second genuinely splitting into
  // an Arahbo-only half (covered) and an other-Cats half (a real,
  // partial-coverage gap — see `missingSchemaFunctionality` above).
  coverageJustification: [
    {
      clause: 'Other Cats you control get +1/+1.',
      coveredBy: { kind: 'field', field: 'continuousPTGrants' },
      reasoning: "This card's own `continuousPTGrants` entry (`{power:1, toughness:1, includeSelf:false, subtype:'Cat'}`) is the exact, unconditional, 613.3/layer-7c broadcast this sentence describes — self excluded (\"OTHER Cats\"), scoped to the `'Cat'` subtype, no counter/duration qualifier printed.",
    },
    {
      clause: "Whenever Arahbo ... enters, create a 1/1 white Cat creature token.",
      coveredBy: { kind: 'trigger', name: 'onEnter' },
      reasoning: "The `onEnter` trigger (`on:'enter'`, this engine's real self-only ETB auto-fire scope) fires when Arahbo itself enters and runs the `createToken` effect that creates the real 1/1 Cat token — fully covers the \"Arahbo enters\" half of this sentence.",
    },
    {
      clause: '...or another nontoken Cat you control enters, create a 1/1 white Cat creature token.',
      coveredBy: { kind: 'missingSchemaFunctionality', index: 0 },
      reasoning: 'The "another nontoken Cat enters" half is genuinely uncovered — `on:\'enter\'` structurally cannot watch a DIFFERENT permanent\'s own ETB, so this half is declared as a real capacity gap rather than silently approximated or dropped.',
    },
  ],
};
