import type { CardDefinition, Effect } from '../../card';

export const nivMizzetVisionary: CardDefinition = {
  name: 'Niv-Mizzet, Visionary',
  manaCost: '{4}{U}{R}',
  typeLine: 'Legendary Creature — Dragon Wizard',
  pt: [5, 5],
  keywords: ['Flying'],

  triggers: [
    {
      name: 'onSourceDealsNoncombatDamageToOpponent',
      effects: [
        {
          kind: 'drawCard',
          amount: (ctx) => (typeof ctx.triggerInput?.damageAmount === 'number' ? (ctx.triggerInput.damageAmount as number) : 0),
        } satisfies Effect,
      ],
    },
  ],

  missingSchemaFunctionality: [
    {
      clause: 'You have no maximum hand size.',
      demand: 'No hand-size tracking/enforcement exists anywhere in this engine — no CR 502.4 cleanup discard-to-hand-size step, no field for overriding a player\'s max hand size.',
    },
  ],
};
