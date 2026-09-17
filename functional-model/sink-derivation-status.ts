// Sink-derivation-predicate status — a NEW, currently-empty-of-real-work
// status axis tracking a different problem than
// `functional-model/engine-status.ts` (mechanic/vocabulary support) and
// different again from `functional-model/synergy.ts`'s per-card `Fact`
// model: this axis tracks progress on the small set of hand-written
// "sink-derivation predicates" the sink-only-synergy matcher
// (`functional-model/sink-model/match-sink.ts`) will eventually need for
// mechanisms whose real gameplay consequences come from GENERIC ENGINE
// AUTOMATION rather than from anything visible in a card's own
// `CardDefinition` effects/triggers/program nodes.
//
// Feeds `GET /api/sink-derivations`
// (`server/api/sink-derivations/index.get.ts`) — see
// `.claude/contracts/sink-derivation-status-schema.md` for the served
// shape. Same 5-state color/status vocabulary and gray/purple/blue
// computed-baseline + yellow/green human-review-overlay split as
// `engine-status.ts` established, just applied to a different index:
//
//   gray   — no predicate module exists yet for this mechanism at all.
//   purple — a predicate module exists, but there's no real scenario-
//            corpus manifest yet recording it as fully checked (either the
//            manifest file is missing, or it exists but doesn't yet show
//            every corpus scenario agreeing with real trace evidence).
//   blue   — a predicate module exists AND its corpus manifest shows every
//            scenario in the corpus (a real, positive count) agreeing with
//            real trace evidence.
//   yellow — (overlay, not computed here) a human reviewed a blue/purple
//            baseline and found a real disagreement/wrong verdict (a
//            required note records what's wrong).
//   green  — (overlay, not computed here) a human reviewed and confirmed
//            it's correct.
//
// ## Why this needed its OWN base index, not a reuse of `ENGINE_GAPS.md`'s
// numbered-list parser
//
// `engine-status.ts` parses `ENGINE_GAPS.md`'s own "Real gaps —
// prioritized" numbered list as its base index precisely because that list
// already exists, hand-curated, for a DIFFERENT question ("does the engine
// support this mechanic at all"). The 4 mechanisms tracked here (Saga,
// Stun counters, Finality counters, Crew) already have entries in
// `ENGINE_GAPS.md`'s OTHER section ("## FIN-specific mechanics closed") —
// but as fully-CLOSED engine capabilities, not as "does a sink-derivation
// predicate exist for this yet" (a narrower, newer, currently-all-`gray`
// question this file tracks instead). Reusing that doc's parser here would
// either misreport all 4 as "closed" (wrong axis) or require inventing a
// second, unrelated meaning for its `CLOSED` marker. This axis is
// deliberately its own small, hand-seeded index instead — see
// `SINK_DERIVATION_MECHANISMS` below — mirroring how `engine-status.ts`
// itself grows: real, already-identified entries only, no speculative
// pre-seeding of every mechanism that COULD someday need this treatment.
//
// ## The real gap this whole axis exists to close
//
// Found while sanity-checking `functional-model/sink-model/match-sink.ts`
// against real FIN cards (see `.claude/agent-memory/engine/notes.md`'s
// 2026-09-17 "sink-only synergy matching prototype" entry for the full
// writeup): Summon: Bahamut's real graveyard-transition on its Saga's
// final chapter comes ENTIRELY from generic `saga.ts` automation (keyed off
// its typeLine + numbered `chapterN` trigger names), with NO corresponding
// `Effect` node anywhere in its own `definition.ts` — so a pure
// `CardDefinition`-effect-walking matcher can never derive it. Stun
// counters, Finality counters, and Crew are the same class of problem
// (real per-object replacement effects / a structured non-Effect cost
// path, both narrow engine hooks rather than declarative `Effect` data —
// see `ENGINE_GAPS.md`'s own "Saga lore-counter automation (714)" and
// "Stun and finality counters" entries, and gap-tracked Crew closure).
//
// ## What a predicate module / corpus manifest will look like once built
// (not built by this task — this file only checks for their PRESENCE)
//
// For mechanism `<slug>`, this file expects (by convention, not yet
// created):
//   - `functional-model/sink-model/predicates/<slug>.ts` — the actual
//     predicate function ("does THIS card's <mechanism> automation produce
//     a creature death?" -> true/false/unknown), never a guessed answer.
//   - `functional-model/sink-model/predicates/<slug>.corpus.json` — a small
//     `{ total, passing }` manifest, written by a future verification pass
//     (mirroring how `scripts/verify-synergy.mjs` already reconciles Facts
//     against real traces) recording how many of the mechanism's real
//     corpus scenarios the predicate agrees with.
//
// Neither file exists for any of the 4 seeded mechanisms yet — every entry
// therefore starts `gray`, which is the correct, real, computed state right
// now (not a hardcoded placeholder value).

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { readFunctionalModelFile } from './source-files';

