// Real engine-piloted trace (see engine-trace.ts's own header). Scorpion
// Sentinel has no triggers/resolvable effects of its own to pilot — its only
// real text beyond the printed body is a conditional layer-7a CDA ("As long
// as you control seven or more lands, this creature gets +3/+0"), now real
// via `card.ts`'s `ptFormula.kind:'thresholdBonus'` (closed 2026-09-15,
// fin/16-25 pass — see that field's own doc comment for the real Forge
// citation). This trace demonstrates BOTH halves for real: (1) the
// condition (7 real land permanents you control) via a genuine logged
// `getLandsInPlay()` aggregate read; (2) `effectivePT` — the same real,
// live layer-7a read Adelbert Steiner's own scenario uses — now genuinely
// recalculates to Scorpion Sentinel's printed 4/4 (1/4 base +3/+0) once the
// threshold is met, a real engine-computed value, not text-only anymore.

import { scorpionSentinel } from './definition';
import { effectivePT } from '../../state';
import { loggingPlayer } from '../../harness';
import type { TraceResult } from '../../harness';
import { setupEnginePilot, pilotActions, pilotCast, pilotResolveTop, finishEnginePilotTrace, type EnginePilotSetup } from '../../engine-trace';

export function runEngineScenarios(): TraceResult[] {
  const setup: EnginePilotSetup = {
    // 7 real basic lands — enough to both pay Scorpion Sentinel's own
    // {1}{U} cost AND meet the printed "seven or more lands" threshold with
    // no extra filler permanents needed (a controlled land counts toward
    // the threshold whether or not it's tapped for mana).
    you: { basicLands: ['Island', 'Plains', 'Plains', 'Plains', 'Plains', 'Plains', 'Plains'], libraryCount: 5 },
    opponents: [{ libraryCount: 5 }],
  };
  const pilot = setupEnginePilot(setup);

  pilot.beginStep('Condition check — 7 lands already on the battlefield (meets the printed threshold)');
  const landsCount = loggingPlayer(pilot.state, pilot.you, pilot.log).getLandsInPlay().length;

  const scorpionSentinelReal = pilot.state.addCard(pilot.you, 'Hand', {
    name: scorpionSentinel.name,
    types: ['Artifact', 'Creature'],
    subtypes: ['Robot', 'Scorpion'],
    basePower: scorpionSentinel.pt?.[0],
    baseToughness: scorpionSentinel.pt?.[1],
    // `pilot.state.addCard` is a raw manual `RealCard` build (unlike
    // `harness.ts`'s own generic `runScenario`, which copies
    // `effectiveCard.ptFormula` automatically) — `ptFormula` must be
    // threaded through explicitly or the real layer-7a CDA never applies
    // (a real bug caught 2026-09-15, same class as gaelicat's own scenario
    // hitting it first).
    ptFormula: scorpionSentinel.ptFormula,
  });
  const actions = pilotActions(pilot, scorpionSentinelReal.id);
  const ctx = pilot.ctxFor(scorpionSentinelReal);

  // Cast Scorpion Sentinel ({1}{U}), real mana payment
  pilotCast(pilot, scorpionSentinelReal, scorpionSentinel, ctx, actions);
  pilotResolveTop(pilot);

  // Real layer-7a read — same live `effectivePT` Adelbert Steiner's own
  // scenario uses. Now genuinely recalculates to 4/4 (printed 1/4 +3/+0)
  // once the threshold is met — a real, live engine computation, not
  // text-only.
  pilot.beginStep('Layer-7a read — threshold-CDA machinery now applies the +3/+0');
  const [power, toughness] = effectivePT(pilot.state, scorpionSentinelReal);
  pilot.log.push({ fn: 'read:getNetPower', card: scorpionSentinel.name, power, toughness });

  const result = `Scorpion Sentinel enters with ${landsCount} lands already on the battlefield, meeting the printed "seven or more lands" threshold — layer-7a effectivePT genuinely recalculates to ${power}/${toughness} (printed 1/4 +3/+0), real threshold-CDA machinery now in place (closed 2026-09-15, same mechanism as gaelicat/magitek-infantry's own identically-shaped artifact-count buffs).`;
  return [finishEnginePilotTrace(pilot, setup, 'engine playthrough: 7 lands present -> cast -> real threshold-CDA pump applies', result)];
}
