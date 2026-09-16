// Per-card FIN dashboard status — the real, permanent, rerunnable-anytime
// pipeline step behind `functional-model/card-status.ts`'s own 8-bucket
// classifier (red/orange/green/yellow/gray/verified/uncertain/re-review — see that
// file's own header for the full priority-order rationale). This script is the thin
// CLI entry point (`npm run card-status`) around the actual fs/dynamic-import
// orchestration, which now lives in `card-status-batch.mjs`'s
// `computeAllCardStatuses` (2026-09-16, extracted so
// `server/api/card-status/[set].get.ts` can spawn the SAME pool-wide recipe
// live, per grid-page request, via a sibling script (`compute-all-card-
// status.mjs`) instead of duplicating this loop a third time): it
// dynamically imports every `cards/<slug>/definition.ts`, reads every
// `cards/<slug>/synergy.json`, resolves each card's real Scryfall oracle
// text (`text-coverage.mjs`'s own `loadOracleTextByName`), computes text
// coverage (`computeTextCoverage`), and calls `classifyCardStatus` once per
// in-scope FIN card.
//
// **Fully re-derived from already-checked-in artifacts every run** —
// `definition.ts` + `synergy.json` + real Scryfall oracle text, nothing
// else (2026-09-16: plus a card's own `progress.json`, READ-ONLY, for
// exactly one field — see below). No separate hand-maintained state to
// keep in sync (deliberately does NOT WRITE anything into any card's own
// `progress.json` — see `scripts/AI_FACT_ELIMINATION_PROCESS.md`'s
// "Per-card dashboard status" section for why: several `progress.json`
// files were mid-edit by a concurrent session at the time this script was
// built, and per-card mutation isn't needed anyway — this script's own
// output already IS the single source of truth, safe to rerun as often as
// the pool changes).
//
// **`progress.json`'s own `annotatedNonFactSpans` (2026-09-16, annotation-
// taxonomy plumbing)** — the one field this script now reads (still never
// writes) off each card's `progress.json`, if present: real oracle-text
// spans that are accounted-for but deliberately carry no `Fact` at all
// (`kind:'definition-path'`/`'rules'`/`'lore'` — see
// `.claude/contracts/card-schema.md`'s own section for the full shape and
// rationale, motivated by `ultima-origin-of-oblivion`'s own real
// false-yellow: its blight-counter consequence clause is real,
// mechanically-enforced machinery with no Fact to anchor to). Threaded
// straight into `computeTextCoverage`'s new third argument — a missing or
// unparseable `progress.json` degrades to "no extra spans" (same
// tolerance every other optional per-card read here already has), never a
// hard failure.
//
// **`progress.json`'s own `reviewCaveat` (2026-09-17, `uncertain` bucket)**
// — a third field this script now reads (still never writes) off each
// card's `progress.json`: a free-text note a human (or an agent acting on
// a human's explicit direction) writes when this exact card's facts are
// otherwise fully complete but a SPECIFIC, real conceptual gap remains
// that can't currently be modeled as a `Fact` at all — see
// `card-status.ts`'s own header for the full `uncertain`-bucket rationale
// and the Cloud, Midgar Mercenary motivating example. Missing/unparseable
// `progress.json` or a non-string value degrades to `undefined` (never a
// hard failure), same tolerance as `review`/`annotatedNonFactSpans`.
//
// **Output**: `data/fin/fin_card_status.json` — `{ generatedAt, set,
// cards: CardStatusEntry[] }`, one entry per in-scope FIN card (same
// in-scope filter `relations.test.mjs`/`generate-set-status.mjs` already
// use: drop basic lands and digital-only Alchemy rebalances). Checked in,
// regenerated (never hand-edited), same "derived artifact, not a source of
// truth to hand-maintain" convention `SET_STATUS.md` already establishes
// for a different per-set status — timestamp it as "as of `generatedAt`",
// never assume it's still current without rerunning. Also served LIVE
// (no manual rerun needed) by `server/api/card-status/[set].get.ts` in dev
// — this checked-in file is now only the PRODUCTION fallback for that
// route (a Netlify Function can't dynamic-import functional-model/'s raw
// source tree at request time), same "batch snapshot" role
// `data/fin/fin_relations.json` still plays for other routes.
//
// Usage: npm run card-status
// (equivalently: npx vite-node functional-model/scripts/compute-card-status.mjs)
import { writeFile } from 'node:fs/promises';
import { computeAllCardStatuses } from './card-status-batch.mjs';

const outUrl = new URL('../../data/fin/fin_card_status.json', import.meta.url);

const { generatedAt, set, cards, tally, importErrorBySlug } = await computeAllCardStatuses('fin');

const payload = { generatedAt, set, cards };
await writeFile(outUrl, `${JSON.stringify(payload, null, 2)}\n`);

console.log(`Wrote ${cards.length} FIN card statuses to data/fin/fin_card_status.json (generatedAt ${generatedAt}).`);
console.log('Counts:', tally);
if (importErrorBySlug.size > 0) {
  console.log(`\n${importErrorBySlug.size} card director(y/ies) failed to import (excluded from name->slug resolution, not necessarily reflected as any specific card's own gray status):`);
  for (const [slug, msg] of importErrorBySlug) console.log(`  · ${slug}: ${msg}`);
}
