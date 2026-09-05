// Real Saga lore-counter automation (714) — a new, focused file, same
// precedent as `sba.ts`. Verified against the real FIN pool first: every
// Saga in this codebase (grep `chapterI` across
// `functional-model/cards/<slug>/definition.ts` — 22 real cards) already
// models its chapter abilities as named triggers `chapterI`/`chapterII`/
// `chapterIII`/(`chapterIV`), on `CardDefinition.triggers` directly for a
// plain Saga (Summon: Bahamut, Summon: Knights of Round, ...) or on
// `CardDefinition.backFace.triggers` for a transforming one (Jill, Shiva's
// Dominant // Shiva, Warden of Ice; Dion, Bahamut's Dominant // Bahamut,
// Warden of Light; Jecht, Reluctant Guardian // Braska's Final Aeon) —
// confirmed before building against it, not assumed.
//
// Real rules modeled:
//  - 714.2b: a Saga permanent enters with NO lore counters.
//  - 714.2c: a triggered ability (this file's own `advanceSaga`) puts a
//    lore counter on it when it enters (or, per the modern errata this
//    rule's own wording covers, when it TRANSFORMS into a Saga — see
//    `transformPermanent` below) and after each of its controller's draw
//    steps.
//  - 714.2d/714.3a/b: "as long as the number of lore counters on this Saga
//    is greater than or equal to [N]," the matching chapter ability
//    triggers — approximated the SAME way this whole codebase already
//    approximates a Saga's turn-based action as a plain named trigger
//    (`chapterI`/etc.), fired exactly once per lore-counter increment
//    rather than as a continuously-re-checked condition — real for the
//    common case (lore counters only ever go up by exactly 1 at a time
//    here), a documented simplification for the rare "skip a counter"
//    effect (none exist in this pool — checked).
//  - 714.4: once lore counters reach the Saga's greatest chapter number,
//    its controller sacrifices it (701.16 sacrifice — unconditional,
//    unlike `destroy`, which Indestructible would block). Detected via a
//    real, existing mechanic rather than an invented "is this still a
//    Saga" registry: `state.move()`'s own 400.7 zone-change reset already
//    WIPES `RealCard.counters` (lore counters included) the instant a
//    chapter's own effect exiles-and-returns the permanent (Jill/Dion's
//    own real templating for "this Saga transforms back" — see
//    `functional-model/cards/jill-shiva-s-dominant-shiva-warden-of-ice`'s
//    own definition.ts). So after firing the final chapter, this file
//    checks whether the lore-counter total it JUST SET is still there —
//    if a zone change already reset it (a transform-back, or the chapter
//    ability exiling/destroying its own source some other way), 714.4's
//    sacrifice is correctly skipped, with NO card-specific special-casing
//    (Jecht, Reluctant Guardian // Braska's Final Aeon's own chapter III
//    does NOT transform back — sacrifice correctly still fires for it).
//
// Explicit scope, deliberately narrow:
//  - "Which `CardDefinition` currently represents this permanent" is
//    tracked the SAME way `engine.ts`'s upkeep/end-step auto-fire already
//    tracks it: `GameEngine.resolvedPermanents`, updated by `resolveTop`
//    for a fresh cast and by this file's own `transformPermanent` for a
//    transform. A transforming Saga's own custom effect (`run: (ctx,
//    actions) => {...}`, card.ts) has NO reference to `GameEngine` at all
//    (by design — card.ts stays engine-agnostic), so it CANNOT call
//    `transformPermanent` itself. A caller piloting the game must call it
//    explicitly right after running the transform's own activated
//    ability — same "an explicit signal, not auto-inferred" convention
//    `harness.ts`'s own `SequenceStep.face` field already established for
//    exactly this same problem. Retrofitting the 312 cards' own effects to
//    somehow signal this automatically is out of scope here (there's no
//    hook for them to call even if retrofitted) — a real, deliberately
//    scoped gap, not silently assumed away.
//  - Only a Saga's OWN controller's draw step counts (714.2c's real text)
//    — an opponent's draw step never advances it.
//  - "Skip the next lore counter"/"add an EXTRA lore counter" effects
//    (real but rare) are not modeled — no FIN card in this pool needs
//    either (checked).

import type { CardDefinition, EffectContext, Actions } from './card';
import { resolveCard } from './card';
import type { RealCard, RealPlayer } from './state';
import type { GameEngine } from './engine';

const CHAPTER_NAMES = ['chapterI', 'chapterII', 'chapterIII', 'chapterIV', 'chapterV'] as const;

/** Real 714.1's own "Saga" subtype check — a plain typeLine substring test, same convention `isPermanentTypeLine`/`effectiveTypes` use elsewhere in this codebase (no structured supertype/subtype parser exists here). */
export function isSaga(card: CardDefinition): boolean {
  return /\bSaga\b/.test(card.typeLine);
}

