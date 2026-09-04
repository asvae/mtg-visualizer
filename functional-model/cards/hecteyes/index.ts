import type { CardDefinition, Effect } from '../../card';

export const hecteyes: CardDefinition = {
  name: 'Hecteyes',
  manaCost: '{1}{B}',
  typeLine: 'Creature — Ooze Horror',

  triggers: [{ name: 'onEnter', effects: [{ kind: 'discard', owner: 'opponents', qty: 1 } satisfies Effect] }],
};
