import type { CardDefinition, Effect } from '../../card';

export const tinybonesBaubleBurglar: CardDefinition = {
  name: 'Tinybones, Bauble Burglar',
  manaCost: '{1}{B}',
  typeLine: 'Legendary Creature — Skeleton Rogue',
  pt: [1, 3],

  triggers: [
    {
      describe: 'Whenever an opponent discards a card, exile it from their graveyard with a stash counter on it.',
      effects: [
        {
          kind: 'custom',
          describe: 'Exile discarded card from opponent graveyard with a stash counter.',
          run: (ctx, actions) => {
            // This requires tracking discarded cards and applying stash counters
            // which is beyond current vocabulary representation
          },
        } satisfies Effect,
      ],
    },
  ],

  staticAbilities: [
    'During your turn, you may play cards you don\'t own with stash counters on them from exile, and mana of any type can be spent to cast those spells.',
  ],

  activatedAbilities: [
    {
      cost: '{3}{B}{T}',
      description: 'Each opponent discards a card. Activate only as a sorcery.',
      effects: [
        {
          kind: 'discard',
          owner: 'opponents',
          qty: 1,
        } satisfies Effect,
      ],
    },
  ],
};
