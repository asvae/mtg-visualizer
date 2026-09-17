// Per-card FIN dashboard classification — 8 mutually-exclusive buckets
// answering "how far along is this card's functional-model authoring?" for
// a set-scoped status page (FIN today, generalizes to any set later since
// nothing here is FIN-specific). Pure decision logic only, no fs/dynamic
// import — same "zero runtime dependency, cheap to import from a live
// server route" design goal `synergy.ts`'s own header states for itself
// (type-only `CardDefinition`/`Effect` import below). The fs/dynamic-import
// orchestration (reading `data/fin/fin_scryfall.json`, dynamically
// importing each `cards/<slug>/definition.ts`, reading `synergy.json`,
// calling `computeTextCoverage`) lives in `scripts/compute-card-status.mjs`,
// the actual entry point (`npm run card-status`) — see that script's own
// header for the full pipeline and where its output is persisted.
//
// **Priority order (top-down, first match wins)** — a card that could
// arguably satisfy more than one bucket's raw criteria still gets exactly
// one status:
//   1. `red`      — definition.ts contains a real, structural marker of an
//      unsupported/not-modeled construct (see `findUnsupportedConstructs`).
//   2. `gray`     — checked BEFORE orange/green/yellow/verified/uncertain,
//      not after, despite being listed last in the originating task spec: a
//      card with zero real facts can't meaningfully be asked "do your facts
//      have provenance" or "do your facts cover the text" at all (both
//      questions are vacuously true/false for an empty fact list, which
//      would otherwise misfile every genuinely untouched card as a
//      deceptively-clean "yellow"). Treated as a precondition, not a
//      same-tier alternative — see this file's own `classifyCardStatus`
//      doc comment for the full reasoning.
//   3. `orange`   — has >=1 fact with no `provenance` (hand/agent-authored).
//   4. `green`/`yellow` — every fact IS provenance-tagged; split by whether
//      `computeTextCoverage` (text-coverage.mjs) finds any real, substantial
//      uncovered oracle-text span left.
//   5. `re-review` — a NARROWING of the `green` case only (2026-09-17), and
//      checked BEFORE both the `uncertain` and `verified` narrowings below
//      (see the priority-vs-`uncertain` note under bullet 6): when the
//      above would otherwise produce `green` AND the card's own
//      `progress.json` has `review: 'regression'` (threaded in via
//      `ClassifyCardStatusInput.review`), the status becomes `re-review`
//      instead of `green`. `review: 'regression'` is written by exactly ONE
//      code path in this whole pool — `scripts/check-verified-
//      regressions.mjs`'s own auto-detection: this card WAS `review:
//      'human'`-confirmed at some point (a real `cards/<slug>/verified-
//      snapshot.json` exists, captured the moment a human confirmed it —
//      see `server/api/card/review-status.ts`'s own snapshot-capture
//      comment), but that script's structural diff found the card's
//      CURRENT `synergy.json`/`annotatedNonFactSpans` has since drifted
//      away from the frozen snapshot. This is deliberately a DIFFERENT,
//      distinguishable value from plain `'ai'` — a card that regresses from
//      a real, deliberate human confirmation must never silently look
//      identical (bucket-wise) to a card nobody has ever reviewed at all;
//      both would otherwise collapse to the same `review: 'ai'` value with
//      no way to tell them apart. `'regression'` is ONLY ever written by
//      that one automatic detection path — never by a human/agent hand-
//      editing `progress.json`, and never by the manual "Unconfirm" UI
//      action (`server/api/card/review-status.ts`'s `field:'review',
//      reviewed:false`), which always writes plain `'ai'` regardless of the
//      prior value (a deliberate human un-confirm is not the same signal as
//      an automatic drift-detection). A fresh confirm (`reviewed:true`) on
//      a `'regression'`-state card transitions it back to `'human'` the
//      same as confirming a plain `'ai'` card — "I looked at the CURRENT
//      state and it's good" always means the same thing, regardless of
//      what the field said before. Same "only narrows an otherwise-green
//      outcome" discipline `verified`/`uncertain` already established —
//      does NOT touch yellow/orange/red/gray: a card that has regressed all
//      the way to a real coverage gap is already correctly flagged by that
//      gap itself (missing provenance, an uncovered span, an unsupported
//      construct), and layering `re-review` on top of an already-actionable
//      bucket would be noise, not signal — the same reasoning `uncertain`'s
//      own doc comment below already gives for itself, extended here
//      rather than re-litigated.
//   6. `uncertain` — ALSO a narrowing of the `green` case only (2026-09-17),
//      but checked AFTER `re-review` (so `re-review` wins when a card
//      somehow carries both signals at once — see the priority note below)
//      and BEFORE the `verified` upgrade (so it still wins over an already-
//      `human`-reviewed card, not just a plain automated-green one): when
//      the above would otherwise produce `green` AND the card's own
//      `progress.json` carries a non-empty `reviewCaveat` (threaded in via
//      `ClassifyCardStatusInput.reviewCaveat`), the status becomes
//      `uncertain` instead of `green`/`verified`. A `reviewCaveat` is a
//      human (or an agent acting on a human's explicit direction) writing
//      down one SPECIFIC, real conceptual gap that can't currently be
//      modeled as a `Fact` at all — not a text-coverage gap (those are
//      already yellow/orange, and are DIFFERENT from this: the oracle text
//      here can be 100% annotation-covered already) but a missing piece of
//      Fact *vocabulary* itself (e.g. Cloud, Midgar Mercenary's own
//      trigger-doubling static has zero generic "this is a triggered
//      ability" Fact category to model the doubling EFFECT as a produce/
//      consume relation, even though its two real sink facts for the
//      doubling CONDITION are fully recognizer-derived and fully text-
//      covered). This is a STRONGER, more specific signal than a plain
//      `review: 'human'` confirmation — a caveat says "I looked at this and
//      I can tell you exactly what's still missing that green/verified
//      can't see," which is more informative than "I looked at this and
//      it's fine" — so a caveat wins even over an already-`human`-reviewed
//      card (a card can be BOTH `review: 'human'` AND carry a
//      `reviewCaveat`; the caveat's `uncertain` result wins, per the
//      originating task's own explicit "priority OVER `review:'human'`"
//      call).
//
//      **`re-review` vs `uncertain` priority**, for a card that could
//      arguably satisfy both (once `'human'`-reviewed with a caveat noted,
//      then its content drifted — so it's now BOTH `review: 'regression'`
//      AND still carries that old `reviewCaveat`): `re-review` wins.
//      Reasoning: `uncertain`'s caveat says "you already know about this
//      ONE specific, still-unmodelable gap, nothing else is wrong" — a
//      claim about a static vocabulary limitation that doesn't go stale
//      just because time passes. `re-review`'s signal is "the content
//      itself has physically changed since a human last looked at ANY of
//      it" — which means the caveat's own "nothing else is wrong" half of
//      its claim is no longer trustworthy either; the human needs to
//      re-look at the whole card, caveat included, not just trust that the
//      old caveat still describes the current state. The more urgent,
//      broader-scope signal (something changed, go look again) subsumes
//      the narrower, now-potentially-stale one (here's the one known gap).
//
//      Both `re-review` and `uncertain` deliberately do NOT apply to
//      `yellow`/`orange`/`red`/`gray` — same "only narrows an otherwise-
//      green outcome" discipline `verified` already established, for a
//      stronger reason than mere consistency: both signals are only
//      meaningful once the card has actually reached full *mechanical*
//      completeness under the ordinary track (provenanced + fully text-
//      covered). On a yellow/orange/red/gray card there is still a real,
//      ordinary, actionable gap the normal bucket already names (missing
//      provenance, an uncovered span, an unsupported construct, or no
//      authoring at all) — consulting either signal there would either
//      mask that real gap behind a differently-colored one or make the
//      card look MORE reviewed than it is, exactly the failure mode
//      `verified`'s own doc comment already rules out for stale `'human'`
//      values. A `review: 'regression'`/`reviewCaveat` on such a card is
//      simply ignored by the classifier (never bumps the bucket up OR
//      down) — both fields can still be present in `progress.json`, they
//      just have no classification effect until the card earns its way to
//      green/verified on the ordinary track first.
//   7. `verified` — a NARROWING of the `green` case only (2026-09-16), never
//      a separate top-level branch checked before red/gray/orange: when the
//      above would otherwise produce `green` AND the card's own
//      `progress.json` has `review: 'human'` (threaded in via
//      `ClassifyCardStatusInput.review`), the status is upgraded from
//      `green` to `verified` — a human has actually reviewed this card's
//      already-complete facts, a step beyond mere automated completeness.
//      `yellow`/`orange`/`red`/`gray` are never upgraded this way, even if
//      `review` happens to be `'human'` on such a card (stale/pending
//      review of content that has since regressed) — only a genuinely
//      clean `green` card can become `verified`.
import type { CardDefinition, Effect } from './card';