export type SinkDerivationBaseline = 'gray' | 'purple' | 'blue';
// 're-review' (2026-09-18) is a SIXTH state, never computed by
// `computeSinkDerivationStatus` — a review OVERLAY refinement of a human
// 'confirm', not a baseline value (see `computeSinkDerivationFingerprint`
// below and `computeSinkDerivationColor`'s own updated logic): a
// `re-review`-colored mechanism's own `baseline` is still 'blue' (the real
// predicate-module+corpus-manifest completeness signal hasn't regressed),
// only the PRIOR human confirmation has gone stale because the predicate's
// own source or its corpus manifest changed since. Same concept
// `functional-model/card-status.ts`'s own `re-review` bucket already
// established for FIN (bright/light blue `#7dd3fc`, distinct from plain
// verified-blue `#3b82f6`) — reused here, not reinvented.
export type SinkDerivationColor = 'gray' | 'purple' | 'blue' | 'yellow' | 'green' | 're-review';

/** One real sink-query event-shape a mechanism's eventual predicate is expected to cover. */
export interface SinkDerivationExpectedShape {
  /** A `SinkQuery`/`Fact`-style event name, e.g. `'dies'`, `'zoneChange'`, `'untap'`. */
  event: string;
  /** Why this shape, in real-card terms — cites the motivating card/finding. */
  note: string;
}

/** Statically seeded mechanism metadata — the ONLY place new entries get added (see this file's own header + the contract doc for the exact edit point). */
export interface SinkDerivationMechanism {
  /** Stable identity key — also the served `key` and the review-overlay key. Never reuse a retired slug for a different mechanism. */
  slug: string;
  label: string;
  /** Short description of the real-card evidence that motivated tracking this mechanism (cites a real card + where the gap was found). */
  motivation: string;
  expectedSinkShapes: SinkDerivationExpectedShape[];
}

export interface SinkDerivationCorpusManifest {
  total: number;
  passing: number;
}

export interface SinkDerivationEvidence {
  /** Repo-root-relative path this file checked for the predicate module. */
  predicateModulePath: string;
  predicateModuleExists: boolean;
  /** Repo-root-relative path this file checked for the corpus-verification manifest. */
  corpusManifestPath: string;
  corpusManifestExists: boolean;
  /** From the manifest, if present and parseable; 0 otherwise. */
  corpusTotal: number;
  corpusPassing: number;
}

export interface SinkDerivationEntry {
  key: string;
  slug: string;
  label: string;
  motivation: string;
  expectedSinkShapes: SinkDerivationExpectedShape[];
  baseline: SinkDerivationBaseline;
  evidence: SinkDerivationEvidence;
}

/**
 * The real, already-identified seed list — exactly the 4 mechanisms found
 * during the sink-model sanity check (see this file's own header). Do NOT
 * speculatively add mechanisms here that haven't actually surfaced a real
 * card gap yet — same "organic growth, not a-priori enumeration" posture
 * `engine-status.ts` established for its own index.
 */
