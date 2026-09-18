# Notes tab (NOTES.md) + shared MarkdownView.vue — 2026-09-19

Added a "Notes" tab to `CardDetailTabs.vue`, next to Card Definition/Forge
Script, that renders a card's own `functional-model/fdn-cards/<slug>/
NOTES.md` (the per-card authoring-history/reasoning file — a NORMAL
git-tracked project file, unlike Forge Script's dev-only gitignored-checkout
read). Only shown when the file exists (`notesAvailable` computed) — most
cards (every FIN card; any FDN card that hasn't gotten one yet) don't have
one, and that's the expected common case, not an error.

## Pieces

- `server/api/card/[set]/[number].ts` — `FunctionalModelData.notes: string |
  null`. Populated in `loadFdnFunctionalModel` via a plain `readFileSync` +
  try/catch (same slug that function already resolves for `definition.ts`,
  not re-derived). Always `null` for `fin` (both the dev branch and the
  production `fmBundle` branch) — no NOTES.md convention exists for that set.
- `app/lib/cardResponse.ts` — the client's hand-mirrored `CardResponse` type
  needed `notes` added too (see `cardresponse-hand-mirror-gotcha.md` — this
  is that exact gotcha, hit again).
- `app/composables/useGraphStore.ts` — `FUNCTIONAL_MODEL_TABS` (the
  literal-tuple source of `FunctionalModelTab`'s type, used for
  localStorage sanitization) needed `'notes'` added. **This is a 3rd place**
  a new tab value must be added, beyond `CardDetailTabs.vue`'s own
  `FunctionalModelTabItem['value']` union and `functionalModelTabValue`'s
  computed type — missing it silently produces real `npm run typecheck`
  errors (`"notes"` has no overlap with the store's stale union) that don't
  point at the store file at all, they point at the *comparison* sites in
  CardDetailTabs.vue. Check `useGraphStore.ts`'s `FUNCTIONAL_MODEL_TABS`
  first when adding any future tab.
- `app/components/MarkdownView.vue` (new) — thin wrapper: `renderMarkdown()`
  (app/lib/markdown.ts) + a scoped style block copied from
  `app/pages/docs/[[slug]].vue`'s own `.docs-body` block (headings/
  lists/code/blockquote/hljs palette), renamed `.markdown-view`. Docs page
  itself was deliberately left untouched/still has its own local copy — no
  refactor to share, out of this task's card-page-only scope.
- `app/lib/markdown.ts` — gained minimal GFM pipe-table support (header row +
  `| --- | --- |` separator + body rows), because exemplar-of-light's real
  NOTES.md has one and the renderer's own header previously documented "no
  tables" as a real limitation. This is the ONLY NOTES.md in the pool that
  currently uses a table (grepped); other Markdown surfaces (`/docs`) don't
  use one either, so this was a net-new capability, not a fix to an
  existing broken case.

## Verified live (not just data-level)

`fdn/733` (exemplar-of-light) — Notes tab renders real content, table
included, via Playwright against a dev server. `fin/1` — no Notes tab shown,
no console/page errors. `npm run typecheck` — identical error set to
baseline (confirmed via `git stash`/pop bracket around the whole change),
same file:line:message modulo line-number drift from added lines.
