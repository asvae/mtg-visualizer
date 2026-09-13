import type { TraceResult } from '../../harness';
import { theWaterCrystal } from './definition';
import { basicLandsFor } from '../../mana';
import { typesFromTypeLine, subtypesFromTypeLine } from '../../harness';
import { setupEnginePilot, pilotActions, pilotCast, pilotResolveTop, pilotActivate, advanceToPlayersNextMain1, finishEnginePilotTrace, type EnginePilotSetup } from '../../engine-trace';

// Real engine-piloted trace ONLY (ENGINE_GAPS.md gap #19, closed) — no flat
// `scenarios: Scenario[]` export alongside this one (same full-migration
// convention diamond-weapon/qiqirn-merchant/etc. already established,
// `scripts/run-scenarios.mjs` picks `runEngineScenarios` EXCLUSIVELY when
// present, never both): demonstrating the mill-PLUS-FOUR replacement ("If
// an opponent would mill one or more cards, they mill that many cards plus
// four instead.") genuinely applying requires The Water Crystal to
// actually be resolved onto the battlefield through `resolveTop`
// (`engine.ts`'s real copy-at-resolve-time step is the only place
// `millModifierGrants` ever reaches the real permanent — see state.ts's
// own doc comment) — a flat `harness.ts` scenario starts `self` already on
// the battlefield with no `CardDefinition` grant-fields ever copied over,
// so it could never demonstrate this replacement no matter how it was
// shaped. The cost-reduction clause ("Blue spells you cast cost {1} less
// to cast") is ALSO real (spellCostReductionGrants, same mechanism gap
// #7's own second example/The Wind Crystal's White-spell discount use)
// but gets no demonstration of its own here — same "real mechanism, zero
// possible trace evidence given THIS card's own scenario shape" treatment
// progress.json's own notes explain (this card's own activation never
// casts a second spell for the discount to apply to).
//
// Real script: "{4}{U}{U}, {T}: Each opponent mills cards equal to the
// number of cards in your hand." With The Water Crystal itself genuinely
// resolved onto the battlefield, its own replacement clause is live: your
// hand holds 3 real cards at the moment of activation (2 Forests from
// `handCount` below, plus a real THIRD Forest drawn during your own draw
// step of the real turn passage below — the Water Crystal itself already
// left hand/entered the battlefield by then), so the base mill amount is
// 3 — the real, mechanically-computed total is 3 + 4 = 7, shown in the
// trace as `fn:'mill', qty:7, requestedQty:3`.
export function runEngineScenarios(): TraceResult[] {
  // {2}{U}{U} to cast The Water Crystal, {4}{U}{U} to activate its own
  // mill ability — {6}{U}{U}{U}{U} total, basicLandsFor gives real Islands
  // for all of it (more than strictly needed, since the same lands
  // genuinely untap for real between the two payments via the real turn
  // passage below — same "just provision enough for the whole playthrough"
  // convention qiqirn-merchant's own scenario already establishes).
  // `handCount: 2`, not 3 — the real turn passage below crosses your own
  // draw step once (advanceToPlayersNextMain1 lands on YOUR next Main1,
  // your own turn's remaining phases first, then the opponent's WHOLE
  // turn, then back to yours — see that function's own doc comment),
  // adding a real THIRD card to hand by the time you activate; `libraryCount:
  // 1` supplies that one real card so the draw isn't a 704.5c-adjacent
  // "attempted from empty" no-op.
  const setup: EnginePilotSetup = {
    you: { basicLands: basicLandsFor('{6}{U}{U}{U}{U}'), handCount: 2, libraryCount: 1 },
    // A real, nonzero opponent library: `advanceToPlayersNextMain1` passes
    // through the opponent's own draw step on the way back to your next
    // Main1 (a real 704.5c mill-out loss otherwise, same reasoning
    // qiqirn-merchant's own setup comment gives) — sized generously (10)
    // so the real +4-replacement mill (7 cards) never collides with THAT
    // draw, and so the replacement's own real effect (7, not 3) is legible
    // rather than looking like it merely hit a library-size cap.
    opponents: [{ libraryCount: 10 }],
  };
  const pilot = setupEnginePilot(setup);

  const crystalReal = pilot.state.addCard(pilot.you, 'Hand', {
    name: theWaterCrystal.name,
    types: typesFromTypeLine(theWaterCrystal.typeLine),
    subtypes: subtypesFromTypeLine(theWaterCrystal.typeLine),
  });
  const actions = pilotActions(pilot, crystalReal.id);
  const ctx = pilot.ctxFor(crystalReal);

  // Cast The Water Crystal ({2}{U}{U}), real mana payment; resolving it
  // copies its real `millModifierGrants: [{amount: 4}]` onto the battlefield
  // permanent (`engine.ts`'s `resolveTop`) — the one real hook its own
  // activated ability's later mill can now genuinely intercept.
  pilotCast(pilot, crystalReal, theWaterCrystal, ctx, actions);
  pilotResolveTop(pilot);

  // Real turn passage — this engine's own (broader-than-real-302.6, see
  // `engine.ts`'s `canActivateAbility` own comment) summoning-sickness
  // approximation applies the {T}-cost check to ANY permanent, not just a
  // creature, so a fresh non-creature Artifact's own {T} ability still
  // needs a turn passage here, same as qiqirn-merchant's own creature
  // "cantrip" ability needed one.
  advanceToPlayersNextMain1(pilot, pilot.you);

  // Real activation (602.1): {4}{U}{U}, {T} — pays real mana, taps The
  // Water Crystal for real, then resolves its real `kind:'mill'` effect:
  // your hand holds 3 real cards (2 Forests from `handCount` plus the 1
  // real Forest drawn during the turn passage above — The Water Crystal
  // itself already left hand by now), so the requested
  // mill amount is 3; `state.mill`'s own real `activeMillModifier` check
  // finds The Water Crystal's own `millModifierGrants` (now live on the
  // battlefield permanent) and bumps the REAL applied amount to 7 —
  // genuinely mechanical, not scripted (`fn:'mill', qty:7,
  // requestedQty:3`).
  pilotActivate(pilot, pilot.you, crystalReal, theWaterCrystal, ctx, actions, 'Activate "{4}{U}{U}, {T}": each opponent mills cards equal to the number of cards in your hand — mill-plus-4 replacement live');
  pilotResolveTop(pilot);

  const result =
    'The Water Crystal is cast, turn passage clears summoning sickness, then its own activated ability mills the opponent: with 3 cards in hand the nominal amount is 3, but the "mill that many cards plus four instead" replacement (now live on the resolved permanent) bumps the milled count to 7.';
  return [
    finishEnginePilotTrace(
      pilot,
      setup,
      'engine playthrough: cast -> turn passage -> activation of "each opponent mills..." with the mill-plus-4 replacement applying',
      result,
    ),
  ];
}
