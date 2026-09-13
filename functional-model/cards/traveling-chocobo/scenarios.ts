// Real engine-piloted trace (see engine-trace.ts's own header) — REPLACES
// the earlier "no resolvable effect" placeholder scenario now that a real
// demonstration is possible: Traveling Chocobo's own "If a land or Bird you
// control entering the battlefield causes a triggered ability of a
// permanent you control to trigger, that ability triggers an additional
// time" (ENGINE_GAPS.md gap #13, closed 2026-09-12: `card.ts`'s
// `triggerDoubling`, `triggers.ts`'s shared `fireTrigger`, `state.ts`'s
// `shouldDoubleTrigger`) is now real machinery, gated on `causedBy:
// 'entersBattlefield'` with `entersMatch: [{isLand:true},{subtype:'Bird'}]`
// — applying to ANY permanent the controller owns, not just Chocobo's own
// (Chocobo itself has no named trigger at all).
//
// Reuses Ambrosia Whiteheart (`cards/ambrosia-whiteheart/definition.ts`), a
// real FIN card already modeled with a real Landfall trigger (`onLandfall`
// — "gets +1/+0"), and the SAME real "a land entering has no auto-detection
// in this engine; add it directly to the battlefield, then fire the
// reactive trigger manually" pattern Ambrosia Whiteheart's OWN scenario
// already establishes for this exact real gap (no card reacting to ANOTHER
// permanent's own ETB has any auto-dispatch anywhere in this engine) — this
// scenario additionally passes a real `{kind:'entersBattlefield', entered}`
// cause to `pilotFireTrigger` so Chocobo's own gate is genuinely checked
// against the REAL entering object's own type/subtypes, not just presence.
//
// The other two real abilities ("You may look at the top card of your
// library any time"/"You may play lands and cast Bird spells from the top
// of your library") stay `staticAbilities` text — no representable
// mechanism for the former (a pure information-visibility rule), and the
// latter needs Traveling Chocobo's own new-permission version of "play the
// top card of your library" (ENGINE_GAPS.md gap #16's own citation of this
// exact card as a candidate reuse of `playFromLibraryTop`, not built here —
// out of scope for THIS gap's own closure).

import { travelingChocobo } from './definition';
import { ambrosiaWhiteheart } from '../ambrosia-whiteheart/definition';
import { basicLandsFor } from '../../mana';
import type { TraceResult } from '../../harness';
import { setupEnginePilot, pilotActions, pilotCast, pilotResolveTop, advanceToPlayersNextMain1, pilotFireTrigger, finishEnginePilotTrace, type EnginePilotSetup } from '../../engine-trace';

