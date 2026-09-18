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
import { matchSink, matchesConsumerTriggerNames, matchesConsumerTriggerOn, matchesBattlefieldPresenceConsumer } from '../../../functional-model/sink-model/match-sink';
import { loadFdnDefinitionPool } from '../../utils/fdnDefinitionPool';
import { resolveFunctionalModelCardMeta } from '../../utils/cardMeta';
import type { CardDefinition } from '../../../functional-model/card';

const REVIEWS_PATH = join(process.cwd(), 'functional-model', 'sink-catalog-reviews.json');
const CATALOG_DIR = join('functional-model', 'sink-model', 'catalog');

/**
 * Real, on-disk content for the 2 files backing one catalog entry's own
 * review page — same "a reviewer needs the actual real logic/test file, not
 * a summarized JSON manifest" rationale `server/api/sink-derivations/
 * index.get.ts`'s own `loadSourceFiles` doc comment already establishes,
 * narrowed further (2026-09-18, user-directed: "I'll read tests directly" —
 * a separate raw `.corpus.json` JSON display is redundant next to the real
 * `.test.ts` file that already reads it) — this route used to also serve a
 * third `corpusManifest` field (the raw `.corpus.json` content); dropped
 * outright, not just unrendered, once nothing else read it (checked: the
 * ONLY consumer was this route's own sink review page,
 * `app/pages/app/engine/sinks/[[slug]].vue`'s now-removed "Corpus manifest"
 * panel — `app/pages/app/engine/predicates/[[slug]].vue`'s own identically-
 * named field is a DIFFERENT type, `server/api/sink-derivations/
 * index.get.ts`'s own `SinkDerivationSourceFiles`, untouched).
 */
export interface SinkCatalogSourceFiles {
  /** Real "sink source" — the file the entry's own matching LOGIC actually
   * lives in. For a real multi-instance FAMILY group (`entry.instanceSlugs`
   * present — `battlefield-presence`/`counters`), this is the shared
   * FACTORY file (`families/<slug>.ts`, e.g. `families/counters.ts`'s own
   * `CountersSink`), not any one member's own thin per-instance config file
   * (`counters-plus1plus1.ts` — just a config object + one factory call, no
   * real matching logic of its own to show a reviewer). For a singleton
   * (`lifegain`/`graveyard-fodder`/`etb`), unchanged from before: the
   * instance's own `<slug>.ts`, which already carries both config and
   * matching logic in the one file. */
  entry: SourceFileResult;
  corpusTest: SourceFileResult;
}

/**
 * `slug` is the GROUP key (`entry.slug` off `computeSinkCatalogStatus()` —
 * a real family key for a multi-instance group, or the singleton's own
 * slug); `isFamily` (`entry.instanceSlugs !== undefined`) decides whether
 * "sink source" resolves to the shared `families/<slug>.ts` factory file or
 * the singleton's own `<slug>.ts` — see `SinkCatalogSourceFiles.entry`'s own
 * doc comment. `corpusTest` already resolves correctly for either case
 * without this distinction: a family's own corpus test file is ALSO named
 * after the group/family key (`catalog/counters.test.ts`, not
 * `counters-plus1plus1.test.ts` — same "one shared test file per family,
 * covering every real member" convention `counters.test.ts`'s own header
 * establishes), so `${slug}.test.ts` was already right by construction.
 */
