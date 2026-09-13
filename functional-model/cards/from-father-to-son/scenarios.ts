// Real engine-piloted trace (see engine-trace.ts's own header). 2026-09-12:
// consolidated the old 2 separate scenarios (a plain hand-cast, a separate
// standalone Flashback-cast) into ONE continuous playthrough, per the
// user's own live call: "use only one scenario: first cast from hand -
// fetch one artifact, then cast from graveyard - place on the battlefield."
// Mirrors auron-s-inspiration's own real Flashback pattern (`canCastSpell`/
// `castSpell`/`pilotCast`'s `alt` param, ENGINE_GAPS.md gap #7) — this
// card's own effect genuinely branches on `ctx.castFrom` ("If this spell
// was cast from a graveyard, put that card onto the battlefield instead"),
// which is what originally surfaced the real, narrow `ctxFor` gap fixed in
// `engine-trace.ts` itself (`EnginePilotCtxOpts.castFrom`).

import { fromFatherToSon } from './definition';
import { basicLandsFor } from '../../mana';
import type { TraceResult } from '../../harness';
import { setupEnginePilot, pilotActions, pilotCast, pilotResolveTop, finishEnginePilotTrace, type EnginePilotSetup } from '../../engine-trace';

// Two real, DISTINCT FIN Vehicle printings (data/fin/fin_scryfall.json) —
// the first one leaves the library for real after the hand-cast search, so
// the graveyard/Flashback-cast's own search needs its own real candidate
// still sitting there; reusing the same single card across both searches
// would be dishonest about what's actually happening (it can't be searched
// for twice when the first search already found and moved it).
const REAL_VEHICLE_NAME_1 = 'Magitek Armor'; // Artifact — Vehicle
const REAL_VEHICLE_NAME_2 = 'Cargo Ship'; // Artifact — Vehicle

export function runEngineScenarios(): TraceResult[] {
  const flashback = fromFatherToSon.alternateCosts!.find((c) => c.name === 'Flashback')!;
  // Enough real lands for BOTH real casts within the same turn/main phase
  // without needing an untap step in between ({1}{W} + {4}{W}{W}{W} =
  // {5}{W}{W}{W}{W} combined, no land reused across the two payments) —
  // simpler and just as real as staging a turn passage purely to reuse a
  // smaller land base would have been.
  const setup: EnginePilotSetup = { you: { basicLands: basicLandsFor('{5}{W}{W}{W}{W}'), libraryCount: 3 } };
  const pilot = setupEnginePilot(setup);
  // Appended AFTER `setupEnginePilot` (which itself already advances
  // through one real Draw step during setup — see this file's own earlier
  // header on a single-player board's real CR 103.8a first-draw exposure)
  // so neither real Vehicle is the one silently drawn away before this
  // card's own search ever runs.
  pilot.state.addCard(pilot.you, 'Library', { name: REAL_VEHICLE_NAME_1, types: ['Artifact'] });
  pilot.state.addCard(pilot.you, 'Library', { name: REAL_VEHICLE_NAME_2, types: ['Artifact'] });

  const cardReal = pilot.state.addCard(pilot.you, 'Hand', { name: fromFatherToSon.name, types: [] });
  const actions = pilotActions(pilot, cardReal.id);

  // Cast from hand ({1}{W}), real mana payment — castFrom defaults to 'hand'
  pilotCast(pilot, cardReal, fromFatherToSon, pilot.ctxFor(cardReal), actions);
  // Resolves — real library search finds Magitek Armor and puts it into
  // hand (castFrom is 'hand'), then the spell itself goes to the graveyard
  // for real (CR 608.2m, no alternate cost paid this cast, so no thenExile).
  pilotResolveTop(pilot);

  // Cast AGAIN, this time via Flashback ({4}{W}{W}{W}) straight from the
  // graveyard it just landed in (`cardReal` is the exact same real
  // instance, now real `zone: 'Graveyard'` — no separate card needed).
  const flashbackCtx = pilot.ctxFor(cardReal, { castFrom: 'graveyard' });
  pilotCast(pilot, cardReal, fromFatherToSon, flashbackCtx, actions, undefined, flashback);
  // Resolves — real library search finds the second real Vehicle (Cargo
  // Ship) and puts it directly onto the battlefield this time (castFrom is
  // 'graveyard'), then the spell itself is exiled instead of returning to
  // the graveyard (thenExile, CR 702.32).
  pilotResolveTop(pilot);

  const result =
    'From Father to Son is cast from hand for {1}{W} and resolves: searches the library for a Vehicle card (Magitek Armor) and puts it into hand, then goes to the graveyard. It is then cast AGAIN from the graveyard via Flashback for {4}{W}{W}{W}: searches the library for another Vehicle card (Cargo Ship) and puts it directly onto the battlefield this time (cast from a graveyard), then the spell itself is exiled instead of returning to the graveyard.';
  return [finishEnginePilotTrace(pilot, setup, 'engine playthrough: cast from hand -> search to hand -> graveyard -> Flashback cast -> search to battlefield -> exile', result)];
}