export const SINK_DERIVATION_MECHANISMS: SinkDerivationMechanism[] = [
  {
    slug: 'saga',
    label: 'Saga chapter-completion automation',
    motivation:
      'Saga chapters complete via generic engine automation keyed off chapter triggers, not an Effect node on ' +
      "the card's own definition — so recognizing the final-chapter sacrifice (e.g. on Summon: Bahamut) needs " +
      'a dedicated predicate rather than Effect-walking.',
    expectedSinkShapes: [
      {
        event: 'dies',
        note:
          "714.4's chapter-completion sacrifice, once the greatest lore-counter chapter is reached — the " +
          "Bahamut case: a real dies/graveyard-zone-transition with no Effect backing it.",
      },
      {
        event: 'zoneChange',
        note:
          "Same 714.4 sacrifice, viewed as a Battlefield->Graveyard zone move rather than a bare 'dies' event " +
          "— whichever shape the eventual predicate settles on should match how other zone-move Facts in " +
          "synergy.ts are already keyed (see SYNERGY_DESIGN.md's Fact-unification notes on this exact " +
          "zone-vs-event-shape split).",
      },
    ],
  },
  {
    slug: 'stun-counters',
    label: 'Stun-counter untap replacement',
    motivation:
      'A stun counter causes a permanent (e.g. Ice Flan, Tonberry) to skip untapping via a built-in engine ' +
      "replacement effect, not an Effect on the card's own definition — so a predicate is needed to recognize " +
      'the skipped untap.',
    expectedSinkShapes: [
      {
        event: 'untap',
        note:
          "A sink wanting 'this permanent fails to untap' (or 'a stun counter was removed') has nothing to " +
          "match against in CardDefinition today — the real behavior lives in state.ts's untap(), keyed off " +
          "RealCard.counters presence, not any Effect.",
      },
    ],
  },
  {
    slug: 'finality-counters',
    label: 'Finality-counter graveyard-to-exile redirect',
    motivation:
      "A finality counter redirects a permanent's death (e.g. Relentless X-ATM092) from the graveyard to " +
      "exile via a built-in engine replacement effect, not an Effect on the card's own definition — so a " +
      'predicate is needed to recognize the redirect and avoid mismatching it as a normal graveyard death.',
    expectedSinkShapes: [
      {
        event: 'dies',
        note:
          "A sink wanting 'creature died to the graveyard' should NOT match a finality-countered permanent's " +
          "own death (it goes to exile instead) — the predicate needs to recognize the redirect, not just " +
          "the presence of a destroy/dies-shaped Effect.",
      },
      {
        event: 'exile',
        note:
          "The redirected destination itself — a sink wanting 'this went to exile' currently has nothing to " +
          "derive it from structurally for a finality-countered permanent.",
      },
    ],
  },
  {
    slug: 'crew',
    label: 'Crew cost activation path',
    motivation:
      "Crewing a Vehicle taps the crewing creatures through the engine's built-in cost-payment path, not " +
      "through any Effect the Vehicle's own card declares — so a predicate is needed to recognize that tap " +
      'as real gameplay consequence.',
    expectedSinkShapes: [
      {
        event: 'tap',
        note:
          "A sink wanting 'a creature got tapped' currently can't see the tapping Crew produces on its " +
          "crewing creatures — that tap comes from the generic crewedBy cost-payment path, not from any " +
          "Effect the Vehicle's own definition declares.",
      },
    ],
  },
];

function loadCorpusManifest(path: string): SinkDerivationCorpusManifest {
  if (!existsSync(path)) return { total: 0, passing: 0 };
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    const total = typeof parsed?.total === 'number' ? parsed.total : 0;
    const passing = typeof parsed?.passing === 'number' ? parsed.passing : 0;
    return { total, passing };
  } catch {
    return { total: 0, passing: 0 };
  }
}

/**
 * Computes the real, checkable gray/purple/blue baseline for every seeded
 * sink-derivation-predicate mechanism, off real filesystem presence of a
 * predicate module + its corpus-verification manifest. `root` defaults to
 * `process.cwd()` (the repo root — true both inside a Nuxt server route and
 * via a standalone script), matching `computeEngineStatus`'s own contract.
 *
 * No mechanism has a predicate module yet, so every entry currently
 * computes `gray` — that's the real, correct state today, not a
 * placeholder.
 */
export function computeSinkDerivationStatus(root: string = process.cwd()): SinkDerivationEntry[] {
  const predicatesDir = join('functional-model', 'sink-model', 'predicates');

  return SINK_DERIVATION_MECHANISMS.map((mechanism): SinkDerivationEntry => {
    const predicateModulePath = join(predicatesDir, `${mechanism.slug}.ts`);
    const corpusManifestPath = join(predicatesDir, `${mechanism.slug}.corpus.json`);

    const predicateModuleExists = existsSync(join(root, predicateModulePath));
    const corpusManifestExists = existsSync(join(root, corpusManifestPath));
    const { total: corpusTotal, passing: corpusPassing } = corpusManifestExists
      ? loadCorpusManifest(join(root, corpusManifestPath))
      : { total: 0, passing: 0 };

    let baseline: SinkDerivationBaseline;
    if (!predicateModuleExists) baseline = 'gray';
    else if (!corpusManifestExists || corpusTotal === 0 || corpusPassing < corpusTotal) baseline = 'purple';
    else baseline = 'blue';

    return {
      key: mechanism.slug,
      slug: mechanism.slug,
      label: mechanism.label,
      motivation: mechanism.motivation,
      expectedSinkShapes: mechanism.expectedSinkShapes,
      baseline,
      evidence: {
        predicateModulePath,
        predicateModuleExists,
        corpusManifestPath,
        corpusManifestExists,
        corpusTotal,
        corpusPassing,
      },
    };
  });
}

