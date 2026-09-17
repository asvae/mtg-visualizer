# Contract: Sink-derivation-predicate status axis

Owner: **engine** agent (`functional-model/sink-derivation-status.ts` +
`server/api/sink-derivations/*`). Consumer: **ui** agent's not-yet-built
status page. If this file drifts from the real served shape, whoever
noticed says so to the orchestrator — don't silently patch around a stale
contract.

## What this is (and isn't)

A **standalone scaffold, currently empty of real work** for tracking
progress on a small, specific set of hand-written **sink-derivation
predicates** — a different axis from both `functional-model/engine-status.ts`
(mechanic/vocabulary-level "does the engine support this at all") and
`functional-model/synergy.ts`'s per-card `Fact` model.

Background: the sink-only-synergy matcher
(`functional-model/sink-model/match-sink.ts`) derives what a card produces
by walking its `CardDefinition` (effects/triggers/program nodes). A sanity
check against real FIN cards found a real, named gap: some mechanics
produce real gameplay consequences that are **not visible via
`CardDefinition` effect-walking at all** — they're emergent from generic
engine automation subsystems instead. Concrete example: Saga
chapter-completion (`saga.ts`) — Summon: Bahamut's real
graveyard-transition on its final chapter comes entirely from generic Saga
automation (typeLine + `chapterN` trigger-name pattern), with no
corresponding `Effect` node in its own `definition.ts`. Stun counters,
Finality counters, and Crew are the same class of problem.