export type CardStatusBucket = 'verified' | 'uncertain' | 're-review' | 'green' | 'yellow' | 'orange' | 'red' | 'gray';

export interface CardStatusEntry {
  number: string;
  name: string;
  status: CardStatusBucket;
  reasons: string[];
}

/** Loose shape — this module only ever reads `provenance` off a fact, same
 * "only type what's actually read" convention `verify-synergy.mjs`'s own
 * plain-JS `FactLike`-equivalent duplicates already use (that script can't
 * import synergy.ts's real `Fact` type at all, being plain .mjs; this file
 * COULD import it, but deliberately doesn't, to keep this module's own
 * public API independent of synergy.ts's own churn — `Fact.provenance` has
 * been stable since 2026-09-13 and is the one field this bucket check
 * needs). */
export interface FactLike {
  provenance?: { origin?: string; rule?: string };
}

export interface SynergyLike {
  source?: FactLike[];
  sink?: FactLike[];
}

/** `text-coverage.mjs`'s own `computeTextCoverage` return shape, duplicated
 * here as a type only (that script is plain .mjs, no exported types to
 * import) — same "small stable duplicate across the fs/no-fs boundary"
 * trade every sibling script in this pool already accepts. */
export interface TextCoverageLike {
  ratio: number;
  gaps: unknown[];
}

