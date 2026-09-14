// Real engine-piloted trace (see engine-trace.ts's own header). onEnter is
// a real recognized auto-fire (603.6b) — wired via `on: 'enter'` on this
// card's own definition.ts (same convention Jill's own onEnter uses).
// Landfall has no auto-fire in this engine (no "another permanent entered"
// detection at all) — a real land is added straight to the battlefield
// (this engine has no land-drop action, so that's the only real way to
// model one entering), then onLandfall fires manually. Legend-rule coverage
// is handled parametrically elsewhere now, not as a per-card demonstration
// here.
//
// This scenario now also spans a real Cleanup (2026-09-14, ENGINE_GAPS.md —
// `state.pump`'s own real `untilEndOfTurn` expiry): Landfall's own real
// "+1/+0 UNTIL END OF TURN" pump used to be a permanent `layers.add` entry
// with no expiry at all — the trace now genuinely crosses the rest of this
// turn (`advanceOneStep` in a loop, same convention `the-lunar-whale`'s own
// scenario already establishes for reaching a specific later phase) and
// reads Ambrosia's real effective power/toughness both BEFORE and AFTER
// Cleanup, proving the pump genuinely disappears rather than just applying.

import { ambrosiaWhiteheart } from './definition';
import { basicLandsFor } from '../../mana';
import { currentPhase } from '../../turn';
import { effectivePT } from '../../state';
import type { TraceResult } from '../../harness';
import { setupEnginePilot, pilotActions, pilotCast, pilotResolveTop, advanceToPlayersNextMain1, advanceOneStep, pilotFireTrigger, finishEnginePilotTrace, type EnginePilotSetup } from '../../engine-trace';

export function runEngineScenarios(): TraceResult[] {
  const setup: EnginePilotSetup = {
    you: { basicLands: basicLandsFor('{1}{W}'), libraryCount: 8 },
    opponents: [{ libraryCount: 8 }],
  };
  const pilot = setupEnginePilot(setup);

  // Real turn passage into the opponent's own turn — proves Flash (117.1a's
  // exception to 307.1a) really lets this be cast outside your own main phase.
  advanceToPlayersNextMain1(pilot, pilot.opponents[0]!);

  const ambrosiaReal = pilot.state.addCard(pilot.you, 'Hand', {
    name: ambrosiaWhiteheart.name,
    types: ['Creature'],
    subtypes: ['Bird', 'Legendary'],
    keywords: ambrosiaWhiteheart.keywords,
    basePower: 2,
    baseToughness: 2,
  });
  const actions = pilotActions(pilot, ambrosiaReal.id);
  const ctx = pilot.ctxFor(ambrosiaReal);

  // Cast during the opponent's own Main1 — legal only because of Flash
  // (canCastSpell's own isInstantSpeed check), real {1}{W} mana payment
  pilotCast(pilot, ambrosiaReal, ambrosiaWhiteheart, ctx, actions);
  // Resolves; real 603.6b ETB auto-fires — real text is "another permanent
  // you control" (no artifact/Treasure restriction) — bounces one of your
  // own real Plains, the only other permanent you control at this point.
  pilotResolveTop(pilot);

  // Real turn passage back to your own turn
  advanceToPlayersNextMain1(pilot, pilot.you);

  // A real land entering (no land-drop action exists in this engine — added
  // straight to the battlefield, the only real way to model one entering)
  pilot.beginStep('A land entering');
  const forest = pilot.state.addCard(pilot.you, 'Battlefield', { name: 'Forest', types: ['Land'], subtypes: ['Forest'] });
  pilot.log.push({ fn: 'enters', card: forest.name, zone: 'Battlefield', controller: pilot.you.name });
  // Landfall fired manually — no "another permanent entered" auto-detection in this engine
  pilotFireTrigger(pilot, ambrosiaWhiteheart, ctx, actions, 'onLandfall');

  // Real, live evidence the pump applied — genuinely 2/2 base + 1/0 = 3/2
  // right after Landfall fires, not a scripted number.
  const [pumpedPower, pumpedToughness] = effectivePT(pilot.state, ambrosiaReal);
  pilot.log.push({ fn: 'read:getNetPower', target: ambrosiaReal.name, power: pumpedPower, toughness: pumpedToughness });

  // Real 514.2 Cleanup — genuinely crosses the rest of THIS turn
  // (Main2/EndOfTurn/Cleanup), not a hand-waved "assume it expires."
  while (currentPhase(pilot.engine.turn) !== 'Cleanup') advanceOneStep(pilot);

  // Real, live evidence the pump is GONE — back to base 2/2, read straight
  // off the real card after Cleanup, not asserted from outside the trace.
  const [expiredPower, expiredToughness] = effectivePT(pilot.state, ambrosiaReal);
  pilot.log.push({ fn: 'read:getNetPower', target: ambrosiaReal.name, power: expiredPower, toughness: expiredToughness });

  const result =
    "Ambrosia is cast during the opponent's own Main1 (Flash, 117.1a) — legal despite it not being your main phase; ETB (603.6b) returns one of your own Plains to hand (\"another permanent you control,\" no artifact restriction); later a land entering triggers Landfall, pumping Ambrosia +1/+0 UNTIL END OF TURN (3/2) — the scenario then crosses a real Cleanup (514.2) and Ambrosia is genuinely back to her base 2/2, the pump having really expired, not just applied.";
  return [finishEnginePilotTrace(pilot, setup, "engine playthrough: Flash cast on opponent's turn -> ETB bounce -> Landfall pump -> Cleanup (pump expires)", result)];
}
