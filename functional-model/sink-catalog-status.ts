// Sink CATALOG entry status — a review axis for `functional-model/
// sink-model/catalog/*.ts` entries (the shared, curated `SinkQuery`
// catalog — see `catalog/entry.ts`'s own doc comment for the "catalog, not
// per-card, not bespoke storage" design). Genuinely different from (and NOT
// a fold into) `sink-derivation-status.ts`, which tracks a different,
// narrower question — whether a hand-written PREDICATE exists for a
// mechanism whose gameplay consequence comes from generic ENGINE AUTOMATION
// (Saga/Crew) rather than from a `CardDefinition`'s own effects/triggers.
// This file instead tracks whether a CATALOG ENTRY's own curated `SinkQuery`
// has been proven correct against a real, mocked-fixture structural gate —
// mirrors that file's OWN 5(6)-state shape and computation pattern closely
// (per this task's own explicit "mirror whichever of the two is the closer
// analog" instruction — `sink-derivation-status.ts` is the closer analog
// here, since both compute a LIST of entries each with their own
// baseline+review-overlay color, unlike `pipeline-status.ts`'s single-flat-
// file-per-card shape):
//
//   gray   — the group's combined corpus coverage (see "Family-scoped review
//            status" below) is missing or empty — drafted, not yet gated.
//   purple — a corpus manifest exists but doesn't show every real fixture
//            case agreeing (`passing < total`) — built, not fully verified.
//   blue   — the corpus manifest shows every real fixture case agreeing
//            (`total > 0 && passing === total`) — the structural gate
//            passed for real.
//   yellow — (overlay, not computed here) a human reviewed a blue baseline
//            and found a real disagreement/wrong verdict (required note).
//   green  — (overlay, not computed here) a human reviewed and confirmed it.
//   re-review — (computed, never stored) a human confirmed `green`, then
//            this group's own real source (see below) changed since — same
//            drift concept `pipeline-status.ts`'s own `re-review` and
//            `sink-derivation-status.ts`'s own `re-review` already establish.
//
// **Discovery is the real, statically-imported `SINK_CATALOG` array**
// (`sink-model/catalog/index.ts`), NOT a second hand-seeded metadata array
// and NOT a filesystem directory scan. Every entry in that array already
// has a real, live catalog module backing it by construction (it's a value
// import) — so there is no "gray, module doesn't exist yet" case the way
// `sink-derivation-status.ts` has for a not-yet-built predicate; a
// not-yet-authored catalog entry simply isn't in `SINK_CATALOG` at all yet
// (same "absence is its own signal" treatment `pipeline-status.ts`'s own
// "(no folder at all)" case already establishes) — this file's own `gray`
// state instead means "listed, but its OWN structural-gate corpus hasn't
// been run/recorded yet," one tier narrower than `sink-derivation-status
// .ts`'s `gray`. Deliberately NOT a hand-seeded metadata array either (the
// catalog is expected to grow much faster/more organically than the small,
// fixed set of engine-automation mechanisms that file tracks — a bespoke,
// low-reuse sink is still just a normal catalog entry, per the user's own
// explicit correction) — adding a new file under `catalog/` plus one import
// line in `catalog/index.ts` is the whole "register a new entry" act, no
// second array to keep in sync by hand.
//
// **Family-scoped review status (2026-09-18, real scope change, not
// cosmetic)** — see `SinkCatalogEntry.family`'s own doc comment
// (`sink-model/catalog/entry.ts`) for the full reasoning. Every real
// `SINK_CATALOG` entry (a "sink INSTANCE") is grouped by `entry.family ??
// entry.slug` before anything else in this file runs — a plain, non-
// factory-built singleton instance (`lifegain`/`graveyard-fodder`/`etb`,
// no `family` field at all) becomes its own trivial one-member group keyed
// on its own slug, so every existing singleton's own baseline/color/
// fingerprint computation is COMPLETELY UNCHANGED (grouping with 1 member
// degenerates to exactly today's per-instance behavior — no separate code
// path needed for "singleton" vs "family"). A real multi-instance group
// (`battlefield-presence`: `battlefield-presence-cats`/`-creatures`/
// `-hare-apparent`; `counters`: `counters-plus1plus1`) instead produces
// exactly ONE `SinkCatalogStatusEntry` for the whole group — its own
// `slug` field IS the family key, `category` is the family's own display
// label, `instanceSlugs` lists the real member slugs it aggregates, and its
// `baseline`/`evidence` are computed off the SUM of every member's own real
// corpus coverage (see `computeSinkCatalogStatus` below) — a human review
// verdict (`sink-catalog-reviews.json`, keyed the same way, by group key)
// therefore now applies to the whole family at once, not one instance in
// isolation. Every real INSTANCE still does its own independent, unaffected
// MATCHING (`SinkInstance`'s own `entry(candidate)` call — `card-
// interactions.ts`'s per-`SINK_CATALOG`-entry loop, the server API route's
// `computeRealMatches`) — this restructuring only changes how REVIEW status
// is grouped/reported, never how a candidate is matched against any one
// instance's own `query`/consumer signals.
//
// **`server/api/sink-catalog/index.get.ts` FIXED, 2026-09-18, later still —
// was left not reading/keying off `entry.family` by this refactor's own
// explicit "don't touch either route" instruction, and broke worse than
// this note originally anticipated**: `index.get.ts`'s own
// `SINK_CATALOG.find((e) => e.slug === entry.slug)` came back `undefined`
// for BOTH real family rows (`'battlefield-presence'`/`'counters'` match NO
// single `SINK_CATALOG` entry's own `.slug`), silently killing that route's
// entire `realMatches` section for both, not just a cosmetic display gap.
// Fixed by looking up every real member via `entry.evidence.members[]
// .slug` (this file's own real per-instance evidence, length 1 for a
// singleton, already exactly the right list — no need for a SEPARATE
// `instanceSlugs`-driven lookup, `members` already carries it) instead of
// `entry.slug` itself; `loadSourceFiles`'s own `corpusManifest` (the OTHER
// half of this same gap — `SinkCatalogEvidence.corpusManifestPath`'s own
// "first member, representative, not fully general" doc comment below) is
// fixed the same way, aggregating every real member's own corpus content
// instead of just the first. See `.claude/contracts/card-schema.md`'s
// "Family/instance slug regression fix" section for the full writeup +
// live-verified numbers. **`./review.post.ts` needed NO fix at all** —
// it was never broken: it validates a posted `slug` against
// `computeSinkCatalogStatus()`'s own returned `.slug` field directly (never
// a separate `SINK_CATALOG.find` lookup the way `index.get.ts`'s bug
// involved), which already IS the family key for a grouped row — a
// `'battlefield-presence'`/`'counters'` review POST already worked
// correctly before this fix, this note's own earlier claim that it needed
// one was simply wrong.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { SINK_CATALOG } from './sink-model/catalog/index';
import type { SinkCatalogEntry } from './sink-model/catalog/entry';
import { readFunctionalModelFile } from './source-files';

