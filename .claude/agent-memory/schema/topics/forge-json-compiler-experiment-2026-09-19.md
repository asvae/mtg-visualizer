# Forge-JSON -> CardDefinition compiler experiment (2026-09-19)

Feasibility probe, NOT wired into any pipeline (uncommitted decision
pending). Files:
`functional-model/scripts/experiments/forge-json-compiler/compile-forge-card.ts`
(+ `run-experiment.ts`). Reads the sibling `forge-json-mapper`
experiment's own output JSON; compares against the real hand-authored
`fdn-cards/exemplar-of-light/definition.ts` (untouched).

## Result

Exemplar of Light compiles to a **structurally exact match** on every
field except `Trigger.name` (2 of 2 triggers). Everything else —
`manaCost`, `typeLine` em-dash split, `pt`, `keywords`, both `cause`
objects (`on`/`counterAddedMatch`/`activationLimit`), both `effects`
(`putCounter` self/`drawCard`) — matched byte-for-byte as JSON.

Fleeting Flight (added second, an Instant's `A:SP$` cast ability with
real targeting + a `DB$ Pump` keyword-granting sub-ability) compiles to a
**100% exact match, zero divergences** — `abilityType: 'spell'`,
`putCounter` chosen-target branch, both `grantKeywordTarget`s. It has no
`Trigger.name` to mint, which is exactly why it matches fully.

## The one real determinism gap: `Trigger.name`

Forge's `T:` line carries **no name at all**. Its only handle is
`Execute$`, which names the EFFECT SVar (`TrigDraw`), not the cause. So
any `Trigger.name` a compiler emits is minted by the compiler. Compiler
used `on<Mode$>` -> `onLifeGained`/`onCounterAddedOnce`; the human wrote
`onLifeGain`/`onCounterAdded`. Nothing in the Forge data can pick between
them. Consequences if a compiler ever becomes real:
- FDN is safe-ish (no `scenarios.ts`, so no by-name trigger selection).
- `sink-model/catalog/families/counters.ts`'s `COUNTER_ADDED_TRIGGER_NAMES`
  allowlist only fires on triggers WITHOUT an `on` value, so a compiled
  trigger bypasses it.
- FIN-style `Scenario.trigger`/`ability` selection IS by name — a
  compiler-minted naming convention would have to be declared canonical
  (and the existing `Trigger.name` "no canonical spelling" note in
  `fdn-sink-model-open-items.md` resolved) before this could be used
  pool-wide.

## Rules that turned out to be real lookups, not judgement

- `P1P1` -> `'+1/+1'`: literally the first ctor arg of
  `CounterEnumType.P1P1` (`forge-game/.../card/CounterEnumType.java:32`)
  — the whole table is generatable from that file.
- Forge param defaults are in the effect classes:
  `DrawEffect.java:65` (`NumCards` default 1),
  `CountersPutEffect.java:97` (`CounterNum` default "1"). The authored
  `amount: 1` on both effects comes from these, not from oracle text.
- `Types:` -> em-dash type line: core/supertype sets from
  `CardType.java`; anything not in them is a subtype by Forge's own
  definition.
- `ValidPlayer$ You` (LifeGained) and `ValidCard$ Card.Self`
  (CounterAdded) are baked into this schema's `on` values' meaning, so
  the compiler must ASSERT them and throw on anything else — they are
  not droppable passthrough.
- `TriggerZones$ Battlefield` consumed-and-dropped (structural here);
  any other zone throws (real unrepresentable case).

## Fleeting Flight additions (2nd card)

- `Execute$` and `SubAbility$` ARE the same mechanism — verified in Forge
  source, both land on `AbilityFactory.getAbility(state, svarName,
  sVarHolder)` (`Trigger.java:626`; `AbilityFactory.java:359`
  `getSubAbility`). One chain walker serves both.
- `KW$` split separator is literally Forge's own:
  `sa.getParam("KW").split(" & ")` (`PumpEffect.java:183`) — space-amp-
  space, not bare `&`.
- Pump duration: ABSENT `Duration$` genuinely means until-end-of-turn
  (`PumpEffect.java:94`: anything not `"Permanent"` is removed at EOT),
  so the authored `untilEndOfTurn: true` is compiler-derivable.
- `Defined$ Targeted` on a sub-ability inherits the PARENT ability's
  `ValidTgts$` — the compiler threads a `ChainContext` down the chain.
- One Forge ability can be N of our `Effect`s (`KW$ A & B` -> two
  `grantKeywordTarget`s), so effect compilation returns an array.

## KNOWN silent-loss case (throw-on-unknown does NOT catch this)

Forge's `Defined$ Targeted` means "the SAME object the parent ability
targeted." This schema has no way to say that — `grantKeywordTarget`
picks its own target. Both the compiler AND the human authored the same
lossy shape, so they agree; but for a card where "same target" matters,
every param is recognized, nothing throws, and the output is subtly
wrong. Needs an `engine` consult (does the engine reuse a target across
effects of one resolution?) before any wider compiler build-out.

## Design stance worth keeping

Every unhandled `Mode$`/`DB$`/param **throws** (`UnsupportedForgeShape`)
rather than approximating or silently dropping. That is what makes the
coverage number honest and maps cleanly onto
`missingSchemaFunctionality` if this ever becomes real.
