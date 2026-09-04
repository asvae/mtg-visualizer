import type { CardDefinition, Effect } from '../../card';

// Real script (world_map.txt): Artifact with two independent, self-
// sacrificing activated abilities searching the library for a land card —
// same "sacrifice self is part of the cost" convention every other self-
// sac ability in this batch uses (qiqirn-merchant/instant-ramen). Both
// abilities are a real search (601.2c, no stack targeting), same
// convention Prishe's Wanderings/reach-the-horizon/sazh-katzroy already
// use for `move`'s untargeted branch. `'land'` has no "basic land" narrower
// filter anywhere in this model (`move`'s own `validType` is type-only) —
// the first ability's "basic land card" is approximated as any land, same
// real, documented gap reach-the-horizon's own comment already covers.
export const worldMap: CardDefinition = {
  name: 'World Map',
  manaCost: '{1}',
  typeLine: 'Artifact',

  abilities: [
    {
      name: 'searchBasic',
      cost: '{1}, {T}, Sacrifice this artifact',
      effects: [{ kind: 'move', owner: 'you', from: 'Library', to: 'Hand', qty: 1, validType: 'land' } satisfies Effect],
    },
    {
      name: 'searchAny',
      cost: '{3}, {T}, Sacrifice this artifact',
      effects: [{ kind: 'move', owner: 'you', from: 'Library', to: 'Hand', qty: 1, validType: 'land' } satisfies Effect],
    },
  ],
};
