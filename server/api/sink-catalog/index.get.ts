// Sink CATALOG entry status suite — GET /api/sink-catalog.
// Read-only reporting mirror of GET /api/sink-derivations
// (server/api/sink-derivations/index.get.ts), but for a genuinely
// different axis: one row per REVIEWED, SHARED catalog entry
// (`functional-model/sink-model/catalog/<slug>.ts`) rather than per
// engine-automation mechanism — see
// `functional-model/sink-catalog-status.ts`'s own header for the full
// gray/purple/blue/yellow/green/re-review design, and
// `.claude/contracts/card-schema.md`'s "Sink CATALOG..." section for the
// full contract this route serves.
//
// Baseline (`gray`/`purple`/`blue`) is computed fresh off real filesystem
// presence of a catalog entry's own structural-gate corpus manifest, by
// `computeSinkCatalogStatus()`. `yellow`/`green` are a human-review OVERLAY
// on top, loaded from `functional-model/sink-catalog-reviews.json` (same
// split `server/api/sink-derivations/index.get.ts`'s own
// `sink-derivation-reviews.json` overlay already establishes) — written by
// this route's own sibling, `./review.post.ts`.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { computeSinkCatalogStatus, computeSinkCatalogColor } from '../../../functional-model/sink-catalog-status';
import type { SinkCatalogBaseline, SinkCatalogColor, SinkCatalogEvidence } from '../../../functional-model/sink-catalog-status';
import { SINK_CATALOG } from '../../../functional-model/sink-model/catalog/index';
import type { SinkInstance } from '../../../functional-model/sink-model/catalog/entry';
import type { SinkQuery } from '../../../functional-model/sink-model/sink-query';
import { readFunctionalModelFile, type SourceFileResult } from '../../../functional-model/source-files';
import { matchSink, matchesConsumerTriggerNames, matchesConsumerTriggerOn } from '../../../functional-model/sink-model/match-sink';
import { loadFdnDefinitionPool } from '../../utils/fdnDefinitionPool';
import { resolveFunctionalModelCardMeta } from '../../utils/cardMeta';
import type { CardDefinition } from '../../../functional-model/card';

const REVIEWS_PATH = join(process.cwd(), 'functional-model', 'sink-catalog-reviews.json');
const CATALOG_DIR = join('functional-model', 'sink-model', 'catalog');

/**
 * Real, on-disk content for the 3 files backing one catalog entry's own
 * status — same "a reviewer needs the actual per-case cases array/real
 * predicate logic, not just the summarized {total,passing}" rationale
 * `server/api/sink-derivations/index.get.ts`'s own `loadSourceFiles`
 * doc comment already establishes.
 */
export interface SinkCatalogSourceFiles {
  entry: SourceFileResult;
  corpusManifest: SourceFileResult;
  corpusTest: SourceFileResult;
}

/** Best-effort JSON parse of a real corpus manifest's own raw content — a
 * malformed file (shouldn't happen, these are hand-authored/checked-in)
 * comes back as a `{parseError, raw}` marker rather than throwing, same
 * "never crash a review dashboard over one bad file" posture the rest of
 * this route follows. */
function safeParseJson(content: string | null): unknown {
  if (content === null) return null;
  try {
    return JSON.parse(content);
  } catch {
    return { parseError: true, raw: content };
  }
}

/**
 * The `corpusManifest` half of `loadSourceFiles` — real, per-request fix
 * (2026-09-18) for the "only the FIRST member's own corpus content" gap
 * `sink-catalog-status.ts`'s own `SinkCatalogEvidence.corpusManifestPath`
 * doc comment already flagged. A singleton group (`evidence.members.length
 * <= 1`, true for every non-family entry AND degenerates identically for a
 * would-be 1-member family) is served exactly as before — that single
 * member's own raw file content, unchanged shape. A real multi-instance
 * family group instead combines EVERY real member's own `<slug>.corpus
 * .json` into one valid JSON object (`{total, passing, members: {<slug>:
 * <parsed content>}}`, `total`/`passing` mirroring `evidence`'s own already-
 * summed fields) so a reviewer reading the "Corpus manifest" panel sees the
 * real combined evidence, not one arbitrary instance's own slice of it.
 * `exists`/`truncated` are OR'd across every member (true iff any member's
 * own file is present/was truncated) — `path` becomes a comma-joined list
 * of every real member path (display-only; nothing reads this field as a
 * literal filesystem path downstream, `EngineConsoleCodeSection.vue` never
 * renders `result.path` at all).
 */
