// Real corpus verification for `crewTapResult`/`crewTapOccurrences` —
// reconciles the predicate's own structural verdict against REAL executed
// engine evidence, same reconciliation discipline `scripts/verify-synergy.mjs`
// already applies to hand-authored Facts pool-wide (hard-fail on
// disagreement). Corpus manifest: `crew.corpus.json` (read by
// `sink-derivation-status.ts`).
//
// Real cards, `functional-model/cards/*` (read-only — never modified):
//  - The Lunar Whale (fin/60) — crewCost + a real activationCost. Its own
//    real, checked-in `runEngineScenarios()` already crews it via the real
//    `crewedBy` cost path (Item Shopkeep); reused verbatim here.
//  - Cargo Ship (fin/?) — the SAME crewCost+activationCost shape, PLUS a
//    separate NAMED `abilities` entry (its own mana ability) on the same
//    permanent — the exact real shape ENGINE_GAPS.md gap #11's own bug fix
//    targeted (crewCost branch used to fire even when a DIFFERENT named
//    ability was requested). Confirms the predicate isn't confused by that
//    coexistence. Structural-only check (no dedicated engine-piloted crew
//    trace exists for this card in the pool — its own `scenarios.ts` stays
//    on the older flat `harness.ts` style).
//  - The Regalia (fin/58) — crewCost declared with NO activationCost at
//    all: a REAL, currently-live engine gap (not a hypothetical), verified
//    here against a real `canActivateAbility` rejection.
import { describe, expect, it } from 'vitest';
import type { CardDefinition } from '../../card';
import { setupEnginePilot, type EnginePilotSetup } from '../../engine-trace';
import { canActivateAbility } from '../../engine';
import { crewTapOccurrences, crewTapResult } from './crew';

import { theLunarWhale } from '../../cards/the-lunar-whale/definition';
import { runEngineScenarios as lunarWhaleTraces } from '../../cards/the-lunar-whale/scenarios';
import { itemShopkeep } from '../../cards/item-shopkeep/definition';
import { cargoShip } from '../../cards/cargo-ship/definition';
import { theRegalia } from '../../cards/the-regalia/definition';

describe('crewTapResult / crewTapOccurrences — real corpus', () => {
  it("The Lunar Whale (fin/60) — crewCost + activationCost both set: predicate says produces-tap, agreeing with the real engine-piloted trace's own fn:'tap' on the crewing creature (Item Shopkeep)", () => {
    const result = crewTapResult(theLunarWhale);
    expect(result.applicable).toBe(true);
    expect(result.verdict).toBe('produces-tap');

    const [trace] = lunarWhaleTraces();
    const tapped = trace!.log.some((e) => e.fn === 'tap' && e.target === itemShopkeep.name);
    expect(tapped).toBe(true); // real trace agreement — hard-fail on disagreement

    expect(crewTapOccurrences(theLunarWhale)).toEqual([expect.objectContaining({ event: 'tap', controller: 'you' })]);
  });

  it('Cargo Ship — SAME crewCost+activationCost shape, PLUS a separate named mana ability on the same permanent (ENGINE_GAPS.md gap #11 shape): predicate still says produces-tap, not confused by the coexisting named ability', () => {
    const result = crewTapResult(cargoShip);
    expect(result.applicable).toBe(true);
    expect(result.verdict).toBe('produces-tap');
    expect(crewTapOccurrences(cargoShip)).toHaveLength(1);

    // Real engine confirmation (not just the predicate's own structural
    // read): activating the NAMED "mana" ability does NOT go through the
    // crew cost path at all (engine.ts's own crewCost branch is gated on
    // `abilityName === undefined`), while omitting abilityName DOES —
    // exactly the two real, distinct activations this card supports.
    const setup: EnginePilotSetup = { you: {}, opponents: [{}] };
    const pilot = setupEnginePilot(setup);
    const shipReal = pilot.state.addCard(pilot.you, 'Battlefield', { name: cargoShip.name, types: ['Artifact'], subtypes: ['Vehicle'], basePower: 2, baseToughness: 3, keywords: cargoShip.keywords });
    const crewerReal = pilot.state.addCard(pilot.you, 'Battlefield', { name: 'Test Crewer', types: ['Creature'], basePower: 1, baseToughness: 1 });
    expect(canActivateAbility(pilot.engine, pilot.you, shipReal, cargoShip, undefined, [crewerReal]).ok).toBe(true);
    expect(canActivateAbility(pilot.engine, pilot.you, shipReal, cargoShip, 'mana').ok).toBe(true);
  });

  it("The Regalia (fin/58) — crewCost declared with NO activationCost: predicate says no-tap, agreeing with a real canActivateAbility rejection (this card's own real, live engine gap, not a guess)", () => {
    const result = crewTapResult(theRegalia);
    expect(result.applicable).toBe(true);
    expect(result.verdict).toBe('no-tap');

    const setup: EnginePilotSetup = { you: {}, opponents: [{}] };
    const pilot = setupEnginePilot(setup);
    const regaliaReal = pilot.state.addCard(pilot.you, 'Battlefield', { name: theRegalia.name, types: ['Artifact'], subtypes: ['Vehicle'], basePower: 4, baseToughness: 4, keywords: theRegalia.keywords });
    const crewerReal = pilot.state.addCard(pilot.you, 'Battlefield', { name: 'Test Crewer', types: ['Creature'], basePower: 2, baseToughness: 2 });

    const check = canActivateAbility(pilot.engine, pilot.you, regaliaReal, theRegalia, undefined, [crewerReal]);
    pilot.log.push({ fn: 'illegalAttempt', card: theRegalia.name, reason: check.reason });
    expect(check.ok).toBe(false); // real trace agreement — hard-fail on disagreement
    expect(check.reason).toMatch(/no such activated ability/);
    expect(crewerReal.tapped).toBe(false); // real evidence: nothing was ever tapped

    expect(crewTapOccurrences(theRegalia)).toEqual([]);
  });

  it('a card with no crewCost at all is not applicable', () => {
    const notAVehicle: CardDefinition = { name: 'Plain Creature', manaCost: '{1}', typeLine: 'Creature — Human' };
    const result = crewTapResult(notAVehicle);
    expect(result.applicable).toBe(false);
    expect(crewTapOccurrences(notAVehicle)).toEqual([]);
  });
});
