// Real engine-piloted trace (see engine-trace.ts's own header) — same
// shape summon-bahamut's own scenario already establishes for a plain
// (non-transforming) Saga: real mana payment, real turn passage, real
// Saga lore-counter automation (saga.ts) firing each chapter for real.

import { summonShiva } from './definition';
import { basicLandsFor } from '../../mana';
import type { TraceResult } from '../../harness';
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
  pilotResolveCombatDamage,
  finishEnginePilotTrace,
  type EnginePilotSetup,
} from '../../engine-trace';

function scenarioA(): TraceResult {
  const setup: EnginePilotSetup = {
    you: { libraryCount: 15, basicLands: basicLandsFor('{3}{U}{U}') },
    opponents: [{ libraryCount: 10 }],
  };
  const pilot = setupEnginePilot(setup);

  // Two real, non-token opponent creatures (data/fin/fin_scryfall.json) —
  // one for chapter I's Heavenly Strike, a second for chapter II's own, so
  // chapter III's own real tapped-creature count reads off two distinct
  // creatures, not the same one twice.
  const coeurl = pilot.state.addCard(pilot.opponents[0]!, 'Battlefield', { name: 'Coeurl', types: ['Creature'], subtypes: ['Cat', 'Beast'], basePower: 2, baseToughness: 2, cmc: 2 });
  pilot.log.push({ fn: 'enters', card: coeurl.name, zone: 'Battlefield', power: coeurl.basePower, toughness: coeurl.baseToughness, controller: pilot.opponents[0]!.name });
  const hillGigas = pilot.state.addCard(pilot.opponents[0]!, 'Battlefield', { name: 'Hill Gigas', types: ['Creature'], subtypes: ['Giant'], basePower: 5, baseToughness: 4, cmc: 6 });
  pilot.log.push({ fn: 'enters', card: hillGigas.name, zone: 'Battlefield', power: hillGigas.basePower, toughness: hillGigas.baseToughness, controller: pilot.opponents[0]!.name });

  const shivaReal = pilot.state.addCard(pilot.you, 'Hand', {
    name: summonShiva.name,
    types: ['Creature', 'Enchantment'],
    subtypes: ['Saga', 'Elemental'],
    basePower: summonShiva.pt?.[0],
    baseToughness: summonShiva.pt?.[1],
  });
  const actions = pilotActions(pilot, shivaReal.id);
  // Chapter I prefers Coeurl over Hill Gigas — a real player choice among
  // two legal opponent-controlled creature targets, same `preferTarget`
  // mechanism summon-bahamut's own scenario uses for its own chapter I/II
  // target choice.
  const ctx = pilot.ctxFor(shivaReal, { preferTarget: (c) => c.getName() === 'Coeurl' });

  // Cast Shiva ({3}{U}{U}), real mana payment
  pilotCast(pilot, shivaReal, summonShiva, ctx, actions);
  // Resolves; real 714.2b/c fires chapter I immediately — taps Coeurl and
  // puts a stun counter on it
  pilotResolveTop(pilot);

  // Chapter II should hit the OTHER opponent creature, not re-tap Coeurl —
  // a real, distinct player choice each chapter (same "mutate the shared,
  // registered ctx between chapter advances" technique summon-bahamut's
  // own `ctx.declineOptional` mutation between chapters establishes —
  // saga.ts's `advanceSaga` always fires a later chapter's trigger against
  // the SAME registered `ctx`, so a later mutation is genuinely visible).
  ctx.preferTarget = (c) => c.getName() === 'Hill Gigas';

  // Real turn passage — chapter II fires on your next draw step, taps Hill
  // Gigas and puts a stun counter on it. Coeurl's OWN stun counter is
  // consumed (not removed by a real untap — the real stun replacement
  // effect, Ice Flan/Tonberry's own precedent) during the opponent's
  // intervening untap step along the way, so Coeurl stays tapped through
  // this whole wait too, but is left with no counter left afterward.
  advanceToPlayersNextMain1(pilot, pilot.you, shivaReal);

  // Real turn passage to the OPPONENT's own next turn (508.1: only the
  // active player declares attackers). Their own untap step here is
  // Coeurl's SECOND real untap opportunity since chapter I stunned it —
  // its counter is already gone (consumed above), so it genuinely untaps
  // for real this time; Hill Gigas's own stun counter (only one untap step
  // old) is consumed here instead, so IT stays tapped.
  advanceToPlayersNextMain1(pilot, pilot.opponents[0]!);
  advanceToDeclareAttackersStep(pilot);
  // A real, independent tap: the opponent attacks with the now-untapped
  // Coeurl (302.6: no summoning sickness — it's been under its
  // controller's continuous control since the start of this game). This
  // is what actually keeps a SECOND creature tapped all the way to chapter
  // III below — Coeurl's own stun counter alone would have worn off by
  // now (only one stun ever delays exactly one untap), same real Saga
  // clockwork (I -> III is two of the opponent's own untap steps; II -> III
  // is only one) that makes chapter I's own stunned target normally shed
  // its counter and untap again before chapter III ever fires.
  pilotDeclareAttackers(pilot, [coeurl]);
  advanceOneStep(pilot); // -> Declare Blockers
  // You decline to block with Shiva (2 damage is not worth risking it, and
  // it isn't the point of this demonstration either way — Coeurl attacking
  // unblocked is what taps it, not what it deals).
  pilotDeclareBlockers(pilot, []);
  // Real 510 combat damage — Coeurl deals its 2 unblocked to you.
  pilotResolveCombatDamage(pilot);

  // Another real turn passage back to your own Main1 — chapter III fires:
  // draws a card for each tapped creature the opponent controls. Neither
  // Coeurl (tapped from attacking, no untap step of the opponent's own
  // happens on YOUR turn) nor Hill Gigas (tapped via its own still-active
  // stun counter) has had a chance to untap since, so this is a real,
  // live-counted 2 — not a hardcoded amount. This is also the Saga's
  // greatest chapter (III), so 714.4 sacrifices it right after, since
  // nothing reset its lore counters first.
  advanceToPlayersNextMain1(pilot, pilot.you, shivaReal);
  if (shivaReal.zone === 'Graveyard') {
    pilot.beginStep('714.4 sacrifice — lore counters were never reset');
    pilot.log.push({ fn: 'sacrifice', player: pilot.you.name, card: summonShiva.name });
  }

  const result =
    "Shiva enters, chapter I fires (714.2b) — taps the opponent's Coeurl and puts a stun counter on it; chapter II fires next turn — taps the opponent's Hill Gigas and puts a stun counter on it too. Coeurl's own stun counter wears off two turns later (a stun counter only delays ONE untap), so the opponent attacks with it once it's untapped again — which taps it right back, independent of the Saga; Hill Gigas, stunned more recently, is still held tapped by its own counter. By chapter III, both are tapped — a live-counted 2, not a hardcoded amount — so Diamond Dust draws two cards; Shiva is then sacrificed (714.4) since nothing reset its lore counters first.";
  return finishEnginePilotTrace(
    pilot,
    setup,
    'engine playthrough: cast -> Saga chapters over turns -> stun-counter timing + an attack keep two creatures tapped for chapter III',
    result
  );
}

export function runEngineScenarios(): TraceResult[] {
  return [scenarioA()];
}
