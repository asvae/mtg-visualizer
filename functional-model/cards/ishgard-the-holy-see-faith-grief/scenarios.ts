import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'enters tapped', trigger: 'onEnter' },
  {
    // Real harness limitation, not a card.ts gap: `PlayerState` has no
    // graveyard-artifact/graveyard-enchantment field (only
    // `graveyardCreatureCount`, a Creature-type filler), so a scenario
    // can't synthesize the "artifact/enchantment cards ARE present"
    // positive case — this demonstrates the pool correctly finding zero
    // matches among nonmatching (Creature) graveyard cards instead.
    result: 'no artifact/enchantment cards in the graveyard (only creature cards) — nothing returned to hand',
    face: 'back',
    castFrom: 'hand',
    you: { graveyardCreatureCount: 2 },
  },
];
