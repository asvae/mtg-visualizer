// Real engine-piloted trace (see engine-trace.ts's own header). The
// "attacking creatures get +2/+0" effect is an intentional no-op (see
// definition.ts's own comment — no combat-attacker-state tracked in this
// model), so real coverage here is just the cast+resolve itself. Flashback
// (`alternateCosts`) can't be demonstrated: `canCastSpell`/`castSpell` have
// no alternate-cost/cast-from-graveyard legality path at all yet
// (ENGINE_GAPS.md gap #7, confirmed open) — left undemonstrated rather than faked.

import { auronSInspiration } from './definition';
import { basicLandsFor } from '../../mana';
import type { TraceResult } from '../../harness';
import { setupEnginePilot, pilotActions, pilotCast, pilotResolveTop, finishEnginePilotTrace, type EnginePilotSetup } from '../../engine-trace';

export function runEngineScenarios(): TraceResult[] {
  const setup: EnginePilotSetup = { you: { basicLands: basicLandsFor('{2}{W}') } };
  const pilot = setupEnginePilot(setup);
  const cardReal = pilot.state.addCard(pilot.you, 'Hand', { name: auronSInspiration.name, types: [] });
  const actions = pilotActions(pilot, cardReal.id);
  const ctx = pilot.ctxFor(cardReal);

  // Cast ({2}{W}), real mana payment
  pilotCast(pilot, cardReal, auronSInspiration, ctx, actions);
  // Resolves — its own effect is an intentional no-op (see definition.ts)
  pilotResolveTop(pilot);

  const result =
    "Auron's Inspiration is cast and resolves for real ({2}{W} paid); its own +2/+0-to-attackers effect is an intentional no-op in this model (no attacking-creature state tracked). Flashback ({2}{W}{W} from the graveyard) isn't demonstrated — this engine has no alternate-cost/cast-from-graveyard legality path at all yet (ENGINE_GAPS.md gap #7).";
  return [finishEnginePilotTrace(pilot, setup, 'real engine playthrough: cast -> resolve (no-op combat effect)', result)];
}
