// Real engine-piloted trace (see engine-trace.ts's own header). The
// "attacking creatures get +2/+0" effect is an intentional no-op (see
// definition.ts's own comment — no combat-attacker-state tracked in this
// model), so real coverage of the main cast is just the cast+resolve
// itself. Flashback IS demonstrated (2026-09-11) — `canCastSpell`/
// `castSpell`/`pilotCast` gained a real, narrow alternate-cost path
// (ENGINE_GAPS.md gap #7, narrowed) for exactly this shape: a fixed
// replacement mana cost, paid from the graveyard, `thenExile` on
// resolution.

import { auronSInspiration } from './definition';
import { basicLandsFor } from '../../mana';
import type { TraceResult } from '../../harness';
import { setupEnginePilot, pilotActions, pilotCast, pilotResolveTop, finishEnginePilotTrace, type EnginePilotSetup } from '../../engine-trace';

function normalCast(): TraceResult {
  const setup: EnginePilotSetup = { you: { basicLands: basicLandsFor('{2}{W}') } };
  const pilot = setupEnginePilot(setup);
  const cardReal = pilot.state.addCard(pilot.you, 'Hand', { name: auronSInspiration.name, types: [] });
  const actions = pilotActions(pilot, cardReal.id);
  const ctx = pilot.ctxFor(cardReal);

  // Cast ({2}{W}), real mana payment
  pilotCast(pilot, cardReal, auronSInspiration, ctx, actions);
  // Resolves — its own effect is an intentional no-op (see definition.ts) —
  // then goes to the graveyard (no alternate cost paid, so no thenExile).
  pilotResolveTop(pilot);

  const result =
    "Auron's Inspiration is cast from hand and resolves ({2}{W} paid), then goes to the graveyard; its own +2/+0-to-attackers effect is an intentional no-op in this model (no attacking-creature state tracked).";
  return finishEnginePilotTrace(pilot, setup, 'engine playthrough: cast from hand -> resolve -> graveyard', result);
}

function flashbackCast(): TraceResult {
  const flashback = auronSInspiration.alternateCosts!.find((c) => c.name === 'Flashback')!;
  const setup: EnginePilotSetup = { you: { basicLands: basicLandsFor(flashback.cost) } };
  const pilot = setupEnginePilot(setup);
  // Starts in the graveyard, not hand — a real prior discard/mill/whatever
  // put it there; this scenario is about the flashback cast itself, not how
  // it got to the graveyard.
  const cardReal = pilot.state.addCard(pilot.you, 'Graveyard', { name: auronSInspiration.name, types: [] });
  const actions = pilotActions(pilot, cardReal.id);
  const ctx = pilot.ctxFor(cardReal);

  // Cast via Flashback ({2}{W}{W} from the graveyard), real mana payment
  pilotCast(pilot, cardReal, auronSInspiration, ctx, actions, undefined, flashback);
  // Resolves — its own effect is an intentional no-op (see definition.ts) —
  // then exiled instead of returning to the graveyard (thenExile, CR 702.32).
  pilotResolveTop(pilot);

  const result =
    "Auron's Inspiration is cast from the graveyard via Flashback ({2}{W}{W} paid instead of {2}{W}) and resolves, then is exiled instead of returning to the graveyard (its own \"Then exile it\" clause); its own +2/+0-to-attackers effect is again an intentional no-op in this model.";
  return finishEnginePilotTrace(pilot, setup, 'engine playthrough: Flashback cast from graveyard -> resolve -> exile', result);
}

export function runEngineScenarios(): TraceResult[] {
  return [normalCast(), flashbackCast()];
}