/**
 * Every real `Effect` object reachable from a card definition: its own
 * top-level `effects`, every named `triggers[].effects`, every named
 * `abilities[].effects`, every `modal` effect's own `modes[].effects`
 * (recursively, in case a mode itself ever nests another modal), and the
 * same walk repeated across a transforming DFC's own `backFace` — the
 * EXACT traversal `card.ts`'s own `synergyTags()` already performs (see
 * that function's own closing block), just collecting the real `Effect`
 * objects themselves instead of flattened describe/tag strings (this
 * check needs to inspect `effect.run`'s own function identity, which
 * `synergyTags()` never touches).
 */
export function collectEffects(def: CardDefinition): Effect[] {
  const out: Effect[] = [];
  const walkEffect = (effect: Effect): void => {
    out.push(effect);
    if (effect.kind === 'modal') for (const mode of effect.modes) for (const inner of mode.effects) walkEffect(inner);
  };
  const walkDef = (d: CardDefinition): void => {
    for (const effect of d.effects ?? []) walkEffect(effect);
    for (const trigger of d.triggers ?? []) for (const effect of trigger.effects) walkEffect(effect);
    for (const ability of d.abilities ?? []) for (const effect of ability.effects) walkEffect(effect);
    if (d.backFace) walkDef(d.backFace);
  };
  walkDef(def);
  return out;
}

