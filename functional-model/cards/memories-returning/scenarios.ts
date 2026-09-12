// Real engine-piloted trace (see engine-trace.ts's own header). 2026-09-12:
// migrated to the unified v2 Fact model and, per the SAME user-approved
// consolidation precedent as dreams-of-laguna (fin/50) and from-father-to-son
// (fin/20), collapsed to ONE continuous playthrough — cast from hand,
// resolve for real, THEN cast the SAME real instance again from the
// graveyard via Flashback — rather than two separate standalone scenarios.
// Mirrors those files' own pattern exactly (`pilotCast`/`pilotResolveTop`
// twice against one shared `cardReal`).

import { memoriesReturning } from './definition';
import { basicLandsFor } from '../../mana';
import type { TraceResult } from '../../harness';
import { setupEnginePilot, pilotActions, pilotCast, pilotResolveTop, finishEnginePilotTrace, type EnginePilotSetup } from '../../engine-trace';

export function runEngineScenarios(): TraceResult[] {
  const flashback = memoriesReturning.alternateCosts!.find((c) => c.name === 'Flashback')!;
  // Enough real library cards for the pilot's own real turn-1 Draw step (1)
  // plus BOTH real dig(qty:5, take:3) resolutions in full: each dig looks at
  // 5 real cards and permanently removes 3 (the other 2 go right back to the
  // bottom, so they don't shrink the pool for the SECOND dig) — 1 + 3 + 3 =
  // 7 cards permanently consumed, but each dig still needs a full 5 sitting
  // in the library to look at when it runs, so the pool can never drop below
  // 5 before the second dig fires either: after the first draw (-1) and the
  // first dig's own real removal of 3 taken cards (-3, the 2 returned don't
  // change the total), 9 - 1 - 3 = 5 remain — exactly enough for the second
  // dig's own qty:5 look. No named/typed library card is needed — this
  // card's own effect has no `validType` filter (it takes the first `take`
  // of whatever's revealed, matching ANY card), unlike Ashe/Cloud Midgar
  // Mercenary's own typed digs.
  // Enough real lands for BOTH real casts within the same turn/main phase
  // without needing an untap step in between ({2}{U}{U} + {7}{U}{U} =
  // {9}{U}{U}{U}{U} combined, no land reused across the two payments).
  const setup: EnginePilotSetup = { you: { basicLands: basicLandsFor('{9}{U}{U}{U}{U}'), libraryCount: 9 } };
  const pilot = setupEnginePilot(setup);

  const cardReal = pilot.state.addCard(pilot.you, 'Hand', { name: memoriesReturning.name, types: [] });
  const actions = pilotActions(pilot, cardReal.id);

  // Cast from hand ({2}{U}{U}), real mana payment — castFrom defaults to 'hand'.
  pilotCast(pilot, cardReal, memoriesReturning, pilot.ctxFor(cardReal), actions);
  // Resolves — real dig(qty:5, take:3): reveals the real top 5 library
  // cards, moves 3 of them to hand for real (the engine's own `dig` has no
  // player-choice machinery, so it takes the first 3 rather than modeling
  // the real alternating you/opponent picks — the net zone outcome across
  // the 5 is identical either way, same simplification this card's own
  // definition.ts already documents), returns the other 2 to the bottom.
  // Then the spell itself goes to the graveyard for real (CR 608.2m, no
  // alternate cost paid this cast, so no thenExile).
  pilotResolveTop(pilot);

  // Cast AGAIN, this time via Flashback ({7}{U}{U}) straight from the
  // graveyard it just landed in (`cardReal` is the exact same real
  // instance, now real `zone: 'Graveyard'` — no separate card needed).
  const flashbackCtx = pilot.ctxFor(cardReal, { castFrom: 'graveyard' });
  pilotCast(pilot, cardReal, memoriesReturning, flashbackCtx, actions, undefined, flashback);
  // Resolves — the same real dig(qty:5, take:3) against the remaining real
  // library, then the spell itself is exiled instead of returning to the
  // graveyard (thenExile, CR 702.32).
  pilotResolveTop(pilot);

  const result =
    'Memories Returning is cast from hand for {2}{U}{U} and resolves: reveals the top 5 library cards, moves 3 of them to hand and the other 2 to the bottom (the engine has no player-choice machinery, so it takes the first 3 rather than modeling the alternating you/opponent picks — same net zone outcome), then goes to the graveyard. It is then cast AGAIN from the graveyard via Flashback for {7}{U}{U}: same dig against the remaining library, then the spell itself is exiled instead of returning to the graveyard.';
  return [finishEnginePilotTrace(pilot, setup, 'real engine playthrough: cast from hand -> dig (5, take 3) -> graveyard -> Flashback cast -> dig (5, take 3) -> exile', result)];
}
