import type { CardDefinition, Effect } from '../../card';

export const cephalidInkmage: CardDefinition = {
  name: 'Cephalid Inkmage',
  manaCost: '{2}{U}',
  typeLine: 'Creature — Octopus Wizard',
  pt: [2, 2],

  // Real Forge (cephalid_inkmage.txt) has NO `K:` lines at all — neither
  // "Surveil" nor "Threshold" is a real printed keyword here (Surveil is
  // just the triggered ability's own effect verb, already modeled below
  // via `kind:'surveil'`; Threshold is prose naming the static ability's
  // own condition, not a `K:` line) — neither belongs in the closed
  // `Keyword` union.
  //
  // Real Forge: `S:Mode$ CantBlockBy | ValidAttacker$ Card.Self |
  // Condition$ Threshold` — "Threshold — This creature can't be blocked
  // as long as there are seven or more cards in your graveyard." The
  // vocabulary has no way to express conditional static abilities or
  // unblockable-while-condition mechanics — kept as free text only.
  staticAbilities: [
    "Threshold — This creature can't be blocked as long as there are seven or more cards in your graveyard.",
  ],

  triggers: [
    {
      name: 'onEnter',
      on: 'enter',
      effects: [
        {
          kind: 'surveil',
          qty: 3,
        } satisfies Effect,
      ],
    },
  ],
};