function loadCorpusManifestSourceFile(root: string, evidence: SinkCatalogEvidence): SourceFileResult {
  if (evidence.members.length <= 1) {
    const path = evidence.members[0]?.corpusManifestPath ?? evidence.corpusManifestPath;
    return readFunctionalModelFile(root, path);
  }
  const memberFiles = evidence.members.map((m) => ({ slug: m.slug, file: readFunctionalModelFile(root, m.corpusManifestPath) }));
  const combined = {
    total: evidence.corpusTotal,
    passing: evidence.corpusPassing,
    members: Object.fromEntries(memberFiles.map(({ slug, file }) => [slug, file.exists ? safeParseJson(file.content) : { missing: true }])),
  };
  return {
    path: memberFiles.map(({ file }) => file.path).join(', '),
    exists: memberFiles.some(({ file }) => file.exists),
    content: JSON.stringify(combined, null, 2),
    truncated: memberFiles.some(({ file }) => file.truncated),
  };
}

function loadSourceFiles(slug: string, evidence: SinkCatalogEvidence): SinkCatalogSourceFiles {
  const root = process.cwd();
  return {
    entry: readFunctionalModelFile(root, join(CATALOG_DIR, `${slug}.ts`)),
    corpusManifest: loadCorpusManifestSourceFile(root, evidence),
    corpusTest: readFunctionalModelFile(root, join(CATALOG_DIR, `${slug}.test.ts`)),
  };
}

export interface SinkCatalogReview {
  verdict: 'confirm' | 'reject';
  /** Required (by `./review.post.ts`) for a `'reject'` verdict — same
   * "that's the whole point of yellow" rule `SinkDerivationReview.note`
   * already enforces. Optional, but welcome, for `'confirm'`. */
  note?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  /** Snapshotted by `./review.post.ts` only for a `'confirm'` verdict —
   * `computeSinkCatalogFingerprint(slug)`'s own value at the moment of
   * confirmation. Compared against the CURRENT fingerprint on every read;
   * a mismatch downgrades the served `color` from `green` to `re-review`
   * instead of trusting a now-stale confirmation. Unused for `'reject'`. */
  fingerprint?: string;
}

function loadReviews(): Record<string, SinkCatalogReview> {
  if (!existsSync(REVIEWS_PATH)) return {};
  try {
    return JSON.parse(readFileSync(REVIEWS_PATH, 'utf8'));
  } catch {
    return {};
  }
}

