// Shared shapes for the `PRD_AUTOMATED_AUTHORING.md` recognizer-library
// prototype (2026-09-13) — see that PRD's "Design" section for the
// provenance rationale this mirrors. Deliberately its own small module, not
// folded into `synergy.ts`: a recognizer's OWN input/output contract is
// narrower than anything `synergy.ts` already exports, and keeping it
// separate means this whole prototype can be deleted/reworked later without
// touching the real matching engine at all.
import type { AnnotationRef, Fact, FactProvenance } from '../synergy';

/**
 * One real card FACE's worth of the only two things a recognizer is allowed
 * to look at: its own printed type line and its own printed oracle text body
 * (never live game state, never another face's text — see each recognizer's
 * own doc comment for why cross-face leakage is a real false-positive risk,
 * not a hypothetical one). `name` is carried through only so a recognizer can
 * check for the card's own name appearing as the grammatical subject of a
 * clause (Zack Fair's "Zack Fair enters with a +1/+1 counter on it," as
 * opposed to "This creature enters ...") — never used as a match target
 * itself.
 */
export interface RecognizerInput {
  name: string;
  typeLine: string;
  /** This face's own oracle text body. Empty string for a face with no
   * printed ability text at all (a vanilla creature) — never `undefined`,
   * so a recognizer never has to null-check before running a regex. */
  oracleText: string;
  /**
   * True when this face is `CardDefinition.backFace` (`card.ts`'s own doc
   * comment: "a transforming DFC's back face") — set by the caller
   * (`apply-recognizers.mjs`'s own `faces` array construction, mirrored by
   * a plain-TEXT recognizer's own `.test.ts`-local `faceOf` helper, e.g.
   * `dies-trigger-structural.test.ts`'s/`attacks-trigger-structural.test
   * .ts`'s/`lifegain-trigger-structural.test.ts`'s own copies —
   * `recognizers.test.ts` itself, which used to define the original copy of
   * this helper for the two now-retired original text-only recognizers
   * (Recognizers A/B), was deleted 2026-09-14 once both had nothing left to
   * test) from its own already-tracked `face: 'front' | 'back'`, never
   * derived independently here.
   *
   * **Confirmed NOT a universal "this face is never independently cast"
   * signal** (2026-09-13, direct pool scan for the
   * `permanent-enters-battlefield-normally` overclaim bug below) — `card.ts`'s
   * doc comment notwithstanding, `backFace` is also reused, deliberately and
   * documented as such, for a handful of real Adventure-layout cards
   * (`thranduil-sindarin-liege-silvan-rally`'s own module doc comment: "the
   * REAL cast order/timing is reversed from a transform DFC"), whose own
   * back face (the Adventure spell) genuinely IS cast independently from
   * hand. Only safe to gate a recognizer on this flag when that recognizer
   * ALSO independently confirms the face is permanent-typed first (every
   * real Adventure back face in this pool is `Instant`/`Sorcery`, never a
   * permanent type, so the two checks never actually conflict today — but a
   * recognizer relying on `isBackFace` alone, with no type gate of its own,
   * would be wrong to assume it always means "entered via transform, never
   * cast"). `permanent-enters-battlefield-normally.ts` used to be the one
   * recognizer that read this flag (retired 2026-09-14 — see
   * `functional-model/synergy.ts`'s `isNormalPermanent` doc comment for
   * where its job went); no recognizer currently registered in
   * `apply-recognizers.mjs` reads `isBackFace` today. Kept on this shared
   * input shape rather than removed, in case a future recognizer needs it.
   */
  isBackFace?: boolean;
}

/** Which finite catalog entry produced a fact — see `types.ts`'s own module
 * doc comment. Widen this union, never invent a differently-shaped
 * provenance object, when a third recognizer is added — the whole point is
 * one small enum a future "rule review" pass (PRD's own parked idea) can
 * enumerate exhaustively. */
