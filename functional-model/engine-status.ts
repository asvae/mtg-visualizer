// Engine-capability status — a mechanic/vocabulary-level status axis,
// independent of any one card's own facts/synergy (contrast
// `functional-model/synergy.ts`'s per-card `Fact` model, untouched by this
// file, and `functional-model/keywords/registry.ts`'s own full historical
// MTG-keyword catalog, ALSO deliberately untouched as this file's base
// index — see "Why NOT `keywords/registry.ts`" below). Feeds
// `GET /api/engine-status` (`server/api/engine-status/index.get.ts`) — see
// `.claude/contracts/engine-status-schema.md` for the served shape.
//
// Five states. This file computes the first three for real, off this
// repo's own actual source; the last two are a human review OVERLAY,
// loaded by the server route (not here):
//
//   gray   — no support at all: a real, already-tracked gap in
//            `ENGINE_GAPS.md`'s own "Real gaps — prioritized" list, with no
//            `CLOSED` marker at all (that doc's own convention for "real,
//            OPEN, documented, not built").
//   purple — schema support only / partially modeled: `ENGINE_GAPS.md`
//            marks the gap `CLOSED`, but either (a) the SAME item's own
//            text also names a real, explicit remainder still not modeled
//            (a `CLOSED` claim with a caveat), or (b) no test file is cited
//            as evidence at all (closed by claim, not independently
//            checkable from this text alone).
//   blue   — engine support, VERIFIED: `ENGINE_GAPS.md` marks the gap
//            `CLOSED` AND cites a real `*.test.ts` file backing it, with no
//            named remainder.
//   yellow — (overlay, not computed here) a human reviewed a blue/purple
//            baseline and rejected it.
//   green  — (overlay, not computed here) a human reviewed and confirmed it.
//
// ## Why NOT `keywords/registry.ts` as the base index (design correction,
// 2026-09-17)
//
// An earlier version of this file used `KEYWORD_REGISTRY`'s full 369-entry
// historical MTG-keyword catalog as the base list, pre-seeding a `gray` row
// for every keyword this engine has never heard of (Banding, Adamant,
// Amplify, ...). Corrected per explicit direction: this dashboard is not
// meant to be an a-priori enumeration of every possible MTG mechanic
// ("closer in spirit to how ENGINE_GAPS.md already accumulates gaps
// organically as they're actually encountered, rather than being pre-seeded
// with every possible gap up front"). A "mechanic" tracked here isn't
// necessarily a CR keyword at all — several real entries below are whole
// rules subsystems (state-based actions, turn-structure completeness,
// target-legality/fizzle) or narrow bugfixes (`state.pump()`'s missing
// `untilEndOfTurn` expiry), not keyword abilities.
//
// The base index is instead PARSED, fresh off disk every call, from
// `ENGINE_GAPS.md`'s own "## Real gaps — prioritized" numbered list — the
// authoritative, already-curated, organically-grown ledger this project
// already maintains by hand for exactly this purpose (that doc's own
// header: "the prioritized inventory of what real Forge does that this
// engine still doesn't... every row checked against real Forge source, not
// guessed"). Nothing here duplicates that doc's content into a second,
// driftable data file — parsing it live means a future gap added to
// `ENGINE_GAPS.md` the normal way (as this project's whole engine-work
// history already shows happening ~30 times) appears on this dashboard
// automatically, with no second place to remember to update.
//
// `ENGINE_GAPS.md`'s OTHER section, "## FIN-specific mechanics closed"
// (Saga automation, Stun/Finality counters, the counter-conditional-grant
// closure, the static-ability audit's several buckets — including its own
// "Genuinely unclosable, loud-flagged" real gray list: quina-qu-gourmet's
// replacement effect, Meld, the mana-ability-grant gap, etc.) is a REAL,
// additional source of trackable capabilities, deliberately NOT wired in
// yet (a named follow-up, not a silent omission) — it's bullet-structured
// rather than uniformly numbered, needing its own parser; left for the
// next pass once this numbered-list MVP is in place, same "grow over time"
// posture the numbered list itself already has.
//
// ## Parsing approach and its own real, checkable evidence
//
// Each numbered item's own span (from its `N. ` marker to the next one, or
// to the section's end) is checked, whitespace-flattened, for three
// independent textual signals ENGINE_GAPS.md already uses CONSISTENTLY
// throughout its own ~30 real entries (verified by reading a representative
// sample across the whole list while building this, not assumed):
//   - `CLOSED_RE` — the literal word "CLOSED"/"Closed" this doc's own
//     convention already uses to mark an item done (`~~**title**~~
//     **CLOSED**`, `**Closed (date)**`, etc.)
//   - `TEST_CITATION_RE` — a literal `*.test.ts` filename mentioned in the
//     item's own text (`engine.test.ts`, `sba.test.ts`, `cycling.test.ts`,
//     ...) — this project's own established "closed" standard IS "backed by
//     a real test," per every entry's own prose; requiring the citation be
//     literally present is what makes that already-established standard
//     checkable by code instead of merely trusted from an adjacent claim.
//   - `REMAINDER_RE` — phrases this doc's own authors already use,
//     consistently, to name a real remaining gap even within an otherwise-
//     closed item ("Still real, explicitly NOT modeled: ...", "Pay-life
//     remains unsupported", "real, OPEN, documented (not built)",
//     "entirely unmodeled").
//
// Deliberately imperfect, documented rather than papered over: this is
// prose, not a machine-readable schema, so the signals are heuristic — a
// `CLOSED` marker anywhere in a long item can reflect a NESTED sub-closure
// rather than the item's own top-level claim (gap #7, "Alternate costs,
// modal/split costs...": Flashback/Jump-start IS closed, but modal/split
// costs and Foretell are separately, explicitly still not modeled — this
// combination correctly lands `purple`, not a clean `blue`, via the
// REMAINDER_RE match, but at the granularity of ENGINE_GAPS.md's own
// numbered item rather than a further hand-split sub-row). A human
// reviewer's yellow/green override (server route) is the correction path
// for any case this coarse a heuristic gets wrong — not a reason to avoid
// computing a baseline.

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export type EngineStatusBaseline = 'gray' | 'purple' | 'blue';
export type EngineStatusColor = 'gray' | 'purple' | 'blue' | 'yellow' | 'green';

