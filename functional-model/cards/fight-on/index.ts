import type { CardDefinition, Effect } from '../../card';

export const fightOn: CardDefinition = {
  name: 'Fight On!',
  manaCost: '{2}{B}',
  typeLine: 'Instant',

  effects: [{ kind: 'move', owner: 'you', from: 'Graveyard', to: 'Hand', qty: 2, validType: 'creature', target: true } satisfies Effect],
};
