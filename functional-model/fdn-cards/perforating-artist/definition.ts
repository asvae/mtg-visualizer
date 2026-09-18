import type { CardDefinition } from '../../card';

export const perforatingArtist: CardDefinition = {
  name: 'Perforating Artist',
  manaCost: '{1}{B}{R}',
  typeLine: 'Creature — Devil',
  pt: [3, 2],
  keywords: ['Deathtouch'],

  missingSchemaFunctionality: [
    {
      clause: 'Raid — At the beginning of your end step, if you attacked this turn, each opponent loses 3 life unless that player sacrifices a nonland permanent of their choice or discards a card.',
      demand:
        'No "lose N life UNLESS the affected player pays an alternate cost of their choice" mechanic exists — this engine has no player-decision system at all (every existing `optional`/`chooseTarget` flag is documentary-only, never a real choice branch).',
    },
  ],
};