export type RecognizerId =
  // 'permanent-enters-battlefield-normally' retired 2026-09-14 — its job
  // (a normal permanent's self-cast/self-entersBattlefield fact pair) is
  // now synthesized at match time (`functional-model/synergy.ts`'s
  // `isNormalPermanent`), never stored as a `Fact.provenance.rule` value —
  // removed from this union rather than kept as a dead entry, since a
  // fact carrying this string can no longer exist anywhere in the pool.
  //
  // 'instant-sorcery-resolves-to-graveyard' retired 2026-09-14, same day,
  // third instance of this exact pattern — its job (a normal Instant/
  // Sorcery's self-cast-from-Hand/self-graveyard fact pair) is now
  // synthesized at match time (`functional-model/synergy.ts`'s
  // `isNormalInstantOrSorcery`), never stored as a `Fact.provenance.rule`
  // value — removed from this union the same way, for the same reason.
  | 'destroy-effect-structural'
  | 'drawCard-effect-structural'
  | 'saga-lore-and-sacrifice-structural'
  | 'dies-trigger-structural'
  | 'lifegain-trigger-structural'
  | 'dealDamage-effect-structural'
  | 'putCounter-broadcast-structural'
  | 'attacks-trigger-structural'
  | 'putCounterTarget-effect-structural'
  | 'addMana-effect-structural'
  | 'putCounterSelf-effect-structural'
  | 'putCounterMagnitude-clause-structural'
  // 2026-09-14 follow-up (fin/3-10 mechanization pass, closing several of
  // these 7 cards' own remaining unprovenanced facts) — `landfall-trigger-
  // structural`/`attacks-trigger-structural`-family text recognizers,
  // `flashback-alternateCost-structural`/`ptFormula-scalingPump-structural`/
  // `triggerDoubling-selfAndAttachedEquipment-structural` (all 3 read a
  // CARD-DEFINITION-LEVEL structured field, same family as `saga-lore-and-
  // sacrifice-structural`), and `gainLife-effect-structural`/`digReveal-
  // effect-structural` (both structural, same family as `destroy-effect-
  // structural`/`putCounterSelf-effect-structural`).
  | 'landfall-trigger-structural'
  | 'flashback-alternateCost-structural'
  | 'gainLife-effect-structural'
  | 'ptFormula-scalingPump-structural'
  | 'digReveal-effect-structural'
  | 'triggerDoubling-selfAndAttachedEquipment-structural'
  // 2026-09-15 follow-up (fin/5,6,7,8,9,10 recognizer-coverage batch,
  // closing the last of these cards' own remaining AI-authored facts):
  // `moveSearchLibrary-effect-structural` (untargeted "search library, put
  // in hand" template), `move-effect-structural` (finally wired into the
  // real pipeline — it existed since 2026-09-14 but was never registered),
  // `entersBattlefield-self-trigger-structural`, `pumpSelf-effect-
  // structural`, `pumpTarget-effect-structural`, `pumpAllAttacking-effect-
  // structural`, `selectUpTo-effect-structural`, `token-creation-
  // structural`.
  | 'moveSearchLibrary-effect-structural'
  | 'move-effect-structural'
  | 'entersBattlefield-self-trigger-structural'
  | 'pumpSelf-effect-structural'
  | 'pumpTarget-effect-structural'
  | 'pumpAllAttacking-effect-structural'
  | 'selectUpTo-effect-structural'
  | 'token-creation-structural'
  // 2026-09-15 follow-up (fin/11-15 audit — cloudbound-moogle/fin-11's own
  // last remaining AI-authored fact).
  | 'discardSelfCost-structural'
  // 2026-09-15 follow-up (fin/11-15 audit — Coeurl/fin-12's own AI-
  // authored tap-target facts).
  | 'tapTarget-effect-structural'
  | 'tapSelfCost-structural'
  | 'continuousPTGrantsEquipped-structural'
  | 'sequenceExileReturn-effect-structural'
  | 'tapAllQuery-effect-structural'
  | 'equipmentWantsCreature-sink-structural'
  | 'preventDamageAll-effect-structural'
  | 'moveSearchLibraryOrGraveyard-effect-structural'
  // 2026-09-15 follow-up (fin/16-25 AI-fact-elimination pass): 3 more
  // CARD-DEFINITION-LEVEL siblings of `continuousPTGrantsEquipped-structural`
  // plus a STRUCTURAL `kind:'grantKeywordAll'` recognizer — see each file's
  // own module doc comment.
  | 'continuousTypeGrantsEquipped-structural'
  | 'continuousKeywordGrantsEquipped-structural'
  | 'continuousKeywordGrantsSubtype-structural'
  | 'grantKeywordAll-effect-structural'
  | 'jobSelectCreateTokenAndEquip-effect-structural'
  | 'costReductionTappedTarget-structural'
  | 'moveConditionalDestinationByCastFrom-effect-structural'
  // G'raha Tia's own remaining unprovenanced sink — a genuinely BROADER
  // sibling of `dies-trigger-structural`'s self-only precondition (see that
  // file's own module doc comment for why it correctly declines this case,
  // and this recognizer's own doc comment for the split).
  | 'diesOtherPermanentsOncePerTurn-trigger-structural'
  // Magitek Infantry's own remaining unprovenanced move source+sink —
  // `move.name:'self'`/`move.tapped`'s own real sibling recognizer.
  | 'moveSearchLibraryNamedSelf-effect-structural'
  // `CardDefinition.crewCost`'s own real recognizer (8 real Vehicle cards,
  // 2 of which — The Regalia/adventurer-s-airship/balamb-garden — had NO
  // crew fact of any kind before this pass).
  | 'crewCost-structural'
  // `kind:'animate', target:'self'`'s own real Creature-grant sibling —
  // same 8-card Vehicle family `crewCost-structural` covers.
  | 'animateSelfCreature-effect-structural'
  // `CardDefinition.manaAbilities`'s own real "simple" recognizer (fin/26-50
  // pass) — see that recognizer's own module doc comment for the 3
  // confirmed English templates and the whole-pool scope gate.
  | 'manaAbilitiesSimple-structural'
  // `kind:'pumpAll', predicate:'creatures-you-control'`'s own real
  // recognizer (fin/26-50 pass) — direct sibling of `grantKeywordAll-
  // effect-structural`/`pumpAllAttacking-effect-structural`.
  | 'pumpAllCreaturesYouControl-effect-structural'
  // "Sacrifice a/an <Type>" cost-text recognizer (fin/26-50 pass) — see
  // that recognizer's own module doc comment for the 4-way real English
  // shape split and why only this one is in scope.
  | 'sacrificeCostNamedType-structural'
  // "Sacrifice <named self>"/"Sacrifice this <type>" self-sacrifice-as-cost
  // recognizer (2026-09-16, recognizer-lane triage) — the real 4th shape
  // `sacrificeCostNamedType-structural.ts`'s own module doc comment already
  // named and deliberately declined; see this recognizer's own module doc
  // comment for the real 6-card whole-pool check.
  | 'sacrificeSelfCost-structural'
  // "Exile this <type>" self-exile-as-cost recognizer (2026-09-16,
  // recognizer-lane triage), same family/day as `sacrificeSelfCost-
  // structural` above, real 3-card whole-pool check (ether/elixir/
  // phoenix-down) — see that recognizer's own module doc comment.
  | 'exileSelfCost-structural'
  // `kind:'putCounterAll'`'s own declarative-Effect sibling of
  // `putCounter-broadcast-structural` (that one covers the identical Fact
  // shape but for a `kind:'custom'` closure) — fin/26-50 pass.
  | 'putCounterAll-effect-structural'
  // `kind:'surveil'`'s own real recognizer (fin/26-50 pass) — 12-card real
  // pool sweep, see that recognizer's own module doc comment.
  | 'surveil-effect-structural'
  // `kind:'grantKeywordTarget'`'s own real recognizer (fin/26-50 pass) —
  // direct sibling of `grantKeywordAll-effect-structural`/`pumpTarget-
  // effect-structural`, see that recognizer's own module doc comment.
  | 'grantKeywordTarget-effect-structural'
  // `ptFormula.kind:'setToCreaturesControlled'`'s own real recognizer
  // (fin/26-50 pass, Snow Villiers — the only real pool card).
  | 'ptFormulaSetToCreaturesControlled-structural'
  | 'dealDamageTarget-effect-structural'
  | 'spellCostReductionGrants-structural'
  | 'lifegainDoubleKeyword-structural'
  // 2026-09-16 (card-results/fin-51-75 triage backlog): `kind:'sacrifice'`/
  // `kind:'discard'` bare resolution-effect siblings of `destroy-effect-
  // structural`/`drawCard-effect-structural` (the backlog's own biggest
  // and second-biggest wins), plus 3 smaller items from the same backlog —
  // see each recognizer's own module doc comment.
  | 'sacrifice-effect-structural'
  | 'discard-effect-structural'
  | 'untapTarget-effect-structural'
  | 'grantKeywordSelf-effect-structural'
  | 'playFromLibraryTop-effect-structural'
  // `kind:'tapAll'`'s own bare-Effect sibling of `tapAllQuery-effect-
  // structural` (that one covers the identical real occurrence's own
  // combinator-wrapped shape for a DIFFERENT card; this one reads the
  // direct declarative Effect kind Jill/Shiva's own chapter III uses).
  | 'tapAll-effect-structural'
  // `Trigger.name`-keyed `onCast<Type>Spell` family (2026-09-16, fin/26-50
  // re-triage) — a real sibling of `attacks-trigger-structural`/`dies-
  // trigger-structural`/`landfall-trigger-structural`/`lifegain-trigger-
  // structural`, see this recognizer's own module doc comment for the full
  // 8-card real-pool sweep and why it's keyed on `Trigger.name` rather than a
  // bare oracle-text scan.
  | 'castTypeSpell-trigger-structural'
  // `kind:'program'` `SelectUpTo`->`ApplyToBound(gainControl)` single-step
  // shape (2026-09-16, fin/26-50 re-triage) — `stiltzkin-moogle-merchant`'s
  // own real "Target opponent gains control of another target permanent you
  // control" — a genuinely different `SelectUpTo` template from
  // `selectUpTo-effect-structural`'s own tap+putCounter shape; see this
  // recognizer's own module doc comment for why `zidane-tantalus-thief`/
  // `stolen-uniform`/`unexpected-request` (the rest of `combinator.ts`'s own
  // named `gainControl` motivating group) are deliberately NOT covered by
  // this same recognizer.
  | 'selectUpToGainControl-effect-structural'
  // `program-ast-walker.ts`'s own general `kind:'program'` AST walk, 4 real
  // consumers (2026-09-16, program-AST generalization pass; `pumpProgram-`/
  // `dealDamageEachMagnitude-` added the same day, `'pump'`/`'dealDamage'`
  // occurrence-support follow-up) — see that walker's own module doc
  // comment for the shared machinery all four build on.
  | 'destroyProgram-effect-structural'
  | 'equipProgram-effect-structural'
  | 'pumpProgram-effect-structural'
  | 'dealDamageEachMagnitude-effect-structural'
  // 2026-09-16 (engine-lane primitive build, Venat/Hydaelyn's own Blessing
  // of Light) — `kind:'putCounter'`/`'grantKeyword'` program-AST occurrence
  // support, plus the new bare `DrawCard` ProgramNode's own recognizer.
  | 'putCounterProgram-effect-structural'
  | 'grantKeywordProgram-effect-structural'
  | 'drawCardProgram-effect-structural'
  // 2026-09-16 (card-results/fin-76-100 re-triage backlog): `kind:
  // 'loseLife'`'s own real sibling of `gainLife-effect-structural`, `kind:
  // 'counter'`'s own real recognizer, and The Water Crystal's own real
  // `kind:'mill'`/`millModifierGrants` pair (ENGINE_GAPS.md gap #19,
  // closed) — see each recognizer's own module doc comment.
  | 'loseLife-effect-structural'
  | 'counter-effect-structural'
  | 'mill-effect-structural'
  | 'millModifierGrants-structural'
  // Cecil, Dark Knight // Cecil, Redeemed Paladin's back face migration
  // follow-up (engine-core, 2026-09-16) — the `'attacking-creatures'`
  // predicate's own real `grantKeywordAll` sibling of `pumpAllAttacking-
  // effect-structural`.
  | 'grantKeywordAllAttacking-effect-structural'
  // "At the beginning of combat on your turn," trigger-precondition text
  // recognizer (2026-09-16, weapons-vendor's own remaining coverage gap) —
  // same plain-TEXT family as `attacks-trigger-structural`/`dies-trigger-
  // structural`, a real pool-wide recurring clause (6 real cards) with no
  // prior recognizer at all — see that recognizer's own module doc comment
  // for the full whole-pool sweep.
  | 'beginCombat-trigger-structural'
  // `'TwoHeadedCoin'` keyword's own real recognizer (2026-09-16,
  // card-results-lane recognizer escalation) — direct sibling of
  // `lifegainDoubleKeyword-structural`, see that recognizer's own module
  // doc comment for the single real pool card (Edgar, King of Figaro).
  | 'winCoinFlip-structural'
  // "Whenever you scry or surveil," trigger-precondition text recognizer
  // (2026-09-16, card-results-lane recognizer escalation) — same plain-TEXT
  // family as `lifegain-trigger-structural`, sole real pool motivator
  // Matoya, Archon Elder (fin/62) — see that recognizer's own module doc
  // comment.
  //
  // NOTE: `flashback-alternateCost-structural`'s own bare-`Flashback
  // {cost}` fallback branch and `putCounterTarget-effect-structural`'s own
  // pronoun-carryover branch (both 2026-09-16, card-results-lane recognizer
  // escalation) reuse their EXISTING rule ids above — new branches inside
  // the same file/rule, not new recognizers, so neither needs a new id here.
  | 'scryOrSurveilTrigger-structural'
  // A named `onXEnters` trigger's own type-filter sink recognizer
  // (2026-09-16, card-results-lane recognizer escalation) — 3 real pool
  // cards (rook-turret, loporrit-scout, woodland-weavemaster).
  | 'entersTriggerTypeFilter-sink-structural';

