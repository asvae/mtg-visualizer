// Matcher CATALOG entry status suite — GET /api/sink-catalog.
// Read-only reporting mirror of GET /api/sink-derivations
// (server/api/sink-derivations/index.get.ts), but for a genuinely
// different axis: one row per REVIEWED, SHARED catalog entry
// (`functional-model/matcher-model/catalog/<slug>.ts`) rather than per
// engine-automation mechanism — see
// `functional-model/matcher-catalog-status.ts`'s own header for the full
// gray/purple/blue/yellow/green/re-review design, and
// `.claude/contracts/card-schema.md`'s "Matcher CATALOG..." section for the
// full contract this route serves.
//
// Baseline (`gray`/`purple`/`blue`) is computed fresh off real filesystem
// presence of a catalog entry's own structural-gate corpus manifest, by
// `computeMatcherCatalogStatus()`. `yellow`/`green` are a human-review OVERLAY
// on top, loaded from `functional-model/matcher-catalog-reviews.json` (same
// split `server/api/sink-derivations/index.get.ts`'s own
// `sink-derivation-reviews.json` overlay already establishes) — written by
// this route's own sibling, `./review.post.ts`.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { computeMatcherCatalogStatus, computeMatcherCatalogColor } from '../../../functional-model/matcher-catalog-status';
import type { MatcherCatalogBaseline, MatcherCatalogColor, MatcherCatalogEvidence } from '../../../functional-model/matcher-catalog-status';
import { MATCHER_CATALOG } from '../../../functional-model/matcher-model/catalog/index';
import type { Matcher } from '../../../functional-model/matcher-model/catalog/entry';
import type { MatcherQuery } from '../../../functional-model/matcher-model/matcher-query';
import { readFunctionalModelFile, type SourceFileResult } from '../../../functional-model/source-files';
import { matchQuery, matchesConsumerTriggerNames, matchesConsumerTriggerOn, matchesBattlefieldPresenceConsumer } from '../../../functional-model/matcher-model/match-query';
import { loadFdnDefinitionPool } from '../../utils/fdnDefinitionPool';
import { resolveFunctionalModelCardMeta } from '../../utils/cardMeta';
import type { CardDefinition } from '../../../functional-model/card';

const REVIEWS_PATH = join(process.cwd(), 'functional-model', 'matcher-catalog-reviews.json');
const CATALOG_DIR = join('functional-model', 'matcher-model', 'catalog');

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
export interface MatcherCatalogSourceFiles {
  /** Real "sink source" — the file the entry's own matching LOGIC actually
   * lives in. For a real multi-instance FAMILY group (`entry.instanceSlugs`
   * present — `battlefield-presence`/`counters`), this is the shared
   * FACTORY file (`families/<slug>.ts`, e.g. `families/counters.ts`'s own
   * `CountersMatcher`), not any one member's own thin per-instance config file
   * (`counters-plus1plus1.ts` — just a config object + one factory call, no
   * real matching logic of its own to show a reviewer). For a singleton
   * (`lifegain`/`graveyard-fodder`/`etb`), unchanged from before: the
   * instance's own `<slug>.ts`, which already carries both config and
   * matching logic in the one file. */
  entry: SourceFileResult;
  corpusTest: SourceFileResult;
}

/**
 * `slug` is the GROUP key (`entry.slug` off `computeMatcherCatalogStatus()` —
 * a real family key for a multi-instance group, or the singleton's own
 * slug); `isFamily` (`entry.instanceSlugs !== undefined`) decides whether
 * "sink source" resolves to the shared `families/<slug>.ts` factory file or
 * the singleton's own `<slug>.ts` — see `MatcherCatalogSourceFiles.entry`'s own
 * doc comment. `corpusTest` already resolves correctly for either case
 * without this distinction: a family's own test file is ALSO named
 * after the group/family key (`catalog/counters.test.ts`, not
 * `counters-plus1plus1.test.ts` — same "one shared test file per family,
 * covering every real member" convention `counters.test.ts`'s own header
 * establishes), so `${slug}.test.ts` was already right by construction.
 */
