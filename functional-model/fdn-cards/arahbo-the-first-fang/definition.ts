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
  // nontoken Cat you control enters" half is declared via `staticAbilities` (rather than left as
  // a comment-only gap) so the existing staticAbilities-presence gate catches it structurally,
  // same "declared but with no functional counterpart" shape Inspiring Paladin's own second
  // ability already established this convention for.
  staticAbilities: ['Whenever another nontoken Cat you control enters, create a 1/1 white Cat creature token. (this engine\'s `on: \'enter\'` trigger scope only fires for the permanent\'s own ETB, not another matching permanent\'s ETB — see the trigger below and this file\'s own comment above)'],
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
};
