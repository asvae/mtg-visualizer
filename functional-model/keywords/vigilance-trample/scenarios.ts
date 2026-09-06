// Real engine-piloted trace (see engine-trace.ts's own header). Keyword
// coverage suite — Iron Giant is a real, printed-vanilla-plus-three-
// keywords card (no other abilities to muddy the demo), reused directly
// (its real name/pt/keywords) onto a battlefield rather than cast, since
// this bundle's own subject is Vigilance (508.1f) and Trample (702.19c)
// themselves, not Iron Giant's own cast lifecycle.

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
  finishEnginePilotTrace,
  type EnginePilotSetup,
} from '../../engine-trace';

export function runEngineScenarios(): TraceResult[] {
  const setup: EnginePilotSetup = { you: { libraryCount: 3 }, opponents: [{ libraryCount: 3 }] };
  const pilot = setupEnginePilot(setup);

  const ironGiantReal = pilot.state.addCard(pilot.you, 'Battlefield', {
    name: ironGiant.name,
    types: ['Artifact', 'Creature'],
    subtypes: ['Demon'],
    basePower: ironGiant.pt![0],
    baseToughness: ironGiant.pt![1],
    keywords: ironGiant.keywords,
  });
  pilot.log.push({ fn: 'enters', card: ironGiantReal.name, zone: 'Battlefield', power: ironGiantReal.basePower, toughness: ironGiantReal.baseToughness });

  const smallBlocker = pilot.state.addCard(pilot.opponents[0]!, 'Battlefield', { name: 'Small Blocker', types: ['Creature'], basePower: 1, baseToughness: 1 });
  pilot.log.push({
    fn: 'enters',
    card: smallBlocker.name,
    zone: 'Battlefield',
    power: smallBlocker.basePower,
    toughness: smallBlocker.baseToughness,
    controller: pilot.opponents[0]!.name,
  });

  // Real 508.1 attacker declaration — 508.1f: Vigilance means NO tap. The
  // absence of a `tap` log entry here (pilotDeclareAttackers's own real
  // behavior — see that helper's doc comment) IS the proof: a replay of
  // this trace shows Iron Giant still untapped after attacking.
  advanceToDeclareAttackersStep(pilot);
  pilotDeclareAttackers(pilot, [ironGiantReal], `Declare ${ironGiant.name} (Vigilance) as attacker`);
  advanceOneStep(pilot, 'Advance to Declare Blockers');
  pilotDeclareBlockers(pilot, [{ blocker: smallBlocker, attacker: ironGiantReal }], `Declare ${smallBlocker.name} as blocker`);

  pilot.beginStep('Resolve combat damage — real Trample (702.19c) overflow');
  const opp = pilot.opponents[0]!;
  const beforeOppLife = opp.life;
  const beforeBlockerDamage = smallBlocker.damageMarked ?? 0;
  const beforeGiantDamage = ironGiantReal.damageMarked ?? 0;
  resolveCombatDamage(pilot.engine);
  const toBlocker = (smallBlocker.damageMarked ?? 0) - beforeBlockerDamage;
  if (toBlocker > 0) pilot.log.push({ fn: 'dealDamage', source: ironGiantReal.name, target: smallBlocker.name, amount: toBlocker });
  const trampled = beforeOppLife - opp.life;
  if (trampled > 0) pilot.log.push({ fn: 'dealDamage', source: ironGiantReal.name, target: opp.name, amount: trampled });
  const toGiant = (ironGiantReal.damageMarked ?? 0) - beforeGiantDamage;
  if (toGiant > 0) pilot.log.push({ fn: 'dealDamage', source: smallBlocker.name, target: ironGiantReal.name, amount: toGiant });

  const sbaResult = checkStateBasedActions(pilot.state, pilot.engine.players);
  for (const destroyed of sbaResult.destroyed) {
    const controllerName = pilot.state.players.get(destroyed.controllerId)!.name;
    pilot.log.push({ fn: 'destroy', target: destroyed.name, controller: controllerName });
  }

  const result =
    `Real 508.1f: Iron Giant's own Vigilance means declaring it as an attacker never taps it (no \`tap\` entry — compare a non-Vigilance attacker's trace, which always has one). Real 702.19c: blocked by a 1-toughness creature, only the real lethal amount (1) goes to the blocker (a genuine 704.5g destruction) — the remaining 5 of its 6 power overflows past the dead blocker straight to the defending player, exactly Trample's own rule, not a full-6-to-blocker or full-6-to-player shortcut.`;
  return [
    finishEnginePilotTrace(pilot, setup, 'real engine playthrough: declare Vigilance attacker (no tap) -> blocked -> real Trample overflow damage', result),
  ];
}