/**
 * Real FDN cards (dev pool, `functional-model/fdn-cards/`, via the shared
 * `loadFdnDefinitionPool`) that actually match this entry TODAY — the
 * mocked-fixture corpus manifest (`evidence`/`sourceFiles.corpusManifest`
 * above) answers "does the curated query/consumer signal behave correctly
 * against a hand-picked fixture set," this answers the separate, real-world
 * question "who in the CURRENT pool actually satisfies it." Computed
 * UNCONDITIONALLY (not gated on this entry's own review `color`) — a
 * reviewer needs to see real matches for a not-yet-verified (`gray`/
 * `purple`) entry too, to help decide whether it's even right; this is a
 * different concern from `card-interactions.ts`'s own `isSinkCatalogEntryUsable`
 * gate, which protects the PRODUCTION card page from an unverified entry,
 * not this review tool.
 *
 * `producerMatches` — every pool card whose own structural occurrences
 * (`matchSink`, same producer-shaped check the corpus test itself uses)
 * satisfy `entry.query` ("who CAUSES this event"). `consumerMatches` —
 * every pool card recognized via EITHER real consumer-side signal an entry
 * may declare (`entry.consumerTriggerNames` via `matchesConsumerTriggerNames`,
 * a free-text `Trigger.name` check; `entry.consumerTriggerOn` via
 * `matchesConsumerTriggerOn`, the engine's own closed `Trigger.on` enum —
 * see `catalog/entry.ts`'s own doc comments for why both exist and why
 * `consumerTriggerOn` is the safer of the two) — merged into one list
 * (union, not two further sub-lists) since both answer the exact same
 * "who OWNS/REACTS to this event" question, just via different structural
 * evidence; omitted entirely (not just empty) when the entry declares
 * NEITHER consumer-side mechanism, per this task's own explicit "no empty
 * consumer section needed" instruction. Kept separate from
 * `producerMatches` rather than merged with it — a card can appear in
 * both, and collapsing that distinction would hide exactly the producer-
 * vs-consumer role confusion this task exists to make visible (e.g.
 * Felidar Savior: producer of Lifegain; Ajani's Pridemate: consumer of it,
 * never a producer).
 *
 * Each match is enriched with real set/collectorNumber/image (2026-09-18,
 * via `server/utils/cardMeta.ts`'s own `resolveFunctionalModelCardMeta` —
 * the SAME resolver/cache/429-avoidance machinery
 * `server/api/card/[set]/[number].ts`'s own `EnrichedCardInteractionMatch`
 * already uses) rather than served as bare names — a bare-name chip had no
 * route to link to and no way to render a real thumbnail without the client
 * firing its OWN live per-card Scryfall image request (the actual bug that
 * motivated this: a 111-card producer-match list meant 111 simultaneous
 * client-side live fetches, exactly the kind of burst
 * `server/utils/scryfallFetch.ts`'s own doc comment already had to solve
 * once). `self` mirrors `EnrichedCardInteractionMatch.self` structurally
 * (so the client can share one rendering component with the card page's own
 * Sinks section) but is never set true here — this page has no single "self"
 * card the way a card detail page does.
 */
export interface SinkCatalogRealMatch {
  card: string;
  self?: boolean;
  set?: string;
  collectorNumber?: string;
  image: string | null;
}
export interface SinkCatalogRealMatches {
  producerMatches: SinkCatalogRealMatch[];
  consumerMatches?: SinkCatalogRealMatch[];
}

export interface SinkCatalogPageEntry {
  /** Stable identity key — a catalog entry has no separate `key`/`slug`
   * split the way sink-derivation mechanisms do (`sink-catalog-status.ts`'s
   * own `SinkCatalogStatusEntry` carries only `slug`) — reused directly as
   * both the served identity and the review-overlay key. */
  slug: string;
  category: string;
  /** The entry's own real, full curated query — the QUESTION this catalog
   * entry answers (`sink-model/catalog/entry.ts`'s own `SinkCatalogEntry
   * .query`). Read straight off `SINK_CATALOG` (not derived from
   * `computeSinkCatalogStatus`, which only surfaces `category`). */
  query: SinkQuery;
  /** The real, computed gray/purple/blue call — UNCHANGED by review (kept
   * alongside `color` so a consumer can always see what the reviewer
   * actually overrode, and why `color` differs from it). */
  baseline: SinkCatalogBaseline;
  evidence: SinkCatalogEvidence;
  /** Real, on-disk content for the 3 files backing this entry — see
   * `SinkCatalogSourceFiles`'s own doc comment. */
  sourceFiles: SinkCatalogSourceFiles;
  /** `baseline`, unless a human review overlay upgrades it to
   * `yellow`/`green`/`re-review` — see `SinkCatalogReview` above. This is
   * the field a consumer should render/filter on. */
  color: SinkCatalogColor;
  review?: SinkCatalogReview;
  /** `undefined` in production (see `loadFdnDefinitionPool`'s own doc
   * comment — the dev-only FDN pool never survives a Netlify Function
   * bundle); a real entry list otherwise, `producerMatches: []` (not
   * omitted) when the pool is genuinely empty (no `fdn-cards/` folders
   * yet) — an honest "nothing to match against yet," not hidden. */
  realMatches?: SinkCatalogRealMatches;
}

