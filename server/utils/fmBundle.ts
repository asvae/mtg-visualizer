// Production data source for functional-model/cards/<slug>/'s generated
// artifacts (synergy.json/trace.json/progress.json) plus the handful of
// real CardDefinition fields (name/manaCost/typeLine/cmc/pt) the cross-card
// matcher needs — see scripts/build-fm-bundle.mjs's own header for why this
// exists and how it's built. A plain STATIC JSON import (same pattern
// server/api/card/[set]/[number].ts already uses for data/global_relations.json
// et al.) so Nitro/Rollup traces and bundles it into the Netlify Function at
// build time — unlike a readFileSync/readdirSync/dynamic-import() against
// the raw functional-model/ source tree, which never survives that bundle
// (confirmed in prod as ENOENT scandir '/var/task/functional-model').
//
// Consumed by both server/api/card/[set]/[number].ts (per-card
// FunctionalModelData, production branch of loadFunctionalModel) and
// server/utils/functionalModelPool.ts (whole-pool PoolCard[], production
// branch of loadFunctionalModelPool) — the exact same two request-time
// readers this bundle exists to unblock in prod. Dev keeps reading the raw
// source tree live (definition.ts/scenarios.ts/synergy.json edits show up
// immediately, no `npm run sync:fm-bundle` step needed) — this bundle is
// only ever read when NODE_ENV==='production'.
//
// Re-run `npm run sync:fm-bundle` (scripts/build-fm-bundle.mjs) and commit
// the diff whenever functional-model/cards/ changes — same manual
// "regenerate, then commit" cadence synergy.json/trace.json/progress.json
// themselves already have via functional-model/scripts/*.mjs. This file
// does NOT auto-regenerate on `npm run build`; a stale bundle after an
// engine-side card edit means prod keeps serving the LAST COMMITTED
// snapshot until this is re-run, same staleness contract synergy.json/
// trace.json already carry for their own consumers.
import fmBundleJson from '../../data/functional-model/fm-bundle.json';
import type { Fact } from '../../functional-model/synergy';
import type { CardDefinition } from '../../functional-model/card';
import type { TraceResult } from '../../functional-model/harness';
import type { CardStatusEntry } from '../../functional-model/card-status';

export interface FmBundleEntry {
  name: string;
  // Structurally a CardDefinition (name/manaCost/typeLine required, cmc/pt
  // optional) — never `effects`/`triggers`/etc, which functional-model/
  // synergy.ts's matcher (staticAttrsFor/resolveSubject, the only readers of
  // `PoolCard.card`) never reads; see build-fm-bundle.mjs's own comment for
  // the exact `.card.` access audit this relies on. Also carries
  // `continuousKeywordGrants` (+ a minimal `backFace` mirror of the same
  // field) — 2026-09-12, ENGINE_GAPS.md gap #14 — read by
  // server/api/card/[set]/[number].ts's own `loadFunctionalModel` to serve
  // `FunctionalModelData.continuousKeywordGrants`, NOT by the synergy
  // matcher.
  poolFacts: CardDefinition;
  synergy: { source: Fact[]; sink: Fact[] } | null;
  traces: TraceResult[];
  review: 'ai' | 'human';
  // cards/<slug>/progress.json's own `reviewCaveat` (2026-09-17, `uncertain`
  // bucket) — see server/api/card/[set]/[number].ts's own
  // `FunctionalModelData.reviewCaveat` doc comment. Optional (a bundle built
  // before this field existed simply omits it, same tolerance every other
  // field here already gets) rather than `string | null`, since this is the
  // BUILD-time raw value, not the served-response shape.
  reviewCaveat?: string;
  scenariosReview: 'draft' | 'reviewed';
  interactionsReview: 'draft' | 'reviewed';
  // cards/<slug>/verified-snapshot.json's own `capturedAt` (see server/api/
  // card/[set]/[number].ts's own `FunctionalModelData.reviewSnapshotAt`
  // doc comment) — `null` when the card has no verified-snapshot.json.
  reviewSnapshotAt: string | null;
  source: string;
  // progress.json's own `annotatedNonFactSpans` (2026-09-16 annotation-
  // taxonomy rework, see server/api/card/[set]/[number].ts's own
  // `AnnotatedNonFactSpan` — this bundle only needs the raw shape, not the
  // type import, since it's plain passthrough JSON either way) — always an
  // array, `[]` when the card's progress.json has none.
  annotatedNonFactSpans: Array<{
    target: 'oracle' | 'typeLine';
    line?: number;
    start: number;
    end: number;
    face?: 'front' | 'back';
    kind: 'definition-path' | 'rules' | 'lore';
    note: string;
  }>;
  // Per-card fact-authoring status (2026-09-16) — precomputed here, at
  // build time, by scripts/build-fm-bundle.mjs using the exact same
  // classifyCardStatus/computeTextCoverage recipe
  // functional-model/scripts/compute-card-status.mjs runs pool-wide (that
  // script's own output is data/fin/fin_card_status.json, still what the
  // `/app/status` grid page reads) — production can't dynamic-import
  // definition.ts or scan data/ for oracle text at request time (see
  // server/api/card/[set]/[number].ts's own header), so this bundle
  // carries the already-computed value instead. `null` when it couldn't be
  // computed for this card at all (no definition.ts, the common case for
  // most of the corpus) — see server/api/card/[set]/[number].ts's own
  // `FunctionalModelData.cardStatus` doc comment for the dev-vs-prod split.
  cardStatus: CardStatusEntry | null;
}

// Cast rather than let TS infer the raw JSON shape (tuple fields like
// `pt: [number, number]` come back as plain `number[]` from a JSON import,
// among other narrowing losses) — this file is generated by
// scripts/build-fm-bundle.mjs from the exact same source types, so the
// assertion just restates what's already true instead of re-deriving it via
// structural inference.
export const fmBundle = fmBundleJson as unknown as Record<string, FmBundleEntry>;
