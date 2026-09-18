import type { CardDefinition } from '../../card';

export const lootExuberantExplorer: CardDefinition = {
  name: 'Loot, Exuberant Explorer',
  manaCost: '{2}{G}',
  typeLine: 'Legendary Creature — Beast Noble',
  pt: [1, 4],

  activationCost: '{4}{G}{G}, {T}',

  missingSchemaFunctionality: [
    {
      clause: 'You may play an additional land on each of your turns.',
      demand: 'No field tracks a static "extra land drop(s) per turn" grant anywhere on `CardDefinition` — needs a new additive-count field, same shape a mana-ability-style always-on player grant would take.',
    },
    {
      clause:
        'Look at the top six cards of your library. You may reveal a creature card with mana value less than or equal to the number of lands you control from among them and put it onto the battlefield. Put the rest on the bottom in a random order.',
      demand:
        '`kind:\'dig\'` only ever routes a matched card to Hand or the bottom of the library, never directly onto the Battlefield, and has no dynamic per-card mana-value threshold (only a fixed `take` count) — needs either a new dig-to-battlefield Effect variant or a `maxCmc`-style field that can read a live board-state count (lands controlled) instead of a fixed number.',
    },
  ],
};
