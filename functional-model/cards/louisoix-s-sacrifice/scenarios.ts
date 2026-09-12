import type { Scenario } from '../../harness';

// One real scenario, per the standing "basic function, not unit-test
// coverage" rule (SYNERGY_DESIGN.md, 2026-09-12) — this card has exactly
// ONE real effect (counter target activated ability, triggered ability, or
// noncreature spell); the "sacrifice a legendary creature OR pay {2}"
// additional cost is a real cost CHOICE, not a second effect mode, so it
// doesn't need its own scenario either (mode 1's own "pay {2} instead" has
// no distinguishing trace line of its own — mana payment isn't modeled).
// Mode 0 (the sacrifice path) is the more demonstrative branch, so it's the
// one scenario shown.
export const scenarios: Scenario[] = [
  {
    result: 'sacrifices a legendary creature (additional cost) as this counters a target ability or noncreature spell',
    castFrom: 'hand',
    mode: 0,
    // Real, specifically-named Legendary creature (Stiltzkin, Moogle
    // Merchant — data/fin/fin_scryfall.json, {W} Legendary Creature —
    // Moogle, 1/2), not a generic filler creature mislabeled "Legendary"
    // via `creatureSubtypes` (the real gap SYNERGY_DESIGN.md's 2026-09-12
    // "Real not mocked" entry already flags for this exact card and defers
    // to "revisit case-by-case if a future task touches one of these" —
    // this migration is that touch).
    you: { creatureCards: [{ name: 'Stiltzkin, Moogle Merchant', subtypes: ['Legendary', 'Moogle'], power: 1, toughness: 2 }] },
  },
];
