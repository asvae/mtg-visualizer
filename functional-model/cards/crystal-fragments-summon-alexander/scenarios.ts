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
import { wrapCard, effectivePT } from '../../state';
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

  // A real creature to equip Crystal Fragments to (301.5c). "Equipped
  // creature gets +1/+1" is now real, executable machinery
  // (`continuousPTGrants`, ENGINE_GAPS.md gap #14's own follow-up, closed
  // 2026-09-12) — this step also demonstrates the recalculation for real
  // (see the `read:getNetPower` line right after the equip below), unlike
  // this shape's OTHER sibling cards (Dragoon's Lance/Machinist's Arsenal/
  // Paladin's Arms/White Mage's Staff/Sage's Nouliths), whose plain
  // `harness.ts` Scenario[] style structurally can't inject that read.
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
  pilot.beginStep('Equipment attachment (301.5c)');
  pilot.state.equip(cfReal, yourCreature);
  pilot.log.push({ fn: 'equip', equipment: cfReal.name, target: yourCreature.name });

  // Real proof the "+1/+1" continuousPTGrants bonus genuinely recalculates
  // (ENGINE_GAPS.md gap #14's own follow-up, closed 2026-09-12) — same
  // "manual CDA read" pattern adelbert-steiner's own `read:getNetPower` line
  // already established for its layer-7a CDA, reused here for a layer-7c
  // equip-broadcast grant instead: Dwarven Castle Guard's printed 2/1
  // becomes a live 3/2 the instant it's equipped, re-read from
  // `effectivePT`, not a fixed/timestamped delta.
  pilot.beginStep('Layer-7c recalculation — Equipped creature gets +1/+1');
  const [power, toughness] = effectivePT(pilot.state, yourCreature);
  pilot.log.push({ fn: 'read:getNetPower', card: yourCreature.name, power, toughness });

  // Real turn passage
  advanceToPlayersNextMain1(pilot, pilot.you);

  // Activate the transform (602.1: {5}{W}{W}, sorcery speed)
  pilotActivate(pilot, pilot.you, cfReal, crystalFragmentsSummonAlexander, pilot.ctxFor(cfReal), actions);
  pilotResolveTop(pilot);

  // Front -> Summon: Alexander. Real 714.2b/c: enters as a Saga with no
  // lore counters, then immediately gets its first — chapter I fires here,
  // now a real `grantKeywordAll` shield (ENGINE_GAPS.md gap #8, closed —
  // see definition.ts's own comment).
  const backFace = crystalFragmentsSummonAlexander.backFace!;
  const alexanderCtx = pilot.ctxFor(cfReal);
  pilotTransform(pilot, cfReal, backFace, alexanderCtx, actions);

  // Real proof the chapter I shield actually WORKS this turn — a 3-damage
  // hit against your own (equipped) creature is genuinely prevented
  // (`state.dealDamage`'s own 'DamagePrevention' check), not just a
  // granted-but-inert keyword. Real evidence: a `fn:'damagePrevented'` log
  // line, not `fn:'dealDamage'`.
  pilot.beginStep("Chapter I shield: a 3-damage hit against your own creature is prevented");
  actions.dealDamage(wrapCard(pilot.state, oppCreature), wrapCard(pilot.state, yourCreature), 3);

  // Real turn passage through your next draw step — chapter II fires for
  // real (same real damage-prevention shield, re-granted for THIS turn)
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
  pilot.beginStep('"Sacrifice after III" (714.4/704.5x)');
  pilot.state.move(cfReal, 'Graveyard');
  pilot.log.push({ fn: 'sacrifice', player: pilot.you.name, card: backFace.name });

  const result =
    'Crystal Fragments enters, Equipment attachment onto a creature recalculates its P/T live (a +1/+1 continuous grant, 2/1 becomes 3/2); once a turn passes, {5}{W}{W} exiles it and returns it transformed as Summon: Alexander — 714.2b/c, chapter I fires immediately, granting an all-damage-prevention shield to creatures you control this turn (a 3-damage hit against your own creature is prevented), chapter II fires on your next draw step (same shield, re-granted), chapter III fires the turn after (taps the opponent\'s Coeurl), then the "Sacrifice after III" rule (714.4/704.5x) sacrifices it — all through the turn-based engine.';

  return [finishEnginePilotTrace(pilot, setup, 'engine playthrough: cast -> equip -> transform -> Saga chapters over turns -> sacrifice', result)];
}
