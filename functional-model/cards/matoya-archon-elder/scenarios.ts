// Real engine-piloted trace (see engine-trace.ts's own header) — REPLACES
// the earlier bare `{trigger:'onScry'}`/`{trigger:'onSurveil'}` flat
// scenarios. Real oracle: "Whenever you scry or surveil, draw a card. (Draw
// after you scry or surveil.)" — Forge's own real script (checked against
// the card's own Mode$ Scry/Mode$ Surveil pair, same shape this card's own
// `definition.ts` comment already documents) models this as TWO separate
// triggered abilities that both run the same TrigDraw, not one trigger with
// an OR condition — matched here with two separate `onScry`/`onSurveil`
// triggers on `definition.ts`, same as that file already had.
//
// Only the SURVEIL half gets real, in-engine evidence in this scenario:
// `actions.surveil` is a fully-wired real engine action (`card.ts`'s own
// `kind:'surveil'` Effect, e.g. Dreams of Laguna/fin-50's own "Surveil 1,
// then draw a card"), but `scry` has NO real implementation anywhere in
// this engine at all — `interfaces.ts`'s own `declare function scry(...)`
// is a bare Forge-signature mirror with zero wiring into `card.ts`'s real
// `Actions` type/`state.ts` (checked directly: no `Effect` kind, no
// `actions.scry`/`state.scry` call anywhere in the pool) — a real,
// documented engine gap distinct from surveil, not a modeling oversight.
// So there is no possible in-scenario action that could produce real trace
// evidence for the `onScry` half; `verify-synergy.mjs`'s own
// `isMatoyaScryBroadcastWant` exemption documents and tolerates this,
// mirroring `isAuronsInspirationBroadcastPumpFact`'s own "real fact, real
// documented gap, zero achievable evidence" treatment.
//
// The surveil action is called directly here as a generic effect (not
// wrapped in another real card's own cast) — Matoya's own want is "an
// incoming surveil event from ANY source," and per this session's own "1
// scenario, real basic function" rule a self-contained demonstration of
// Matoya's own trigger firing off a real `actions.surveil` call is enough;
// no cross-card synergy (e.g. also casting Dreams of Laguna) is required in
// the scenario itself.

import { matoyaArchonElder } from './definition';
import { basicLandsFor } from '../../mana';
import type { TraceResult } from '../../harness';
import { setupEnginePilot, pilotActions, pilotCast, pilotResolveTop, pilotFireTrigger, finishEnginePilotTrace, type EnginePilotSetup } from '../../engine-trace';

export function runEngineScenarios(): TraceResult[] {
  const setup: EnginePilotSetup = {
    you: { basicLands: basicLandsFor('{2}{U}'), libraryCount: 8 },
    opponents: [{ libraryCount: 8 }],
  };
  const pilot = setupEnginePilot(setup);

  const matoyaReal = pilot.state.addCard(pilot.you, 'Hand', {
    name: matoyaArchonElder.name,
    types: ['Creature'],
    subtypes: ['Human', 'Warlock'],
    basePower: matoyaArchonElder.pt?.[0],
    baseToughness: matoyaArchonElder.pt?.[1],
  });
  const actions = pilotActions(pilot, matoyaReal.id);
  const ctx = pilot.ctxFor(matoyaReal);

  // Cast Matoya, Archon Elder ({2}{U}), real mana payment
  pilotCast(pilot, matoyaReal, matoyaArchonElder, ctx, actions);
  pilotResolveTop(pilot);

  // A real surveil (generic — no other card's own effect needed to cause
  // it; Matoya's own want cares only that a real surveil happened, not who
  // caused it). `actions.surveil` is real, wired engine machinery
  // (`state.ts`, exercised for real by Dreams of Laguna/fin-50 elsewhere in
  // this pool) — this call genuinely runs it, not a bare log fabrication.
  pilot.beginStep('Surveil 1 (the surveil effect resolves)');
  actions.surveil(ctx.you, 1);

  // Matoya's own real trigger — fired manually once the real surveil has
  // already happened, same "no auto-fire" pattern every named trigger in
  // this engine already uses (onDies-class triggers, onLifeGained, etc.).
  pilotFireTrigger(pilot, matoyaArchonElder, ctx, actions, 'onSurveil');

  const result =
    'Matoya, Archon Elder is cast and enters the battlefield; a surveil 1 resolves, then her own "Whenever you scry or surveil, draw a card" trigger fires, drawing a card.';
  return [finishEnginePilotTrace(pilot, setup, 'engine playthrough: cast -> surveil -> onSurveil draws a card', result)];
}
