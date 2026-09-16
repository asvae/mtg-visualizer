// Single-card detail endpoint — everything the card detail page needs
// (Scryfall data and tagging relations) in one request, independent of the
// big client-side graph store (app/composables/useGraphStore.ts). That store
// assembles a whole set/query's worth of cards at once via buildGraph.ts;
// this route reuses buildGraph.ts's per-card mapping helpers so a single
// card renders identically without needing the rest of the corpus loaded.
//
// GET or POST /api/card/:set/:number — same identity Scryfall's own card URLs
// use (scryfall.com/card/<set>/<number>), so prev/next is a plain ±1 on
// :number. A POST body may carry `{ filterNames?: string[] }` — the active
// global filter's resolved card names (deck import OR Scryfall query, see
// useGraphStore.ts's `getActiveFilterMode()`) — which scopes the
// Interactions panel down to matches against just those cards instead of the
// whole functional-model corpus. GET (no body) still works identically to
// before, unscoped, same as a plain page reload with no filter active.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { DatabaseSync } from 'node:sqlite';
import { cardArtCrop, cardFaceKeywords, cardImages, cardTokens, creatureSubtypes, slugify, BADGE_KEYWORDS } from '../../../../app/lib/buildGraph';
import type { ScryfallCard, RelationsEntry, TokensById } from '../../../../app/lib/buildGraph';
import type { CardData, EdgeData, Role, ThemeData } from '../../../../app/types';
import { findInteractionsForCard } from '../../../../functional-model/synergy';
import type { InteractionGroup, Fact } from '../../../../functional-model/synergy';
import type { AnnotatedCard } from '../../../../app/types';
import type { Scenario, TraceResult } from '../../../../functional-model/harness';
import type { CardDefinition } from '../../../../functional-model/card';
import { loadCardSynergy, loadFunctionalModelPool } from '../../../utils/functionalModelPool';
import { fmBundle } from '../../../utils/fmBundle';
import { isStandardPrint } from '../../../utils/isStandardPrint';
import type { CardStatusEntry } from '../../../../functional-model/card-status';
import relationsData from '../../../../data/global_relations.json';
import finRelationsData from '../../../../data/fin/fin_relations.json';
import themesData from '../../../../data/global_themes.json';

// fin_relations.json wins over global_relations.json by name — see
// server/api/cards.ts for why (FIN not yet chronologically merged).
const relationsByName = new Map<string, RelationsEntry>([
  ...(relationsData as unknown as RelationsEntry[]).map((r): [string, RelationsEntry] => [r.name, r]),
  ...(finRelationsData as unknown as RelationsEntry[]).map((r): [string, RelationsEntry] => [r.name, r]),
]);

// Read fresh off disk on every request in dev (not a statically bundled
// import), so a hand-edited data file reflects immediately without a full
// dev-server restart. Falls back to `bundled` for a production build
// (different cwd, raw source tree not shipped).
function loadJsonFresh<T>(relativePath: string, bundled: T): T {
  if (process.env.NODE_ENV === 'production') return bundled;
  try {
    return JSON.parse(readFileSync(join(process.cwd(), relativePath), 'utf8'));
  } catch {
    return bundled;
  }
}
// functional-model/cards/<slug>/ — a hand-authored, declarative
// CardDefinition (see functional-model/card.ts) run through
// functional-model/harness.ts's real, mutable game state
// (functional-model/state.ts) across its own scenarios.ts. No bundled
// fallback, dev-time comparison artifact — a miss here is the common case
// (only a hand-built subset of cards exist in this design so far, see
// functional-model/cards/).
//
// In DEV, traces are computed LIVE, in-process, on every cache-miss (see
// loadFunctionalModel below) — not read from the committed trace.json.
// runScenarios/runEngineScenarios are pure and deterministic, so this gives
// the identical result, just always fresh: editing a card's scenarios.ts/
// engine-scenario.ts and reloading the page shows the change immediately,
// no `run-scenarios.mjs` step needed.
//
// In PRODUCTION, none of that survives a Netlify Function bundle (spawning
// vite-node, readFileSync/readdirSync against the raw functional-model/
// source tree — confirmed in prod as ENOENT scandir
// '/var/task/functional-model'), so loadFunctionalModel instead reads
// server/utils/fmBundle.ts's statically-imported, build-time-generated
// snapshot (scripts/build-fm-bundle.mjs) — THAT path does read from the
// committed trace.json (via the bundle), same committed corpus
// functional-model/scripts/verify-synergy.mjs and run-scenarios.mjs
// themselves produce, just re-served instead of recomputed. A card edited
// since the bundle was last regenerated shows the last-committed snapshot
// in prod until `npm run sync:fm-bundle` is re-run and committed — same
// staleness contract synergy.json/trace.json/progress.json already carry
// for every OTHER consumer of them.
//
// Supersedes the older functional-model/data/<slug>.ts generator (one
// exported function per Forge ability line, produced by
// app/lib/functionalTranslate.ts) — that design is retired; this route no
// longer reads from it.
//
// loadCardSynergy (v2 SYNERGY_DESIGN.md attribute-bag facts) and
// loadFunctionalModelPool are shared with server/api/graph-links.ts — see
// server/utils/functionalModelPool.ts.

// One entry of `CardDefinition.continuousKeywordGrants` — derived off that
// type (not hand-duplicated) so this file can't silently drift from
// engine's own real shape (functional-model/card.ts). Exported for the card
// page (app/pages/app/card/[set]/[number].vue) to type its own
// `CardResponse.functionalModel.continuousKeywordGrants`, same convention
// `EnrichedInteractionGroup` below already establishes for this file's
// other served shapes.
export type ContinuousKeywordGrant = NonNullable<CardDefinition['continuousKeywordGrants']>[number];

