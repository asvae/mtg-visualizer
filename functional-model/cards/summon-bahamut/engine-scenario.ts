// Real engine-piloted trace for this card (see engine-trace.ts's own
// header) — two scenarios, same real reason harness.ts's own (now-replaced)
// flat scenarios.ts needed two: chapter I/II's own unrestricted "destroy up
// to one target nonland permanent" has NO owner restriction (real Forge
// text, `validType:'permanent', nonLand:true`, no `owner` field), and this
// model's `chooseTarget` always deterministically picks the FIRST candidate
// in an unrestricted pool — which is always `self` (Bahamut is on `you`'s
// own battlefield, checked first by `playersFor('each', ctx)`'s own
// `[ctx.you, ...ctx.opponents]` order in card.ts). That's true under the
// real engine exactly as it was true under harness.ts's flat runner — same
// structural fact, not something piloting through the real engine changes.
// So: scenario A plays the sane real line (both chapters genuinely DECLINE
// the self-destroy, with a real opponent permanent present the whole time
// to prove it's a real choice, not "no legal target existed"), scenario B
// is a minimal, separate proof that "destroy" is a real, exercised
// capability (with no OTHER nonland permanent around at all, Bahamut
// legally, if pointlessly, destroys itself) — verify-synergy.mjs's own
// `destroy-nonland` fact needs at least one real trace line backing it.

import { summonBahamut } from './definition';
import { basicLandsFor } from '../../mana';
import type { TraceResult } from '../../harness';
import { setupEnginePilot, pilotActions, pilotCast, pilotResolveTop, advanceToPlayersNextMain1, finishEnginePilotTrace, type EnginePilotSetup } from '../../engine-trace';

function scenarioA(): TraceResult {
  const setup: EnginePilotSetup = {
    // Enough library for both players to keep drawing normally across the
    // several real turns this scenario advances through (3 full rounds) —
    // real 704.5a (`sba.ts`) genuinely loses the game for a player who runs
    // out, so both sides need real cards left to draw the whole way.
    you: { libraryCount: 15, basicLands: basicLandsFor('{9}') },
    opponents: [{ tokens: ['c_a_treasure_sac'], libraryCount: 10 }],
  };
  const pilot = setupEnginePilot(setup);

  const bahamutReal = pilot.state.addCard(pilot.you, 'Hand', {
    name: summonBahamut.name,
    types: ['Creature', 'Enchantment'],
    subtypes: ['Saga', 'Dragon'],
    keywords: summonBahamut.keywords,
  });
  const actions = pilotActions(pilot, bahamutReal.id);
  // `declineOptional: true` from the start — this SAME `ctx` object is what
  // `engine.ts`'s `resolveTop` (chapter I, at cast/ETB time) and `saga.ts`'s
  // `advanceSagasAfterDrawStep` (chapters II/III/IV, on later real draw
  // steps) both reuse verbatim (`GameEngine.resolvedPermanents` keeps the
  // exact reference, never a copy — see engine-trace.ts's own
  // `EnginePilotCtxOpts` doc comment) — one real "decline" choice made
  // once, honored automatically by every later chapter it applies to.
  const ctx = pilot.ctxFor(bahamutReal, { declineOptional: true });

  // --- Cast Bahamut ({9}), real mana payment ---
  pilotCast(pilot, bahamutReal, summonBahamut, ctx, actions);

  // --- Resolves onto the battlefield; real 714.2b/c fires chapter I
  // immediately (the fix this batch made to `pilotResolveTop`) — declines
  // the destroy (a real opponent Treasure is on the battlefield the whole
  // time, so this is a genuine choice, not "nothing to hit"). ---
  pilotResolveTop(pilot);

  // --- Real turn passage to your own next draw step fires chapter II for
  // real (714.2c) — declines again, same reasoning. ---
  advanceToPlayersNextMain1(pilot, pilot.you, bahamutReal);

  // --- Another real turn — chapter III fires for real: "draw two cards"
  // (`ctx.you.drawCard()` x2, genuinely logged via the real, logging-wrapped
  // player). ---
  advanceToPlayersNextMain1(pilot, pilot.you, bahamutReal);

  // --- This model has no mana-value field on `RealCard` at all (see
  // definition.ts's own comment on chapter IV) — supply the real number a
  // scenario is responsible for fixing, same as harness.ts's own
  // (replaced) flat scenario did, mutating the SAME persistent `ctx` right
  // before the real tick that will read it. ---
  ctx.triggerInput = { totalManaValue: 7 };

  // --- Another real turn — chapter IV fires for real: deals 7 damage to
  // the opponent (Mega Flare), THEN 714.4's own real sacrifice fires
  // (chapter IV is Bahamut's greatest chapter, and nothing reset its lore
  // counters first — unlike Jill/Shiva's own transform-back, this is
  // `saga.ts`'s OTHER real reference case: Jecht's chapter III, cited in
  // that file's own header, where the sacrifice correctly does NOT get
  // skipped). ---
  advanceToPlayersNextMain1(pilot, pilot.you, bahamutReal);
  if (bahamutReal.zone === 'Graveyard') {
    pilot.log.push({ fn: 'sacrifice', player: pilot.you.name, card: summonBahamut.name });
  }

  const result =
    "Bahamut enters, chapter I fires for real (714.2b) but declines its own destroy — a real opponent Treasure is on the battlefield the whole time, so this is a genuine choice, not a missing target; chapter II fires on your next draw step and declines the same way; chapter III fires the turn after, drawing two real cards; chapter IV fires the turn after that, dealing real damage equal to a real (scenario-supplied) total mana value, then Bahamut is really sacrificed (714.4) since nothing reset its lore counters first — all through the real turn-based engine's own Saga automation (saga.ts), not a flat named-trigger sequence.";
  return finishEnginePilotTrace(pilot, setup, 'real engine playthrough: cast -> ETB Saga tick -> chapters over real turns -> 714.4 sacrifice', result);
}

function scenarioB(): TraceResult {
  const setup: EnginePilotSetup = { you: { basicLands: basicLandsFor('{9}') } };
  const pilot = setupEnginePilot(setup);
  const bahamutReal = pilot.state.addCard(pilot.you, 'Hand', {
    name: summonBahamut.name,
    types: ['Creature', 'Enchantment'],
    subtypes: ['Saga', 'Dragon'],
    keywords: summonBahamut.keywords,
  });
  const actions = pilotActions(pilot, bahamutReal.id);
  const ctx = pilot.ctxFor(bahamutReal); // no decline — this line exists purely to prove "destroy" really fires.

  pilotCast(pilot, bahamutReal, summonBahamut, ctx, actions);
  // --- Resolves; chapter I fires for real. Bahamut is the ONLY nonland
  // permanent anywhere on the board (unrestricted "each" pool, card.ts's
  // own `playersFor`), so it legally, if pointlessly, destroys itself —
  // real, exercised evidence that the effect fires at all. ---
  pilotResolveTop(pilot);

  const result = 'chapter I\'s own unrestricted "destroy up to one target nonland permanent" has no target other than Bahamut itself anywhere on the board, so it legally (if pointlessly) destroys itself for real — documenting the effect actually fires, not just declines (the sane real line is scenario A above).';
  return finishEnginePilotTrace(pilot, setup, 'real engine playthrough: cast -> ETB Saga tick fires chapter I with no other target', result);
}

export function runEngineScenarios(): TraceResult[] {
  return [scenarioA(), scenarioB()];
}
