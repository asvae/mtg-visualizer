# Turn-based engine (`engine.ts`, `mana.ts`, `sba.ts`, `saga.ts`, + existing `turn.ts`/`stack.ts`/`priority.ts`/`layers.ts`)

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

// Extra turns (500.7) — Ultimecia, Time Sorceress's own "take an extra
// turn after this one" is the real FIN card that needs this:
queueExtraTurn(engine, you);
```

`advance`/`stepPriority` also auto-fire any real `on: 'upkeep'`/`'endStep'`
trigger for the active player's own permanents the moment their phase is
entered (`fireOnPhaseEnterTriggers`, see below), and Cleanup now runs its
own real 514.1/514.2 automatic actions (`turn.ts`) — see "Turn-structure
completeness" below for both.

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
aura/equipment illegal-attachment SBAs (no attachment-legality tracking
exists to check against). Damage clearing at cleanup (514.2 — a separate
rule from the SBA check itself) is now real — see "Turn-structure
completeness" below.

### Turn-structure completeness (2-player only)

Three real pieces, closing `ENGINE_GAPS.md`'s former gap #3:

- **Cleanup's own real automatic actions** (`turn.ts`'s `runPhaseEntryAction`,
  same place Untap/Draw's actions already lived): 514.1 discards the active
  player down to the default maximum hand size (7 — no FIN card modifies
  max hand size, checked), and 514.2 clears `damageMarked`/
  `deathtouchDamaged` game-wide via the new `state.clearAllDamage()` — NOT
  the "until end of turn effects end" half of 514.2, since `layers.ts`'s own
  duration-not-tracked simplification is unchanged/accepted.
- **`on: 'upkeep'`/`'endStep'` trigger auto-fire** (`engine.ts`'s
  `fireOnPhaseEnterTriggers`, called from `advance`/`stepPriority` right
  after a phase transition): fires for the ACTIVE player's own permanents
  only (the common "your upkeep/end step" case; "each player's" is a
  deferred gap). Needs a `CardDefinition`+`EffectContext`+`Actions` to call
  `resolveCard` with, long after the spell that cast the permanent already
  left the stack — solved by a new `GameEngine.resolvedPermanents` map,
  populated by `resolveTop` the moment a permanent enters the battlefield
  (the same triple a `StackObject` already carries). A permanent seeded
  directly onto the battlefield (scenario setup, never cast through this
  engine) has no entry and its triggers simply don't auto-fire — a real,
  documented gap, not a silent success, same convention `enteredThisTurn`
  already established. Two real FIN cards would use `'endStep'` today (a
  deferred retrofit, same as `'enter'`): Yuna, Hope of Spira; Ultimecia,
  Time Sorceress. No FIN card needs `'upkeep'` today (checked).
- **Extra turns (500.7)** — `turn.ts`'s `TurnState.extraTurns`, a FIFO
  queue of player indices `advancePhase`'s own turn-wrap branch consumes
  instead of blindly rotating, plus `engine.ts`'s `queueExtraTurn(engine,
  player)` wrapper. Ultimecia, Time Sorceress's own "take an extra turn
  after this one" is the real FIN card that needs this.

**Still explicitly deferred** (real, no FIN card in this pool needs them
today — checked): "each player's"/"each opponent's" upkeep/end-step
triggers (as opposed to "your own"); "skip your next X step/phase" effects.

### Saga lore-counter automation (714) — `saga.ts`

Verified against the real pool first: 22 FIN cards model Saga chapters as
named `chapterI`/`chapterII`/`chapterIII`/(`chapterIV`) triggers (grep
`chapterI` across `functional-model/cards/<slug>/definition.ts`), 3 of them
transforming DFCs (Jill, Shiva's Dominant // Shiva, Warden of Ice; Dion,
Bahamut's Dominant // Bahamut, Warden of Light; Jecht, Reluctant Guardian //
Braska's Final Aeon).

`advanceSaga(engine, real, registered)` is the one real function behind
both 714.2b (a Saga's own ETB: 0 lore counters, then immediately its
first) and 714.2c (another lore counter after each subsequent controller's
draw step) — the same real triggered ability, just two different timings.
It puts a real lore counter (`RealCard.counters`, via the existing
`state.putCounter` — no parallel counter mechanism), fires whichever
`chapterN` trigger matches the new count, and — only once the count
reaches the Saga's own greatest chapter number — checks 714.4's sacrifice.

The 714.4 check is where this gets interesting: Jill/Dion's own chapter III
doesn't just resolve and let the Saga get swept away — it exiles-and-
returns itself (transforming back), while Jecht/Braska's own chapter III
(sacrifice 2 opponent creatures) does nothing to its own zone. Rather than
special-case "is this specific card one that transforms back," `advanceSaga`
uses a real, EXISTING mechanic as the signal: `state.move()`'s own 400.7
zone-change reset already wipes `RealCard.counters` (lore counters
included) the instant a chapter's own effect changes the permanent's zone.
So after firing the final chapter, `advanceSaga` checks whether the lore
count it JUST SET is still there — if a zone change already reset it, 714.4's
sacrifice is skipped, correctly and for free, no per-card logic anywhere.

```ts
advanceSaga(engine, real, registered); // 714.2b/c + 714.4, one function
transformPermanent(engine, real, newFace, ctx, actions); // 714.2b's "or transforms into a Saga"
```

`resolveTop` calls `advanceSaga` on a fresh Saga's own ETB; a new
`advanceSagasAfterDrawStep` (called from `doAdvance` on entering Main1 —
structurally exact for "the draw step just ended" in this engine's fixed
phase list, same reasoning `fireOnPhaseEnterTriggers` already established)
calls it for the ACTIVE player's own registered Sagas each turn.

`transformPermanent` covers the OTHER direction — a permanent transforming
INTO a Saga (Jill/Dion/Jecht's own front-face activated ability): it
re-registers `GameEngine.resolvedPermanents` to the new face and
immediately runs the same 714.2b/c initialization, since a front face isn't
a Saga at all and would otherwise never get a lore counter.

**Real, deliberately scoped gap:** a transforming card's own `custom`
effect (card.ts, engine-agnostic by design — it only ever receives
`ctx`/`actions`, never a `GameEngine` reference) has NO way to call
`transformPermanent` itself. A caller piloting the game must call it
explicitly right after running the transform's own activated ability — the
same "explicit signal, not auto-inferred" convention `harness.ts`'s own
`SequenceStep.face` field already established for this exact problem.
Retrofitting the 3 real transforming cards' own effects to somehow trigger
this automatically is out of scope here (there's no hook for them to call
even if retrofitted).

### Stun and finality counters — narrow per-object replacements, `state.ts`

Verified against the real pool first: `counterType:` values used across
`functional-model/cards/<slug>/definition.ts` are overwhelmingly `+1/+1`
(27), plus `stun` (Ice Flan, Tonberry), `Stun` (Omega, Heartless Evolution
— a real casing inconsistency between the cards themselves; `cards/*` is
out of scope to fix, so `untap()` checks both keys), and `finality`
(Relentless X-ATM092).

Real Forge models both as genuine per-object `ReplacementEffect`s
(`Card.java` ~7056-7076), registered dynamically whenever the counter is
present:
- `STUN` replaces the `Untap` event: "If this permanent would become
  untapped, instead remove a stun counter from it" (CR 122.1d).
- `FINALITY` replaces a Battlefield→Graveyard `Moved` event with
  Battlefield→Exile: "If CARDNAME would die, exile it instead."

This engine has no general 614/616 replacement dispatcher (gap #8 in
ENGINE_GAPS.md proposes one, narrowly, for damage prevention only) — but
both of these counters only ever intercept exactly ONE real mutation
method each, so they're modeled as a direct check at that one chokepoint
instead of a dispatcher:

```ts
// GameState.untap
const stunKey = (card.counters['stun'] ?? 0) > 0 ? 'stun' : (card.counters['Stun'] ?? 0) > 0 ? 'Stun' : undefined;
if (stunKey) { this.putCounter(card, stunKey, -1); return; }
card.tapped = false;

// GameState.move
if (card.zone === 'Battlefield' && to === 'Graveyard' && (card.counters['finality'] ?? 0) > 0) to = 'Exile';
```

No explicit counter removal is needed on the finality redirect — moving to
Exile already wipes `card.counters` via the existing 400.7 reset (the same
mechanic Saga automation above reuses), so there's nothing left to remove
by the time the permanent could ever be checked again.

### Equip (301.5c) — `canActivateAbility`/`unsupportedCostComponent`

Verified against the real pool first: 11 real Equipment cards. 7 already
had a bare mana-only `activationCost` (`'{2}'`, e.g.) with no literal
"Equip" text and so were already payable — but, like every other
Equipment card, missing 301.5c's own sorcery-speed timing restriction,
since that restriction is real-Forge tied to the permanent's card TYPE
("Equipment"), not printed as "activate only as a sorcery" cost text the
way `canActivateAbility`'s pre-existing text-pattern check expects. 4 more
(Coral Sword `Equip {1}`, Magitek Scythe `Equip {2}`, Bard's Bow
`Equip {6}`, Ultima Weapon `Equip {7}`) additionally had a literal "Equip"
cost-string prefix that made `unsupportedCostComponent` reject them
outright (the whole-part regex requires the ENTIRE cost component be
`{...}` groups; "Equip {1}" fails that with the bare word "Equip" in it).

Two small, narrow additions fix both real gaps at once:

```ts
// unsupportedCostComponent — strip a literal "Equip"/"Equip—" prefix
// the same way {T} already is, BEFORE checking each part is pure mana.
const stripped = cost.replace(/^Equip[\s—-]*/, '').replace(/\{T\}/g, '')...