// One entry of `progress.json`'s own OPTIONAL `annotatedNonFactSpans` array
// (2026-09-16 annotation-taxonomy rework — see
// `.claude/contracts/card-schema.md`'s own dated section for the full
// writeup). Real oracle-text/type-line spans that ARE accounted for but
// deliberately carry no `Fact`/`AnnotationRef` at all — `kind:'definition-
// path'` maps to something real in `CardDefinition` with no discrete Fact,
// `'rules'` is real unmodeled rules text (an actual gap), `'lore'` is
// flavor/reminder-style text. Shape mirrors `AnnotationRef`
// (`functional-model/synergy.ts`) plus `kind`/`note` — defined here rather
// than imported since `progress.json` itself has no shared TS type anywhere
// (engine's own build/verify scripts read it as plain untyped JSON). Not
// consulted by any matching logic, purely a Facts-tab presentational
// passthrough — engine never authors this type, only the raw JSON field.
export interface AnnotatedNonFactSpan {
  target: 'oracle' | 'typeLine';
  line?: number;
  start: number;
  end: number;
  face?: 'front' | 'back';
  kind: 'definition-path' | 'rules' | 'lore';
  note: string;
}

interface FunctionalModelData {
  source: string;
  synergy: { source: Fact[]; sink: Fact[] } | null;
  // Live-computed per-scenario output (functional-model/harness.ts's own
  // TraceResult[]) — kept as each scenario's own ordered log, for seeing
  // exactly what one specific scenario actually did.
  traces: TraceResult[];
  // Real structured per-face data (name/manaCost/colorIndicator/typeLine/
  // oracleText/power/toughness), one entry per face — a single-faced card is
  // a one-entry array. As of the 2026-09-11 `Fact.annotations` pointer
  // rework, `oracleText` is served RAW/UNTOUCHED (real `\n`s, not pre-split)
  // — a fact's own `annotations` (baked into synergy.json, see
  // functional-model/synergy.ts's `AnnotationRef`) carry the (line, start,
  // end) pointers a client needs to slice out highlighted spans itself; this
  // route no longer does any live string-search/segment-tree building
  // (the old `annotateOracleText`, now deprecated engine-side) on every
  // request. `null` when there's no synergy data to serve alongside the text
  // (a synergy-less card).
  annotatedCard: AnnotatedCard | null;
  // cards/<slug>/progress.json's own `review` field — 'ai' (the common case,
  // never human-checked against the real card) vs 'human' (someone actually
  // played/verified it — see this session's own review process). `null` when
  // progress.json is missing/malformed rather than assumed either way — the
  // card page treats null the same as 'ai' (show the draft badge) since an
  // untracked card is certainly not confirmed human-reviewed.
  review: 'ai' | 'human' | null;
  // cards/<slug>/progress.json's own `reviewCaveat` field (2026-09-17,
  // `uncertain` bucket — see `functional-model/card-status.ts`'s own header
  // for the full rationale) — a free-text note a human wrote when this
  // card's facts are otherwise fully complete but one SPECIFIC, real
  // conceptual gap remains that can't currently be modeled as a `Fact` at
  // all. `null` when absent/malformed progress.json/non-string value — same
  // "untracked = nothing to show" convention `review` above already uses.
  // Written by `server/api/card/review-status.ts`'s own `field:'review'`
  // handler (the "Confirm (Uncertain)" UI action, `CardDetailTabs.vue`) —
  // served here so that same UI can pre-fill its caveat-entry prompt with
  // whatever's already on file, rather than always starting blank.
  reviewCaveat: string | null;
  // cards/<slug>/progress.json's own `scenariosReview` field — a SEPARATE
  // axis from `review` above (that one's about the synergy.json FACTS;
  // this one's about whether a human has actually looked over the
  // Scenarios tab's own replay content and confirmed it's a realistic,
  // correctly-caused depiction of the card — see this session's own
  // fin/1-10 audit for what "unreviewed" catches: effects with no
  // traceable cause, wrong owners, bystanders that never appear, etc.).
  // Missing/malformed progress.json (or no `scenariosReview` field at all)
  // reads as 'draft' — every card starts unreviewed on this axis until
  // someone actually marks it, same "untracked = not confirmed" reasoning
  // `review` already uses.
  scenariosReview: 'draft' | 'reviewed';
  // Same axis/convention as `scenariosReview` above, for this card's own
  // Interactions section (the cross-card synergy join below `interactions`
  // at the top level of this route's own response) instead of its
  // Scenarios tab.
  interactionsReview: 'draft' | 'reviewed';
  // cards/<slug>/verified-snapshot.json's own `capturedAt` (ISO timestamp,
  // see server/api/card/review-status.ts's own "Verified-snapshot
  // regression guard" comment + .claude/contracts/card-schema.md) — when a
  // human last confirmed the FACTS review (`review` above) AND the
  // snapshot that transition froze is still on disk. `null` when there's no
  // verified-snapshot.json at all (never confirmed, or confirmed before
  // this guard existed and not yet backfilled) — NOT re-derived from
  // `review` itself: a card whose facts have since drifted gets its
  // `review` auto-reset to 'ai' by check-verified-regressions.mjs, but this
  // stays populated from the snapshot's own timestamp regardless, so the UI
  // can still show "this WAS confirmed, on this date" even after that
  // regression flip. See CardDetailTabs.vue for how the two are displayed
  // together.
  reviewSnapshotAt: string | null;
  // Real, query-time continuous keyword grant(s) off this card's own
  // CardDefinition (613, ENGINE_GAPS.md gap #14, closed 2026-09-12 — see
  // `functional-model/card.ts`'s own `continuousKeywordGrants` doc comment
  // for the two real Forge shapes this covers, Dion/Ardyn) — front face,
  // then back face for a transforming DFC whose back face ALSO carries a
  // grant (none currently do, but this stays symmetric with `traces`/
  // `annotatedCard`'s own front-then-back convention rather than assuming).
  // `null` when neither face has one (the common case). This is a plain
  // DECLARATIVE CardDefinition field, not an `Effect`/`resolveCard()`
  // internal — serving it doesn't cross card-schema.md's "don't assume
  // Effect kinds" line. Consumed by `ScenarioReplayTrace.vue`, which
  // cross-references it against each replay snapshot's own live
  // `activePlayer`/owner/subtype at RENDER time — there is no discrete
  // trace.json log entry for a continuous (non-event-triggered) grant to
  // read instead, see that component's own doc comment.
  continuousKeywordGrants: { front?: ContinuousKeywordGrant[]; back?: ContinuousKeywordGrant[] } | null;
  // cards/<slug>/progress.json's own `annotatedNonFactSpans` (see
  // AnnotatedNonFactSpan above) — always an array, `[]` when the field is
  // absent/malformed (the common case; only ultima-origin-of-oblivion has a
  // real entry as of this writing). Passed through verbatim, never merged
  // into `annotatedCard`/`synergy` — the Facts tab renders these as
  // separate, non-Fact rows behind its own show/hide toggle.
  annotatedNonFactSpans: AnnotatedNonFactSpan[];
  // Per-card fact-authoring status (`functional-model/card-status.ts`'s own
  // 8-bucket red/orange/green/yellow/gray/verified/uncertain/re-review
  // classifier) — same
  // classifier `functional-model/scripts/compute-card-status.mjs` runs
  // pool-wide into the checked-in `data/fin/fin_card_status.json` batch
  // snapshot the `/app/status` grid page still reads, but computed LIVE,
  // per request, for just this one card (2026-09-16 — a confirmed real bug:
  // that batch file only refreshes on a manual `npm run card-status`, so a
  // just-confirmed review didn't show as "Verified" on this card's own page
  // until that script was rerun). `null` when it couldn't be computed at all
  // (no functional-model card directory/definition for this card — the
  // common case for most of the corpus). See `loadFunctionalModel`'s two
  // branches below for how dev (live) vs production (bundle-time-precomputed,
  // via `scripts/build-fm-bundle.mjs`) each populate this.
  cardStatus: CardStatusEntry | null;
}
// Cached per slug, invalidated by that card's own folder — a stat-only
// signature (mtimeMs of its own files) is cheap enough to check on every
// request, so a hand-edit (definition.ts, scenarios.ts, progress.json,
// synergy.json) shows up on the very next load with no server restart and
// no run-scenarios.mjs step, while a request for a card nobody's touched
// skips the readFileSync/dynamic-import/runScenarios/buildAnnotatedCard work
// entirely. Keyed on the faces' own JSON too (not just slug) since
// annotatedCard depends on them and they come from data/cards.db, outside
// this folder's own signature — cheap insurance against a stale annotation
// if the card's real oracle text ever changes between requests (a DB
// re-sync) without the folder itself changing.
const FM_FOLDER_FILES = ['definition.ts', 'scenarios.ts', 'progress.json', 'synergy.json'] as const;
// Every engine-piloted trace is computed by ACTUALLY EXECUTING
// run-one-card.mjs, which imports engine-trace.ts/harness.ts/card.ts/
// engine.ts/state.ts/turn.ts/saga.ts/sba.ts/mana.ts/tokens.ts/interfaces.ts/
// synergy.ts — the shared engine core every card's own scenario runs
// against, not just its own folder's files. `FM_FOLDER_FILES` alone missed
// this entirely: editing engine-trace.ts (say) never changed a single
// card's own signature, so every card kept serving whatever got cached
// before that edit until the server itself restarted — confirmed the hard
// way, a live request kept serving a "Turn passes to you's next Main1"
// label two real fixes after that wording was corrected in source. Read
// fresh each call (not hardcoded) so a NEW shared file added later is
// covered automatically, same as `FM_FOLDER_FILES`'s own per-card list
// covers whatever's actually there — cheap (a handful of `.ts` files, one
// readdir + stat each), same "cheap enough to check every request"
// philosophy this cache already runs on.
// Guards ENOENT for a production deploy where functional-model/ isn't on
// disk (loadFunctionalModel's own NODE_ENV short-circuit below should mean
// this never runs there — belt and suspenders).
function sharedEngineSignature(): string {
  try {
    const dir = join(process.cwd(), 'functional-model');
    return readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith('.ts'))
      .map((e) => `${e.name}:${statSync(join(dir, e.name)).mtimeMs}`)
      .join('|');
  } catch {
    return 'x';
  }
}
function functionalModelSignature(slug: string): string {
  const perCard = FM_FOLDER_FILES.map((f) => {
    try {
      return `${f}:${statSync(join(process.cwd(), `functional-model/cards/${slug}/${f}`)).mtimeMs}`;
    } catch {
      return `${f}:x`;
    }
  }).join('|');
  return `${perCard}||${sharedEngineSignature()}`;
}
// Computing traces live means actually EXECUTING the card's own
// engine-scenario.ts/scenarios.ts — tried as a plain in-process dynamic
// import() first, but Nitro's dev bundler handles that unreliably (a
// relative specifier resolves against wherever Nitro's dev bundle output
// happens to land, not this source file's own location, and an absolute
// one bypasses Nitro's transform entirely, landing on Node's raw loader,
// which can't resolve these files' own extensionless internal imports
// either way). Spawning vite-node as a child process sidesteps all of that
// — the exact same execution model functional-model/scripts/run-scenarios.mjs
// already uses successfully for the whole corpus, just for one card at a
// time (functional-model/scripts/run-one-card.mjs).
const execFileAsync = promisify(execFile);
async function computeTracesLive(slug: string): Promise<TraceResult[]> {
  const { stdout } = await execFileAsync(join(process.cwd(), 'node_modules/.bin/vite-node'), [
    join(process.cwd(), 'functional-model/scripts/run-one-card.mjs'),
    slug,
  ]);
  return JSON.parse(stdout);
}