The plan: for each such mechanism, eventually build a small predicate
function — not a data-driven declarative `Fact`-like object, but a direct
function answering one specific question ("does this specific card's Saga
automation produce a creature death?" -> true/false), verified against a
corpus of real executed scenarios/traces (mirroring how
`scripts/verify-synergy.mjs` already reconciles `Fact`s against traces),
with an explicit "unknown/escalate" result (never a guessed answer) when a
card's shape doesn't match anything the predicate recognizes.

**This axis is ONLY the status dashboard for tracking progress on
building/verifying those predicates — no predicate logic exists yet.**
Every seeded entry starts `gray` today, for real (not as a placeholder) —
this whole scaffold is meant to fill in one entry at a time as real
predicate work lands later.

## Five states (this context's meaning)

- `gray` — no predicate built yet for this mechanism. Computed: no
  predicate module file exists on disk yet at the mechanism's expected
  path.
- `purple` — a predicate module exists, but it hasn't yet been checked
  against a real scenario corpus (either no corpus-verification manifest
  exists yet, or it exists but doesn't yet show every scenario in it
  agreeing with real trace evidence).
- `blue` — verified: a predicate module exists AND its corpus-verification
  manifest shows every scenario in its corpus (a real, positive count)
  agreeing with real trace evidence.
- `yellow` — **review overlay, not computed by `sink-derivation-status.ts`**:
  a human reviewed a `blue`/`purple` baseline and found a real
  disagreement/wrong verdict. Requires a non-empty `note` describing what's
  wrong.
- `green` — **review overlay**: a human reviewed and confirmed the
  predicate is correct.

`baseline` (gray/purple/blue) and `color` (baseline, possibly overridden to
yellow/green) are both always present on a served entry — a consumer
should render/filter on `color`, but `baseline` stays visible too so "what
did the reviewer actually override, and from what" is never lost. Same
split as `.claude/contracts/engine-status-schema.md` — read that contract
first if this is your first time consuming either axis; the two intentionally
share vocabulary and mechanics, just applied to different indexes.

## Source (`engine` agent owns)

- `functional-model/sink-derivation-status.ts` —
  `computeSinkDerivationStatus(root?: string): SinkDerivationEntry[]`. Pure
  function, no Nuxt/Nitro dependency, checks the real filesystem fresh
  every call (`root` defaults to `process.cwd()`, correct both inside a
  Nuxt server route and from a standalone script).

```ts
type SinkDerivationBaseline = 'gray' | 'purple' | 'blue';
type SinkDerivationColor = 'gray' | 'purple' | 'blue' | 'yellow' | 'green';

interface SinkDerivationExpectedShape {
  event: string;   // a SinkQuery/Fact-style event name, e.g. 'dies', 'zoneChange', 'untap', 'tap', 'exile'
  note: string;     // why this shape, in real-card terms
}

interface SinkDerivationEvidence {
  predicateModulePath: string;    // repo-root-relative path checked, e.g. "functional-model/sink-model/predicates/saga.ts"
  predicateModuleExists: boolean;
  corpusManifestPath: string;     // e.g. "functional-model/sink-model/predicates/saga.corpus.json"
  corpusManifestExists: boolean;
  corpusTotal: number;            // from the manifest, if present/parseable; 0 otherwise
  corpusPassing: number;
}

interface SinkDerivationEntry {
  key: string;      // = slug, stable identity — never reuse a retired slug for a different mechanism
  slug: string;
  label: string;
  motivation: string;                          // real-card evidence that motivated tracking this mechanism
  expectedSinkShapes: SinkDerivationExpectedShape[];
  baseline: SinkDerivationBaseline;
  evidence: SinkDerivationEvidence;
}
```

- `functional-model/sink-derivation-reviews.json` — flat, hand-edited (or
  written by `./review.post.ts`) map, checked in starting as `{}`, same
  shape as `functional-model/engine-status-reviews.json`:

```jsonc
{
  "saga": {
    "verdict": "confirm",           // or "reject"
    "note": "spot-checked against 3 Saga cards' real traces, all agree",  // required for "reject"
    "reviewedAt": "2026-09-20",
    "reviewedBy": "optional free text"
  }
}
```

## Served shape (`GET /api/sink-derivations`)

```ts
interface SinkDerivationSourceFiles {
  predicate: SourceFileResult;       // functional-model/sink-model/predicates/<slug>.ts
  corpusManifest: SourceFileResult;  // functional-model/sink-model/predicates/<slug>.corpus.json — RAW file content, including the real per-card `cases` array, not just the {total,passing} summary evidence already carries
  corpusTest: SourceFileResult;      // functional-model/sink-model/predicates/<slug>.test.ts
}

interface SourceFileResult {
  path: string;             // repo-root-relative path checked
  exists: boolean;
  content: string | null;   // real file text, or null if it doesn't exist yet (e.g. every field for stun-counters/finality-counters today)
  truncated: boolean;       // true if content was cut off at source-files.ts's MAX_INLINE_SOURCE_BYTES (none of today's 4 mechanisms' files are anywhere near this)
}

interface SinkDerivationPageEntry {
  key: string;
  slug: string;
  label: string;
  motivation: string;
  expectedSinkShapes: SinkDerivationExpectedShape[];
  baseline: SinkDerivationBaseline;   // unchanged by review
  evidence: SinkDerivationEvidence;
  sourceFiles: SinkDerivationSourceFiles;  // real, on-disk content for all 3 files — see below
  color: SinkDerivationColor;         // baseline, or yellow/green if reviewed — render/filter on THIS
  review?: { verdict: 'confirm' | 'reject'; note?: string; reviewedAt?: string; reviewedBy?: string };
}
```

### Real evidence (2026-09-18) — reading the actual predicate/corpus/test code

Added so a human reviewer can read the real predicate logic, the real
per-card corpus verdicts, and the real corpus test code — not just this
entry's own hand-authored `motivation`/`expectedSinkShapes[].note` prose.
`sourceFiles` is computed fresh every request (`functional-model/
source-files.ts`'s `readFunctionalModelFile`, same no-caching dev
convention as everything else on this axis), read-only and hard-scoped to
`functional-model/` — a request for a file outside that directory (or one
that doesn't exist, like all 3 files for `stun-counters`/
`finality-counters` today) comes back `{exists: false, content: null}`,
never an error and never content from anywhere else on disk.

Unlike the engine-status axis's own `GET /api/engine-status/source` sibling
route, this axis inlines full file content directly into the list response
instead of a separate fetch-per-file route — deliberately: each of the 4
seeded mechanisms' 3 files is small (low tens of KB combined, checked
2026-09-18) and, unlike `engine-status`'s citations, never shared across
multiple entries, so there's no duplication cost to avoid.

