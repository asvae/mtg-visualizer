import type { CardDefinition, Effect } from '../../card';

export const rydiaSReturn: CardDefinition = {
  name: "Rydia's Return",
  manaCost: '{3}{G}{G}',
  typeLine: 'Sorcery',

  effects: [
    {
      kind: 'modal',
      modes: [
        { describe: 'Creatures you control get +3/+3 until end of turn.', effects: [{ kind: 'pumpAll', predicate: 'creatures-you-control', power: 3, toughness: 3 } satisfies Effect] },
        {
          // Real `ValidTgts$ Permanent.YouOwn` — `move`'s own declarative
          // `validType` has no combined "permanent" filter (only
          // creature/artifact/land/any), so `'any'` is the closest fit —
          // same approximation opera-love-song's own "permanent card"
          // exile already uses.
          describe: 'Return up to two target permanent cards from your graveyard to your hand.',
          effects: [{ kind: 'move', owner: 'you', from: 'Graveyard', to: 'Hand', qty: 2, validType: 'any', target: true } satisfies Effect],
        },
      ],
    } satisfies Effect,
  ],
};