// Live, per-request `cardStatus` (2026-09-16 — see `FunctionalModelData.
// cardStatus`'s own doc comment for the motivating bug). Same "spawn
// vite-node" reasoning as `computeTracesLive` immediately above, for a
// DIFFERENT concrete failure mode found while building this: a first attempt
// had this route statically `import`ing `computeTextCoverage` straight from
// `functional-model/scripts/text-coverage.mjs` (a plain, pure, fs-free
// function) and calling `classifyCardStatus` in-process — that resolved fine
// under `npx tsc --noEmit` but broke at actual request time in Nitro's dev
// server: `Cannot find module '/functional-model/scripts/text-coverage.mjs'
// imported from .../.nuxt/dev/index.mjs` (a `.mjs` sibling of an already-
// dynamically-imported `.ts` file apparently isn't traced/rewritten the same
// way Nitro's bundler handles this route's other `.ts` imports). Spawning
// `functional-model/scripts/compute-one-card-status.mjs` under vite-node —
// the exact same recipe `compute-card-status.mjs` runs pool-wide, for one
// slug — sidesteps that the same way `run-one-card.mjs` already does for
// traces. `null` on any failure (no definition.ts for this slug, a
// synergy-less card, etc. — see that script's own header).
async function computeCardStatusLive(slug: string, number: string): Promise<CardStatusEntry | null> {
  try {
    const { stdout } = await execFileAsync(join(process.cwd(), 'node_modules/.bin/vite-node'), [
      join(process.cwd(), 'functional-model/scripts/compute-one-card-status.mjs'),
      slug,
      number,
    ]);
    return JSON.parse(stdout);
  } catch {
    return null;
  }
}

