// Real engine-piloted trace (see engine-trace.ts's own header). Two
// independent real scenarios (same "genuinely two different real actions"
// split auron-s-inspiration's own normalCast/flashbackCast establishes):
// Balamb T-Rexaur is either CAST normally (its own ETB gains 3 life) or
// CYCLED (discarded from hand instead, never entering the battlefield at
// all). `keywordScenarios` contributed nothing for this card before this
// change (Trample isn't a Lifelink/CDA/Legendary probe) — dropped along
// with the migration, no coverage lost.
//
// Forestcycling {2} (ENGINE_GAPS.md gap #23, closed 2026-09-14) is now a
// real, structured, engine-piloted activated ability — see definition.ts's
// own comment and cloudbound-moogle/definition.ts's own comment for the
// full mechanism.

import { balambTRexaur } from './definition';
import { basicLandsFor } from '../../mana';
import type { TraceResult } from '../../harness';
import { setupEnginePilot, pilotActions, pilotCast, pilotResolveTop, pilotActivate, pilotFireTrigger, finishEnginePilotTrace, type EnginePilotSetup } from '../../engine-trace';

function castAndEnters(): TraceResult {
  const setup: EnginePilotSetup = { you: { basicLands: basicLandsFor('{4}{G}{G}') } };
  const pilot = setupEnginePilot(setup);
  const real = pilot.state.addCard(pilot.you, 'Hand', {
    name: balambTRexaur.name,
    types: ['Creature'],
    subtypes: ['Dinosaur'],
    keywords: balambTRexaur.keywords,
    basePower: balambTRexaur.pt?.[0],
    baseToughness: balambTRexaur.pt?.[1],
  });
  const actions = pilotActions(pilot, real.id);
  const ctx = pilot.ctxFor(real);

  pilotCast(pilot, real, balambTRexaur, ctx, actions);
  pilotResolveTop(pilot);
  pilotFireTrigger(pilot, balambTRexaur, ctx, actions, 'onEnter');

  const result = 'Balamb T-Rexaur is cast ({4}{G}{G} paid) and enters the battlefield; its ETB gains you 3 life.';
  return finishEnginePilotTrace(pilot, setup, 'engine playthrough: cast -> resolve -> enters -> ETB lifegain', result);
}

function forestcycling(): TraceResult {
  const setup: EnginePilotSetup = { you: { basicLands: basicLandsFor('{2}') } };
  const pilot = setupEnginePilot(setup);
  // A real Forest, not invented placeholder filler.
  pilot.state.addCard(pilot.you, 'Library', { name: 'Forest', types: ['Land'], subtypes: ['Forest'] });
  const real = pilot.state.addCard(pilot.you, 'Hand', { name: balambTRexaur.name, types: ['Creature'], subtypes: ['Dinosaur'] });
  const actions = pilotActions(pilot, real.id);
  const ctx = pilot.ctxFor(real);

  pilotActivate(pilot, pilot.you, real, balambTRexaur, ctx, actions, 'Activate Forestcycling ({2}, Discard this card): search for a Forest', 'cycling');
  pilotResolveTop(pilot);

  const result =
    'Forestcycling {2} is activated from hand: {2} is paid, Balamb T-Rexaur is genuinely discarded (never cast, never enters the battlefield) as part of the cost, then the ability resolves for real — searching the library for the real Forest card, putting it into hand, then shuffling.';
  return finishEnginePilotTrace(pilot, setup, 'engine playthrough: Forestcycling activated from hand -> discard self -> search library -> shuffle', result);
}

export function runEngineScenarios(): TraceResult[] {
  return [castAndEnters(), forestcycling()];
}
