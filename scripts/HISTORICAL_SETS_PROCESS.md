# Historical sets tagging project — data-handling-agent runbook

Read this whole document before doing anything. It's written so a session
with zero prior context on this specific project can pick it up cold and
continue correctly. This project is separate from (but related to) the FIN
live-review project documented in `REVIEW_PROCESS.md`/`TAGGING_RULES.md` —
see "How this relates to FIN" near the end.

## What this project is

Tag every card, from every real Magic: the Gathering **expansion** and
**core** set, oldest to newest, against one shared global theme taxonomy —
building both (a) a comprehensive rules file that understands the full
history of Magic mechanics, and (b) real per-card relations data for each
set, one set at a time. The user's own framing for the division of labor:

> agent that analyzes card specifically doesn't have to know about other
> sets. But agent that updates the tagging rules should know full mtg
> landscape.

Concretely: a per-card drafting agent only needs the global rules file plus
a short set-specific instructions doc. YOU (the data-handling-agent role,
orchestrating this) are the one who's expected to know the whole landscape,
decide when something is a genuinely new global mechanic vs. a one-off, and
maintain the rules file and the cumulative data pool as sets get processed.

## Folder layout (2026-08-31: split into served vs. dev-only)

`data/` is now ONLY what's actually served to end users (FIN's own set,
plus the two global pool files) — everything else this project produces
lives under `tagging/`, entirely outside `data/`, so none of this
project's in-development bookkeeping can ever leak into what a real visitor
downloads. Concretely:

- **`data/`** (served — `public/fin` and `public/global_themes.json` are
  real symlinks into it; `public/global_relations.json` too, added
  pre-emptively even though nothing fetches it yet): `data/fin/` (FIN's own
  scryfall/relations/tokens — owned by the "review" role, see below),
  `data/global_themes.json`, `data/global_relations.json`.
- **`tagging/`** (dev-only, never served, this project's actual working
  area): `tagging/scryfall-bulk/` (the two huge Scryfall bulk dumps),
  `tagging/type_themes.json` (creature-subtype id registry, for reference
  only — never fetched by the app), `tagging/card-enrichment-status.json`
  (see below), `tagging/sets/<code>/` (one set's scryfall + relations +
  REVIEW_INSTRUCTIONS.md + STANDOFFS.md + CODEX_PROMPT.md, all together).

## Data files

- `tagging/scryfall-bulk/oracle-cards-<timestamp>.jsonl.gz` — Scryfall's
  "Oracle Cards" bulk export, ONE ENTRY PER UNIQUE CARD DESIGN (deduplicated
  by `oracle_id`, picks one arbitrary representative printing). **Do not use
  this for determining per-set card membership** — it silently drops cards
  whose chosen representative printing is a LATER set (Alpha/Beta are
  almost entirely absent from it; even mid-history sets are only 10-35%
  complete). It's fine for computing structural facts about a card design
  (its own oracle text doesn't change across printings) when set membership
  doesn't matter — that's what `strict_baseline.py`'s whole-database pass
  uses it for.
- `tagging/scryfall-bulk/default-cards-<timestamp>.jsonl.gz` — Scryfall's
  "Default Cards" bulk export, ONE ROW PER PRINTING. This is the correct
  file for anything involving "which set is this card actually in" — use it
  to extract each set's own card list. ~117k rows as of when this was
  built.
- `data/global_themes.json` — the curated theme list, shared by FIN and
  every historical set (this used to be FIN-only `data/themes.json`; FIN
  was migrated onto this shared file — see "How this relates to FIN"). Also
  the file the live app fetches at `/global_themes.json`.
- `data/global_relations.json` — the cumulative pool of every card's
  finalized relations across every set processed so far, keyed by card
  NAME (unique within Magic's rules — no two different real cards ever
  share an exact name). Two purposes: (1) reprint short-circuit — before
  drafting a new set, check this file for cards already known by name; if
  found AND oracle_text is byte-identical to the new printing, copy the
  relations forward instead of re-drafting (see "Per-set process" below);
  (2) cross-check oracle for the strict review pass (see below). Also
  contains **pure-structural entries for cards from sets not yet
  chronologically reached** — the whole-database `strict_baseline.py` run
  seeded EVERY expansion/core card's deterministic baseline in one shot,
  regardless of when its set will actually get processed. This file itself
  carries NO enrichment/review status at all (2026-08-31) — that lives
  entirely in `tagging/card-enrichment-status.json`, keyed by the same card
  names; an `enrichment: "script"` entry there for an unprocessed-set card
  just means it was fully resolved by structural facts alone (see
  `strict_baseline.py`) — it does NOT mean that whole set has been through
  the pipeline. See `GLOBAL_TAGGING_RULES.md`'s "Output shape" section for
  the full enrichment/review model.
- `tagging/card-enrichment-status.json` — flat object keyed by card name,
  `{ "<name>": { "enrichment": "none"|"script"|"ai"|"human", "review":
  "none"|"ai"|"human" } }`. THE single source of truth for "where does this
  card actually stand," decoupled from every relations file (which never
  carry a `reviewed` field anymore). Covers FIN and every historical set
  under one name-keyed object, since names are globally unique. Cards
  nobody's touched at all (`enrichment: "none"`) are simply omitted. See
  `GLOBAL_TAGGING_RULES.md`'s "Output shape" section for the full model,
  including the important caveat about a name's status here sometimes
  outrunning what `global_relations.json`'s own payload shows (FIN case).
