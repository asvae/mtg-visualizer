import type { CardDefinition, Effect } from '../../card';

// Real script (ring_of_the_lucii.txt): Legendary Artifact with two
// independent activated abilities. The mana ability ("{T}: Add {C}{C}")
// stays real text only — no mana-producing Effect/Action exists anywhere
// in this model (deliberate, no mana pool tracked). "Tap target nonland
// permanent" — `tapTarget`'s own `validType` union has no "nonland" filter
// (only creature/artifact/land/creature-or-artifact/any); `'creature-or-
// artifact'` is the closest real fit (loses only the enchantment case),
// same approximation omega-heartless-evolution's own identical "tap target
// nonland permanent" clause already establishes. `ValidTgts$ Permanent.
// nonLand` carries no controller restriction, so `owner` stays omitted
// (the default combined pool).
export const ringOfTheLucii: CardDefinition = {
  name: 'Ring of the Lucii',
  manaCost: '{4}',
  typeLine: 'Legendary Artifact',

  staticAbilities: ['{T}: Add {C}{C}.'],

  abilities: [
    {
      name: 'tapNonland',
      cost: '{2}, {T}, Pay 1 life',
      effects: [{ kind: 'loseLife', owner: 'you', amount: 1 } satisfies Effect, { kind: 'tapTarget', validType: 'creature-or-artifact' } satisfies Effect],
    },
  ],
};
