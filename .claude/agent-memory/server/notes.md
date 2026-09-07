# server agent notes

Scoped working memory for the `server` specialist. Update before finishing
any task: decisions made, open questions, current state worth resuming
from. This is what makes a fresh respawn cheap — don't rely on transcript
resume alone (session transcripts are swept after ~30 days).

## Decisions

- 2026-09-07: Prod 500s on `/api/card/[set]/[number]` (and presumably
  `/api/cards/by-names`, `/api/tokens/by-key`) traced to Netlify build/
  functions running on a default Node version older than what
  `import { DatabaseSync } from 'node:sqlite'` needs (unflagged import
  requires Node ≥22.13/23.4; module doesn't exist at all before 22.5).
  Neither `netlify.toml` nor `package.json` had any Node version pin, so
  Netlify fell back to its own (older) default → import throws at
  function cold start → 500 on every call. This is a runtime/shell issue,
  not route logic — confirmed by checking the plain unflagged import in
  all three files matches local (Node v24.11.1) working fine.
- Fix: added `[build.environment] NODE_VERSION = "24"` to `netlify.toml`
  (this is Netlify's mechanism for pinning both the build image and the
  Functions runtime — they follow the same setting) and `"engines":
  { "node": ">=22.13.0" }` to `package.json` as a documented minimum/
  fallback. Picked "24" for the pin to match the confirmed-working local
  dev version (v24.11.1); Node 24 is current LTS as of Sept 2026.
- Not committed/pushed per task scope — orchestrator/user to commit and
  trigger redeploy.

## Open questions

- Verify after next deploy: hit `https://mtg-synergy-map.asva.pro/api/card/fin/1`
  and confirm 200 + real data instead of the 500 error body. If it's
  still 500 after redeploy with NODE_VERSION pinned, check Netlify's
  deploy log for the actual Node version used at build time (site may
  have a UI-level NODE_VERSION override that conflicts, or the Functions
  runtime setting under Site settings → Functions may need to be bumped
  separately from the build's Node version — these are usually the same
  but worth confirming from the deploy log rather than assuming).
- If still broken after the version pin lands and deploy log confirms
  Node 24 is genuinely in use, this is no longer a shell issue — hand
  back to orchestrator to route to `card` (route logic in those three
  files), not something to keep digging into here.
