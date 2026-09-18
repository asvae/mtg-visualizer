import type { CardDefinition, Effect } from '../../card';

export const giadaFontOfHope: CardDefinition = {
  name: 'Giada, Font of Hope',
  manaCost: '{1}{W}',
  typeLine: 'Legendary Creature — Angel',
  pt: [2, 2],
  keywords: ['Flying', 'Vigilance'],

  abilities: [
    {
      name: 'tapForW',
      cost: '{T}',
      effects: [{ kind: 'addMana', color: 'W', amount: 1 } satisfies Effect],
    },
  ],

  missingSchemaFunctionality: [
    {
      clause: 'Each other Angel you control enters with an additional +1/+1 counter on it for each Angel you already control.',
      demand:
        'No CR 614.12-style replacement effect modifies ANOTHER qualifying permanent\'s own ETB counter count — `Trigger.on:\'otherPermanentEnters\'` only reacts after the fact, it can\'t change how many counters the entering permanent enters WITH.',
    },
  ],
};
