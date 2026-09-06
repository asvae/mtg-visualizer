// Real engine-piloted trace (see engine-trace.ts's own header). Keyword
// coverage suite — Gran Pulse Ochu's real printed Deathtouch (a bare 1/1,
// no other ability relevant to combat), reused directly (name/pt/keywords)
// onto a battlefield rather than cast, since this bundle's own subject is
// the real 702.2e/704.5h "any nonzero damage from a Deathtouch source is
// lethal" rule itself.

import { granPulseOchu } from '../../cards/gran-pulse-ochu/definition';
import type { TraceResult } from '../../harness';
import { resolveCombatDamage } from '../../engine';
import { checkStateBasedActions } from '../../sba';
import {
  setupEnginePilot,
  advanceToDeclareAttackersStep,
  advanceOneStep,
  pilotDeclareAttackers,
  pilotDeclareBlockers,
  finishEnginePilotTrace,
  type EnginePilotSetup,
} from '../../engine-trace';

export function runEngineScenarios(): TraceResult[] {
  const setup: EnginePilotSetup = { you: { libraryCount: 3 }, opponents: [{ libraryCount: 3 }] };
  const pilot = setupEnginePilot(setup);

  const ochuReal = pilot.state.addCard(pilot.you, 'Battlefield', {
    name: granPulseOchu.name,
    types: ['Creature'],
    subtypes: ['Plant', 'Beast'],
    basePower: granPulseOchu.pt![0],
    baseToughness: granPulseOchu.pt![1],
    keywords: granPulseOchu.keywords,
  });
  pilot.log.push({ fn: 'enters', card: ochuReal.name, zone: 'Battlefield', power: ochuReal.basePower, toughness: ochuReal.baseToughness });

  // A 4-toughness blocker — without Deathtouch, Ochu's 1 damage would be
  // nowhere near lethal (1 << 4). Its own 4 power is real lethal to Ochu's
  // 1 toughness too, so both sides genuinely die — Deathtouch's own real
  // effect is what makes the BIG blocker's death the surprising half.
  const bigBlocker = pilot.state.addCard(pilot.opponents[0]!, 'Battlefield', { name: 'Big Blocker', types: ['Creature'], basePower: 4, baseToughness: 4 });
  pilot.log.push({
    fn: 'enters',
    card: bigBlocker.name,
    zone: 'Battlefield',
    power: bigBlocker.basePower,
    toughness: bigBlocker.baseToughness,
    controller: pilot.opponents[0]!.name,
  });

  advanceToDeclareAttackersStep(pilot);
  pilotDeclareAttackers(pilot, [ochuReal], `Declare ${granPulseOchu.name} (Deathtouch) as attacker`);
  advanceOneStep(pilot, 'Advance to Declare Blockers');
  pilotDeclareBlockers(pilot, [{ blocker: bigBlocker, attacker: ochuReal }], `Declare ${bigBlocker.name} as blocker`);

  pilot.beginStep('Resolve combat damage — real Deathtouch (702.2e)');
  const beforeBlockerDamage = bigBlocker.damageMarked ?? 0;
  const beforeOchuDamage = ochuReal.damageMarked ?? 0;
  resolveCombatDamage(pilot.engine);
  const toBlocker = (bigBlocker.damageMarked ?? 0) - beforeBlockerDamage;
  if (toBlocker > 0) pilot.log.push({ fn: 'dealDamage', source: ochuReal.name, target: bigBlocker.name, amount: toBlocker });
  const toOchu = (ochuReal.damageMarked ?? 0) - beforeOchuDamage;
  if (toOchu > 0) pilot.log.push({ fn: 'dealDamage', source: bigBlocker.name, target: ochuReal.name, amount: toOchu });

  const sbaResult = checkStateBasedActions(pilot.state, pilot.engine.players);
  for (const destroyed of sbaResult.destroyed) {
    const controllerName = pilot.state.players.get(destroyed.controllerId)!.name;
    pilot.log.push({ fn: 'destroy', target: destroyed.name, controller: controllerName });
  }

  const result =
    `Real 702.2e/704.5h: Gran Pulse Ochu deals only 1 damage to a 4-toughness blocker — nowhere near enough under a plain lethal-damage check — but its real printed Deathtouch marks that 1 damage as lethal regardless, and the engine's own real SBA sweep (\`isLethallyDamaged\`) destroys the blocker for it. Ochu itself also dies (the blocker's 4 power is separately, ordinarily lethal to Ochu's 1 toughness) — a genuine mutual kill, not a one-sided effect.`;
  return [finishEnginePilotTrace(pilot, setup, 'real engine playthrough: declare Deathtouch attacker -> blocked -> real lethal-by-Deathtouch SBA', result)];
}
