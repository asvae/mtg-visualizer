// Real engine-piloted trace (see engine-trace.ts's own header). Neither
// onLifeGained nor onDies auto-fires in this engine — each real underlying
// event happens for real, then the matching trigger fires manually.

import { aerithGainsborough } from './definition';
import { basicLandsFor } from '../../mana';
import { checkStateBasedActions } from '../../sba';
import { effectivePT } from '../../state';
import type { TraceResult } from '../../harness';
import { resolveCombatDamage } from '../../engine';
import {
  setupEnginePilot,
  pilotActions,
  pilotCast,
  pilotResolveTop,
  advanceToPlayersNextMain1,
  advanceToDeclareAttackersStep,
  advanceOneStep,
  pilotDeclareAttackers,
  pilotDeclareBlockers,
  pilotFireTrigger,
  finishEnginePilotTrace,
  type EnginePilotSetup,
} from '../../engine-trace';

export function runEngineScenarios(): TraceResult[] {
  const setup: EnginePilotSetup = {
    you: { basicLands: basicLandsFor('{2}{W}'), libraryCount: 8 },
    opponents: [{ libraryCount: 8 }],
  };
  const pilot = setupEnginePilot(setup);

  const aerithReal = pilot.state.addCard(pilot.you, 'Hand', {
    name: aerithGainsborough.name,
    types: ['Creature'],
    subtypes: ['Human', 'Cleric', 'Legendary'],
    keywords: aerithGainsborough.keywords,
    basePower: 1,
    baseToughness: 3,
  });
  const otherLegend = pilot.state.addCard(pilot.you, 'Battlefield', {
    name: 'Bystander Legend',
    types: ['Creature'],
    subtypes: ['Legendary', 'Human'],
    basePower: 1,
    baseToughness: 1,
  });
  // A real `enters` entry for each bystander — without one, it never shows
  // up on the replay board at all until (if ever) some LATER effect happens
  // to reference it by name, appearing out of nowhere at that point instead
  // of having been visibly present since setup.
  pilot.log.push({ fn: 'enters', card: otherLegend.name, zone: 'Battlefield', power: otherLegend.basePower, toughness: otherLegend.baseToughness });
  const bigBlocker = pilot.state.addCard(pilot.opponents[0]!, 'Battlefield', {
    name: 'Lethal Blocker',
    types: ['Creature'],
    // 4 power — Aerith is already 2/4 by the time this blocks (her earlier
    // onLifeGained put a real +1/+1 counter on her), so 3 wouldn't be real lethal.
    basePower: 4,
    baseToughness: 1,
  });
  pilot.log.push({
    fn: 'enters',
    card: bigBlocker.name,
    zone: 'Battlefield',
    power: bigBlocker.basePower,
    toughness: bigBlocker.baseToughness,
    controller: pilot.opponents[0]!.name,
  });
  const actions = pilotActions(pilot, aerithReal.id);
  const ctx = pilot.ctxFor(aerithReal);

  // Cast Aerith ({2}{W}), real mana payment
  pilotCast(pilot, aerithReal, aerithGainsborough, ctx, actions);
  pilotResolveTop(pilot);

  // Real turn passage — summoning sickness clears
  advanceToPlayersNextMain1(pilot, pilot.you);

  // Real unblocked combat — real Lifelink life gain, then onLifeGained fired manually
  advanceToDeclareAttackersStep(pilot);
  pilotDeclareAttackers(pilot, [aerithReal], 'Declare Aerith as attacker');
  advanceOneStep(pilot);
  pilotDeclareBlockers(pilot, []);
  pilot.beginStep('Resolve unblocked combat damage — real Lifelink');
  const opp = pilot.opponents[0]!;
  const beforeOppLife = opp.life;
  const beforeYouLife = pilot.you.life;
  resolveCombatDamage(pilot.engine);
  // The real combat damage itself (509/510) — not just its Lifelink side
  // effect. Without this, the replay only ever showed the life GAIN with no
  // visible cause on the opponent's side (confirmed the hard way: looked
  // like Aerith "did nothing" even though she just hit face for 2).
  const damageDealt = beforeOppLife - opp.life;
  if (damageDealt > 0) pilot.log.push({ fn: 'dealDamage', source: aerithReal.name, target: opp.name, amount: damageDealt });
  const lifeGained = pilot.you.life - beforeYouLife;
  if (lifeGained > 0) pilot.log.push({ fn: 'gainLife', player: pilot.you.name, amount: lifeGained, cause: 'Lifelink' });
  pilotFireTrigger(pilot, aerithGainsborough, ctx, actions, 'onLifeGained');

  // Real turn passage, then real combat again — this time blocked and lethal (704.5g SBA)
  advanceToPlayersNextMain1(pilot, pilot.you);
  advanceToDeclareAttackersStep(pilot);
  pilotDeclareAttackers(pilot, [aerithReal], 'Declare Aerith as attacker (blocked this time)');
  advanceOneStep(pilot);
  pilotDeclareBlockers(pilot, [{ blocker: bigBlocker, attacker: aerithReal }]);
  pilot.beginStep('Resolve lethal combat damage (704.5g SBA)');
  // Real 510.1c — both combatants deal damage simultaneously. Read power
  // BEFORE it resolves (damage itself never changes power, but reading
  // after would be one step removed from what actually caused it).
  const aerithPower = effectivePT(pilot.state, aerithReal)[0];
  const blockerPower = effectivePT(pilot.state, bigBlocker)[0];
  resolveCombatDamage(pilot.engine);
  if (aerithPower > 0) pilot.log.push({ fn: 'dealDamage', source: aerithReal.name, target: bigBlocker.name, amount: aerithPower });
  if (blockerPower > 0) pilot.log.push({ fn: 'dealDamage', source: bigBlocker.name, target: aerithReal.name, amount: blockerPower });
  // Real 400.7 wipes counters on zone change — capture this before SBA
  // moves her to the graveyard, so onDies's own "X = counters on this" read
  // has real 603.10 last-known-information to restore, not an already-zeroed count.
  const lastKnownCounters = aerithReal.counters['+1/+1'] ?? 0;
  const sbaResult = checkStateBasedActions(pilot.state, pilot.engine.players);
  // `destroyed`'s own real controller (704.5g can kill EITHER combatant) —
  // hardcoding `pilot.you.name` here was wrong for Lethal Blocker (opp0's
  // own creature), and verify-synergy.mjs's own `sideOf` trusts a present
  // `controller` field over any name-based guessing, so a wrong one here
  // would misattribute which SIDE this destroy fact supports.
  for (const destroyed of sbaResult.destroyed) {
    const controllerName = pilot.state.players.get(destroyed.controllerId)!.name;
    pilot.log.push({ fn: 'destroy', target: destroyed.name, controller: controllerName });
  }

  if (aerithReal.zone === 'Graveyard') {
    aerithReal.counters['+1/+1'] = lastKnownCounters;
    pilotFireTrigger(pilot, aerithGainsborough, ctx, actions, 'onDies');
  }

  const result =
    'Aerith enters; real turn passage clears summoning sickness, then attacks unblocked, gaining real Lifelink life — onLifeGained fires manually, putting a real +1/+1 counter on herself; another real turn later she attacks again, blocked by a creature that deals real lethal damage back (a genuine 704.5g SBA destruction) — onDies then fires manually, spreading X real +1/+1 counters onto the other legendary creature on the battlefield.';
  return [finishEnginePilotTrace(pilot, setup, 'real engine playthrough: cast -> real Lifelink -> onLifeGained -> real lethal combat (SBA) -> onDies', result)];
}
