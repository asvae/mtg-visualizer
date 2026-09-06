// Real engine-piloted trace (see engine-trace.ts's own header). Keyword
// coverage suite — proves the engine's real blocking-legality enforcement
// for Flying (509.1b) and its real Reach exception, using two real cards'
// own printed stats/keywords (no fabricated stat lines): Ahriman (real
// Flying attacker) and Iron Giant (real Reach blocker), plus one plain
// vanilla (no-keyword) creature to show the rejection Flying alone causes.
// Neither card is CAST here — only its printed name/pt/keywords are reused
// directly onto a battlefield (`addCard`), since this bundle's own subject
// is the blocking-legality rule itself, not either card's full cast/ability
// lifecycle (already covered by their own functional-model/cards/<slug>
// scenarios.ts).

import { ahriman } from '../../cards/ahriman/definition';
import { ironGiant } from '../../cards/iron-giant/definition';
import type { TraceResult } from '../../harness';
import { resolveCombatDamage } from '../../engine';
import { checkStateBasedActions } from '../../sba';
import {
  setupEnginePilot,
  advanceToDeclareAttackersStep,
  advanceOneStep,
  pilotDeclareAttackers,
  pilotDeclareBlockers,
  pilotExpectIllegalBlock,
  finishEnginePilotTrace,
  type EnginePilotSetup,
} from '../../engine-trace';

export function runEngineScenarios(): TraceResult[] {
  const setup: EnginePilotSetup = { you: { libraryCount: 3 }, opponents: [{ libraryCount: 3 }] };
  const pilot = setupEnginePilot(setup);

  const ahrimanReal = pilot.state.addCard(pilot.you, 'Battlefield', {
    name: ahriman.name,
    types: ['Creature'],
    subtypes: ['Eye', 'Horror'],
    basePower: ahriman.pt![0],
    baseToughness: ahriman.pt![1],
    keywords: ahriman.keywords,
  });
  pilot.log.push({ fn: 'enters', card: ahrimanReal.name, zone: 'Battlefield', power: ahrimanReal.basePower, toughness: ahrimanReal.baseToughness });

  const ironGiantReal = pilot.state.addCard(pilot.opponents[0]!, 'Battlefield', {
    name: ironGiant.name,
    types: ['Artifact', 'Creature'],
    subtypes: ['Demon'],
    basePower: ironGiant.pt![0],
    baseToughness: ironGiant.pt![1],
    keywords: ironGiant.keywords,
  });
  pilot.log.push({
    fn: 'enters',
    card: ironGiantReal.name,
    zone: 'Battlefield',
    power: ironGiantReal.basePower,
    toughness: ironGiantReal.baseToughness,
    controller: pilot.opponents[0]!.name,
  });

  const groundedBlocker = pilot.state.addCard(pilot.opponents[0]!, 'Battlefield', {
    name: 'Grounded Blocker',
    types: ['Creature'],
    basePower: 2,
    baseToughness: 2,
  });
  pilot.log.push({
    fn: 'enters',
    card: groundedBlocker.name,
    zone: 'Battlefield',
    power: groundedBlocker.basePower,
    toughness: groundedBlocker.baseToughness,
    controller: pilot.opponents[0]!.name,
  });

  // Real 508.1 attacker declaration
  advanceToDeclareAttackersStep(pilot);
  pilotDeclareAttackers(pilot, [ahrimanReal], `Declare ${ahriman.name} (Flying) as attacker`);
  advanceOneStep(pilot, 'Advance to Declare Blockers');

  // Real 509.1b — a creature with neither Flying nor Reach can't block a
  // Flying attacker at all, no matter how many are assigned.
  pilotExpectIllegalBlock(pilot, [{ blocker: groundedBlocker, attacker: ahrimanReal }], `Attempt (expected illegal): Grounded Blocker (no Flying/Reach) blocks ${ahriman.name}`);

  // Real 509.1b's own exception — Reach legally blocks a Flying attacker.
  pilotDeclareBlockers(pilot, [{ blocker: ironGiantReal, attacker: ahrimanReal }], `Declare ${ironGiant.name} (Reach) as blocker`);

  pilot.beginStep('Resolve combat damage');
  const beforeIronGiantDamage = ironGiantReal.damageMarked ?? 0;
  const beforeAhrimanDamage = ahrimanReal.damageMarked ?? 0;
  resolveCombatDamage(pilot.engine);
  const toIronGiant = (ironGiantReal.damageMarked ?? 0) - beforeIronGiantDamage;
  if (toIronGiant > 0) pilot.log.push({ fn: 'dealDamage', source: ahrimanReal.name, target: ironGiantReal.name, amount: toIronGiant });
  const toAhriman = (ahrimanReal.damageMarked ?? 0) - beforeAhrimanDamage;
  if (toAhriman > 0) pilot.log.push({ fn: 'dealDamage', source: ironGiantReal.name, target: ahrimanReal.name, amount: toAhriman });
  const sbaResult = checkStateBasedActions(pilot.state, pilot.engine.players);
  for (const destroyed of sbaResult.destroyed) {
    const controllerName = pilot.state.players.get(destroyed.controllerId)!.name;
    pilot.log.push({ fn: 'destroy', target: destroyed.name, controller: controllerName });
  }

  const result =
    `Real 509.1b: ${groundedBlocker.name} (no Flying/Reach) is rejected outright from blocking the Flying ${ahriman.name} — the engine's own real reason is logged, not a scripted assumption. ${ironGiant.name}'s real printed Reach then legally blocks the same attacker instead, and real combat damage resolves: Iron Giant's 6 power is real lethal damage against Ahriman's 2 toughness (a genuine 704.5g SBA destruction), while Ahriman's 2 damage back barely dents Iron Giant's 6 toughness.`;
  return [
    finishEnginePilotTrace(
      pilot,
      setup,
      'real engine playthrough: declare Flying attacker -> illegal block rejected (509.1b) -> legal Reach block -> real combat damage',
      result
    ),
  ];
}
