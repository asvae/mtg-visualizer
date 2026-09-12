import type { CardDefinition, Effect } from '../../card';

// Real oracle text (data/fin/fin_scryfall.json, fin/53, mana_cost {3}{U}):
// "{T}, Exile this artifact: Add {U}. When you next cast an instant or
// sorcery spell this turn, copy that spell. You may choose new targets for
// the copy."
//
// The mana ability itself ({T}, Exile this artifact: Add {U}) is a real,
// modeled `{kind:'addMana'}` Effect, `activationCost` text-only for the
// {T}/self-exile cost components — same convention phoenix-down's and
// elixir's own identical "{T}, Exile this artifact: ..." cost shape already
// use (both COSTS, paid before the ability resolves, never a resolvable
// `Effect` of their own).
//
// The delayed-trigger spell-copy half ("When you next cast an instant or
// sorcery spell this turn, copy that spell. You may choose new targets for
// the copy.") is a REAL, DOCUMENTED GAP, not modeled at all — two separate
// missing primitives, checked, neither exists anywhere in this engine:
//   1. A delayed trigger that watches for the next CAST EVENT this turn
//      (any instant/sorcery, unconditionally, whoever casts it — not "this
//      permanent's own" anything). `interfaces.ts`'s only delayed-trigger
//      primitive is `delayUntil(phase, run)` (real 603.4/603.7, Elrond,
//      Moon-Reader's own "at the beginning of the next end step") — that's
//      a PHASE-keyed delay, not an event-keyed one; there is no
//      "next-time-X-happens" observer of any kind in this codebase (no cast
//      hook fires outside a card's OWN `onCast`-shaped self trigger, and
//      none of those generalize to "any instant/sorcery ANY player casts").
//   2. A spell-copy effect. `card.ts`'s `Effect` union has no `kind` for
//      copying an object on the stack — `copyPermanent` (interfaces.ts,
//      `CardFactory.copyCard`) only copies a PERMANENT already on the
//      battlefield (Clone-style), and `kind:'counter'` (interfaces.ts'
//      own `counter` doc comment) only logs "a spell was countered," no
//      stack-object model exists to duplicate an object off of in the
//      first place. Checked the whole pool for a prior spell-copy card —
//      none exists; this is genuinely new, not a rediscovered solved gap.
// Both would be required together (an event-keyed delayed trigger THAT
// itself runs a spell-copy effect) — building either alone wouldn't make
// this ability real. Left as an honest gap: no Fact, no Effect, no
// `triggers` entry invented for it. See progress.json's `knownGaps`.
export const ether: CardDefinition = {
  name: 'Ether',
  manaCost: '{3}{U}',
  typeLine: 'Artifact',

  activationCost: '{T}, Exile this artifact',
  effects: [{ kind: 'addMana', color: 'U', amount: 1 } satisfies Effect],
};
