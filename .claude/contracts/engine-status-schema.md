# Contract: Engine-capability status axis

Owner: **engine** agent (`functional-model/engine-status.ts` +
`server/api/engine-status/*`). Consumer: **ui** agent's not-yet-built
status page. If this file drifts from the real served shape, whoever
noticed says so to the orchestrator — don't silently patch around a stale
contract.

## What this is (and isn't)

A **mechanic/vocabulary-level** status — "does the engine actually support
this at all" — independent of any one card's own facts/synergy
(`functional-model/synergy.ts`'s per-card `Fact` model is untouched by this
axis) and independent of the sink-only-synergy experiment planned to follow
it.

**This is NOT an a-priori enumeration of every historical MTG keyword.**
An earlier design used `functional-model/keywords/registry.ts`'s full
369-entry Scryfall-keyword catalog as the base index, pre-seeding a `gray`
row for every keyword this engine has never heard of. That was corrected:
this dashboard is a **sparse, organically-growing** set of tracked entries,
seeded from real signals this project already tracks by hand — closer in
spirit to how `functional-model/ENGINE_GAPS.md` itself accumulates gaps
organically as they're actually encountered, not pre-seeded with every
possible gap up front. It's fine, and expected, for this axis to only show
what's actually been flagged/tracked so far and grow over time.

Concretely: **the base index is parsed, fresh off disk every request,
from `ENGINE_GAPS.md`'s own "## Real gaps — prioritized" numbered list**
(currently 29 items, both closed and still-open — see that doc's own
header: "the prioritized inventory of what real Forge does that this
engine still doesn't... every row checked against real Forge source, not
guessed"). A "mechanic" tracked here isn't necessarily a CR keyword at all
— several entries are whole rules subsystems (state-based actions,
turn-structure completeness, target-legality/fizzle) or narrow correctness
fixes (`state.pump()`'s missing `untilEndOfTurn` expiry), matching exactly
the granularity `ENGINE_GAPS.md` itself already uses.

**Known, named, NOT-yet-wired-in follow-up** (not a silent omission):
`ENGINE_GAPS.md`'s OTHER section, "## FIN-specific mechanics closed" (Saga
automation, Stun/Finality counters, the counter-conditional-grant closure,
the static-ability audit's several buckets — including its own real
"Genuinely unclosable, loud-flagged" gray list: quina-qu-gourmet's
replacement effect, Meld, the mana-ability-grant gap, etc.) is a real,
additional source of trackable capabilities not yet parsed (it's
bullet-structured, not uniformly numbered, needing its own parser). A
future pass can add it as a second source feeding the same index — same
"grow over time" posture the numbered list already has. `keywords/
registry.ts`'s own 369-entry catalog is cross-referenced NOWHERE in this
axis today; it remains its own, separate, complete-taxonomy tool for a
different question ("does the Keywords PAGE have a demo bundle for this
printed keyword").

## Five states

- `gray` — no support at all. Computed: the tracked gap has no `CLOSED`
  marker anywhere in `ENGINE_GAPS.md`'s own text for that item (that doc's
  own convention for "real, OPEN, documented, not built").
- `purple` — schema support only / partially modeled, unverified by a
  falsifiable scenario/trace. Computed: `CLOSED`, but either (a) the same
  item's own text ALSO names a real, explicit remainder not modeled (a
  `CLOSED` claim with a caveat — e.g. gap #2's SBA closure explicitly
  excludes 704.5a/704.5i/attachment SBAs), or (b) no `*.test.ts` file is
  cited anywhere in the item's own text (closed by claim, not independently
  checkable from this text alone — e.g. gap #27, genuinely closed per-card
  but the doc itself says "Not re-demonstrated by [the card's] own
  scenario").
- `blue` — engine support, VERIFIED. Computed: `CLOSED`, cites at least one
  real `*.test.ts` file, and names no remainder.
- `yellow` — **review overlay, not computed by `engine-status.ts`**: a
  human reviewed a `blue`/`purple` baseline and rejected it. Requires a
  non-empty `note`.
- `green` — **review overlay**: a human reviewed and confirmed it.

`baseline` (gray/purple/blue) and `color` (baseline, possibly overridden to
yellow/green) are both always present on a served entry — a consumer
should render/filter on `color`, but `baseline` stays visible too so "what
did the reviewer actually override, and from what" is never lost.

## Source (`engine` agent owns)

- `functional-model/engine-status.ts` — `computeEngineStatus(root?: string):
  EngineStatusEntry[]`. Pure function, no Nuxt/Nitro dependency, reads
  `ENGINE_GAPS.md` fresh off disk every call (`root` defaults to
  `process.cwd()`, correct both inside a Nuxt server route and via `npx
  vite-node functional-model/scripts/...`).

```ts
type EngineStatusBaseline = 'gray' | 'purple' | 'blue';
type EngineStatusColor = 'gray' | 'purple' | 'blue' | 'yellow' | 'green';

interface EngineStatusEvidence {
  gapNumber: number;       // ENGINE_GAPS.md's own numbering
  sourceLine: number;      // 1-based line in ENGINE_GAPS.md where "N. " starts
  hasClosedMarker: boolean;
  testFiles: string[];     // every distinct *.test.ts filename cited in the item's own text
  hasNamedRemainder: boolean;
  excerpt: string;         // first ~280 chars of the item's own whitespace-flattened text
}

interface EngineStatusEntry {
  key: string;             // stable: `gap-<N>-<slugified-title-prefix>` — the NUMBER is the stable part
  gapNumber: number;
  title: string;
  baseline: EngineStatusBaseline;
  evidence: EngineStatusEvidence;
}
```

