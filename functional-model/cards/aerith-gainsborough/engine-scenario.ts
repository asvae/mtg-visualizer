// Real engine-piloted trace for this card (see engine-trace.ts's own
// header). Neither `onLifeGained` nor `onDies` has an auto-fire mechanism
// in `engine.ts` (`Trigger.on` only recognizes `'enter'|'upkeep'|'endStep'`
// — a real, accepted gap, same as Ultima's own `onAttack`) — so this
// causes each real underlying MTG event through the engine for real (real
// Lifelink combat damage; a real lethal combat trade, resolved via
// `sba.ts`'s own real 704.5g state-based action), then fires the matching
// trigger manually right after, same documented convention as Ultima's own
// pilot. The interesting real consequence: X in `onDies`'s "put X +1/+1
// counters... where X is the number of +1/+1 counters on this" isn't
// hardcoded here — it's whatever `ctx.self.getCounters('+1/+1')` actually
// reads back, genuinely reflecting the real counter Aerith's own earlier
// `onLifeGained` firing put on her.

import { aerithGainsborough } from './definition';
import { basicLandsFor } from '../../mana';
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
  pilotFireTrigger,
  finishEnginePilotTrace,
  type EnginePilotSetup,
} from '../../engine-trace';

export function runEngineScenarios(): TraceResult[] {
  const setup: EnginePilotSetup = {
    // Both players need a real library — this scenario crosses two full
    // real turns (real 704.5a, sba.ts, genuinely loses the game for
    // whoever's instructed to draw with none left).
    you: { basicLands: basicLandsFor('{2}{W}'), libraryCount: 8 },
    // A real defending player, whose real lethal blocker is added directly
    // below (a second real legendary creature is also added directly to
    // `you`'s own battlefield below, for `onDies`'s own counter spread).
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
    // 4 power, not 3 — by the time this blocks, Aerith already carries the
    // real +1/+1 counter her earlier `onLifeGained` fire actually put on
    // her (1/3 -> 2/4), so 3 power alone is no longer real lethal (found
    // the hard way: an earlier version of this pilot used 3 and Aerith
    // just... didn't die, silently breaking every onDies-shaped want fact).
    basePower: 4,
    baseToughness: 1, // dies to a single real point back from Aerith too, but only Aerith's own death matters here
  });
  const actions = pilotActions(pilot, aerithReal.id);
  const ctx = pilot.ctxFor(aerithReal);

  // --- Cast Aerith ({2}{W}), real mana payment ---
  pilotCast(pilot, aerithReal, aerithGainsborough, ctx, actions);
  // --- Resolves onto the battlefield (no ETB trigger declared) ---
  pilotResolveTop(pilot);

  // --- Real turn passage — summoning sickness (302.6) genuinely clears ---
  advanceToPlayersNextMain1(pilot, pilot.you);

  // --- Real, UNBLOCKED combat first — genuine Lifelink life gain (real
  // 702.15e via state.dealDamage), then `onLifeGained` fired manually. ---
  advanceToDeclareAttackersStep(pilot);
  let attack = declareAttackers(pilot.engine, [aerithReal]);
  if (!attack.ok) throw new Error(`attack illegal: ${attack.reason}`);
  pilot.log.push({ fn: 'attack', card: aerithReal.name });
  advanceOneStep(pilot); // -> CombatDeclareBlockers
  declareBlockers(pilot.engine, []);
  const beforeYouLife = pilot.you.life;
  resolveCombatDamage(pilot.engine);
  const lifeGained = pilot.you.life - beforeYouLife;
  if (lifeGained > 0) pilot.log.push({ fn: 'gainLife', player: pilot.you.name, amount: lifeGained, cause: 'Lifelink' });
  pilotFireTrigger(pilot, aerithGainsborough, ctx, actions, 'onLifeGained');

  // --- Real turn passage back to your own next Main1, then real combat
  // again — this time BLOCKED by a creature that deals lethal damage back,
  // a real 704.5g state-based destruction (`sba.ts`), NOT a scripted death. ---
  advanceToPlayersNextMain1(pilot, pilot.you);
  advanceToDeclareAttackersStep(pilot);
  attack = declareAttackers(pilot.engine, [aerithReal]);
  if (!attack.ok) throw new Error(`attack illegal: ${attack.reason}`);
  pilot.log.push({ fn: 'attack', card: aerithReal.name });
  advanceOneStep(pilot); // -> CombatDeclareBlockers
  declareBlockers(pilot.engine, [{ blocker: bigBlocker, attacker: aerithReal }]);
  pilot.log.push({ fn: 'block', blocker: bigBlocker.name, attacker: aerithReal.name });
  resolveCombatDamage(pilot.engine);
  // Real 400.7 (state.ts's own `moveTo`) wipes counters the instant an
  // object changes zones — captured here, BEFORE `checkStateBasedActions`
  // actually moves her to the graveyard and erases them for real, so
  // `onDies`'s own real "last known information" read (603.10 — a
  // leaves-the-battlefield trigger sees the object as it was immediately
  // before it left) has the real value to restore, not a live read of an
  // already-zeroed-out counter.
  const lastKnownCounters = aerithReal.counters['+1/+1'] ?? 0;
  const sbaResult = checkStateBasedActions(pilot.state, pilot.engine.players);
  for (const destroyed of sbaResult.destroyed) pilot.log.push({ fn: 'destroy', target: destroyed.name, controller: pilot.you.name });

  // --- `onDies` fired manually — X is whatever Aerith's own real
  // +1/+1-counter count was the instant before she died (603.10 LKI,
  // restored just above real 400.7's own zone-change wipe), read back
  // live, not hardcoded. ---
  if (aerithReal.zone === 'Graveyard') {
    aerithReal.counters['+1/+1'] = lastKnownCounters;
    pilotFireTrigger(pilot, aerithGainsborough, ctx, actions, 'onDies');
  }

  const result =
    'Aerith enters; real turn passage clears summoning sickness, then attacks unblocked, gaining real Lifelink life (702.15e) — `onLifeGained` is fired manually right after (a real event, no auto-fire wiring yet, same accepted gap as Ultima\'s own `onAttack`), putting a real +1/+1 counter on herself; another real turn later she attacks again, this time blocked by a creature that deals real lethal damage back — a genuine 704.5g state-based destruction (sba.ts), not a scripted death — after which `onDies` fires manually, spreading X real +1/+1 counters (X = however many she actually had, read live, not hardcoded) onto the other real legendary creature on the battlefield.';
  return [finishEnginePilotTrace(pilot, setup, 'real engine playthrough: cast -> real Lifelink -> onLifeGained -> real lethal combat (SBA) -> onDies', result)];
}
