// Real engine-piloted trace (see engine-trace.ts's own header). Two
// independent scenarios, since the card's own two triggers need genuinely
// different real setups to demonstrate:
//  - onAttack has no auto-fire mechanism in this engine (`Trigger.on`
//    doesn't recognize 'attacks' — a real, accepted gap), so it's still
//    fired manually right after a real attack declaration, same as before.
//  - onTapLandForC is DIFFERENT (closed 2026-09-14, ENGINE_GAPS.md gap #5):
//    it's a real `on: 'tapLandForMana'` trigger now (card.ts's own
//    `Trigger.on` doc comment) — `engine.ts`'s new
//    `fireOnTapLandForManaTriggers` genuinely detects a real land you
//    control being tapped for {C} (via `mana.ts`'s own `payMana`) and fires
//    it for real, no manual trigger-firing call anywhere for this half
//    anymore. Kept as its own, separate, single-turn scenario (rather than
//    chained after the attack) specifically to avoid the real 502
//    untap step: waiting a whole turn for summoning sickness to clear (as
//    the attack scenario needs) genuinely UNTAPS every land again at the
//    next real Untap step, so a same-turn demonstration is what actually
//    forces the Inn to be the only legal payment source, not an invented
//    board state.

import { ultimaOriginOfOblivion } from './definition';
import { adventurersInn } from '../adventurer-s-inn/definition';
import { elixir } from '../elixir/definition';
import type { TraceResult } from '../../harness';
import { sourceColors, payMana, parseManaCost } from '../../mana';
import { effectiveSubtypes } from '../../state';
import {
  setupEnginePilot,
  pilotActions,
  pilotCast,
  pilotResolveTop,
  advanceToPlayersNextMain1,
  advanceToDeclareAttackersStep,
  pilotDeclareAttackers,
  pilotFireTrigger,
  finishEnginePilotTrace,
  type EnginePilotSetup,
} from '../../engine-trace';

function attacksAndBlightsAnOpponentLand(): TraceResult {
  const setup: EnginePilotSetup = {
    you: { basicLands: ['Forest', 'Forest', 'Forest', 'Forest', 'Forest'], libraryCount: 5 },
    opponents: [{ basicLands: ['Forest'], libraryCount: 5 }],
  };
  const pilot = setupEnginePilot(setup);

  const ultimaReal = pilot.state.addCard(pilot.you, 'Hand', {
    name: ultimaOriginOfOblivion.name,
    types: ['Creature'],
    subtypes: ['God', 'Legendary'],
    keywords: ultimaOriginOfOblivion.keywords,
  });
  const actions = pilotActions(pilot, ultimaReal.id);
  // "Target land" has no owner restriction at all (real oracle text) — the
  // real chooseTarget default (pool[0] of an unrestricted combined pool,
  // `you` always first) would otherwise blight YOUR OWN land instead of the
  // opponent's, contradicting this scenario's own story (a genuine, if
  // legal, choice this pilot script makes on purpose, same reasoning
  // Bahamut's own preferTarget uses).
  const opp = pilot.opponents[0]!;
  const ctx = pilot.ctxFor(ultimaReal, { preferTarget: (c) => c.getController().getId() === opp.id });

  // Cast Ultima ({5}), real mana payment
  pilotCast(pilot, ultimaReal, ultimaOriginOfOblivion, ctx, actions);
  // Resolves (no ETB trigger)
  pilotResolveTop(pilot);

  // Real turn passage — summoning sickness (302.6) clears
  advanceToPlayersNextMain1(pilot, pilot.you);

  // Real attack declaration (508.1)
  advanceToDeclareAttackersStep(pilot);
  pilotDeclareAttackers(pilot, [ultimaReal], 'Declare Ultima as attacker');

  // onAttack fired manually — puts a real blight counter on the opponent's only land
  pilotFireTrigger(pilot, ultimaOriginOfOblivion, ctx, actions, 'onAttack');

  // Real, LIVE consequence (ENGINE_GAPS.md's own "Ultima, Origin of
  // Oblivion" closure): the blighted Forest has genuinely lost its own land
  // type (`effectiveSubtypes` now returns [] instead of ['Forest']) and its
  // only mana ability is now the granted "{T}: Add {C}" (`sourceColors`
  // returns ['C'], not ['G']) — demonstrated directly against the real
  // `mana.ts`/`state.ts` primitives an opponent's own later cast would use
  // (no `pilotCast`-style helper exists for casting AS the opponent — that
  // helper is hardcoded to `pilot.you` as caster — so this exercises the
  // exact same functions such a cast would, same "represent the real
  // consequence directly" technique this pool's other engine-piloted
  // scenarios already use for an off-protagonist event).
  const blightedLand = opp.battlefield.find((c) => c.types.includes('Land'))!;
  pilot.log.push({ fn: 'read:effectiveSubtypes', target: blightedLand.name, id: blightedLand.id, subtypes: effectiveSubtypes(pilot.state, blightedLand) });
  pilot.log.push({ fn: 'read:sourceColors', target: blightedLand.name, id: blightedLand.id, colors: sourceColors(blightedLand) });
  // `{1}` (generic), not `{C}` — `mana.ts`'s own `parseManaCost` still
  // throws on a colorless-specific PIP IN A CAST COST (ENGINE_GAPS.md gap
  // #6's own explicitly-unmodeled remainder, unrelated to this closure); the
  // `read:sourceColors` line just above already proves the SOURCE'S color
  // is genuinely `['C']` now — this just proves it's still genuinely
  // payable at all (toward generic coverage) after losing every other
  // ability.
  const paidWithBlightedLand = payMana(pilot.state, [blightedLand], parseManaCost('{1}'));
  for (const source of paidWithBlightedLand) pilot.log.push({ fn: 'tapForMana', target: source.name, id: source.id, for: "the blighted land's own granted {T}: Add {C}" });

  const result =
    'Ultima enters, turn passage clears summoning sickness, then attacks (508.1), putting a blight counter on the opponent\'s only land — it genuinely loses its land type (no longer a Forest) and can now only tap for {C}, not {G} (real, live, counter-conditional engine behavior, not printed text).';
  return finishEnginePilotTrace(pilot, setup, 'engine playthrough: cast -> turn passage -> attack -> onAttack -> blighted land only makes {C}', result);
}