/** The highest chapter number this Saga actually has (714.3a/b's own "greatest chapter number") — the highest-indexed `CHAPTER_NAMES` entry present as a named trigger. `0` for a non-Saga or a Saga with no recognized chapter triggers at all (shouldn't happen for a real card, but a defensive, honest answer rather than a throw). */
function maxChapterOf(card: CardDefinition): number {
  let max = 0;
  for (let i = 0; i < CHAPTER_NAMES.length; i++) {
    if (card.triggers?.some((t) => t.name === CHAPTER_NAMES[i])) max = i + 1;
  }
  return max;
}

interface ResolvedPermanent {
  card: CardDefinition;
  ctx: EffectContext;
  actions: Actions;
}

/**
 * Real 714.2c: puts the next lore counter on `real` and fires the matching
 * chapter trigger (if `registered.card` declares one at that count), then
 * — only when this was the Saga's greatest chapter — checks 714.4's own
 * sacrifice. Called both for a fresh Saga's own ETB (714.2b, `real` has 0
 * lore counters yet) and for each subsequent controller's-draw-step tick;
 * the two are the SAME real triggered ability, just different timings, so
 * this is deliberately one function, not two.
 *
 * No-ops (does nothing, mutates nothing) for a non-Saga `registered.card`,
 * a permanent no longer on the battlefield at all (714's own chapter/
 * sacrifice machinery only ever applies to a Saga PERMANENT — a card
 * already sacrificed, destroyed, or otherwise moved away has no lore
 * counters left to check by then anyway, since `state.move`'s own 400.7
 * reset already cleared them, which would otherwise read as "0, so not yet
 * at max" and incorrectly restart it from chapter I), or a Saga already
 * at/past its own greatest chapter (714.4 should have already removed it
 * by then — a defensive guard, not a real reachable case in normal play).
 */
export function advanceSaga(engine: GameEngine, real: RealCard, registered: ResolvedPermanent): void {
  const card = registered.card;
  if (!isSaga(card)) return;
  if (real.zone !== 'Battlefield') return;
  const max = maxChapterOf(card);
  const lore = real.counters['lore'] ?? 0;
  if (max === 0 || lore >= max) return;

  const nextCount = lore + 1;
  engine.state.putCounter(real, 'lore', 1);
  const chapterName = CHAPTER_NAMES[nextCount - 1]!;
  const trigger = card.triggers?.find((t) => t.name === chapterName);
  if (trigger) resolveCard(card, registered.ctx, registered.actions, trigger.name);

  if (nextCount >= max) {
    // 714.4's own sacrifice — SKIPPED if the chapter's own resolution
    // already reset this permanent's lore counters via a real zone change
    // (a transform-back, e.g.) — see this file's own header for why this
    // is the correct, general signal rather than a per-card special case.
    if (real.zone === 'Battlefield' && (real.counters['lore'] ?? 0) === nextCount) {
      const controller = engine.players.find((p) => p.id === real.controllerId);
      if (controller) engine.state.sacrifice(controller, 1, (c) => c.id === real.id);
    }
  }
}

/** Every Saga the ACTIVE player controls that's registered with `engine.resolvedPermanents` (714.2c's own controller-scoping — an opponent's Saga does not advance on this player's draw step). Called once per real turn, right after the draw step ends (structurally exact in this engine's fixed 12-phase list: entering `Main1` always means the Draw step just completed, whether or not a card was actually drawn — see `turn.ts`'s own `shouldSkipDraw`). */
export function advanceSagasAfterDrawStep(engine: GameEngine, active: RealPlayer): void {
  for (const real of active.battlefield) {
    const registered = engine.resolvedPermanents.get(real.id);
    if (registered) advanceSaga(engine, real, registered);
  }
}

/**
 * Registers `real` as now being represented by `newFace` (a transform —
 * Jill's own front-face activated ability into Shiva, e.g.) and, if
 * `newFace` is a Saga, immediately runs the SAME 714.2b/2c initialization
 * a fresh ETB gets (the modern real errata's own "enters OR transforms
 * into a Saga" wording — Jill herself isn't a Saga at all before this
 * call, so without it she'd never get a lore counter or fire a single
 * chapter). See this file's own header for why a caller (not the card's
 * own effect) must call this explicitly.
 */
export function transformPermanent(engine: GameEngine, real: RealCard, newFace: CardDefinition, ctx: EffectContext, actions: Actions): void {
  const registered: ResolvedPermanent = { card: newFace, ctx, actions };
  engine.resolvedPermanents.set(real.id, registered);
  advanceSaga(engine, real, registered);
}
