// Real engine-piloted trace (see engine-trace.ts's own header). Neither
// onLifeGained nor onDies auto-fires in this engine — each real underlying
// event happens for real, then the matching trigger fires manually.

import { aerithGainsborough } from './definition';
import { basicLandsFor } from '../../mana';
import { checkStateBasedActions } from '../../sba';
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
  const bigBlocker = pilot.state.addCard(pilot.opponents[0]!, 'Battlefield', {
    name: 'Lethal Blocker',
    types: ['Creature'],
    // 4 power — Aerith is already 2/4 by the time this blocks (her earlier
    // onLifeGained put a real +1/+1 counter on her), so 3 wouldn't be real lethal.
    basePower: 4,
    baseToughness: 1,
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
  const beforeYouLife = pilot.you.life;
  resolveCombatDamage(pilot.engine);
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
  resolveCombatDamage(pilot.engine);
  // Real 400.7 wipes counters on zone change — capture this before SBA
  // moves her to the graveyard, so onDies's own "X = counters on this" read
  // has real 603.10 last-known-information to restore, not an already-zeroed count.
  const lastKnownCounters = aerithReal.counters['+1/+1'] ?? 0;
  const sbaResult = checkStateBasedActions(pilot.state, pilot.engine.players);
  for (const destroyed of sbaResult.destroyed) pilot.log.push({ fn: 'destroy', target: destroyed.name, controller: pilot.you.name });

  if (aerithReal.zone === 'Graveyard') {
    aerithReal.counters['+1/+1'] = lastKnownCounters;
    pilotFireTrigger(pilot, aerithGainsborough, ctx, actions, 'onDies');
  }

  const result =
    'Aerith enters; real turn passage clears summoning sickness, then attacks unblocked, gaining real Lifelink life — onLifeGained fires manually, putting a real +1/+1 counter on herself; another real turn later she attacks again, blocked by a creature that deals real lethal damage back (a genuine 704.5g SBA destruction) — onDies then fires manually, spreading X real +1/+1 counters onto the other legendary creature on the battlefield.';
  return [finishEnginePilotTrace(pilot, setup, 'real engine playthrough: cast -> real Lifelink -> onLifeGained -> real lethal combat (SBA) -> onDies', result)];
}