export type SinkCatalogBaseline = 'gray' | 'purple' | 'blue';
export type SinkCatalogColor = 'gray' | 'purple' | 'blue' | 'yellow' | 'green' | 're-review';

export interface SinkCatalogCorpusManifest {
  total: number;
  passing: number;
}

/** Real, per-INSTANCE corpus evidence — one per real `SINK_CATALOG` member
 * of a group (length 1 for a singleton, N for a real family). Nothing about
 * a group's own aggregated coverage is ever lost behind the summed
 * top-level `SinkCatalogEvidence` fields — a consumer that needs the real
 * per-instance breakdown (e.g. "which ONE of Battlefield presence's 3
 * instances isn't fully passing yet") reads this array. */
export interface SinkCatalogMemberEvidence {
  slug: string;
  corpusManifestPath: string;
  corpusManifestExists: boolean;
  corpusTotal: number;
  corpusPassing: number;
}

export interface SinkCatalogEvidence {
  /** For a singleton group: that instance's own real corpus manifest path.
   * For a real multi-instance family group: the FIRST member's own path —
   * a representative, not-fully-general value kept only so pre-existing
   * code that reads this single field (e.g. the not-yet-updated
   * `server/api/sink-catalog/index.get.ts`) still gets a real, valid,
   * readable path rather than an empty/garbage one; `members` below is the
   * real, complete per-instance answer. */
  corpusManifestPath: string;
  /** True iff EVERY member instance's own corpus manifest exists. */
  corpusManifestExists: boolean;
  /** Sum of every member instance's own real `corpusTotal`. */
  corpusTotal: number;
  /** Sum of every member instance's own real `corpusPassing`. */
  corpusPassing: number;
  /** Real per-instance breakdown — always present, length 1 for a
   * singleton group. */
  members: SinkCatalogMemberEvidence[];
}