/**
 * `FactProvenance` itself is now DEFINED on `Fact` (`synergy.ts`, wired in
 * 2026-09-13 by `scripts/apply-recognizers.mjs` — this prototype's own
 * "real pipeline" follow-up) rather than owned by this file — see that
 * interface's own doc comment for the full rationale (same "rides alongside
 * a Fact, never forks its vocabulary" precedent this file's own doc comment
 * used to describe here). Re-exported via the `import type` above so every
 * recognizer file keeps importing it from this one small module rather than
 * reaching into `synergy.ts` directly for what is, from a recognizer's own
 * point of view, plain provenance plumbing — same treatment `toLineOffset`
 * already gets below.
 */
export type { FactProvenance };

/** One fact a recognizer decided to claim, bundled with its provenance —
 * `role` kept alongside rather than folded into `fact` since both real
 * recognizers below only ever produce `'source'` facts (see each one's own
 * doc comment on why a sink-shaped claim never applies to this boilerplate),
 * but `Fact.role` itself is the on-disk-omitted field (`SynergyFile`'s own
 * `Omit<Fact, 'role'>` — role is implied by which array a fact sits in), so
 * a `RecognizedFact`'s own `fact` mirrors that same omission. */
export interface RecognizedFact {
  role: 'source' | 'sink';
  fact: Omit<Fact, 'role'>;
  provenance: FactProvenance;
}

