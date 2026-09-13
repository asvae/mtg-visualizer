// Real engine-piloted trace (see engine-trace.ts's own header). Keyword
// coverage suite — Prompto Argentum's real printed Haste, cast for real and
// attacked THE SAME TURN (no turn passage at all), proving Haste really
// bypasses the engine's own real 302.6 summoning-sickness check
// (`engine.ts`'s `canAttack`) rather than a scenario merely skipping the
// wait.

import { promptoArgentum } from '../../cards/prompto-argentum/definition';
import { basicLandsFor } from '../../mana';
import type { TraceResult } from '../../harness';
import { setupEnginePilot, pilotActions, pilotCast, pilotResolveTop, advanceToDeclareAttackersStep, pilotDeclareAttackers, finishEnginePilotTrace, type EnginePilotSetup } from '../../engine-trace';

export function runEngineScenarios(): TraceResult[] {
  const setup: EnginePilotSetup = { you: { basicLands: basicLandsFor('{1}{R}'), libraryCount: 5 }, opponents: [{ libraryCount: 5 }] };
  const pilot = setupEnginePilot(setup);

  const promptoReal = pilot.state.addCard(pilot.you, 'Hand', {
    name: promptoArgentum.name,
    types: ['Creature'],
    subtypes: ['Human', 'Scout', 'Legendary'],
    keywords: promptoArgentum.keywords,
    basePower: promptoArgentum.pt?.[0],
    baseToughness: promptoArgentum.pt?.[1],
  });
  const actions = pilotActions(pilot, promptoReal.id);
  const ctx = pilot.ctxFor(promptoReal);

  pilotCast(pilot, promptoReal, promptoArgentum, ctx, actions);
  pilotResolveTop(pilot);

  // NO advanceToPlayersNextMain1 here — this is deliberately the SAME turn
  // Prompto entered. Without Haste, `canAttack`'s own real 302.6 check
  // would reject this (still summoning-sick); pilotDeclareAttackers throws
  // on any illegal batch, so this call succeeding at all is itself the proof.
  advanceToDeclareAttackersStep(pilot);
  pilotDeclareAttackers(pilot, [promptoReal], `Declare ${promptoArgentum.name} as attacker (same turn it entered)`);

  const result = `302.6: Prompto is declared as an attacker the SAME turn it entered the battlefield — ordinarily illegal (summoning sickness), and \`pilotDeclareAttackers\` throws on any illegal declaration — but its printed Haste exempts it in the engine's own \`canAttack\` check, so the declaration succeeds.`;
  return [finishEnginePilotTrace(pilot, setup, 'engine playthrough: cast -> same-turn attack declaration succeeds via Haste', result)];
}
