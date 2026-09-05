# Round-trip fidelity test

A way to check whether a card's edge decomposition (`synergy-model/data/edges.json`)
actually captures what the card does: hand a fresh agent nothing but the
schema, the registries, and that one card's edges (name and rarity withheld;
mana cost and coarse type are given, since they're just more edges), ask it
to reconstruct the card — mana cost, type line, rules text, same shape a
real card is displayed in minus the name — and see how close it gets. A
clean reconstruction says the decomposition is faithful; a wrong or missing
mechanic says either the decomposition under-specified something or
SCHEMA.md itself can't express it — both worth knowing.

This is separate from `REVIEW_PROCESS.md` (which produces the edges in the
first place) — run it after a card's already been decomposed and confirmed.

## Why no anonymization step

Earlier drafts of this planned to anonymize the card's name before handing
it to the decoding agent. That turned out to be unnecessary: SCHEMA.md's
`thing: self` convention (§2/§3) means a card's own edges never contain its
name or a slug of it in the first place — there's nothing to redact. The
only thing `make-exam.mjs` does beyond assembling the packet is drop the
`name` field from `edges.json`'s entry and strip SCHEMA.md's own worked
example (§6, which names and quotes a real card in full) plus its scattered
by-name illustrations elsewhere in the doc, so the packet doesn't hand the
agent a solved example to pattern-match against. If some other card's real
name happens to show up inside a reconstruction (a "named references" case,
SCHEMA.md §8) that's fine — not something this process tries to prevent.

## The loop

1. **Generate the packet**: `node synergy-model/scripts/make-exam.mjs "<card name>"`
   writes `synergy-model/exams/<slug>.md` — task instructions + SCHEMA.md
   (minus §6 and its by-name examples) + `registries.json` + the card's own
   edges, nothing else.
2. **Run it**: spawn a **fresh, non-fork** agent (it must not inherit this
   session's context — it already knows which card this is) and have it
   **Read the packet file itself** (`synergy-model/exams/<slug>.md`) rather
   than pasting the file's content into the launch prompt by hand — tell it
   to read that one file, and only that file, nothing else in the repo, no
   WebSearch/WebFetch. Copy-pasting the packet manually is a real failure
   mode, not a hypothetical one: it's dropped whole sections (the
   `## Registries` block, specifically) twice in a row, silently producing
   "could not derive X" findings that were actually just missing input, not
   real schema gaps. Having the agent read the file removes the transcription
   step entirely. **One attempt only** — don't send it corrections or a
   second round; the packet itself already says this to the agent, but
   don't undermine that from this side either.
3. **Judge it yourself** — this session, not the decoding agent. Compare its
   reconstruction against the card's real oracle text
   (`data/fin/fin_scryfall.json`). Don't ask the decoding agent to fix
   anything; it's done after one try. Categorize what you find:
   - **Match** — reconstruction captures every mechanic, nothing invented.
     Wording doesn't need to match Scryfall's exact phrasing, only meaning.
   - **Issues** — something's off. Note whether it's a **decomposition
     gap** (an edge was missing/wrong for what the card actually does — fix
     goes back through `REVIEW_PROCESS.md`), a **schema gap** (the edges
     were faithful but SCHEMA.md genuinely can't express the missing piece —
     flag it, maybe as a new §8 open question), **agent misinterpretation**
     (the edges were sufficient but the agent still got it wrong —
     informative but not itself a fix target), or a **process error** (the
     packet the agent actually saw was incomplete/wrong through no fault of
     the schema or the agent — before concluding anything, check that the
     agent really did read the current generated `.md` file rather than a
     hand-typed stand-in).
4. **Save the result**: `synergy-model/exams/<slug>.result.json`. The
   examiner's own structured answer stays in its own fields, separate from
   this session's judgement (`verdict`/`notes`) — never blend the two into
   one paragraph. Pull `manaCost`/`typeLine` straight from what the agent
   reported (`null` for either if it didn't produce one — some older
   packets predate the card-style output format); split its "Assumptions"
   and "Could not derive" lists into actual arrays, one entry each, rather
   than leaving them as embedded prose inside `description`:
   ```jsonc
   {
     "name": "Namazu Trader",
     "manaCost": "{3}{B}",           // null if the examiner didn't report one
     "typeLine": "Creature",         // null if the examiner didn't report one
     "description": "<the reconstructed rules text only, verbatim>",
     "assumptions": ["<one per list item, verbatim>"],
     "couldNotDerive": ["<one per list item, verbatim>"],
     "verdict": "match" | "issues",
     "notes": "<your judgement — what's right/wrong and which category, per step 3. This is YOUR assessment, never the examiner's own words>",
     "comparedAt": "2026-09-03"
   }
   ```
   The card page (`/app/card/<set>/<number>`) renders the examiner's
   proposal (mana cost/type line with real mana-symbol icons, description,
   assumptions, could-not-derive) in its own boxed section, with the
   judgement (verdict badge + notes) visually separate below it — same
   fresh-read-in-dev pattern as everything else in `synergy-model/`.

## Scope

`synergy-model/scripts/make-exam.mjs`, `synergy-model/exams/*.md` (packets),
and `synergy-model/exams/*.result.json` (judged results) are this process's
files. A genuine schema gap surfaced by a test goes into `SCHEMA.md` itself,
same boundary as `REVIEW_PROCESS.md` draws.