// ---------------------------------------------------------------------------
// Real-matching usability gate (2026-09-18).
//
// A structural guard for `functional-model/sink-model/match-sink.ts`'s own
// `deriveOccurrences`: `gray` (not built) and `purple` (built, not yet
// corpus-verified) must be treated as if a mechanism's predicate module
// doesn't exist at all for any REAL/production matching call — only `blue`
// (verified) or `green` (human-confirmed) may contribute occurrences there.
// The one exemption is a predicate's OWN corpus/verification test
// (`saga.test.ts`, `crew.test.ts`, future `<mechanism>.test.ts`s) — those
// import the raw predicate function directly, bypassing this gate entirely
// (see `match-sink.ts`'s own `deriveOccurrences` for where the gate is
// actually applied, and those test files' own imports for confirmation they
// never go through it).
//
// `green` requires the same yellow/green human-review overlay
// `server/api/sink-derivations/index.get.ts` computes for the served
// dashboard (a human `'confirm'` verdict in
// `functional-model/sink-derivation-reviews.json`) — duplicated here in
// miniature rather than imported from that route, since it's a Nuxt HTTP
// handler, not a plain function this engine-only production-matching code
// should depend on. `computeSinkDerivationColor` below is the single
// source of truth for that duplicated computation; if the served-shape
// logic in `index.get.ts` ever needs to change, keep this in sync by hand
// (small and unlikely to drift — same tradeoff `match-sink.ts`'s own header
// already documents for its handful of duplicated-not-imported matching
// primitives).
const REVIEWS_RELATIVE_PATH = join('functional-model', 'sink-derivation-reviews.json');

interface SinkDerivationReviewVerdictOnly {
  verdict?: 'confirm' | 'reject';
  /** Snapshotted by `server/api/sink-derivations/review.post.ts` the moment
   * a human CONFIRMS this mechanism — see `computeSinkDerivationFingerprint`
   * below. Only ever meaningful alongside `verdict: 'confirm'`; unused for
   * `'reject'` (a rejection's own note already records the disagreement
   * found; drift detection is specifically about a stale CONFIRMATION going
   * stale, not a stale rejection). */
  fingerprint?: string;
}

