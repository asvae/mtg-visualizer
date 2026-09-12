// Real engine-piloted trace (see engine-trace.ts's own header). Two real
// scenarios, per an explicit user request to cover both real branches of
// this card's own cost-reduction CONDITION — "This spell costs {2} less
// to cast if it targets a tapped creature" genuinely depends on real
// board state (the chosen target's tapped-ness at cast time), a real
// difference in what actually gets PAID, not cosmetic variety (the
// standing "more than one scenario needs a real reason" bar).
//
// The discount is now REAL engine vocabulary (`card.ts`'s `CostReduction`,
// ENGINE_GAPS.md gap #7 — closed for this target-conditional shape):
// `engine.ts`'s `canCastSpell`/`castSpell` take an optional
// `declaredTarget` and genuinely discount `manaCost`'s generic portion
// when `costReduction.condition` holds against it. Both scenarios below
// pass the SAME real Coeurl as `declaredTarget` — only its real tapped
// state differs — so the contrast is mechanical, not scripted: scenario 1
// genuinely pays {2}{W} (2 fewer lands tapped for mana than scenario 2's
// full {4}{W}), proven by each scenario's own real `tapForMana` count in
// the log, not just the logged `cost` string. Scenario 1's target is
// tapped via a real 508.1f combat attack, not a synthetic flag flip.
// `basicLands` in both setups equals the FULL {4}{W} cost (never trimmed
// to the discounted amount) specifically so scenario 1's fewer-taps result
// is proof the discount actually reduced what was owed, not just that
// there happened to be less mana available.

import { fateOfTheSunCryst } from './definition';
import { basicLandsFor } from '../../mana';
import type { TraceResult } from '../../harness';
import {
  setupEnginePilot,
  pilotActions,
  pilotCast,
  pilotResolveTop,
  advanceToPlayersNextMain1,
  advanceToDeclareAttackersStep,
  pilotDeclareAttackers,
  finishEnginePilotTrace,
  type EnginePilotSetup,
} from '../../engine-trace';

// Coeurl (data/fin/fin_scryfall.json: {1}{W} Creature — Cat Beast, 2/2) —
// same real, non-token FIN card summon-bahamut's own scenario A and this
// card's prior single scenario both already use as a real destroy target
// (a token instead logs `ceasesToExist`, 111.7/704.5d, which can't back a
// real `event:'destroy'` ACT fact as trace evidence).

