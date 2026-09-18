# Schema reference page (`/app/engine/schema`)

Reachable ONLY from `EngineConsoleTabs.vue`'s "…" overflow (alongside
Keywords) — a static, read-only reference page, not a review/status axis,
so it doesn't belong in the primary tab row. "Single page is fine" — no
sub-navigation, no `useStatusFilterList`/search/filter shell.

**Extraction, not hand-copying.** `functional-model/card-schema-source.ts`
slices 19 named top-level type/interface declarations straight out of
`functional-model/card.ts` (rooted at `CardDefinition`, shown FIRST —
everything else follows in the file's own declaration order) plus
`TokenInfo` (the one referenced type actually declared in
`interfaces.ts` instead) — via a small comment/string-aware `{`/`(`/`[`
depth-counting text scanner, deliberately NOT the real `typescript`
parser package. Two real gotchas the scanner had to handle:
- `Effect` is a ~650-line union of object-literal variants with NO single
  wrapping outer brace — "next top-level `}`" alone stops at the wrong
  variant. Termination for a `type` alias is the first depth-0 `;`
  instead; termination for an `interface` is still its own closing `}`.
- Leading doc comments are captured by a separate backward scan (stops at
  the first blank line or non-comment-like line) — this file's real
  payoff is keeping every field's real Forge/CR citation attached to its
  own section rather than summarized away.

Served via `GET /api/card-schema` (thin wrapper, `server/api/
card-schema.get.ts`), read fresh off disk every request (no caching —
same convention `server/api/engine-status/source.get.ts` already
established). Each entry always exists in the response even if extraction
fails for a given name (`found: false`, `source: null`) — surfaced via
`EngineConsoleCodeSection`'s own not-found state rather than silently
vanishing from the list, in case a future `card.ts` rename breaks the
by-name lookup.

Page itself (`app/pages/app/engine/schema.vue`) reuses `EngineConsole-
Shell` (nav slot = short intro paragraph only, no list) + one
`EngineConsoleCodeSection` per type, ALL passed `default-open` — a
reference page should show real content on load, not require a click per
section; the collapse affordance still matters for the two ~500-650-line
sections (`CardDefinition`, `Effect`).

Never touch `functional-model/card.ts` itself for this feature — the
whole point is reading it, not editing it.
