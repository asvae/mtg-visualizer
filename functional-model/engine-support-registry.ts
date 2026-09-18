// A small, honest, deterministic per-card "engine support" crossref for
// FDN's authoring pipeline — genuinely different from the pipeline's own
// gray/purple/blue `pipeline-status.json` axis (`pipeline-status.ts`), which
// answers "does the schema fully REPRESENT this card's printed text." A
// card can have ZERO `missingSchemaFunctionality` gaps (fully represented)
// while still using a keyword/trigger/effect the schema recognizes but the
// real engine doesn't actually enforce/trigger at runtime — Ward is the
// confirmed real case this registry is seeded with: `card.ts`'s own
// `Keyword` union includes `'Ward'` (recognized, typed, gate-representable)
// but `functional-model/keywords/registry.ts`'s own catalog entry for it
// says plainly: "nothing in the engine enforces or triggers it yet."
//
// Also genuinely different from `functional-model/engine-status.ts`'s own
// 29-gap dashboard, which is coarse/subsystem-level (whole rules areas
// parsed out of `ENGINE_GAPS.md`'s numbered list, e.g. "Combat: blockers,
// damage, first/double strike, trample") — not fine-grained enough to
// answer "is `Keyword: 'Ward'` ITSELF engine-verified" for one specific
// card. This registry is the finer grain: a sparse, organically-growing
// set of real per-card-detectable gaps, seeded honestly small (one real
// entry today) and meant to grow as more are found — same "grow over time,
// never pre-seed the whole space" posture `engine-status.ts`'s own header
// already establishes for its own axis (see
// `.claude/contracts/engine-status-schema.md`).
//
// Deliberately NOT a new status color — `pipeline-status.ts`'s own
// gray/purple/blue/yellow/green/re-review axis is untouched by this file.
// `engineSupport` is a wholly separate, additive field wired into
// `PipelineStatusFile` by `pipeline-status.ts` itself (see that file for
// the wiring — this module only owns the registry + the pure classifier).
import type { CardDefinition } from './card';

export interface EngineSupportGapEntry {
  /** Stable, kebab-case identity — never reused for a different gap once
   * a real `pipeline-status.json` has recorded it (mirrors every other
   * axis's own `key`/`id` stability convention in this pool). */
  id: string;
  /** Real, specific, human-readable description of the gap — names the
   * exact recognized-but-unenforced construct and cites its own source
   * (never a vague "engine incomplete" placeholder). */
  description: string;
  /** Real, deterministic per-card check — reads only the given
   * `CardDefinition` (and, when present, its `backFace`), never any I/O or
   * external state. */
  matches: (definition: CardDefinition) => boolean;
  /** `ENGINE_GAPS.md`'s own numbered-gap reference, when this entry is
   * already tracked there under a broader/coarser umbrella. Left unset
   * (never guessed at a number) when no such numbered entry exists yet —
   * Ward's own gap is tracked only in `functional-model/keywords/
   * registry.ts`'s per-keyword `gapNote`, not as its own numbered
   * `ENGINE_GAPS.md` entry, as of this writing. */
  gapRef?: number;
}

/**
 * Real, current catalog — grows on demand as more real per-card engine-
 * support gaps are found, same discipline `sink-model`'s own catalog and
 * `engine-status.ts`'s own gap list already follow. Never a hypothetical/
 * speculative entry — each one must cite a real, checked source (a code
 * comment, `ENGINE_GAPS.md`, or `keywords/registry.ts`'s own `gapNote`).
 */
export const ENGINE_SUPPORT_REGISTRY: EngineSupportGapEntry[] = [
  {
    id: 'ward-not-enforced',
    description:
      "Ward is recognized/typed (card.ts's own Keyword union includes 'Ward') but nothing in state.ts enforces or triggers it yet — functional-model/keywords/registry.ts's own \"ward\" entry says so directly: \"Recognized only as a Keyword string-union member (card.ts) — same missing targeting-legality/triggered-cost machinery as Hexproof... nothing in the engine enforces or triggers it yet.\"",
    matches: (def) => (def.keywords ?? []).includes('Ward') || (def.backFace?.keywords ?? []).includes('Ward'),
  },
];

/**
 * Pure, deterministic per-card classifier — `'off'` iff at least one real
 * registry entry matches this `CardDefinition` (checking both its front
 * face and, when present, its `backFace`, since each entry's own `matches`
 * already checks both directly). `'on'` means "no currently-tracked engine-
 * support gap found," NOT "engine-verified clean" — this registry is
 * sparse and organically-growing (see this file's own header), so `'on'`
 * is honestly "nothing tracked yet," same posture `engine-status.ts`'s own
 * gray/purple/blue baseline already takes toward its own sparse index.
 */
export function computeEngineSupport(definition: CardDefinition): 'on' | 'off' {
  return ENGINE_SUPPORT_REGISTRY.some((entry) => entry.matches(definition)) ? 'off' : 'on';
}
