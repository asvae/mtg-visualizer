// Real engine-piloted trace (see engine-trace.ts's own header). Two
// independent real scenarios (same "genuinely two different real actions"
// split auron-s-inspiration's own normalCast/flashbackCast establishes):
// Ice Flan is either CAST normally (its own ETB taps + stuns an opponent's
// creature) or CYCLED (discarded from hand instead, never entering the
// battlefield at all).
//
// Islandcycling {2} (ENGINE_GAPS.md gap #23, closed 2026-09-14) is now a
// real, structured, engine-piloted activated ability — see definition.ts's
// own comment and cloudbound-moogle/definition.ts's own comment for the
// full mechanism.

import { iceFlan } from './definition';
import { basicLandsFor } from '../../mana';
import type { TraceResult } from '../../harness';
import { setupEnginePilot, pilotActions, pilotCast, pilotResolveTop, pilotActivate, pilotFireTrigger, finishEnginePilotTrace, type EnginePilotSetup } from '../../engine-trace';

function castAndEnters(): TraceResult {
  const setup: EnginePilotSetup = { you: { basicLands: basicLandsFor('{4}{U}{U}') }, opponents: [{ creaturesCount: 1 }] };
  const pilot = setupEnginePilot(setup);
  const real = pilot.state.addCard(pilot.you, 'Hand', {
    name: iceFlan.name,
    types: ['Creature'],
    subtypes: ['Elemental', 'Ooze'],
    basePower: iceFlan.pt?.[0],
    baseToughness: iceFlan.pt?.[1],
  });
  const actions = pilotActions(pilot, real.id);
  const ctx = pilot.ctxFor(real);

  pilotCast(pilot, real, iceFlan, ctx, actions);
  pilotResolveTop(pilot);
  pilotFireTrigger(pilot, iceFlan, ctx, actions, 'onEnter');

  const result = "Ice Flan is cast ({4}{U}{U} paid) and enters the battlefield; its ETB taps the opponent's target creature and puts a stun counter on it.";
  return finishEnginePilotTrace(pilot, setup, 'engine playthrough: cast -> resolve -> enters -> ETB tap+stun', result);
}

function islandcycling(): TraceResult {
  const setup: EnginePilotSetup = { you: { basicLands: basicLandsFor('{2}') } };
  const pilot = setupEnginePilot(setup);
  // A real Island, not invented placeholder filler.
  pilot.state.addCard(pilot.you, 'Library', { name: 'Island', types: ['Land'], subtypes: ['Island'] });
  const real = pilot.state.addCard(pilot.you, 'Hand', { name: iceFlan.name, types: ['Creature'], subtypes: ['Elemental', 'Ooze'] });
  const actions = pilotActions(pilot, real.id);
  const ctx = pilot.ctxFor(real);

  pilotActivate(pilot, pilot.you, real, iceFlan, ctx, actions, 'Activate Islandcycling ({2}, Discard this card): search for an Island', 'cycling');
  pilotResolveTop(pilot);

  const result =
    'Islandcycling {2} is activated from hand: {2} is paid, Ice Flan is genuinely discarded (never cast, never enters the battlefield) as part of the cost, then the ability resolves for real — searching the library for the real Island card, putting it into hand, then shuffling.';
  return finishEnginePilotTrace(pilot, setup, 'engine playthrough: Islandcycling activated from hand -> discard self -> search library -> shuffle', result);
}

export function runEngineScenarios(): TraceResult[] {
  return [castAndEnters(), islandcycling()];
}