function tappingALandForCTriggersAnAdditionalC(): TraceResult {
  const setup: EnginePilotSetup = {
    // Exactly enough Forests to pay Ultima's own {5} and nothing left over —
    // deliberate: the later Elixir cast ({1}), in the SAME turn (no real
    // Untap step crossed, so nothing re-untaps), has no untapped source BUT
    // the real Adventurer's Inn added below, so tapping it (and thereby
    // triggering Ultima's own real "tap a land for {C}" ability) isn't just
    // possible but the ONLY legal way to pay for it.
    you: { basicLands: ['Forest', 'Forest', 'Forest', 'Forest', 'Forest'], libraryCount: 5 },
    opponents: [{}],
  };
  const pilot = setupEnginePilot(setup);

  const ultimaReal = pilot.state.addCard(pilot.you, 'Hand', {
    name: ultimaOriginOfOblivion.name,
    types: ['Creature'],
    subtypes: ['God', 'Legendary'],
    keywords: ultimaOriginOfOblivion.keywords,
  });
  const actions = pilotActions(pilot, ultimaReal.id);
  const ctx = pilot.ctxFor(ultimaReal);

  // Cast Ultima ({5}), real mana payment — taps all 5 Forests.
  pilotCast(pilot, ultimaReal, ultimaOriginOfOblivion, ctx, actions);
  // Resolves (no ETB trigger). `resolvedPermanents` now carries Ultima's own
  // card/ctx/actions triple — the real prerequisite `engine.ts`'s new
  // `fireOnTapLandForManaTriggers` needs to find and fire its trigger below.
  pilotResolveTop(pilot);

  // A real Adventurer's Inn, already resolved on your battlefield (added
  // directly, same "bystander permanent" convention every other scenario's
  // own non-protagonist permanents use — no `enteredThisTurn` stamp, so no
  // summoning-sickness gate applies to its own {T} ability either). Its own
  // real `manaAbilities: [{colors:['C']}]` (see adventurer-s-inn's own
  // definition.ts, migrated 2026-09-14, ENGINE_GAPS.md gap #5) is copied
  // here directly rather than re-derived, same "seeded, not resolved"
  // convention every other scenario-local mana source in this pool uses.
  pilot.state.addCard(pilot.you, 'Battlefield', {
    name: adventurersInn.name,
    types: ['Land'],
    subtypes: ['Town'],
    manaAbilities: adventurersInn.manaAbilities,
  });

  // Cast a real second spell, Elixir ({1}), same turn, still Main1, stack
  // still empty (307.1a/117.1a) — the ONLY untapped mana source on your
  // battlefield at this point is the Inn (all 5 Forests are already tapped
  // from casting Ultima, and no real Untap step has happened since), so
  // `mana.ts`'s own `payMana` MUST tap it for its real {C}. `engine.ts`'s
  // new `fireOnTapLandForManaTriggers` genuinely detects this real land tap
  // and fires Ultima's own `onTapLandForC` trigger for real — no manual
  // `pilotFireTrigger` call anywhere in this scenario. The trace shows one
  // real `fn:'tapForMana'` line naming the Inn (its own base {C} is a bare
  // untapped-source tap, not an `Effect`, so — per `mana.ts`'s own header
  // comment / `interfaces.ts`'s `Player.addMana` doc comment — it never logs
  // its own `addMana` line) followed by a real `fn:'addMana'` line: that one
  // IS Ultima's own additional {C}, a genuine `Effect` execution, not
  // scripted.
  const elixirReal = pilot.state.addCard(pilot.you, 'Hand', { name: elixir.name, types: ['Artifact'] });
  const elixirActions = pilotActions(pilot, elixirReal.id);
  const elixirCtx = pilot.ctxFor(elixirReal);
  pilotCast(pilot, elixirReal, elixir, elixirCtx, elixirActions, "Cast Elixir ({1}), tapping Adventurer's Inn for its own {C}");
  pilotResolveTop(pilot);

  const result =
    'Casting Elixir forces tapping a real Adventurer\'s Inn for its own {C} (the only untapped source left after casting Ultima) — Ultima\'s own real "Whenever you tap a land for {C}, add an additional {C}" trigger fires genuinely and automatically off that real land tap (no manual firing anywhere in this scenario), adding one real extra {C} on top.';
  return finishEnginePilotTrace(pilot, setup, 'engine playthrough: cast Ultima -> cast Elixir (real land tap auto-fires onTapLandForC)', result);
}

export function runEngineScenarios(): TraceResult[] {
  return [attacksAndBlightsAnOpponentLand(), tappingALandForCTriggersAnAdditionalC()];
}
