# AI-fact-elimination process (functional-model/)

Runbook for an **orchestrator** session driving the multi-agent pipeline
that closes remaining AI-authored (hand-written, unprovenanced) Facts
across `functional-model/cards/*`, replacing them with recognizer-derived
facts wherever a real recognizer can cover them. Written 2026-09-16 after
the first proven cycle (fin/16-75). This is an orchestrator-only
coordination doc — the underlying fact/recognizer design itself lives in
`functional-model/PRD_AUTOMATED_AUTHORING.md`/`SYNERGY_DESIGN.md`, don't
duplicate that here.

## Check remaining backlog size (rerun anytime, numbers below are a snapshot)

```
node -e '
const fs = require("fs");
const path = require("path");
const dirs = fs.readdirSync("functional-model/cards");
let totalAi = 0, totalParser = 0, cardsWithAi = 0, totalCards = 0;
for (const d of dirs) {
  const p = path.join("functional-model/cards", d, "synergy.json");
  if (!fs.existsSync(p)) continue;
  totalCards++;
  let data;
  try { data = JSON.parse(fs.readFileSync(p, "utf8")); } catch { continue; }
  const arr = [...(data.source||[]), ...(data.sink||[])];
  let aiCount = 0;
  for (const f of arr) {
    if (f.provenance && f.provenance.origin === "parser") totalParser++;
    else { totalAi++; aiCount++; }
  }
  if (aiCount > 0) cardsWithAi++;
}
console.log({totalCards, totalAi, totalParser, cardsWithAi});
'
```

Snapshot 2026-09-16 (mid-session, after fin/16-75 + the static-ability
audit): 750 AI facts remaining across 260/323 cards (664 parser-derived).
Started the day at 808/268. Expect this to keep dropping as recognizer
work lands pool-wide, not just per-batch — rerun before assuming staleness.

## The 4 lanes

All 4 are dispatched as the `engine` subagent type (per `.claude/agents/`)
with a narrowed prompt — there's no separate agent *definition* per lane,
just a different scope/onboarding-doc per dispatch.

- **engine-core** (singleton — only run one at a time). Owns core engine
  files (`engine.ts`/`state.ts`/`card.ts`/`mana.ts`/`layers.ts`/`sba.ts`/
  `stack.ts`/`triggers.ts`/`saga.ts`/`combinator.ts`/etc) + `ENGINE_GAPS.md`.
  Builds new engine capability/vocabulary ONLY on escalation from another
  lane — doesn't go looking for card-level work itself.
- **recognizer** (singleton — only run one at a time). Owns
  `functional-model/recognizers/*`, `scripts/apply-recognizers.mjs`,
  `recognizers/types.ts`, `server/api/recognizer-source/[rule].get.ts`.
  Builds/extends narrow structural recognizers. Escalates to engine-core
  when a recognizer needs an engine capability that doesn't exist yet.
- **definition** (many, one per card or small card group — assign
  disjoint slugs to run in parallel safely). Owns only
  `cards/<slug>/definition.ts` + `scenarios.ts` for its assigned cards.
  Writes/fixes the `CardDefinition` against real Forge (primary) / XMage
  (secondary) text, using ONLY existing engine + combinator vocabulary.
  Escalates to engine-core when a mechanic has no vocabulary at all —
  never invents new vocab itself.
- **card-results** (many, one per card batch — assign disjoint slugs).
  Owns nothing but read access everywhere; its writes are thin:
  `progress.json` review/provenance state + triggering
  `apply-recognizers.mjs`/`verify-*` scripts (which regenerate
  `synergy.json`/`trace.json`, expected). Triages remaining AI facts /
  inert `staticAbilities` text per card into: (a) recognizer-closable,
  (b) definition incomplete-or-wrong, (c) genuinely bespoke (loud-flag,
  named reason, same bar `ENGINE_GAPS.md` already holds itself to),
  (d) no functional-model dir yet. Never hand-authors a fact itself.

## Coordination model

Subagents can't message each other directly (no `Agent`/`SendMessage` tool
on the `engine` specialist type) — the orchestrator is the hub. Anything a
lane needs from another lane gets flagged back to the orchestrator, who
routes it. This is deliberate, not a workaround: keeps escalations visible
and lets the orchestrator dedupe (e.g. two lanes independently finding the
same cross-cutting gap).