- `scripts/strict_baseline.py` — deterministic, zero-agent-cost tagger.
  Reads ONLY Scryfall's structured fields (`keywords` array — exact
  keyword-ability strings, NOT prose; `type_line` — exact word-boundary
  matches; `layout` — exact enum values). Never guesses a `grant`/`consume`
  relation (those need prose to know who benefits) and never bumps a
  self-identity weight to 3 (needs prose to know if the card also creates
  MORE instances). Also determines, per card, whether it's "no more themes
  to explore" (a vanilla or keyword-only card with nothing left once every
  keyword-ability line and parenthetical reminder text is stripped from its
  oracle_text) — this and every other card it produced anything for gets
  written to a companion `<output>.status.json` (`{name: {enrichment:
  "script", review: "none"}}`) for you to merge by hand into
  `tagging/card-enrichment-status.json`. Usage:
  `python3 scripts/strict_baseline.py <cards.json[l][.gz]> <output.json> [set_type1,set_type2,...]`
  — the optional third arg filters by Scryfall's `set_type` field (we use
  `expansion,core`).
- `scripts/GLOBAL_TAGGING_RULES.md` — the real rulebook. Forked from FIN's
  `TAGGING_RULES.md` (which turned out to already be ~95% generic/real-
  Magic content) minus FIN's three still-genuinely-FIN-exclusive-so-far
  mechanics (Job Select, Hero, Tiered Magic — these stay OUT of the global
  file until/unless they recur in another set; see its own "When a set
  introduces something new" section for the promote-to-global rule).
  **Read this file in full before drafting or reviewing anything.**
- `tagging/sets/<code>/<code>_scryfall.json` — one set's card data,
  extracted from the Default Cards bulk file, deduplicated by name
  (multiple art variants of the same design collapse to one entry — see
  "Per-set process" below), basic lands excluded.
- `tagging/sets/<code>/<code>_relations.json` — that set's finalized tag
  data, same shape as documented in `GLOBAL_TAGGING_RULES.md`'s "Output
  shape" section (no `reviewed` field — see `card-enrichment-status.json`
  above).
- `tagging/sets/<code>/REVIEW_INSTRUCTIONS.md` — that set's own quirks: a
  pointer to the global rules, naming traps, known-absent mechanics, and
  anything else specific to that one set. Written by the data-handling-
  agent (you) after actually reading a meaningful sample of the set's
  cards — don't write this from memory/assumption alone; verify against
  real oracle text first (a research fork works well for this — see
  `lea`'s history for the pattern: forked, scanned all 295 cards, reported
  back real findings before any rules got written).
