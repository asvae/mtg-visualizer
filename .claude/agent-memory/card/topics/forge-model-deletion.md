# `forge-model/`/`ForgeCardScript.vue` were deleted (GPL-3.0 exposure)

As of 2026-09-11, `forge-model/` (verbatim GPL Forge card scripts),
`app/components/ForgeCardScript.vue`, `app/lib/forgeScript.ts`, and
`app/lib/forgeTranslate.ts` (plus their test files) were deleted outright.
Confirmed dead before deletion: nothing in any live render path
(`server/api/card/[set]/[number].ts`, the card page/`CardDetailTabs.vue`,
the Interactions panel) referenced them — the Interactions panel had
already moved fully onto `functional-model/synergy.ts`'s
`findInteractionsForCard`, and `forge-model/README.md`'s own description
of a live "raw Forge script" spoiler / synergy-column fallback was already
stale/false by the time this was checked.

This is why `card.md`'s own domain list no longer mentions
`ForgeCardScript.vue`. If a future task considers reviving anything under
this name, the GPL-exposure concern that motivated the deletion (verbatim
Forge source shipped in this repo's own bundle) is the reason to check
with the orchestrator first, not just re-add the file.

`functional-model/README.md` may still have stale mentions of
`forge-model`/`forgeTranslate.ts`/`forgeScript.ts` — that file is
`engine`'s, not fixed as part of this deletion (flagged to orchestrator at
the time, routing to `engine`).
