import type { CardDefinition, Effect } from '../../card';

export const summonPrimalOdin: CardDefinition = {
  name: 'Summon: Primal Odin',
  manaCost: '{4}{B}{B}',
  typeLine: 'Enchantment Creature — Saga Knight',

  pt: [5, 3],

  triggers: [
    {
      name: 'chapterI',
      // Gungnir — "destroy target creature AN OPPONENT CONTROLS."
      effects: [{ kind: 'destroy', validType: 'creature', qty: 1, owner: 'opponents' } satisfies Effect],
    },
    {
      // Zantetsuken — grants a NEW permanent triggered ability ("whenever
      // this creature deals combat damage to a player, that player loses
      // the game"). No Effect kind exists anywhere in this model for
      // dynamically granting a new triggered ability at resolution time
      // (`triggers` is a fixed, static list on a CardDefinition, not
      // something an effect can append to), AND no Effect kind exists for
      // "a player loses the game"/"you win the game" at all — a genuine gap
      // (see this batch's own final report), not something any combination
      // of existing Effect kinds/fields covers. No-op custom purely so
      // synergyTags() still records the real text, same treatment cecil-
      // dark-knight's own Protect grant gets for its own unrepresentable
      // clause.
      name: 'chapterII',
      effects: [
        {
          kind: 'custom',
          describe:
            'Zantetsuken — this creature gains "whenever this creature deals combat damage to a player, that player loses the game" (no Effect kind exists for granting a new triggered ability, nor for "loses the game"/"wins the game")',
          run: () => {},
        } satisfies Effect,
      ],
    },
    {
      name: 'chapterIII',
      effects: [{ kind: 'drawCard', amount: 2 } satisfies Effect, { kind: 'loseLife', owner: 'each', amount: 2 } satisfies Effect],
    },
  ],
};
