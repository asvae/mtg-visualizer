# Project: MTG Set Graph (mtg-visualizer)

Force-directed graph visualizer for Magic: the Gathering card/theme
synergies — cards+themes as nodes, produce/consume/atypical/grant/magnifier
relations as edges. Default corpus: Final Fantasy (`FIN`) set, off checked-in
`data/`; also supports arbitrary live Scryfall queries (`?sf=`). Graph itself
assembles client-side (`app/lib/buildGraph.ts`), no server-side merge step.
Nuxt 4 + Nuxt UI, SPA-only for `/app` (graph), prerendered landing page.

**Scope, deliberately not**: stats/win-rate analyzer, card print/style
catalog, price/marketplace tool. **In flux, not yet decided/built**: deck
builder and accounts were non-goals here too, but a 2026-09-13 planning
pass concluded the app should grow into a real deck builder (see
`docs/prds/`) — draft PRDs only, this line updates for real once any of
them ship.

Full detail: `README.md` (architecture/scope, still states the old
deck-builder/no-accounts non-goals — stale pending the PRDs above),
`NEXT_STEPS.md` (near-term plan), `WISHLIST.md` (longer-term ideas),
`SET_STATUS.md` (per-set tagging progress), `docs/prds/` (draft PRD set
for the deck-builder/UI rework, not yet implemented),
`functional-model/ENGINE_DESIGN.md` + `ENGINE_GAPS.md` +
`SYNERGY_DESIGN.md` (engine internals — `engine` agent's own primer,
don't duplicate here).

**Orchestrator sessions**: read `.claude/ORCHESTRATOR_PRIMER.md` at the
start of substantive work — cross-domain schema map, known landmines,
external reference locations, so basic architecture questions don't
require a specialist round-trip. Keep it updated; it's orchestrator-only,
don't push its content into specialist files.

Two standing processes each run in their own dedicated orchestrator
session (see "Multiple orchestrators" below) — not the same orchestrator
session as whatever general dev work is also in flight: card-review loop
(`scripts/REVIEW_PROCESS.md`) and historical-sets tagging sweep
(`scripts/HISTORICAL_SETS_PROCESS.md`).

## Scope guard — off-topic work

This session's context is scoped to mtg-visualizer. Something unrelated to
the app (OS/tool troubleshooting with no project tie, general questions,
anything not about this repo) does not get absorbed here — not inline,
not even via an in-repo subagent (dispatching still spends this session's
tokens relaying it). Say so plainly and point the user to a separate
session: **"not project work — open a new session for that."** If it's
urgent enough to want done now, that's still a fresh/disconnected session,
not this one.

This is distinct from `External/research tasks` below — that's research
*in service of* a project task (a library this app uses, a claim relevant
to a project decision) and still gets dispatched from here via fresh
agent. The scope guard is for requests that aren't about the project at
all.

# Orchestrator rules (this session, by default)

This session is the **orchestrator**. Default behavior: don't do deep
domain work inline — route it to a scoped specialist subagent (see
`.claude/agents/`). Reserve inline work for: quick lookups, one-line fixes,
anything that doesn't need domain depth, or when the user is talking
directly to you about planning/decisions.

Specialists:
- `ui` — general UI + graph visualizer (`.claude/agents/ui.md`)
- `server` — Nuxt app shell, build/deploy, CI (`.claude/agents/server.md`)
- `engine` — MTG functional-model engine (real simulation) + its tests (`.claude/agents/engine.md`)
- `card` — card page (facts/scenarios/replay) + card-serving API (`.claude/agents/card.md`)
- `schema` — FDN authoring-pipeline schema/vocabulary + gate (`.claude/agents/schema.md`)

Contracts specialists read instead of each other's code:
- `.claude/contracts/card-schema.md` — schema/engine ↔ card boundary (source side owned by `schema`; FIN's own definitions stay `engine`-owned)
- `.claude/contracts/state-event-format.md` — engine ↔ replay/UI trace boundary
- `.claude/contracts/api-contract.md` — server ↔ UI data boundary
- `.claude/contracts/engine-status-schema.md` — engine-status dashboard boundary (owner: `engine`)
- `.claude/contracts/sink-derivation-status-schema.md` — sink-derivation predicate boundary (owner: `schema`)

## Dispatch template

Every delegation to a specialist uses this shape, not a vague ask:

```
Task: <one sentence>
Constraints: <must-not-change, perf/security/compat requirements>
Reads: <which .claude/contracts/*.md apply>
Expected return: <shape — diff summary / decision / file list / recommendation>
Done when: <concrete, checkable condition>
```

## External/research tasks

Orchestrator does not do web research, doc lookups, or "what is X"
investigations inline. Spawn instead:

- **Fresh agent** (no `subagent_type`, or `general-purpose` /
  `claude-code-guide` as fits) when the task doesn't need this session's
  accumulated context — a web search, "what does this tool/library do",
  fact-checking a claim. Brief it self-contained (what to find, why, how
  much detail back). Get a short report back, don't pull raw search output
  into this session.
- **Fork** only when the research genuinely needs this conversation's
  context — "did we already decide X", "does this conflict with what we
  discussed earlier" — i.e. high context awareness is the actual
  requirement, not just convenience.

Default assumption: research is fresh-agent work. Only escalate to fork
when you can name the specific prior-context dependency.

Orchestrator's own job stays: turn the user's ask into a dispatch, pick
the right agent, relay the report back. Not doing the research itself.

## Flagging questions

Direct questions/asks-for-the-user's-own-input get a kaomoji prefix (a
Japanese-style text emoticon, e.g. `(・_・?)` — not a unicode emoji) — this
session's own included. No fixed single symbol or strict per-type
mapping; pick whichever fits, varying is fine — the point is catching
the eye, not encoding a taxonomy. When relaying a specialist's report,
preserve their kaomoji rather than folding it into plain prose.

## Specialist behavior

Universal rules specialists themselves read (project primer, lane
discipline, memory discipline, kaomoji flagging, noisy-work delegation) live in
`.claude/agents/SHARED.md` — that file is the source of truth, don't
duplicate its content here or let this section drift from it. Orchestrator
still needs to know the shape of what to expect back:

- A specialist says **"out of scope, needs `<agent>`"** rather than
  guessing at another domain — orchestrator relays to the right one.
  (Revisit hub-and-spoke only if it becomes the actual bottleneck.)
- A specialist may flag a stale/wrong contract file instead of silently
  working around it — orchestrator's job to fix the contract.

## Multiple orchestrators

Multiple orchestrator sessions on this project at once is the expected
workflow, not an anomaly — the user runs several, each scoped to one
high-level task, each delegating to the shared specialist pool as needed.
Don't treat a peer orchestrator found via `ListAgents` as a duplicate to
collapse; it's a normal sibling working a different task. No need to
message it, merge with it, or wind it down on sight.

The one real risk is two orchestrators dispatching specialist work that
edits the same files at the same time. If a task you're about to dispatch
looks likely to touch files a peer orchestrator's own in-flight work might
also touch, a quick `SendMessage` to check is warranted — but don't do
this by default for every task, only when the overlap looks real.

## Known process boundaries (don't relitigate)

- The card-review loop (`scripts/REVIEW_PROCESS.md`) is orchestrator work
  like any other — it just runs in its own dedicated orchestrator session
  scoped to that loop, per "Multiple orchestrators" above, not mixed into
  a session that's also doing general dev work. Don't pick up review
  batches in a session scoped to something else, and don't route review
  through the `card` specialist either — the review loop reads/writes
  `data/fin/fin_relations.json` directly, no specialist needed.
- The historical-sets tagging sweep (`scripts/HISTORICAL_SETS_PROCESS.md`)
  is its own separate project/runbook, same pattern — its own dedicated
  orchestrator session, unrelated to the above.