/**
 * True iff `effect` is the pool's own established "documented, genuinely
 * unsupported construct" convention: a `kind:'custom'` effect (card.ts's
 * own "true escape hatch... reach for this only when no combination of
 * the [declarative] variants fits") whose `run` is a literal, real
 * empty-body no-op — `describe` still carries the real oracle-text clause
 * (so `synergyTags()`/this dashboard don't silently lose it), but nothing
 * executes. Confirmed pool-wide, 2026-09-16 (24 raw text hits, ~23 real
 * after excluding one false positive — see below): e.g.
 * `cards/galuf-s-final-act/definition.ts`'s own comment, "no Effect kind
 * exists anywhere in this model for dynamically granting a NEW triggered
 * ability at resolution time."
 *
 * Checked on the REAL, already-imported function object
 * (`Function.prototype.toString()`), never on raw file text — a source-text
 * grep for the literal string `run: () => {}` produces a real, confirmed
 * false positive on `cards/crystal-fragments-summon-alexander/
 * definition.ts`, whose own comment quotes that exact string while
 * documenting that its OWN effect is NOT that anymore (a real
 * `grantKeywordAll` effect today, ENGINE_GAPS.md gap #8 closed) — this
 * function only ever inspects the live object, so it's immune to that
 * class of false positive by construction.
 *
 * Deliberately narrow — a `custom` effect with a REAL `run` body (there are
 * many in this pool, e.g. `sleep-magic`/`white-mage-s-staff`) is a
 * legitimate, functioning escape hatch for genuinely complex logic, not an
 * "unsupported" marker; only the literal no-op shape counts. Likewise
 * `staticAbilities` free text is NOT itself flagged here even when it
 * documents an unmodeled clause (`white-mage-s-staff`'s own granted-
 * triggered-ability gap, e.g., lives ONLY in a code comment beside
 * `staticAbilities`, with no `custom` no-op placeholder at all) — that
 * sub-case has no structural, non-judgment-call marker to check
 * mechanically, so it's a known, accepted blind spot of this check, not
 * silently claimed as covered.
 */
export function isUnsupportedNoOp(effect: Effect): boolean {
  if (effect.kind !== 'custom') return false;
  const src = effect.run.toString();
  // Real body only — everything inside the outermost `{ }` (works for both
  // `(ctx, actions) => { ... }` and `function (ctx, actions) { ... }`
  // shapes, regardless of parameter names/count), comments stripped, then
  // checked for being genuinely empty. Deliberately body-shape-based
  // rather than a whole-signature string match (`() => {}` only) so a
  // no-op written with named-but-unused params (`(ctx, actions) => {}`)
  // still counts.
  const bodyMatch = src.match(/\{([\s\S]*)\}\s*$/);
  // No brace-delimited body at all = an implicit-return single-expression
  // arrow (`(ctx, actions) => actions.tap(ctx.self)`, real pool example:
  // `relentless-x-atm092`) — ALWAYS a real, non-empty expression by
  // construction (`() => undefined` is the only degenerate case, and no
  // real card in this pool writes that), never the no-op marker this
  // checks for. Confirmed load-bearing: an earlier version of this
  // function without this guard misclassified that exact card as `red`.
  if (!bodyMatch) return false;
  const body = bodyMatch[1]
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .trim();
  return body === '';
}

/** Every real, current "unsupported construct" `describe` string this card
 * declares (both faces) — empty array for a card with none. */
export function findUnsupportedConstructs(def: CardDefinition): string[] {
  return collectEffects(def)
    .filter(isUnsupportedNoOp)
    .map((effect) => (effect as Effect & { kind: 'custom' }).describe);
}

