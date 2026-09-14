// Real engine-piloted trace (see engine-trace.ts's own header). Two
// independent real scenarios (same "genuinely two different real actions"
// split auron-s-inspiration's own normalCast/flashbackCast establishes):
// Airship Crash is either CAST normally (destroys a real target) or CYCLED
// (discarded from hand instead, never cast at all).
//
// Cycling {2} (ENGINE_GAPS.md gap #23, closed 2026-09-14) is now a real,
// structured, engine-piloted activated ability — see definition.ts's own
// comment for why it's modeled via the NAMED `abilities` array (this
// card's own top-level `effects` is already spoken for, the Instant's own
// destroy-target cast effect) and cloudbound-moogle/definition.ts's own
// comment for the full mechanism.

import { airshipCrash } from './definition';
import { basicLandsFor } from '../../mana';
import type { TraceResult } from '../../harness';
import { setupEnginePilot, pilotActions, pilotCast, pilotResolveTop, pilotActivate, finishEnginePilotTrace, type EnginePilotSetup } from '../../engine-trace';

function castAndDestroys(): TraceResult {
  const setup: EnginePilotSetup = { you: { basicLands: basicLandsFor('{2}{G}'), artifactsCount: 1 } };
  const pilot = setupEnginePilot(setup);
  const real = pilot.state.addCard(pilot.you, 'Hand', { name: airshipCrash.name, types: [] });
  const actions = pilotActions(pilot, real.id);
  const ctx = pilot.ctxFor(real);

  pilotCast(pilot, real, airshipCrash, ctx, actions);
  pilotResolveTop(pilot);

  const result = 'Airship Crash is cast ({2}{G} paid) and destroys the real target artifact.';
  return finishEnginePilotTrace(pilot, setup, 'engine playthrough: cast -> resolve -> destroy target artifact', result);
}

function cycling(): TraceResult {
  const setup: EnginePilotSetup = { you: { basicLands: basicLandsFor('{2}'), libraryCount: 1 } };
  const pilot = setupEnginePilot(setup);
  const real = pilot.state.addCard(pilot.you, 'Hand', { name: airshipCrash.name, types: [] });
  const actions = pilotActions(pilot, real.id);
  const ctx = pilot.ctxFor(real);

  pilotActivate(pilot, pilot.you, real, airshipCrash, ctx, actions, 'Activate Cycling ({2}, Discard this card): draw a card', 'cycling');
  pilotResolveTop(pilot);

  const result =
    'Cycling {2} is activated from hand: {2} is paid, Airship Crash is genuinely discarded (never cast, its own destroy effect never runs) as part of the cost, then the ability resolves for real — drawing a real card.';
  return finishEnginePilotTrace(pilot, setup, 'engine playthrough: Cycling activated from hand -> discard self -> draw a card', result);
}

export function runEngineScenarios(): TraceResult[] {
  return [castAndDestroys(), cycling()];
}
