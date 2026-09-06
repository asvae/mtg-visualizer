// Real engine-piloted trace for this card (see engine-trace.ts's own
// header). Adelbert Steiner has no triggers/effects of its own at all —
// its whole real behavior is a live-recalculated layer-7a CDA (`ptFormula:
// addPerEquipmentControlled`) plus Lifelink, so this pilots a real
// Equipment attachment (recalculating real P/T) and a real combat sequence
// (unblocked attack) to show real Lifelink life gain through the engine's
// own real combat-damage/`dealDamage` machinery — no bespoke damage-logging
// invented here, just manual log entries matching the SAME `dealDamage`/
// `gainLife` shapes `harness.ts`'s own `loggingActions`/`loggingPlayer`
// already use (real 702.15e Lifelink handling lives in `state.dealDamage`
// itself; `resolveCombatDamage`, engine.ts, calls it directly rather than
// through a logging wrapper, so this pilot logs the real consequence
// after the fact from real before/after life snapshots, not by guessing).

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
    // Both players need a real library — this scenario crosses a full real
    // turn (real 704.5a, sba.ts, genuinely loses the game for whoever's
    // instructed to draw with none left).
    you: { tokens: ['sword'], basicLands: basicLandsFor('{1}{W}'), libraryCount: 5 },
    opponents: [{ libraryCount: 5 }], // a real defending player for the unblocked attack below
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

  // --- Cast Steiner ({1}{W}), real mana payment ---
  pilotCast(pilot, steinerReal, adelbertSteiner, ctx, actions);
  // --- Resolves onto the battlefield (no ETB trigger declared) ---
  pilotResolveTop(pilot);

  // --- Real Equipment attachment (301.5c's own end state — this pilot
  // attaches directly via `state.equip`, the same real, persistent link a
  // full Equip-ability activation would produce; see ENGINE_GAPS.md's own
  // gap #11 note on Equip's cost/timing machinery, which isn't what this
  // card's own real P/T recalculation depends on). ---
  const sword = pilot.you.battlefield.find((c) => c.name === 'Sword')!;
  pilot.state.equip(sword, steinerReal);
  pilot.log.push({ fn: 'equip', equipment: sword.name, target: steinerReal.name });

  // --- Real layer-7a CDA recalculation (state.ts's own `effectivePT`) —
  // Steiner's printed 2/1 +1/+1 for the one real Equipment now attached. ---
  const [power, toughness] = effectivePT(pilot.state, steinerReal);
  pilot.log.push({ fn: 'read:getNetPower', card: adelbertSteiner.name, power, toughness });

  // --- Real turn passage — summoning sickness (302.6) genuinely clears ---
  advanceToPlayersNextMain1(pilot, pilot.you);

  // --- Real, unblocked combat (508/509/510) ---
  advanceToDeclareAttackersStep(pilot);
  const attack = declareAttackers(pilot.engine, [steinerReal]);
  if (!attack.ok) throw new Error(`attack illegal: ${attack.reason}`);
  pilot.log.push({ fn: 'attack', card: steinerReal.name });
  advanceOneStep(pilot); // CombatDeclareAttackers -> CombatDeclareBlockers
  declareBlockers(pilot.engine, []); // unblocked
  const opp = pilot.opponents[0]!;
  const beforeOppLife = opp.life;
  const beforeYouLife = pilot.you.life;
  resolveCombatDamage(pilot.engine);

  const damageDealt = beforeOppLife - opp.life;
  if (damageDealt > 0) pilot.log.push({ fn: 'dealDamage', source: steinerReal.name, target: opp.name, amount: damageDealt });
  const lifeGained = pilot.you.life - beforeYouLife;
  if (lifeGained > 0) pilot.log.push({ fn: 'gainLife', player: pilot.you.name, amount: lifeGained, cause: 'Lifelink' });

  // --- Real 704.5j legend rule (folded into `sba.ts`'s own
  // `checkStateBasedActions`) — a second real copy of Steiner enters; one
  // of the two real, identically-named Legendary permanents is really
  // removed. Same real probe harness.ts's own (replaced) flat
  // `keyword-scenarios.ts` generically ran for every Legendary card — kept
  // here so this fact stays genuinely demonstrated, not lost in the
  // conversion. ---
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
    "Steiner enters, a real Equipment (Sword) is attached — the printed \"+1/+1 for each Equipment you control\" CDA recalculates for real (layer 7a) to 3/2; real turn passage clears summoning sickness, then it attacks unblocked, dealing real combat damage to the opponent and, via Lifelink (real 702.15e handling in state.dealDamage), gaining its controller that much real life; a second real copy of Steiner then enters, and the real legend rule (704.5j) removes one of the two — all through the real turn-based engine's own combat/state-based-action machinery, not harness.ts's own (replaced) flat synthetic probes.";
  return [finishEnginePilotTrace(pilot, setup, 'real engine playthrough: cast -> equip -> CDA recalculation -> real combat -> Lifelink', result)];
}