function truncate(s: string, max = 90): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export interface ClassifyCardStatusInput {
  number: string;
  name: string;
  /** The real, already dynamically-imported `CardDefinition` — undefined
   * iff no `functional-model/cards/<slug>/definition.ts` could be resolved
   * for this card at all (a genuinely untouched card, see `gray` below). */
  definition: CardDefinition | undefined;
  /** The already-`JSON.parse`d `synergy.json` — undefined iff the file
   * doesn't exist (same `gray` case as a missing `definition`, kept as a
   * separate field since a card dir can exist with `definition.ts` written
   * but no `synergy.json` yet generated). */
  synergy: SynergyLike | undefined;
  /** `computeTextCoverage(synergy, oracleByFace)`'s own return value,
   * already computed by the caller (needs the real Scryfall oracle text,
   * which this module deliberately has no fs access to fetch itself) —
   * undefined iff it couldn't be computed (no oracle text resolved, or no
   * synergy data to check coverage against in the first place). */
  textCoverage: TextCoverageLike | undefined;
  /** The card's own `progress.json`'s real `review` field — 3 real values:
   * `'ai'` (never reviewed, or a human deliberately un-confirmed it via the
   * manual "Unconfirm" UI action), `'human'` (a person reviewed the CURRENT
   * content — per that file's established review-status-reset convention,
   * see `feedback_review_status_reset_on_change` project memory: any
   * authored-content change resets this back to `'ai'`, so `'human'` here
   * always means the CURRENT content, not stale history), or `'regression'`
   * (2026-09-17 — written ONLY by `scripts/check-verified-regressions.mjs`'s
   * own auto-detection: this card WAS `'human'`-confirmed at some point but
   * its content has since drifted from that confirmed snapshot; see this
   * file's own header for the full `re-review`-bucket rationale, including
   * why this is deliberately distinct from a plain `'ai'` — a regression
   * from a real human confirmation must never look identical to a card
   * nobody has ever reviewed). Optional/undefined for a card with no
   * `progress.json` or no `review` field at all — treated the same as
   * `'ai'` (never upgrades to `verified`/`re-review`), not a hard failure.
   * Only ever consulted when the green/yellow branch below would otherwise
   * produce `green` — see this file's own header for the full "verified/
   * re-review narrows green" priority-order rationale. */
  review?: 'ai' | 'human' | 'regression';
  /** The card's own `progress.json`'s real, free-text `reviewCaveat` field
   * (2026-09-17) — a human (or an agent acting on a human's explicit
   * direction) writing down one specific, real conceptual gap that can't
   * currently be modeled as a `Fact` at all (see this file's own header
   * for the full `uncertain`-bucket rationale and the Cloud, Midgar
   * Mercenary motivating example). Optional/undefined for a card with no
   * `progress.json` or no `reviewCaveat` field at all, and an empty/
   * whitespace-only string is treated the same as absent (never triggers
   * `uncertain`) — only ever consulted when the green/yellow branch below
   * would otherwise produce `green` (whether or not `review` is also
   * `'human'`); see this file's own header for the full priority-order
   * rationale, including why a caveat is deliberately ignored on a card
   * that would otherwise be yellow/orange/red/gray. */
  reviewCaveat?: string;
}

/**
 * The single top-down, first-match-wins classifier — see this file's own
 * header for the full priority-order rationale (in particular, why `gray`
 * is checked second despite being listed last in bucket-number order).
 */
