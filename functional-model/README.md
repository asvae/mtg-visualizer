# Functional model

> **Current state (2026-09):** the `data/*.ts` + `functionalTranslate.ts`
> auto-generation pipeline this README describes below is defunct —
> `app/lib/functionalTranslate.ts` no longer exists, and there is no
> `functional-model/data/` directory. Card logic now lives hand-authored at
> `cards/<slug>/definition.ts` (Forge script → TS, same spirit, no longer
> auto-translated), alongside that card's `scenarios.ts` (test inputs),
> `trace.json` (real engine output, via `scripts/run-scenarios.mjs`), and
> `synergy.json` (AI-authored attribute-bag facts, checked against the trace
> by `scripts/verify-synergy.mjs`). **See `SYNERGY_DESIGN.md` for the current
> design** — the fact model, the verification pipeline, and what's
> deliberately parked. Each card folder also carries a `progress.json`
> (enrichment/review/verification status, same axis convention as
> `tagging/card-enrichment-status.json`). The rest of this file (translator
> internals, `interfaces.ts`/`tokens.ts` grounding, the Beza insight) is kept
> as historical context for the ideas that carried over, not as a
> description of what runs today.

A real, compiling TypeScript reconstruction of card abilities — a comparison
view on the card detail page, alongside `synergy-model/` (a node/flow
relation graph, for computing synergy) and `forge-model/` (Card-Forge's own
real cardsfolder script, for a data-driven rules-engine's-eye view). Where
those two are optimized for being queried/matched or fed to Forge's own
engine, this one is optimized for reading like an actual program: real
`export function` declarations, real `if (...) { }` blocks, real calls
against a lightweight TypeScript mirror of Card-Forge's own Player/Card API
(`interfaces.ts`) — checked with `tsc --noEmit`, not just formatted to look like
code.

Generated automatically by `app/lib/functionalTranslate.ts` from the same
real Forge scripts already sitting in `forge-model/data/*.txt` — it does not
re-parse the raw `.txt` files itself, and it is not fed the card's printed
oracle text either (see "Real oracle text" below for the one place that text
*does* show up, purely as a caption). It reuses `app/lib/forgeTranslate.ts`'s
already-solved Forge-semantics helpers (owner/type resolution, the
parent→children tree reconstruction, the `ConditionCheckSVar$`/
`ConditionSVarCompare$` X-metric/Y-metric comparison parser) rather than
re-deriving them — see that file's own header for why `forgeScript.ts`'s
rendered-field-string output is one step removed from a raw parse rather
than a second one.

## Why this exists — the Beza insight

This grew directly out of reading Beza, the Bounding Spring's real Forge
script. Its four ETB clauses ("create a Treasure if an opponent controls
more lands than you," "you gain 4 life if...", "create two Fish if...",
"draw a card if...") are chained one after another via `SubAbility$` — in
the Forge-model column's own outline table, that renders as a visually deep
nested tree, which reads as "each clause depends on the one before it." It
doesn't. Forge's `SubAbility$` chain is just "here is the next line of this
one ability's script" — a linked list, not a dependency graph — and each of
Beza's four clauses carries its *own* independent
`ConditionCheckSVar$`/`ConditionSVarCompare$` pair, checked on its own
regardless of whether an earlier clause's condition held.

This module's whole design principle follows from that: a `SubAbility$`/
`Execute$` continuation renders as a **sequential statement at the same
nesting depth** as what came before it — flattened, not nested — and a
`Condition*` field on one statement becomes a leading `if (...) { }` wrapped
around *just that statement*, never around anything after it:

```ts
/**
 * Trigger: when this enters the battlefield.
 */
export function onEnter(self: Card, you: Player, opp: Player[]): void {
  if (highest(opp, (p) => p.getLandsInPlay().length) > you.getLandsInPlay().length) {
    createToken(you, TOKENS.c_a_treasure_sac);
  }
  if (highest(opp, (p) => p.getLife()) > you.getLife()) {
    you.gainLife(4, self);
  }
  if (highest(opp, (p) => p.getCreaturesInPlay().length) > you.getCreaturesInPlay().length) {
    createToken(you, TOKENS.u_1_1_fish, 2);
  }
  if (highest(opp, (p) => p.getCardsIn('Hand').length) > you.getCardsIn('Hand').length) {
    you.drawCard();
  }
}
```

Real nested indentation is reserved for the two cases where Forge's script
*is* describing something genuinely nested: a true modal choice
(`Choices$` — Charm, an `if (mode === 1) { } else if (mode === 2) { }`
branch over a `mode: number` parameter), and a brand-new ability being
GRANTED rather than a next step in the same effect (`AddTrigger$`/
`AddStaticAbility$`/`AddReplacementEffect$` — a Class level's own trigger,
say), which becomes its own wholly separate top-level `export function`.

## `interfaces.ts` — grounded in Forge's real API, not invented

The user's own framing for this: "copy it somehow from forge, to not
reinvent the wheel." `interfaces.ts` is a lightweight TypeScript mirror of the
slice of Card-Forge's own real engine (a checkout lives at `../mtg-forge`
relative to this repo) that generated code calls against — `GameEntity`,
`Card`, `Player`, `TokenInfo`, `ZoneType`. Every interface member cites the
real Java file (and roughly which line, at the time it was written) it
mirrors — `Player.getLife()` (Player.java ~line 435), `Card.getNetPower()`
(Card.java ~line 4468), and so on — so a reader can go check "is this really
what Forge calls it" instead of trusting an invented API.