function loadSourceFiles(slug: string, isFamily: boolean): MatcherCatalogSourceFiles {
  const root = process.cwd();
  const entryPath = isFamily ? join(CATALOG_DIR, 'families', `${slug}.ts`) : join(CATALOG_DIR, `${slug}.ts`);
  return {
    entry: readFunctionalModelFile(root, entryPath),
    corpusTest: readFunctionalModelFile(root, join(CATALOG_DIR, `${slug}.test.ts`)),
  };
}

export interface MatcherCatalogReview {
  verdict: 'confirm' | 'reject';
  /** Required (by `./review.post.ts`) for a `'reject'` verdict — same
   * "that's the whole point of yellow" rule `SinkDerivationReview.note`
   * already enforces. Optional, but welcome, for `'confirm'`. */
  note?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  /** Snapshotted by `./review.post.ts` only for a `'confirm'` verdict —
   * `computeMatcherCatalogFingerprint(slug)`'s own value at the moment of
   * confirmation. Compared against the CURRENT fingerprint on every read;
   * a mismatch downgrades the served `color` from `green` to `re-review`
   * instead of trusting a now-stale confirmation. Unused for `'reject'`. */
  fingerprint?: string;
}

function loadReviews(): Record<string, MatcherCatalogReview> {
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
 * mocked-fixture corpus manifest (`evidence` above; see `MatcherCatalogEvidence`,
 * `matcher-catalog-status.ts`) answers "does the curated query/sink-candidate
 * signal behave correctly against a hand-picked fixture set," this answers
 * the separate, real-world question "who in the CURRENT pool actually
 * satisfies it." Computed UNCONDITIONALLY (not gated on this entry's own
 * review `color`) — a reviewer needs to see real matches for a not-yet-
 * verified (`gray`/`purple`) entry too, to help decide whether it's even
 * right; this is a different concern from `card-interactions.ts`'s own
 * `isMatcherCatalogEntryUsable` gate, which protects the PRODUCTION card page
 * from an unverified entry, not this review tool.
 *
 * `sourceCandidateMatches` — every pool card whose own structural
 * occurrences (`matchQuery`, same producer-shaped check the corpus test
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
export interface MatcherCatalogRealMatch {
  card: string;
  self?: boolean;
  set?: string;
  collectorNumber?: string;
  image: string | null;
}
export interface MatcherCatalogRealMatches {
  /** Every real FDN pool card that structurally PRODUCES this entry's own
   * event — a "Source Candidate" (2026-09-18 rename, replacing "producer";
   * see `app/pages/app/engine/sinks/[[slug]].vue`'s own header for why —
   * avoids colliding with FIN's own `Fact.role` "source"/"sink" labels,
   * `CardDetailTabs.vue`'s FIN panel). */
  sourceCandidateMatches: MatcherCatalogRealMatch[];
  /** Every real FDN pool card that structurally CONSUMES/reacts to this
   * entry's own category — a "Sink Candidate." */
  sinkCandidateMatches?: MatcherCatalogRealMatch[];
}

export interface MatcherCatalogPageEntry {
  /** Stable identity key — a catalog entry has no separate `key`/`slug`
   * split the way sink-derivation mechanisms do (`matcher-catalog-status.ts`'s
   * own `MatcherCatalogStatusEntry` carries only `slug`) — reused directly as
   * both the served identity and the review-overlay key. */
  slug: string;
  category: string;
  /** The entry's own real, full curated query — the QUESTION this catalog
   * entry answers (`matcher-model/catalog/entry.ts`'s own `MatcherCatalogEntry
   * .query`). Read straight off `MATCHER_CATALOG` (not derived from
   * `computeMatcherCatalogStatus`, which only surfaces `category`).
   *
   * **Optional as of the 2026-09-18 `CountersMatcher` producer-mechanism
   * rewrite** — `MatcherCatalogEntry.query` itself is now optional (see that
   * field's own doc comment, `matcher-model/catalog/entry.ts`); `CountersMatcher`'s
   * own instances have none at all. Genuinely `undefined` for those, never a
   * synthesized stand-in object — per the user's own explicit correction,
   * "just put these mock definitions somewhere within test" (a mocked
   * `CardDefinition` in the family's own unit test IS the real "what does
   * this sink look for" documentation; a fake query object serialized only
   * to keep a display panel populated is exactly the indirection being
   * removed). The review page's own "Curated MatcherQuery" panel
   * (`app/pages/app/engine/sinks/[[slug]].vue`) renders conditionally on
   * this being present. */
  query?: MatcherQuery;
  /** The real, computed gray/purple/blue call — UNCHANGED by review (kept
   * alongside `color` so a consumer can always see what the reviewer
   * actually overrode, and why `color` differs from it). */
  baseline: MatcherCatalogBaseline;
  evidence: MatcherCatalogEvidence;
  /** Real, on-disk content for the 2 files backing this entry — see
   * `MatcherCatalogSourceFiles`'s own doc comment. */
  sourceFiles: MatcherCatalogSourceFiles;
  /** `baseline`, unless a human review overlay upgrades it to
   * `yellow`/`green`/`re-review` — see `MatcherCatalogReview` above. This is
   * the field a consumer should render/filter on. */
  color: MatcherCatalogColor;
  review?: MatcherCatalogReview;
  /** `undefined` in production (see `loadFdnDefinitionPool`'s own doc
   * comment — the dev-only FDN pool never survives a Netlify Function
   * bundle); a real entry list otherwise, `sourceCandidateMatches: []` (not
   * omitted) when the pool is genuinely empty (no `fdn-cards/` folders
   * yet) — an honest "nothing to match against yet," not hidden. */
  realMatches?: MatcherCatalogRealMatches;
}

/** True iff `candidate` is a real SOURCE CANDIDATE for this ONE real
 * `MATCHER_CATALOG` instance — it structurally PRODUCES the instance's own
 * event. A real `Matcher` (every current `battlefield-presence-*`/
 * `counters-*` member, built by the `BattlefieldPresenceMatcher`/`CountersMatcher`
 * factories, `matcher-model/catalog/entry.ts`) is directly CALLABLE and answers
 * this with a plain `boolean` (2026-09-19 — see `Matcher`'s own doc
 * comment for the full "3rd real design iteration on this callable
 * contract" writeup: the callable answers the PRODUCER question only now,
 * never a combined producer-or-consumer question); a plain, non-callable
 * singleton entry (`lifegain`/`graveyard-fodder`/`etb`) falls back to the
 * bare `matchQuery(instance.query, ...)` check every pre-family-refactor call
 * site already used. */
function instanceProducerMatched(instance: (typeof MATCHER_CATALOG)[number], candidate: CardDefinition, root: string): boolean {
  // `MATCHER_CATALOG`'s own inferred element type collapses to the plain,
  // non-callable `MatcherCatalogEntry` shape (every real `Matcher` IS
  // structurally a `MatcherCatalogEntry` too, so array-literal inference keeps
  // only their common supertype) — the runtime `typeof instance ===
  // 'function'` check is still correct (`battlefield-presence-*`/
  // `counters-*` members really are callable, see `catalog/entry.ts`'s own
  // `Matcher` doc comment), it's only the STATIC type that needs an
  // explicit `unknown`-mediated cast to recover the call signature.
  if (typeof instance === 'function') return (instance as unknown as Matcher)(candidate, root);
  // Non-callable branch is always a plain singleton entry (`lifegain`/
  // `graveyard-fodder`/`etb`) — those always carry a real `query` (only a
  // callable `Matcher` — `counters-*` today — may omit it); the `!` is
  // a real, structurally-justified assertion, not a guess.
  return matchQuery(instance.query!, candidate, root).matched;
}

/** True iff this ONE real instance declares ANY sink-candidate recognition
 * mode at all (`consumerTriggerNames`/`consumerTriggerOn`/
 * `consumerBattlefieldPresence`) — governs whether a group's aggregated
 * `sinkCandidateMatches` key is served at all (omitted, not `[]`, when NO
 * member declares one — same "no empty section" rule the pre-family
 * single-instance check already followed). */
function instanceHasConsumerSignal(instance: (typeof MATCHER_CATALOG)[number]): boolean {
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
 * (`SinkMatchDetail | null`); the new one (`Matcher`, see its own doc
 * comment, `matcher-model/catalog/entry.ts`) answers the PRODUCER question
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
function instanceConsumerMatched(instance: (typeof MATCHER_CATALOG)[number], candidate: CardDefinition): boolean {
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
async function enrichMatchNames(names: string[]): Promise<MatcherCatalogRealMatch[]> {
  return Promise.all(
    names.map(async (name): Promise<MatcherCatalogRealMatch> => {
      const ref = await resolveFunctionalModelCardMeta(name);
      return { card: name, set: ref?.set, collectorNumber: ref?.collectorNumber, image: ref?.image ?? null };
    }),
  );
}

async function computeRealMatches(members: (typeof MATCHER_CATALOG)[number][], pool: CardDefinition[], root: string): Promise<MatcherCatalogRealMatches> {
  const sourceCandidateNames = new Set<string>();
  for (const candidate of pool) {
    if (members.some((m) => instanceProducerMatched(m, candidate, root))) sourceCandidateNames.add(candidate.name);
  }
  const result: MatcherCatalogRealMatches = { sourceCandidateMatches: await enrichMatchNames([...sourceCandidateNames].sort()) };
  if (members.some(instanceHasConsumerSignal)) {
    const sinkCandidateNames = new Set<string>();
    for (const candidate of pool) {
      if (members.some((m) => instanceConsumerMatched(m, candidate))) sinkCandidateNames.add(candidate.name);
    }
    result.sinkCandidateMatches = await enrichMatchNames([...sinkCandidateNames].sort());
  }
  return result;
}

export default defineEventHandler(async (): Promise<MatcherCatalogPageEntry[]> => {
  const root = process.cwd();
  const baselineEntries = computeMatcherCatalogStatus(root);
  const reviews = loadReviews();
  // Dev-only real FDN pool (see `loadFdnDefinitionPool`'s own doc comment):
  // loaded ONCE per request, shared across every entry below, rather than
  // once per entry — the whole point of the shared, process-cached loader.
  const pool = process.env.NODE_ENV === 'production' ? [] : await loadFdnDefinitionPool(root);

  return Promise.all(baselineEntries.map(async (entry): Promise<MatcherCatalogPageEntry> => {
    // Real member instances this group aggregates — `entry.evidence
    // .members[].slug` (`matcher-catalog-status.ts`) is always the real,
    // per-instance slug list, length 1 for a singleton and N for a real
    // multi-instance family (`entry.slug` itself is the GROUP key, which,
    // post-family-refactor, is no longer a `MATCHER_CATALOG` slug at all for
    // `battlefield-presence`/`counters` — looking IT up directly, the
    // pre-fix bug, always came back `undefined` for both, silently killing
    // `realMatches` for the whole group).
    const members = entry.evidence.members
      .map((m) => MATCHER_CATALOG.find((e) => e.slug === m.slug))
      .filter((e): e is (typeof MATCHER_CATALOG)[number] => e !== undefined);
    const review = reviews[entry.slug];
    // Color computation (baseline-gating a review overlay to `blue`-only,
    // plus the `re-review` fingerprint-drift check) lives in
    // `functional-model/matcher-catalog-status.ts`'s own
    // `computeMatcherCatalogColor` — reused here directly rather than
    // re-duplicated, same as `server/api/sink-derivations/index.get.ts`'s
    // own `computeSinkDerivationColor` reuse.
    const color: MatcherCatalogColor = computeMatcherCatalogColor(entry.slug, root);
    return {
      slug: entry.slug,
      category: entry.category,
      // The group's own representative query — the FIRST real member's own
      // `query` (mirrors `MatcherCatalogEvidence.corpusManifestPath`'s own
      // "first member, representative" convention) for a real multi-instance
      // family, since there is no single honest "the" query for a whole
      // family (each member curates its own). Genuinely `undefined` (not a
      // synthesized stand-in) when that member has none at all — today,
      // every real `counters-*` member (`MatcherCatalogEntry.query`'s own doc
      // comment, `matcher-model/catalog/entry.ts`, has the full "no fake query
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
