// Real engine-piloted trace (see engine-trace.ts's own header) — replaces
// the old flat harness.ts Scenario[] style (2026-09-12, continuation of the
// fin/1-33 unified-Fact rollout). New standing rule for this rollout:
// default to ONE real scenario per card (branching/multi-scenario needs a
// significant reason — this card has none). This single playthrough
// demonstrates the WHOLE real ability in one causal chain: cast -> real
// {2},{T} self-tap activation -> a real permanent (one of the same real
// Plains that already paid for casting/activation) genuinely changes
// control to a real opponent -> the real "if they do" draw fires.

import { stiltzkinMoogleMerchant } from './definition';
import { basicLandsFor } from '../../mana';
import type { TraceResult } from '../../harness';
import {
  setupEnginePilot,
  pilotActions,
  pilotCast,
  pilotResolveTop,
  pilotActivate,
  advanceToPlayersNextMain1,
  finishEnginePilotTrace,
  type EnginePilotSetup,
} from '../../engine-trace';

export function runEngineScenarios(): TraceResult[] {
  // {3}{W} total real mana needed across the whole playthrough: {W} to cast
  // Stiltzkin, {2} to later activate its own ability — basicLandsFor gives
  // 4 real Plains for that combined cost. All 4 stay real, ordinary basic
  // lands; nothing synthetic stands in for "a permanent you control" below —
  // one of these same 4 Plains is the real "another target permanent you
  // control" the activated ability gives away.
  const setup: EnginePilotSetup = {
    you: { basicLands: basicLandsFor('{3}{W}'), libraryCount: 5 },
    opponents: [{ libraryCount: 5 }],
  };
  const pilot = setupEnginePilot(setup);

  const stiltzkinReal = pilot.state.addCard(pilot.you, 'Hand', {
    name: stiltzkinMoogleMerchant.name,
    types: ['Creature'],
    subtypes: ['Moogle'],
    keywords: stiltzkinMoogleMerchant.keywords,
    basePower: stiltzkinMoogleMerchant.pt?.[0],
    baseToughness: stiltzkinMoogleMerchant.pt?.[1],
  });
  const actions = pilotActions(pilot, stiltzkinReal.id);
  const ctx = pilot.ctxFor(stiltzkinReal);

  // Cast Stiltzkin ({W}), real mana payment (taps 1 of the 4 Plains)
  pilotCast(pilot, stiltzkinReal, stiltzkinMoogleMerchant, ctx, actions);
  pilotResolveTop(pilot);

  // Real printed Lifelink (CR 702.15e: life gained equal to ANY damage
  // dealt, combat or otherwise — restored 2026-09-12, see SYNERGY_DESIGN.md's
  // own dated entry) — a real, direct `actions.dealDamage` call, same real
  // function combat damage itself resolves through (`state.dealDamage`'s
  // own Lifelink check), demonstrating it without needing a full combat
  // sub-sequence (Stiltzkin's own {T} activation below already uses up its
  // one real tap this turn).
  pilot.beginStep('Real Lifelink: Stiltzkin deals 3 damage to the opponent, gains that much life');
  actions.dealDamage(ctx.self, ctx.opponents[0]!, 3);

  // Real turn passage — summoning sickness (302.6) clears, so the {T} half
  // of the activation cost is legal, and all 4 Plains untap for real (502.3)
  advanceToPlayersNextMain1(pilot, pilot.you);

  // Real {2}, {T} activation (602.1) — taps Stiltzkin itself plus 2 more of
  // the 4 Plains for the generic cost, then resolves the real custom effect:
  // choosing another real permanent you control (one of your own remaining
  // real Plains — `chooseTarget` always takes the first legal pool
  // candidate, same documented default this pool's own `chooseTarget` uses
  // everywhere else), giving the opponent real control of it, then drawing
  // a real card because the control change genuinely happened.
  pilotActivate(pilot, pilot.you, stiltzkinReal, stiltzkinMoogleMerchant, ctx, actions, 'Activate {2}, {T}: give the opponent control of another permanent; draw a card');
  pilotResolveTop(pilot);

  const result =
    'Stiltzkin, Moogle Merchant is cast, turn passage clears summoning sickness, then its {2},{T} ability activates: the opponent gains control of another permanent you control (one of the same Plains that helped pay for casting/activation), and because that control change happened, you draw a card.';
  return [finishEnginePilotTrace(pilot, setup, 'real engine playthrough: cast -> turn passage -> real {2},{T} activation -> real gainControl -> real drawCard', result)];
}