export function classifyCardStatus(input: ClassifyCardStatusInput): CardStatusEntry {
  const { number, name, definition, synergy, textCoverage, review, reviewCaveat } = input;
  const trimmedCaveat = reviewCaveat?.trim();

  // 1. red — a real, structural "can't be modeled" marker.
  if (definition) {
    const unsupported = findUnsupportedConstructs(definition);
    if (unsupported.length > 0) {
      return {
        number,
        name,
        status: 'red',
        reasons: unsupported.map((d) => `unsupported construct: ${truncate(d)}`),
      };
    }
  }

  const allFacts = [...(synergy?.source ?? []), ...(synergy?.sink ?? [])];

  // 2. gray — never went through fact extraction at all. Same "all-empty
  // is always 'not yet authored'" convention `verify-synergy.mjs`'s own
  // `isV2Shaped` already established pool-wide (its own comment: "most of
  // the pool is still old-model files... not real v2 authorship — an
  // all-empty file is always reported as 'not yet authored'"), extended
  // here to also cover "no functional-model dir/definition at all."
  if (!definition) {
    return { number, name, status: 'gray', reasons: ['no functional-model card directory found for this card'] };
  }
  if (!synergy) {
    return { number, name, status: 'gray', reasons: ['definition.ts exists but synergy.json has never been generated'] };
  }
  if (allFacts.length === 0) {
    return { number, name, status: 'gray', reasons: ['synergy.json has 0 facts (source and sink both empty) — not yet authored'] };
  }

  // 3. orange — some AI (unprovenanced) facts. Mirrors the exact check
  // `scripts/AI_FACT_ELIMINATION_PROCESS.md`'s own backlog-snapshot query
  // uses: `f.provenance && f.provenance.origin === 'parser'` = recognizer-
  // derived; anything else (missing entirely, or some other origin, though
  // 'parser' is the only value this schema has ever defined) = agent-
  // authored.
  const unprovenanced = allFacts.filter((f) => f.provenance?.origin !== 'parser');
  if (unprovenanced.length > 0) {
    return {
      number,
      name,
      status: 'orange',
      reasons: [`${unprovenanced.length} of ${allFacts.length} fact(s) missing provenance (hand/agent-authored, not recognizer-derived)`],
    };
  }

  // 4. green vs yellow — every fact is provenance-tagged; split on whether
  // `computeTextCoverage` found any real, substantial uncovered span left.
  // Uses `gaps.length === 0` (not `ratio`) as the operative "fully covered"
  // signal — `ratio` is a raw covered-character fraction that can read
  // slightly below 1.0 even with zero real gaps reported (reminder-text/
  // punctuation stripping, `gaps`' own 20+-real-character "substantial"
  // floor); `text-coverage.mjs`'s own header already frames `gaps` as the
  // authoritative "real, substantial, genuinely uncovered clause" signal,
  // `ratio` as a secondary/contextual number.
  if (textCoverage) {
    const pct = Math.round(textCoverage.ratio * 100);
    if (textCoverage.gaps.length === 0) {
      const reason = `${allFacts.length} fact(s), all recognizer-derived; ${pct}% oracle text covered, 0 uncovered spans`;
      // 5. re-review — a NARROWING of this green result, checked BEFORE
      // both `uncertain` and `verified` below (see this file's own header
      // for the full `re-review`-vs-`uncertain` priority rationale): a
      // real, automatically-detected drift since the last human confirm
      // outranks both a stale-but-still-relevant caveat and a plain
      // confirmation.
      if (review === 'regression') {
        return {
          number,
          name,
          status: 're-review',
          reasons: [`${reason}; was previously human-reviewed and verified, but real content has changed since — needs another look`],
        };
      }
      // 6. uncertain — ALSO a narrowing of this green result, checked
      // BEFORE the `verified` upgrade below so it wins even over an
      // already-`human`-reviewed card (see this file's own header for the
      // full "caveat is a stronger signal than a plain human confirmation"
      // rationale).
      if (trimmedCaveat) {
        return { number, name, status: 'uncertain', reasons: [`${reason}; flagged with a known caveat: ${truncate(trimmedCaveat, 200)}`] };
      }
      // 7. verified — a NARROWING of this green result, never a separate
      // top-level branch: only a card that would otherwise be `green` can
      // be upgraded, and only when its own `progress.json` has a real
      // `review: 'human'` (see this file's own header + this field's own
      // doc comment on `ClassifyCardStatusInput.review`).
      if (review === 'human') {
        return { number, name, status: 'verified', reasons: [`${reason}; human-reviewed`] };
      }
      return { number, name, status: 'green', reasons: [reason] };
    }
    return {
      number,
      name,
      status: 'yellow',
      reasons: [`${allFacts.length} fact(s), all recognizer-derived; ${pct}% oracle text covered, ${textCoverage.gaps.length} uncovered span(s)`],
    };
  }

  // No text-coverage signal at all (couldn't resolve real oracle text) —
  // can't claim full coverage without checking, so this is `yellow`, not
  // `green`, by default.
  return {
    number,
    name,
    status: 'yellow',
    reasons: [`${allFacts.length} fact(s), all recognizer-derived; oracle text coverage could not be computed`],
  };
}