- `functional-model/engine-status-reviews.json` — flat, hand-edited (or
  written by `./review.post.ts`) map, sibling to
  `functional-model/keywords/review-status.json`/`recognizers/
  review-status.json` but a DIFFERENT shape (those are `Record<string,
  true>`; this one carries a real verdict + note):

```jsonc
{
  "gap-27-grantkeywordall-had-no-attacking-creatures-predi": {
    "verdict": "confirm",           // or "reject"
    "note": "spot-checked, matches Cecil's real definition.ts",  // required for "reject"
    "reviewedAt": "2026-09-17",
    "reviewedBy": "optional free text"
  }
}
```

Deliberately **not** the old per-card `review-drafts.json`/
`review-responses.json` relay-queue pattern — that queue was retired
2026-09-13 (see `scripts/REVIEW_PROCESS.md`'s own note) and doesn't exist
in this repo anymore; this is a fresh, much simpler design scoped to a
handful of tracked gaps, not a batch-review queue. Mirrors `tagging/
card-enrichment-status.json`'s own flat identity-keyed shape instead.

## Served shape (`GET /api/engine-status`)

```ts
interface EngineStatusPageEntry {
  key: string;
  gapNumber: number;
  title: string;
  baseline: EngineStatusBaseline;   // unchanged by review
  evidence: EngineStatusEvidence;
  color: EngineStatusColor;         // baseline, or yellow/green if reviewed — render/filter on THIS
  review?: { verdict: 'confirm' | 'reject'; note?: string; reviewedAt?: string; reviewedBy?: string };
}
```

`GET /api/engine-status` returns `EngineStatusPageEntry[]`, freshly
computed every request (dev convention, same as `server/api/keywords/
index.get.ts`'s own `loadReviewOverrides`/`loadFinScryfall` — no build-time
caching, a hand-edited `ENGINE_GAPS.md` or `engine-status-reviews.json`
reflects on the next request with no restart).

## Review write path

`POST /api/engine-status/review`, body `{ key, verdict: 'confirm' |
'reject' | null, note?, reviewedBy? }` → `{ key, color }`. Dev-only (403 in
production, same posture as `keywords`/`recognizers`'s own review-status
routes — writes into the repo's own source tree, no audit trail, a real
serverless deployment's filesystem isn't the repo checkout anyway).
`verdict: null` clears a review, falling back to the computed baseline.
`key` is validated against a **fresh** `computeEngineStatus()` call, not a
separate static id catalog (this axis's whole index is itself computed off
`ENGINE_GAPS.md` — there's nothing else to keep in sync). A `'reject'`
verdict without a non-empty `note` is rejected with 400 — the whole point
of yellow is "reviewed AND here's why it's wrong."

## What `ui` (consumer) must not assume

- **Don't assume `key` is stable across a title rewording** — only the
  `gap-<N>-` NUMBER prefix is guaranteed stable; a cosmetic ENGINE_GAPS.md
  wording change can change the slug suffix. If you need a durable
  cross-session reference, key on `gapNumber`, not the full `key` string,
  or accept that a stored review can go stale if a title is heavily
  reworded (same risk `keywords/review-status.json` already accepts for
  its own keys, unaddressed there too).
- **The entry COUNT will grow over time**, not stay at 29 — new gaps get
  added to `ENGINE_GAPS.md` the normal way as engine work continues; don't
  hardcode 29 anywhere, don't build a UI that assumes a fixed row count.
- **`baseline` can legitimately look conservative** — several real,
  fully-working closures land `purple` rather than `blue` because
  `ENGINE_GAPS.md`'s own prose names a real remainder even for an otherwise-
  closed item (e.g. gap #7, "Alternate costs...": Flashback/Jump-start IS
  closed and tested, but the SAME item also explicitly says modal/split
  costs and Foretell are "still real, explicitly NOT modeled" — the whole
  numbered item lands `purple`, at ENGINE_GAPS.md's own granularity, not
  split into two rows). This is a deliberate, safe-by-design bias (under-
  claim rather than over-claim); the yellow/green review overlay is the
  intended correction path for a case a human judges differently, not a
  reason to treat `purple` as "obviously broken."
- **`evidence.excerpt`/`testFiles`/`hasNamedRemainder` are for
  spot-checking, not for building UI copy from directly** — they're raw,
  whitespace-flattened prose fragments (Markdown backticks/asterisks may
  still be present), not curated display strings.

## What `engine` (producer) must not break

- Any change to `ENGINE_GAPS.md`'s own numbered-list structure (the
  `^\d+\. ` marker convention, the `CLOSED`/`Closed` marker word, `*.test.ts`
  citations) is load-bearing for this parser — changing that doc's own
  formatting conventions without checking `functional-model/
  engine-status.test.ts` still passes risks silently breaking the whole
  axis.
- `EngineStatusEntry.key`'s `gap-<N>-` prefix must stay derived from the
  real gap number, never renumbered/reused for a different gap.
