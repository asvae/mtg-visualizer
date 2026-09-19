# Next steps

Approved, actionable next steps only — set progress, known issues, and
work already started but not finished. For longer-term/speculative ideas
that aren't committed to, see [`WISHLIST.md`](WISHLIST.md) instead; nothing
here is drawn from it.

See [`SET_STATUS.md`](SET_STATUS.md) for the live per-set breakdown
(regenerate with `npm run set-status` — it's derived straight from
`tagging/card-enrichment-status.json`, not hand-maintained, so it can't go
stale like a hardcoded table here would). Narrative detail lives in
`scripts/HISTORICAL_SETS_PROCESS.md` (historical sets) and
`scripts/REVIEW_PROCESS.md` (FIN). As of the last regeneration: `lea`, `leb`,
`2ed`, `arn` are AI-enriched/complete; `atq` is drafted but not yet reviewed;
FIN is 127/306 human-reviewed, rest mechanically prefilled only; everything
else (140 of 144 in-scope expansion/core sets) not started.

## Unfinished steps

- **Card shorthand notation — full first draft of FIN, now needs the human
  review pass.** `CARD_SHORTHAND.md` defines the house notation (bracket icon
  placeholders rendered via `MtgIcon.vue`, `{X}` mana symbols via
  `ManaSymbol.vue`, duration/em-dash/MDFC-face rules, etc.).
  `data/card_shorthands.json` / `data/card_shorthand_status.json` cover 306
  of FIN's 312 cards (the 6 basic lands have no oracle text worth
  compressing, intentionally skipped) plus one homebrew card
  (`Gladiolus Amicitia`). Only `fin` #1-50 are `review: "human"` so far
  (worked through one at a time, live in the app) — #51 onward (255 cards)
  were drafted in one large batch by parallel agents following
  `CARD_SHORTHAND.md`'s established rules and still need the same live
  review pass (the left border on the shorthand text is orange until a
  card's status flips to `review: "human"`). A few things worth double-
  checking during that pass, flagged by the drafting agents: `[Reanimate]`
  stretched to a couple of self-return/no-tap cases outside its original
  "target creature card ... tapped" shape; `enemy <noun>` used for plural
  "your opponents control" too (the token was originally singular); a few
  one-off constructs with no existing
  token (untap, variable-count draws, non-mana-cost Ward) were left as plain
  English per the "don't invent tokens unilaterally" instruction the agents
  were given. Use the card page's Previous/Next links or arrow keys
  (`/app/card/fin/<n>`) to move through the set. For MVP, shorthand coverage
  is scoped to FIN only — no other set is planned to get shorthand text.
- **Card detail page decoupled from the graph store.** `/app/card/[set]/[number]`
  (same URL shape as `scryfall.com/card/<set>/<number>`) fetches its own data
  from `server/api/card/[set]/[number].ts` (Scryfall + relations + shorthand,
  in one request — prev/next is pure client-side ±1, not server-fetched)
  instead of depending on the whole
  graph being loaded client-side first via `useGraphStore.ts` — a direct
  link/bookmark to a card now works without visiting `/app` first.
- **Antiquities (`atq`) strict review** — the next task in the historical
  sweep. Run step 8 of `HISTORICAL_SETS_PROCESS.md`'s per-set process
  (cross-check against `strict_baseline.py`, reconcile standoffs, look for
  new global-theme candidates) before finalizing and merging into
  `data/global_relations.json`.
- **Continue the historical sweep past Antiquities** — next chronologically:
  Revised Edition (`3ed`) / Foreign Black Border (`fbb`, same release date),
  then Legends (`leg`). Only 4 of 144 in-scope sets are finalized so far.
- **Finish FIN's live review** — 179 of 306 cards still only have the
  mechanical prefill (self-identity/creature-type edges), not a real
  human-confirmed pass. Driven interactively via `scripts/REVIEW_PROCESS.md`.
- **When the historical sweep chronologically reaches FIN** (set released
  2025-06-13, near the newest data available) — do not re-draft it. Cards
  already at `review: "human"` in `tagging/card-enrichment-status.json` are
  authoritative; only genuinely untouched FIN cards would need the normal
  per-set pipeline.
- **Roll out the play/enters/mana land-fact split beyond its one prototype
  card.** 2026-09-09 session added a real `playLand` engine action (CR 305,
  Forge-grounded) plus a granular `entersBattlefield`/`tapped` fact,
  prototyped end-to-end on `vector-imperial-capital` only. The other 16
  Town-cycle siblings (ETB-tap-self trigger) and the static-only-land group
  are equally eligible for the same `played`/`enters-tapped` facts (their
  `verify-synergy.mjs` exemptions already exist) but haven't been hand-
  authored yet — mechanical, not a design question at this point. Separately,
  11 legacy single-color mana facts (`color` field) could be migrated to the
  newer `colors` constraint shape for consistency, though both shapes
  coexist fine as-is (see `functional-model/synergy.ts`'s `colorSetOf`).

- **Forge-json-compiler: extend past FDN 1-50, 25/50 still gray.** Promoted
  today from a scratch experiment (`scripts/experiments/`) to a real pipeline
  tool at `functional-model/scripts/forge-json-compiler/` — compiles a card's
  real Forge JSON straight into a schema-valid `CardDefinition`, no oracle-
  text reading/AI transcription involved (`CardDefinition.provenance:
  'forge-json-compiler'` marks these, exempting them from the normal
  `justification.json` requirement — that manifest exists to catch an AI's
  own misreading of oracle text, which doesn't apply to a deterministic
  Forge-JSON parse). 25 of FDN's first 50 collector-number cards now compile
  and their real `fdn-cards/<slug>/definition.ts` were replaced with the
  compiler's own output (25 blue in `functional-model/scripts/forge-json-
  compiler/fdn-1-50-cases.ts`'s own table). Remaining 25 gray break down as:
  ~11 static/replacement-effect cards (`S:`/`R:` Forge lines — categorically
  out of this compiler's scope, would need continuous-effect/layer semantics
  built out first), a handful of already-known individual gaps (activated
  costs beyond what's built, planeswalker loyalty abilities, modal `Charm`,
  `CopyPermanent`, comma OR-union targets, dynamic `Count$` formula amounts),
  plus two specific real design decisions still open:
  - **Valkyrie's Call** needs genuinely new schema vocabulary — an instance-
    scoped ("this exact returned object," not a board-wide predicate)
    continuous type/keyword grant, plus a counter-bearing `ChangeZone`
    effect. Not attempted; needs an `engine` consult before building.
  - **Crystal Barricade** (player-level hexproof grant + "prevent noncombat
    damage to others" replacement effect) and **Herald of Eternal Dawn**
    (Platinum Angel-style "can't lose/win the game" replacement pair) have
    zero structural precedent anywhere in this schema/pool — both already
    self-documented via their own `missingSchemaFunctionality` entries.
  Extending to FDN cards past #50 (221 more real cards, only ~130 of which
  have been authored into the pipeline at all) hasn't been attempted yet.
  Full per-pass writeups in `.claude/agent-memory/schema/topics/forge-json-
  compiler-*-2026-09-19.md`.
- **Standing pipeline-status freshness policy** (new 2026-09-19): before
  reporting any FDN card/batch as ready for review, verify `pipeline-
  status.json`'s `computedAt` is fresh relative to current `definition.ts`
  content — re-run `npx vite-node functional-model/scripts/gate-and-write-
  status.mjs --all` if in doubt. Also applies after any `ENGINE_GAPS.md`
  edit alone (a card's embedded `engineGapsContext` snapshot can go stale
  even when the card's own file never changed). See `.claude/agent-memory/
  schema/topics/pipeline-status-freshness-policy.md`.

## Known issues

- **Stale Vite HMR on `functional-model/` shared files can freeze the
  client bundle mid-session.** After many rapid successive edits to a
  heavily-shared file (e.g. `synergy.ts`) in one dev-server lifetime, the
  browser can keep executing a stale bundled module even though the file on
  disk (and a raw `@fs/...` fetch of it) is current — e.g. `describeFact`
  correctly handling an event in source while the live page still renders
  the raw event string. If a fix that's clearly present in source doesn't
  show up live, restart `npm run dev` before re-diagnosing as a code bug.

- **WSL's DrvFs mount (`/mnt/c/...`) breaks file-watch HMR.** inotify doesn't
  reliably fire for changes there, so Vite's default watcher can silently
  miss saves until something forces a rebuild. Fixed via `usePolling` in both
  `nuxt.config.ts` (`vite.server.watch`) and `.storybook/main.ts`
  (`viteFinal`'s `server.watch`) — if HMR (dev server or Storybook) silently
  stops applying edits again, check these are still in place before anything
  else.
- **Two FIN-exclusive mechanics not yet promoted to the global taxonomy**:
  Job Select, Hero, and Tiered Magic are excluded from
  `scripts/GLOBAL_TAGGING_RULES.md`/`data/global_themes.json` per the
  "only promote once it recurs" rule. Revisit if a later-processed set
  (older or newer) turns out to share one under a different name.
- **Watch for the old public-asset leak recurring.** Previously `publicDir`
  served all of `data/` unfiltered; now `public/` uses explicit symlinks
  (`fin`, `global_themes.json`, `global_relations.json`) into `data/`. Keep
  it that way — `tagging/` (all dev-only bookkeeping, including the large
  Scryfall bulk dumps) must never get a `public/` symlink.
