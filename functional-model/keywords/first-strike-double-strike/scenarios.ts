// Real engine-piloted trace (see engine-trace.ts's own header). Keyword
// coverage suite — two real cards, each carrying only the one keyword this
// scenario means to isolate (plus unrelated abilities left un-fired):
// Lightning, Army of One (real FirstStrike) and Giott, King of the Dwarves
// (real DoubleStrike), reused directly (name/pt/keywords) onto a
// battlefield rather than cast — this bundle's subject is real combat's own
// 510.5 two-pass damage ordering (`engine.ts`'s `resolveCombatDamage`). Both
// blockers are also real FIN cards (Shambling Cie'th, Stiltzkin) reused the
// same un-cast way, their own unrelated abilities left un-fired.

import { lightningArmyOfOne } from '../../cards/lightning-army-of-one/definition';
import { giottKingOfTheDwarves } from '../../cards/giott-king-of-the-dwarves/definition';
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

function firstStrikeScenario(): TraceResult {
  const setup: EnginePilotSetup = { you: { libraryCount: 3 }, opponents: [{ libraryCount: 3 }] };
  const pilot = setupEnginePilot(setup);

  const lightningReal = pilot.state.addCard(pilot.you, 'Battlefield', {
    name: lightningArmyOfOne.name,
    types: ['Creature'],
    subtypes: ['Human', 'Soldier', 'Legendary'],
    basePower: lightningArmyOfOne.pt![0],
    baseToughness: lightningArmyOfOne.pt![1],
    keywords: lightningArmyOfOne.keywords,
  });
  pilot.log.push({ fn: 'enters', card: lightningReal.name, zone: 'Battlefield', power: lightningReal.basePower, toughness: lightningReal.baseToughness });

  // Shambling Cie'th — a real FIN 3/3 (its own "enters tapped" static
  // ability and noncreature-spell-return trigger never come into play,
  // since it's placed directly rather than cast). Exactly 3 toughness —
  // Lightning's 3 power is real lethal in the FIRST (First Strike) damage
  // sub-step alone, before the blocker (no First/Double Strike of its own)
  // ever gets to deal ITS power back. Without real 510.5 ordering, both
  // would just trade simultaneously — this blocker's own 3 power is real
  // lethal to Lightning's 2 toughness too.
  const blocker = pilot.state.addCard(pilot.opponents[0]!, 'Battlefield', { name: "Shambling Cie'th", types: ['Creature'], subtypes: ['Mutant', 'Horror'], basePower: 3, baseToughness: 3 });
  pilot.log.push({ fn: 'enters', card: blocker.name, zone: 'Battlefield', power: blocker.basePower, toughness: blocker.baseToughness, controller: pilot.opponents[0]!.name });

  advanceToDeclareAttackersStep(pilot);
  pilotDeclareAttackers(pilot, [lightningReal], `Declare ${lightningArmyOfOne.name} (First Strike) as attacker`);
  advanceOneStep(pilot, 'Advance to Declare Blockers');
  pilotDeclareBlockers(pilot, [{ blocker, attacker: lightningReal }], `Declare ${blocker.name} as blocker`);

  pilot.beginStep('Resolve combat damage — real First Strike (510.5) two-pass ordering');
  const beforeBlockerDamage = blocker.damageMarked ?? 0;
  const beforeLightningDamage = lightningReal.damageMarked ?? 0;
  resolveCombatDamage(pilot.engine);
  const toBlocker = (blocker.damageMarked ?? 0) - beforeBlockerDamage;
  if (toBlocker > 0) pilot.log.push({ fn: 'dealDamage', source: lightningReal.name, target: blocker.name, amount: toBlocker });
  const toLightning = (lightningReal.damageMarked ?? 0) - beforeLightningDamage;
  if (toLightning > 0) pilot.log.push({ fn: 'dealDamage', source: blocker.name, target: lightningReal.name, amount: toLightning });

  const sbaResult = checkStateBasedActions(pilot.state, pilot.engine.players);
  for (const destroyed of sbaResult.destroyed) {
    const controllerName = pilot.state.players.get(destroyed.controllerId)!.name;
    pilot.log.push({ fn: 'destroy', target: destroyed.name, controller: controllerName });
  }

  const result =
    `Real 510.5: Lightning's First Strike deals its 3 damage in the FIRST combat-damage sub-step, real-lethally destroying the 3-toughness blocker (704.5g) BEFORE the regular sub-step ever runs — the blocker deals zero damage back (no dealDamage entry from it at all), so Lightning survives fully undamaged. A naive single-pass resolution would have traded both creatures simultaneously instead; the absence of any damage TO Lightning is the real, observable proof First Strike's own ordering actually ran.`;
  return finishEnginePilotTrace(pilot, setup, 'real engine playthrough: declare First Strike attacker -> blocked -> real two-pass combat damage', result);
}