// One face's raw Scryfall-derived fields, extracted by the route's own card-
// data flow (below) with no string formatting — `oracleText` rides straight
// onto the matching `AnnotatedFace` field untouched (real `\n`s, not
// pre-split); a client that wants fact-linked spans builds them itself from
// each visible fact's own baked `Fact.annotations`, see
// FunctionalModelText.vue.
export interface FaceInput {
  name: string;
  manaCost: string;
  colorIndicator?: string[];
  typeLine: string;
  oracleText: string;
  power?: string;
  toughness?: string;
}

// Shared between the live-recompute (dev) and bundle-read (prod) branches
// below — building `annotatedCard` only needs this request's own real
// Scryfall-derived `faces`; `synergy` itself is no longer read here at all
// (kept as a parameter purely so a synergy-less card still serves `null`,
// matching every other consumer's "no functional-model entry" contract) —
// the annotation pointers a client needs now live on each `Fact` itself
// (`Fact.annotations`, baked once into synergy.json by
// functional-model/scripts/compute-annotations.mjs), not computed here.
function buildAnnotatedCard(faces: FaceInput[], synergy: { source: Fact[]; sink: Fact[] } | null): AnnotatedCard | null {
  if (!synergy) return null;
  return { faces: faces.map((f) => ({ name: f.name, manaCost: f.manaCost, colorIndicator: f.colorIndicator, typeLine: f.typeLine, oracleText: f.oracleText, power: f.power, toughness: f.toughness })) };
}

// Dev-only: a direct, per-slug dynamic import of `definition.ts` by ABSOLUTE
// file:// URL — the exact same technique server/utils/functionalModelPool.ts
// already uses for the same reason (a relative specifier here resolves
// against Nitro's own bundled dev output directory, not this source file's —
// confirmed there the hard way). Deliberately NOT the `run-one-card.mjs`
// vite-node-subprocess path `computeTracesLive` uses below: that path only
// ever prints a `TraceResult[]`, never the raw `CardDefinition` object, and
// `continuousKeywordGrants` is plain declarative data (no engine execution
// needed to read it) — a subprocess round-trip would be pure overhead for a
// field that's just sitting on the already-parsed module. Independent of
// `loadFunctionalModelPool()` on purpose: that pool skips any card with no
// (or not-yet-v2-shaped) synergy.json, which has nothing to do with whether
// a card's OWN CardDefinition carries a keyword grant. Same known,
// documented, accepted limitation `loadFunctionalModelPool` already has for
// this import style: a `definition.ts` with an extensionless `from
// '../../tokens'` import throws "Directory import ... not supported" under
// plain Node ESM resolution (unlike vite-node) — caught below, degrades to
// `null` same as a card with no grant at all, not a route-wide failure.
// Split out (2026-09-16) so the live `cardStatus` computation below can
// reuse the SAME dynamic import instead of a second one for the same
// slug/request — `classifyCardStatus` needs the real, full `CardDefinition`
// object (to walk its `effects`/`triggers`/`abilities` for the `red`-bucket
// unsupported-construct check, `card-status.ts`'s own `collectEffects`),
// not just the `continuousKeywordGrants` slice this function used to return
// on its own.
async function loadCardDefinitionDev(slug: string): Promise<CardDefinition | undefined> {
  try {
    const definitionUrl = pathToFileURL(join(process.cwd(), `functional-model/cards/${slug}/definition.ts`)).href;
    const cardModule = (await import(definitionUrl)) as Record<string, unknown>;
    return Object.values(cardModule)[0] as CardDefinition | undefined;
  } catch {
    return undefined;
  }
}
function continuousKeywordGrantsFromDefinition(card: CardDefinition | undefined): { front?: ContinuousKeywordGrant[]; back?: ContinuousKeywordGrant[] } | null {
  const front = card?.continuousKeywordGrants;
  const back = card?.backFace?.continuousKeywordGrants;
  return front || back ? { front, back } : null;
}

