# token-cards/

Token definitions, one folder per Forge tokenscript slug (`c_a_treasure_sac`,
`b_2_2_horror`, `w_1_1_soldier`, ...) — same layout as `cards/<slug>/`
(`definition.ts`, `scenarios.ts`, `trace.json`, `synergy.json`), same AI-authoring
flow, run through the same `harness.ts`. See `../SYNERGY_DESIGN.md`'s
"Tokens" section for the full reasoning.

Named `token-cards/`, not `tokens/`, because `functional-model/tokens.ts`
(the flat static-token-registry file predating this design) already owns
that name — a sibling `tokens/` directory is ambiguous under plain Node's
extensionless `import '../../tokens'` resolution (only a bundler-aware
resolver like vite-node picks the file over the directory), so this folder
took the different name instead of forcing a 37-import-site rename of the
existing file.

This folder grows on demand, one token at a time, as a card's own
`createToken` effect needs its target token's own behavior/facts resolved
(a token with real logic — Treasure, Food, Clue, Blood — not just a vanilla
creature stat stick). Do not bulk-import Forge's `res/tokenscripts/` list
speculatively.

Empty as of this writing — no token has needed its own definition yet.
`kain-traitorous-dragoon`, `namazu-trader`, and `the-final-days` already
declare `subject: { token: '<slug>' }` produce facts pointing at tokens
that don't have a folder here yet; those facts currently resolve to
"unknown attrs" and only match an unconstrained want (see `synergy.ts`'s
own `resolveSubject`) until this folder actually holds that slug.