export interface SinkCatalogStatusEntry {
  /** The group's own identity — a real family key (`'battlefield-
   * presence'`/`'counters'`) for a multi-instance group, or the singleton
   * instance's own `slug` otherwise (unchanged from before this file's
   * family-scoping pass). This is also the review-overlay key
   * (`sink-catalog-reviews.json`). */
  slug: string;
  /** The group's own display category — a real family label
   * (`FAMILY_LABELS` below) for a multi-instance group, or the singleton
   * instance's own `query.category` otherwise. */
  category: string;
  baseline: SinkCatalogBaseline;
  evidence: SinkCatalogEvidence;
  /** Real member instance slugs this group aggregates — present ONLY for a
   * genuine multi-instance family group (`undefined`, not an empty array,
   * for a singleton — mirrors `SinkCatalogEntry.consumerTriggerNames`'s own
   * "presence itself is the signal" optionality convention elsewhere in
   * this codebase). */
  instanceSlugs?: string[];
}

const CATALOG_DIR = join('functional-model', 'sink-model', 'catalog');

/** Hand-maintained display label per real family key — deliberately a
 * small, explicit, hand-authored map (not derived from any instance's own
 * `query.category`, which is instance-specific, e.g. "Cats") rather than
 * a third data field threaded through every factory config; grow this by
 * one line whenever a real new multi-instance family is added, same
 * "organic growth, explicit" discipline `SINK_DERIVATION_MECHANISMS`/
 * `SINK_CATALOG` themselves already follow. */
const FAMILY_LABELS: Record<string, string> = {
  'battlefield-presence': 'Battlefield presence',
  counters: 'Counters',
};

interface CatalogGroup {
  /** Family key (`entry.family`) for a real family group, or the
   * singleton's own `slug` otherwise. */
  key: string;
  /** True iff this group was formed off a real, EXPLICIT `entry.family`
   * declaration — i.e. a genuine family, never a member-count heuristic.
   * Deliberately NOT `members.length > 1`: `counters` is a real family with
   * only 1 real configured instance today (`counters-plus1plus1`) — it's
   * still reviewed/reported as "Counters," not silently folded back into
   * plain-singleton treatment just because no `-1/-1`/loyalty sibling has
   * been authored yet. See `SinkCatalogEntry.family`'s own doc comment
   * (`sink-model/catalog/entry.ts`). */
  isFamily: boolean;
  members: SinkCatalogEntry[];
}

/** Groups every real `SINK_CATALOG` entry by `entry.family ?? entry.slug` —
 * the one real place this file's whole family-vs-singleton distinction is
 * decided; every function below builds on this instead of re-deriving it. */
function groupCatalogByFamily(): CatalogGroup[] {
  const order: string[] = [];
  const groups = new Map<string, SinkCatalogEntry[]>();
  for (const entry of SINK_CATALOG) {
    const key = entry.family ?? entry.slug;
    const existing = groups.get(key);
    if (existing) {
      existing.push(entry);
    } else {
      groups.set(key, [entry]);
      order.push(key);
    }
  }
  return order.map((key) => {
    const members = groups.get(key)!;
    return { key, isFamily: members.some((m) => m.family !== undefined), members };
  });
}

/** The real source file a group's own SHARED matching logic lives in —
 * `families/${key}.ts` for a real multi-instance family group (every real
 * family's own shared factory file is named identically to its family key,
 * by convention — `families/battlefield-presence.ts`/`families/counters
 * .ts`, 2026-09-18 split out of what used to be one combined `${key}.ts`
 * per family), or `${slug}.ts` for a singleton (the pre-existing, unchanged
 * one-file-per-slug convention, where factory and config were never split
 * since there's only ever one instance). See `computeSinkCatalogFingerprint`
 * below for where each real member's own PER-INSTANCE config file
 * (`${member.slug}.ts`) is separately hashed alongside this shared file for
 * a real family group — this function alone only names the shared half. */
function sourceFileFor(group: CatalogGroup): string {
  return group.isFamily ? join('families', `${group.key}.ts`) : `${group.members[0]!.slug}.ts`;
}

