// Real engine-piloted trace (see engine-trace.ts's own header). "Attacking
// creatures get +2/+0 until end of turn" used to be an intentional
// `kind:'custom'` no-op (this file's own prior comment: "no combat-attacker-
// state tracked in this model") — now stale. REAL as of 2026-09-15
// (ENGINE_GAPS.md closure — see definition.ts's own comment for the full
// 3-piece writeup: `Card.isAttacking()`/`GameState.attackers`, `pumpAll`'s
// own `predicate:'attacking-creatures'`, and
// `recognizers/pumpAllAttacking-effect-structural.ts`). This scenario
// replaces the old bare cast-and-resolve-as-no-op playthrough with a real
// declared attacker (`pilotDeclareAttackers`) plus a real non-attacking
// creature you control, so the "attacking," not "creatures you control,"
// scope has genuine `effectivePT` before/after evidence on BOTH sides, not
// just a described no-op. Flashback is demonstrated separately, unchanged
// from before (2026-09-11) — `canCastSpell`/`castSpell`/`pilotCast` gained a
// real, narrow alternate-cost path (ENGINE_GAPS.md gap #7, narrowed) for
// exactly this shape: a fixed replacement mana cost, paid from the
// graveyard, `thenExile` on resolution.
//
// RESOLVED (2026-09-16, engine-core): `scripts/verify-synergy.mjs`'s own
// `isAuronsInspirationBroadcastPumpFact` exemption — which used to
// document this exact effect as "no possible trace evidence... without
// first building that missing cross-cutting engine surface" — has been
// retired for real (not just left as now-dead-but-harmless code): this
// scenario's own real `{fn:'pump', target:'Coeurl', ...}` trace line is
// now ordinary, unexempted evidence, same as any other `pump` fact.

import { auronSInspiration } from './definition';
import { basicLandsFor } from '../../mana';
import { GENERIC_FILLER_CREATURE } from '../../harness';
import { effectivePT } from '../../state';
import type { TraceResult } from '../../harness';
import {
  setupEnginePilot,
  pilotActions,
  pilotCast,
  pilotResolveTop,
  pilotDeclareAttackers,
  advanceToDeclareAttackersStep,
  finishEnginePilotTrace,
  type EnginePilotSetup,
} from '../../engine-trace';

