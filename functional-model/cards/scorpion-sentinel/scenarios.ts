// Real engine-piloted trace (see engine-trace.ts's own header). Scorpion
// Sentinel has no triggers/resolvable effects of its own to pilot — its only
// real text beyond the printed body is a conditional layer-7a CDA ("As long
// as you control seven or more lands, this creature gets +3/+0"). This is a
// THRESHOLD-gated shape this engine has no `ptFormula` variant for (see
// definition.ts's own comment, and `card.ts`'s `CardDefinition.ptFormula`
// doc comment) — same real, documented gap as Gaelicat's own "two or more
// artifacts" and Magitek Infantry's own "another artifact" buffs (see
// isScorpionSentinelLandThresholdPumpFact, scripts/verify-synergy.mjs). This
// trace deliberately demonstrates BOTH halves honestly: (1) the condition
// itself (7 real land permanents you control) is real, observable board
// state, via a genuine logged `getLandsInPlay()` aggregate read; (2)
// `effectivePT` — the same real, live layer-7a read Adelbert Steiner's own
// scenario uses — stays at Scorpion Sentinel's unmodified printed 1/4 even
// with the threshold met, which is the honest, documented engine gap, not a
// fabricated bonus.

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

  pilot.beginStep('Real condition check — 7 real lands already on the battlefield (meets the printed threshold)');
  const landsCount = loggingPlayer(pilot.state, pilot.you, pilot.log).getLandsInPlay().length;

  const scorpionSentinelReal = pilot.state.addCard(pilot.you, 'Hand', {
    name: scorpionSentinel.name,
    types: ['Artifact', 'Creature'],
    subtypes: ['Robot', 'Scorpion'],
    basePower: scorpionSentinel.pt?.[0],
    baseToughness: scorpionSentinel.pt?.[1],
  });
  const actions = pilotActions(pilot, scorpionSentinelReal.id);
  const ctx = pilot.ctxFor(scorpionSentinelReal);

  // Cast Scorpion Sentinel ({1}{U}), real mana payment
  pilotCast(pilot, scorpionSentinelReal, scorpionSentinel, ctx, actions);
  pilotResolveTop(pilot);

  // Real layer-7a read — same live `effectivePT` Adelbert Steiner's own
  // scenario uses. Honestly reports Scorpion Sentinel's UNMODIFIED printed
  // 1/4: this engine has no threshold-gated `ptFormula` variant, so the
  // printed "+3/+0" never actually applies here — a real, documented gap,
  // not fabricated evidence of a bonus that doesn't happen.
  pilot.beginStep('Real layer-7a read — no threshold-CDA machinery, so the +3/+0 does not apply');
  const [power, toughness] = effectivePT(pilot.state, scorpionSentinelReal);
  pilot.log.push({ fn: 'read:getNetPower', card: scorpionSentinel.name, power, toughness });

  const result = `Scorpion Sentinel enters with ${landsCount} real lands already on the battlefield, meeting the printed "seven or more lands" threshold — but layer-7a effectivePT still reports Scorpion Sentinel's unmodified printed ${power}/${toughness}, since this engine has no threshold-gated CDA machinery to apply the printed +3/+0 (a documented gap, same class as gaelicat/magitek-infantry's own identically-shaped artifact-count buffs).`;
  return [finishEnginePilotTrace(pilot, setup, 'real engine playthrough: 7 real lands present -> cast -> real condition/CDA reads (gap documented)', result)];
}
