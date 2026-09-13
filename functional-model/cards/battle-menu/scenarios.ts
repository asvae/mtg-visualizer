// Real engine-piloted trace (see engine-trace.ts's own header) — a plain
// modal instant, one real scenario per mode (same multi-TraceResult
// convention Aerith Rescue Mission already established for a modal card).

import { battleMenu } from './definition';
import { basicLandsFor } from '../../mana';
import type { TraceResult } from '../../harness';
import { setupEnginePilot, pilotActions, pilotCast, pilotResolveTop, finishEnginePilotTrace, type EnginePilotSetup } from '../../engine-trace';

function attackMode(): TraceResult {
  const setup: EnginePilotSetup = { you: { basicLands: basicLandsFor('{1}{W}') } };
  const pilot = setupEnginePilot(setup);
  const cardReal = pilot.state.addCard(pilot.you, 'Hand', { name: battleMenu.name, types: [] });
  const actions = pilotActions(pilot, cardReal.id);
  const ctx = pilot.ctxFor(cardReal, { mode: 0 });
  pilotCast(pilot, cardReal, battleMenu, ctx, actions);
  pilotResolveTop(pilot);
  const result = 'Attack — creates a 2/2 white Knight creature token.';
  return finishEnginePilotTrace(pilot, setup, 'engine playthrough: cast -> mode 0 (Attack)', result);
}

function abilityMode(): TraceResult {
  const setup: EnginePilotSetup = { you: { basicLands: basicLandsFor('{1}{W}') }, opponents: [{ tokens: ['w_1_1_cat'] }] };
  const pilot = setupEnginePilot(setup);
  const cardReal = pilot.state.addCard(pilot.you, 'Hand', { name: battleMenu.name, types: [] });
  const actions = pilotActions(pilot, cardReal.id);
  const ctx = pilot.ctxFor(cardReal, { mode: 1 });
  pilotCast(pilot, cardReal, battleMenu, ctx, actions);
  pilotResolveTop(pilot);
  const result = 'Ability — a target creature gets +0/+4 until end of turn.';
  return finishEnginePilotTrace(pilot, setup, 'engine playthrough: cast -> mode 1 (Ability)', result);
}

function magicMode(): TraceResult {
  const setup: EnginePilotSetup = { you: { basicLands: basicLandsFor('{1}{W}') }, opponents: [{}] };
  const pilot = setupEnginePilot(setup);
  const cardReal = pilot.state.addCard(pilot.you, 'Hand', { name: battleMenu.name, types: [] });
  // A real power>=4 target — no `tokens`/count field produces one, so it's
  // added directly. Coliseum Behemoth (data/fin/fin_scryfall.json: {5}{G}{G}
  // Creature — Beast, 7/7) — its own ETB "choose one" trigger is inert here
  // (placed directly via addCard, never cast, so it isn't wired to any
  // CardDefinition the engine would fire); only its printed 7/7 (well over
  // the mode's power>=4 threshold) matters.
  const bigCreature = pilot.state.addCard(pilot.opponents[0]!, 'Battlefield', { name: 'Coliseum Behemoth', types: ['Creature'], subtypes: ['Beast'], basePower: 7, baseToughness: 7 });
  // A real `enters` entry — without one, it only ever appears in the replay
  // the instant `destroy` (below) first names it, straight in the
  // Graveyard, as if it had never actually been on the battlefield at all.
  pilot.log.push({
    fn: 'enters',
    card: bigCreature.name,
    zone: 'Battlefield',
    power: bigCreature.basePower,
    toughness: bigCreature.baseToughness,
    controller: pilot.opponents[0]!.name,
  });
  const actions = pilotActions(pilot, cardReal.id);
  const ctx = pilot.ctxFor(cardReal, { mode: 2 });
  pilotCast(pilot, cardReal, battleMenu, ctx, actions);
  pilotResolveTop(pilot);
  const result = `Magic — destroys ${bigCreature.name}, a creature with power 4 or greater.`;
  return finishEnginePilotTrace(pilot, setup, 'engine playthrough: cast -> mode 2 (Magic)', result);
}

function itemMode(): TraceResult {
  const setup: EnginePilotSetup = { you: { basicLands: basicLandsFor('{1}{W}') } };
  const pilot = setupEnginePilot(setup);
  const cardReal = pilot.state.addCard(pilot.you, 'Hand', { name: battleMenu.name, types: [] });
  const actions = pilotActions(pilot, cardReal.id);
  const ctx = pilot.ctxFor(cardReal, { mode: 3 });
  pilotCast(pilot, cardReal, battleMenu, ctx, actions);
  pilotResolveTop(pilot);
  const result = 'Item — you gain 4 life.';
  return finishEnginePilotTrace(pilot, setup, 'engine playthrough: cast -> mode 3 (Item)', result);
}

export function runEngineScenarios(): TraceResult[] {
  return [attackMode(), abilityMode(), magicMode(), itemMode()];
}