- `tagging/sets/<code>/STANDOFFS.md` — genuinely uncertain calls for that
  set, logged rather than decided unilaterally: what's uncertain, what got
  tagged in the meantime (always a best guess, never left untagged/
  blocking). Follow the exact format already established in
  `tagging/sets/lea/STANDOFFS.md`.
- `scripts/relations.test.mjs` — the schema sanity check (`npm run test`).
  Parametrized over a `SETS` array at the top (`{ code, dir }` — FIN's `dir`
  is `data/fin`, every historical set's is `tagging/sets/<code>`) — add an
  entry for each set as its pass finishes. Also validates
  `tagging/card-enrichment-status.json`'s shape.

## Per-set process

1. **Determine the next set.** Sets in scope: Scryfall `set_type` in
   (`expansion`, `core`) only — no commander/masters/funny/token/
   memorabilia/etc. (user's explicit scope decision). Oldest to newest by
   `released_at`. Extract from Default Cards, not Oracle Cards.
2. **Extract that set's cards.** Filter Default Cards to `set == code`,
   drop `Basic` type_line cards, DEDUPLICATE BY NAME (a set commonly has
   multiple numbered art variants of the same common — same design, same
   oracle text, count once). Write `tagging/sets/<code>/<code>_scryfall.json`.
3. **Check for reprints against `data/global_relations.json`.** For every
   name in this set that ALSO has an entry in the global pool already
   (from an earlier-processed set — not just a structural-baseline-only
   seed entry; check `tagging/card-enrichment-status.json` for that name and
   confirm it's genuinely `enrichment: "ai"` or `"human"` from actual
   prior-set analysis, not just `"script"`), verify oracle_text is
   byte-identical to what's stored (if you don't have the original text
   handy, compare against the earlier set's own `_scryfall.json` for that
   name). If identical: copy the relations forward directly, no agent
   needed. If the set is ENTIRELY new cards (no overlap), skip this step.
   This was validated on Beta (`leb`): 285/287 cards were byte-identical
   Alpha reprints, copied forward in seconds; only the 2 genuinely new
   cards (Circle of Protection: Black, Volcanic Island) needed real
   judgment.
4. **Research the set's own quirks** (skip for a pure-reprint set). Fork or
   spawn an agent to read through EVERY new card's oracle text and
   cross-reference against `GLOBAL_TAGGING_RULES.md`'s current theme list,
   specifically looking for: mechanics that recur across 2+ cards with no
   clean theme fit (new-theme candidates), naming traps (a card's own name
   colliding with a different modern keyword — e.g. Alpha's "Ward" Aura
   cycle grants Protection, not the real `ward` keyword), and anything
   structurally absent (confirm rather than assume). Digest the findings
   YOURSELF and decide on new theme additions — don't let a fresh agent's
   suggestion go straight into the rules file unreviewed.
5. **Update `GLOBAL_TAGGING_RULES.md` and `data/global_themes.json`** for
   anything genuinely new (recurring pattern, not a one-off — one-offs go
   to that set's STANDOFFS.md instead). Match the existing prose style/
   structure exactly when writing a new theme entry.
6. **Write `tagging/sets/<code>/REVIEW_INSTRUCTIONS.md`** — set-specific
   quirks only, pointing back to the global rules for everything else.
7. **Dispatch drafting agent(s)** for the genuinely-new (non-reprint)
   cards only. For a set with more than ~75-100 new cards, chunk into
   parallel agents (see the exact prompt template used for Alpha's 4
   chunks and Arabian Nights' single Codex prompt — both are still visible
   in this session's transcript if you have access to it, or reconstruct
   from this doc's principles: read the two rules docs first, tag every
   applicable theme from scratch — THERE IS NO PREFILL SCRIPT for
   historical sets like there is for FIN — output `{name, themes, note?}`
   per card to a scratch/partial file (no `reviewed` field at all — that
   never belongs on a relations entry, see `card-enrichment-status.json`
   above), flag standoffs with a note starting "STANDOFF:", never invent a
   new theme id unprompted).

   **Using an external tool (e.g. Codex) instead of your own Agent tool**:
   fully supported, but there's no direct integration — write a
   self-contained prompt file (everything the tool needs, since it starts
   with zero context), have the user paste it into the other tool's own
   session, have it write output to a file path you specify, then read
   that file back yourself once it's done. `tagging/sets/arn/
   CODEX_PROMPT.md` is a working example of this pattern.
8. **Merge and strictly review.** Combine all partial/chunk outputs into
   one array. Validate: (a) schema — every name exists in that set's
   scryfall data, no duplicates, every theme id valid (curated OR a real
   creature-subtype slug derived from that card's own type line), every
   role in the valid set, every weight 1-3; (b) cross-check against
   `strict_baseline.py`'s output for the same cards — any theme present in
   the strict baseline but MISSING from a draft is worth investigating
   (though check manually before assuming it's wrong — a `grant` role the
   agent correctly used instead of the baseline's `produce`-only
   assumption is not an error, it's the baseline being conservative); (c)
   read every `note` field — reconcile STANDOFF-flagged cards into that
   set's STANDOFFS.md, and look for recurring patterns across notes that
   deserve a new global theme (this is where most of Alpha's 9 new themes
   came from — Anthem, Firebreathing, Color Change, Ante, Other Counters,
   Landwalk, Cost Increase, Land Type Change, Golem — all surfaced by
   reading the agents' own judgment-call notes, not by the initial
   research pass). Iterate with the drafting agent(s) or patch directly
   yourself until no known issues remain. Be strict — this is the user's
   explicit instruction; don't rubber-stamp a draft that has a plausible-
   but-wrong tag just to move faster.
9. **Finalize.** Strip `note` fields, write
   `tagging/sets/<code>/<code>_relations.json`, delete scratch/partial
   files, and set `{ "enrichment": "ai", "review": "ai" }` for every one of
   this set's names in `tagging/card-enrichment-status.json`.
10. **Add `{ code, dir: 'tagging/sets/<code>' }` to
    `scripts/relations.test.mjs`'s `SETS` array** and run `npm run test` —
    must pass clean.
11. **Merge into `data/global_relations.json`** — this set's finalized
    THEME DATA (not status — that already lives in
    `card-enrichment-status.json` from step 9) overwrites whatever
    structural-only baseline was there before for those same names.
12. **Move to the next set.**

## Current progress (as of this handoff)

- **Limited Edition Alpha (`lea`)** — DONE. 285 cards, fully drafted and
  strictly reviewed, merged into the global pool. 9 new global themes
  added during this pass (see step 8 above for the list). 9 standoffs
  logged in `tagging/sets/lea/STANDOFFS.md`.
- **Limited Edition Beta (`leb`)** — DONE. 287 cards: 285 copied forward
  from Alpha (byte-identical reprints, verified), 2 genuinely new
  (Circle of Protection: Black, Volcanic Island) tagged directly matching
  established patterns from similar existing cards. Merged into the
  global pool.
- **Arabian Nights (`arn`)** — DONE. 77 cards (Codex-drafted via
  `tagging/sets/arn/CODEX_PROMPT.md`), strictly reviewed: cross-checked
  against `strict_baseline.py` (1 flagged diff — Elephant Graveyard's
  `grant:regeneration` vs. baseline's naive `produce` guess — confirmed
  correct, card regenerates a *target* Elephant, not itself), schema
  clean, all 7 judgment-call notes reconciled into
  `tagging/sets/arn/STANDOFFS.md` (already matched 1:1, nothing new to
  add), quirk list spot-checked against real oracle text (Cyclone
  confirmed unrelated to modern Cycling — tagged `other-counters`, not a
  naming-trap Cycling tag). No new global theme candidates surfaced (all
  7 standoffs are one-offs, no recurring pattern). Finalized
  (`{enrichment: "ai", review: "ai"}`, notes stripped), added to
  `relations.test.mjs` (passes clean), merged into `global_relations.json`
  (30 structural-baseline-only seed entries overwritten with real data,
  47 net-new; pool now 19,790 entries).
- **2026-08-30: `reviewed` migrated from boolean to a tiered field** (a
  `false -> "script" -> "agent" -> "human"` ladder plus a `reviewed_at`
  timestamp, embedded directly on each relations entry) — **superseded the
  very next day, see below.** Kept here only as history.
- **Unlimited Edition (`2ed`)** — DONE (backfilled 2026-08-31 after
  discovering this gap — released 1993-12-01, between `leb` and `arn`, but
  got skipped over in the original sweep; the progress log here wrongly
  said "next: atq" for a session before this catch it). 287 cards, 100%
  reprints of `lea`/`leb` (0 genuinely new), all byte-identical oracle text
  verified before copying forward — no agent/Codex needed. Finalized,
  added to `relations.test.mjs`, merged into `global_relations.json`.
  **Always double check for gaps like this one against a full sorted list
  of every expansion/core set's `released_at` before trusting this doc's
  "next chronologically" line** — don't take it on faith.
- **2026-08-31: `reviewed`/`reviewed_at` removed from relations entries
  entirely, replaced by `tagging/card-enrichment-status.json`'s two-axis
  `{enrichment, review}` model** (see "Data files" above and
  `GLOBAL_TAGGING_RULES.md`'s "Output shape" section for the full
  definitions) — the user's explicit ask: review-process bookkeeping should
  have nothing to do with what gets served to end users. In the same pass,
  every historical set's own folder (`data/<code>/` before) moved to
  `tagging/sets/<code>/`, entirely out of `data/` — only `data/fin/`,
  `data/global_themes.json`, and `data/global_relations.json` remain there
  now (see "Folder layout" above). All prior `reviewed` values were mapped
  onto the new model rather than lost: FIN's `"human"` -> `{enrichment:
  "ai", review: "human"}`, FIN's `false` (mechanical-prefill-only) ->
  `{enrichment: "script", review: "none"}`; every finalized historical
  set's `"agent"` -> `{enrichment: "ai", review: "ai"}`; every remaining
  `global_relations.json` entry (the whole-database seed) ->
  `{enrichment: "script", review: "none"}`. Also fixed a real bug surfaced
  while doing this: an earlier pass had incorrectly stamped ~127 FIN card
  names in `global_relations.json` as fully human-reviewed even though that
  file's actual theme payload for them was still just the untouched
  structural baseline (FIN isn't supposed to be merged into the historical
  pool until the sweep chronologically reaches it — see "How this relates
  to FIN" below); stripping `reviewed` out of `global_relations.json`
  entirely removed that false claim. `strict_baseline.py`,
  `prefill-main-types.mjs`, `review-relay.mjs`, and `relations.test.mjs`
  were all updated to read/write the new status file instead; FIN's own
  docs (`TAGGING_RULES.md`, `REVIEW_PROCESS.md`) were updated to match.
- **Antiquities (`atq`)** — DRAFTED, NOT YET REVIEWED. 85 cards, Codex-drafted
  via `tagging/sets/atq/CODEX_PROMPT.md` (all currently `{enrichment: "ai",
  review: "none"}`), with `tagging/sets/atq/STANDOFFS.md` already logged.
  Two creature-type theme ids were pre-curated during research for this set
  (`assembly-worker`, `tetravite` — same precedent as `kraken`/`serpent`,
  see `GLOBAL_TAGGING_RULES.md`). **This is the next task**: run the full
  strict-review pass (step 8 above) before finalizing.
- **Everything else** — not started. Next chronologically after `atq`:
  Revised Edition (`3ed`)/Foreign Black Border (`fbb`, same release date as
  3ed), then Legends (`leg`). 144 total expansion/core sets exist in the
  Default Cards data as of this session.

## Known issues / things to watch

- **RESOLVED 2026-08-31**: the app migrated to Nuxt at some point and now
  serves `data/` via explicit symlinks under `public/` (`public/fin ->
  ../data/fin`, `public/global_themes.json`, `public/global_relations.json`)
  rather than a blanket `publicDir` sweep of the whole folder — so this
  project's dev-only material moving to `tagging/` (see "Folder layout"
  above) wasn't strictly fixing an active leak, just removing any risk one
  could reappear later (e.g. someone adding a wildcard symlink). Nothing
  under `tagging/` should ever get a `public/` symlink.
- **FIN itself is a real, currently-printed Magic set** ("Final Fantasy,"
  set code `fin`, released 2025-06-13 as a Universes Beyond crossover) —
  NOT a fan-made custom set, despite how it may have been described in
  earlier work on this project. It has `set_type: expansion`, so it is
  chronologically IN SCOPE for this same oldest-to-newest sweep, just very
  near the end (2025 sets are close to the newest data available). When
  this sweep eventually reaches FIN's chronological position: **do not
  re-draft it from scratch** — `data/fin/fin_relations.json` already has
  extensive human-in-the-loop review from a dedicated live-review process
  (see `REVIEW_PROCESS.md`). Treat that file as already-authoritative for
  whichever cards have `review: "human"` in
  `tagging/card-enrichment-status.json`; only genuinely un-reviewed FIN
  cards (if any remain at that point) would need this pipeline's normal
  process.
- **Job Select / Hero / Tiered Magic** are FIN-original-so-far mechanics,
  deliberately excluded from `GLOBAL_TAGGING_RULES.md`/
  `global_themes.json` per the "only promote to global once it recurs"
  principle — even though FIN is real, these three specific mechanics
  haven't been confirmed to appear in any OTHER real set yet. If a later
  set (chronologically before or after FIN) turns out to share one of
  these mechanics under a different name, or FIN's own mechanics get
  reused in a later expansion, promote it to global at that point.
- **Basic lands, and any card whose Default Cards `set_type` is outside
  `expansion`/`core`, are out of scope** — don't accidentally pull them in
  via a loose filter (a past mistake this project already hit: an
  unfiltered whole-database strict-baseline run picked up joke-set
  Un-cards like "B.F.M. (Big Furry Monster)" and produced garbage
  creature-subtype ids from its absurd flavor-text subtype line; always
  filter `set_type` explicitly).
- **`tagging/scryfall-bulk/oracle-cards-*.jsonl.gz` vs
  `tagging/scryfall-bulk/default-cards-*.jsonl.gz`** — covered above, but
  worth repeating: mixing these up silently produces wildly incomplete
  per-set card lists for anything older than roughly the last few years of
  real-world Magic history. Always use Default Cards for set extraction.

## How this relates to FIN / the live-review project

Two other roles exist in this repo's broader workflow, run as separate
sessions:
- **"review" role** (see `REVIEW_PROCESS.md`) — drives FIN's own
  interactive human-in-the-loop card review (the `scripts/review-drafts.
  json` / `review-relay.mjs` / review panel UI loop). Different job,
  different files, different cadence (live, one card shown to a human
  reviewer at a time) from this project's job (bulk, agent-vs-agent
  strict review, no live human checkpoint per card). Also writes to
  `tagging/card-enrichment-status.json` (via `review-relay.mjs`) — that
  file is genuinely shared between both roles, not exclusively yours.
- **"ui"/general dev role** — owns the live app's source (`app/`,
  `nuxt.config.ts`, the review panel's server/relay) and broader
  infrastructure. Message this role (via `SendMessage`, check
  `ListAgents` for its current name — it's been renamed at least once
  already this session) for anything touching live app code outside this
  project's own data/scripts files.

Your own scope as the data-handling-agent: `data/global_themes.json`,
`data/global_relations.json`, `scripts/GLOBAL_TAGGING_RULES.md`,
`scripts/strict_baseline.py`, `scripts/relations.test.mjs`, everything
under `tagging/`. You've touched `app/composables/useGraphStore.ts`,
`app/lib/buildGraph.ts`, `scripts/derive-type-themes.mjs`,
`scripts/review-card.mjs`, `scripts/prefill-main-types.mjs`, and
`scripts/review-relay.mjs` a couple of times now — the FIN→global_themes.json
migration, and this reviewed→card-enrichment-status.json migration. Both
were narrow, explicitly user-requested cross-boundary changes shared with
the "review" role, not an ongoing part of this role; stay in your own lane
otherwise, same as the "review" role's own documented scope boundary.