function loadCorpusManifest(path: string): SinkCatalogCorpusManifest {
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

function memberEvidenceFor(entry: SinkCatalogEntry, root: string): SinkCatalogMemberEvidence {
  const corpusManifestPath = join(CATALOG_DIR, `${entry.slug}.corpus.json`);
  const corpusManifestExists = existsSync(join(root, corpusManifestPath));
  const { total: corpusTotal, passing: corpusPassing } = corpusManifestExists ? loadCorpusManifest(join(root, corpusManifestPath)) : { total: 0, passing: 0 };
  return { slug: entry.slug, corpusManifestPath, corpusManifestExists, corpusTotal, corpusPassing };
}

/**
 * Computes the real gray/purple/blue baseline for every real GROUP (a
 * family's combined instances, or a singleton instance standing alone) —
 * off real filesystem presence of each member's own `<slug>.corpus.json`,
 * summed per group. `root` defaults to `process.cwd()`, matching
 * `computeSinkDerivationStatus`/`computeEngineStatus`'s own contract.
 */
export function computeSinkCatalogStatus(root: string = process.cwd()): SinkCatalogStatusEntry[] {
  return groupCatalogByFamily().map((group): SinkCatalogStatusEntry => {
    const members = group.members.map((entry) => memberEvidenceFor(entry, root));
    const corpusManifestExists = members.every((m) => m.corpusManifestExists);
    const corpusTotal = members.reduce((sum, m) => sum + m.corpusTotal, 0);
    const corpusPassing = members.reduce((sum, m) => sum + m.corpusPassing, 0);

    let baseline: SinkCatalogBaseline;
    if (!corpusManifestExists || corpusTotal === 0) baseline = 'gray';
    else if (corpusPassing < corpusTotal) baseline = 'purple';
    else baseline = 'blue';

    return {
      slug: group.key,
      category: group.isFamily ? (FAMILY_LABELS[group.key] ?? group.key) : group.members[0]!.query.category,
      baseline,
      evidence: { corpusManifestPath: members[0]!.corpusManifestPath, corpusManifestExists, corpusTotal, corpusPassing, members },
      ...(group.isFamily ? { instanceSlugs: group.members.map((e) => e.slug) } : {}),
    };
  });
}

// ---------------------------------------------------------------------------
// Review overlay + fingerprint drift — same shape `sink-derivation-status
// .ts`'s own "Real-matching usability gate"/"Confirmation drift fingerprint"
// sections already establish, duplicated here (not imported) for the exact
// same reason that file's own header documents: small, unlikely to drift,
// and this module should stay import-light (no runtime dependency on a Nuxt
// server route).
const REVIEWS_RELATIVE_PATH = join('functional-model', 'sink-catalog-reviews.json');

interface SinkCatalogReviewVerdictOnly {
  verdict?: 'confirm' | 'reject';
  fingerprint?: string;
}

function loadReviewVerdicts(root: string): Record<string, SinkCatalogReviewVerdictOnly> {
  const path = join(root, REVIEWS_RELATIVE_PATH);
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return {};
  }
}

/** Resolves a caller-supplied key — a real single INSTANCE slug (what
 * `card-interactions.ts`/the server API route's `computeRealMatches` still
 * pass, one real `SINK_CATALOG` entry's own `.slug`) OR a real GROUP/family
 * key (what a future review-status consumer keyed on
 * `computeSinkCatalogStatus()`'s own `slug` field would pass) — to the
 * group key `computeSinkCatalogStatus`/review storage actually use. An
 * instance slug and its own group's key are DELIBERATELY interchangeable
 * here — this is what lets `card-interactions.ts`'s existing, unchanged
 * `isSinkCatalogEntryUsable(entry.slug, root)` call (looping per real
 * `SINK_CATALOG` instance) keep working verbatim while review status itself
 * is now computed per family underneath it. Falls back to treating an
 * unrecognized key as already-a-group-key (matches `computeSinkCatalogStatus`'s
 * own "unknown slug -> gray, never throws" convention below). */
function resolveGroupKey(key: string): string {
  const found = SINK_CATALOG.find((e) => e.slug === key);
  return found ? (found.family ?? found.slug) : key;
}

/**
 * sha256 of a group's own real, current SHARED source (see `sourceFileFor`)
 * + every real member instance's own PER-INSTANCE config file content (a
 * real family group only — a singleton's own file IS `sourceFileFor`'s
 * result already, so it isn't double-hashed here) + every real member
 * instance's own `<slug>.corpus.json` content — the same real, checkable
 * inputs `computeSinkCatalogStatus` itself reads to decide gray/purple/blue
 * for the group (mirrors `computeSinkDerivationFingerprint`'s own identical
 * two-input-class hash, generalized from 1 corpus file to N, plus this
 * file's own 2026-09-18 family/instance file split adding a third input
 * class for a real family group). `key` may be a real instance slug or the
 * group's own key — see `resolveGroupKey`.
 */