Read access is unrestricted for every lane (other cards, `tmp/mtg-forge`,
`tmp/xmage`). Write access is fenced per lane as described above — enforced
by prompt instruction, not a tool-level ACL, so state it explicitly in
every dispatch.

**File-collision rule**: only ever run ONE engine-core and ONE recognizer
agent at a time (they both touch small, shared, easily-colliding file
sets). Many `definition`/`card-results` agents can run in parallel *with
each other* and *with* a single engine-core/recognizer agent, as long as
their assigned card slugs don't overlap.

## Typical cycle

1. Orchestrator dispatches a `card-results` batch (≈25 cards) to triage.
2. Orchestrator fans out findings: (a) items → `recognizer` lane, (b)
   items → `definition` lane. Both can run in parallel with each other and
   with the next `card-results` batch (no file overlap) — but check
   whether a fresh triage would just rediscover a gap already known to be
   pool-wide before spending another batch on it (this happened: fin/51-75
   surfaced 2 recognizer gaps — bare `sacrifice`/`discard` effects — that
   would have resurfaced identically in every later batch had recognizer
   work not landed first).
3. Recognizer/definition agents report back, often closing MORE cards than
   the batch that surfaced the gap (recognizers are pool-wide by nature).
4. (c) bespoke items get written into `ENGINE_GAPS.md` by whichever lane
   found them — never silently dropped, named reason required.
5. Re-triage the original batch (or just check `synergy.json`'s
   provenance) once recognizer/definition work lands, since some AI facts
   may now auto-resolve to parser-derived without further work.

## Test-scope policy (keep the full suite rare)

- **engine-core**: only its own touched engine test file(s) per change.
  Full `npx vitest run functional-model` + `tsc --noEmit` only for a
  shared-type/interface change, a `coreKey`/merge-logic change, or right
  before its final report.
