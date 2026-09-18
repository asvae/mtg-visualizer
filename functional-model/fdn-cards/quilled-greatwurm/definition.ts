import type { CardDefinition } from '../../card';

// Real Forge (quilled_greatwurm.txt): `T:Mode$ DamageDealtOnce |
// CombatDamage$ True | PlayerTurn$ True | ValidSource$ Creature.YouCtrl |
// Execute$ TrigPutCounter | SVar:TrigPutCounter:DB$ PutCounter |
// Defined$TriggeredSourceLKICopy | CounterNum$ X` — a board-wide watch (ANY
// creature you control dealing combat damage, not just this one) putting
// counters ON THAT DEALING CREATURE, magnitude = damage dealt. No
// Query/Filter source exists for "creatures that dealt combat damage this
// turn," and no `EachAction`/`ProgramNode` broadcasts a per-item variable
// magnitude back onto the SAME item that triggered it. `S:Mode$ Continuous
// | ... | MayPlay$ True | AffectedZone$ Graveyard | RaiseCost$
// RemoveAnyCounter<6/Any/Creature>` — casting from the graveyard by paying
// an ADDITIONAL cost (remove 6 counters) alongside the normal mana cost;
// `AlternateCost` is a full cost REPLACEMENT shape only (`from:
// 'graveyard'|'exile'`), can't express "pay normal cost PLUS remove
// counters."
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
