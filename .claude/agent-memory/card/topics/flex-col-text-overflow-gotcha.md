# Flex-column long-text overflow collapses a flex sibling (2026-09-18)

**Update, same day, later**: the specific pipeline-status box this entry
fixed no longer exists — it was removed outright (badge moved to the
`EngineConsoleShell` header, `reasons`/`reviewNote`/text dropped from the UI
per explicit user call) rather than kept-and-shrunk; see
`topics/fdn-vs-fin-card-model.md`'s newest bullet. Keeping this entry for
its **general lesson** below (still real, still applies to any future
`flex-col`/`flex-row` pairing of a fixed-size image with an unbounded-text
sibling in this codebase), not because the original box is still there to
look at.

**Real bug, fixed**: `/app/engine/cards/fdn/2` (Arahbo) and other `purple`
FDN cards showed no card image. NOT a data/API bug (`GET /api/card/fdn/2`
was always correct, `CardMedia.vue` unconditional, `card.images` always
valid) and NOT the newly-landed `engineGapsContext` field (that field isn't
even read by any template — a real but wrong initial hypothesis, ruled out
by live reproduction). Confirmed via Playwright: the `<img>` elements
loaded fine (`naturalWidth` correct) but rendered at a real `0×0` box.

**Root cause — a genuine CSS flexbox quirk, not a Vue/data bug**:
`CardDetailTabs.vue`'s `<div class="flex flex-col items-start gap-4
md:flex-row">` puts `CardMedia` side-by-side with the FDN pipeline-status
box. That box used to be `<div class="mt-2 shrink-0 ...">` wrapping a
`<ul class="flex flex-col gap-1">` of `<li>` reason strings. Once a real
gate `reasons` string got long (e.g. Arahbo's `missingSchemaFunctionality`
clause-quoting message, several hundred chars, one long sentence) with no
upstream width constraint, the `<ul>`'s own `flex-direction:column` cross-
axis stretch computes its shrink-to-fit width from each `<li>`'s UNWRAPPED
max-content size (classic flexbox circular-sizing quirk — a flex-column
container with intrinsic/auto width doesn't reliably wrap text at all
without a hard width/max-width somewhere in the chain). The box ballooned
to ~3200px; since it was `shrink-0` (refused to shrink), 100% of the
flex-row's negative space landed on its `CardMedia` sibling instead
(default `flex-shrink:1`), collapsing it to 0 width — and therefore the
`<img>` (which has `max-width:100%` from Tailwind preflight) to 0 too.
Same underlying overflow also caused the second reported symptom ("pipeline
status card thing... goes like 3 pages to the right" — the box's own
un-wrapped 3200px content, not a missing image, was the literal visible
artifact).

**Fix**: `mt-2 shrink-0 ...` → `mt-2 min-w-0 max-w-xl ...` on that box, plus
`break-words` on the `<li>`. `max-w-xl` breaks the circular estimation
(gives the `<ul>` a real width to wrap against); `min-w-0` (replacing
`shrink-0`) lets the box shrink further on a narrower row instead of
refusing to shrink at all. Verified live across all 3 real `purple` FDN
cards (Arahbo, Inspiring Paladin, Sire of Seven Deaths) plus `blue`/`gray`
controls — image renders at the correct 220×306.5, no
`document.documentElement.scrollWidth` overflow, zero console errors.

**General lesson for this file (and any other `flex-col`/`flex-row` pairing
of a fixed-size image with an unbounded-text sibling)**: a `shrink-0` (or
even default-shrink, unconstrained-width) flex item holding freeform,
potentially-long text needs an explicit `max-w-*`/`min-w-0` pair, not just
`break-words` alone — `break-words` alone does NOT fix this because the
overflow happens during the flex item's own intrinsic-size computation,
before wrapping is even considered as an option.