// ---------------------------------------------------------------------------
// Display-axis translation (2026-09-18) — NOT a rewrite of the 8-bucket
// classifier above (that stays exactly as-is: still the real per-card
// fact-authoring answer, still what `app/lib/cardStatus.ts`'s own Facts-tab
// strip and `CardDetailTabs.vue` read directly, via the unrelated per-card
// `GET /api/card/:set/:number` route's own `cardStatus` field — untouched by
// this section). This is a pure MAPPING layer from that real 8-bucket
// classification onto the SAME 5-state `gray`/`purple`/`blue`/`yellow`/
// `green` vocabulary `engine-status.ts` (`EngineStatusBaseline`/
// `EngineStatusColor`) and `sink-derivation-status.ts`
// (`SinkDerivationBaseline`/`SinkDerivationColor`) already established for
// their own axes — added so `/app/engine/sets` (`GET /api/card-status/:set`,
// see that route's own doc comment for where this gets applied) renders
// under the exact SAME axis `/app/engine/predicates` and
// `/app/engine/features` already do, replacing that page's previous bespoke
// 8-color scheme. This is now the ONE shared status axis across
// Predicates/Features/Sets.
//
// It also SUPERSEDES an earlier plan detail for the not-yet-built FDN
// authoring pipeline that called for a separate `pipeline-status.json`
// scheme with its own distinct `red` state for "engine capacity missing"
// (that plan detail was only ever discussed, never written to any checked-
// in file — this comment, and this same date's entry in
// `.claude/agent-memory/engine/notes.md`, are now the one place recording
// that it's superseded). Whoever eventually builds real FDN-pipeline status
// tracking should reuse THIS `CardStatusBaseline`/`CardStatusColor` pair (or
// a same-shaped sibling of it, matching `EngineStatusBaseline`/
// `SinkDerivationBaseline`'s own precedent of one small duplicated type pair
// per axis rather than a single shared cross-axis type), NOT invent that
// old 4-state-plus-distinct-red scheme.
//
// Mapping (approximate by design — this task's own explicit instruction:
// "the user does not care about precisely remapping FIN's cards onto the
// new vocabulary... just default fin cards to some low status - I don't
// care" — so this fold optimizes for a reasonable, easy-to-revisit default,
// not bucket-by-bucket precision):
//   gray   <- `red`, `gray`      — nothing usable yet. `red` (a real
//            structural "can't be modeled" marker) is folded WITH `gray`
//            rather than `purple`: a card blocked on a genuine engine-
//            capacity gap is judged functionally as far from usable as one
//            nobody's touched at all, and this file's own "gray/purple are
//            both 'pretend it doesn't exist' for real use" policy (see the
//            "## Policy" section below, right before the type exports)
//            makes the exact gray-vs-purple split for `red` specifically
//            not worth relitigating.
//   purple <- `orange`, `yellow` — has real facts, but not yet BOTH
//            provenance-clean (no AI/hand-authored facts) AND fully text-
//            covered — today's two distinct "almost there" buckets collapse
//            into one "still needs work" bucket.
//   blue   <- `green`            — provenance-clean AND fully text-covered,
//            with no CURRENT human-review opinion attached (or a stale one
//            deliberately dropped, see `re-review` below) — this project's
//            own "fully covered" bar, unreviewed.
//   green  <- `verified`         — `green` PLUS a human explicitly
//            confirmed it — the direct analog of Predicates'/Features' own
//            "Confirmed" review-overlay state, since `verified` already IS
//            exactly that fact for this axis.
//   yellow <- `uncertain`        — `green` PLUS a human flagged one
//            specific known caveat instead of a plain confirmation — the
//            direct analog of Predicates'/Features' own "Rejected (with a
//            required note)" overlay state: the caveat text IS that note.
//   re-review <- `re-review`     — was `verified`/green-quality, then the
//            card's real content drifted since (`scripts/
//            check-verified-regressions.mjs`'s own auto-detected
//            'regression' signal). 2026-09-18: this is now its OWN 6th
//            shared color (`#7dd3fc`, bright/light blue — the exact hex
//            FIN's own now-superseded `re-review`-bucket UI color already
//            used for this identical concept, see this file's own header
//            above), the same `re-review` state
//            `functional-model/engine-status.ts`/`functional-model/
//            sink-derivation-status.ts` now ALSO compute for their own axes
//            (a human confirmation whose own underlying inputs have since
//            changed) — NOT folded into plain `blue` anymore. An earlier
//            version of this fold (the initial Sets-vocabulary task, commit
//            `2267487`) DID drop it to plain `blue`, explicitly flagged at
//            the time as a placeholder ("stale confirmation dropped rather
//            than shown as misleading green") because no real 6th
//            `re-review` color existed yet anywhere on this shared axis —
//            now that it does, FIN's own `re-review` bucket maps directly
//            onto it instead. Not `yellow` either — nothing was actually
//            REJECTED, the prior confirmation just went stale; that's a
//            materially different claim than a reviewer having looked and
//            disagreed. `baseline` is UNCHANGED by this — still folds to
//            `blue` (see `cardStatusBaseline` below): the underlying
//            fact-authoring completeness hasn't regressed, only the human
//            confirmation on top of it has gone stale, same "baseline never
//            reflects the review overlay" split `engine-status.ts`/
//            `sink-derivation-status.ts` already establish for their own
//            axes.
// ## Policy (documented here, NOT enforced in code by this task — 2026-09-18)
//
// `gray`/`purple` (i.e. anything below `blue`) are meant to be treated as
// PROHIBITED for any real/production consumption of this data pool-wide —
// "pretend it doesn't exist" — everywhere except within verification/review
// work itself (a human/agent looking at the card to move it further along).
// Only `blue`/`green`/`yellow` (all three are `blue`-or-better under the
// mapping above: fully covered, optionally human-reviewed) may ever back a
// real decision. This is the SAME policy `functional-model/
// sink-derivation-status.ts`'s own "Real-matching usability gate
// (2026-09-18)" section already implements FOR REAL, for its own axis —
// `isSinkDerivationMechanismUsable`/`computeSinkDerivationColor` there
// reject `gray`/`purple` from ever contributing to a real
// `match-sink.ts`-driven synergy match, exempting only that predicate's own
// corpus/verification test. That gate is this project's own concrete
// reference shape for what real enforcement looks like once there's
// something real to gate.
//
// There is deliberately NO equivalent gate added here: as of this writing,
// nothing in this codebase makes a real production decision off THIS axis
// at all — FIN's own live synergy graph (`functional-model/synergy.ts`,
// `app/lib/buildGraph.ts`, `server/api/graph-links.ts`) never reads
// `card-status.ts`/this file's translation at all (it matches off real
// `Fact`s directly, independent of this dashboard-only classification), and
// no real FDN authoring pipeline exists yet to gate. Adding a speculative
// enforcement mechanism with nothing real to protect would be exactly the
// kind of premature scaffolding this project's own conventions avoid
// elsewhere (see `sink-derivation-status.ts`'s own "seeded, not pre-
// populated" precedent). Whoever builds the real FDN pipeline (or any other
// future consumer that makes a production decision off a card's fact-
// authoring completeness) should add a real gate THEN, mirroring
// `sink-derivation-status.ts`'s own shape, rather than skip it.
export type CardStatusBaseline = 'gray' | 'purple' | 'blue';
export type CardStatusColor = 'gray' | 'purple' | 'blue' | 'yellow' | 'green' | 're-review';

