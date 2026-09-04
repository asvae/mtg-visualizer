import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const summonGfIfrit: CardDefinition = {
  name: 'Summon: G.F. Ifrit',
  manaCost: '{2}{R}',
  typeLine: 'Enchantment Creature — Saga Demon',

  pt: [3, 2],

  triggers: [
    // Real `AB$ Draw | Cost$ Discard<1/Card>` — "discard a card" is the
    // real COST of drawing here (a real optional cost/effect package, "if
    // you do" documentary only, same convention `move`/`sacrifice`'s own
    // `optional` field already carries), not two independent effects.
    { name: 'chapterI', effects: [{ kind: 'discard', owner: 'you', qty: 1 } satisfies Effect, { kind: 'drawCard', amount: 1 } satisfies Effect] },
    { name: 'chapterII', effects: [{ kind: 'discard', owner: 'you', qty: 1 } satisfies Effect, { kind: 'drawCard', amount: 1 } satisfies Effect] },
    {
      // Real `DB$ Mana | Produced$ R` — no mana-producing Effect kind or
      // action exists anywhere in this engine (no mana pool is modeled at
      // all), so this is a genuine no-op `custom`.
      name: 'chapterIII',
      effects: [
        {
          kind: 'custom',
          describe: 'Add {R} (no mana-production mechanism exists in this engine)',
          run: (_ctx: EffectContext, _actions: Actions) => {},
        } satisfies Effect,
      ],
    },
    {
      name: 'chapterIV',
      effects: [
        {
          kind: 'custom',
          describe: 'Add {R} (no mana-production mechanism exists in this engine)',
          run: (_ctx: EffectContext, _actions: Actions) => {},
        } satisfies Effect,
      ],
    },
  ],
};
