// Real engine-piloted trace (see engine-trace.ts's own header) — replaces
// the old 2-scenario, flat harness.ts shape with ONE real playthrough
// chaining both of this card's real, independent activated abilities
// against the same shared board (SYNERGY_DESIGN.md's own "2 abilities on
// one card can almost always be chained into one story" standing rule —
// this is NOT a branching/modal card the way Phoenix Down's real "Choose
// one" is, just two small, unrelated real abilities that each need real
// trace evidence for their own facts).
//
// Real script (qiqirn_merchant.txt): "{1}, {T}: Draw a card, then discard a
// card." / "{7}, {T}, Sacrifice this creature: Draw three cards. This
// ability costs {1} less to activate for each Town you control." The
// per-Town cost reduction on the second ability is now REAL, structured
// engine vocabulary (`card.ts`'s `ActivationCostReduction`, ENGINE_GAPS.md
// gap #7's third example, closed) — this scenario's own board controls 2
// real Town lands (Capital City, Gongaga, Reactor Town — both real FIN
// `Land — Town` cards, not invented placeholders) so the logged
// "bigDraw" cost genuinely reads `{5}, {T}, ...` (7 minus 2), computed via
// `engine.ts`'s own `effectiveActivationCost` — not just a documentary
// string. Still fired DIRECTLY rather than through `canActivateAbility`
// (see below for why), so this demonstrates the discount COMPUTATION being
// genuinely mechanical (board-state-dependent), not the full activation
// actually being paid end-to-end.
//
// Real MTG would need either two separate turns or an untap effect between
// these two {T} activations (a permanent can't pay {T} twice without
// untapping first) — this scenario fires both directly, back-to-back
// against one shared GameState, the exact same documentary "no real
// turn/untap simulated between named actions" shortcut `Scenario.sequence`'s
// own doc comment (harness.ts) already establishes for a Saga's own chapter
// sequence, not a new one invented for this card.
//
// "cantrip" ({1}, {T}, pure mana+tap) is fully payable through this
// engine's own `canActivateAbility`/`activateAbility`, so it's piloted for
// real via `pilotActivate` (now threading a named `abilityName` — see that
// function's own updated doc comment, a real, general gap this card's own
// `card.abilities` shape surfaced: no prior caller ever activated anything
// but a card's single default `activationCost` ability).
//
// "bigDraw" cannot: its own "Sacrifice this creature" cost is a NAMED
// self-sacrifice (`engine.ts`'s `unsupportedCostComponent` only accepts
// "Sacrifice another/a/two X", never a self-reference), the same real,
// general engine limitation Zack Fair's own "{1}, Sacrifice Zack Fair"
// hits (see that card's own scenarios.ts header) — fired directly via
// `resolveCard`, bypassing `canActivateAbility` entirely, same technique.

import { qiqirnMerchant } from './definition';
import { basicLandsFor } from '../../mana';
import { resolveCard } from '../../card';
import { effectiveActivationCost } from '../../engine';
import type { TraceResult } from '../../harness';
import { setupEnginePilot, pilotActions, pilotCast, pilotResolveTop, pilotActivate, advanceToPlayersNextMain1, finishEnginePilotTrace, type EnginePilotSetup } from '../../engine-trace';

