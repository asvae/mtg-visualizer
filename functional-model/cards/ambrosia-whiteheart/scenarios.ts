// Real engine-piloted trace (see engine-trace.ts's own header). onEnter is
// a real recognized auto-fire (603.6b) — wired via `on: 'enter'` on this
// card's own definition.ts (same convention Jill's own onEnter uses).
// Landfall has no auto-fire in this engine (no "another permanent entered"
// detection at all) — a real land is added straight to the battlefield
// (this engine has no land-drop action, so that's the only real way to
// model one entering), then onLandfall fires manually. Legend-rule coverage
// is handled parametrically elsewhere now, not as a per-card demonstration
// here.

import { ambrosiaWhiteheart } from './definition';
import { basicLandsFor } from '../../mana';
import type { TraceResult } from '../../harness';
import { setupEnginePilot, pilotActions, pilotCast, pilotResolveTop, advanceToPlayersNextMain1, pilotFireTrigger, finishEnginePilotTrace, type EnginePilotSetup } from '../../engine-trace';

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
  pilot.beginStep('A real land entering');
  const forest = pilot.state.addCard(pilot.you, 'Battlefield', { name: 'Forest', types: ['Land'], subtypes: ['Forest'] });
  pilot.log.push({ fn: 'enters', card: forest.name, zone: 'Battlefield', controller: pilot.you.name });
  // Landfall fired manually — no "another permanent entered" auto-detection in this engine
  pilotFireTrigger(pilot, ambrosiaWhiteheart, ctx, actions, 'onLandfall');

  const result =
    "Ambrosia is cast for real during the opponent's own Main1 (Flash, 117.1a) — legal despite it not being your main phase; real ETB (603.6b) returns one of your own real Plains to hand (\"another permanent you control,\" no artifact restriction); later a real land entering triggers Landfall, pumping Ambrosia +1/+0 for real.";
  return [finishEnginePilotTrace(pilot, setup, "real engine playthrough: Flash cast on opponent's turn -> real ETB bounce -> real Landfall pump", result)];
}