/** True iff `candidate` structurally PRODUCES this ONE real `SINK_CATALOG`
 * instance's own event — a real `SinkInstance` (every current
 * `battlefield-presence-*`/`counters-*` member, built by the
 * `BattlefieldPresenceSink`/`CountersSink` factories, `sink-model/catalog/
 * entry.ts`) is directly CALLABLE and answers this (plus every declared
 * consumer signal, uniformly, whatever kind it is) in one real match-detail
 * call; a plain, non-callable singleton entry (`lifegain`/`graveyard-
 * fodder`/`etb`) falls back to the bare `matchSink(instance.query, ...)`
 * check every pre-family-refactor call site already used. */
function instanceProducerMatched(instance: (typeof SINK_CATALOG)[number], candidate: CardDefinition, root: string): boolean {
  // `SINK_CATALOG`'s own inferred element type collapses to the plain,
  // non-callable `SinkCatalogEntry` shape (every real `SinkInstance` IS
  // structurally a `SinkCatalogEntry` too, so array-literal inference keeps
  // only their common supertype) — the runtime `typeof instance ===
  // 'function'` check is still correct (`battlefield-presence-*`/
  // `counters-*` members really are callable, see `catalog/entry.ts`'s own
  // `SinkInstance` doc comment), it's only the STATIC type that needs an
  // explicit `unknown`-mediated cast to recover the call signature.
  if (typeof instance === 'function') return !!(instance as unknown as SinkInstance)(candidate, root)?.producer;
  return matchSink(instance.query, candidate, root).matched;
}

/** True iff this ONE real instance declares ANY consumer-side recognition
 * mode at all (`consumerTriggerNames`/`consumerTriggerOn`/
 * `consumerBattlefieldPresence`) — governs whether a group's aggregated
 * `consumerMatches` key is served at all (omitted, not `[]`, when NO member
 * declares one — same "no empty consumer section" rule the pre-family
 * single-instance check already followed). */
function instanceHasConsumerSignal(instance: (typeof SINK_CATALOG)[number]): boolean {
  return (
    (!!instance.consumerTriggerNames && instance.consumerTriggerNames.length > 0) ||
    (!!instance.consumerTriggerOn && instance.consumerTriggerOn.length > 0) ||
    !!instance.consumerBattlefieldPresence
  );
}

/** True iff `candidate` structurally satisfies this ONE real instance's own
 * consumer-side signal, whichever kind it declares — a callable `SinkInstance`
 * answers this uniformly (including `consumerBattlefieldPresence`, which the
 * bare `matchesConsumerTriggerNames`/`matchesConsumerTriggerOn` pair below
 * has no knowledge of at all — this is also the real fix for
 * `.claude/contracts/card-schema.md`'s own previously-flagged
 * "`computeRealMatches` doesn't yet know about `consumerBattlefieldPresence`"
 * gap, for every family member, for free); a plain singleton entry falls
 * back to the same trigger-name/trigger-on checks as before. */
function instanceConsumerMatched(instance: (typeof SINK_CATALOG)[number], candidate: CardDefinition, root: string): boolean {
  // Same `unknown`-mediated cast as `instanceProducerMatched` above — see
  // its own comment.
  if (typeof instance === 'function') return !!(instance as unknown as SinkInstance)(candidate, root)?.consumer;
  return matchesConsumerTriggerNames(instance.consumerTriggerNames, candidate) || matchesConsumerTriggerOn(instance.consumerTriggerOn, candidate);
}

/**
 * Real FDN pool matches for a whole GROUP (a family's combined real member
 * instances, or a singleton instance standing alone — `members.length === 1`
 * degenerates to exactly the pre-family-refactor per-instance behavior, no
 * separate code path needed). `producerMatches`/`consumerMatches` are each
 * the UNION across every real member's own match, deduped by card name (a
 * candidate satisfying more than one member in the same family — e.g. a
 * Cat-token-making Creature satisfying both `battlefield-presence-cats` and
 * `battlefield-presence-creatures` — counts once, not twice).
 */
/** Real set/collectorNumber/image for every name in a sorted match-name
 * list, via the shared `resolveFunctionalModelCardMeta` (forever-per-process
 * cached — see that module's own doc comment) — the enrichment step
 * `computeRealMatches` below applies to both `producerMatches` and
 * `consumerMatches`. */