/** The 3-state computed baseline half of the mapping above (`gray`/
 * `purple`/`blue`) — exported separately from `cardStatusColor` so a
 * consumer can tell a genuine human "Confirmed"/"Flagged" overlay apart
 * from the underlying baseline it sits on top of, the same
 * `baseline`-alongside-`color` shape `SinkDerivationPageEntry`/
 * `EngineStatusPageEntry` already serve. */
export function cardStatusBaseline(status: CardStatusBucket): CardStatusBaseline {
  switch (status) {
    case 'red':
    case 'gray':
      return 'gray';
    case 'orange':
    case 'yellow':
      return 'purple';
    case 'green':
    case 'verified':
    case 'uncertain':
    case 're-review':
      return 'blue';
  }
}

/** The full 6-state display color — `cardStatusBaseline`, narrowed to
 * `green`/`yellow`/`re-review` for the three real human-review-overlay
 * buckets (`verified`/`uncertain`/`re-review`) per the mapping above.
 * `re-review` (2026-09-18) is its own real color now, not folded into
 * `blue` — see this file's own header for the full rationale. */
export function cardStatusColor(status: CardStatusBucket): CardStatusColor {
  if (status === 'verified') return 'green';
  if (status === 'uncertain') return 'yellow';
  if (status === 're-review') return 're-review';
  return cardStatusBaseline(status);
}