export interface EngineStatusEvidence {
  /** `ENGINE_GAPS.md`'s own gap number (its "## Real gaps — prioritized" numbering) — the real, stable identifier a reader can go look up directly. */
  gapNumber: number;
  /** 1-based line number in `ENGINE_GAPS.md` where this item's own `N. ` marker starts — a direct deep-link for a consumer that wants one. */
  sourceLine: number;
  hasClosedMarker: boolean;
  /** Every distinct `*.test.ts` filename this item's own text cites as real coverage — empty when `hasClosedMarker` is true but no citation was found (that combination is what makes an otherwise-"closed" item land `purple`, not `blue`). */
  testFiles: string[];
  /** True when the item's own text ALSO names a real, explicit remaining gap even though (part of) it is closed — see `REMAINDER_RE`'s own doc comment above for the exact phrases checked. */
  hasNamedRemainder: boolean;
  /** First ~280 characters of the item's own whitespace-flattened text — enough for a human to spot-check the call directly against `ENGINE_GAPS.md` itself without opening the file. */
  excerpt: string;
}

export interface EngineStatusEntry {
  /** Stable slug derived from the gap's own title — `gap-<N>-<slugified-title-prefix>`, so a re-wording of the title doesn't silently orphan a review overlay entry keyed on the OLD slug (the gap NUMBER, not the title text, is the stable part). */
  key: string;
  gapNumber: number;
  title: string;
  baseline: EngineStatusBaseline;
  evidence: EngineStatusEvidence;
}

