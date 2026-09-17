// Real corpus verification for `crewTapResult`/`crewTapOccurrences` —
// reconciles the predicate's own structural verdict against a real
// `canActivateAbility`/`activateAbility` engine call (a direct function
// call, not a scripted turn-by-turn scenario/trace) using minimal,
// hand-constructed `CardDefinition` MOCKS, per the 2026-09-18 policy
// decision recorded in `.claude/agent-memory/engine/notes.md`: a
// sink-derivation predicate is a pure function of `CardDefinition` SHAPE —
// it doesn't care which real card produced that shape, so corpus fixtures
// are built directly with the same public shapes real cards use
// (`crewCost`/`activationCost`/`abilities`), never imported from any real
// card's own `definition.ts`. Corpus manifest: `crew.corpus.json` (read by
// `sink-derivation-status.ts`).
//
// Real card names appear ONLY as readability anchors in comments/test
// names below — the fixtures themselves are synthetic, mirroring the real
// shape each anchor card has (checked directly against that card's own
// `functional-model/cards/<slug>/definition.ts` at the time this file was
// written, never copied from it):
//  - The Lunar Whale (fin/60) — `crewCost` + a real `activationCost`.
//  - Cargo Ship — the SAME `crewCost`+`activationCost` shape, PLUS a
//    separate NAMED `abilities` entry (its own mana ability) on the same
//    permanent — the exact real shape ENGINE_GAPS.md gap #11's own bug fix
//    targeted (the crewCost branch used to fire even when a DIFFERENT
//    named ability was requested).
//  - The Regalia (fin/58) — `crewCost` declared with NO `activationCost`
//    at all: a REAL, currently-live engine gap (not a hypothetical) —
//    mirrored here as a mock rather than importing the real card, since
//    the predicate's own claim is about the STRUCTURAL shape
//    (crewCost-without-activationCost), not about The Regalia specifically.
import { describe, expect, it } from 'vitest';
import type { CardDefinition } from '../../card';
import { setupEnginePilot, pilotActions, type EnginePilotSetup } from '../../engine-trace';
import { canActivateAbility, activateAbility } from '../../engine';
import { crewTapOccurrences, crewTapResult } from './crew';

/** crewCost + a real activationCost — mirrors The Lunar Whale's real shape. */
const mockVehicleWithActivationCost: CardDefinition = {
  name: 'Mock Vehicle (crewCost + activationCost)',
  manaCost: '{3}',
  typeLine: 'Artifact — Vehicle',
  crewCost: 2,
  activationCost: 'Crew 2',
  effects: [{ kind: 'animate', target: 'self', types: ['Artifact', 'Creature'] }],
};

/** SAME crewCost+activationCost shape, PLUS a separate named ability on the same permanent — mirrors Cargo Ship's real shape (ENGINE_GAPS.md gap #11). */
const mockVehicleWithNamedAbility: CardDefinition = {
  name: 'Mock Vehicle (crewCost + activationCost + a separate named ability)',
  manaCost: '{2}',
  typeLine: 'Artifact — Vehicle',
  crewCost: 1,
  activationCost: 'Crew 1',
  abilities: [{ name: 'mana', cost: '{T}', effects: [{ kind: 'addMana', color: 'C', amount: 1 }] }],
};

/** crewCost declared with NO activationCost at all — mirrors The Regalia's real, currently-live gap. */
const mockVehicleNoActivationCost: CardDefinition = {
  name: 'Mock Vehicle (crewCost only, no activationCost)',
  manaCost: '{4}',
  typeLine: 'Artifact — Vehicle',
  crewCost: 1,
};

function pilotWithVehicleAndCrewer(vehicle: CardDefinition, crewerPower = 3) {
  const setup: EnginePilotSetup = { you: {}, opponents: [{}] };
  const pilot = setupEnginePilot(setup);
  const vehicleReal = pilot.state.addCard(pilot.you, 'Battlefield', {
    name: vehicle.name,
    types: ['Artifact'],
    subtypes: ['Vehicle'],
    basePower: 4,
    baseToughness: 4,
    keywords: vehicle.keywords,
  });
  const crewerReal = pilot.state.addCard(pilot.you, 'Battlefield', {
    name: 'Mock Crewer',
    types: ['Creature'],
    basePower: crewerPower,
    baseToughness: crewerPower,
  });
  return { pilot, vehicleReal, crewerReal };
}

