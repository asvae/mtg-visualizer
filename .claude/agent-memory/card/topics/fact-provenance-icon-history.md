# Facts-tab provenance icon: check current code before assuming its meaning

The small icon marking a Fact row's authorship provenance (`Fact.
provenance` present = recognizer/parser-derived, absent = hand/AI-authored)
has had its meaning **inverted more than once** across sessions, plus a
whole popover-vs-plain-title design that was built then torn out. As of
the last known state:

- The icon (`lucide:wand-sparkles`) marks a fact **WITHOUT** `provenance`
  (agent/AI-authored) — plain `title` tooltip only, no popover.
- A parser-derived fact (`provenance` present) gets **no icon at all** in
  this slot.
- A *different*, separate icon (`lucide:scroll`, in the debug-column cell)
  marks a parser-derived row specifically and opens a modal with the real
  recognizer source (`GET /api/recognizer-source/:rule`) — this is not the
  same icon/slot as the wand-sparkles one above.

Given the flip-flop history, **don't trust a description of "which icon
means what" from an old note (including this one) without re-reading the
current template** before changing or extending this area again.

Separately, `server/api/recognizer-source/[rule].get.ts` uses a
hand-maintained allowlist (`RECOGNIZER_IDS: RecognizerId[]`), not a
directory listing — a new recognizer only becomes visible through this
route if its filename is added there AND matches the invariant "filename
== `RecognizerId`/`Fact.provenance.rule` string + `.ts`" (true for every
recognizer checked so far, no exceptions found).