const CLOSED_RE = /\bCLOSED\b|\bClosed\b/;
const TEST_CITATION_RE = /\b([\w-]+\.test\.ts)\b/g;
const REMAINDER_RE =
  /\b(?:NOT modeled|not modeled|remains unsupported|still (?:not|OPEN|unsupported)|real,? OPEN|entirely unmodeled)\b/i;
const TITLE_RE = /^\d+\.\s+(?:~~)?\*\*(.+?)\*\*/;

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[`'"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

interface ParsedGapItem {
  gapNumber: number;
  sourceLine: number;
  flatText: string;
}

/** Parses `ENGINE_GAPS.md`'s own "## Real gaps — prioritized" numbered list into per-item spans, fresh off disk. */
function parseGapItems(fmDir: string): ParsedGapItem[] {
  const gapsPath = join(fmDir, 'ENGINE_GAPS.md');
  if (!existsSync(gapsPath)) return [];
  const src = readFileSync(gapsPath, 'utf8');
  const lines = src.split('\n');

  const startIdx = lines.findIndex((l) => l.startsWith('## Real gaps'));
  if (startIdx === -1) return [];
  const endIdx = lines.findIndex((l, i) => i > startIdx && l.startsWith('## '));
  const sectionLines = lines.slice(startIdx, endIdx === -1 ? lines.length : endIdx);
  const sectionText = sectionLines.join('\n');

  const itemStartRe = /^(\d+)\.\s/gm;
  const starts: { num: number; offset: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = itemStartRe.exec(sectionText))) starts.push({ num: Number(m[1]), offset: m.index });

  return starts.map((s, i) => {
    const nextOffset = i + 1 < starts.length ? starts[i + 1]!.offset : sectionText.length;
    const rawText = sectionText.slice(s.offset, nextOffset);
    const flatText = rawText.replace(/\s+/g, ' ').trim();
    // Line number of this item's own start, relative to the whole file (1-based).
    const upToOffset = sectionText.slice(0, s.offset);
    const sourceLine = startIdx + upToOffset.split('\n').length;
    return { gapNumber: s.num, sourceLine, flatText };
  });
}

/**
 * Computes the real, checkable gray/purple/blue baseline for every gap
 * tracked in `ENGINE_GAPS.md`'s own numbered "Real gaps — prioritized"
 * list. `root` defaults to `process.cwd()` (the repo root — true both
 * inside a Nuxt server route and via `npx vite-node
 * functional-model/scripts/compute-engine-status.mjs`).
 */
export function computeEngineStatus(root: string = process.cwd()): EngineStatusEntry[] {
  const fmDir = join(root, 'functional-model');
  const items = parseGapItems(fmDir);

  return items.map((item): EngineStatusEntry => {
    const titleMatch = item.flatText.match(TITLE_RE);
    const title = (titleMatch?.[1] ?? `(gap #${item.gapNumber}, title unparsed)`).replace(/\.$/, '').trim();

    const hasClosedMarker = CLOSED_RE.test(item.flatText);
    const testFiles = Array.from(new Set(Array.from(item.flatText.matchAll(TEST_CITATION_RE)).map((mm) => mm[1]!)));
    const hasNamedRemainder = REMAINDER_RE.test(item.flatText);

    let baseline: EngineStatusBaseline;
    if (!hasClosedMarker) baseline = 'gray';
    else if (hasNamedRemainder || testFiles.length === 0) baseline = 'purple';
    else baseline = 'blue';

    return {
      key: `gap-${item.gapNumber}-${slugify(title)}`,
      gapNumber: item.gapNumber,
      title,
      baseline,
      evidence: {
        gapNumber: item.gapNumber,
        sourceLine: item.sourceLine,
        hasClosedMarker,
        testFiles,
        hasNamedRemainder,
        excerpt: item.flatText.slice(0, 280),
      },
    };
  });
}
