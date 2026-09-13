// Real engine-piloted trace (see engine-trace.ts's own header). onEnter is a
// real recognized auto-fire (603.6b) — wired via `on: 'enter'` on this
// card's own definition.ts (same convention Cloud, Midgar Mercenary's own
// onEnter uses). Two separate real playthroughs, one per real origin zone
// the card's own "and/or" search actually offers (CR-legal: the ability
// searches BOTH zones and this player may take a card from either) — a
// single trace can only show ONE zone actually yielding the found card
// (the effect's own `pool` always prefers Library first when both zones
// have a hit, see definition.ts), so the Graveyard half needs its own,
// library-empty playthrough to genuinely demonstrate the graveyard branch
// running as real code, not asserted.
//
// Real bug found+fixed while building this scenario (2026-09-11): an
// `EnginePilotSetup` with NO `opponents` produces a genuinely 1-player
// `GameState` (`setupEnginePilot`'s own `[you, ...opponents]` with
// `opponents=[]`). `turn.ts`'s own `shouldSkipDraw` correctly requires
// `playerCount === 2` for CR 103.8a's "skip the starting player's first
// draw" rule (that rule is specifically a 2-PLAYER-game rule, not a
// universal one) — so a 1-player pilot is NOT a real 2-player game and
// legitimately does NOT skip the turn-1 draw, silently pulling a real card
// off the top of `you`'s library during `setupEnginePilot` itself, before
// any scenario code runs. `setupPlayer` adds `libraryArtifactCount`'s own
// artifact card FIRST (library index 0 = "top"), so an early version of
// this scenario (no `opponents`, same shape Cloud, Midgar Mercenary's own
// `scenarios.ts` also uses) had its OWN seeded library artifact silently
// drawn into hand before Delivery Moogle's ETB ever ran — the final hand
// still happened to contain the artifact, so the scenario's own `result`
// string still read as "true," but for the WRONG reason (an incidental
// opening draw, not the card's own tutor effect), and the real trace log
// correctly showed zero `read:isArtifact`/`moveTo` evidence for it. Fixed
// by giving both playthroughs below a real second player (`opponents`),
// restoring a genuine 2-player game so `shouldSkipDraw` applies as
// intended and the seeded artifact survives to be found by the real ETB.
// NOT fixed here (flagged instead, out of scope for a single-card
// migration, reported to the parent session): checked Cloud, Midgar
// Mercenary's OWN checked-in scenario the same way (a scratch script
// replaying its exact `setupEnginePilot` call) and confirmed it has this
// EXACT bug live today, not just a theoretical risk — its own seeded
// library artifact is ALREADY sitting in `you`'s hand immediately after
// `setupEnginePilot` returns, before its own `pilotCast` is even called.
// Its own real ETB `move` effect then runs against an artifact-less
// library (7 plain lands only) and finds nothing — `harness.ts`'s
// declarative `move` action (`move: (player, from, to, qty, validType) =>
// {...}`, used by this `kind:'move'`/dig-style effect, not this card's own
// `custom` one) logs `fn:'move', ..., qty:1, validType:'artifact'`
// UNCONDITIONALLY even though its own `chosen` array is empty — so
// Cloud's checked-in trace.json's apparent "successful tutor" is
// fabricated by the log, not real: the artifact ends up in Cloud's hand
// SOLELY because of the incidental early draw, not because of Cloud's own
// ETB at all. Same root cause (`shouldSkipDraw`'s correct 2-player-only
// gate + a 1-player pilot setup) as this card's own bug, plus a second,
// independent bug (`move`'s unconditional log) this card's own `custom`
// effect never triggers (it already guards `if (pool.length === 0)
// return;` before ever calling `actions.moveTo`, so it can't silently
// claim success on an empty pool the way the shared `move` action can).
// Real fix for Cloud (and any other `kind:'move'`-based tutor scenario
// with no `opponents`) is the same one applied here (add a real second
// player) plus a `harness.ts` fix to only log `fn:'move'` when `chosen`
// is non-empty — both left for a dedicated follow-up since fixing the
// shared `move` helper could change which currently-passing pool cards'
// verify-synergy evidence check still passes, which needs its own
// full-pool audit, not a change bundled into this card's migration.

import { deliveryMoogle } from './definition';
import { basicLandsFor } from '../../mana';
import type { TraceResult } from '../../harness';
import { setupEnginePilot, pilotActions, pilotCast, pilotResolveTop, finishEnginePilotTrace, type EnginePilotSetup } from '../../engine-trace';

export function runEngineScenarios(): TraceResult[] {
  const librarySetup: EnginePilotSetup = {
    you: { basicLands: basicLandsFor('{3}{W}'), libraryCount: 3, libraryArtifactCount: 1 },
    opponents: [{ basicLands: ['Forest'], libraryCount: 5 }],
  };
  const libraryPilot = setupEnginePilot(librarySetup);
  const libraryMoogle = libraryPilot.state.addCard(libraryPilot.you, 'Hand', { name: deliveryMoogle.name, types: ['Creature'], subtypes: ['Moogle'] });
  const libraryActions = pilotActions(libraryPilot, libraryMoogle.id);
  const libraryCtx = libraryPilot.ctxFor(libraryMoogle);

  // Cast Delivery Moogle ({3}{W}), real mana payment
  pilotCast(libraryPilot, libraryMoogle, deliveryMoogle, libraryCtx, libraryActions);
  // Resolves; real 603.6b ETB auto-fires — searches the real library (mana
  // value 2 or less, real `getCMC()` check) for the one real artifact card,
  // puts it into hand
  pilotResolveTop(libraryPilot);

  const libraryResult =
    'Delivery Moogle enters; ETB (603.6b) searches your library for an artifact card with mana value 2 or less (getCMC() check), puts it into hand.';
  const libraryTrace = finishEnginePilotTrace(
    libraryPilot,
    librarySetup,
    'engine playthrough: cast -> ETB library search',
    libraryResult,
  );

  const graveyardSetup: EnginePilotSetup = {
    you: { basicLands: basicLandsFor('{3}{W}'), libraryCount: 3, graveyardArtifactCount: 1 },
    opponents: [{ basicLands: ['Forest'], libraryCount: 5 }],
  };
  const graveyardPilot = setupEnginePilot(graveyardSetup);
  const graveyardMoogle = graveyardPilot.state.addCard(graveyardPilot.you, 'Hand', { name: deliveryMoogle.name, types: ['Creature'], subtypes: ['Moogle'] });
  const graveyardActions = pilotActions(graveyardPilot, graveyardMoogle.id);
  const graveyardCtx = graveyardPilot.ctxFor(graveyardMoogle);

  // Cast Delivery Moogle again in a SEPARATE playthrough with no library
  // artifact at all, so the real ETB's own `pool` (Library first, then
  // Graveyard — see definition.ts) has nothing to find in Library and
  // genuinely falls through to the Graveyard candidate this setup seeds.
  pilotCast(graveyardPilot, graveyardMoogle, deliveryMoogle, graveyardCtx, graveyardActions);
  pilotResolveTop(graveyardPilot);

  const graveyardResult =
    "Delivery Moogle enters with no artifact in library; ETB (603.6b) falls through to the artifact card sitting in your graveyard (mana value 2 or less, getCMC() check), puts it into hand.";
  const graveyardTrace = finishEnginePilotTrace(
    graveyardPilot,
    graveyardSetup,
    'engine playthrough: cast -> ETB graveyard search',
    graveyardResult,
  );

  return [libraryTrace, graveyardTrace];
}