function normalCastDuringCombat(): TraceResult {
  // `libraryCount` set (unlike the pre-migration version of this scenario,
  // which never advanced past its own single cast+resolve and so never hit
  // this) — advancing into the Declare Attackers step below runs a real
  // 704.5a state-based check, which would otherwise catch this player
  // having already drawn from an empty library during setup's own real
  // Draw step and end the game before combat is ever reached.
  const setup: EnginePilotSetup = { you: { basicLands: basicLandsFor('{2}{W}'), libraryCount: 8 } };
  const pilot = setupEnginePilot(setup);
  const cardReal = pilot.state.addCard(pilot.you, 'Hand', { name: auronSInspiration.name, types: [] });
  const actions = pilotActions(pilot, cardReal.id);
  const ctx = pilot.ctxFor(cardReal);

  // Two real, already-on-the-battlefield creatures (added directly, not
  // through the real resolution path, so neither gets an `enteredThisTurn`
  // stamp — same "already there, legal to attack right away" convention
  // sage-s-nouliths' own scenario establishes for the identical
  // `GENERIC_FILLER_CREATURE`): Coeurl attacks, Grizzly Bears stays home, so
  // the real "attacking," not "you control," scope has a genuine contrast.
  pilot.beginStep(`Coeurl and ${GENERIC_FILLER_CREATURE} already on the battlefield`);
  const attacker = pilot.state.addCard(pilot.you, 'Battlefield', { name: 'Coeurl', types: ['Creature'], subtypes: ['Cat', 'Beast'], basePower: 2, baseToughness: 2, cmc: 3 });
  pilot.log.push({ fn: 'enters', card: attacker.name, zone: 'Battlefield', power: attacker.basePower, toughness: attacker.baseToughness, controller: pilot.you.name });
  const stayHome = pilot.state.addCard(pilot.you, 'Battlefield', { name: GENERIC_FILLER_CREATURE, types: ['Creature'], subtypes: ['Bear'], basePower: 2, baseToughness: 2, cmc: 2 });
  pilot.log.push({ fn: 'enters', card: stayHome.name, zone: 'Battlefield', power: stayHome.basePower, toughness: stayHome.baseToughness, controller: pilot.you.name });

  // Real 508.1a attacker declaration — only Coeurl attacks.
  advanceToDeclareAttackersStep(pilot);
  pilotDeclareAttackers(pilot, [attacker]);

  const [attackerPowerBefore] = effectivePT(pilot.state, attacker);
  const [stayHomePowerBefore] = effectivePT(pilot.state, stayHome);

  // Cast Auron's Inspiration ({2}{W}) at instant speed during combat, real
  // mana payment; resolving it broadcasts +2/+0 to every attacking creature
  // (both players' — card.ts's own `pumpAll` `predicate:'attacking-
  // creatures'` doc comment), which here is only Coeurl.
  pilotCast(pilot, cardReal, auronSInspiration, ctx, actions);
  pilotResolveTop(pilot);

  const [attackerPowerAfter] = effectivePT(pilot.state, attacker);
  const [stayHomePowerAfter] = effectivePT(pilot.state, stayHome);
  if (attackerPowerAfter !== attackerPowerBefore + 2) {
    throw new Error(`expected Coeurl's power to genuinely recalculate to ${attackerPowerBefore + 2}, got ${attackerPowerAfter}`);
  }
  if (stayHomePowerAfter !== stayHomePowerBefore) {
    throw new Error(`expected ${GENERIC_FILLER_CREATURE}'s power to stay unchanged (not attacking), got ${stayHomePowerAfter} (was ${stayHomePowerBefore})`);
  }

  const result =
    `Auron's Inspiration is cast from hand at instant speed during combat and resolves ({2}{W} paid) — real layer-7a effectivePT genuinely recalculates Coeurl (the only real declared attacker) from ${attackerPowerBefore}/${attacker.baseToughness} to ${attackerPowerAfter}/${attacker.baseToughness} (+2/+0 until end of turn), while ${GENERIC_FILLER_CREATURE} (a real creature you control that did NOT attack) stays unchanged at ${stayHomePowerAfter}/${stayHome.baseToughness} — the real "attacking creatures," not "creatures you control," scope. Auron's Inspiration then goes to the graveyard (no alternate cost paid, so no thenExile).`;
  return finishEnginePilotTrace(
    pilot,
    setup,
    'engine playthrough: real attacker declared -> cast from hand during combat -> resolve (pumps only the attacker) -> graveyard',
    result,
  );
}

function flashbackCast(): TraceResult {
  const flashback = auronSInspiration.alternateCosts!.find((c) => c.name === 'Flashback')!;
  const setup: EnginePilotSetup = { you: { basicLands: basicLandsFor(flashback.cost) } };
  const pilot = setupEnginePilot(setup);
  // Starts in the graveyard, not hand — a real prior discard/mill/whatever
  // put it there; this scenario is about the flashback cast itself, not how
  // it got to the graveyard.
  const cardReal = pilot.state.addCard(pilot.you, 'Graveyard', { name: auronSInspiration.name, types: [] });
  const actions = pilotActions(pilot, cardReal.id);
  const ctx = pilot.ctxFor(cardReal);

  // Cast via Flashback ({2}{W}{W} from the graveyard), real mana payment.
  // No attacker declared this time — the pump's own scope is already
  // demonstrated above; this scenario is specifically about the alternate
  // cost / thenExile lifecycle, so its own pump resolves as a genuine
  // real-mechanism no-op (no attacking creatures to affect this combat),
  // not the old documented-inert kind.
  pilotCast(pilot, cardReal, auronSInspiration, ctx, actions, undefined, flashback);
  // Resolves, then exiled instead of returning to the graveyard (thenExile, CR 702.32).
  pilotResolveTop(pilot);

  const result =
    "Auron's Inspiration is cast from the graveyard via Flashback ({2}{W}{W} paid instead of {2}{W}) and resolves, then is exiled instead of returning to the graveyard (its own \"Then exile it\" clause); no creature is attacking in this combat, so its real \"attacking creatures get +2/+0\" broadcast has nothing to affect this time (the pump-scope playthrough above already demonstrates the real mechanism live).";
  return finishEnginePilotTrace(pilot, setup, 'engine playthrough: Flashback cast from graveyard -> resolve -> exile', result);
}

export function runEngineScenarios(): TraceResult[] {
  return [normalCastDuringCombat(), flashbackCast()];
}