export function runEngineScenarios(): TraceResult[] {
  const setup: EnginePilotSetup = {
    // {2}{G} (Traveling Chocobo) + {1}{W} (Ambrosia Whiteheart) = 5
    // generic-equivalent mana total, plus the real {G}/{W} pips — one pool
    // suffices across the single turn both are cast in.
    you: { basicLands: basicLandsFor('{2}{G}{1}{W}'), libraryCount: 8 },
    opponents: [{ libraryCount: 8 }],
  };
  const pilot = setupEnginePilot(setup);

  const chocoboReal = pilot.state.addCard(pilot.you, 'Hand', {
    name: travelingChocobo.name,
    types: ['Creature'],
    subtypes: ['Bird'],
    basePower: travelingChocobo.pt?.[0],
    baseToughness: travelingChocobo.pt?.[1],
  });
  const chocoboActions = pilotActions(pilot, chocoboReal.id);
  const chocoboCtx = pilot.ctxFor(chocoboReal);
  pilotCast(pilot, chocoboReal, travelingChocobo, chocoboCtx, chocoboActions);
  pilotResolveTop(pilot);

  const ambrosiaReal = pilot.state.addCard(pilot.you, 'Hand', {
    name: ambrosiaWhiteheart.name,
    types: ['Creature'],
    subtypes: ['Bird', 'Legendary'],
    keywords: ambrosiaWhiteheart.keywords,
    basePower: 2,
    baseToughness: 2,
  });
  const ambrosiaActions = pilotActions(pilot, ambrosiaReal.id);
  const ambrosiaCtx = pilot.ctxFor(ambrosiaReal);
  pilotCast(pilot, ambrosiaReal, ambrosiaWhiteheart, ambrosiaCtx, ambrosiaActions);
  // Resolves; real 603.6b ETB auto-fires — real text is "another permanent
  // you control" (no artifact/Treasure restriction). Real, genuinely
  // UNPLANNED (found running this scenario, not designed in) consequence,
  // kept rather than avoided since it's textually correct: Ambrosia
  // Whiteheart is HERSELF a Bird, so HER OWN entering is a real cause
  // Traveling Chocobo's own `entersMatch` gate recognizes — her own ETB
  // trigger is a real triggered ability of a permanent (herself) its
  // controller controls, caused by a Bird (herself) entering, so it
  // genuinely doubles too (`engine.ts`'s own `resolveTop`, which fires an
  // `on:'enter'` trigger via the SAME shared `fireTrigger`, passes
  // `{kind:'entersBattlefield', entered: <the resolving permanent itself>}`
  // for exactly this reason — a real card CAN cause its own trigger to
  // double this way, and this is the first real trace in the pool showing
  // it). The real candidate pool for the bounce itself is Traveling Chocobo
  // PLUS every basic land already on the battlefield (`setupEnginePilot`'s
  // own setup, seeded before either creature was cast) — `chooseTarget`'s
  // own deterministic first-candidate pick lands on a basic land each time
  // (same real behavior ambrosia-whiteheart's own standalone scenario
  // already documents: "bounces one of your own real Plains"), never
  // Traveling Chocobo, since the lands were added to the battlefield array
  // first — so this doubled ETB bounces TWO real lands, not one.
  pilotResolveTop(pilot);

  // Real turn passage — summoning sickness clears (unneeded by either
  // creature's own triggers here, but keeps this scenario's own board in a
  // genuine, settled state before the Landfall demonstration).
  advanceToPlayersNextMain1(pilot, pilot.you);

  // A real land entering (no land-drop action needed for this
  // demonstration — added straight to the battlefield, same real "the only
  // way to model one entering without a dedicated land-drop pilot helper"
  // convention ambrosia-whiteheart's own scenario already establishes).
  pilot.beginStep('A land entering');
  const forest = pilot.state.addCard(pilot.you, 'Battlefield', { name: 'Forest', types: ['Land'], subtypes: ['Forest'] });
  pilot.log.push({ fn: 'enters', card: forest.name, zone: 'Battlefield', controller: pilot.you.name });

  // Landfall fired manually (no "another permanent entered" auto-detection
  // in this engine) — passing the real entering land as `cause.entered` so
  // Traveling Chocobo's own `entersMatch` gate is genuinely checked against
  // it, not just its presence. Because Traveling Chocobo is genuinely on
  // the battlefield and the entering permanent really is a land, this fires
  // TWICE: Ambrosia Whiteheart gets +1/+0 twice (net +2/+0 this turn).
  pilotFireTrigger(pilot, ambrosiaWhiteheart, ambrosiaCtx, ambrosiaActions, 'onLandfall', "Ambrosia Whiteheart's own Landfall trigger fires — doubled by Traveling Chocobo's own static", {
    kind: 'entersBattlefield',
    entered: forest,
  });

  const result =
    'Traveling Chocobo and Ambrosia Whiteheart both resolve. Ambrosia Whiteheart is herself a Bird, so her own entering is ALSO a cause Traveling Chocobo\'s own static recognizes — her own ETB (bounce "another permanent you control") doubles too, bouncing TWO of your own basic lands, not one. A land later enters the battlefield under your control, triggering Landfall on Ambrosia Whiteheart — and, because a LAND entering caused it while Traveling Chocobo is on the battlefield, Chocobo\'s own "triggers an additional time" static (ENGINE_GAPS.md gap #13) doubles it too: Ambrosia Whiteheart gets +1/+0 TWICE.';
  return [
    finishEnginePilotTrace(
      pilot,
      setup,
      "engine playthrough: cast Traveling Chocobo + Ambrosia Whiteheart (a Bird, whose own ETB also doubles) -> a land enters -> Ambrosia's own Landfall trigger fires TWICE (Traveling Chocobo's own doubling static)",
      result
    ),
  ];
}