`GET /api/sink-derivations` returns `SinkDerivationPageEntry[]`, freshly
computed every request (dev convention, same as
`server/api/engine-status/index.get.ts` — no build-time caching; a newly
added predicate module/corpus manifest, or a hand-edited
`sink-derivation-reviews.json`, reflects on the next request with no
restart).

## Review write path

`POST /api/sink-derivations/review`, body `{ key, verdict: 'confirm' |
'reject' | null, note?, reviewedBy? }` -> `{ key, color }`. Dev-only (403 in
production, same posture as `engine-status`'s own review route). `verdict:
null` clears a review, falling back to the computed baseline. `key` is
validated against a **fresh** `computeSinkDerivationStatus()` call. A
`'reject'` verdict without a non-empty `note` is rejected with 400.

## How a new mechanism entry gets added later (the exact edit point)

This scaffold is meant to grow **one entry at a time** as real predicate
work lands on a new mechanism (beyond the 4 seeded today: `saga`,
`stun-counters`, `finality-counters`, `crew`). Adding one is a small,
self-contained edit, entirely inside `functional-model/sink-derivation-status.ts`:
append one object to the `SINK_DERIVATION_MECHANISMS` array (the file's own
top-level exported const) with `slug`, `label`, `motivation`, and
`expectedSinkShapes`. Nothing else needs to change — `computeSinkDerivationStatus()`
derives that mechanism's `predicateModulePath`/`corpusManifestPath` from its
`slug` automatically (the `functional-model/sink-model/predicates/<slug>.ts`
/ `<slug>.corpus.json` convention), and both API routes and this contract's
served shape stay the same. The new entry starts `gray` automatically (no
predicate module will exist for it yet) — no baseline needs to be set by
hand.

**Do not** speculatively pre-seed a mechanism here before it has a real,
named card gap behind it (mirrors `engine-status.ts`'s own "organic
growth, not a-priori enumeration" posture) — this axis is meant to track
real, already-identified work items, not a wishlist.

## What `ui` (consumer) must not assume

- **The entry COUNT will grow over time**, starting from exactly 4 — don't
  hardcode 4 anywhere, don't build a UI that assumes a fixed row count.
- **Every entry is `gray` today, for real** — this is not a broken/stub
  server response; no predicate work has landed yet for any of the 4
  seeded mechanisms.
- **`motivation`/`expectedSinkShapes[].note` are hand-authored prose, not
  curated one-line display strings** — may be long; wrap/truncate for
  display as needed, don't assume a fixed length.
- **`key` is `slug`, stable** — unlike `engine-status`'s `gap-<N>-<slug>`
  keys (where only the number prefix is guaranteed stable across a title
  reword), this axis's `slug` values ARE the stable identity; they're
  hand-chosen mechanism names, not derived from freeform doc-title text.

## What `engine` (producer) must not break

- `SinkDerivationEntry.key`'s value (`slug`) must stay stable once a
  mechanism is seeded — a review overlay is keyed on it; renaming a slug
  silently orphans any existing review for that mechanism.
- The `functional-model/sink-model/predicates/<slug>.ts` /
  `<slug>.corpus.json` path convention `computeSinkDerivationStatus()`
  derives from each mechanism's `slug` is load-bearing for
  `functional-model/sink-derivation-status.test.ts` — changing it without
  updating that test risks silently breaking the whole axis's baseline
  computation.
