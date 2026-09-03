# Synergy-node review process

Runbook for decomposing cards into the node/flow schema defined in
`synergy-model/SCHEMA.md`, one card at a time, confirmed by the user. Written
so a fresh session can follow it without prior context. FIN is the only set
with Scryfall data fetched into this repo so far, so that's what review
starts on in practice — but the data this process produces
(`synergy-model/data/edges.json`, `edges_status.json`, `registries.json`) is
global, keyed by card name only, not scoped to any one set the way
`data/fin/fin_relations.json` is. A card from any future set slots into the
same files without restructuring.

## Why this exists

`synergy-model/SCHEMA.md` defines a schema for decomposing card text into a
graph of typed nodes against shared game objects (tokens, zones, events)
instead of hand-annotated card-to-card synergy. This is a separate effort
from the theme tagging pipeline (`data/fin/fin_relations.json`,
`scripts/REVIEW_PROCESS.md`) and from the shorthand notation
(`CARD_SHORTHAND.md`) — don't conflate the three. This process produces
`synergy-model/data/edges.json` (the filename is a holdover from an earlier
draft of the format; it still holds the current `{nodes, flow}` shape, not
literal "edges").

**Read `synergy-model/SCHEMA.md` in full before decomposing anything** — it
defines the node shape, the closed role list, the owner/zone/thing columns,
the flags (including the `:=`/`=` binding convention), and the `flow` graph
that expresses dependency between nodes. The worked example (§6, Namazu
Trader) is the reference for how much granularity is expected per card.

## How review actually works (no relay/queue infra)

This mirrors how the card-shorthand notation was reviewed — a plain manual
pass, not the async queue+relay setup the theme-relations pipeline uses.
Nuxt's dev server hot-reloads the client on every save, and this route's
server handler re-reads `synergy-model/data/edges.json` fresh off disk on
every request in dev (see `loadSynergyEdges()` in
`server/api/card/[set]/[number].ts`) — so editing the file and refreshing the
card page in the browser is the entire feedback loop. No extra process to
start.

1. **Prerequisite**: `npm run dev` running, browser open to
   `http://localhost:3000/app/card/fin/<collector number>` (same URL shape as
   `scryfall.com/card/fin/<number>`, so prev/next arrow keys walk the set).
2. Pick the next un-reviewed card — `node synergy-model/scripts/synergy-card.mjs "<name>"`
   prints its oracle text plus its current nodes (if any) and review status.
   Un-reviewed = no entry in `synergy-model/data/edges_status.json`, or an
   entry whose `review` isn't `"human"`.
3. Decompose the card's text into nodes per `SCHEMA.md` §2. Check `thing`
   names against `synergy-model/data/registries.json`'s `labels`/`actions`
   registries first — reuse an existing name (`treasure`, `surveil-2`, ...)
   rather than inventing a near-duplicate. If the card genuinely needs a new
   label or action, add it to `registries.json` too, not just this card's
   entry. **Never write the card's own name (or a slug of it) as a `thing`**
   — use the reserved value `thing: self` (or `self:front`/`self:back` for a
   double-faced card) for the card's own body; see `SCHEMA.md` §2/§3. This is
   what lets `synergy-model/EXAM_PROCESS.md`'s round-trip test hand a card's
   nodes to an agent with nothing identifying in them, without any separate
   anonymization step. Work out the `flow` graph alongside the nodes
   themselves — which ids are independent roots, which stack-destination
   node gates which chain, any `combine` groups — not as an afterthought.
4. Propose the nodes and flow to the user in chat (a small JSON block, or the
   indented-outline shape the card page itself renders, is easiest to read).
   Wait for confirmation.
5. On confirmation (or confirmation-with-correction in the same message —
   apply the correction, then treat it as confirmed, same shorthand
   proceeding-signal convention as `scripts/REVIEW_PROCESS.md` describes:
   "good apart from that," "otherwise fine," etc.):
   - Write the card's entry into `synergy-model/data/edges.json` (see
     format below) — replace the whole entry if one already existed, don't
     merge.
   - Set `{ "decomposition": "ai", "review": "human" }` for that name in
     `synergy-model/data/edges_status.json`.
   - Refresh the card page (or just note that HMR/the fresh-read endpoint
     will show it) to let the user visually confirm the rendered outline
     before moving to the next card.
6. On correction with no closing signal, revise the proposal in chat and
   re-show it — don't write to either file until it's confirmed.

## Data file format (`synergy-model/data/edges.json`)

```jsonc
{
  "name": "Hecteyes",  // exact Scryfall name, "//" for DFCs
  "nodes": {
    "node:cast":    { "role": "cast",    "owner": "me",  "from": "hand", "to": "stack", "thing": "self" },
    "node:enters":  { "role": "enters",  "owner": "me",  "from": "--",   "to": "bf",    "thing": "self" },
    "node:onEnter": { "role": "trigger", "trigger-type": "enter", "owner": "me", "from": "--", "to": "stack", "thing": "self" },
    "node:move":    { "role": "move",    "owner": "opp", "from": "hand", "to": "gy",    "thing": "any", "flags": "qty:1" }
  },
  "flow": {
    "roots": ["node:cast", "node:enters"],
    "steps": {
      "node:cast":    ["node:enters"],
      "node:enters":  ["node:onEnter"],
      "node:onEnter": ["node:move"]
    }
  }
}
```

Note: `node:enters` is a root (nothing points at it in `flow.steps`) — a
permanent can enter without being cast (reanimation, etc.) — even though
`node:cast` *also* names it as what follows casting. That's not a
contradiction: both are true facts about the same node, reached two
different ways. `node:onEnter` (the trigger itself becoming a stack object,
603.3b) follows `node:enters` as a guaranteed step (no player gets priority
in that gap), while `node:move` (the trigger's own effect) is contingent on
`node:onEnter` actually resolving — that's the real interruption point
(Stifle and its relatives), derived from `node:onEnter`'s own `to: "stack"`,
not stored as a separate flag anywhere. See `SCHEMA.md` §2 for the full
node shape, the role list (including `trigger`/`trigger-type`), and the
`flow` graph rules in detail.

One array, one file, global across every set (unlike `fin_relations.json`,
which is per-set). Ids inside `nodes` are per-card, free-text, opaque — they
exist only to be pointed at from `flow`. `flags` is the raw free-text tail
from SCHEMA.md §2 (`self`, `not:self`, `qty:N`, `cond:...`, the `:=`/`=`
binding pair, space-separated if more than one applies) — omitted or empty
when none apply.

`synergy-model/data/edges_status.json` is flat, keyed by card name, same
two-axis shape as `data/card_shorthand_status.json`:

```jsonc
{
  "Namazu Trader": { "decomposition": "ai", "review": "human" }
}
```

`decomposition` is who wrote the nodes; `review` is who last confirmed them.

## Scope boundary

This session's job is decomposing cards and authoring
`synergy-model/data/edges.json`, `synergy-model/data/edges_status.json`,
and `synergy-model/data/registries.json` (only when a card needs a label or
action that doesn't exist yet). Genuine gaps in the schema itself (a node
shape `SCHEMA.md` §2-4 can't express, one of the §8 open questions coming up
for real) go into `SCHEMA.md` — say so rather than inventing a workaround
silently. Broader app work (the card page itself, the API route, anything
outside `synergy-model/`) is the main dev session's job, same boundary
`scripts/REVIEW_PROCESS.md` draws for the theme-tagging pipeline.