/**
 * A recognizer's own verdict — `matched: false` always carries a real
 * `reason` (never a bare boolean) precisely so a future "rule review" pass,
 * or just a human staring at a declined card, can tell WHY without having to
 * re-run the regex by hand. Conservative by construction (see
 * `PRD_AUTOMATED_AUTHORING.md`'s Design section): every recognizer below
 * defaults to declining and only matches when it's positively sure, never
 * the reverse.
 *
 * **`kind` (2026-09-13, `apply-recognizers.mjs`'s own hard-fail-on-mismatch
 * pass)** — lets the CALLER, not just a human reading `reason`'s prose,
 * branch on WHY a decline happened. Two real, genuinely different reasons:
 *   - `'scope'` (the default, used whenever `kind` is omitted — every
 *     existing text-only recognizer (A/B) and every OTHER decline path in the
 *     structural recognizers (C/D/E) stays here, unchanged): no structural
 *     basis to even build a pattern at all — a non-literal `Computed<...>`
 *     field, an `owner`-restricted effect, a value with no confirmed
 *     template, a `custom`-effect wall, etc. Correct, silent, permanent — a
 *     recognizer that will never have anything to say about this card, not
 *     a bug.
 *   - `'mismatch'`: a pattern WAS successfully built from the card's own
 *     structured data, but checking it against that face's REAL oracle text
 *     found either zero matches or 2+ ambiguous matches. This means the
 *     recognizer's own model of "what this effect should read like in
 *     English" diverged from what the card actually prints — either a real
 *     recognizer bug, or a real, legitimate case where the structured
 *     `Effect` is a narrower/wider approximation of the card's real prose
 *     (see `destroy-effect-structural.ts`/`drawCard-effect-structural.ts`'s
 *     own module doc comments for real, confirmed examples of each). Only
 *     the specific "built a pattern, `oracleText.matchAll` found 0 or 2+
 *     matches" decline paths in those two recognizers return this — nothing
 *     else does. `apply-recognizers.mjs` hard-fails the whole run on any
 *     unresolved `'mismatch'` (see that script's own header), unless a
 *     per-card `// recognizer-exception: <rule>` marker in the card's own
 *     `definition.ts` explicitly suppresses that specific card+rule pair.
 */
