import type { CardDefinition } from '../../card';

// Real Forge (loot_exuberant_explorer.txt): `S:Mode$ Continuous | Affected$
// You | AdjustLandPlays$ 1` — an extra-land-drop static grant. No field
// anywhere on `CardDefinition` tracks additional land plays per turn
// (checked directly). `A:AB$ Dig | Cost$ 4 G G T | DigNum$ 6 | ChangeNum$ 1
// | Optional$ True | ChangeValid$ Creature.cmcLEX | DestinationZone$
// Battlefield | ...` — `kind:'dig'` only ever moves a matched card to HAND
// or the bottom (see that Effect's own doc comment), never straight onto
// the Battlefield, and has no dynamic mana-value threshold (`X` here is
// live "number of lands you control," not a fixed number `dig`'s own
// fields could carry).
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
