# Turn-based engine (`engine.ts`, `mana.ts`, + existing `turn.ts`/`stack.ts`/`priority.ts`/`layers.ts`)

## Why this exists

`harness.ts`'s `Scenario`/`runScenario()` — the thing every one of the 312 real
FIN cards' `scenarios.ts` uses — is **not** a turn-by-turn player script. It's a
flat instruction: "fire `card.triggers['chapterI']`, then `chapterII`, ..."
against a manufactured board. Nothing prevents an illegal action; it just
executes whatever a scenario declares. That's the right tool for its actual
job (declaring "this card's ability really does X, here's the trace" for
synergy verification) but it doesn't let anyone **pilot a player through a
real game** — there's no turn order, no priority, no legality.

This engine is that other thing. It does **not** replace `harness.ts` or touch
any of the 312 card folders — it's a separate capability, composed from
pieces (`turn.ts`, `stack.ts`, `priority.ts`, `layers.ts`) that already existed
in this codebase, unused by anything, since the very first `functional-model`
commit.

## API shape — "pilot one player"

```ts
const engine = createEngine(state, [you, opp]); // state: GameState, from state.ts

// Read-only legality check, or the real mutating action (pays cost, pushes to stack):
canCastSpell(engine, you, cardDef);
castSpell(engine, you, cardReal, cardDef, ctx, actions);

// One APNAP priority round; resolves the stack or advances the phase for you:
stepPriority(engine, [{ pass: true }, { pass: true }]);

// Direct phase advance when nobody's responding this round:
advance(engine);

// Combat:
canAttack(engine, creature);
declareAttackers(engine, [creature1, creature2]);

// Activated abilities (602.1) — same read-only-check + mutating-action pair:
canActivateAbility(engine, you, permanentReal, cardDef, abilityName?);
activateAbility(engine, you, permanentReal, cardDef, ctx, actions, abilityName?);
```

Every action that can be illegal returns `ActionResult` (`{ok:true}` or
`{ok:false, reason}`) instead of throwing or silently no-op'ing — a caller (or
a test asserting "this move should be rejected") always gets an explicit
answer, and nothing mutates when the answer is `false`.

## How this composes with `card.ts`

`resolveCard()` (card.ts) is still **the** resolution engine for what a spell
or ability actually *does* once it's legally allowed to happen — this file
never reimplements that. `castSpell` decides *whether* and *when* casting is
legal, pays the real cost, and pushes a `StackObject` (card.ts's own
`CardDefinition` + `EffectContext` + `Actions`, same triple `harness.ts`
builds for a scenario) onto `stack.ts`'s real LIFO `Stack`. `resolveTop()`
(new, in `engine.ts`) calls `Stack.resolveTop()` — which calls `resolveCard`
for you — then moves the resolved card to its real post-resolution zone.

`state.ts`'s `GameState`/`RealCard`/`RealPlayer` are reused as-is as the
mutable game-object model; nothing here duplicates that.

### The `resolveCard` dispatch collision (fixed here)

`resolveCard(card, ctx, actions, triggerName?, abilityName?)` with **neither**
name given defaults to running `card.effects` — correct for a plain spell, but
wrong for a permanent that has BOTH a named ETB trigger and its own
`activationCost`+`effects` (Jill, Coeurl, Elvish Archdruid, and many other real
cards' actual shape: `effects` is reserved for the ability's LATER activation,
not "what happens on cast"). `harness.ts` never hits this, since its own
`lifecycleBefore` treats any `activationCost`-bearing card's scenario as an
activation, never a plain cast.

Fixed in `castSpell`: a permanent with `activationCost` gets a shallow
`{...card, effects: undefined}` view pushed onto the stack instead of the real
`card`, leaving `triggers` (and thus a same-name-lookup for the ETB) intact.
The real ETB firing itself is `resolveTop`'s job — it auto-fires whichever
`card.triggers` entry has the new, additive `on: 'enter'` field (`card.ts`).
None of the 312 existing FIN cards set `on: 'enter'` yet (a deferred
retrofit — see `ENGINE_GAPS.md`); this only fires for a test-authored
`CardDefinition` or a future retrofit today.

