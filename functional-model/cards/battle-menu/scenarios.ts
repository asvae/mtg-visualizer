// Real engine-piloted trace (see engine-trace.ts's own header) — a plain
// modal instant, one real scenario per mode (same multi-TraceResult
// convention Aerith Rescue Mission already established for a modal card).

import { battleMenu } from './definition';
import { basicLandsFor } from '../../mana';
import { currentPhase } from '../../turn';
import { effectivePT } from '../../state';
import type { TraceResult } from '../../harness';
import { setupEnginePilot, pilotActions, pilotCast, pilotResolveTop, advanceOneStep, finishEnginePilotTrace, type EnginePilotSetup } from '../../engine-trace';

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
  // 2026-09-14, ENGINE_GAPS.md — `state.pump`'s own real `untilEndOfTurn`
  // expiry: this mode's own real "target creature gets +0/+4 UNTIL END OF
  // TURN" used to be a permanent `layers.add` entry with no expiry at all.
  // The scenario now genuinely crosses a real Cleanup and reads the real
  // target's own effective power/toughness both BEFORE and AFTER, proving
  // the pump actually disappears rather than just applying.
  const setup: EnginePilotSetup = { you: { basicLands: basicLandsFor('{1}{W}') }, opponents: [{ tokens: ['w_1_1_cat'] }] };
  const pilot = setupEnginePilot(setup);
  const cardReal = pilot.state.addCard(pilot.you, 'Hand', { name: battleMenu.name, types: [] });
  const actions = pilotActions(pilot, cardReal.id);
  const ctx = pilot.ctxFor(cardReal, { mode: 1 });
  pilotCast(pilot, cardReal, battleMenu, ctx, actions);
  pilotResolveTop(pilot);

  // The real Cat token (`TOKENS.w_1_1_cat`'s own printed name) — the only
  // legal target on the board, resolved by `pumpTarget`'s own `chooseTarget`.
  const cat = pilot.opponents[0]!.battlefield.find((c) => c.name === 'Cat')!;
  const [pumpedPower, pumpedToughness] = effectivePT(pilot.state, cat);
  pilot.log.push({ fn: 'read:getNetPower', target: cat.name, id: cat.id, power: pumpedPower, toughness: pumpedToughness });

  // Real 514.2 Cleanup — genuinely crosses the rest of THIS turn.
  while (currentPhase(pilot.engine.turn) !== 'Cleanup') advanceOneStep(pilot);

  const [expiredPower, expiredToughness] = effectivePT(pilot.state, cat);
  pilot.log.push({ fn: 'read:getNetPower', target: cat.name, id: cat.id, power: expiredPower, toughness: expiredToughness });

  const result =
    'Ability — a target creature gets +0/+4 UNTIL END OF TURN (the real Cat token becomes 1/5) — the scenario then crosses a real Cleanup (514.2) and the Cat is genuinely back to its base 1/1, the pump having really expired, not just applied.';
  return finishEnginePilotTrace(pilot, setup, 'engine playthrough: cast -> mode 1 (Ability) -> Cleanup (pump expires)', result);
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
