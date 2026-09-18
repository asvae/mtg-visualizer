import type { CardDefinition, Effect } from '../../card';

export const arahboTheFirstFang: CardDefinition = {
  name: 'Arahbo, the First Fang',
  manaCost: '{2}{W}',
  typeLine: 'Legendary Creature — Cat Avatar',
  pt: [2, 2],

  // Other Cats you control get +1/+1
  continuousPTGrants: [{ power: 1, toughness: 1, includeSelf: false, subtype: 'Cat' }],

  // Whenever Arahbo or another nontoken Cat you control enters, create a 1/1
  // white Cat creature token. Two real triggers cover the two real halves:
  // `onEnter` (`on:'enter'`, self-only, a real, engine-dispatched ETB) for
  // "Arahbo enters," and `onOtherCatEnters`
  // (`on:'otherPermanentEnters'`/`otherPermanentEntersMatch`, 2026-09-18
  // schema-completeness pass) for "another nontoken Cat you control
  // enters" — migrated off the prior `missingSchemaFunctionality`
  // declaration for that half now that the vocabulary exists (NOT itself
  // dispatched by `engine.ts` — no board-wide "any permanent just entered"
  // sweep exists yet for ANY card, Ward pattern — see
  // `engine-support-registry.ts`'s own
  // `other-permanent-enters-trigger-not-enforced` entry).
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
    {
      name: 'onOtherCatEnters',
      on: 'otherPermanentEnters',
      otherPermanentEntersMatch: { subtype: 'Cat', nonToken: true, sameController: true },
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
};