export function runEngineScenarios(): TraceResult[] {
  // Real mana needed across the whole playthrough: {2}{U} to cast Qiqirn
  // Merchant, {1} more for "cantrip"'s own cost ({7} for "bigDraw" is never
  // actually paid — its cost is unsupported and the ability is fired
  // directly, see this file's own header) — {3}{U} total, basicLandsFor
  // gives real Islands/generic basics for it. Library needs at least 5 real
  // cards: 1 for your own real draw step during the turn passage below, 1
  // from cantrip, 3 from bigDraw.
  const setup: EnginePilotSetup = {
    you: { basicLands: basicLandsFor('{3}{U}'), libraryCount: 5 },
    // A real, nonzero opponent library (same reason Stiltzkin, Moogle
    // Merchant's own setup needs one): `advanceToPlayersNextMain1` passes
    // through the opponent's own draw step on the way back to your next
    // Main1 — an empty library there is a real 704.5c mill-out loss, not a
    // safe default.
    opponents: [{ libraryCount: 5 }],
  };
  const pilot = setupEnginePilot(setup);

  const qiqirnReal = pilot.state.addCard(pilot.you, 'Hand', {
    name: qiqirnMerchant.name,
    types: ['Creature'],
    subtypes: ['Beast', 'Citizen'],
    basePower: qiqirnMerchant.pt?.[0],
    baseToughness: qiqirnMerchant.pt?.[1],
  });
  const actions = pilotActions(pilot, qiqirnReal.id);
  const ctx = pilot.ctxFor(qiqirnReal);

  // 2 real Town lands (ENGINE_GAPS.md gap #7's third example, closed
  // 2026-09-12) — real FIN `Land — Town` cards (Capital City, Gongaga,
  // Reactor Town; both enter untapped, neither has an ETB trigger, so
  // neither needs a matching `enters`-trigger dance), not invented
  // placeholders — so "bigDraw"'s own logged cost below is a REAL,
  // board-state-computed discount (`{7}` minus `{1}` per Town = `{5}`),
  // not the raw printed string.
  const town1 = pilot.state.addCard(pilot.you, 'Battlefield', { name: 'Capital City', types: ['Land'], subtypes: ['Town'] });
  pilot.log.push({ fn: 'enters', card: town1.name, zone: 'Battlefield', controller: pilot.you.name });
  const town2 = pilot.state.addCard(pilot.you, 'Battlefield', { name: 'Gongaga, Reactor Town', types: ['Land'], subtypes: ['Town'] });
  pilot.log.push({ fn: 'enters', card: town2.name, zone: 'Battlefield', controller: pilot.you.name });

  // Cast Qiqirn Merchant ({2}{U}), real mana payment; resolving it puts it
  // on the battlefield for real.
  pilotCast(pilot, qiqirnReal, qiqirnMerchant, ctx, actions);
  pilotResolveTop(pilot);

  // Real turn passage — summoning sickness (302.6) clears, so "cantrip"'s
  // own {T} half is legal, and the lands used to cast untap for real (502.3).
  advanceToPlayersNextMain1(pilot, pilot.you);

  // Real "cantrip" activation (602.1): {1}, {T} — pays real mana, taps
  // Qiqirn Merchant for real, then resolves its real effects: draws a real
  // card (into an empty hand, since the only other card there — Qiqirn
  // Merchant itself — was just cast), then discards that same real drawn
  // card (this model's own documented "front of hand" convention — no real
  // player choice for which card).
  pilotActivate(pilot, pilot.you, qiqirnReal, qiqirnMerchant, ctx, actions, 'Activate "cantrip" ({1}, {T}): draw a card, then discard a card', 'cantrip');
  pilotResolveTop(pilot);

  // Real "bigDraw" activation ({7}, {T}, Sacrifice this creature: Draw
  // three cards) — fired directly (see this file's own header for why
  // `pilotActivate` can't be used here): a real, documented engine gap
  // (self-sacrifice-as-cost is not payable through this engine's own
  // activation pipeline), not an avoided edge case. Qiqirn Merchant is
  // never actually removed from the battlefield in this model (same
  // "cost never actually pays for real" limitation Zack Fair's own
  // self-sacrifice cost has), so its own real "sacrifice this creature"
  // cost act is modeled as a fact with zero possible trace evidence,
  // exactly like Zack Fair's.
  pilot.beginStep('Activate "bigDraw" ({7}, {T}, Sacrifice Qiqirn Merchant, discounted {1} per Town you control — cost computed via effectiveActivationCost, fired directly since self-sacrifice-as-cost is not payable through canActivateAbility, see this file\'s own header)');
  const { costString: bigDrawCost } = effectiveActivationCost(pilot.engine, pilot.you, qiqirnMerchant, 'bigDraw');
  pilot.log.push({ fn: 'activate', card: qiqirnMerchant.name, cost: bigDrawCost, ability: 'bigDraw' });
  resolveCard(qiqirnMerchant, ctx, actions, undefined, 'bigDraw');

  const result =
    'Qiqirn Merchant is cast, turn passage clears summoning sickness, then both of its activated abilities fire in sequence against the same board: "cantrip" ({1}, {T}) draws a card and discards a card, then "bigDraw" ({7}, {T}, Sacrifice this creature) draws three more cards.';
  return [
    finishEnginePilotTrace(
      pilot,
      setup,
      'engine playthrough: cast -> turn passage -> "cantrip" activation (draw, discard) -> "bigDraw" activation (draw 3)',
      result,
    ),
  ];
}
