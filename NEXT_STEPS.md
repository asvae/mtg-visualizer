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
  (`Gladiolus Amicitia`). Only `fin` #1-41 are `review: "human"` so far
  (worked through one at a time, live in the app) — #42 onward (264 cards)
  were drafted in one large batch by parallel agents following
  `CARD_SHORTHAND.md`'s established rules and still need the same live
  review pass (the left border on the shorthand text is orange until a
  card's status flips to `review: "human"`). A few things worth double-
  checking during that pass, flagged by the drafting agents: `[Reanimate]`
  stretched to a couple of self-return/no-tap cases outside its original
  "target creature card ... tapped" shape; `enemy <noun>` used for plural
  "your opponents control" too (the token was originally singular); a
  `Job select` (bracketed) vs `Tiered` (not bracketed) inconsistency predates
  this batch and wasn't resolved; a few one-off constructs with no existing
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

## Known issues

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