function loadSourceFiles(slug: string, isFamily: boolean): SinkCatalogSourceFiles {
  const root = process.cwd();
  const entryPath = isFamily ? join(CATALOG_DIR, 'families', `${slug}.ts`) : join(CATALOG_DIR, `${slug}.ts`);
  return {
    entry: readFunctionalModelFile(root, entryPath),
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
 * mocked-fixture corpus manifest (`evidence` above; see `SinkCatalogEvidence`,
 * `sink-catalog-status.ts`) answers "does the curated query/sink-candidate
 * signal behave correctly against a hand-picked fixture set," this answers
 * the separate, real-world question "who in the CURRENT pool actually
 * satisfies it." Computed UNCONDITIONALLY (not gated on this entry's own
 * review `color`) — a reviewer needs to see real matches for a not-yet-
 * verified (`gray`/`purple`) entry too, to help decide whether it's even
 * right; this is a different concern from `card-interactions.ts`'s own
 * `isSinkCatalogEntryUsable` gate, which protects the PRODUCTION card page
 * from an unverified entry, not this review tool.
 *
 * `sourceCandidateMatches` — every pool card whose own structural
 * occurrences (`matchSink`, same producer-shaped check the corpus test
 * itself uses) satisfy `entry.query` ("who CAUSES this event").
 * `sinkCandidateMatches` — every pool card recognized via EITHER real
 * sink-candidate signal an entry may declare (`entry.consumerTriggerNames`
 * via `matchesConsumerTriggerNames`, a free-text `Trigger.name` check;
 * `entry.consumerTriggerOn` via `matchesConsumerTriggerOn`, the engine's own
 * closed `Trigger.on` enum — see `catalog/entry.ts`'s own doc comments for
 * why both exist and why `consumerTriggerOn` is the safer of the two) —
 * merged into one list (union, not two further sub-lists) since both answer
 * the exact same "who OWNS/REACTS to this event" question, just via
 * different structural evidence; omitted entirely (not just empty) when the
 * entry declares NEITHER sink-candidate mechanism, per this task's own
 * explicit "no empty section needed" instruction. Kept separate from
 * `sourceCandidateMatches` rather than merged with it — a card can appear in
 * both, and collapsing that distinction would hide exactly the source-vs-
 * sink role confusion this task exists to make visible (e.g. Felidar
 * Savior: source candidate for Lifegain; Ajani's Pridemate: sink candidate
 * for it, never a source).
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
  /** Every real FDN pool card that structurally PRODUCES this entry's own
   * event — a "Source Candidate" (2026-09-18 rename, replacing "producer";
   * see `app/pages/app/engine/sinks/[[slug]].vue`'s own header for why —
   * avoids colliding with FIN's own `Fact.role` "source"/"sink" labels,
   * `CardDetailTabs.vue`'s FIN panel). */
  sourceCandidateMatches: SinkCatalogRealMatch[];
  /** Every real FDN pool card that structurally CONSUMES/reacts to this
   * entry's own category — a "Sink Candidate." */
  sinkCandidateMatches?: SinkCatalogRealMatch[];
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
   * `computeSinkCatalogStatus`, which only surfaces `category`).
   *
   * **Optional as of the 2026-09-18 `CountersSink` producer-mechanism
   * rewrite** — `SinkCatalogEntry.query` itself is now optional (see that
   * field's own doc comment, `sink-model/catalog/entry.ts`); `CountersSink`'s
   * own instances have none at all. Genuinely `undefined` for those, never a
   * synthesized stand-in object — per the user's own explicit correction,
   * "just put these mock definitions somewhere within test" (a mocked
   * `CardDefinition` in the family's own corpus test IS the real "what does
   * this sink look for" documentation; a fake query object serialized only
   * to keep a display panel populated is exactly the indirection being
   * removed). The review page's own "Curated SinkQuery" panel
   * (`app/pages/app/engine/sinks/[[slug]].vue`) renders conditionally on
   * this being present. */
  query?: SinkQuery;
  /** The real, computed gray/purple/blue call — UNCHANGED by review (kept
   * alongside `color` so a consumer can always see what the reviewer
   * actually overrode, and why `color` differs from it). */
  baseline: SinkCatalogBaseline;
  evidence: SinkCatalogEvidence;
  /** Real, on-disk content for the 2 files backing this entry — see
   * `SinkCatalogSourceFiles`'s own doc comment. */
  sourceFiles: SinkCatalogSourceFiles;
  /** `baseline`, unless a human review overlay upgrades it to
   * `yellow`/`green`/`re-review` — see `SinkCatalogReview` above. This is
   * the field a consumer should render/filter on. */
  color: SinkCatalogColor;
  review?: SinkCatalogReview;
  /** `undefined` in production (see `loadFdnDefinitionPool`'s own doc
   * comment — the dev-only FDN pool never survives a Netlify Function
   * bundle); a real entry list otherwise, `sourceCandidateMatches: []` (not
   * omitted) when the pool is genuinely empty (no `fdn-cards/` folders
   * yet) — an honest "nothing to match against yet," not hidden. */
  realMatches?: SinkCatalogRealMatches;
}