const functionalModelCache = new Map<string, { signature: string; facesKey: string; data: FunctionalModelData | null }>();
// `collectorNumber` is only ever used to populate `cardStatus.number` below
// (never consulted for slug/cache-key resolution, which stays name-based as
// before) — CardDetailTabs.vue's own badge only ever reads `.status`/
// `.reasons` off that entry, but `classifyCardStatus`'s own required input
// shape wants a real number, so this thread's the request's real one through
// rather than faking it.
async function loadFunctionalModel(name: string, collectorNumber: string, faces: FaceInput[]): Promise<FunctionalModelData | null> {
  const slug = slugify(name);

  // Production: read server/utils/fmBundle.ts's statically-imported,
  // build-time-generated snapshot instead of the raw functional-model/
  // source tree — see this file's own header comment above
  // (FunctionalModelData) and fmBundle.ts for why. No fs access, no
  // subprocess, no NODE_ENV-gated cache needed — the bundle is already a
  // plain in-memory object once Nitro bundles it.
  if (process.env.NODE_ENV === 'production') {
    const entry = fmBundle[slug];
    if (!entry) return null;
    const front = entry.poolFacts.continuousKeywordGrants;
    const back = entry.poolFacts.backFace?.continuousKeywordGrants;
    return {
      source: entry.source,
      synergy: entry.synergy,
      traces: entry.traces,
      annotatedCard: buildAnnotatedCard(faces, entry.synergy),
      review: entry.review,
      // `undefined` on a bundle built before this field existed degrades to
      // `null`, same tolerance every other optional bundle field here
      // already has (see `entry.reviewSnapshotAt`/`entry.annotatedNonFactSpans`
      // immediately below).
      reviewCaveat: entry.reviewCaveat ?? null,
      scenariosReview: entry.scenariosReview,
      interactionsReview: entry.interactionsReview,
      reviewSnapshotAt: entry.reviewSnapshotAt ?? null,
      continuousKeywordGrants: front || back ? { front, back } : null,
      annotatedNonFactSpans: entry.annotatedNonFactSpans ?? [],
      // Precomputed at `npm run sync:fm-bundle` build time (scripts/
      // build-fm-bundle.mjs, same classifyCardStatus/computeTextCoverage
      // recipe as the dev branch below and compute-card-status.mjs) —
      // production can't dynamic-import definition.ts or scan data/ for
      // oracle text at request time (see this file's own header on why),
      // so it reads the bundle's already-computed value instead of
      // recomputing live. `undefined` on a bundle built before this field
      // existed (not yet re-synced) degrades to `null`, same tolerance
      // every other optional bundle field here already has.
      cardStatus: entry.cardStatus ?? null,
    };
  }

  const signature = functionalModelSignature(slug);
  const facesKey = JSON.stringify(faces);
  const cached = functionalModelCache.get(slug);
  if (cached && cached.signature === signature && cached.facesKey === facesKey) return cached.data;

  let data: FunctionalModelData | null;
  try {
    // Card Definition tab (FunctionalModelScript.vue) shows ONLY this card's
    // own definition.ts — scenario content (whether a plain `scenarios`
    // array or a real engine-piloted `runEngineScenarios()` pilot script)
    // belongs exclusively under the Scenarios tab (`traces` below, rendered
    // by ScenarioReplay.vue), never appended here. A prior version of this
    // function concatenated scenarios.ts's raw source onto `source` whenever
    // it used the runEngineScenarios shape — that leaked scenario prose
    // (setup/action/result strings, the pilot function itself) into the
    // Definition tab; removed outright, not just hidden client-side, since
    // the leak was in this served payload, not the Vue component.
    const source = readFileSync(join(process.cwd(), `functional-model/cards/${slug}/definition.ts`), 'utf8');
    const traces = await computeTracesLive(slug);
    const synergy = loadCardSynergy(slug);
    const annotatedCard = buildAnnotatedCard(faces, synergy);
    const definition = await loadCardDefinitionDev(slug);
    const continuousKeywordGrants = continuousKeywordGrantsFromDefinition(definition);
    let review: 'ai' | 'human' | null = null;
    let reviewCaveat: string | null = null;
    let scenariosReview: 'draft' | 'reviewed' = 'draft';
    let interactionsReview: 'draft' | 'reviewed' = 'draft';
    let annotatedNonFactSpans: AnnotatedNonFactSpan[] = [];
    try {
      const progress = JSON.parse(readFileSync(join(process.cwd(), `functional-model/cards/${slug}/progress.json`), 'utf8'));
      review = progress.review === 'human' ? 'human' : 'ai';
      reviewCaveat = typeof progress.reviewCaveat === 'string' && progress.reviewCaveat.trim() ? progress.reviewCaveat : null;
      scenariosReview = progress.scenariosReview === 'reviewed' ? 'reviewed' : 'draft';
      interactionsReview = progress.interactionsReview === 'reviewed' ? 'reviewed' : 'draft';
      annotatedNonFactSpans = Array.isArray(progress.annotatedNonFactSpans) ? progress.annotatedNonFactSpans : [];
    } catch {
      // progress.json is optional — a card can exist without one
    }
    // Live, per-request `cardStatus` (2026-09-16 — see this file's own
    // `FunctionalModelData.cardStatus` doc comment for the motivating bug:
    // the checked-in `data/fin/fin_card_status.json` batch snapshot only
    // refreshes on a manual `npm run card-status`, so a just-confirmed
    // review didn't show as "Verified" here until that script was rerun).
    // Spawned via vite-node, not computed in-process — see
    // `computeCardStatusLive`'s own doc comment for why (a real, confirmed
    // Nitro dev-bundler failure with the in-process approach, not just
    // following `computeTracesLive`'s precedent on principle).
    const cardStatus = await computeCardStatusLive(slug, collectorNumber);
    let reviewSnapshotAt: string | null = null;
    try {
      const verifiedSnapshot = JSON.parse(readFileSync(join(process.cwd(), `functional-model/cards/${slug}/verified-snapshot.json`), 'utf8'));
      reviewSnapshotAt = typeof verifiedSnapshot.capturedAt === 'string' ? verifiedSnapshot.capturedAt : null;
    } catch {
      // verified-snapshot.json is optional — a card can exist without one
      // (never confirmed, or not yet backfilled)
    }
    data = { source, synergy, traces, annotatedCard, review, reviewCaveat, scenariosReview, interactionsReview, reviewSnapshotAt, continuousKeywordGrants, annotatedNonFactSpans, cardStatus };
  } catch {
    data = null;
  }
  functionalModelCache.set(slug, { signature, facesKey, data });
  return data;
}

// data/fin/fin_scryfall.json — real, current Scryfall data for every FIN
// card (also the exact file the main graph visualizer's default browsing
// mode fetches client-side, public/fin -> data/fin symlink — this is NOT a
// stale snapshot, just the free/local fast path for the FIN cards that make
// up most of the functional-model corpus). Resolves a functional-model
// card's own real set/collectorNumber/image for a match thumbnail. A DFC
// (Jecht, Reluctant Guardian // Braska's Final Aeon) has no
// top-level `name` match against its own FRONT face's name (Scryfall's own
// top-level `name` is the full "A // B" string) — falls back to checking
// each `card_faces[].name` for exactly this reason.
interface FinScryfallCard {
  name: string;
  set: string;
  collector_number: string;
  image_uris?: { normal?: string };
  card_faces?: { name: string; image_uris?: { normal?: string } }[];
  // Only present on a live Scryfall response (never on fin_scryfall.json's
  // own stripped-down shape) — read by isStandardPrint() in
  // resolveLiveCardMeta below, so optional rather than a separate type.
  full_art?: boolean;
  promo?: boolean;
  border_color?: string;
  finishes?: string[];
  frame_effects?: string[];
  set_name?: string;
}
function resolveFinCardMeta(name: string): { set: string; collectorNumber: string; image: string | null } | null {
  const entries = loadJsonFresh('data/fin/fin_scryfall.json', [] as FinScryfallCard[]);
  for (const c of entries) {
    if (c.name === name) return { set: c.set, collectorNumber: c.collector_number, image: c.image_uris?.normal ?? c.card_faces?.[0]?.image_uris?.normal ?? null };
    const face = c.card_faces?.find((f) => f.name === name);
    // A true DFC's own faces each carry their own image; an Adventure-layout
    // card's faces (e.g. "Midgar, City of Mako // Reactor Raid") don't —
    // Scryfall renders those as one single card image, at the top level
    // only — so fall back to the card's own `image_uris` rather than null.
    if (face) return { set: c.set, collectorNumber: c.collector_number, image: face.image_uris?.normal ?? c.image_uris?.normal ?? null };
  }
  return null;
}

