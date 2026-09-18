# Recognizer wiring: 2 recurring gotchas

When adding or widening a `functional-model/recognizers/*.ts` structural
recognizer, two bookkeeping steps have each been *forgotten at least
once* (causing a live 404 on the provenance popover, or a silent
duplicate-vs-retag bug) — check both every time:

1. **`recognizers/types.ts`'s `RecognizerId` union AND
   `server/api/recognizer-source/[rule].get.ts`'s hand-kept
   `RECOGNIZER_IDS` runtime array must be updated together.** The API
   route mirrors the type union *by hand* (documented in its own
   comment) specifically because a runtime array can't be derived from a
   type; widening `RecognizerId` without also widening `RECOGNIZER_IDS`
   makes that recognizer's provenance-source popover 404 ("Could not load
   recognizer source") even though everything else about the wiring is
   correct. Grep `RECOGNIZER_IDS` and diff it against `RecognizerId`
   whenever a new recognizer lands.

2. **`apply-recognizers.mjs`'s `coreKey()` dedup/retag key only compares
   the fields it's been explicitly told to compare.** It deliberately
   excludes `value`/`controller`/`annotations`/`provenance`/`targeted`,
   but does NOT automatically pick up a new discriminating field just
   because a `Fact`/`Constraints` shape gained one. Real bugs found this
   way, each needing an explicit fix to `coreKey`'s own field list or
   normalization: `subject` not normalized for `target:'self'` facts
   (predates-2026-09-11-merge legacy shape collided with the new merged
   shape), array *element order* inside `types.has`/`hasAny`/`not` not
   sorted before hashing (`stableStringify` sorts object keys but not
   array elements), and missing `attacking`/`excludeSelf`/`tapped` as
   discriminating fields. Before trusting that a new fact shape will
   cleanly retag/dedupe against existing hand-authored data, check
   `coreKey`'s current field list and array-handling directly — don't
   assume it "just works" for a shape it's never seen before.

Also worth remembering: `apply-recognizers.mjs` is strictly
additive/retag-only — it never removes or narrows a fact whose producing
recognizer later stops matching (e.g. because the card migrated off the
`Effect`/`custom` shape that recognizer reads). A recognizer's own
"accepts" list is a snapshot of what it *could* derive fresh today, not a
guarantee every card on that list currently has an up-to-date on-disk
fact from it — check whether the recognizer's own current export still
produces the on-disk shape before assuming a rerun will fix a card.
