// Real engine-piloted trace (see engine-trace.ts's own header) — replaces
// the old plain-`harness.ts` single-line scenario 2026-09-15 (fin/16-25
// pass) once Gigantoad's own printed threshold-CDA ("As long as you
// control seven or more lands, this creature gets +2/+2") became real via
// `card.ts`'s `ptFormula.kind:'thresholdBonus'` — same real mechanism/
// pattern as scorpion-sentinel's own sibling scenario (identical land-count
// shape, differently-valued bonus).
import { gigantoad } from './definition';
import { effectivePT } from '../../state';
import { loggingPlayer } from '../../harness';
import type { TraceResult } from '../../harness';
import { setupEnginePilot, pilotActions, pilotCast, pilotResolveTop, finishEnginePilotTrace, type EnginePilotSetup } from '../../engine-trace';

export function runEngineScenarios(): TraceResult[] {
  const setup: EnginePilotSetup = {
    // 7 real basic lands — enough to both pay Gigantoad's own {3}{G} cost
    // AND meet the printed "seven or more lands" threshold with no extra
    // filler permanents needed.
    you: { basicLands: ['Forest', 'Forest', 'Forest', 'Forest', 'Plains', 'Plains', 'Plains'], libraryCount: 5 },
    opponents: [{ libraryCount: 5 }],
  };
  const pilot = setupEnginePilot(setup);

  pilot.beginStep('Condition check — 7 lands already on the battlefield (meets the printed threshold)');
  const landsCount = loggingPlayer(pilot.state, pilot.you, pilot.log).getLandsInPlay().length;

  const gigantoadReal = pilot.state.addCard(pilot.you, 'Hand', {
    name: gigantoad.name,
    types: ['Creature'],
    subtypes: ['Frog'],
    basePower: gigantoad.pt?.[0],
    baseToughness: gigantoad.pt?.[1],
    // `pilot.state.addCard` is a raw manual `RealCard` build (unlike
    // `harness.ts`'s own generic `runScenario`, which copies
    // `effectiveCard.ptFormula` automatically) — `ptFormula` must be
    // threaded through explicitly or the real layer-7a CDA never applies
    // (a real bug caught 2026-09-15, same class as gaelicat's/scorpion-
    // sentinel's own scenarios hitting it first).
    ptFormula: gigantoad.ptFormula,
  });
  const actions = pilotActions(pilot, gigantoadReal.id);
  const ctx = pilot.ctxFor(gigantoadReal);

  // Cast Gigantoad ({3}{G}), real mana payment
  pilotCast(pilot, gigantoadReal, gigantoad, ctx, actions);
  pilotResolveTop(pilot);

  // Real layer-7a read — same live `effectivePT` scorpion-sentinel's own
  // scenario uses. Genuinely recalculates to 6/6 (printed 4/4 +2/+2) once
  // the threshold is met.
  pilot.beginStep('Layer-7a read — threshold-CDA machinery applies the +2/+2');
  const [power, toughness] = effectivePT(pilot.state, gigantoadReal);
  pilot.log.push({ fn: 'read:getNetPower', card: gigantoad.name, power, toughness });

  const result = `Gigantoad enters with ${landsCount} lands already on the battlefield, meeting the printed "seven or more lands" threshold — layer-7a effectivePT genuinely recalculates to ${power}/${toughness} (printed 4/4 +2/+2), real threshold-CDA machinery in place (same mechanism as scorpion-sentinel's own identically-shaped land-count buff).`;
  return [finishEnginePilotTrace(pilot, setup, 'engine playthrough: 7 lands present -> cast -> real threshold-CDA pump applies', result)];
}