Later activating that SAME permanent's own ability goes through
`canActivateAbility`/`activateAbility` instead, which push the REAL `card`
(with `effects` intact) and set `isAbility: true` — `resolveTop` skips the
spell-only "move to Battlefield/Graveyard" step for those, since 602.1
activated abilities don't relocate their source permanent.

## In scope for this first slice

- **Sorcery-speed timing** (307.1a/117.1a): a non-Instant/non-Flash spell can
  only be cast during the caster's own Main1/Main2 with an empty stack.
- **Mana-cost affordability** (601.2g/602.2c) — see `mana.ts` — against real
  untapped **basic lands only**.
- **Summoning sickness** (302.6), **tapped-creature** (508.1a), **Defender**
  (302.6), and **Vigilance** (508.1f) for attacker declaration.
- **Activated-ability legality** (602.1): control check, sorcery-speed
  restriction (detected from free-text `activate only as a sorcery` in the
  cost string — `card.ts`'s `activationCost` has no structured timing field),
  `{T}`-cost-requires-untapped, mana affordability, and explicit rejection
  (not silent mispayment) of any cost component this engine can't pay —
  `Sacrifice ...`, `Crew N`, `{X}`, `Pay N life`, etc. are all real, common
  activation-cost shapes among the 312 FIN cards (verified by grepping every
  `activationCost:` string in `functional-model/cards/<slug>/definition.ts`),
  not a hypothetical edge case.
- **`mana.ts`'s `basicLandsFor(cost)`** — one matching basic land per colored
  pip, generic pips round-robining the colors the cost already needs (Forest
  fallback if the cost has none) — scenario/test-setup convenience, not new
  affordability logic.

## Explicitly out of scope (real gaps, not silently assumed away)

- **Target-legality checking at cast/declare time.** `card.ts`'s own effect
  system resolves/chooses targets *lazily*, inside `resolveCard`, at
  resolution time — there's no pre-resolution "declare and validate targets"
  step anywhere in this codebase to hook a legality check onto. Retrofitting
  one means redesigning `Effect`'s entire resolution model; not attempted here.
- **Declaring blockers / combat damage.** `turn.ts`'s own header already
  flags `CombatDamage` as reachable-but-inert; this only adds attacker-
  declaration legality on top.
- **Priority-holder tracking between calls.** Real 117.1a also requires the
  caster hold priority at the moment of casting; `priority.ts`'s own header
  already documents why this simplified model has no persistent "who
  currently holds priority" state between calls (it's scripted per round, not
  simulated) — a caller keeps this honest by only calling `castSpell` between
  `stepPriority` rounds, not by the engine enforcing it directly.
- **Non-basic mana sources.** Dual/nonbasic lands, mana rocks, and real
  activated mana abilities (Elvish Archdruid's own `{T}: Add {G} for each Elf
  you control`, e.g.) are not recognized mana sources — see `mana.ts`'s own
  header.
- Alternate costs, X spells, modal/split costs, casting from anywhere but hand.
- A real AI/player decision process — unchanged from `priority.ts`'s own
  existing scope note: every round's choices are supplied by the caller.

## Tests

`mana.test.ts` (cost parsing, affordability, payment, `basicLandsFor` — legal
and illegal cases) and `engine.test.ts` (sorcery-speed timing, affordability,
combat legality, activated-ability legality/resolution, and the
`resolveCard`-dispatch-collision fix — again both legal and illegal cases,
plus the all-or-nothing "one illegal attacker rejects the whole declaration"
behavior).

## Gap analysis vs. real Forge

See `ENGINE_GAPS.md` for the full, prioritized "what's still missing to reach
parity with Forge" writeup (turn/phase completeness, combat, alternate costs,
replacement effects, state-based actions, and what's an intentional,
accepted simplification vs. a real gap still worth closing).
