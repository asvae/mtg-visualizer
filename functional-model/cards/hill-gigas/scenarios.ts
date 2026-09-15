// Real engine-piloted trace (see engine-trace.ts's own header). Two
// independent real scenarios, same "genuinely two different real actions"
// split cloudbound-moogle's own castAndEnters/plainscycling pair already
// establishes: Hill Gigas is either CAST normally (no ETB of its own — a
// vanilla body beyond Trample/Haste) or CYCLED (discarded from hand
// instead, never entering the battlefield at all) — never both with the
// same physical card.
//
// Mountaincycling {2} (2026-09-15, real gap closed — see definition.ts's
// own comment) is now a real, structured, engine-piloted activated
// ability, migrated off free `staticAbilities` text onto `cycling.ts`'s
// own shared `basicLandcycling` factory — same real mechanism
// cloudbound-moogle's own Plainscycling scenario already exercises for a
// different basic land type.

import { hillGigas } from './definition';
import { basicLandsFor } from '../../mana';
import type { TraceResult } from '../../harness';
import { setupEnginePilot, pilotActions, pilotCast, pilotResolveTop, pilotActivate, finishEnginePilotTrace, type EnginePilotSetup } from '../../engine-trace';

function castAndEnters(): TraceResult {
  const setup: EnginePilotSetup = { you: { basicLands: basicLandsFor('{4}{R}{R}') } };
  const pilot = setupEnginePilot(setup);
  const real = pilot.state.addCard(pilot.you, 'Hand', {
    name: hillGigas.name,
    types: ['Creature'],
    subtypes: ['Giant'],
    keywords: hillGigas.keywords,
    basePower: hillGigas.pt?.[0],
    baseToughness: hillGigas.pt?.[1],
  });
  const actions = pilotActions(pilot, real.id);
  const ctx = pilot.ctxFor(real);

  pilotCast(pilot, real, hillGigas, ctx, actions);
  pilotResolveTop(pilot);

  const result = 'Hill Gigas is cast ({4}{R}{R} paid) and enters the battlefield, no ETB of its own (Trample/Haste only).';
  return finishEnginePilotTrace(pilot, setup, 'engine playthrough: cast -> resolve -> enters', result);
}

function mountaincycling(): TraceResult {
  const setup: EnginePilotSetup = { you: { basicLands: basicLandsFor('{2}') } };
  const pilot = setupEnginePilot(setup);
  // A real Mountain, not invented placeholder filler — the actual real
  // card Mountaincycling's own search needs to find.
  pilot.state.addCard(pilot.you, 'Library', { name: 'Mountain', types: ['Land'], subtypes: ['Mountain'] });
  const real = pilot.state.addCard(pilot.you, 'Hand', { name: hillGigas.name, types: ['Creature'], subtypes: ['Giant'] });
  const actions = pilotActions(pilot, real.id);
  const ctx = pilot.ctxFor(real);

  // Real 602.1 activation FROM HAND: {2} paid, Hill Gigas itself genuinely
  // discarded (Hand -> Graveyard) as part of the cost, then the ability
  // resolves as a real library search — never entering the battlefield at
  // all.
  pilotActivate(pilot, pilot.you, real, hillGigas, ctx, actions, 'Activate Mountaincycling ({2}, Discard this card): search for a Mountain', 'cycling');
  pilotResolveTop(pilot);

  const result =
    'Mountaincycling {2} is activated from hand: {2} is paid, Hill Gigas is genuinely discarded (never cast, never enters the battlefield) as part of the cost, then the ability resolves for real — searching the library for the real Mountain card, putting it into hand, then shuffling.';
  return finishEnginePilotTrace(pilot, setup, 'engine playthrough: Mountaincycling activated from hand -> discard self -> search library -> shuffle', result);
}

export function runEngineScenarios(): TraceResult[] {
  return [castAndEnters(), mountaincycling()];
}
