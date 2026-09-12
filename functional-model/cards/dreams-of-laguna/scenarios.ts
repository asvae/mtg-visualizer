// Real engine-piloted trace (see engine-trace.ts's own header). 2026-09-12:
// migrated to the unified v2 Fact model and, per the SAME user-approved
// consolidation precedent as from-father-to-son (fin/20, the other real
// Flashback card migrated this same day), collapsed to ONE continuous
// playthrough — cast from hand, resolve for real, THEN cast the SAME real
// instance again from the graveyard via Flashback — rather than two
// separate standalone scenarios. Mirrors that file's own pattern exactly
// (`pilotCast`/`pilotResolveTop` twice against one shared `cardReal`).

import { dreamsOfLaguna } from './definition';
import { basicLandsFor } from '../../mana';
import type { TraceResult } from '../../harness';
import { setupEnginePilot, pilotActions, pilotCast, pilotResolveTop, finishEnginePilotTrace, type EnginePilotSetup } from '../../engine-trace';

export function runEngineScenarios(): TraceResult[] {
  const flashback = dreamsOfLaguna.alternateCosts!.find((c) => c.name === 'Flashback')!;
  // Enough real library cards for THREE real draws total: one from the
  // pilot's own real turn-1 Draw step (setupEnginePilot's own real CR
  // 103.8a first-draw exposure — same "single-player board draws anyway"
  // baseline from-father-to-son's own scenario documents), plus one real
  // draw from each of this card's own two real resolutions (hand-cast,
  // then Flashback-cast). No named/typed library card is needed — this
  // card's own effect only surveils (log-only, no real library mutation —
  // see harness.ts's own `surveil` doc comment) and draws, it never
  // searches for anything specific.
  // Enough real lands for BOTH real casts within the same turn/main phase
  // without needing an untap step in between ({1}{U} + {3}{U} = {4}{U}{U}
  // combined, no land reused across the two payments).
  const setup: EnginePilotSetup = { you: { basicLands: basicLandsFor('{4}{U}{U}'), libraryCount: 3 } };
  const pilot = setupEnginePilot(setup);

  const cardReal = pilot.state.addCard(pilot.you, 'Hand', { name: dreamsOfLaguna.name, types: [] });
  const actions = pilotActions(pilot, cardReal.id);

  // Cast from hand ({1}{U}), real mana payment — castFrom defaults to 'hand'.
  pilotCast(pilot, cardReal, dreamsOfLaguna, pilot.ctxFor(cardReal), actions);
  // Resolves — real surveil 1 (log-only, see above), then a real draw,
  // then the spell itself goes to the graveyard for real (CR 608.2m, no
  // alternate cost paid this cast, so no thenExile).
  pilotResolveTop(pilot);

  // Cast AGAIN, this time via Flashback ({3}{U}) straight from the
  // graveyard it just landed in (`cardReal` is the exact same real
  // instance, now real `zone: 'Graveyard'` — no separate card needed).
  const flashbackCtx = pilot.ctxFor(cardReal, { castFrom: 'graveyard' });
  pilotCast(pilot, cardReal, dreamsOfLaguna, flashbackCtx, actions, undefined, flashback);
  // Resolves — real surveil 1, then a real draw, then the spell itself is
  // exiled instead of returning to the graveyard (thenExile, CR 702.32).
  pilotResolveTop(pilot);

  const result =
    'Dreams of Laguna is cast from hand for {1}{U} and resolves: surveils 1 (log-only, no library mutation), then draws a card, then goes to the graveyard. It is then cast AGAIN from the graveyard via Flashback for {3}{U}: surveils 1, draws another card, then the spell itself is exiled instead of returning to the graveyard.';
  return [finishEnginePilotTrace(pilot, setup, 'real engine playthrough: cast from hand -> surveil -> draw -> graveyard -> Flashback cast -> surveil -> draw -> exile', result)];
}