function destroysTappedAttacker(): TraceResult {
  // `libraryCount` on both sides — real turn passage below crosses a real
  // Draw step (yours, then the opponent's), and an empty-library draw is
  // a real 104.3c loss condition (`advance` throws once triggered) that a
  // 0-card default `libraryCount` would hit for real, not a fabricated
  // failure to work around.
  const setup: EnginePilotSetup = {
    you: { basicLands: basicLandsFor('{4}{W}'), libraryCount: 7 },
    opponents: [{ libraryCount: 7 }],
  };
  const pilot = setupEnginePilot(setup);

  // Added directly to the battlefield (not cast) — no `enteredThisTurn`
  // stamp, so it's already legal to attack the moment it's genuinely the
  // opponent's own turn, no extra turn-passage wait needed for real 302.6
  // summoning sickness on top of the turn-passage below.
  const oppCreature = pilot.state.addCard(pilot.opponents[0]!, 'Battlefield', { name: 'Coeurl', types: ['Creature'], subtypes: ['Cat', 'Beast'], basePower: 2, baseToughness: 2, cmc: 2 });
  pilot.log.push({ fn: 'enters', card: oppCreature.name, zone: 'Battlefield', power: oppCreature.basePower, toughness: oppCreature.baseToughness, controller: pilot.opponents[0]!.name });

  const cardReal = pilot.state.addCard(pilot.you, 'Hand', { name: fateOfTheSunCryst.name, types: [] });
  const actions = pilotActions(pilot, cardReal.id);
  // `preferTarget` pins resolution's own lazy `chooseTarget` to the SAME
  // real Coeurl `declaredTarget` names below for the cost check — real
  // 601.2b picks one real target for both purposes, this model just splits
  // "which target" into two separate reads (cast-time cost, resolution-time
  // effect) that must agree, not two independent choices.
  const ctx = pilot.ctxFor(cardReal, { preferTarget: (c) => c.getId() === oppCreature.id });

  // Real turn passage to the opponent's own Declare Attackers step — the
  // attacker has to genuinely be THEIR declared attacker on THEIR turn.
  // (`declareAttackers` itself doesn't check whose turn it is, but a real
  // opponent creature attacking during YOUR combat isn't a real line, so
  // this scenario doesn't take that engine-permissiveness shortcut.)
  advanceToPlayersNextMain1(pilot, pilot.opponents[0]!);
  advanceToDeclareAttackersStep(pilot);
  pilotDeclareAttackers(pilot, [oppCreature], 'Declare Coeurl as attacker');

  // The real 508.1f tap from attacking is what makes this card's own
  // "targets a tapped creature" condition genuinely true right now — you
  // (the non-active player) cast the instant in response, while Coeurl is
  // still tapped and still a declared attacker (an Instant can be cast at
  // any priority window, 601 — `canCastSpell` doesn't gate it to your own
  // main phase the way a sorcery-speed spell would). Passing `oppCreature`
  // as `declaredTarget` is what makes the real {2} discount actually apply
  // — `castSpell` genuinely pays {2}{W} here (3 lands tapped for mana, per
  // the log's own real `tapForMana` count), not the full printed {4}{W}.
  pilotCast(pilot, cardReal, fateOfTheSunCryst, ctx, actions, undefined, undefined, oppCreature);
  pilotResolveTop(pilot);

  const result =
    "Destroys the opponent's Coeurl while it's tapped (attacked and got tapped via 508.1f, still a declared attacker at the moment it's targeted) — the real condition this card's own \"costs {2} less to cast if it targets a tapped creature\" clause checks for. The discount IS mechanically applied here (`card.ts`'s `CostReduction`, ENGINE_GAPS.md gap #7 — closed for this shape): the `cast` log entry's own `cost` field reads {2}{W}, and only 3 real lands are tapped for mana (`tapForMana`), not the full printed {4}{W}/5 lands the other scenario below pays for the identical destroy effect against the same card, untapped.";
  return finishEnginePilotTrace(pilot, setup, 'real engine playthrough: opponent attacks (508.1f tap) -> cast (real {2} discount applies) targeting the tapped attacker -> resolve (Destroy target nonland permanent)', result);
}

function destroysUntappedCreature(): TraceResult {
  const setup: EnginePilotSetup = {
    you: { basicLands: basicLandsFor('{4}{W}') },
    opponents: [{}],
  };
  const pilot = setupEnginePilot(setup);

  const oppCreature = pilot.state.addCard(pilot.opponents[0]!, 'Battlefield', { name: 'Coeurl', types: ['Creature'], subtypes: ['Cat', 'Beast'], basePower: 2, baseToughness: 2, cmc: 2 });
  pilot.log.push({ fn: 'enters', card: oppCreature.name, zone: 'Battlefield', power: oppCreature.basePower, toughness: oppCreature.baseToughness, controller: pilot.opponents[0]!.name });

  const cardReal = pilot.state.addCard(pilot.you, 'Hand', { name: fateOfTheSunCryst.name, types: [] });
  const actions = pilotActions(pilot, cardReal.id);
  const ctx = pilot.ctxFor(cardReal, { preferTarget: (c) => c.getId() === oppCreature.id });

  // No combat, no tap — Coeurl sits on the battlefield genuinely untapped
  // (its own real, unchanged default state), the other real half of this
  // card's cost-reduction condition. Same real `oppCreature` passed as
  // `declaredTarget` as the other scenario — the ONLY difference is its
  // real tapped state, so `costReduction.condition` genuinely evaluates
  // false here and the full {4}{W} is paid (5 lands tapped for mana).
  pilotCast(pilot, cardReal, fateOfTheSunCryst, ctx, actions, undefined, undefined, oppCreature);
  pilotResolveTop(pilot);

  const result =
    "Destroys the opponent's Coeurl while it's untapped — the same destroy effect as the other scenario, but this card's own \"...if it targets a tapped creature\" condition genuinely evaluates false here, so the engine correctly pays the full printed {4}{W} (5 lands tapped for mana, per the log's own `tapForMana` count) rather than applying the discount — the same real `costReduction` check as the other scenario, just against an untapped target this time.";
  return finishEnginePilotTrace(pilot, setup, 'real engine playthrough: cast (no discount — untapped target) targeting an untapped creature -> resolve (Destroy target nonland permanent)', result);
}

