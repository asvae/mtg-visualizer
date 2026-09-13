// Real engine-piloted trace (see engine-trace.ts's own header). Keyword
// coverage suite — Demon Wall's real printed Defender (its own Menace is
// covered separately, functional-model/keywords/menace), reused directly
// (name/pt/keywords) onto a battlefield rather than cast, since this
// bundle's own subject is the real 302.6a "creatures with Defender can't
// attack" rule itself.

import { demonWall } from '../../cards/demon-wall/definition';
import type { TraceResult } from '../../harness';
import { setupEnginePilot, advanceToDeclareAttackersStep, pilotExpectIllegalAttack, finishEnginePilotTrace, type EnginePilotSetup } from '../../engine-trace';

export function runEngineScenarios(): TraceResult[] {
  const setup: EnginePilotSetup = { you: { libraryCount: 3 } };
  const pilot = setupEnginePilot(setup);

  const demonWallReal = pilot.state.addCard(pilot.you, 'Battlefield', {
    name: demonWall.name,
    types: ['Artifact', 'Creature'],
    subtypes: ['Demon', 'Wall'],
    basePower: demonWall.pt![0],
    baseToughness: demonWall.pt![1],
    keywords: demonWall.keywords,
  });
  pilot.log.push({ fn: 'enters', card: demonWallReal.name, zone: 'Battlefield', power: demonWallReal.basePower, toughness: demonWallReal.baseToughness });

  advanceToDeclareAttackersStep(pilot);
  pilotExpectIllegalAttack(pilot, [demonWallReal], `Attempt (expected illegal): declare ${demonWall.name} as attacker`);

  const result = `302.6a: Demon Wall's printed Defender rejects its own attacker declaration outright — the engine's own reason (canAttack) is logged, not a scripted assumption. (Demon Wall's own text has a conditional exception — "as long as this creature has a counter on it, it can attack as though it didn't have defender" — that clause is plain descriptive text in this model, since there is no attack-legality hook a counter-count condition could plug into; see that card's own definition.ts comment.)`;
  return [finishEnginePilotTrace(pilot, setup, 'engine playthrough: declare Defender creature as attacker -> rejection (302.6a)', result)];
}
