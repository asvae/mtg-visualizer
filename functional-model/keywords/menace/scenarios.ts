// Real engine-piloted trace (see engine-trace.ts's own header). Keyword
// coverage suite — Xande, Dark Mage's real printed Menace, reused directly
// (name/pt/keywords) onto a battlefield rather than cast, since this
// bundle's own subject is Menace's real blocking-legality rule (509.1b/
// 702.111b) itself.

import { xandeDarkMage } from '../../cards/xande-dark-mage/definition';
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

  const xandeReal = pilot.state.addCard(pilot.you, 'Battlefield', {
    name: xandeDarkMage.name,
    types: ['Creature'],
    subtypes: ['Human', 'Wizard', 'Legendary'],
    basePower: xandeDarkMage.pt![0],
    baseToughness: xandeDarkMage.pt![1],
    keywords: xandeDarkMage.keywords,
  });
  pilot.log.push({ fn: 'enters', card: xandeReal.name, zone: 'Battlefield', power: xandeReal.basePower, toughness: xandeReal.baseToughness });

  const blocker1 = pilot.state.addCard(pilot.opponents[0]!, 'Battlefield', { name: 'Blocker One', types: ['Creature'], basePower: 1, baseToughness: 1 });
  const blocker2 = pilot.state.addCard(pilot.opponents[0]!, 'Battlefield', { name: 'Blocker Two', types: ['Creature'], basePower: 1, baseToughness: 1 });
  for (const b of [blocker1, blocker2]) {
    pilot.log.push({ fn: 'enters', card: b.name, zone: 'Battlefield', power: b.basePower, toughness: b.baseToughness, controller: pilot.opponents[0]!.name });
  }

  advanceToDeclareAttackersStep(pilot);
  pilotDeclareAttackers(pilot, [xandeReal], `Declare ${xandeDarkMage.name} (Menace) as attacker`);
  advanceOneStep(pilot, 'Advance to Declare Blockers');

  // Real 509.1b/702.111b — a Menace attacker can't be blocked by ONLY one creature.
  pilotExpectIllegalBlock(pilot, [{ blocker: blocker1, attacker: xandeReal }], `Attempt (expected illegal): only ${blocker1.name} blocks ${xandeDarkMage.name}`);

  // Two blockers satisfies Menace's real minimum.
  pilotDeclareBlockers(
    pilot,
    [
      { blocker: blocker1, attacker: xandeReal },
      { blocker: blocker2, attacker: xandeReal },
    ],
    `Declare ${blocker1.name} and ${blocker2.name} as blockers`
  );

  pilot.beginStep('Resolve combat damage');
  const beforeXandeDamage = xandeReal.damageMarked ?? 0;
  const beforeB1 = blocker1.damageMarked ?? 0;
  const beforeB2 = blocker2.damageMarked ?? 0;
  resolveCombatDamage(pilot.engine);
  const toB1 = (blocker1.damageMarked ?? 0) - beforeB1;
  if (toB1 > 0) pilot.log.push({ fn: 'dealDamage', source: xandeReal.name, target: blocker1.name, amount: toB1 });
  const toB2 = (blocker2.damageMarked ?? 0) - beforeB2;
  if (toB2 > 0) pilot.log.push({ fn: 'dealDamage', source: xandeReal.name, target: blocker2.name, amount: toB2 });
  const toXande = (xandeReal.damageMarked ?? 0) - beforeXandeDamage;
  if (toXande > 0) pilot.log.push({ fn: 'dealDamage', source: `${blocker1.name} & ${blocker2.name}`, target: xandeReal.name, amount: toXande });

  const sbaResult = checkStateBasedActions(pilot.state, pilot.engine.players);
  for (const destroyed of sbaResult.destroyed) {
    const controllerName = pilot.state.players.get(destroyed.controllerId)!.name;
    pilot.log.push({ fn: 'destroy', target: destroyed.name, controller: controllerName });
  }

  const result =
    `Real 509.1b/702.111b: a single blocker is rejected outright against Xande's real printed Menace — the engine's own real reason is logged, not a scripted assumption. Two blockers satisfy Menace's real minimum and the block is declared legally; real combat damage then splits Xande's 3 power lethally across both 1-toughness blockers (both destroyed, 704.5g) while their combined 2 power back doesn't kill Xande's own 3 toughness.`;
  return [
    finishEnginePilotTrace(pilot, setup, 'real engine playthrough: declare Menace attacker -> single-blocker rejected -> two-blocker block legal -> real combat', result),
  ];
}
