import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

// The hardest card in this batch — a transforming DFC whose back face is
// ALSO a Saga. CardDefinition has no built-in idea of a second face or of
// Saga chapters; rather than force a one-off abstraction for exactly one
// card, this reuses machinery that already exists for other reasons:
//   - `backFace` is just another, independent `CardDefinition` (see
//     card.ts's own doc comment on the field).
//   - A Saga's chapter abilities become that back face's own `triggers`,
//     named `chapterI`/`chapterII`/`chapterIII` — the SAME `triggers`
//     mechanism Namazu Trader uses for its ETB vs. attack trigger. This is
//     a real simplification worth naming: 714.3a/b confirms a Saga's own
//     lore-counter/chapter mechanism is a TURN-BASED ACTION, not a
//     triggered ability (no `to: "stack"`, no interruption window) — SCHEMA.md
//     §8 flags this exact card as the place that distinction was never
//     fully resolved. Modeling chapters as `triggers` here trades that
//     precision for reusing existing, tested machinery instead of adding a
//     third mechanism (turn-based actions) for one card. If a future card
//     needs the distinction to matter (something that specifically cares
//     "was this really a trigger"), `triggers` should probably gain a
//     `stackBased?: boolean` flag rather than inventing a parallel list.
//   - The front face's own "exile this, then return it transformed" is a
//     `custom` effect — real Forge's `RememberChanged$`/re-entry-as-a-
//     specific-other-face has no clean declarative shape here (this
//     prototype's `CardDefinition` has no notion of "which face is
//     currently showing" as game state at all), and forcing one for a
//     single card would be a worse trade than an honestly opaque `custom`.
export const jechtReluctantGuardian: CardDefinition = {
  name: 'Jecht, Reluctant Guardian',
  manaCost: '{3}{B}',
  typeLine: 'Legendary Creature — Human Warrior',

  staticAbilities: ['Menace'],

  triggers: [
    {
      name: 'onDealsDamage',
      effects: [
        {
          kind: 'custom',
          describe: "combat damage to a player: you may exile this, then return it to the battlefield transformed under its owner's control",
          run: (ctx: EffectContext, actions: Actions) => {
            actions.moveTo(ctx.self, 'Exile');
            actions.moveTo(ctx.self, 'Battlefield');
          },
        } satisfies Effect,
      ],
    },
  ],

  backFace: {
    name: "Braska's Final Aeon",
    manaCost: '',
    typeLine: 'Legendary Enchantment Creature — Saga Nightmare',
    staticAbilities: ['Menace'],
    triggers: [
      {
        name: 'chapterI',
        effects: [
          { kind: 'discard', owner: 'opponents', qty: 1 } satisfies Effect,
          { kind: 'drawCard' } satisfies Effect,
        ],
      },
      {
        name: 'chapterII',
        effects: [
          { kind: 'discard', owner: 'opponents', qty: 1 } satisfies Effect,
          { kind: 'drawCard' } satisfies Effect,
        ],
      },
      {
        name: 'chapterIII',
        effects: [{ kind: 'sacrifice', owner: 'opponents', validType: 'creature', qty: 2 } satisfies Effect],
      },
    ],
  },
};