// canActivateAbility — 301.5c's own type-based sorcery-speed gate,
// independent of any cost text.
if (isEquipment(card) && !sorcerySpeedTimingOk(engine, controller)) { ... }
```

Dark Knight's Greatsword's own `Equip—Pay 3 life (activate only once each
turn)` correctly still rejects — stripping the "Equip—" prefix leaves
"Pay 3 life", which still isn't a pure-mana cost component, so
Pay-life stays a real, separately-tracked gap (ENGINE_GAPS.md gap #11),
not silently legalized by this change.

### Crew (702.121b/c) — `canActivateAbility`/`activateAbility`

`CardDefinition.crewCost` already existed as a declared field before this
pass, entirely unconsumed by any real code. Checked the real pool: 5
Vehicle cards set it, 3 of which (Magitek Armor, The Prima Vista, The
Lunar Whale) also already declare `effects: [{ kind: 'animate', target:
'self', types: ['Artifact', 'Creature'] }]` — meaning the RESOLUTION half
of Crew was already fully wired through the existing `animate` Effect/
`resolveCard` pipeline; only the COST half (paying it at all) was
missing.

Crew's own real cost — "tap creatures you control with total power >= N"
— has no `{}` mana/tap shape at all, so it can't reuse
`unsupportedCostComponent`'s string parsing. Same "caller supplies the
real objects, engine only validates" shape `declareBlockers` already
established for combat: both `canActivateAbility` and `activateAbility`
take a new optional `crewedBy: RealCard[]`, and a `crewCost`-bearing card
bypasses the free-text cost checks entirely:

```ts
canActivateAbility(engine, controller, vehicle, card, undefined, crewedBy);
activateAbility(engine, controller, vehicle, card, ctx, actions, undefined, crewedBy);
```

Legal iff every creature in `crewedBy` is controlled by the activator,
is actually a creature (`effectiveTypes`), is untapped, and their summed
`effectivePT` power meets `crewCost`. No sorcery-speed restriction (real:
702.121c has none) and no 302.6 summoning-sickness check on the tapped
creatures (real: sickness restricts a creature's OWN {T} ability or
attacking, not being tapped as a cost by a DIFFERENT permanent's
ability — the same real distinction Convoke-shaped tap-as-cost effects
rely on). `activateAbility` taps the listed creatures (never the Vehicle
itself) and pushes onto the stack exactly like any other activated
ability — no new Effect kind needed, since `animate` already exists and
already resolves through `resolveCard`.

Cargo Ship and The Regalia both set `crewCost` but declare neither
`activationCost` nor `effects` in their own `definition.ts` (their own
comments say the wiring doesn't exist yet) — `activationCostFor` returns
`undefined` for them, so `canActivateAbility`'s existing "has no such
activated ability" check correctly rejects them. Same `cards/*`-boundary
situation as gap #8's damage-prevention shields (ENGINE_GAPS.md) — the
engine-side mechanism is ready the moment those two files can be edited.

**Inherited, pre-existing limitation, not a new gap**: `animate`/
`LayerSet` track no duration (`layers.ts`'s own documented scope), so a
crewed Vehicle becomes a creature PERMANENTLY rather than "until end of
turn" — the same simplification the 3 real cards' own `effects:
[animate]` already committed to before this pass touched anything.

### Non-basic mana sources — a narrow real slice, `mana.ts`/`state.ts`/`engine.ts`

`mana.ts` only ever recognized basic lands (subtype-inferred color).
Checked every real `{T}: Add ...` static-ability string across the pool
(35 cards use one shape or another) and found 10 that fit a genuinely
narrow, correct slice: an EXACT, single-color, unrestricted
`"{T}: Add {X}."` string (`manaAbilityColorFromStaticText`). A dual/
choice-of-color ability, a restricted one, a colorless one, or a variable
one are all explicitly still NOT recognized (see this file's own doc
comment for exactly why each is a bigger, separate lift).

The hard part isn't the text match — it's that `RealCard` carries no
live `CardDefinition` reference to re-derive "does this thing make mana"
from later. So the color is derived ONCE, for real, at the exact moment
a permanent resolves onto the battlefield (`resolveTop`, same hook Saga
automation and `enteredThisTurn` already use), and stored on a new
`RealCard.manaAbility` field:

```ts
real.manaAbility = manaAbilityColorFromStaticText(resolved.card.staticAbilities);
```

`mana.ts`'s own `manaColorOf` then checks a basic-land subtype first,
falling back to `card.manaAbility` — so `untappedManaSources`/
`canAfford`/`payMana` all pick up a real non-Land mana source for free,
no changes needed to their own logic.

The one real wrinkle: 3 of the 10 qualifying cards (Druid of the Cowl,
Goobbue Gardener, Llanowar Elves) are CREATURES, and 302.6's own
summoning-sickness restriction genuinely applies to a `{T}` mana ability
exactly like any other `{T}` ability — a basic land is never sick, so
this was never an issue before. A new `payableManaSources(engine, player)`
wraps `untappedManaSources`, additionally excluding a still-sick creature
mana source (Haste exempts it, same check `canActivateAbility` already
does) — `engine.ts`'s 4 call sites (`canCastSpell`/`castSpell`/
`canActivateAbility`/`activateAbility`) all use this wrapper now instead
of calling `untappedManaSources` directly.

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
- **Turn-structure completeness (2-player only)**: Cleanup's real
  discard-to-hand-size (514.1) and damage-clearing (514.2), real
  `on: 'upkeep'`/`'endStep'` trigger auto-fire for the active player's own
  permanents, and extra turns (500.7) — see "Turn-structure completeness"
  above for the full scope and what's still deferred.
- **Saga lore-counter automation (714)** — `saga.ts`: real lore counters,
  chapter auto-fire on ETB and each subsequent controller draw step, and
  714.4's own completion-sacrifice (correctly skipped for a chapter that
  transforms the Saga back instead) — see "Saga lore-counter automation"
  above for the full scope and its one deliberately deferred gap
  (per-card auto-detection of a transform).
- **Stun and finality counters** — `GameState.untap`/`GameState.move`: real
  CR 122.1d untap-replacement and a real die→exile replacement, each
  modeled as a narrow check at the one real mutation method it intercepts
  — see "Stun and finality counters" above.
- **Equip (301.5c)** — a real "Equip {N}" cost-string prefix now parses as
  pure mana, and any Equipment-typeLine permanent's activation is gated to
  sorcery-speed regardless of its own cost text — see "Equip (301.5c)"
  above.
- **Crew (702.121b/c)** — a real structured cost (`crewCost` + explicit
  `crewedBy` creature list) bypassing the free-text cost checks entirely,
  reusing the existing `animate` Effect/stack pipeline for resolution —
  see "Crew (702.121b/c)" above.
- **Non-basic mana sources — narrow slice** — a real single-color,
  unrestricted `{T}: Add {X}.` static ability derived at ETB onto a new
  `RealCard.manaAbility` field, with real 302.6 summoning-sickness
  enforcement for a creature mana source — see "Non-basic mana sources"
  above.

## Explicitly out of scope (real gaps, not silently assumed away)

- **Target-legality checking at cast/declare time.** `card.ts`'s own effect
  system resolves/chooses targets *lazily*, inside `resolveCard`, at
  resolution time — there's no pre-resolution "declare and validate targets"
  step anywhere in this codebase to hook a legality check onto. Retrofitting
  one means redesigning `Effect`'s entire resolution model; not attempted here.
- **A player losing the game (704.5a) / planeswalker loyalty 0 (704.5i).**
  No "game over" concept exists anywhere in this codebase yet, and no FIN
  card needs the loyalty case today — see `sba.ts`'s own header.
- **"Each player's"/"each opponent's" upkeep or end-step triggers, and
  "skip your next X step/phase" effects.** `fireOnPhaseEnterTriggers` only
  fires a permanent's `'upkeep'`/`'endStep'` trigger during ITS OWN
  controller's phase; no FIN card in this pool needs either the
  "each"-variant or a phase-skip today (checked).
- **Priority-holder tracking between calls.** Real 117.1a also requires the
  caster hold priority at the moment of casting; `priority.ts`'s own header
  already documents why this simplified model has no persistent "who
  currently holds priority" state between calls (it's scripted per round, not
  simulated) — a caller keeps this honest by only calling `castSpell` between
  `stepPriority` rounds, not by the engine enforcing it directly.
- **Non-basic mana sources — the remainder.** A dual/choice-of-color
  ability, a restricted one, a colorless one, or a variable one (Elvish
  Archdruid's own `{T}: Add {G} for each Elf you control`, e.g.) are still
  not recognized mana sources — only a narrow single-color, unrestricted
  slice is (see "Non-basic mana sources" above and `mana.ts`'s own
  header).
- Alternate costs, X spells, modal/split costs, casting from anywhere but hand.
- A real AI/player decision process — unchanged from `priority.ts`'s own
  existing scope note: every round's choices are supplied by the caller.

## Tests

`mana.test.ts` (cost parsing, affordability, payment, `basicLandsFor` — legal
and illegal cases), `engine.test.ts` (sorcery-speed timing, affordability,
attacker/blocker legality, combat damage — unblocked/blocked/Trample/
Deathtouch/First-and-Double-Strike, all-or-nothing declaration — activated-
ability legality/resolution, the `resolveCard`-dispatch-collision fix, real
upkeep/end-step trigger auto-fire — including the "not registered"/"wrong
player" non-firing cases — and `queueExtraTurn`), `sba.test.ts` (704.5f/g/
h/j — including Indestructible correctly blocking 704.5g but NOT 704.5f,
and a combined multi-issue sweep proving the 704.3 loop-until-stable
shape), `turn.test.ts` (Cleanup's own 514.1/514.2 actions, and extra
turns taking priority over the normal rotation, including FIFO ordering
for multiple queued turns), and `saga.test.ts` (a plain multi-chapter
Saga's own ETB-through-final-sacrifice arc across several real turns,
controller-scoping, a transform-back Saga surviving instead of being
sacrificed, `transformPermanent`'s own "transforms into a Saga" vs.
"transforms into a non-Saga" cases, and `advanceSaga`'s defensive no-ops).
`state.test.ts` also covers the stun-counter untap-replacement (both real
casings, multi-counter decrement, and the no-counter negative path) and
the finality-counter die→exile replacement (including a non-Graveyard
destination correctly NOT being redirected). `engine.test.ts`'s own
`Equip (301.5c)` describe block covers a legal mana-only equip
activation, the 301.5c timing rejection outside a main phase (even with
no "activate only as a sorcery" cost text), an unaffordable equip cost,
Pay-life correctly still rejecting despite the "Equip" prefix strip, and
a non-Equipment permanent confirming no false-positive sorcery-speed gate.
Its `Crew (702.121b/c)` describe block covers a legal single-creature
crew (including the resolved ability genuinely animating the Vehicle via
a real, non-stub `animate` action), multiple creatures combining their
power, insufficient total power, no creatures specified, an opponent's
creature, an already-tapped creature, a non-creature permanent, legality
outside a main phase/with a non-empty stack (no sorcery-speed
restriction), and a summoning-sick creature still being allowed to crew.
`mana.test.ts` covers `manaAbilityColorFromStaticText` (recognized/
skipped shapes: restricted, dual, colorless, variable, none) and
`untappedManaSources` picking up a real `manaAbility`-bearing non-Land
source. `engine.test.ts`'s own `Non-basic mana sources` describe block
covers a resolved artifact mana rock genuinely becoming payable (and
really getting tapped), a freshly-resolved mana-dork CREATURE correctly
NOT counting toward affordability the turn it enters (302.6), the same
dork correctly counting on a later turn, and a dual-color ability
correctly not being recognized at all.

## Gap analysis vs. real Forge

See `ENGINE_GAPS.md` for the full, prioritized "what's still missing to reach
parity with Forge" writeup (turn/phase completeness, combat, alternate costs,
replacement effects, state-based actions, and what's an intentional,
accepted simplification vs. a real gap still worth closing).
