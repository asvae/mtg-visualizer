import type { Scenario } from '../../harness';

// The front face's own "enters tapped" scenario was dropped — its facts
// are now covered by verify-synergy.mjs's static-check exemptions (see
// hasStaticLandTapSelfTrigger's doc comment); the back face's own facts
// below still need real scenario evidence.
export const scenarios: Scenario[] = [
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
