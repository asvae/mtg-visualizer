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

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { cardArtCrop, cardFaceKeywords, cardImages, cardTokens, creatureSubtypes, slugify, BADGE_KEYWORDS } from '../../../../app/lib/buildGraph';
import type { ScryfallCard, RelationsEntry, TokensById } from '../../../../app/lib/buildGraph';
import type { CardData, EdgeData, Role, ThemeData } from '../../../../app/types';
import { findInteractionsForCard } from '../../../../functional-model/synergy';
import type { InteractionGroup, Fact } from '../../../../functional-model/synergy';
import type { AnnotatedCard } from '../../../../app/types';
import type { Scenario, TraceResult } from '../../../../functional-model/harness';
import type { CardDefinition } from '../../../../functional-model/card';
import { loadCardSynergy, loadFunctionalModelPool } from '../../../utils/functionalModelPool';
import { loadForgeJsonMapperOutput } from '../../../utils/forgeJsonMapper';
import { fmBundle } from '../../../utils/fmBundle';
import { cardsDb, resolveFunctionalModelCardMeta } from '../../../utils/cardMeta';
import { scryfallFetch } from '../../../utils/scryfallFetch';
import type { CardStatusEntry } from '../../../../functional-model/card-status';
import { readPipelineStatus, effectivePipelineStatus } from '../../../../functional-model/pipeline-status';
import type { PipelineStatusFile } from '../../../../functional-model/pipeline-status';
import { computeCardInteractions } from '../../../../functional-model/card-interactions';
import type { CardInteractionCategory } from '../../../../functional-model/card-interactions';
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
  // **`fdn`-only, 2026-09-18** — `functional-model/fdn-cards/<slug>/
  // pipeline-status.json`'s own real authoring-PIPELINE-STAGE entry
  // (`functional-model/pipeline-status.ts`, see `.claude/contracts/
  // card-schema.md`'s "FDN authoring-pipeline status" section) — a
  // GENUINELY DIFFERENT axis from every field above (those are all real for
  // a `fin` entry, meaningless for `fdn` since an FDN card has no Facts/
  // synergy.json/scenarios at all by design; this field is the reverse:
  // real for `fdn`, always `null` for `fin`). `status` here is already
  // resolved through the drift-aware `effectivePipelineStatus` (a stored
  // `green` entry whose `definition.ts` has since changed is served with
  // `status: 're-review'`, not the possibly-stale raw `green` on disk) —
  // every other field (`reasons`/`reviewNote`/`reviewedAt`/...) is passed
  // through verbatim from the raw stored file. `null` when there's no
  // `functional-model/fdn-cards/<slug>/` folder/pipeline-status.json at all
  // yet (the common case — most of FDN's real 271-card pool hasn't entered
  // the pipeline), or trivially for any `fin` entry.
  pipelineStatus: PipelineStatusFile | null;
  // **`fdn`-only** — the `functional-model/fdn-cards/<slug>/` folder name,
  // so `CardDetailTabs.vue`'s own Confirm/Reject UI can `POST
  // /api/fdn-cards/:slug/review` without re-deriving the slugify
  // convention client-side (same precedent `CardStatusPageEntry.slug`
  // already set for the Cards-tab list route). `null` for a `fin` entry
  // (identity there is `number`, already a real route param) or an `fdn`
  // entry with no folder at all yet (nothing to review).
  slug: string | null;
  // **`fdn`-only, 2026-09-18** — the card's own REAL, printed Scryfall
  // `oracle_text`, one per face joined with a blank line between faces
  // (real `\n`s within a face untouched, same raw convention `FaceInput.
  // oracleText`/`AnnotatedCard` already use) — plain, unannotated text, no
  // fact/highlight spans at all (an FDN card has no synergy.json to anchor
  // any). Always `null` for a `fin` entry: FIN already has its own richer
  // `annotatedCard` path (real oracle text PLUS fact-linked highlight
  // spans) — this field exists only because FDN structurally never gets
  // that (no synergy.json by design, same reason `synergy`/`annotatedCard`
  // are always null for `fdn`), so `CardDetailTabs.vue` needs a genuinely
  // separate, un-annotated plain-text display for it (see
  // `PlainOracleText.vue`, `card`-owned) instead of retrofitting
  // `FunctionalModelText.vue`, which hard-depends on `annotatedCard`/
  // `Fact.annotations`. `null` when every face's own real `oracle_text` is
  // empty (e.g. a vanilla creature with no rules text at all) — same "no
  // real text to show" empty state a `fin` card's own oracle-text-less
  // face already degrades to under `FunctionalModelText.vue`.
  oracleText: string | null;
  // **`fdn`-only, 2026-09-18, later still** — this card's own real
  // interaction categories against the current FDN pool of
  // `CardDefinition`s (`functional-model/card-interactions.ts`'s own
  // `computeCardInteractions` — catalog-first, self-inclusive, pool-scoped
  // not deck-scoped; see `.claude/contracts/card-schema.md`'s own dated
  // "computeCardInteractions" + "Sink CATALOG..." sections). Always `[]`
  // for a `fin` entry — that set still uses the top-level `interactions`
  // field this route also serves (the older paired source+sink Fact
  // model's own cross-card join, `loadInteractionGroups` below), a
  // genuinely different mechanism FDN structurally has nothing to run
  // against (no synergy.json at all).
  //
  // **Enriched server-side, 2026-09-18, later still** — `computeCardInteractions`
  // itself stays pure (`CardInteractionCategory.matchingCardNames: string[]`,
  // plain names, no fs/db reads — see that function's own doc comment/the
  // contract file), same as `loadInteractionGroups`/`EnrichedInteractionGroup`
  // below already does for the FIN panel: this route joins each matched name
  // against real Scryfall data via the SAME `resolveFunctionalModelCardMeta`
  // that join already uses (no second FDN-pool-query convention invented —
  // an FDN card is a real printed card, already covered by that function's
  // `dbLookupByName`/`resolveLiveCardMeta` legs against `data/cards.db`,
  // which is synced across every set, not just `fin`) — see
  // `EnrichedCardInteractionCategory` below.
  cardInteractions: EnrichedCardInteractionCategory[];
  // **`fdn`-only, 2026-09-19** — this card's own `functional-model/
  // fdn-cards/<slug>/NOTES.md` raw content, when one exists — the
  // established convention (as of this session) for where an FDN card's
  // authoring-history/reasoning prose lives (a `definition.ts` stays
  // readable for a human reviewer; the "why"/param-audit/agent-
  // communication content goes here instead — see
  // `functional-model/fdn-cards/exemplar-of-light/NOTES.md` for a real,
  // current example). A normal, git-tracked, checked-in project file — NOT
  // the dev-only/gitignored-checkout `forgeScriptResult` pattern
  // (`GET /api/forge-script`) this otherwise superficially resembles, so
  // there's no NODE_ENV/dev-only gate on this field itself (though it's
  // still only ever populated by `loadFdnFunctionalModel`, which IS
  // dev-only for unrelated reasons — see that function's own header — so in
  // practice this is dev-only anyway today, same as every other `fdn`-only
  // field here). `null` when the file doesn't exist — the common case: most
  // FDN cards that have entered the pipeline don't have one yet, and this
  // is always `null` for a `fin` entry (that set has no NOTES.md
  // convention at all). Absence is expected and unremarkable, not an
  // error — same "untracked = nothing to show" posture every other
  // optional per-card file on this route already takes
  // (progress.json/verified-snapshot.json/pipeline-status.json).
  notes: string | null;
  // **`fdn`-only in practice, 2026-09-19** — pretty-printed JSON from the
  // separate `functional-model/scripts/experiments/forge-json-mapper/`
  // experiment's own output (see `loadForgeJsonMapperOutput`'s own doc
  // comment for the full "what this is" writeup), when a matching
  // `<slug>.json` exists for this card. That experiment covers exactly 20
  // real cards today (FDN collector numbers 1-20), so this is `null` for
  // every `fin` card and every `fdn` card outside that set — expected,
  // unremarkable absence, same posture `notes` above already takes. Unlike
  // `notes`/`pipelineStatus`/`cardInteractions` above, this ISN'T
  // structurally fdn-only (the lookup itself is name-keyed, not gated on
  // `isFdn` anywhere) — it's just that the experiment has only ever run
  // against fdn cards so far; a future run against fin cards would populate
  // this on that branch too, with no code change needed here.
  forgeJsonMapper: string | null;
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
      // `fin`-only fields never populate these three `fdn`-only fields — see
      // `FunctionalModelData.pipelineStatus`/`.slug`/`.oracleText`'s own doc
      // comments.
      pipelineStatus: null,
      slug: null,
      oracleText: null,
      // `fin`-only fields never populate this `fdn`-only field either — see
      // `FunctionalModelData.cardInteractions`'s own doc comment.
      cardInteractions: [],
      // `fin`-only fields never populate this `fdn`-only field either — see
      // `FunctionalModelData.notes`'s own doc comment (no NOTES.md
      // convention exists for `fin` cards at all).
      notes: null,
      // Name-keyed, not fdn-gated (see `FunctionalModelData.forgeJsonMapper`'s
      // own doc comment) — cheap enough to call unconditionally even on this
      // production/bundled path.
      forgeJsonMapper: loadForgeJsonMapperOutput(name),
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
    // `fin`-only branch — never populates the three `fdn`-only fields, see
    // `FunctionalModelData.pipelineStatus`/`.slug`/`.oracleText`'s own doc
    // comments.
    data = {
      source,
      synergy,
      traces,
      annotatedCard,
      review,
      reviewCaveat,
      scenariosReview,
      interactionsReview,
      reviewSnapshotAt,
      continuousKeywordGrants,
      annotatedNonFactSpans,
      cardStatus,
      pipelineStatus: null,
      slug: null,
      oracleText: null,
      cardInteractions: [],
      notes: null,
      forgeJsonMapper: loadForgeJsonMapperOutput(name),
    };
  } catch {
    data = null;
  }
  functionalModelCache.set(slug, { signature, facesKey, data });
  return data;
}

