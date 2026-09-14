// Real engine-piloted trace (see engine-trace.ts's own header). Two
// independent real scenarios (same "genuinely two different real actions"
// split auron-s-inspiration's own normalCast/flashbackCast establishes):
// Malboro is either CAST normally (its own ETB hits each opponent) or
// CYCLED (discarded from hand instead, never entering the battlefield at
// all).
//
// Swampcycling {2} (ENGINE_GAPS.md gap #23, closed 2026-09-14) is now a
// real, structured, engine-piloted activated ability — see definition.ts's
// own comment and cloudbound-moogle/definition.ts's own comment for the
// full mechanism.

import { malboro } from './definition';
import { basicLandsFor } from '../../mana';
import type { TraceResult } from '../../harness';
import { setupEnginePilot, pilotActions, pilotCast, pilotResolveTop, pilotActivate, pilotFireTrigger, finishEnginePilotTrace, type EnginePilotSetup } from '../../engine-trace';

function castAndEnters(): TraceResult {
  const setup: EnginePilotSetup = { you: { basicLands: basicLandsFor('{4}{B}{B}') }, opponents: [{ handCount: 4, life: 20, libraryCount: 40 }] };
  const pilot = setupEnginePilot(setup);
  const real = pilot.state.addCard(pilot.you, 'Hand', {
    name: malboro.name,
    types: ['Creature'],
    subtypes: ['Plant', 'Horror'],
    basePower: malboro.pt?.[0],
    baseToughness: malboro.pt?.[1],
  });
  const actions = pilotActions(pilot, real.id);
  const ctx = pilot.ctxFor(real);

  pilotCast(pilot, real, malboro, ctx, actions);
  pilotResolveTop(pilot);
  pilotFireTrigger(pilot, malboro, ctx, actions, 'onEnter');

  const result = 'Malboro is cast ({4}{B}{B} paid) and enters the battlefield; its ETB makes the opponent discard a card, lose 2 life, and has the top 3 cards of their library exiled.';
  return finishEnginePilotTrace(pilot, setup, 'engine playthrough: cast -> resolve -> enters -> ETB opponent punishment', result);
}

function swampcycling(): TraceResult {
  const setup: EnginePilotSetup = { you: { basicLands: basicLandsFor('{2}') } };
  const pilot = setupEnginePilot(setup);
  // A real Swamp, not invented placeholder filler.
  pilot.state.addCard(pilot.you, 'Library', { name: 'Swamp', types: ['Land'], subtypes: ['Swamp'] });
  const real = pilot.state.addCard(pilot.you, 'Hand', { name: malboro.name, types: ['Creature'], subtypes: ['Plant', 'Horror'] });
  const actions = pilotActions(pilot, real.id);
  const ctx = pilot.ctxFor(real);

  pilotActivate(pilot, pilot.you, real, malboro, ctx, actions, 'Activate Swampcycling ({2}, Discard this card): search for a Swamp', 'cycling');
  pilotResolveTop(pilot);

  const result =
    'Swampcycling {2} is activated from hand: {2} is paid, Malboro is genuinely discarded (never cast, never enters the battlefield) as part of the cost, then the ability resolves for real — searching the library for the real Swamp card, putting it into hand, then shuffling.';
  return finishEnginePilotTrace(pilot, setup, 'engine playthrough: Swampcycling activated from hand -> discard self -> search library -> shuffle', result);
}

export function runEngineScenarios(): TraceResult[] {
  return [castAndEnters(), swampcycling()];
}