- **recognizer**: its own recognizer test file(s) + a scoped
  `apply-recognizers.mjs` pass day-to-day; a FULL pool `apply-
  recognizers.mjs` run is still required before reporting (recognizer
  changes are pool-wide by construction, can't be scoped away) along with
  the full `vitest run functional-model` + `tsc`.
- **definition**: scoped checks for its own card(s) only, day to day. Full
  suite only if it touched something beyond its assigned cards
  (shouldn't happen).
- **card-results**: no test suite runs at all — just
  `apply-recognizers.mjs`/`verify-synergy.mjs`/`verify-annotation-
  coverage.mjs` scoped to its own batch.

Full-repo `npx vitest run` reserved for a change that's genuinely
cross-cutting (shared engine file, recognizer infra, coreKey) — not
routine per-card work.

## Timing convention

Every dispatch asks the agent to run `date -u` once at task start and once
right before its final report, and state both + elapsed. Orchestrator
keeps a running per-lane sense of cost from these (see timings below) —
this is how the bottleneck lane gets identified, not fine-grained
per-subtask instrumentation.

Observed so far (first full cycle, 2026-09-15/16):
- card-results triage (25 cards): ~12 min
- recognizer backlog build (6 new + 3 widened recognizers): ~43 min
- definition single-card migration: ~18 min
- engine-core (5 new vocab items + fixes + 6 card migrations as proof): ~22 min
- engine-core small follow-ups: 2-8 min each

## Known script gotchas (learned the hard way, don't relearn)

- `run-scenarios.mjs` requires `--slug=<slug>` or `--all` and **hard-fails**
  otherwise (hardened 2026-09-16 — it used to silently run a full-pool
  regeneration on a bad/missing arg, which bit two different agents by
  renumbering every card's shared object-ID counter in `trace.json`).
- `apply-recognizers.mjs` / `verify-synergy.mjs` / `verify-text-
  coverage.mjs` take a **bare positional** slug arg, NOT `--slug=`.
- `verify-annotation-coverage.mjs` has **no per-slug arg** — full-pool
  only (cheap, read-only, fine to run every time).
- If a full-pool regeneration ever does happen by accident: do **NOT**
  `git checkout`/blanket-revert the touched files to "undo" it — other
  lanes' in-flight uncommitted work can be sitting in those same files.
  Recover via targeted per-slug regeneration instead (diff first).
- `apply-recognizers.mjs`'s `coreKey` sorts object keys but (until the
  2026-09-16 fix) never sorted array element order — semantically
  identical `types.has`/`hasAny`/`not` arrays in different real-text word
  order could hash to different coreKeys and produce spurious duplicate
  facts. Fixed, but a cautionary tale for anyone touching `coreKey` again.
- **Combinator DSL (`combinator.ts`, `kind:'program'`) is the project's
  default over raw `kind:'custom'` closures** — check `Sequence`/`Query`/
  `EachAction` vocabulary before reaching for `custom`. A `custom` closure
  is opaque to recognizers (can never become parser-derived); `program`/
  `Sequence` is recognizer-readable — proven directly (Jill's migration
  flipped 4 facts from unprovenanced to real recognizer provenance with
  zero behavior change, just by changing the authoring shape).

## Per-card dashboard status (2026-09-16, separate task — feeds a future FIN dashboard page)

A REAL, permanent, fully-derived-every-run 8-bucket status per FIN card —
`red`/`orange`/`green`/`yellow`/`gray`/`verified`/`uncertain`/`re-review` —
built to answer "how far along is
this card's functional-model authoring?" at a glance, distinct from (and
complementary to) this doc's own AI-fact-backlog counting above. Not a
one-off snapshot script: rerun it any time the pool changes (recognizer
work, a `definition` migration, a `card-results` triage) and it reflects
current reality, same "derived, never hand-maintained" discipline
`SET_STATUS.md`/`tagging/card-enrichment-status.json` already establish for
a different per-set status.

- **Logic**: `functional-model/card-status.ts` — pure, no fs, exports
  `classifyCardStatus()` (the 8-bucket decision) + `findUnsupportedConstructs()`
  (the `red` check) + `collectEffects()`/`isUnsupportedNoOp()` (its own
  helpers). See that file's own header for the full priority-order
  rationale (in particular why `gray` is checked BEFORE `orange`/`green`/
  `yellow` despite being bucket #5 in the originating task spec — a 0-fact
  card would otherwise vacuously read as a deceptively-clean `yellow` —
  and why `verified` (2026-09-16) is a NARROWING of `green` rather than a
  separate top-level branch).
- **Orchestration**: `functional-model/scripts/compute-card-status.mjs` —
  dynamically imports every `cards/<slug>/definition.ts`, reads every
  `synergy.json`, resolves real Scryfall oracle text, calls
  `text-coverage.mjs`'s `computeTextCoverage`, then `classifyCardStatus`
  once per in-scope FIN card. Run via **`npm run card-status`**
  (`vite-node functional-model/scripts/compute-card-status.mjs`) — same
  `npm run set-status` precedent for "a derived artifact, regenerate on
  demand, don't hand-edit."
- **Output**: `data/fin/fin_card_status.json` — `{ generatedAt, set,
  cards: [{ number, name, status, reasons }] }`. Checked in (not
  gitignored), timestamped — treat it as "as of `generatedAt`," never as a
  guaranteed-current baseline, the same way this doc's own "Check remaining
  backlog size" snapshot above already has to be re-run rather than trusted
  stale.
- **Bucket definitions** (mechanically checkable, no judgment calls):
  1. `red` — `definition.ts` (either face) has a real `kind:'custom'`
     effect whose `run` is a literal, empty no-op (`findUnsupportedConstructs`)
     — this pool's own established convention for "no declarative `Effect`
     shape exists for this yet" (confirmed pool-wide 2026-09-16: ~28 real
     current cases, e.g. `galuf-s-final-act`'s "no Effect kind exists...
     for granting a new triggered ability"). Deliberately does NOT also
     check `unsupportedCostComponent` (`engine.ts`) — investigated and
     explicitly excluded: several real hits there are false leads for this
     purpose (Vehicle "Crew N" cost text duplicated into `abilities[].cost`
     alongside the real, separately-modeled `crewCost` field; Garland,
     Knight of Cornelia's own cost string is missing the parens around
     "Activate only as a sorcery" every sibling card has; Blitzball's own
     ability-name label "GOOOOAAAALLL! —" leaks into its cost string) —
     real, worth a follow-up cleanup pass (flagged for `definition`/
     `engine-core`), but too noisy to fold into this automated bucket as-is.
  2. `gray` — no functional-model dir for this card, OR `definition.ts`
     exists but `synergy.json` was never generated, OR `synergy.json` has 0
     facts total (source+sink both empty) — the same "not yet authored"
     signal `verify-synergy.mjs`'s own `isV2Shaped` already established.
  3. `orange` — >=1 fact (either face, source or sink) with
     `provenance?.origin !== 'parser'` — same check this session's own ad
     hoc grep (and this doc's "Check remaining backlog size" query above)
     already uses.
  4. `green`/`yellow` — every fact IS `provenance.origin === 'parser'`;
     split on `computeTextCoverage`'s own `gaps.length` (0 = green, >0 =
     yellow) — deliberately NOT the raw `ratio` (can read <100% even with
     zero real substantial gaps, due to reminder-text/punctuation
     stripping) — `gaps` is `text-coverage.mjs`'s own authoritative "real,
     substantial, uncovered clause" signal.
  5. `verified` — a NARROWING of the `green` result above, not a separate
     top-level check: when the above would produce `green` AND the card's
     own `progress.json` has `review: 'human'` (threaded into
     `classifyCardStatus`'s `review` input by `compute-card-status.mjs`),
     the status is upgraded to `verified` instead. Never applies to
     `yellow`/`orange`/`red`/`gray`, even with `review: 'human'` set —
     only a genuinely clean `green` card can become `verified`.
- **Known accepted blind spot**: a construct documented ONLY in a code
  comment, with no `custom` no-op placeholder at all (`white-mage-s-staff`'s
  own granted-triggered-ability gap, e.g. — "no vocabulary/pipeline
  anywhere in this model grants a WHOLE NEW triggered ability... to
  another permanent," stated only in a comment beside `staticAbilities`,
  never wrapped in a `custom` effect) is NOT caught by the `red` check —
  no structural, non-judgment-call marker exists for that sub-case. Not
  silently claimed as covered; that card falls through to whichever of the
  other 5 buckets its real facts land in instead.
- **Does not write to any `progress.json`** — deliberate: several were
  mid-edit by a concurrent session at build time, and per-card mutation
  isn't needed anyway (this script's own output already IS the single
  source of truth, safe to rerun as often as the pool changes).
- Tests: `functional-model/card-status.test.ts` (pure-logic unit tests,
  `npx vitest run functional-model/card-status.test.ts`).

## Onboarding docs (point new lane agents here, don't re-explain in the dispatch prompt)

- `functional-model/CARD_DEFINITION_QUICKSTART.md` — definition lane.
- `functional-model/CARD_RESULTS_QUICKSTART.md` — card-results lane.
- `functional-model/PRD_AUTOMATED_AUTHORING.md` — recognizer lane + the
  overall design (also worth engine-core's own familiarity).
- `.claude/agents/engine.md` + `.claude/agents/SHARED.md` — engine-core,
  and universal specialist rules all 4 lanes should know regardless.
- `functional-model/scripts/forge-lookup.mjs` — card name → real Forge
  (primary) / XMage (secondary) source lookup. Use instead of manually
  grepping `tmp/mtg-forge`/`tmp/xmage` every time.

## History

- 2026-09-15: fin/16-25 and fin/26-50 closed via single-agent sweeps
  (pre-split — one agent did triage + recognizer-building + definition
  fixes all itself, serially).
- 2026-09-15/16: fin/51-75 piloted the 4-lane split. Found 2 pool-wide
  recognizer gaps (bare `sacrifice`/`discard` effects, ~26 real cards
  combined) that a single-agent-per-batch approach would have rediscovered
  independently in every later batch. Drove 5 new engine-vocab additions
  (`gainControl`, combinator `untap`/`grantKeyword`/`equip` actions,
  `untapTarget:'attacking'`, `drawCard.optional`). Also hardened
  `run-scenarios.mjs` and fixed the `coreKey` array-order bug.
- Next: re-triage fin/26-50 through the new split (several cards were left
  partial/deferred under the old single-agent approach, and new pool-wide
  recognizer work may auto-close some without further effort) — see
  "Check remaining backlog size" above for current numbers before
  assuming a card is still stuck.
