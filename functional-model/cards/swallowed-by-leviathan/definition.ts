import type { CardDefinition, Effect } from '../../card';

// Real oracle text (data/fin/fin_scryfall.json, fin/79, {2}{U} Instant):
// "Choose target spell. Surveil 2, then counter the chosen spell unless its
// controller pays {1} for each card in your graveyard. (To surveil 2, look
// at the top two cards of your library, then put any number of them into
// your graveyard and the rest on top of your library in any order.)"
//
// Two real, already-promoted, already-wired pieces of vocabulary cover this
// card end to end — no new engine work needed:
//   - `kind: 'surveil'` (`card.ts`, promoted by dreams-of-laguna/il-mheg-pixie/
//     matoya-archon-elder) — log-only, no real library-reordering model (see
//     `interfaces.ts`'s own `surveil` doc comment).
//   - `kind: 'counter'` (`card.ts`, promoted by louisoix-s-sacrifice) —
//     log-only, `describe` records WHAT gets countered since there's no real
//     stack/object model to remove a target from at all.
//
// "unless its controller pays {1} for each card in your graveyard" is a
// real CR 601.2b/RUL-style conditional-tax clause with a genuine opponent
// decision point (pay or don't) keyed on a LIVE count of MY OWN graveyard —
// checked the pool for precedent (Syncopate, fin/80, "Counter target spell
// unless its controller pays {X}", is NOT present in this pool as of this
// authoring — no sibling card to borrow a treatment from) and checked the
// engine surface directly: `priority.ts`'s own header already documents "no
// AI / player decision process" as an accepted, general simplification (every
// round's choices are supplied by the caller, not decided by anything in this
// codebase) — there is no "pay N or else" branching primitive anywhere in
// `card.ts`/`engine.ts` (grepped for `unless`/`payOrElse`/`optionalPay`: none
// exist), so a genuine mid-resolution "does the opponent choose to pay"
// choice can't be modeled as a real conditional branch here. Modeled as an
// honest, single unconditional `counter` (same shape Louisoix's Sacrifice's
// own `describe` already uses for its own real "Counter target activated
// ability, triggered ability, or noncreature spell" text) whose `describe`
// records the FULL real tax clause as text, not just "counter it" — the
// engine always counters when this effect runs (an accepted simplification,
// not a claim that the tax doesn't exist); see progress.json's `knownGaps`
// for the precise gap.
export const swallowedByLeviathan: CardDefinition = {
  name: 'Swallowed by Leviathan',
  manaCost: '{2}{U}',
  typeLine: 'Instant',

  effects: [
    { kind: 'surveil', qty: 2 } satisfies Effect,
    {
      kind: 'counter',
      describe: "Counter the chosen spell unless its controller pays {1} for each card in your graveyard.",
    } satisfies Effect,
  ],
};
