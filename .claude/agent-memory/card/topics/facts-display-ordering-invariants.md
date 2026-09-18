# Facts-tab display invariants (beyond the project-wide "stay text-ordered" rule)

Project convention already says Facts stay one text-ordered list, role is
a per-row icon only, never a section split (see orchestrator MEMORY.md).
Two implementation-level invariants sit underneath that rule in this
domain's own code (`app/lib/factOrder.ts`, `CardDetailTabs.vue`):

- **A toggle (provenance filter, "show type-derived facts", non-fact-span
  visibility, etc.) must only ever FILTER an already-fully-ordered result
  — never re-sort.** The ordering step (`orderByTextPosition`, per face
  group) always runs first, over the complete authored set including
  currently-hidden rows; a toggle's `v-if`/filter happens strictly after,
  on the final ordered array. Getting this backwards (ordering only the
  visible subset) causes visible rows to silently shuffle position when a
  toggle flips, which was treated as a real bug every time it happened.
- **Any per-row-kind rendering gate that decides "does this segment/row
  have content to link" must check every row-kind's own field, not just
  the first kind that existed.** `FunctionalModelText.vue`'s segment
  template once gated purely on `seg.facts?.length`; when a second,
  non-Fact row kind (`annotatedNonFactSpans`) was added with its own
  `seg.spans` array, a segment covered ONLY by a span silently rendered as
  plain unlinked text until a shared `hasSegmentLink(seg)` helper (checking
  both) replaced the one-sided check. If a third row-kind is ever added
  here, extend that same shared helper rather than adding a fourth
  independent `v-if` condition.
- Hovering a shared segment/row must highlight **every** fact/span
  attached to it, not just the first — `highlightKeys`/`hoveredFactKeys`
  are arrays (`string[] | null`) throughout `FunctionalModelText.vue` and
  `CardDetailTabs.vue` for exactly this reason (fixed after a real bug: two
  facts sharing a byte-identical annotation span only highlighted one of
  the two Facts-tab rows). A single-fact case is just a one-element array
  — don't reintroduce a bare `string | null` single-key model anywhere in
  this hover-highlight chain.