function loadReviewVerdicts(root: string): Record<string, SinkDerivationReviewVerdictOnly> {
  const path = join(root, REVIEWS_RELATIVE_PATH);
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Confirmation drift fingerprint (2026-09-18) — generalizes FIN's own
// `scripts/check-verified-regressions.mjs` mechanism (see that script's own
// header + `.claude/contracts/card-schema.md`'s "Verified-snapshot
// regression guard" section) to this axis: the moment a human CONFIRMS a
// mechanism, `server/api/sink-derivations/review.post.ts` snapshots this
// fingerprint alongside the review record. A later read
// (`computeSinkDerivationColor` below, and `server/api/sink-derivations/
// index.get.ts`'s own served color) recomputes the CURRENT fingerprint and
// compares — a mismatch means the mechanism's real predicate source or its
// corpus manifest has changed since that confirmation, so the color becomes
// `re-review` instead of trusting a now-stale `green`.
//
// Inputs hashed: the real, current content of BOTH the predicate module
// (`<slug>.ts`) and its corpus manifest (`<slug>.corpus.json`) — the two
// real, checkable inputs `computeSinkDerivationStatus` itself already reads
// to decide gray/purple/blue for this mechanism. Uses
// `readFunctionalModelFile` (same read-only, scope-safe primitive
// `sourceFiles` in the served shape already uses) rather than a bare
// `readFileSync`, so a missing file hashes a stable, distinct marker instead
// of throwing.
export function computeSinkDerivationFingerprint(slug: string, root: string = process.cwd()): string | null {
  const mechanism = SINK_DERIVATION_MECHANISMS.find((m) => m.slug === slug);
  if (!mechanism) return null;

  const predicatesDir = join('functional-model', 'sink-model', 'predicates');
  const predicateResult = readFunctionalModelFile(root, join(predicatesDir, `${slug}.ts`));
  const corpusResult = readFunctionalModelFile(root, join(predicatesDir, `${slug}.corpus.json`));

  const hash = createHash('sha256');
  hash.update(` predicate:${predicateResult.exists ? (predicateResult.content ?? '') : '<missing>'}`);
  hash.update(` corpus:${corpusResult.exists ? (corpusResult.content ?? '') : '<missing>'}`);
  return hash.digest('hex');
}

/** Live color for ONE mechanism — baseline, or the yellow/green/re-review
 * human-review overlay on top of it — the same computation
 * `server/api/sink-derivations/index.get.ts` performs for its whole served
 * list, narrowed to a single slug for a matching-time gate check. Uncached —
 * see `isSinkDerivationMechanismUsable` below for the cached, gate-facing
 * entry point production code should actually call.
 *
 * A review overlay (confirm/reject) is only ever meaningful on a `blue`
 * baseline (2026-09-18) — "was this mechanism ever actually verified" is a
 * precondition for either "a human confirmed it" or "a human rejected it";
 * confirming/rejecting a `gray`/`purple` mechanism is semantically
 * meaningless (nothing was ever claimed to be corpus-verified in the first
 * place) and is now refused server-side at write time too (see
 * `server/api/sink-derivations/review.post.ts`). Enforced HERE too, at
 * read/compute time, as defense in depth — `sink-derivation-reviews.json`
 * is still a flat, hand-editable file (not exclusively written through the
 * gated POST route), so a stale/hand-authored review record sitting on a
 * `gray`/`purple` mechanism must never be trusted into a `green`/`yellow`
 * color; it's silently ignored, falling back to the plain baseline. */
export function computeSinkDerivationColor(slug: string, root: string = process.cwd()): SinkDerivationColor {
  const entry = computeSinkDerivationStatus(root).find((e) => e.slug === slug);
  const baseline: SinkDerivationBaseline = entry?.baseline ?? 'gray';
  if (baseline !== 'blue') return baseline;

  const review = loadReviewVerdicts(root)[slug];
  if (review?.verdict === 'reject') return 'yellow';
  if (review?.verdict === 'confirm') {
    const currentFingerprint = computeSinkDerivationFingerprint(slug, root);
    if (!review.fingerprint || !currentFingerprint || review.fingerprint !== currentFingerprint) return 're-review';
    return 'green';
  }
  return baseline;
}

// Per-root memoization. Benchmarked directly against this repo's real
// filesystem (2026-09-18): ~30us per `computeSinkDerivationStatus()` call
// (existsSync/readFileSync across 4 seeded mechanisms' predicate module +
// corpus-manifest paths) — cheap in isolation, but this gate is consulted
// once per tracked mechanism on every `deriveOccurrences` call, itself
// called once per (sink, candidate) pair in an N²-style pool-wide synergy
// build (this project's own accepted complexity budget for that — see
// SYNERGY_DESIGN.md). A ~300-card pool's own N² comparison (~90k candidate
// evaluations) would add ~3s of pure redundant fs-read overhead with no
// caching at all, for a value that cannot change mid-run (predicate
// modules/corpus manifests/the review overlay are all static for the
// duration of one matching run/process) — so this IS cached, keyed by
// `root` (never just a single flat value, since this file's OWN tests
// exercise multiple distinct fake roots within one process run).
const colorCache = new Map<string, Map<string, SinkDerivationColor>>();

function cachedColor(slug: string, root: string): SinkDerivationColor {
  let cache = colorCache.get(root);
  if (!cache) {
    cache = new Map();
    colorCache.set(root, cache);
  }
  let color = cache.get(slug);
  if (color === undefined) {
    color = computeSinkDerivationColor(slug, root);
    cache.set(slug, color);
  }
  return color;
}

/** Test-only escape hatch: clears the per-root color cache. Needed by tests
 * that mutate a fake root's own filesystem (a predicate module, a corpus
 * manifest, or the review-overlay file) between assertions and expect a
 * fresh read afterward — never called by production code. */
export function resetSinkDerivationColorCacheForTests(): void {
  colorCache.clear();
}

/**
 * The real gate: is mechanism `slug`'s LIVE status usable by real matching
 * right now? Only `blue`/`green` are — `gray`/`purple`/`yellow`/`re-review`
 * return `false`, meaning the caller must treat that mechanism's predicate
 * as if it doesn't exist (contribute zero occurrences), never throw or
 * otherwise break matching. `re-review` (2026-09-18) is deliberately NOT
 * usable, same as `gray`/`purple` — a confirmation whose own inputs have
 * since drifted is no longer a trustworthy human sign-off; it takes a FRESH
 * confirm (re-baselining the fingerprint) to become usable again, not a
 * stale one. Cached per `root` — see the cache comment above.
 */
export function isSinkDerivationMechanismUsable(slug: string, root: string = process.cwd()): boolean {
  const color = cachedColor(slug, root);
  return color === 'blue' || color === 'green';
}
