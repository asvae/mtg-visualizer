// Real engine-piloted trace (see engine-trace.ts's own header) — replaces
// the old flat harness.ts shape. Real script (travel_the_overworld.txt):
// Forge's own `K:Affinity:Town` keyword, "This spell costs {1} less to cast
// for each Town you control." / "Draw four cards." The per-Town cast-cost
// discount is now REAL, structured engine vocabulary (`card.ts`'s
// `CostReduction.perControlled`, ENGINE_GAPS.md gap #7's cast-side
// remainder, closed 2026-09-12 — the same real board-count mechanism
// Qiqirn Merchant's own `ActivationCostReduction` already models on the
// ACTIVATION side, generalized here to a spell's own cast cost) —
// `engine.ts`'s `effectiveCastCost` genuinely counts real Town-subtype
// permanents the caster controls and discounts the {5} generic portion
// accordingly, replacing the old documentary-only `staticAbilities` string.
//
// This scenario's own board controls 2 real Town lands (Capital City,
// Gongaga, Reactor Town — both real FIN `Land — Town` cards, not invented
// placeholders, the same pair Qiqirn Merchant's own scenario already uses
// for the identical discount shape) so the logged `cast` cost genuinely
// reads {3}{U}{U} (5 minus 2), not the raw printed {5}{U}{U} — a real,
// board-state-computed discount, not a scripted number. `basicLands` below
// provisions the FULL, undiscounted {5}{U}{U} worth of real Islands/basics
// (same "prove the discount reduced what was owed, not that there merely
// happened to be less mana available" technique fate-of-the-sun-cryst's own
// scenarios already establish) — the log's own `tappedForMana` count is
// what proves only the discounted amount was actually paid.

import { travelTheOverworld } from './definition';
import { basicLandsFor } from '../../mana';
import type { TraceResult } from '../../harness';
import { setupEnginePilot, pilotActions, pilotCast, pilotResolveTop, finishEnginePilotTrace, type EnginePilotSetup } from '../../engine-trace';

export function runEngineScenarios(): TraceResult[] {
  // Enough real library cards for the 4 real draws this spell's own effect
  // performs.
  const setup: EnginePilotSetup = { you: { basicLands: basicLandsFor('{5}{U}{U}'), libraryCount: 4 } };
  const pilot = setupEnginePilot(setup);

  // 2 real Town lands (ENGINE_GAPS.md gap #7's cast-side closure) — real FIN
  // `Land — Town` cards (Capital City, Gongaga, Reactor Town; both enter
  // untapped, neither has an ETB trigger, so neither needs a matching
  // enters-trigger dance), not invented placeholders — so this scenario's
  // own logged `cast` cost below is a REAL, board-state-computed discount
  // ({5} minus {1} per Town = {3}), not the raw printed string.
  const town1 = pilot.state.addCard(pilot.you, 'Battlefield', { name: 'Capital City', types: ['Land'], subtypes: ['Town'] });
  pilot.log.push({ fn: 'enters', card: town1.name, zone: 'Battlefield', controller: pilot.you.name });
  const town2 = pilot.state.addCard(pilot.you, 'Battlefield', { name: 'Gongaga, Reactor Town', types: ['Land'], subtypes: ['Town'] });
  pilot.log.push({ fn: 'enters', card: town2.name, zone: 'Battlefield', controller: pilot.you.name });

  const cardReal = pilot.state.addCard(pilot.you, 'Hand', { name: travelTheOverworld.name, types: [] });
  const actions = pilotActions(pilot, cardReal.id);
  const ctx = pilot.ctxFor(cardReal);

  // Cast from hand — `effectiveCastCost` (via `pilotCast`) genuinely
  // discounts the printed {5}{U}{U} down to {3}{U}{U} for real, counting
  // the 2 real Towns above; only 5 lands (3 generic + 2 Islands) are
  // actually tapped for mana, not the full 7 the printed cost would need.
  pilotCast(pilot, cardReal, travelTheOverworld, ctx, actions);
  // Resolves — real drawCard(4): draws 4 real cards from the library.
  pilotResolveTop(pilot);

  const result =
    'Travel the Overworld is cast from hand while controlling 2 Town lands (Capital City, Gongaga, Reactor Town) — Affinity for Towns discounts the printed {5}{U}{U} down to {3}{U}{U} (`card.ts`\'s `CostReduction.perControlled`, ENGINE_GAPS.md gap #7): the `cast` log entry\'s own `cost` field reads {3}{U}{U}, and only 5 lands are tapped for mana (`tapForMana`), not the full printed {5}{U}{U}/7 lands. It then resolves, drawing 4 cards.';
  return [finishEnginePilotTrace(pilot, setup, 'engine playthrough: cast ({2} discount from 2 Towns) -> resolve (draw four cards)', result)];
}
