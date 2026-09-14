// Real engine-piloted trace (see engine-trace.ts's own header). Two
// independent real scenarios (same "genuinely two different real actions"
// split auron-s-inspiration's own normalCast/flashbackCast establishes):
// Capital City is either PLAYED normally as a land (a real CR 305.1 land
// drop, no ETB trigger — see definition.ts's own comment) or CYCLED
// (discarded from hand instead, never hitting the battlefield at all).
//
// Cycling {2} (ENGINE_GAPS.md gap #23, closed 2026-09-14) is now a real,
// structured, engine-piloted activated ability — see definition.ts's own
// comment and cloudbound-moogle/definition.ts's own comment for the full
// mechanism (this is the plain, no-search Cycling shape). Previously this
// file was an empty array (every fact was covered by
// verify-synergy.mjs's own static-check exemptions) — no longer true now
// that this card has real, executable ability behavior a scenario can (and
// must) exercise (`isStaticOnlyLand`'s own doc comment, updated same pass).

import { capitalCity } from './definition';
import type { TraceResult } from '../../harness';
import { setupEnginePilot, pilotActions, pilotPlayLand, pilotActivate, pilotResolveTop, finishEnginePilotTrace, type EnginePilotSetup } from '../../engine-trace';

function landDrop(): TraceResult {
  const setup: EnginePilotSetup = {};
  const pilot = setupEnginePilot(setup);
  const real = pilot.state.addCard(pilot.you, 'Hand', { name: capitalCity.name, types: ['Land'], subtypes: ['Town'] });
  const actions = pilotActions(pilot, real.id);
  const ctx = pilot.ctxFor(real);

  pilotPlayLand(pilot, real, capitalCity, ctx, actions);

  const result = 'Capital City is played as a land (CR 305.1) and enters the battlefield untapped — no ETB trigger (unlike every other real Town-cycle land in this pool).';
  return finishEnginePilotTrace(pilot, setup, 'engine playthrough: land drop -> enters', result);
}

function cycling(): TraceResult {
  const setup: EnginePilotSetup = { you: { basicLands: ['Forest', 'Forest'], libraryCount: 1 } };
  const pilot = setupEnginePilot(setup);
  const real = pilot.state.addCard(pilot.you, 'Hand', { name: capitalCity.name, types: ['Land'], subtypes: ['Town'] });
  const actions = pilotActions(pilot, real.id);
  const ctx = pilot.ctxFor(real);

  pilotActivate(pilot, pilot.you, real, capitalCity, ctx, actions, 'Activate Cycling ({2}, Discard this card): draw a card', 'cycling');
  pilotResolveTop(pilot);

  const result =
    'Cycling {2} is activated from hand: {2} is paid, Capital City is genuinely discarded (never played as a land) as part of the cost, then the ability resolves for real — drawing a real card.';
  return finishEnginePilotTrace(pilot, setup, 'engine playthrough: Cycling activated from hand -> discard self -> draw a card', result);
}

export function runEngineScenarios(): TraceResult[] {
  return [landDrop(), cycling()];
}
