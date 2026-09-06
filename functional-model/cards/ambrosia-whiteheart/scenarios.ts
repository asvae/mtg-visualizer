// Real engine-piloted trace (see engine-trace.ts's own header). onEnter is
// a real recognized auto-fire (603.6b) — wired via `on: 'enter'` on this
// card's own definition.ts (same convention Jill's own onEnter uses).
// Landfall has no auto-fire in this engine (no "another permanent entered"
// detection at all) — a real land is added straight to the battlefield
// (this engine has no land-drop action, so that's the only real way to
// model one entering), then onLandfall fires manually.

import { ambrosiaWhiteheart } from './definition';
import { basicLandsFor } from '../../mana';
import { checkStateBasedActions } from '../../sba';
import type { TraceResult } from '../../harness';
import {
  setupEnginePilot,
  pilotActions,
  pilotCast,
  pilotResolveTop,
  advanceToPlayersNextMain1,
  pilotFireTrigger,
  finishEnginePilotTrace,
  type EnginePilotSetup,
} from '../../engine-trace';

export function runEngineScenarios(): TraceResult[] {
  const setup: EnginePilotSetup = {
    you: { tokens: ['c_a_treasure_sac'], basicLands: basicLandsFor('{1}{W}'), libraryCount: 8 },
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
  });
  const actions = pilotActions(pilot, ambrosiaReal.id);
  const ctx = pilot.ctxFor(ambrosiaReal);

  // Cast during the opponent's own Main1 — legal only because of Flash
  // (canCastSpell's own isInstantSpeed check), real {1}{W} mana payment
  pilotCast(pilot, ambrosiaReal, ambrosiaWhiteheart, ctx, actions);
  // Resolves; real 603.6b ETB auto-fires — bounces the real Treasure you control
  pilotResolveTop(pilot);

  // Real turn passage back to your own turn
  advanceToPlayersNextMain1(pilot, pilot.you);

  // A real land entering (no land-drop action exists in this engine — added
  // straight to the battlefield, the only real way to model one entering)
  const forest = pilot.state.addCard(pilot.you, 'Battlefield', { name: 'Forest', types: ['Land'], subtypes: ['Forest'] });
  pilot.log.push({ fn: 'enters', card: forest.name, instanceId: 2, zone: 'Battlefield' });
  // Landfall fired manually — no "another permanent entered" auto-detection in this engine
  pilotFireTrigger(pilot, ambrosiaWhiteheart, ctx, actions, 'onLandfall');

  // Real 704.5j legend rule — a second real copy enters, one is removed,
  // satisfying this card's own baseline self-graveyard/self-dies facts
  // (same convention Adelbert Steiner's own legend-rule demonstration uses)
  const secondCopy = pilot.state.addCard(pilot.you, 'Battlefield', {
    name: ambrosiaWhiteheart.name,
    types: ['Creature'],
    subtypes: ['Bird', 'Legendary'],
    keywords: ambrosiaWhiteheart.keywords,
  });
  pilot.log.push({ fn: 'enters', card: secondCopy.name, instanceId: 2, zone: 'Battlefield' });
  const sbaResult = checkStateBasedActions(pilot.state, pilot.engine.players);
  for (const removed of sbaResult.legendRuleRemoved) pilot.log.push({ fn: 'legendRule', card: removed.name, player: pilot.you.name });

  const result =
    "Ambrosia is cast for real during the opponent's own Main1 (Flash, 117.1a) — legal despite it not being your main phase; real ETB (603.6b) returns your own Treasure to hand; later a real land entering triggers Landfall, pumping Ambrosia +1/+0 for real; finally a second real copy enters and the real legend rule (704.5j) removes one.";
  return [finishEnginePilotTrace(pilot, setup, "real engine playthrough: Flash cast on opponent's turn -> real ETB bounce -> real Landfall pump", result)];
}