/** True iff `candidate` is a real SOURCE CANDIDATE for this ONE real
 * `SINK_CATALOG` instance — it structurally PRODUCES the instance's own
 * event. A real `SinkInstance` (every current `battlefield-presence-*`/
 * `counters-*` member, built by the `BattlefieldPresenceSink`/`CountersSink`
 * factories, `sink-model/catalog/entry.ts`) is directly CALLABLE and answers
 * this with a plain `boolean` (2026-09-19 — see `SinkInstance`'s own doc
 * comment for the full "3rd real design iteration on this callable
 * contract" writeup: the callable answers the PRODUCER question only now,
 * never a combined producer-or-consumer question); a plain, non-callable
 * singleton entry (`lifegain`/`graveyard-fodder`/`etb`) falls back to the
 * bare `matchSink(instance.query, ...)` check every pre-family-refactor call
 * site already used. */
function instanceProducerMatched(instance: (typeof SINK_CATALOG)[number], candidate: CardDefinition, root: string): boolean {
  // `SINK_CATALOG`'s own inferred element type collapses to the plain,
  // non-callable `SinkCatalogEntry` shape (every real `SinkInstance` IS
  // structurally a `SinkCatalogEntry` too, so array-literal inference keeps
  // only their common supertype) — the runtime `typeof instance ===
  // 'function'` check is still correct (`battlefield-presence-*`/
  // `counters-*` members really are callable, see `catalog/entry.ts`'s own
  // `SinkInstance` doc comment), it's only the STATIC type that needs an
  // explicit `unknown`-mediated cast to recover the call signature.
  if (typeof instance === 'function') return (instance as unknown as SinkInstance)(candidate, root);
  // Non-callable branch is always a plain singleton entry (`lifegain`/
  // `graveyard-fodder`/`etb`) — those always carry a real `query` (only a
  // callable `SinkInstance` — `counters-*` today — may omit it); the `!` is
  // a real, structurally-justified assertion, not a guess.
  return matchSink(instance.query!, candidate, root).matched;
}

/** True iff this ONE real instance declares ANY sink-candidate recognition
 * mode at all (`consumerTriggerNames`/`consumerTriggerOn`/
 * `consumerBattlefieldPresence`) — governs whether a group's aggregated
 * `sinkCandidateMatches` key is served at all (omitted, not `[]`, when NO
 * member declares one — same "no empty section" rule the pre-family
 * single-instance check already followed). */
function instanceHasConsumerSignal(instance: (typeof SINK_CATALOG)[number]): boolean {
  return (
    (!!instance.consumerTriggerNames && instance.consumerTriggerNames.length > 0) ||
    (!!instance.consumerTriggerOn && instance.consumerTriggerOn.length > 0) ||
    !!instance.consumerBattlefieldPresence
  );
}

/** True iff `candidate` is a real SINK CANDIDATE for this ONE real
 * instance — it structurally satisfies the instance's own sink-candidate
 * signal, whichever kind it declares.
 *
 * **2026-09-19, boolean-return rewrite — no longer routed through the
 * callable at all, whether `instance` is callable or not.** The old
 * callable contract answered a combined producer-or-consumer question
 * (`SinkMatchDetail | null`); the new one (`SinkInstance`, see its own doc
 * comment, `sink-model/catalog/entry.ts`) answers the PRODUCER question
 * only, as a plain `boolean`. Every consumer-side signal
 * (`consumerTriggerNames`/`consumerTriggerOn`/`consumerBattlefieldPresence`)
 * is instead read directly off `instance`'s own plain DATA fields — present
 * uniformly whether `instance` happens to be callable or not, since a
 * family factory `Object.assign`s these fields onto the returned function
 * value the exact same way a plain singleton entry (`lifegain`/
 * `graveyard-fodder`/`etb`) carries them as plain object properties — so
 * there is no real branch needed here anymore at all. Checking
 * `matchesBattlefieldPresenceConsumer` unconditionally (not just for the
 * former "callable" branch) is what keeps this the real fix for
 * `.claude/contracts/card-schema.md`'s own previously-flagged
 * "`computeRealMatches` doesn't yet know about `consumerBattlefieldPresence`"
 * gap — a plain, non-callable entry never has that field set (`undefined`),
 * and `matchesBattlefieldPresenceConsumer` already declines outright on
 * `undefined`, so this is safe for every entry shape uniformly. */
