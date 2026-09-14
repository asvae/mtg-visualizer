// Real engine-piloted trace (see engine-trace.ts's own header). Two
// independent real scenarios (same "genuinely two different real actions"
// split auron-s-inspiration's own normalCast/flashbackCast establishes):
// Cid, Timeless Artificer is either CAST normally (enters the battlefield,
// no resolvable ETB — every OTHER ability stays static text, see
// definition.ts's own comment; a second real copy entering also proves the
// real 704.5j legend rule, same demonstration the old flat
// `keywordScenarios`' own `duplicateLegendaryEnters` used to provide) or
// CYCLED (discarded from hand instead, never entering the battlefield at
// all).
//
// Cycling {W}{U} (ENGINE_GAPS.md gap #23, closed 2026-09-14) is now a real,
// structured, engine-piloted activated ability — see definition.ts's own
// comment and cloudbound-moogle/definition.ts's own comment for the full
// mechanism.

import { cidTimelessArtificer } from './definition';
import { basicLandsFor } from '../../mana';
import type { TraceResult } from '../../harness';
import { setupEnginePilot, pilotActions, pilotCast, pilotResolveTop, pilotActivate, finishEnginePilotTrace, type EnginePilotSetup } from '../../engine-trace';

function castEntersAndLegendRule(): TraceResult {
  const setup: EnginePilotSetup = { you: { basicLands: basicLandsFor('{2}{W}{U}') } };
  const pilot = setupEnginePilot(setup);
  const real = pilot.state.addCard(pilot.you, 'Hand', {
    name: cidTimelessArtificer.name,
    types: ['Creature'],
    subtypes: ['Human', 'Artificer', 'Legendary'],
    basePower: cidTimelessArtificer.pt?.[0],
    baseToughness: cidTimelessArtificer.pt?.[1],
  });
  const actions = pilotActions(pilot, real.id);
  const ctx = pilot.ctxFor(real);

  pilotCast(pilot, real, cidTimelessArtificer, ctx, actions);
  pilotResolveTop(pilot);

  // A second real copy entering — real 704.5j legend rule (state.ts's own
  // `checkLegendRule`, already exercised the same way harness.ts's own
  // `Scenario.duplicateLegendaryEnters` does) forces its controller to keep
  // only one.
  pilot.beginStep('A second real copy of Cid, Timeless Artificer enters');
  const second = pilot.state.addCard(pilot.you, 'Battlefield', {
    name: cidTimelessArtificer.name,
    types: ['Creature'],
    subtypes: ['Human', 'Artificer', 'Legendary'],
    basePower: cidTimelessArtificer.pt?.[0],
    baseToughness: cidTimelessArtificer.pt?.[1],
  });
  pilot.log.push({ fn: 'enters', card: second.name, zone: 'Battlefield', controller: pilot.you.name });
  const removed = pilot.state.checkLegendRule(pilot.you);
  for (const c of removed) pilot.log.push({ fn: 'legendRule', card: c.name, player: pilot.you.name });

  const result =
    'Cid, Timeless Artificer is cast ({2}{W}{U} paid) and enters the battlefield with no resolvable ETB (every other real ability — the anthem, the "any number of copies" deck-construction rule — stays static text, see definition.ts); a second real copy entering then triggers the real 704.5j legend rule, and one is genuinely put into the graveyard.';
  return finishEnginePilotTrace(pilot, setup, 'engine playthrough: cast -> resolve -> enters -> a duplicate legendary copy enters -> legend rule', result);
}

function cycling(): TraceResult {
  const setup: EnginePilotSetup = { you: { basicLands: basicLandsFor('{W}{U}'), libraryCount: 1 } };
  const pilot = setupEnginePilot(setup);
  const real = pilot.state.addCard(pilot.you, 'Hand', { name: cidTimelessArtificer.name, types: ['Creature'], subtypes: ['Human', 'Artificer', 'Legendary'] });
  const actions = pilotActions(pilot, real.id);
  const ctx = pilot.ctxFor(real);

  pilotActivate(pilot, pilot.you, real, cidTimelessArtificer, ctx, actions, 'Activate Cycling ({W}{U}, Discard this card): draw a card', 'cycling');
  pilotResolveTop(pilot);

  const result =
    'Cycling {W}{U} is activated from hand: {W}{U} is paid, Cid, Timeless Artificer is genuinely discarded (never cast, never enters the battlefield) as part of the cost, then the ability resolves for real — drawing a real card.';
  return finishEnginePilotTrace(pilot, setup, 'engine playthrough: Cycling activated from hand -> discard self -> draw a card', result);
}

export function runEngineScenarios(): TraceResult[] {
  return [castEntersAndLegendRule(), cycling()];
}