It also declares a couple dozen free `declare function` helpers
(`createToken`, `destroy`, `dealDamage`, `pump`, `highest`, ...) for actions
the generated code needed that don't map to one single Player/Card method —
real Forge dispatches most of these through much heavier machinery
(`Game.getAction()`, replacement effects, static-ability layers,
`CardFactory`) that would defeat this module's own "lightweight, readable"
purpose if mirrored in full. Each of those says so in its own doc comment
("convenience wrapper," never presented as copied verbatim when it wasn't).
`declare function foo(...): T;` is valid ambient TypeScript with no
implementation required — nothing here has a body to keep in sync with real
Forge, only a typed surface for `data/*.ts` to compile against.

## `tokens.ts` — real BLB token data, not invented stats

A `Record<string, TokenInfo>` hand-derived from this app's own
Scryfall-backed `POOL_TOKEN_REGISTRY` (`server/api/card/[set]/[number].ts` —
the same registry that resolves BLB's real dedicated token sheet,
`set:tblb`, for the card page's Interactions panel), reshaped into `interfaces.ts`'s
`TokenInfo` shape. Power/toughness are parsed off each TokenScript id's own
naming convention (`<colorletters>_<power>_<toughness>_<subtype>`, Forge's
own consistent scheme), since most of that registry's own `name` fields are
a bare "`<Subtype> token`" with no P/T spelled out in the string itself. A
hand transcription rather than an import — `POOL_TOKEN_REGISTRY`'s own file
relies on Nitro/H3's auto-imported `defineEventHandler` at module scope,
real only inside a running Nuxt server, not importable from `tsc --noEmit`
or a plain script. If that registry gains/loses/renames a BLB token entry,
this file (and `app/lib/functionalTranslate.ts`'s own `KNOWN_TOKEN_KEYS`
mirror of its keys) needs a matching manual update.

A `TokenScript$` id this translator generates a `create...` call for that
ISN'T in `tokens.ts` (Beza's own Treasure, `c_a_treasure_sac` — genuinely
missing from `POOL_TOKEN_REGISTRY`, not an oversight in this file) falls back
honestly to an `unmapped` comment rather than a fabricated entry.

## Scope

BLB collector numbers 1–50 only, for now — the same 50 cards
`forge-model/pools/blb.json` already has real Forge scripts prepared for
(all 274 BLB cards have scripts; this is just the slice this translator has
been run and spot-checked against). Extending scope is: filter
`forge-model/pools/blb.json` to the desired `collectorNumber`s (or another
set's pool file, once one exists) and rerun the generator.

## Regenerating

```
npx vite-node functional-model/scripts/generate.mjs
```

Plain `node` does **not** work here (unlike
`synergy-model/scripts/make-exam-forge.mjs`'s otherwise-identical pattern) —
`app/lib/functionalTranslate.ts` imports several helpers from
`app/lib/forgeTranslate.ts` using an extensionless relative import, the same
convention every other in-repo consumer of it (Nuxt pages, Vitest) relies on.
Plain Node's native TypeScript support only resolves module specifiers
Node's own resolver understands, which doesn't include an extensionless
relative import the way Vite/Nuxt's bundler-style resolution does — hence
`vite-node` (already present via the `vitest` devDependency, no new
dependency added) instead of `node`. See `generate.mjs`'s own header comment.

The script also prints a coverage summary — how many of the 50 produced zero
`unmapped` entries vs. at least one, and why for each one that didn't.

## Real oracle text

`generate.mjs` reads the real Scryfall bulk-data dump at
`tmp/scryfall-bulk/oracle-cards-*.jsonl.gz` and writes each card's
printed oracle text as a caption in the generated file's header comment —
purely for a human reading the code to have the real wording alongside it.
This is **not** an input to the translator itself: `translateForgeToFunctional`
only ever reads the parsed Forge script, exactly like `forgeTranslate.ts`
does for the synergy-model view. If the bulk dump is missing or a name
lookup fails, generation still proceeds — that caption line is just omitted.

## Verifying

Three checks, all of which should stay green:

```
npx vitest run app/lib/forgeTranslate.test.ts   # forgeTranslate.ts's helpers, reused here, still work
npm run typecheck                                # the rest of the app (functionalTranslate.ts included)
npx tsc --noEmit -p functional-model/tsconfig.json  # every generated data/*.ts file, plus interfaces.ts/tokens.ts
```

`functional-model/tsconfig.json` is a small standalone config (not part of
the main app's TS project) covering exactly `interfaces.ts`, `tokens.ts`, and
`data/**/*.ts` — this is the real bar for "does the generated code actually
compile," independent of whatever the main Nuxt app's own tsconfig allows.

## Status

AI-generated, not human-reviewed — same review-status convention
`synergy-model/data/edges_status.json` uses for an AI decomposition, just
without a matching per-file status record yet (there's no hand-authored
alternative to diff against here the way synergy-model's edges.json has).
A card whose ability shape doesn't fit any of this translator's known
patterns renders an honest `false /* unmapped: ... */` boolean or
`// unmapped: ...` comment — a real, always-valid (if dead or inert) piece
of code, never a guessed-at, confidently wrong statement — see the
"Unmapped" comment block at the bottom of an affected card's own
`data/*.ts` file for specifics. As of this writing, 38 of the 50 cards
compile with zero unmapped entries; the rest have one or more honest gaps —
mostly Gift's "was the gift promised" state (not modeled in `interfaces.ts` at
all), a couple of effect kinds with no clean real-code shape (`Animate`,
`Counter`, `PeekAndReveal`, `ChooseCard`, `DelayedTrigger`, `Effect`), and a
`K:ETBReplacement` keyword whose granted replacement effect
`app/lib/forgeScript.ts` doesn't currently expose as a walkable chain at all
(Eddymurk Crab). Every one of the 50 still compiles clean — an `unmapped`
entry marks an honest gap in what the code DOES, never a build failure.