export type RecognizerResult =
  | { matched: true; facts: RecognizedFact[] }
  | { matched: false; reason: string; kind?: 'scope' | 'mismatch' };

/** Builds one line-relative `AnnotationRef` from an absolute `[start, end)`
 * character offset into a face's own oracle text — thin re-export of
 * `synergy.ts`'s own `toLineOffset` (see that function's own doc comment for
 * why it's exported specifically for this prototype) so every recognizer
 * imports it from one place instead of reaching into `synergy.ts` directly
 * for what is, from a recognizer's point of view, plain annotation
 * plumbing. */
export { toLineOffset } from '../synergy';

/**
 * Recognizer ids whose match is entirely predictable from a card's own
 * printed type/supertype alone, with zero card-specific judgment involved
 * (e.g. every Saga gets CR 714's lore-counter/sacrifice/dies facts purely by
 * being a Saga) — as opposed to a match that required reading THAT card's
 * own specific written ability content. Originally authored 2026-09-14 (`ui`
 * agent, recognizer-coverage page's "hide busywork Saga review rows"
 * feature) as a local constant in `server/api/recognizers/index.get.ts`;
 * hoisted here the same day (`card` agent, card-page Facts-tab "Show
 * type-derived facts" checkbox) so BOTH that server route and the card
 * page's own client-side Facts tab import the exact same classification
 * instead of each hand-keeping a copy that could drift. Lives here (not in
 * `server/api/recognizer-source/[rule].get.ts`, which already hand-keeps the
 * sibling `RECOGNIZER_IDS` id list) specifically because that file pulls in
 * `node:fs`/`node:path` at module scope — fine for a server-only route, but
 * this module also needs to be safely importable from a plain client-side
 * Vue page (this app's `/app` pages are SPA-only), and this file (like
 * `../synergy`, which it already re-exports pieces of) has no Node-only
 * imports.
 *
 * Checked directly against the real pool (every recognizer file's own
 * module doc comment, 2026-09-14): today only
 * `'saga-lore-and-sacrifice-structural'` qualifies, and it qualifies for
 * EVERY real match it has (both its "3-fact" and its rarer "1-fact,
 * sacrifice+dies pair conservatively declined" matches are equally
 * structural). Every other recognizer keys off that SPECIFIC card's own
 * written effect/trigger content, or requires an ABSENCE of override text
 * specific to that card, so none of their matches qualify — see
 * `server/api/recognizers/index.get.ts`'s own (more detailed) header
 * comment for the full per-recognizer reasoning; not re-derived here to
 * avoid a second copy of that same analysis going stale independently.
 *
 * A plain `Set<string>` (not `Set<RecognizerId>`), matching `Fact.provenance
 * .rule`'s own type (`synergy.ts`: "a plain `string`, not `recognizers/
 * types.ts`'s own narrower `RecognizerId` union") — the whole point of this
 * constant is to be checked against a served `Fact`'s `provenance.rule`,
 * which is untyped-narrower than `RecognizerId` by design.
 */
export const TYPE_DERIVED_RECOGNIZER_IDS: ReadonlySet<string> = new Set<string>(['saga-lore-and-sacrifice-structural']);