async function enrichMatchNames(names: string[]): Promise<SinkCatalogRealMatch[]> {
  return Promise.all(
    names.map(async (name): Promise<SinkCatalogRealMatch> => {
      const ref = await resolveFunctionalModelCardMeta(name);
      return { card: name, set: ref?.set, collectorNumber: ref?.collectorNumber, image: ref?.image ?? null };
    }),
  );
}

async function computeRealMatches(members: (typeof SINK_CATALOG)[number][], pool: CardDefinition[], root: string): Promise<SinkCatalogRealMatches> {
  const producerNames = new Set<string>();
  for (const candidate of pool) {
    if (members.some((m) => instanceProducerMatched(m, candidate, root))) producerNames.add(candidate.name);
  }
  const result: SinkCatalogRealMatches = { producerMatches: await enrichMatchNames([...producerNames].sort()) };
  if (members.some(instanceHasConsumerSignal)) {
    const consumerNames = new Set<string>();
    for (const candidate of pool) {
      if (members.some((m) => instanceConsumerMatched(m, candidate, root))) consumerNames.add(candidate.name);
    }
    result.consumerMatches = await enrichMatchNames([...consumerNames].sort());
  }
  return result;
}

export default defineEventHandler(async (): Promise<SinkCatalogPageEntry[]> => {
  const root = process.cwd();
  const baselineEntries = computeSinkCatalogStatus(root);
  const reviews = loadReviews();
  // Dev-only real FDN pool (see `loadFdnDefinitionPool`'s own doc comment):
  // loaded ONCE per request, shared across every entry below, rather than
  // once per entry — the whole point of the shared, process-cached loader.
  const pool = process.env.NODE_ENV === 'production' ? [] : await loadFdnDefinitionPool(root);

  return Promise.all(baselineEntries.map(async (entry): Promise<SinkCatalogPageEntry> => {
    // Real member instances this group aggregates — `entry.evidence
    // .members[].slug` (`sink-catalog-status.ts`) is always the real,
    // per-instance slug list, length 1 for a singleton and N for a real
    // multi-instance family (`entry.slug` itself is the GROUP key, which,
    // post-family-refactor, is no longer a `SINK_CATALOG` slug at all for
    // `battlefield-presence`/`counters` — looking IT up directly, the
    // pre-fix bug, always came back `undefined` for both, silently killing
    // `realMatches` for the whole group).
    const members = entry.evidence.members
      .map((m) => SINK_CATALOG.find((e) => e.slug === m.slug))
      .filter((e): e is (typeof SINK_CATALOG)[number] => e !== undefined);
    const review = reviews[entry.slug];
    // Color computation (baseline-gating a review overlay to `blue`-only,
    // plus the `re-review` fingerprint-drift check) lives in
    // `functional-model/sink-catalog-status.ts`'s own
    // `computeSinkCatalogColor` — reused here directly rather than
    // re-duplicated, same as `server/api/sink-derivations/index.get.ts`'s
    // own `computeSinkDerivationColor` reuse.
    const color: SinkCatalogColor = computeSinkCatalogColor(entry.slug, root);
    return {
      slug: entry.slug,
      category: entry.category,
      // The group's own representative query — the FIRST real member's
      // own `query` (mirrors `SinkCatalogEvidence.corpusManifestPath`'s own
      // "first member, representative" convention) for a real multi-
      // instance family, since there is no single honest "the" query for a
      // whole family (each member curates its own). The `?? { category }`
      // fallback only guards a same-request race with a hot-reloaded
      // catalog (every real member should always be found by construction),
      // never a real steady-state path.
      query: members[0]?.query ?? ({ category: entry.category } as SinkQuery),
      baseline: entry.baseline,
      evidence: entry.evidence,
      sourceFiles: loadSourceFiles(entry.slug, entry.evidence),
      color,
      review,
      realMatches: members.length > 0 && process.env.NODE_ENV !== 'production' ? await computeRealMatches(members, pool, root) : undefined,
    };
  }));
});
