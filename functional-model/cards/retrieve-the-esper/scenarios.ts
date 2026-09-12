// Real engine-piloted trace (see engine-trace.ts's own header). 2026-09-12:
// migrated to the unified v2 Fact model and, per the SAME user-approved
// consolidation precedent as from-father-to-son (fin/20) and dreams-of-laguna
// (fin/50, both migrated the same day), collapsed the old 2 separate
// standalone `harness.ts` `Scenario[]` entries (one hand-cast, one
// independent graveyard/Flashback-cast) into ONE continuous playthrough —
// cast from hand, resolve for real (create the token, no bonus counters),
// THEN cast the SAME real instance again from the graveyard via Flashback
// (create another token, THIS TIME with the bonus +1/+1 counters) — rather
// than two separate scenarios. Mirrors those files' own pattern exactly
// (`pilotCast`/`pilotResolveTop` twice against one shared `cardReal`).

import { retrieveTheEsper } from './definition';
import { basicLandsFor } from '../../mana';
import type { TraceResult } from '../../harness';
import { setupEnginePilot, pilotActions, pilotCast, pilotResolveTop, finishEnginePilotTrace, type EnginePilotSetup } from '../../engine-trace';

export function runEngineScenarios(): TraceResult[] {
  const flashback = retrieveTheEsper.alternateCosts!.find((c) => c.name === 'Flashback')!;
  // Enough real lands for BOTH real casts within the same turn/main phase
  // without needing an untap step in between ({3}{U} + {5}{U} = {8}{U}{U}
  // combined, no land reused across the two payments).
  const setup: EnginePilotSetup = { you: { basicLands: basicLandsFor('{8}{U}{U}'), libraryCount: 1 } };
  const pilot = setupEnginePilot(setup);

  const cardReal = pilot.state.addCard(pilot.you, 'Hand', { name: retrieveTheEsper.name, types: [] });
  const actions = pilotActions(pilot, cardReal.id);

  // Cast from hand ({3}{U}), real mana payment — castFrom defaults to 'hand'.
  pilotCast(pilot, cardReal, retrieveTheEsper, pilot.ctxFor(cardReal), actions);
  // Resolves — real createToken (3/3 blue Robot Warrior), no bonus counters
  // (castFrom is 'hand'), then the spell itself goes to the graveyard for
  // real (CR 608.2m, no alternate cost paid this cast, so no thenExile).
  pilotResolveTop(pilot);

  // Cast AGAIN, this time via Flashback ({5}{U}) straight from the
  // graveyard it just landed in (`cardReal` is the exact same real
  // instance, now real `zone: 'Graveyard'` — no separate card needed).
  const flashbackCtx = pilot.ctxFor(cardReal, { castFrom: 'graveyard' });
  pilotCast(pilot, cardReal, retrieveTheEsper, flashbackCtx, actions, undefined, flashback);
  // Resolves — real createToken again, this time ALSO a real putCounter
  // (+1/+1, amount 2) on the SAME just-created token, since castFrom is
  // 'graveyard'; then the spell itself is exiled instead of returning to
  // the graveyard (thenExile, CR 702.32).
  pilotResolveTop(pilot);

  const result =
    'Retrieve the Esper is cast from hand for {3}{U} and resolves: creates a 3/3 blue Robot Warrior artifact creature token with no bonus counters, then goes to the graveyard. It is then cast AGAIN from the graveyard via Flashback for {5}{U}: creates a second Robot Warrior token, this time putting two +1/+1 counters on it (cast from a graveyard), then the spell itself is exiled instead of returning to the graveyard.';
  return [finishEnginePilotTrace(pilot, setup, 'real engine playthrough: cast from hand -> create token (no counters) -> graveyard -> Flashback cast -> create token + 2 counters -> exile', result)];
}
