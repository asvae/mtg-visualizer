// A real, engine-piloted trace for this specific card (opted into via
// `engine-trace.ts`'s own `runEngineScenarios` contract, picked up by
// `run-scenarios.mjs` INSTEAD of `scenarios.ts`'s harness path for this one
// card) — this card's own real arc (a transforming DFC crossing into a
// Saga) is worth showing played out for real: real mana payment, a real
// wait for summoning sickness to clear before the transform activates, and
// real Saga lore-counter automation (`saga.ts`) firing each chapter on a
// real controller draw step, rather than harness.ts's flat named-trigger
// `sequence` (still `scenarios.ts`'s own mechanism for every other card,
// and kept here too — see that file — since nothing about verify-synergy.mjs's
// own reconciliation against this file's own real `synergy.json` requires
// giving that up).
//
// Same board setup `scenarios.ts`'s own scenario already uses (a real Hero
// token on your side, a real Treasure + Forest on the opponent's) — only
// HOW the arc plays out changed, not what's on the board to start.

import { jillShivasDominant } from './definition';
import { basicLandsFor } from '../../mana';
import { typesFromTypeLine, subtypesFromTypeLine } from '../../harness';
import type { TraceResult } from '../../harness';
import {
  setupEnginePilot,
  pilotActions,
  pilotCast,
  pilotResolveTop,
  pilotExpectIllegalActivate,
  advanceToPlayersNextMain1,
  pilotActivate,
  pilotTransform,
  finishEnginePilotTrace,
  type EnginePilotSetup,
} from '../../engine-trace';

export function runEngineScenarios(): TraceResult[] {
  const setup: EnginePilotSetup = {
    // Both players need a real library — this scenario crosses several
    // real turns (real 704.5a, sba.ts, genuinely loses the game for
    // whoever's instructed to draw with none left).
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

  // --- Cast Jill from hand (601), real {2}{U} mana payment ---
  pilotCast(pilot, jillReal, jillShivasDominant, pilot.ctxFor(jillReal), actions);

  // --- Resolves onto the battlefield; real ETB auto-fires (603.6b via
  // `Trigger.on:'enter'`) — the "up to one OTHER nonland permanent" pool
  // has only one real candidate (the opponent's Treasure; their Forest is
  // excluded — real text is nonland only), so the bounce is unambiguous. ---
  pilotResolveTop(pilot);

  // --- Real 302.6: the transform ability is blocked by summoning sickness
  // the turn Jill entered — demonstrated as a real, logged rejection, not
  // silently skipped. ---
  pilotExpectIllegalActivate(pilot, pilot.you, jillReal, jillShivasDominant);

  // --- Real turn passage to your own next Main1 — sickness clears, lands untap. ---
  advanceToPlayersNextMain1(pilot, pilot.you);

  // --- Activate the transform (602.1: {3}{U}{U}, {T}, sorcery-speed only),
  // real mana payment again; resolving runs the ability's own `custom`
  // effect (exile, then return transformed). ---
  pilotActivate(pilot, pilot.you, jillReal, jillShivasDominant, pilot.ctxFor(jillReal), actions);
  pilotResolveTop(pilot);

  // --- Register the transform: front -> Shiva, Warden of Ice. Real
  // 714.2b/c: Shiva enters as a Saga with no lore counters, then
  // immediately gets her first — firing chapter I for real right here. ---
  const backFace = jillShivasDominant.backFace!;
  pilotTransform(pilot, jillReal, backFace, pilot.ctxFor(jillReal), actions);

  // --- Real turn passage through your own next draw step — chapter II
  // fires for real (714.2c), granting Unblockable again. `advance()` itself
  // auto-fires the real Saga tick on entering Main1 (engine.ts's own
  // `doAdvance`); `advanceToPlayersNextMain1`'s own `watchForSaga` param
  // just brackets that auto-fire in the trace, it doesn't cause a second
  // one (see that function's own doc comment — an earlier version of this
  // script called a separate advance-sagas helper afterward too, which
  // double-fired the whole chapter sequence). ---
  advanceToPlayersNextMain1(pilot, pilot.you, jillReal);

  // --- Another real turn — chapter III fires for real: taps all the
  // opponent's lands, then Cold Snap exiles and returns Shiva transformed
  // back to Jill (the zone-change reset this causes is exactly why 714.4's
  // own sacrifice correctly does NOT also fire here — saga.ts's own
  // documented reference case for this card). ---
  advanceToPlayersNextMain1(pilot, pilot.you, jillReal);

  // --- Re-register the front face after the transform-back — saga.ts's
  // own documented convention: a piloting caller must call this
  // explicitly (a transforming Saga's own effect has no engine reference
  // to do it itself). ---
  pilotTransform(pilot, jillReal, jillShivasDominant, pilot.ctxFor(jillReal), actions);

  const result =
    "Jill enters, ETB returns the opponent's Treasure (not their land — real text is nonland only) to hand; the transform ability is blocked by summoning sickness until your next turn, then {3}{U}{U}, {T} exiles Jill and returns it transformed as Shiva, Warden of Ice; a real lore counter fires chapter I (grants your Hero unblockable) immediately on transforming, chapter II fires for real on your next draw step (unblockable again), chapter III fires the turn after that (taps all the opponent's lands, then exiles Shiva and returns it front-face-up as Jill) — all played out through the real turn-based engine (real mana payment, real summoning-sickness wait, real Saga lore-counter automation), not a flat named-trigger sequence.";

  return [finishEnginePilotTrace(pilot, setup, 'real engine playthrough: cast -> ETB -> transform -> Saga chapters over real turns', result)];
}
