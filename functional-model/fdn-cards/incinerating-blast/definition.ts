import type { CardDefinition, Effect } from '../../card';

export const incineratingBlast: CardDefinition = {
  name: 'Incinerating Blast',
  manaCost: '{4}{R}',
  typeLine: 'Sorcery',

  missingSchemaFunctionality: [
    {
      clause: 'You may discard a card. If you do, draw a card.',
      demand: 'An optional player-choice discard whose OUTCOME conditionally gates a second effect ("if you do") — no player-decision engine exists anywhere in this model (`chooseTarget` always takes the first candidate, `optional` fields elsewhere are documentary-only), so neither "may discard" nor a discard-result-conditioned draw can be expressed or resolved.',
    },
  ],

  effects: [
    {
      kind: 'dealDamageTarget',
      amount: 6,
    } satisfies Effect,
  ],
};
