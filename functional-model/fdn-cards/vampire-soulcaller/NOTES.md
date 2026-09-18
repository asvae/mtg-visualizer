# Vampire Soulcaller — authoring notes

## Authoring background

Real "This creature can't block." `'CantBlock'` is now a real `Keyword`
union member (2026-09-18, schema-completeness pass) —
recognized-but-inert, same treatment `'Unblockable'` already gets: real
enforcement would need `engine.ts`'s own `canBlock`/`declareBlockers`
(509.1) to check this keyword on the PROPOSED BLOCKER, which they don't
yet (Ward pattern — see `engine-support-registry.ts`'s own
`cant-block-not-enforced` entry).
