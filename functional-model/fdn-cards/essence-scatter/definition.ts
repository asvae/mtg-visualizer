import type { CardDefinition, Effect } from '../../card';

const essenceScatterEffect: Effect = {
  kind: 'counter',
  describe: 'Counter target creature spell.',
};

export const essenceScatter: CardDefinition = {
  name: 'Essence Scatter',
  manaCost: '{1}{U}',
  typeLine: 'Instant',

  effects: [essenceScatterEffect],
};