export function computeSinkCatalogFingerprint(key: string, root: string = process.cwd()): string | null {
  const groupKey = resolveGroupKey(key);
  const group = groupCatalogByFamily().find((g) => g.key === groupKey);
  if (!group) return null;

  const entryResult = readFunctionalModelFile(root, join(CATALOG_DIR, sourceFileFor(group)));

  const hash = createHash('sha256');
  hash.update(`entry:${entryResult.exists ? (entryResult.content ?? '') : '<missing>'}`);
  for (const entry of [...group.members].sort((a, b) => a.slug.localeCompare(b.slug))) {
    if (group.isFamily) {
      const instanceResult = readFunctionalModelFile(root, join(CATALOG_DIR, `${entry.slug}.ts`));
      hash.update(`instance:${entry.slug}:${instanceResult.exists ? (instanceResult.content ?? '') : '<missing>'}`);
    }
    const corpusResult = readFunctionalModelFile(root, join(CATALOG_DIR, `${entry.slug}.corpus.json`));
    hash.update(`corpus:${entry.slug}:${corpusResult.exists ? (corpusResult.content ?? '') : '<missing>'}`);
  }
  return hash.digest('hex');
}

/** Live color for ONE group (a family, or a singleton instance standing
 * alone) — baseline, or the yellow/green/re-review human-review overlay on
 * top of it. `key` may be a real instance slug or the group's own key — see
 * `resolveGroupKey`. Uncached — see `isSinkCatalogEntryUsable` below for the
 * cached, gate-facing entry point. A review overlay is only ever meaningful
 * on a `blue` baseline (same "confirm/reject presupposes a real verified
 * baseline" rule `sink-derivation-status.ts`'s own `computeSinkDerivationColor`
 * already enforces) — a stale/hand-authored review record sitting on a
 * `gray`/`purple` group is silently ignored, falling back to the plain
 * baseline, never trusted into `green`/`yellow`. */
export function computeSinkCatalogColor(key: string, root: string = process.cwd()): SinkCatalogColor {
  const groupKey = resolveGroupKey(key);
  const entry = computeSinkCatalogStatus(root).find((e) => e.slug === groupKey);
  const baseline: SinkCatalogBaseline = entry?.baseline ?? 'gray';
  if (baseline !== 'blue') return baseline;

  const review = loadReviewVerdicts(root)[groupKey];
  if (review?.verdict === 'reject') return 'yellow';
  if (review?.verdict === 'confirm') {
    const currentFingerprint = computeSinkCatalogFingerprint(groupKey, root);
    if (!review.fingerprint || !currentFingerprint || review.fingerprint !== currentFingerprint) return 're-review';
    return 'green';
  }
  return baseline;
}

// Per-root memoization — same rationale/shape `sink-derivation-status.ts`'s
// own cache establishes (real, benchmarked fs-read cost, called once per
// tracked entry on every consultation of `isSinkCatalogEntryUsable`, static
// for the life of one process run). Cached by the CALLER-SUPPLIED key
// (instance slug or group key) — every instance slug in the same family
// resolves to and caches the identical color value, so the redundant lookup
// cost per distinct instance slug is real but small (one extra
// `computeSinkCatalogStatus()` pass, already itself cheap and already
// re-run per distinct cache miss today).
const colorCache = new Map<string, Map<string, SinkCatalogColor>>();

function cachedColor(key: string, root: string): SinkCatalogColor {
  let cache = colorCache.get(root);
  if (!cache) {
    cache = new Map();
    colorCache.set(root, cache);
  }
  let color = cache.get(key);
  if (color === undefined) {
    color = computeSinkCatalogColor(key, root);
    cache.set(key, color);
  }
  return color;
}

/** Test-only escape hatch: clears the per-root color cache. Never called by
 * production code. */
export function resetSinkCatalogColorCacheForTests(): void {
  colorCache.clear();
}

/**
 * Is `key`'s (a real instance slug, or its own group/family key — see
 * `resolveGroupKey`) LIVE status usable — i.e. trustworthy enough to
 * actually rely on for real matching (`card-interactions.ts`'s own
 * on-the-fly catalog-first categorization, no persisted per-card attachment
 * concept exists — see `pipeline-status.ts`'s own "tried then reverted"
 * header note)? Only `blue`/`green` are; `gray`/`purple`/`yellow`/
 * `re-review` return `false` — the caller must treat the entry as not
 * (yet, or no longer) trustworthy, never throw. Cached per `root`.
 */
export function isSinkCatalogEntryUsable(key: string, root: string = process.cwd()): boolean {
  const color = cachedColor(key, root);
  return color === 'blue' || color === 'green';
}