// **`fdn` branch — a genuinely different computation, not a generalization
// of `loadFunctionalModel` above** (same "two real branches, not a fake
// generalization" pattern `server/api/card-status/[set].get.ts`'s own
// header already establishes for this exact set split). An FDN card has no
// Facts/synergy.json/scenarios.ts/progress.json at all by design (the
// sink-only-synergy-model experiment's whole point) — the only real content
// to serve is its own `definition.ts` source (same
// FunctionalModelScript/FunctionalModelText-renderable text FIN cards serve
// via `source`, just pointed at `functional-model/fdn-cards/<slug>/`
// instead of `functional-model/cards/<slug>/`) plus its authoring-PIPELINE
// status (`functional-model/pipeline-status.ts`). No caching layer like
// `functionalModelCache` above — this axis has nowhere near FIN's traces/
// annotatedCard/cardStatus computation cost (a single `readFileSync` +
// two small pure JSON-file reads), so recomputing fresh on every request is
// cheap enough not to bother.
//
// Dev-only, no production branch at all — same reasoning
// `server/api/card-status/[set].get.ts`'s own header documents for why the
// WHOLE `fdn` pipeline-status axis is dev-only (`functional-model/
// fdn-cards/` isn't shipped in a Netlify Function bundle any more than
// `functional-model/cards/` is — there is no `fmBundle`-equivalent
// precomputed snapshot for this axis, and building one is real, separate,
// not-yet-started scope). Returns `null` in production, same "degrades to
// no functional-model section rendered at all" behavior a `fin` card with
// no functional-model directory already gets.
// Every real `functional-model/fdn-cards/<slug>/definition.ts` currently on
// disk, loaded as a plain `CardDefinition[]` — the "current scope" pool
// `computeCardInteractions` (`functional-model/card-interactions.ts`) needs
// to check a card's own derived categories against.
//
// **Spawns `functional-model/scripts/list-fdn-definitions.mjs` under
// vite-node, not a plain in-process `import()`** — tried the latter first
// (mirroring `loadCardDefinitionDev`'s own per-slug dynamic-import
// convention just above, pointed at `fdn-cards/` instead), and it silently
// dropped `day-of-judgment` from the pool: that card's own `definition.ts`
// is the only one so far with a real VALUE-level (non-type-only) relative
// import (`import { anyPlayer, destroyEach } from '../../combinator'` —
// every other current fdn-cards file only imports `CardDefinition`/`Effect`
// as TYPES, which get erased entirely, so this gap was invisible until a
// card needing a real value import existed), which fails to resolve its
// missing extension under plain Node ESM resolution the exact same way
// `loadFunctionalModelPool`'s own header already documents for FIN's
// `'../../tokens'` case — confirmed directly (a standalone `node -e`
// reproduction throws `Cannot find module '.../combinator'`). `vite-node`'s
// own resolver tolerates this (same reason `validate-card-definition.mjs`'s
// own dynamic import has to run under vite-node too, per that script's own
// header) — spawning it here, same "recompute fresh per request, dev-only"
// posture `computeTracesLive`/`computeCardStatusLive` already establish for
// this exact class of problem, is what actually gets Day of Judgment's own
// real `program` effect (confirmed a plain, JSON-serializable combinator-DSL
// data tree, no functions) into the pool. Cached per process with a cheap
// stat-based signature (slug list + each definition.ts's own mtime), since
// only ~10 real folders exist today and none of this survives a production
// bundle anyway (this whole axis already is dev-only, see this function's
// own caller below).
let fdnDefinitionPoolCache: { signature: string; pool: CardDefinition[] } | null = null;
async function loadFdnDefinitionPool(root: string): Promise<CardDefinition[]> {
  const dir = join(root, 'functional-model', 'fdn-cards');
  let slugs: string[];
  try {
    slugs = readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
  const signature = slugs
    .map((s) => {
      try {
        return `${s}:${statSync(join(dir, s, 'definition.ts')).mtimeMs}`;
      } catch {
        return `${s}:x`;
      }
    })
    .join('|');
  if (fdnDefinitionPoolCache && fdnDefinitionPoolCache.signature === signature) return fdnDefinitionPoolCache.pool;

  let pool: CardDefinition[] = [];
  try {
    const { stdout } = await execFileAsync(join(root, 'node_modules/.bin/vite-node'), [
      join(root, 'functional-model/scripts/list-fdn-definitions.mjs'),
    ]);
    pool = JSON.parse(stdout);
  } catch {
    // Whole-pool failure (vite-node itself missing, etc.) degrades to an
    // empty pool rather than a route-wide 500 — same "nothing real to
    // compute against" fallback every other FDN axis already has.
  }
  fdnDefinitionPoolCache = { signature, pool };
  return pool;
}

async function loadFdnFunctionalModel(name: string, faces: FaceInput[]): Promise<FunctionalModelData | null> {
  if (process.env.NODE_ENV === 'production') return null;
  const slug = slugify(name);
  const root = process.cwd();
  let source: string;
  try {
    source = readFileSync(join(root, 'functional-model', 'fdn-cards', slug, 'definition.ts'), 'utf8');
  } catch {
    // No functional-model/fdn-cards/<slug>/definition.ts at all — the
    // common case (most of FDN's real 271-card pool hasn't entered the
    // authoring pipeline yet). Nothing real to serve; `null` degrades to
    // "no functional-model section at all," same as a `fin` card with no
    // functional-model directory.
    return null;
  }
  // `effectivePipelineStatus` (drift-aware: a stored `green` entry whose
  // `definition.ts` has since changed reads as `re-review`, not a possibly-
  // stale `green`) decides the SERVED `status`; every other field
  // (`reasons`/`reviewNote`/`reviewedAt`/...) is carried straight through
  // from the raw stored file — see `FunctionalModelData.pipelineStatus`'s
  // own doc comment. `raw` can be `undefined` even though `definition.ts`
  // exists (a folder created but pipeline-status.json not yet written) —
  // served as `pipelineStatus: null` (this axis's own "not started" state,
  // same as the folder not existing at all).
  const raw = readPipelineStatus(slug, root);
  const effective = raw ? effectivePipelineStatus(slug, root) : undefined;
  const pipelineStatus: PipelineStatusFile | null = raw ? { ...raw, status: effective ?? raw.status } : null;
  // Real, printed Scryfall oracle text — `faces` is already this exact
  // request's own real card data (see the main handler below: `card` came
  // from `lookupCardBySetNumber(set, number)`, the same `data/cards.db`/
  // live-Scryfall lookup `computeFdnCardStatusPage` uses, just resolved by
  // exact set+number rather than by name), so no second DB query is
  // needed here — just join each face's own real `oracleText`, skipping any
  // face with no rules text at all (a vanilla creature). One face's worth
  // of real `\n`s stays untouched; a blank line separates multiple faces
  // (see `FunctionalModelData.oracleText`'s own doc comment).
  const oracleText = faces.map((f) => f.oracleText).filter((t) => t.trim().length > 0).join('\n\n') || null;
  // Real, catalog-first, self-inclusive interaction categories against the
  // current FDN pool — see `FunctionalModelData.cardInteractions`'s own
  // doc comment. `pool` already includes this card's own definition (the
  // pool loader above reads every real fdn-cards/ folder, no self-
  // exclusion), so a straight `.find` by name (the app's own card-identity
  // key, not `oracle_id`) resolves it rather than a second, separate
  // dynamic import of the same file. `[]` when this card hasn't actually
  // entered the pipeline yet (no definition.ts at all — shouldn't happen
  // here, `source` above already required one to exist, but stays
  // defensive rather than assuming `.find` always succeeds).
  const pool = await loadFdnDefinitionPool(root);
  const definition = pool.find((d) => d.name === name);
  const rawCardInteractions = definition ? computeCardInteractions(definition, pool, root) : [];
  const cardInteractions = await enrichCardInteractions(rawCardInteractions, name);
  // See `FunctionalModelData.notes`'s own doc comment — a normal, optional,
  // git-tracked file, `null` when absent (most of the pool today).
  let notes: string | null = null;
  try {
    notes = readFileSync(join(root, 'functional-model', 'fdn-cards', slug, 'NOTES.md'), 'utf8');
  } catch {
    // No NOTES.md for this card yet — the common case.
  }
  return {
    source,
    synergy: null,
    traces: [],
    annotatedCard: null,
    review: null,
    reviewCaveat: null,
    scenariosReview: 'draft',
    interactionsReview: 'draft',
    reviewSnapshotAt: null,
    continuousKeywordGrants: null,
    annotatedNonFactSpans: [],
    cardStatus: null,
    pipelineStatus,
    slug,
    oracleText,
    cardInteractions,
    notes,
    forgeJsonMapper: loadForgeJsonMapperOutput(name),
  };
}

// data/cards.db — bulk-synced from Scryfall's own bulk-data dump (see
// scripts/sync-card-db.mjs), the same local DB server/api/cards/by-names.ts
// already reads. Covers every card the historical-sets tagging project has
// grown functional-model's own corpus into (317 cards and counting) without
// a single network round-trip. Opened once by `server/utils/cardMeta.ts`
// (also read there for `resolveFunctionalModelCardMeta`'s own by-name
// lookup leg) and reused here for this route's own, unrelated
// set/number and scryfall-id lookups, rather than opening a second handle
// onto the same file — `null` in prod (gitignored, 600MB+, regenerated
// locally, never committed — Netlify Functions ship only what's in the
// repo), where every lookup below falls back to a live, paced Scryfall call
// (see scryfallFetch/fetchBySetNumber) instead of throwing.
const dbBySetNumberStmt = cardsDb?.prepare('SELECT raw_json FROM cards WHERE set_code = ? AND collector_number = ?') ?? null;
const dbByIdStmt = cardsDb?.prepare('SELECT raw_json FROM cards WHERE scryfall_id = ?') ?? null;

// `resolveFunctionalModelCardMeta` — a functional-model card's own real
// set/collectorNumber/image for a match thumbnail — now lives in
// `server/utils/cardMeta.ts` (extracted 2026-09-18 so
// `server/api/sink-catalog/index.get.ts`'s own "real FDN pool matches"
// enrichment reuses the exact same resolution/cache/429-avoidance
// machinery instead of a second, driftable copy). Imported above.

// `computeCardInteractions` (`functional-model/card-interactions.ts`) is a
// pure function over `CardDefinition[]` — its own `CardInteractionCategory.
// matchingCardNames` is plain `string[]`, no fs/db reads, by explicit design
// (see that function's own doc comment). Real thumbnail metadata is a
// route-level concern layered on here, reusing `resolveFunctionalModelCardMeta`
// AS-IS rather than inventing a second FDN-pool-query convention: an FDN
// card is a real, currently-printed Scryfall card (`data/cards.db` is synced
// across every set, not just `fin`, same as `server/api/card-status/
// [set].get.ts`'s own `set_code = 'fdn'` query on that same DB), so that
// function's existing `dbLookupByName`/`resolveLiveCardMeta` fallback legs
// already cover it correctly — only its first leg (`resolveFinCardMeta`,
// FIN-only `fin_scryfall.json`) can never match an FDN-only name, which is
// fine, it's just one more ordinary miss that falls through to the next leg.
export interface EnrichedCardInteractionMatch {
  card: string;
  /** True only for the served card's own name — lets the UI outline its own
   * thumbnail. No richer per-match label the way `EnrichedInteractionMatch.
   * selfInteraction` carries (that one distinguishes WHICH of a card's own
   * facts self-satisfied); this mechanism has exactly one reason a match can
   * be "self" (name equality against the card being viewed), so a plain
   * boolean is honest, not a stand-in for missing detail. */
  self?: boolean;
  set?: string;
  collectorNumber?: string;
  image: string | null;
}
export interface EnrichedCardInteractionCategory extends Omit<CardInteractionCategory, 'matchingCardNames'> {
  matches: EnrichedCardInteractionMatch[];
}
async function enrichCardInteractions(categories: CardInteractionCategory[], selfName: string): Promise<EnrichedCardInteractionCategory[]> {
  return Promise.all(
    categories.map(async (cat) => {
      const matches = await Promise.all(
        cat.matchingCardNames.map(async (name): Promise<EnrichedCardInteractionMatch> => {
          const ref = await resolveFunctionalModelCardMeta(name);
          return { card: name, self: name === selfName || undefined, set: ref?.set, collectorNumber: ref?.collectorNumber, image: ref?.image ?? null };
        }),
      );
      return { category: cat.category, count: cat.count, matches };
    }),
  );
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

// `scryfallFetch` (Scryfall's own guideline: stay under 10 requests/second
// or risk a network block — confirmed the hard way, a burst of
// interaction-match image lookups across a 274-card pool once tripped a
// real 429 with a 60s lockout) now lives in `server/utils/scryfallFetch.ts`
// (extracted 2026-09-18), shared with `server/utils/cardMeta.ts`'s own live
// lookup leg so both draw down the SAME per-process pacer. Only actually
// exercised in prod, where cardsDb is null — local dev's DB path never
// calls this.

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

  // `fin` and `fdn` load GENUINELY DIFFERENT functional-model shapes — see
  // `loadFdnFunctionalModel`'s own header for why this is a real branch,
  // not a generalized rule. `set` (the route param) decides which, not the
  // resolved `card.set` — a card's own Scryfall `set` can differ from the
  // route's `:set` for a reprint looked up via `dbLookupByName`'s DFC
  // fallback, but the route's OWN identity (what folder this request is
  // "about") is always the `:set` it was requested under.
  const functionalModel = set === 'fdn' ? await loadFdnFunctionalModel(card.name, faces) : await loadFunctionalModel(card.name, card.collector_number || number, faces);

  return {
    card: cardData,
    edges,
    themes,
    functionalModel,
    interactions: await loadInteractionGroups(card.name, filterNames),
  };
});