// data/cards.db — bulk-synced from Scryfall's own bulk-data dump (see
// scripts/sync-card-db.mjs), the same local DB server/api/cards/by-names.ts
// already reads. Covers every card the historical-sets tagging project has
// grown functional-model's own corpus into (317 cards and counting) without
// a single network round-trip. It's gitignored (600MB+, regenerated
// locally, never committed) so it does NOT exist on a deployed instance
// (Netlify Functions ship only what's in the repo) — `cardsDb` is therefore
// null in prod, and every lookup below falls back to a live, paced Scryfall
// call (see scryfallFetch/fetchBySetNumber) instead of throwing. Local dev
// gets the fast no-network path; prod gets the slower but working one.
const CARDS_DB_PATH = join(process.cwd(), 'data', 'cards.db');
const cardsDb = existsSync(CARDS_DB_PATH) ? new DatabaseSync(CARDS_DB_PATH, { readOnly: true }) : null;
const dbBySetNumberStmt = cardsDb?.prepare('SELECT raw_json FROM cards WHERE set_code = ? AND collector_number = ?') ?? null;
const dbByIdStmt = cardsDb?.prepare('SELECT raw_json FROM cards WHERE scryfall_id = ?') ?? null;
const dbExactNameStmt = cardsDb?.prepare('SELECT raw_json FROM cards WHERE name = ? ORDER BY is_normal DESC, released_at DESC LIMIT 1') ?? null;
// A DFC's own top-level `name` is "Front // Back" — a functional-model card
// almost always names just the front face (same fallback
// server/api/cards/by-names.ts's own lookupByName uses, for the same
// reason). ESCAPE so a name containing a literal `%`/`_` isn't misread as a
// wildcard.
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`);
const dbDfcNameStmt = cardsDb?.prepare("SELECT raw_json FROM cards WHERE name LIKE ? ESCAPE '\\' ORDER BY is_normal DESC, released_at DESC LIMIT 1") ?? null;
function dbLookupByName(name: string): FinScryfallCard | null {
  if (!dbExactNameStmt || !dbDfcNameStmt) return null;
  const exact = dbExactNameStmt.get(name) as { raw_json: string } | undefined;
  if (exact) return JSON.parse(exact.raw_json);
  const dfc = dbDfcNameStmt.get(`${escapeLike(name)} // %`) as { raw_json: string } | undefined;
  if (dfc) return JSON.parse(dfc.raw_json);
  return null;
}

// Live fallback for whatever the local DB doesn't have (prod, where the DB
// never exists at all — see cardsDb above), paced through the same
// scryfallFetch every other live call in this route uses. `exact` (not
// fuzzy) — a functional-model card's own `name` is already Scryfall's real
// name, no typo-tolerance needed.
async function resolveLiveCardMeta(name: string): Promise<{ set: string; collectorNumber: string; image: string | null } | null> {
  try {
    const res = await scryfallFetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}`);
    if (!res.ok) return null;
    let c: FinScryfallCard = await res.json();
    // Scryfall's own "default printing" pick for a bare name isn't
    // guaranteed to be is_normal-worthy (showcase/extended-art/promo can win
    // — the same gap the local DB's is_normal column exists to close, see
    // scripts/sync-card-db.mjs). Re-resolve via search when it isn't; only
    // hit for a flagged card, so this stays rare.
    if (!isStandardPrint(c)) {
      const standard = await fetchStandardPrintForName(name);
      if (standard) c = standard;
    }
    return { set: c.set, collectorNumber: c.collector_number, image: c.image_uris?.normal ?? c.card_faces?.[0]?.image_uris?.normal ?? null };
  } catch {
    return null;
  }
}

async function fetchStandardPrintForName(name: string): Promise<FinScryfallCard | null> {
  try {
    const q = `!"${name}" -is:extendedart -is:showcase -is:borderless -is:colorshifted -is:full -is:promo`;
    const res = await scryfallFetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(q)}&unique=cards&order=released&dir=desc`);
    if (!res.ok) return null;
    const data: { data: FinScryfallCard[] } = await res.json();
    return data.data[0] ?? null;
  } catch {
    return null;
  }
}

// Real set/collectorNumber/image for a functional-model card's own name —
// tries FIN's real Scryfall data first (free, already-parsed, current), then
// the local bulk DB (see dbLookupByName above) when it exists, then a live
// Scryfall lookup for whatever neither covers (always the case in prod).
// Interaction-match thumbnail resolution is the actual cost center on this
// route — a popular card (e.g. a staple mana dork) can have 100+ matches,
// each going through resolveFinCardMeta/dbLookupByName/resolveLiveCardMeta
// below; measured at ~6-7ms apiece (mostly node:sqlite's per-call overhead
// on its own admittedly-experimental sync API — see the ExperimentalWarning
// this process logs), which adds up to most of this route's response time
// on a heavily-interacting card. A name's real set/collectorNumber/image
// barely ever changes minute-to-minute (only a data/cards.db re-sync or a
// fin_scryfall.json edit would change it, neither of which happens while
// this server process is running), so this is cached forever per process
// rather than folder-mtime-invalidated like loadFunctionalModel above — the
// same "open once per process, no live invalidation" contract this route's
// own cardsDb/DECK_ACTIVE_KEY-adjacent DB connections already have. Restart
// the dev server after a re-sync to see fresh data, same as those.
const cardMetaCache = new Map<string, { set: string; collectorNumber: string; image: string | null } | null>();
async function resolveFunctionalModelCardMeta(name: string): Promise<{ set: string; collectorNumber: string; image: string | null } | null> {
  const cached = cardMetaCache.get(name);
  if (cached !== undefined) return cached;

  const fin = resolveFinCardMeta(name);
  if (fin) {
    cardMetaCache.set(name, fin);
    return fin;
  }
  const c = dbLookupByName(name);
  if (c) {
    const resolved = { set: c.set, collectorNumber: c.collector_number, image: c.image_uris?.normal ?? c.card_faces?.[0]?.image_uris?.normal ?? null };
    cardMetaCache.set(name, resolved);
    return resolved;
  }
  const live = await resolveLiveCardMeta(name);
  cardMetaCache.set(name, live);
  return live;
}

