# Turn-based engine (`engine.ts`, `mana.ts`, `sba.ts`, + existing `turn.ts`/`stack.ts`/`priority.ts`/`layers.ts`)

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
canBlock(engine, blocker, attacker);
declareBlockers(engine, [{ blocker, attacker }, ...]);
resolveCombatDamage(engine); // applies real damage; returns which creatures took lethal damage (see below — doesn't destroy them itself)

// State-based actions (704) — a caller runs this after anything that could
// have created one (combat damage, above, is the main source today).
// From sba.ts, not engine.ts — see below for why it's a separate file:
checkStateBasedActions(engine.state, engine.players);

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

### Combat (509/510) — blocking and damage, minus SBAs

`declareBlockers` mirrors `declareAttackers`'s own all-or-nothing shape:
every proposed `{blocker, attacker}` pair is checked with `canBlock`
(attacker actually declared this combat, blocker is an untapped creature
controlled by an opponent, Unblockable/Flying-Reach/Menace), and
`engine.blockers` (attacker id -> its blockers) is only replaced if every
pair AND the whole-batch Menace rule pass.

`resolveCombatDamage` then applies real 510 damage: unblocked attackers hit
the defending player directly; blocked attackers assign damage among living
blockers in declaration order, lethal-amount-first (Deathtouch: 1 point
counts as lethal), with Trample overflow to the player; a blocked attacker
whose blockers are ALL already gone (killed in an earlier sub-step) deals
nothing UNLESS it has Trample. First/Double Strike's two-sub-step ordering
(510.5) is modeled as two internal passes within this one call rather than a
second `turn.ts` phase — a creature dealt lethal damage in the first pass is
excluded from the second, same effective ordering a real SBA check between
the two real sub-steps produces.

**What this does NOT do:** destroy anything. Real creature death from
combat damage is a state-based action (704.5g/704.5h) — see the next
section. Instead, `resolveCombatDamage` returns `CombatDamageResult` —
every creature that took damage this call, and whether that damage was
lethal — computed via the SAME shared `isLethallyDamaged` (state.ts) the
next section's `checkStateBasedActions` uses, so the two never disagree.

### State-based actions (704) — `sba.ts`, a narrow real subset

A new, separate file (not folded into `engine.ts`) since SBAs are checked
against `GameState`/`RealPlayer` alone — no stack, no turn, no priority
concept needed — matching `GameAction.java`'s own real shape (a `Game`-level
concern, not a spell-resolution one). `checkStateBasedActions(state,
players)` loops (704.3: "repeats... until there are no further
state-based actions to be performed") over a narrow, explicitly real
subset:

- **704.5f** — a creature with toughness 0 or less is put DIRECTLY into the
  graveyard, bypassing Indestructible entirely (a real, different rule from
  "destroy").
- **704.5g** — a creature with damage marked >= its toughness is destroyed
  (`state.destroy` — respects Indestructible, 702.12b).
- **704.5h** — a creature dealt ANY damage by a Deathtouch source is
  destroyed, regardless of toughness (702.2b).
- **704.5j** — the legend rule, via the pre-existing (already real, already
  committed before this pass) `state.checkLegendRule`, folded into the same
  loop rather than left for a caller to remember separately.

This required a real, necessary change to `state.dealDamage` itself: damage
to a creature USED TO be a documented no-op (nothing consumed it, so
tracking it would've been pure unused bookkeeping) — now that SBAs exist to
consume it, `dealDamage` genuinely marks `card.damageMarked`/
`card.deathtouchDamaged` (120.3/702.2b), the same fields
`resolveCombatDamage`'s own `isLethallyDamaged` check reads.

**Explicitly NOT in scope** (real, plainly-flagged gaps): 704.5a (0-or-less
life loses the game — no "game over" concept exists anywhere in this
codebase); 704.5i (planeswalker loyalty 0 — no FIN card needs it, checked);
damage CLEARING at cleanup (514.2 — a separate rule from the SBA check
itself; `turn.ts`'s Cleanup phase still does nothing automatic, so
`damageMarked` only ever grows within one pilot session — see
`ENGINE_GAPS.md`'s turn-structure-completeness gap); aura/equipment
illegal-attachment SBAs (no attachment-legality tracking exists to check
against).

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
- **Blocking legality** (509.1: creature/controller/tapped/Unblockable/
  Flying-Reach) and **Menace** (509.1b/702.111b), all-or-nothing.
- **Combat damage** (510): unblocked/blocked/blocked-but-blockers-gone
  assignment, **Trample** overflow (702.19c), **Deathtouch** lethal-amount
  (702.2e), and **First/Double Strike**'s two-sub-step ordering (510.5) —
  see "Combat" above for the one thing it deliberately does NOT do
  (destroy a lethally-damaged creature).
- **State-based actions (704)** — a narrow, real subset (`sba.ts`):
  0-or-less toughness (704.5f, bypasses Indestructible), lethal marked
  damage (704.5g), any Deathtouch damage (704.5h), and the legend rule
  (704.5j) — see "State-based actions" above for the full scope and what's
  deliberately NOT covered.

## Explicitly out of scope (real gaps, not silently assumed away)

- **Target-legality checking at cast/declare time.** `card.ts`'s own effect
  system resolves/chooses targets *lazily*, inside `resolveCard`, at
  resolution time — there's no pre-resolution "declare and validate targets"
  step anywhere in this codebase to hook a legality check onto. Retrofitting
  one means redesigning `Effect`'s entire resolution model; not attempted here.
- **A player losing the game (704.5a) / planeswalker loyalty 0 (704.5i).**
  No "game over" concept exists anywhere in this codebase yet, and no FIN
  card needs the loyalty case today — see `sba.ts`'s own header.
- **Damage clearing at cleanup (514.2).** A real, separate rule from the SBA
  check itself — `turn.ts`'s Cleanup phase still has no automatic action, so
  `card.damageMarked`/`deathtouchDamaged` only ever grow within one pilot
  session. See `ENGINE_GAPS.md`'s turn-structure-completeness gap.
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
and illegal cases), `engine.test.ts` (sorcery-speed timing, affordability,
attacker/blocker legality, combat damage — unblocked/blocked/Trample/
Deathtouch/First-and-Double-Strike, all-or-nothing declaration — activated-
ability legality/resolution, and the `resolveCard`-dispatch-collision fix —
again both legal and illegal cases throughout), and `sba.test.ts` (704.5f/g/
h/j — including Indestructible correctly blocking 704.5g but NOT 704.5f,
and a combined multi-issue sweep proving the 704.3 loop-until-stable shape).

## Gap analysis vs. real Forge

See `ENGINE_GAPS.md` for the full, prioritized "what's still missing to reach
parity with Forge" writeup (turn/phase completeness, combat, alternate costs,
replacement effects, state-based actions, and what's an intentional,
accepted simplification vs. a real gap still worth closing).
