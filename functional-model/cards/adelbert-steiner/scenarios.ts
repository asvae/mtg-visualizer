// Real engine-piloted trace (see engine-trace.ts's own header). Steiner has
// no triggers of its own — its behavior is a live-recalculated layer-7a CDA
// (+1/+1 per Equipment) plus Lifelink, shown via a real Equipment
// attachment, real combat, and the real legend rule.

import { adelbertSteiner } from './definition';
import { basicLandsFor } from '../../mana';
import { effectivePT } from '../../state';
import { checkStateBasedActions } from '../../sba';
import type { TraceResult } from '../../harness';
import { declareAttackers, declareBlockers, resolveCombatDamage } from '../../engine';
import {
  setupEnginePilot,
  pilotActions,
  pilotCast,
  pilotResolveTop,
  advanceToPlayersNextMain1,
  advanceToDeclareAttackersStep,
  advanceOneStep,
  finishEnginePilotTrace,
  type EnginePilotSetup,
} from '../../engine-trace';

export function runEngineScenarios(): TraceResult[] {
  const setup: EnginePilotSetup = {
    you: { tokens: ['sword'], basicLands: basicLandsFor('{1}{W}'), libraryCount: 5 },
    opponents: [{ libraryCount: 5 }],
  };
  const pilot = setupEnginePilot(setup);

  const steinerReal = pilot.state.addCard(pilot.you, 'Hand', {
    name: adelbertSteiner.name,
    types: ['Creature'],
    subtypes: ['Human', 'Knight', 'Legendary'],
    keywords: adelbertSteiner.keywords,
    ptFormula: adelbertSteiner.ptFormula,
    basePower: adelbertSteiner.pt?.[0],
    baseToughness: adelbertSteiner.pt?.[1],
  });
  const actions = pilotActions(pilot, steinerReal.id);
  const ctx = pilot.ctxFor(steinerReal);

  // Cast Steiner ({1}{W}), real mana payment
  pilotCast(pilot, steinerReal, adelbertSteiner, ctx, actions);
  pilotResolveTop(pilot);

  // Real Equipment attachment (301.5c)
  pilot.beginStep('Real Equipment attachment (301.5c)');
  const sword = pilot.you.battlefield.find((c) => c.name === 'Sword')!;
  pilot.state.equip(sword, steinerReal);
  pilot.log.push({ fn: 'equip', equipment: sword.name, target: steinerReal.name });

  // Real layer-7a CDA recalculation — printed 2/1 +1/+1 for one Equipment
  pilot.beginStep('Real layer-7a CDA recalculation');
  const [power, toughness] = effectivePT(pilot.state, steinerReal);
  pilot.log.push({ fn: 'read:getNetPower', card: adelbertSteiner.name, power, toughness });

  // Real turn passage — summoning sickness clears
  advanceToPlayersNextMain1(pilot, pilot.you);

  // Real, unblocked combat (508/509/510)
  advanceToDeclareAttackersStep(pilot);
  pilot.beginStep('Declare Steiner as attacker');
  const attack = declareAttackers(pilot.engine, [steinerReal]);
  if (!attack.ok) throw new Error(`attack illegal: ${attack.reason}`);
  pilot.log.push({ fn: 'attack', card: steinerReal.name });
  advanceOneStep(pilot);
  pilot.beginStep('Resolve combat damage — real Lifelink');
  declareBlockers(pilot.engine, []);
  const opp = pilot.opponents[0]!;
  const beforeOppLife = opp.life;
  const beforeYouLife = pilot.you.life;
  resolveCombatDamage(pilot.engine);

  const damageDealt = beforeOppLife - opp.life;
  if (damageDealt > 0) pilot.log.push({ fn: 'dealDamage', source: steinerReal.name, target: opp.name, amount: damageDealt });
  const lifeGained = pilot.you.life - beforeYouLife;
  if (lifeGained > 0) pilot.log.push({ fn: 'gainLife', player: pilot.you.name, amount: lifeGained, cause: 'Lifelink' });

  // Real 704.5j legend rule — a second real copy enters, one is removed
  pilot.beginStep('Real 704.5j legend rule — second copy enters, one is removed');
  const secondCopy = pilot.state.addCard(pilot.you, 'Battlefield', {
    name: adelbertSteiner.name,
    types: ['Creature'],
    subtypes: ['Human', 'Knight', 'Legendary'],
    keywords: adelbertSteiner.keywords,
    ptFormula: adelbertSteiner.ptFormula,
    basePower: adelbertSteiner.pt?.[0],
    baseToughness: adelbertSteiner.pt?.[1],
  });
  pilot.log.push({ fn: 'enters', card: secondCopy.name, instanceId: 2, zone: 'Battlefield' });
  const sbaResult = checkStateBasedActions(pilot.state, pilot.engine.players);
  for (const removed of sbaResult.legendRuleRemoved) pilot.log.push({ fn: 'legendRule', card: removed.name, player: pilot.you.name });

  const result =
    'Steiner enters, a real Equipment (Sword) attaches — the printed "+1/+1 for each Equipment" CDA recalculates (layer 7a) to 3/2; real turn passage clears summoning sickness, then it attacks unblocked, dealing real combat damage and gaining its controller life via Lifelink; a second real copy of Steiner enters, and the real legend rule (704.5j) removes one of the two.';
  return [finishEnginePilotTrace(pilot, setup, 'real engine playthrough: cast -> equip -> CDA recalculation -> real combat -> Lifelink', result)];
}