// InteractionGroup/InteractionMatch (functional-model/synergy.ts v2) carry
// no thumbnail metadata — matches are identified by card name only (`card`,
// renamed from the v1 shape's `name`). Enrich a copy here rather than
// mutating the matcher's own output, since InteractionMatch has no
// set/collectorNumber/image fields to mutate onto.
export interface EnrichedInteractionMatch {
  card: string;
  selfInteraction?: InteractionGroup['matches'][number]['selfInteraction'];
  set?: string;
  collectorNumber?: string;
  image: string | null;
}
export interface EnrichedInteractionGroup extends Omit<InteractionGroup, 'matches'> {
  matches: EnrichedInteractionMatch[];
}
// `filterNames`, when given (the active global filter — deck import OR
// Scryfall query, see useGraphStore.ts's `getActiveFilterMode()`), scopes
// matches down to just those cards instead of the whole functional-model
// corpus — the deckbuilding question is "what does this card actually
// synergize with IN MY DECK/POOL," not against every card this app happens
// to have modeled. `cardName` itself is always resolved against the FULL
// pool first (its own source/sink facts don't depend on whether it's in the
// filter — you're often checking a candidate card you don't own yet against
// a deck you do), and a self-interaction match (the same card against
// itself) always passes through regardless — a name list alone doesn't
// track quantities, so there's no way to know if a second copy is actually
// in the 60/100, and dropping self-interactions outright would just be
// wrong for cards that ARE genuinely in the deck.
// `findInteractionsForCard`'s own `matches` are per SATISFIED FACT PAIR, not
// per related card — the same `other` card can show up more than once
// within one group when it has multiple facts on its opposite side that
// each independently satisfy `mine` (e.g. Delivery Moogle's single "enters
// the battlefield" source fact against Clash of the Eikons, which carries
// BOTH a Creature-gated Battlefield-presence sink fact AND a separate
// unconstrained one — both individually satisfied by the same ETB, two
// `InteractionMatch`es, same `card` string). That per-fact granularity is
// real and wanted for `server/api/graph-links.ts` (keys off `theirFactId` to
// normalize per sink fact) — collapsing it in `synergy.ts` itself would
// break that consumer. This panel instead wants one gallery entry per
// related card, so collapse only here — keeping the FIRST-encountered
// duplicate (2026-09-14: used to keep the highest `theirTotal`, an arbitrary
// tiebreak once `InteractionMatch.theirTotal`/`Fact.value` were removed from
// the schema entirely — see `.claude/contracts/card-schema.md`'s own dated
// entry; `theirTotal` was never part of the served payload either way, so
// nothing client-visible changes here). `selfInteraction` is derived from
// `mine`/`mineCard` alone (never `theirs`), so it's identical across
// duplicates and never lost by this collapse.
function dedupMatchesByCard(matches: InteractionGroup['matches']): InteractionGroup['matches'] {
  const byCard = new Map<string, InteractionGroup['matches'][number]>();
  for (const m of matches) {
    if (!byCard.has(m.card)) byCard.set(m.card, m);
  }
  return [...byCard.values()];
}
async function loadInteractionGroups(cardName: string, filterNames?: Set<string>): Promise<EnrichedInteractionGroup[]> {
  const pool = await loadFunctionalModelPool();
  if (!pool.some((c) => c.name === cardName)) return [];
  const groups = findInteractionsForCard(cardName, pool);
  const enriched = await Promise.all(
    groups.map(async (group) => {
      const filtered = group.matches.filter((m) => !filterNames || m.selfInteraction || filterNames.has(m.card));
      const deduped = dedupMatchesByCard(filtered);
      const matches = await Promise.all(
        deduped.map(async (m): Promise<EnrichedInteractionMatch> => {
          const ref = await resolveFunctionalModelCardMeta(m.card);
          return { card: m.card, selfInteraction: m.selfInteraction, set: ref?.set, collectorNumber: ref?.collectorNumber, image: ref?.image ?? null };
        }),
      );
      return { ...group, matches };
    }),
  );
  return enriched.filter((group) => group.matches.length > 0);
}

const curatedThemes = themesData as ThemeData[];
const curatedThemeIds = new Set(curatedThemes.map((t) => t.id));

// Scryfall's own guideline: stay under 10 requests/second or risk a network
// block (confirmed the hard way mid-session — a burst of interaction-match
// image lookups across a 274-card pool tripped a real 429 with a 60s
// lockout). Only actually exercised in prod, where cardsDb is null — local
// dev's DB path never calls this. Paces request STARTS at least 110ms apart
// (~9/s) regardless of how many are queued.
let lastScryfallStart = 0;
const SCRYFALL_MIN_INTERVAL_MS = 110;
async function scryfallFetch(url: string): Promise<Response> {
  const now = Date.now();
  const scheduled = Math.max(now, lastScryfallStart + SCRYFALL_MIN_INTERVAL_MS);
  lastScryfallStart = scheduled;
  const wait = scheduled - now;
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  return fetch(url, { headers: { 'User-Agent': 'mtg-visualizer/0.1', Accept: 'application/json' } });
}

type FullCard = ScryfallCard & { all_parts?: { id: string; component: string }[]; set?: string; collector_number?: string };

// Local DB first (dev — fast, no network), live Scryfall when it's missing
// (prod — see cardsDb above). A genuinely missing set/number (sync stale, or
// a real typo) surfaces as a plain 404 either way.
async function lookupCardBySetNumber(set: string, number: string): Promise<FullCard | null> {
  if (dbBySetNumberStmt) {
    const row = dbBySetNumberStmt.get(set, number) as { raw_json: string } | undefined;
    if (row) return JSON.parse(row.raw_json);
  }
  const res = await scryfallFetch(`https://api.scryfall.com/cards/${encodeURIComponent(set)}/${encodeURIComponent(number)}`);
  if (!res.ok) return null;
  return res.json();
}
async function lookupCardById(id: string): Promise<{ name: string; image_uris?: { normal?: string } } | null> {
  if (dbByIdStmt) {
    const row = dbByIdStmt.get(id) as { raw_json: string } | undefined;
    if (row) return JSON.parse(row.raw_json);
  }
  const res = await scryfallFetch(`https://api.scryfall.com/cards/${encodeURIComponent(id)}`);
  if (!res.ok) return null;
  return res.json();
}

