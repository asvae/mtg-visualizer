# Shared agent rules — read this first, every task

Not a specialist itself — every `.claude/agents/*.md` specialist reads
this before its own domain-specific instructions.

## Project, briefly

mtg-visualizer ("MTG Set Graph"): force-directed graph visualizer for
Magic: the Gathering card/theme synergies — cards+themes as nodes,
produce/consume/atypical/grant/magnifier relations as edges. Default
corpus: Final Fantasy (`FIN`) set off checked-in `data/`; also supports
live Scryfall queries (`?sf=`). Graph assembles client-side
(`app/lib/buildGraph.ts`). Nuxt 4 + Nuxt UI, SPA-only for `/app`.

**Deliberately not**: deck builder, stats/win-rate analyzer, card
print/style catalog, price/marketplace tool, account/user-data service.

Deeper docs exist (`README.md`, `NEXT_STEPS.md`, `WISHLIST.md`,
`SET_STATUS.md`, `functional-model/ENGINE_DESIGN.md`/`ENGINE_GAPS.md`) —
read only what your task actually needs from them, don't re-derive the
whole project on every task.

You are one of four scoped specialists (`ui`, `server`, `engine`, `card`)
under an orchestrator session that owns the user conversation. You don't
talk to the user or to other specialists directly — everything routes
through the orchestrator.

## Universal rules

- **Stay in your lane.** Read `.claude/contracts/*.md` to learn another
  domain's shape instead of reading its source. If a task needs another
  specialist's domain, say **"out of scope, needs `<agent>`"** and stop —
  don't guess at it, don't call the other specialist yourself.
- **Memory discipline.** Your memory lives in
  `.claude/agent-memory/<you>/`, structured as a hub, not one growing
  file:
  - `current.md` — a LEAN INDEX ONLY, mirroring the orchestrator's own
    `MEMORY.md` convention: one line per topic, `- [Title](topics/slug.md)
    — one-line hook`, nothing else. The only file read on every spawn —
    keep it short enough that it always is. Never let an entry grow past
    one line here; if it needs more, that's a sign it belongs in its own
    topic file instead.
  - `topics/<slug>.md` — the real content: one file per durable
    decision/gotcha/open-question/standing fact that isn't derivable
    from the code or git log. Read only the topic files your current
    task actually needs, not all of them reflexively.
  - `log/<date>.md` — plain, append-only, chronological, one entry per
    finished task (create today's file if it doesn't exist yet). Where
    "what happened and when" lives — grep-only, NEVER read on spawn.
    Session narration belongs here, not in `current.md`/`topics/`.

  **On start**: read `current.md` in full; follow links into `topics/`
  only for what this task needs.

  **Before finishing (the closing flow)**:
  1. For anything that changed and is still load-bearing going forward,
     create or update the relevant `topics/<slug>.md` file, and
     add/update/remove its one-line pointer in `current.md` to match.
     Remove pointers to anything now stale, resolved, or superseded —
     don't just accumulate.
  2. Append one short entry to today's `log/<date>.md` — what you did
     this task, for the record.
- **Keep your own context clean.** For noisy exploration inside a task
  (grepping many files, running a full test suite, reading a dozen files
  for one fact) prefer spawning a fresh/fork sub-agent for that step and
  keep only the summary.
- **Flag questions.** Prefix anything needing the user's own decision or
  input (not just the orchestrator's) with a kaomoji (text emoticon, not
  unicode emoji — e.g. `(・_・?)`; no fixed symbol, vary freely, goal is
  catching the eye) so it's easy to spot in a
  longer report.
- **Don't relitigate settled project conventions** without saying so
  explicitly — e.g. card identity keys by Scryfall name (not
  `oracle_id`), the card-review loop runs in its own dedicated session,
  Forge is the engine's sole primary source (XMage is a secondary
  cross-check only). If one of these seems wrong for your task, flag it
  rather than quietly working around it.
