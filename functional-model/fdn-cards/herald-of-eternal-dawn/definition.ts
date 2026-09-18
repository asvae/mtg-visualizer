import type { CardDefinition } from '../../card';

export const heraldOfEternalDawn: CardDefinition = {
  name: 'Herald of Eternal Dawn',
  manaCost: '{4}{W}{W}{W}',
  typeLine: 'Creature — Angel',
  pt: [6, 6],
  keywords: ['Flash', 'Flying'],
  missingSchemaFunctionality: [
    {
      clause: "You can't lose the game and your opponents can't win the game.",
      demand: "A player-level game-loss/win-condition override — no mechanism anywhere in this engine intercepts/suppresses a state-based game-loss check (704) or an opponent's game-win check (104) for a specific player.",
    },
  ],
};
