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
interface EngineStatusTestFileRef {
  file: string;       // one of evidence.testFiles' bare filenames, e.g. "engine.test.ts"
  matches: string[];  // every real repo-root-relative path under functional-model/ with that exact basename — see below for why this is an array, and why it can be empty
}

interface EngineStatusPageEntry {
  key: string;
  gapNumber: number;
  title: string;
  baseline: EngineStatusBaseline;   // unchanged by review
  evidence: EngineStatusEvidence;
  testFileRefs: EngineStatusTestFileRef[];  // real on-disk resolution of evidence.testFiles — see "Real evidence" below
  color: EngineStatusColor;         // baseline, or yellow/green if reviewed — render/filter on THIS
  review?: { verdict: 'confirm' | 'reject'; note?: string; reviewedAt?: string; reviewedBy?: string };
}
```

### Real evidence (2026-09-18) — reading the actual cited test code

`evidence.testFiles` only ever carried a bare filename (a literal regex match
against `ENGINE_GAPS.md`'s own prose) — no path, no way to read the real
file. `testFileRefs` resolves each citation against the real repo tree
(`functional-model/source-files.ts`'s `findFunctionalModelFilesByBasename`,
recursive, fresh off disk every request, no caching):

- **`matches` is an array, not one guessed path** — this repo has a real,
  checked-in basename collision: `engine.test.ts` exists both at
  `functional-model/engine.test.ts` AND
  `functional-model/cards/jill-shiva-s-dominant-shiva-warden-of-ice/engine.test.ts`.
  Collapsing that to a single picked path would silently misattribute
  evidence to the wrong file.
- **`matches` can legitimately be empty** — a real, found case: gap #19's
  own ENGINE_GAPS.md text cites `card.test.ts`, which does not exist
  anywhere in this repo (the citation is a parser false-positive off a
  sentence saying that file "needed no new cases," not a real "this file
  backs the closure" claim — see the engine agent's own 2026-09-18 audit
  notes for the full write-up). A consumer should render "citation not
  found on disk" for an empty `matches`, not hide the row or treat it as a
  fetch error.
- **Fetch real content for one match** via `GET /api/engine-status/source?path=<one of testFileRefs[].matches[i]>`
  → `{ path: string; exists: boolean; content: string | null; truncated: boolean }`.
  A SEPARATE route (not inlined into the list above) specifically because
  several real gap entries cite the SAME large file (`engine.test.ts`, the
  single largest cited file, ~115KB) — inlining would repeat that content
  once per citing entry. `content` is truncated (never silently — see
  `truncated`) above `MAX_INLINE_SOURCE_BYTES` (`functional-model/
  source-files.ts`), generous enough for every file cited today.
- **Read-only, hard-scoped to `functional-model/`** — `source.get.ts`
  rejects (returns `exists: false`, never throws or serves content) any
  `path` that resolves outside that directory, including a `..`-laden
  traversal attempt. There is no way to read anything outside
  `functional-model/` through this route.
- **`evidence.testFiles`/`hasClosedMarker`/`hasNamedRemainder` themselves are
  unchanged** — this is purely an additive enrichment on top of the
  existing baseline computation, not a reclassification.

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
- **`blue` ("engine support, VERIFIED") means "cites a `*.test.ts` file,"
  NOT "backed by a real gameplay-scenario test."** A 2026-09-18 audit (see
  the engine agent's own memory notes) found real, checkable variance among
  the 11 currently-`blue` entries: only `engine.test.ts` genuinely drives
  the engine through real turn/phase structure (`createEngine`+`advance`/
  `stepPriority`+real `castSpell`/`declareAttackers`/etc.) — `mana.test.ts`,
  `state.test.ts`, `sba.test.ts`, `turn.test.ts`, `triggers.test.ts`,
  `combinator.test.ts`, and `stack.test.ts` are all narrower unit/module
  tests that call one function directly against hand-built minimal
  fixtures, never invoking `createEngine` at all. Several `blue` entries
  (gaps #8, #10, #21 fully, #20/#24 fully) cite ONLY this narrower kind of
  test, with no `engine.test.ts` citation at all. `recognizers/
  attacks-trigger-structural.test.ts` (cited by gap #22) is a SYNERGY-FACT
  recognizer test (real-card oracle-text pattern matching), not an engine
  test at all — it never touches `GameState`/`createEngine`. None of the 11
  reach this project's own established "real gameplay scenario" bar
  (`harness.ts`'s `runScenario`/`engine-trace.ts`'s `runEngineScenarios`,
  producing a real, checked-in `trace.json` a reviewer can independently
  read) the way a card's own `scenarios.ts` or the sink-derivation
  predicates' own corpus tests do. This is not (yet) reflected in
  `baseline`/`color` — deliberately left as a human judgment call, not
  silently reclassified. A reviewer should read the actual test content
  (via `testFileRefs`/`GET /api/engine-status/source`) before confirming
  `blue`, not trust the color alone.

## What `engine` (producer) must not break

- Any change to `ENGINE_GAPS.md`'s own numbered-list structure (the
  `^\d+\. ` marker convention, the `CLOSED`/`Closed` marker word, `*.test.ts`
  citations) is load-bearing for this parser — changing that doc's own
  formatting conventions without checking `functional-model/
  engine-status.test.ts` still passes risks silently breaking the whole
  axis.
- `EngineStatusEntry.key`'s `gap-<N>-` prefix must stay derived from the
  real gap number, never renumbered/reused for a different gap.
