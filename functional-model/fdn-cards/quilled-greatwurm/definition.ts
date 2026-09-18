import type { CardDefinition } from '../../card';

export const quilledGreatwurm: CardDefinition = {
  name: 'Quilled Greatwurm',
  manaCost: '{4}{G}{G}',
  typeLine: 'Creature — Wurm',
  pt: [7, 7],
  keywords: ['Trample'],

  missingSchemaFunctionality: [
    {
      clause: 'Whenever a creature you control deals combat damage during your turn, put that many +1/+1 counters on it. (It must survive to get the counters.)',
      demand:
        'No Query/Filter source reads "creatures that dealt combat damage this turn," and no `EachAction`/`ProgramNode` broadcasts a per-item dynamic magnitude (the damage just dealt) back onto that same item — needs a new board-wide combat-damage watch primitive.',
    },
    {
      clause: 'You may cast this card from your graveyard by removing six counters from among creatures you control in addition to paying its other costs.',
      demand:
        '`AlternateCost` only models a full cost REPLACEMENT (`from: \'graveyard\'|\'exile\'`, Flashback/Jump-start shape) — needs an ADDITIONAL-cost-from-graveyard shape (pay the normal mana cost AND remove counters).',
    },
  ],
};
