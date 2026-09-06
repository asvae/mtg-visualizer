// Real engine-piloted trace (see engine-trace.ts's own header) — this
// card's transforming-DFC-into-a-Saga arc played out for real: real mana
// payment, real summoning-sickness wait, real Saga lore-counter automation
// (saga.ts) firing each chapter on a real draw step.

import { jillShivasDominant } from './definition';
import { basicLandsFor } from '../../mana';
import { typesFromTypeLine, subtypesFromTypeLine } from '../../harness';
import type { TraceResult } from '../../harness';
import {
  setupEnginePilot,
  pilotActions,
  pilotCast,
  pilotResolveTop,
  advanceToPlayersNextMain1,
  pilotActivate,
  pilotTransform,
  finishEnginePilotTrace,
  type EnginePilotSetup,
} from '../../engine-trace';

export function runEngineScenarios(): TraceResult[] {
  const setup: EnginePilotSetup = {
    you: { tokens: ['c_1_1_hero'], basicLands: basicLandsFor('{3}{U}{U}'), libraryCount: 15 },
    opponents: [{ tokens: ['c_a_treasure_sac'], basicLands: ['Forest'], libraryCount: 10 }],
  };
  const pilot = setupEnginePilot(setup);

  const jillReal = pilot.state.addCard(pilot.you, 'Hand', {
    name: jillShivasDominant.name,
    types: typesFromTypeLine(jillShivasDominant.typeLine),
    subtypes: subtypesFromTypeLine(jillShivasDominant.typeLine),
    basePower: jillShivasDominant.pt?.[0],
    baseToughness: jillShivasDominant.pt?.[1],
  });
  const actions = pilotActions(pilot, jillReal.id);

  // Cast Jill from hand (601), real {2}{U} mana payment
  pilotCast(pilot, jillReal, jillShivasDominant, pilot.ctxFor(jillReal), actions);
  // Resolves; real ETB (603.6b) bounces the opponent's Treasure
  pilotResolveTop(pilot);

  // Real turn passage — summoning sickness (302.6) clears
  advanceToPlayersNextMain1(pilot, pilot.you);

  // Activate the transform (602.1: {3}{U}{U}, {T}, sorcery speed)
  pilotActivate(pilot, pilot.you, jillReal, jillShivasDominant, pilot.ctxFor(jillReal), actions);
  pilotResolveTop(pilot);

  // Front -> Shiva, Warden of Ice. Real 714.2b/c: enters as a Saga with no
  // lore counters, then immediately gets its first — chapter I fires here.
  const backFace = jillShivasDominant.backFace!;
  pilotTransform(pilot, jillReal, backFace, pilot.ctxFor(jillReal), actions);

  // Real turn passage through your next draw step — chapter II fires for real
  advanceToPlayersNextMain1(pilot, pilot.you, jillReal);

  // Another real turn — chapter III fires: taps opponent's lands, then
  // exiles and returns Shiva transformed back to Jill
  advanceToPlayersNextMain1(pilot, pilot.you, jillReal);

  // Re-register the front face after the transform-back (saga.ts's own
  // convention: a piloting caller must call this explicitly)
  pilotTransform(pilot, jillReal, jillShivasDominant, pilot.ctxFor(jillReal), actions);

  const result =
    "Jill enters, ETB returns the opponent's Treasure to hand; once summoning sickness clears, {3}{U}{U}, {T} exiles Jill and returns it transformed as Shiva, Warden of Ice; chapter I fires immediately (grants your Hero unblockable), chapter II fires on your next draw step, chapter III fires the turn after (taps all the opponent's lands, then exiles Shiva and returns it as Jill) — all through the real turn-based engine.";

  return [finishEnginePilotTrace(pilot, setup, 'real engine playthrough: cast -> ETB -> transform -> Saga chapters over real turns', result)];
}
