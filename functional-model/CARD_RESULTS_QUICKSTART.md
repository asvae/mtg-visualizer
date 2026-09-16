# Card-results quickstart (card-results lane)

You take a batch of cards through recognizer/synergy verification and
close out their `progress.json` review/provenance state. You run the 3
verify scripts below, check any remaining AI-authored (non-recognizer)
facts against real card text, and finalize status — you **never
hand-author a Fact yourself**. This doc is deliberately narrow: deep
`card.ts`/engine internals are out of scope for this lane — see
`CARD_DEFINITION_QUICKSTART.md` for that side (the **definition** lane
owns `definition.ts`/`scenarios.ts` content itself; you consume its
output, you don't rewrite it).

## Ground truth: Forge primary, XMage secondary

When checking whether a remaining fact matches real card text, never rely
on memory:

- **`tmp/mtg-forge`** (real, git-ignored checkout under this project's own
  `tmp/`) is the sole primary source. Real scripts:
  `tmp/mtg-forge/forge-gui/res/cardsfolder/<a-z>/<normalized_name>.txt`.
- **`tmp/xmage`** (same convention) is a secondary cross-check only.
- Use **`npx tsx functional-model/scripts/forge-lookup.mjs "<card name>"`**
  instead of hand-grepping either checkout.
- If both are missing, check for a real Forge install before falling back
  to trained-knowledge guesses (found on this machine at
  `/mnt/c/Games/ForgeInstaller`, WSL, `res/cardsfolder/cardsfolder.zip`).

## The Fact/provenance model (just enough to judge coverage)

A card's `synergy.json` (`functional-model/cards/<slug>/synergy.json`) is
a **generated artifact** — produced by running recognizers
(`functional-model/synergy.ts` + `recognizers/*`) against that card's real
execution trace (`trace.json`, also generated, from `definition.ts` +
`scenarios.ts`). You don't hand-edit either JSON file directly; you
regenerate them by running the pipeline, then judge the result.

Each synergy record is (or should be) a `Fact`:

```ts
interface Fact {
  role: 'source' | 'sink';   // per-row icon on the card page; never a section split
  label: string;             // bare category name, e.g. "Dying" — no who/type detail baked in
  annotation: AnnotationRef[]; // at least 1 required — see below
  provenance?: FactProvenance; // PRESENT = recognizer-derived; ABSENT = hand/AI-authored
}

interface FactProvenance {
  origin: 'parser';
  rule: string;   // which recognizer produced it, e.g. 'landfall', 'ptFormula-scalingPump'
}

type AnnotationRef =
  | { kind: 'oracle'; line: number; offset: number }   // real Oracle-text line+char offset
  | { kind: 'typeLine'; offset: number };               // offset into the type line instead
```

**The single rule that matters for this whole lane: `provenance` present
== trustworthy (a real recognizer matched a real trace event to real
card text, deterministically). `provenance` absent == somebody (a human
or an earlier AI pass) typed that fact in by hand/judgment — it has NOT
been verified against real text/trace and must be treated as suspect
until closed one of the three ways below.**

Facts must be recognizer-derived — never hand-restore or infer a fact
from git history or your own judgment. If a recognizer can't currently
produce a fact you believe is real, that's a gap to close via a new/fixed
recognizer (recognizer lane), not something to type in yourself.

### `progress.json` — advisory only, don't over-trust it

Per-card `progress.json` fields you'll touch: `enrichment`, `review`,
`verifySynergy`, `lastVerified`, `notes`, `textCoverageAudited`,
`knownGaps`. Per `card-schema.md`'s own words, this file is **advisory,
not guaranteed-accurate** — it has been found stale multiple times this
project (13 stale entries fixed in one earlier sweep). Don't assume a
card's `review`/`verifySynergy` flag reflects current reality; your own
verify-script runs are the actual ground truth for a batch, this file is
just where you record the outcome once you've actually checked.

### Text coverage (stronger than plain annotation coverage)

`factsTextCoverage` (computed by `text-coverage.mjs` /
`verify-text-coverage.mjs`) is a real, computed ratio of how much of a
card's own Oracle+type text is accounted for by an actual Fact
annotation — separate from, and a stronger check than, plain "does every
fact have >=1 annotation" coverage. A card can pass plain annotation
coverage while still having real, unaccounted-for clauses of its own
printed text; this script is how you catch that gap. `knownGaps` records
a deliberate, already-triaged exception (e.g., a clause with genuinely no
possible recognizer today) — don't add to it casually; if you find a
new real gap, that's an escalation, not a `knownGaps` entry you write
yourself.

## The 3 verify scripts

Run these against your batch (a slug or set of slugs), not the whole
pool, day to day — see test-scope policy below.

```bash
# Regenerate/re-check synergy.json from the current recognizer set + this
# card's trace.json. Takes plain POSITIONAL slug args (one or more), NOT
# --slug=. A DIFF here after a recognizer-lane fix means facts changed —
# read the diff, don't just accept it blind.
npx tsx functional-model/scripts/apply-recognizers.mjs <slug>

# Cross-check every synergy.json entry against its own trace.json + card
# text: catches a fact whose annotation no longer matches real text, a
# duplicate, a missing provenance where one should exist, a recognizer
# mismatch. A FAILURE here is a real problem, not a warning to skip —
# it's the project's hard-fail-on-ambiguity discipline in action. Also
# positional slug args, not --slug=.
npx tsx functional-model/scripts/verify-synergy.mjs <slug>

# Checks every Fact has >=1 valid AnnotationRef pointing at real text
# (oracle line+offset, or typeLine offset) that actually resolves.
# Failure = a fact's annotation is broken/stale — needs an actual fix,
# never a silently-dropped annotation. NO slug filter at all — this one
# always walks the whole `cards/` pool and is invoked with plain `node`,
# not `tsx` (no TS import inside it). Read its own violation list for
# just your batch's slugs rather than expecting a scoped run.
node functional-model/scripts/verify-annotation-coverage.mjs

# Stronger, informational-only companion check (still worth running):
# reports the real text-coverage ratio + any known/unknown gap list.
# Positional slug args again, not --slug=.
npx tsx functional-model/scripts/verify-text-coverage.mjs <slug>
```

## Verified-snapshot regression guard (run after touching recognizers/definitions)

A card whose `progress.json` `review` field has been flipped `'ai'` ->
`'human'` (the card page's own review-confirm button,
`server/api/card/review-status.ts`) gets a **physical, structural**
baseline frozen at that moment: `cards/<slug>/verified-snapshot.json`
(that card's then-current `synergy.json` `source`/`sink` facts, plus its
`progress.json`'s own `annotatedNonFactSpans` if any — never
hand-authored, never regenerated except by re-confirming review). See
`.claude/contracts/card-schema.md`'s own "Verified-snapshot regression
guard" section for the full shape.

```bash
# Real, whole-pool deep-equality diff of every cards/<slug>/verified-
# snapshot.json against that card's CURRENT synergy.json/progress.json —
# no slug filter, no TS import, plain `node` (not tsx/vite-node). A
# mismatch prints a clear old-vs-new report per changed fact; a mismatch
# on a card whose `review` is STILL 'human' additionally auto-resets that
# field back to 'ai' right here (the physical backstop for "review resets
# on change" — never left to someone remembering by hand) and is flagged
# more severely in the output. Exit code 1 if anything mismatched.
node functional-model/scripts/check-verified-regressions.mjs
```

Already wired as an automatic last step of `apply-recognizers.mjs`'s own
run (full pool, regardless of what slugs that run itself was scoped to —
this diffing is nearly free next to the recognizer/engine work above), so
you don't usually need to run it separately after a normal
`apply-recognizers.mjs` pass — but run it standalone any time you've
touched a recognizer/definition/annotation-computation script by some
OTHER path (e.g. `compute-annotations.mjs`, a hand-edit) that doesn't
already go through `apply-recognizers.mjs`.

**Watch the exact arg shape per script — this project has already hit a
real bug from assuming a uniform `--slug=` convention.** `apply-
recognizers.mjs`, `verify-synergy.mjs`, and `verify-text-coverage.mjs` all
take **plain positional slug arguments** (`<script> slug-one slug-two`),
not `--slug=`; passing `--slug=x` to any of these silently no-ops (it's
read as an unrecognized/ignored value, not an error) rather than failing
loudly — always sanity-check that a positional invocation actually
narrowed to your batch (e.g. eyeball the printed card count) rather than
trusting the command looked right. `verify-annotation-coverage.mjs` takes
**no slug argument at all** — always whole-pool, invoked with plain `node`
(no TS import, no `tsx` needed). This lane doesn't normally call
`run-scenarios.mjs`/`run-one-card.mjs` itself (that's the definition
lane's own doc) — but if you ever do, `run-scenarios.mjs` is the ONE
script in this whole toolchain that takes `--slug=` (never a positional
arg, unlike the three above) and, as of 2026-09-16, HARD-FAILS if you pass
neither `--slug=<slug>` nor an explicit `--all` (it used to silently fall
through to a full-pool run on a bare/missing arg — the exact mistake that
prompted this hardening). Check a script's own top-of-file `// Usage:`
comment before assuming any one convention carries over to another script
— this toolchain genuinely has 3 different arg shapes across 5 scripts,
not 1 uniform convention.

**Any dynamic-import script in this project must be invoked via `npx tsx
<script>`, never bare `node`** — some in-repo header comments still say
`vite-node`; `tsx` is the actual standing, working convention for this
entire project as of this session — don't "fix" those old comments as
part of this lane's own work, just don't follow them literally.

## What a result means, concretely

- **`apply-recognizers.mjs` produces no facts for a real clause you can
  see in the card's own Oracle text** → that clause has no recognizer yet.
  Escalate — this is the "recognizer-closable" path (see below), not
  something for you to hand-author around.
- **A fact exists WITHOUT `provenance`** → hand/AI-authored, unverified.
  For each one: check the real card text (`forge-lookup.mjs`) and the
  card's own `definition.ts`/`trace.json`. Three possible outcomes:
  1. A recognizer SHOULD be able to produce this deterministically (the
     underlying trace event/shape already exists) → **recognizer lane**
     escalation: name the exact clause, the exact fact you'd expect, and
     why an existing/near-existing recognizer should cover it.
  2. The underlying `definition.ts` doesn't actually MODEL this clause at
     all (missing effect/trigger/grant), or models it wrong (wrong
     shape/field vs. real Forge text) → **definition lane** escalation:
     name the exact clause, the exact real Forge line, and what's
     missing/wrong in the current definition.
  3. The clause is genuinely bespoke/one-off in a way no recognizer
     pattern could reasonably generalize to (rare — most things fit
     family #1 or #2) → flag to the **orchestrator** directly with your
     reasoning for why it's not closable through the other two lanes.
  You do not resolve any of these three yourself by typing in a
  hand-verified fact — verifying by eye that a hand-authored fact "looks
  right" is not the same as it being recognizer-derived, and this project
  has explicitly rejected that shortcut.
- **`verify-synergy.mjs`/`verify-annotation-coverage.mjs` fail clean
  (exit 0, no findings)** → this batch's synergy data is consistent;
  record it in `progress.json` (`verifySynergy: true` / update
  `lastVerified` to today's real date) and move on.

## Review status resets on content change

Any change that actually changes a card's authored content resets its
review flag from `"human"`/`"ai"` back to `"ai"` — a stale "reviewed" flag
surviving a real content change must never happen. This applies to you
too: if closing out a fact required a `definition.ts` fix (routed through
the definition lane) or a recognizer fix, the card's `review` field
should reflect "ai" again afterward, not whatever it said before your
batch touched it. Don't hand-set `review` to `"human"` yourself under any
circumstance — that comes from an actual human review pass, never from
this lane's own verification work.

## Escalation paths — the three lanes

1. **Recognizer lane** — a fact/clause that a new or adjusted recognizer
   rule should be able to produce deterministically from the existing
   trace shape. Give: the card, the exact clause, the trace event(s) you'd
   expect it to match on.
2. **Definition lane** — the underlying `definition.ts`/`scenarios.ts`
   doesn't model the clause at all, or models it in a way that doesn't
   match real Forge text (wrong field, missing trigger, wrong formula
   variant, etc). Give: the card, the exact real Forge line
   (`forge-lookup.mjs` output), what's missing/wrong.
3. **Orchestrator directly** — genuinely bespoke, not closable by either
   lane above (rare). Give: the card, the clause, and your reasoning for
   why it doesn't fit #1 or #2.

Never invent a 4th path (e.g., don't just leave an unresolved
non-provenance fact silently in place, and don't quietly delete a fact
instead of escalating why it's wrong).

## Test-scope policy

Day to day, scope every script call to your own batch (a positional
slug arg where supported — see the exact-arg-shape note above;
`verify-annotation-coverage.mjs` has no such option) rather than the
whole pool. Full `npx vitest run
functional-model` and a full-repo `npx vitest run` (expect only the 5
pre-existing unrelated `tagging/sets/{lea,leb,2ed,arn}`/
`card-enrichment-status.json` failures to remain) are for a
substantial/shared-file change or right before your final report — not a
per-card habit. A full-pool `apply-recognizers.mjs` run is warranted only
when a recognizer itself changed (rare for this lane — that's the
recognizer lane's own job to run after its own change, not yours to
re-run speculatively).

## Timing bracket

Run `date -u` once at the start of your task and once right before your
final report; include both timestamps + elapsed time in that report.