function instanceConsumerMatched(instance: (typeof SINK_CATALOG)[number], candidate: CardDefinition): boolean {
  return (
    matchesConsumerTriggerNames(instance.consumerTriggerNames, candidate) ||
    matchesConsumerTriggerOn(instance.consumerTriggerOn, candidate) ||
    matchesBattlefieldPresenceConsumer(instance.consumerBattlefieldPresence, candidate)
  );
}

/**
 * Real FDN pool matches for a whole GROUP (a family's combined real member
 * instances, or a singleton instance standing alone — `members.length === 1`
 * degenerates to exactly the pre-family-refactor per-instance behavior, no
 * separate code path needed). `sourceCandidateMatches`/`sinkCandidateMatches`
 * are each the UNION across every real member's own match, deduped by card
 * name (a candidate satisfying more than one member in the same family —
 * e.g. a Cat-token-making Creature satisfying both `battlefield-presence-cats`
 * and `battlefield-presence-creatures` — counts once, not twice).
 */
/** Real set/collectorNumber/image for every name in a sorted match-name
 * list, via the shared `resolveFunctionalModelCardMeta` (forever-per-process
 * cached — see that module's own doc comment) — the enrichment step
 * `computeRealMatches` below applies to both `sourceCandidateMatches` and
 * `sinkCandidateMatches`. */
async function enrichMatchNames(names: string[]): Promise<SinkCatalogRealMatch[]> {
  return Promise.all(
    names.map(async (name): Promise<SinkCatalogRealMatch> => {
      const ref = await resolveFunctionalModelCardMeta(name);
      return { card: name, set: ref?.set, collectorNumber: ref?.collectorNumber, image: ref?.image ?? null };
    }),
  );
}

async function computeRealMatches(members: (typeof SINK_CATALOG)[number][], pool: CardDefinition[], root: string): Promise<SinkCatalogRealMatches> {
  const sourceCandidateNames = new Set<string>();
  for (const candidate of pool) {
    if (members.some((m) => instanceProducerMatched(m, candidate, root))) sourceCandidateNames.add(candidate.name);
  }
  const result: SinkCatalogRealMatches = { sourceCandidateMatches: await enrichMatchNames([...sourceCandidateNames].sort()) };
  if (members.some(instanceHasConsumerSignal)) {
    const sinkCandidateNames = new Set<string>();
    for (const candidate of pool) {
      if (members.some((m) => instanceConsumerMatched(m, candidate))) sinkCandidateNames.add(candidate.name);
    }
    result.sinkCandidateMatches = await enrichMatchNames([...sinkCandidateNames].sort());
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
      // The group's own representative query — the FIRST real member's own
      // `query` (mirrors `SinkCatalogEvidence.corpusManifestPath`'s own
      // "first member, representative" convention) for a real multi-instance
      // family, since there is no single honest "the" query for a whole
      // family (each member curates its own). Genuinely `undefined` (not a
      // synthesized stand-in) when that member has none at all — today,
      // every real `counters-*` member (`SinkCatalogEntry.query`'s own doc
      // comment, `sink-model/catalog/entry.ts`, has the full "no fake query
      // just to keep a display panel populated" reasoning).
      query: members[0]?.query,
      baseline: entry.baseline,
      evidence: entry.evidence,
      sourceFiles: loadSourceFiles(entry.slug, entry.instanceSlugs !== undefined),
      color,
      review,
      realMatches: members.length > 0 && process.env.NODE_ENV !== 'production' ? await computeRealMatches(members, pool, root) : undefined,
    };
  }));
});