describe('crewTapResult / crewTapOccurrences — corpus (mocked CardDefinition fixtures)', () => {
  it("crewCost + activationCost both set: predicate says produces-tap, agreeing with a real activateAbility genuinely tapping the crewing creature (mirrors The Lunar Whale's real shape)", () => {
    const result = crewTapResult(mockVehicleWithActivationCost);
    expect(result.applicable).toBe(true);
    expect(result.verdict).toBe('produces-tap');

    const { pilot, vehicleReal, crewerReal } = pilotWithVehicleAndCrewer(mockVehicleWithActivationCost);
    expect(crewerReal.tapped).toBe(false); // real evidence: not tapped yet
    const check = canActivateAbility(pilot.engine, pilot.you, vehicleReal, mockVehicleWithActivationCost, undefined, [crewerReal]);
    expect(check.ok).toBe(true);
    activateAbility(pilot.engine, pilot.you, vehicleReal, mockVehicleWithActivationCost, pilot.ctxFor(vehicleReal), pilotActions(pilot, vehicleReal.id), undefined, [crewerReal]);
    expect(crewerReal.tapped).toBe(true); // real trace agreement — hard-fail on disagreement

    expect(crewTapOccurrences(mockVehicleWithActivationCost)).toEqual([expect.objectContaining({ event: 'tap', controller: 'you' })]);
  });

  it('SAME crewCost+activationCost shape, PLUS a separate named mana ability on the same permanent (mirrors Cargo Ship / ENGINE_GAPS.md gap #11 shape): predicate still says produces-tap, not confused by the coexisting named ability', () => {
    const result = crewTapResult(mockVehicleWithNamedAbility);
    expect(result.applicable).toBe(true);
    expect(result.verdict).toBe('produces-tap');
    expect(crewTapOccurrences(mockVehicleWithNamedAbility)).toHaveLength(1);

    // Real engine confirmation (not just the predicate's own structural
    // read): activating the NAMED "mana" ability does NOT go through the
    // crew cost path at all (engine.ts's own crewCost branch is gated on
    // `abilityName === undefined`), while omitting abilityName DOES —
    // exactly the two real, distinct activations this shape supports.
    const { pilot, vehicleReal, crewerReal } = pilotWithVehicleAndCrewer(mockVehicleWithNamedAbility, 1);
    expect(canActivateAbility(pilot.engine, pilot.you, vehicleReal, mockVehicleWithNamedAbility, undefined, [crewerReal]).ok).toBe(true);
    expect(canActivateAbility(pilot.engine, pilot.you, vehicleReal, mockVehicleWithNamedAbility, 'mana').ok).toBe(true);
  });

  it('crewCost declared with NO activationCost: predicate says no-tap, agreeing with a real canActivateAbility rejection (mirrors The Regalia — a real, live engine gap, not a guess)', () => {
    const result = crewTapResult(mockVehicleNoActivationCost);
    expect(result.applicable).toBe(true);
    expect(result.verdict).toBe('no-tap');

    const { pilot, vehicleReal, crewerReal } = pilotWithVehicleAndCrewer(mockVehicleNoActivationCost);
    const check = canActivateAbility(pilot.engine, pilot.you, vehicleReal, mockVehicleNoActivationCost, undefined, [crewerReal]);
    pilot.log.push({ fn: 'illegalAttempt', card: mockVehicleNoActivationCost.name, reason: check.reason });
    expect(check.ok).toBe(false); // real trace agreement — hard-fail on disagreement
    expect(check.reason).toMatch(/no such activated ability/);
    expect(crewerReal.tapped).toBe(false); // real evidence: nothing was ever tapped

    expect(crewTapOccurrences(mockVehicleNoActivationCost)).toEqual([]);
  });

  it('a card with no crewCost at all is not applicable', () => {
    const notAVehicle: CardDefinition = { name: 'Plain Creature', manaCost: '{1}', typeLine: 'Creature — Human' };
    const result = crewTapResult(notAVehicle);
    expect(result.applicable).toBe(false);
    expect(crewTapOccurrences(notAVehicle)).toEqual([]);
  });
});