function doubleStrikeScenario(): TraceResult {
  const setup: EnginePilotSetup = { you: { libraryCount: 3 }, opponents: [{ libraryCount: 3 }] };
  const pilot = setupEnginePilot(setup);

  const giottReal = pilot.state.addCard(pilot.you, 'Battlefield', {
    name: giottKingOfTheDwarves.name,
    types: ['Creature'],
    subtypes: ['Dwarf', 'Noble', 'Legendary'],
    basePower: giottKingOfTheDwarves.pt![0],
    baseToughness: giottKingOfTheDwarves.pt![1],
    keywords: giottKingOfTheDwarves.keywords,
  });
  pilot.log.push({ fn: 'enters', card: giottReal.name, zone: 'Battlefield', power: giottReal.basePower, toughness: giottReal.baseToughness });

  // Stiltzkin, Moogle Merchant — a real FIN 1/2 (its own real Lifelink and
  // control-swap activated ability never come into play here). 2 toughness —
  // Giott's single-pass power (1) alone is NOT lethal; only Double Strike
  // dealing it TWICE (once per real 510.5 sub-step) adds up to the real
  // lethal total of 2.
  const blocker = pilot.state.addCard(pilot.opponents[0]!, 'Battlefield', { name: 'Stiltzkin, Moogle Merchant', types: ['Creature'], subtypes: ['Moogle', 'Legendary'], basePower: 1, baseToughness: 2 });
  pilot.log.push({ fn: 'enters', card: blocker.name, zone: 'Battlefield', power: blocker.basePower, toughness: blocker.baseToughness, controller: pilot.opponents[0]!.name });

  advanceToDeclareAttackersStep(pilot);
  pilotDeclareAttackers(pilot, [giottReal], `Declare ${giottKingOfTheDwarves.name} (Double Strike) as attacker`);
  advanceOneStep(pilot, 'Advance to Declare Blockers');
  pilotDeclareBlockers(pilot, [{ blocker, attacker: giottReal }], `Declare ${blocker.name} as blocker`);

  pilot.beginStep('Resolve combat damage — real Double Strike (510.5) two-pass damage');
  const beforeBlockerDamage = blocker.damageMarked ?? 0;
  const beforeGiottDamage = giottReal.damageMarked ?? 0;
  resolveCombatDamage(pilot.engine);
  const toBlocker = (blocker.damageMarked ?? 0) - beforeBlockerDamage;
  if (toBlocker > 0) pilot.log.push({ fn: 'dealDamage', source: giottReal.name, target: blocker.name, amount: toBlocker });
  const toGiott = (giottReal.damageMarked ?? 0) - beforeGiottDamage;
  if (toGiott > 0) pilot.log.push({ fn: 'dealDamage', source: blocker.name, target: giottReal.name, amount: toGiott });

  const sbaResult = checkStateBasedActions(pilot.state, pilot.engine.players);
  for (const destroyed of sbaResult.destroyed) {
    const controllerName = pilot.state.players.get(destroyed.controllerId)!.name;
    pilot.log.push({ fn: 'destroy', target: destroyed.name, controller: controllerName });
  }

  const result =
    `Real 510.5: Giott's Double Strike deals its 1 power in BOTH the first-strike AND the regular combat-damage sub-step — 2 total damage marked against a 2-toughness blocker, real-lethal (704.5g) only because of that second hit. A plain single-strike creature of the same power would have only ever dealt 1, non-lethal. Giott also takes the blocker's 1 power back in the regular sub-step (real-lethal to its own 1 toughness) — both destroyed.`;
  return finishEnginePilotTrace(pilot, setup, 'real engine playthrough: declare Double Strike attacker -> blocked -> real two-pass combat damage', result);
}

export function runEngineScenarios(): TraceResult[] {
  return [firstStrikeScenario(), doubleStrikeScenario()];
}