export default defineEventHandler(async (event) => {
  const set = getRouterParam(event, 'set');
  const number = getRouterParam(event, 'number');
  if (!set || !number) {
    setResponseStatus(event, 400);
    return { error: 'missing set or number' };
  }

  // Optional POST body — see this file's own header comment. A GET request
  // (no filter active) has no body to read; readBody rejects on that,
  // caught the same defensive way loadJsonFresh's own reads are above.
  const body = await readBody(event).catch(() => null);
  const rawFilterNames = body?.filterNames;
  const filterNames = Array.isArray(rawFilterNames) && rawFilterNames.length > 0 ? new Set<string>(rawFilterNames) : undefined;

  const card = await lookupCardBySetNumber(set, number);
  if (!card) {
    setResponseStatus(event, 404);
    return { error: 'card not found' };
  }

  // Prev/next is computed client-side (±1 on the URL's :number) — see the
  // card page — so this route doesn't hold up the response validating
  // neighbors that exist Scryfall-side against the corpus.

  // Token art: keyed by scryfall id (all_parts' own `id`) — a card has at
  // most a couple of `all_parts` token entries, so falling back to a live
  // lookup per id (prod) is still cheap.
  const tokenIds = [...new Set((card.all_parts || []).filter((p) => p.component === 'token').map((p) => p.id))];
  const tokensById: TokensById = {};
  await Promise.all(
    tokenIds.map(async (tid) => {
      const t = await lookupCardById(tid);
      if (t) tokensById[tid] = { name: t.name, image: t.image_uris?.normal ?? null };
    }),
  );

  const cardData: CardData = {
    id: card.id,
    name: card.name,
    cmc: card.cmc ?? 0,
    manaCost: card.mana_cost ?? card.card_faces?.[0]?.mana_cost ?? null,
    colors: card.colors || (card.card_faces ? card.card_faces.flatMap((f) => f.colors || []) : []),
    colorIdentity: card.color_identity || [],
    typeLine: card.type_line || '',
    rarity: card.rarity || 'common',
    images: cardImages(card),
    artCrop: cardArtCrop(card),
    tokens: cardTokens(card, tokensById),
    scryfallUri: card.scryfall_uri,
    // Front-face-only keywords — NOT Scryfall's raw `card.keywords` (which
    // for a transform DFC is already the union of both faces' keywords, e.g.
    // FIN's Crystal Fragments // Summon: Alexander: front has no Flying,
    // only the back Summon: Alexander face does). `backKeywords` mirrors
    // `backPower`/`backToughness` just below — undefined for a card with no
    // second face at all, same convention.
    keywords: cardFaceKeywords(card, 0).filter((k) => BADGE_KEYWORDS.has(k)),
    backKeywords: card.card_faces?.[1] ? cardFaceKeywords(card, 1).filter((k) => BADGE_KEYWORDS.has(k)) : undefined,
    set: card.set || set,
    collectorNumber: card.collector_number || number,
    power: card.power ?? card.card_faces?.[0]?.power,
    toughness: card.toughness ?? card.card_faces?.[0]?.toughness,
    backPower: card.card_faces?.[1]?.power,
    backToughness: card.card_faces?.[1]?.toughness,
  };

  // Auto-generated creature-type themes (Human, Goblin, ...) — same rule as
  // buildGraph.ts, just scoped to this one card instead of a whole corpus.
  const typeThemeLabel = new Map<string, string>();
  for (const word of creatureSubtypes(card)) {
    const slug = slugify(word);
    if (!slug || curatedThemeIds.has(slug)) continue;
    if (!typeThemeLabel.has(slug)) typeThemeLabel.set(slug, word);
  }
  const themeIds = new Set([...curatedThemeIds, ...typeThemeLabel.keys()]);

  const entry = relationsByName.get(card.name);
  const edges: EdgeData[] = [];
  if (!entry) {
    edges.push({ card: card.id, theme: 'not-processed', role: 'atypical', weight: 1 });
  } else {
    for (const [role, byTheme] of Object.entries(entry.themes ?? {})) {
      for (const [theme, weight] of Object.entries(byTheme ?? {})) {
        if (theme !== 'not-processed' && !themeIds.has(theme)) continue;
        edges.push({ card: card.id, theme, role: role as Role, weight });
      }
    }
  }

  const usedThemeIds = new Set(edges.map((e) => e.theme));
  const themes: ThemeData[] = [
    ...curatedThemes.filter((t) => usedThemeIds.has(t.id)),
    ...[...typeThemeLabel.entries()].filter(([id]) => usedThemeIds.has(id)).map(([id, label]) => ({ id, label })),
    ...(usedThemeIds.has('not-processed') ? [{ id: 'not-processed', label: 'Not Processed' }] : []),
  ];

  // Scryfall's own two-part DFC layout (scryfall.com/card/<set>/<number> —
  // the user's own reference): each face is a FULL, independent card block —
  // its own name/mana cost, type line, color indicator (a back face with no
  // mana cost of its own prints one instead — real Scryfall convention,
  // Shiva, Warden of Ice's own real card the reference case), oracle text,
  // and P/T. Real structured data (`FaceInput[]`), not a formatted string —
  // per the user's own framing ("parse everything into json... decide on
  // frontend how to format"), each face's `oracleText` rides through raw
  // and untouched; all the "how does a whole card's worth of faces stack
  // together" shaping — including building fact-linked spans off each
  // fact's own baked `Fact.annotations` — lives client-side now
  // (FunctionalModelText.vue), not baked in here.
  const faces: FaceInput[] = (card.card_faces?.length ? card.card_faces : [card]).map((f) => ({
    name: f.name ?? card.name,
    manaCost: f.mana_cost ?? '',
    typeLine: f.type_line ?? '',
    oracleText: f.oracle_text ?? '',
    power: f.power,
    toughness: f.toughness,
    colorIndicator: !f.mana_cost && f.color_indicator?.length ? f.color_indicator : undefined,
  }));

  return {
    card: cardData,
    edges,
    themes,
    functionalModel: await loadFunctionalModel(card.name, card.collector_number || number, faces),
    interactions: await loadInteractionGroups(card.name, filterNames),
  };
});
