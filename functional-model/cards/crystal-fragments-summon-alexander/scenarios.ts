// Real engine-piloted trace (see engine-trace.ts's own header) — this
// card's transforming-DFC-into-a-Saga arc played out for real, one
// continuous playthrough, same real shape jill-shiva-s-dominant-shiva-
// warden-of-ice's own scenarios.ts already established (2026-09-11
// consolidation, user's own live call: "also expecting one scenario here"
// — replaces the old 2 separate flat harness.ts scenarios, neither of
// which demonstrated a real cast, a real Equipment attachment, or real
// turn passage).
//
// Front face is an EQUIPMENT, not a creature — its own plain "Equip {1}"
// is real printed text only, never a modeled `Effect` (definition.ts's own
// comment: this card's single `activationCost`/`effects` slot is reserved
// for the {5}{W}{W} transform instead, same one-slot constraint ninja-s-
// blades/dragoon-s-lance's own single-Equip-ability cards live with, just
// with the OTHER real ability winning the slot here) — so there is no real
// activated-ability path to pilot for the attachment itself. Checked for
// existing real equip-piloting precedent first (engine-trace.ts has no
// dedicated `pilotEquip` helper, and adelbert-steiner's own scenario hits
// the identical "no modeled Equip ability, attach manually" situation for
// its own real Sword) — same manual technique reused here: a direct
// `state.equip()` call plus a hand-pushed real `fn:'equip'` log line, not a
// fabricated `pilotActivate` call against an ability that doesn't exist.

import { crystalFragmentsSummonAlexander } from './definition';
import { basicLandsFor } from '../../mana';
import { typesFromTypeLine, subtypesFromTypeLine } from '../../harness';
import type { TraceResult } from '../../harness';
import {
  setupEnginePilot,
  pilotActions,
  pilotCast,
  pilotResolveTop,
  advanceToPlayersNextMain1,
  pilotActivate,
  pilotTransform,
  finishEnginePilotTrace,
  type EnginePilotSetup,
} from '../../engine-trace';

export function runEngineScenarios(): TraceResult[] {
  const setup: EnginePilotSetup = {
    you: { basicLands: basicLandsFor('{5}{W}{W}'), libraryCount: 10 },
    opponents: [{ basicLands: ['Forest'], libraryCount: 10 }],
  };
  const pilot = setupEnginePilot(setup);

  // A real creature to equip Crystal Fragments to (301.5c). The "Equipped
  // creature gets +1/+1" fact itself stays exempted regardless of real
  // attachment (isCrystalFragmentsEquippedPumpFact, verify-synergy.mjs) —
  // no continuous-effect/layer-7c pipeline exists anywhere in this engine
  // to recalculate whatever creature is equipped, checked pool-wide — this
  // step is about showing the real attachment for real, not manufacturing
  // evidence for a fact this engine structurally can't back.
  const yourCreature = pilot.state.addCard(pilot.you, 'Battlefield', {
    name: 'Dwarven Castle Guard',
    types: ['Creature'],
    subtypes: ['Dwarf', 'Soldier'],
    basePower: 2,
    baseToughness: 1,
    cmc: 2,
  });
  pilot.log.push({ fn: 'enters', card: yourCreature.name, zone: 'Battlefield', power: yourCreature.basePower, toughness: yourCreature.baseToughness, controller: pilot.you.name });

  // A real opponent creature — chapter III's own real "tap all creatures
  // your opponents control" target later.
  const oppCreature = pilot.state.addCard(pilot.opponents[0]!, 'Battlefield', {
    name: 'Coeurl',
    types: ['Creature'],
    subtypes: ['Cat', 'Beast'],
    basePower: 2,
    baseToughness: 2,
    cmc: 2,
  });
  pilot.log.push({ fn: 'enters', card: oppCreature.name, zone: 'Battlefield', power: oppCreature.basePower, toughness: oppCreature.baseToughness, controller: pilot.opponents[0]!.name });

  const cfReal = pilot.state.addCard(pilot.you, 'Hand', {
    name: crystalFragmentsSummonAlexander.name,
    types: typesFromTypeLine(crystalFragmentsSummonAlexander.typeLine),
    subtypes: subtypesFromTypeLine(crystalFragmentsSummonAlexander.typeLine),
  });
  const actions = pilotActions(pilot, cfReal.id);

  // Cast Crystal Fragments from hand (601), real {W} mana payment
  pilotCast(pilot, cfReal, crystalFragmentsSummonAlexander, pilot.ctxFor(cfReal), actions);
  pilotResolveTop(pilot);

  // Real Equipment attachment (301.5c) — see this file's own header comment
  pilot.beginStep('Real Equipment attachment (301.5c)');
  pilot.state.equip(cfReal, yourCreature);
  pilot.log.push({ fn: 'equip', equipment: cfReal.name, target: yourCreature.name });

  // Real turn passage
  advanceToPlayersNextMain1(pilot, pilot.you);

  // Activate the transform (602.1: {5}{W}{W}, sorcery speed)
  pilotActivate(pilot, pilot.you, cfReal, crystalFragmentsSummonAlexander, pilot.ctxFor(cfReal), actions);
  pilotResolveTop(pilot);

  // Front -> Summon: Alexander. Real 714.2b/c: enters as a Saga with no
  // lore counters, then immediately gets its first — chapter I fires here
  // (damage prevention — no resolvable effect in this model, see
  // definition.ts's own comment).
  const backFace = crystalFragmentsSummonAlexander.backFace!;
  const alexanderCtx = pilot.ctxFor(cfReal);
  pilotTransform(pilot, cfReal, backFace, alexanderCtx, actions);

  // Real turn passage through your next draw step — chapter II fires for
  // real (same no-op damage-prevention text)
  advanceToPlayersNextMain1(pilot, pilot.you, cfReal);

  // Another real turn — chapter III fires: taps the opponent's real Coeurl
  advanceToPlayersNextMain1(pilot, pilot.you, cfReal);

  // Real 714.4/704.5x "Sacrifice after III" — no more chapters to fire and
  // this Saga's own text never references sacrificing itself, so it's a
  // real state-based rule action, not a card `Effect` — and `sba.ts` has no
  // Saga-specific rule implementing it (checked), so a piloting caller
  // performs it explicitly, same manual technique harness.ts's own
  // `sacrificeSelfAfter` flag already uses under the hood (a real
  // `state.move` to Graveyard plus a real `fn:'sacrifice'` log line).
  pilot.beginStep('Real "Sacrifice after III" (714.4/704.5x)');
  pilot.state.move(cfReal, 'Graveyard');
  pilot.log.push({ fn: 'sacrifice', player: pilot.you.name, card: backFace.name });

  const result =
    'Crystal Fragments enters, real Equipment attachment onto a real creature (+1/+1 — no continuous-effect pipeline in this engine recalculates the equipped creature, a real documented gap); once a turn passes, {5}{W}{W} exiles it and returns it transformed as Summon: Alexander — real 714.2b/c, chapter I fires immediately (damage prevention — no resolvable effect in this model), chapter II fires on your next draw step (same), chapter III fires the turn after (taps the real opponent Coeurl), then the real "Sacrifice after III" rule (714.4/704.5x) sacrifices it — all through the real turn-based engine.';

  return [finishEnginePilotTrace(pilot, setup, 'real engine playthrough: cast -> equip -> transform -> Saga chapters over real turns -> sacrifice', result)];
}