// Real CR 608.2b "fizzle" (ENGINE_GAPS.md gap #4, closed 2026-09-12) — a
// THIRD real branch: this card's own single target genuinely BECOMES
// illegal between casting and resolution (real 601.2c/602.1 cast-time
// target-locking is what makes this demonstrable at all — `engine.ts`'s
// `castSpell` now records the SAME real `declaredTarget` passed below onto
// the pushed `StackObject`, not just onto `costReduction`'s condition
// check). Same real Coeurl this card's other two scenarios already use as
// a genuine, non-token destroy target.
function fizzlesWhenTargetDiesBeforeResolution(): TraceResult {
  const setup: EnginePilotSetup = {
    you: { basicLands: basicLandsFor('{4}{W}') },
    opponents: [{}],
  };
  const pilot = setupEnginePilot(setup);

  const oppCreature = pilot.state.addCard(pilot.opponents[0]!, 'Battlefield', { name: 'Coeurl', types: ['Creature'], subtypes: ['Cat', 'Beast'], basePower: 2, baseToughness: 2, cmc: 2 });
  pilot.log.push({ fn: 'enters', card: oppCreature.name, zone: 'Battlefield', power: oppCreature.basePower, toughness: oppCreature.baseToughness, controller: pilot.opponents[0]!.name });

  const cardReal = pilot.state.addCard(pilot.you, 'Hand', { name: fateOfTheSunCryst.name, types: [] });
  const actions = pilotActions(pilot, cardReal.id);
  const ctx = pilot.ctxFor(cardReal, { preferTarget: (c) => c.getId() === oppCreature.id });

  // Real 601.2c: casting this locks Coeurl in as the spell's own target
  // right now, while it's still genuinely on the battlefield and legal.
  pilotCast(pilot, cardReal, fateOfTheSunCryst, ctx, actions, undefined, undefined, oppCreature);

  // In response (an opponent's own instant-speed removal/sacrifice effect,
  // or a real state-based action — this trace doesn't need to model WHICH
  // one, only that Coeurl genuinely leaves the battlefield before this
  // spell gets to resolve, same "represent the real zone change directly"
  // technique crystal-fragments-summon-alexander's own scenario already
  // uses for an unrelated off-card event) Coeurl dies before this spell
  // ever resolves — the real, only target this spell has is now illegal.
  pilot.beginStep("In response, Coeurl is destroyed by something else before Fate of the Sun-Cryst resolves");
  pilot.state.move(oppCreature, 'Graveyard');

  // Real 608.2b: the spell still resolves (it's not countered) — it just
  // does nothing, since its one and only target is no longer legal. No
  // `fn:'destroy'` log entry appears below for Coeurl (it's already dead,
  // untouched by this resolution) — that absence, plus the spell's own
  // instant correctly still moving to its owner's graveyard right after, IS
  // the real trace evidence of the fizzle.
  pilotResolveTop(pilot);

  const result =
    "Casts Fate of the Sun-Cryst targeting the opponent's Coeurl (a real, legal target at cast time, CR 601.2c) — but Coeurl is destroyed by something else before this spell resolves, so its own only target is illegal by then (CR 115). The spell still genuinely resolves (it's NOT countered) but does nothing — real CR 608.2b's \"fizzle\": no destroy happens (no `destroy` log entry — contrast the other two scenarios above, which each log one), while the spell itself still correctly moves to its owner's graveyard afterward, same as any other resolved instant.";
  return finishEnginePilotTrace(pilot, setup, "real engine playthrough: cast (locks in Coeurl as the real target, 601.2c) -> Coeurl destroyed by something else in response -> resolve (fizzles, 608.2b — no destroy, spell still resolves)", result);
}

export function runEngineScenarios(): TraceResult[] {
  return [destroysTappedAttacker(), destroysUntappedCreature(), fizzlesWhenTargetDiesBeforeResolution()];
}
