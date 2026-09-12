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

// Queued extra phase GROUPS (500-series, ENGINE_GAPS.md gap #17, closed
// 2026-09-12) — genuinely distinct from a whole extra TURN above: repeats/
// inserts one more occurrence of the CURRENT turn's own EndOfTurn or Combat
// phase group. Y'shtola Rhul's own "additional end step" is the real FIN
// card wired to this; see "Queued extra phase groups" below.
queueExtraPhase(engine, 'EndOfTurn'); // or 'Combat'
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
nothing UNLESS it has Trample.

First/Double Strike's real two-STEP ordering (510.4/510.5, ENGINE_GAPS.md
gap #9, closed 2026-09-12) is a genuinely distinct `turn.ts` phase —
`'CombatFirstStrikeDamage'`, between `'CombatDeclareBlockers'` and
`'CombatDamage'` in `PHASES`, structurally mirroring Forge's own 13-entry
`PhaseType` enum — not just internal math. `turn.ts`'s own `advancePhase`
always walks through it unconditionally (it has no combat state to decide
otherwise with); `engine.ts`'s `doAdvance` is the real conditionality layer
(Forge's own `PhaseHandler.isSkippingPhase`/`onPhaseBegin` equivalent):
when NO currently-declared attacker or blocker has First or Double Strike
(`combatHasFirstOrDoubleStrike`, via `effectiveKeywords` so a GRANTED First
Strike counts too), it auto-advances past the step without ever presenting
it to a caller. Combat damage assignment is correspondingly split into two
exported functions instead of two internal passes within one call —
`resolveFirstStrikeCombatDamage` (First/Double Strike combatants only) for
the real `CombatFirstStrikeDamage` step, `resolveCombatDamage` (Double
Strike again, plus everyone without First Strike) for the real
`CombatDamage` step. A creature already lethally damaged
(`isLethallyDamaged`, read fresh on every call — real, persistent state,
not cached across the two calls) deals no further damage and receives
none, same effective ordering a real `checkStateBasedActions` sweep
between the two real steps produces (a caller runs one there, same
established "caller-invoked SBA" convention). A caller with no First/
Double Strike creature in play needs no other change: `resolveCombatDamage`
alone, once, at the single real `CombatDamage` step, behaves exactly as
before this split.

**What this does NOT do:** destroy anything. Real creature death from
combat damage is a state-based action (704.5g/704.5h) — see the next
section. Instead, each of `resolveFirstStrikeCombatDamage`/
`resolveCombatDamage` returns its own `CombatDamageResult` — every creature
that took damage so far, and whether that damage is lethal — computed via
the SAME shared `isLethallyDamaged` (state.ts) the next section's
`checkStateBasedActions` uses, so the two never disagree.

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

### Queued extra phase groups (500-series, ENGINE_GAPS.md gap #17, closed 2026-09-12)

Genuinely distinct from `extraTurns` just above: "there is an additional end
step after this step" (Y'shtola Rhul) or "there is an additional combat
phase" (Balthier and Fran, Genji Glove — both real FIN cards, though their
own OTHER unmodeled clauses — an optional mana payment, a `FirstCombat$
True`-gated attack trigger — stay untouched by this closure, see
ENGINE_GAPS.md gap #17's own writeup) repeats/inserts ONE step-group within
the SAME turn — no fresh Untap/Upkeep/Draw, same active player. Real Forge
citation: `AddPhaseEffect.java` (forge-game/.../ability/effects/
AddPhaseEffect.java) resolves `DB$ AddPhase` by pushing onto
`PhaseHandler.extraPhases: Map<PhaseType, Stack<ExtraPhase>>`
(`PhaseHandler.java` line 74, keyed by the real `AfterPhase$`);
`PhaseHandler.advanceToNextPhase` (lines 156-174) checks that map FIRST,
the moment the phase that's ending would otherwise just advance normally,
and pops (LIFO) an `ExtraPhase` to visit instead.

`turn.ts`'s own `TurnState.queuedExtraPhases: PhaseGroup[]` (`PhaseGroup =
'EndOfTurn' | 'Combat'`, the two real `PhaseType.PHASE_GROUPS` entries this
pool needs) mirrors this — `advancePhase` checks it against whichever group
the CURRENT phase is the last step of, jumping `phaseIndex` back to that
group's first step instead of advancing/wrapping normally when a match is
queued (FIFO here vs. Forge's own per-key LIFO — no FIN card ever queues
more than one at a time, so this is observably identical).
`TurnState.phaseGroupEntryCount` mirrors Forge's own `nCombatsThisTurn`/
`nEndOfTurnsThisTurn` counters (`PhaseHandler.java` lines 76-80, 299, 362),
read via `isFirstPhaseGroupOccurrenceThisTurn(turn, group)` — the real
"if it's the FIRST end step/combat phase of the turn" gate every one of
these cards' own oracle text needs (real Forge citation: `isFirstCombat()`/
`Count$FinishedEndOfTurnsThisTurn`, `PhaseHandler.java` line 969;
`AbilityUtils.java` lines 2204-2207).

A card's own effect triggers this via two new, general primitives: `card
.ts`'s `EffectContext.firstPhaseGroupOccurrenceThisTurn?: boolean` (same
"caller-supplied real fact" convention `castFrom`/`mode`/`xPaid` already
establish — set for real by `engine.ts`'s `fireOnPhaseEnterTriggers` the
moment an `'endStep'` trigger auto-fires) and `Actions
.queueExtraPhase(phaseType: PhaseGroup): void` (`interfaces.ts`'s own real
Forge-cited declaration alongside `delayUntil`'s — genuinely distinct: that
one runs an arbitrary callback once a phase is reached, this repeats the
phase/step ITSELF). `engine.ts`'s `queueExtraPhase(engine, phaseType)` is a
thin wrapper, same shape `queueExtraTurn` already has. Y'shtola Rhul's own
`definition.ts` calls `actions.queueExtraPhase('EndOfTurn')` exactly when
`ctx.firstPhaseGroupOccurrenceThisTurn` is true — real now, not documentary
text. No synergy Fact represents this (same "never modeled" treatment
`queueExtraTurn`/gap #3 already established) — real turn-structure
bookkeeping isn't a produce/consume-shaped board effect any Fact vocabulary
covers; `scripts/verify-synergy.mjs`'s own `IGNORED_FNS` set covers the new
`fn:'queueExtraPhase'` trace line for the same reason `phase`/`delayUntil`
already are.

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

### Non-basic mana sources — `mana.ts`/`state.ts`/`engine.ts`

`mana.ts` only ever recognized basic lands (subtype-inferred color).
Checked every real `{T}: Add ...` static-ability string across the pool
(35 cards use one shape or another) and found 10 that fit a genuinely
narrow, correct slice: an EXACT, single-color, unrestricted
`"{T}: Add {X}."` string (`manaAbilityColorFromStaticText`), PLUS
(closed 2026-09-12, ENGINE_GAPS.md gap #5's own dual/choice-of-color
remainder) 12 more that fit an EXACT `"{T}: Add {X} or {Y}."` string
(`manaAbilityColorsFromStaticText` — already existed for
`scripts/prefill-mana-facts.mjs`'s own synergy-FACT generation, now ALSO a
real payment/affordability primitive). A restricted ability or a variable
one are still explicitly NOT recognized (see this file's own doc comment
for exactly why each is a bigger, separate lift — a real spendable-mana-
pool mechanism for the former, teaching `payMana` that one tap can yield
more than one mana unit for the latter).

The hard part isn't the text match — it's that `RealCard` carries no
live `CardDefinition` reference to re-derive "does this thing make mana"
from later. So the color(s) are derived ONCE, for real, at the exact
moment a permanent resolves onto the battlefield (`resolveTop`/`playLand`,
same hook Saga automation and `enteredThisTurn` already use), and stored
on `RealCard.manaAbility` — widened from a bare `ManaColor` to
`ManaColor | ManaColor[]` for this pass:

```ts
real.manaAbility = deriveManaAbility(resolved.card.staticAbilities); // single-color match first, dual-color fallback
```

`mana.ts`'s own `sourceColors(card): ManaColor[]` (renamed/generalized from
the old single-`ManaColor`-returning `manaColorOf`) checks a basic-land
subtype first, falling back to `card.manaAbility` (normalized to an array
either way) — so `untappedManaSources` picks up a real non-Land mana
source for free either way. `canAfford`/`payMana` themselves needed a real
rewrite, not just a wider return type: a dual source can pay EITHER of its
two colors, which is a genuine assignment problem (which source pays which
requirement) rather than a fixed per-color lookup. `mana.ts`'s new
`assignManaRequirements(sources, requirements)` — exhaustive backtracking,
matching each `{colors: ManaColor[]}` requirement (a fixed pip is
`{colors:[X]}`, a Hybrid pip, see below, is `{colors:[X,Y]}`) against the
first not-yet-used source whose own producible colors overlap, undoing and
retrying on failure — is shared by this closure AND the Hybrid-pip closure
below, since both are the exact same shape from the requirement side; only
the SOURCE side (a source with more than one producible color) is new
here. `canAfford`/`payMana` were rewritten around this shared assignment
(verified NOT to change behavior for the ordinary single-color case — same
source-iteration order preserved).

The one real wrinkle (unchanged from before this pass): 3 of the 10
single-color-only qualifying cards (Druid of the Cowl, Goobbue Gardener,
Llanowar Elves) are CREATURES, and 302.6's own summoning-sickness
restriction genuinely applies to a `{T}` mana ability exactly like any
other `{T}` ability — a basic land is never sick, so this was never an
issue before. A new `payableManaSources(engine, player)` wraps
`untappedManaSources`, additionally excluding a still-sick creature mana
source (Haste exempts it, same check `canActivateAbility` already does) —
`engine.ts`'s 4 call sites (`canCastSpell`/`castSpell`/
`canActivateAbility`/`activateAbility`) all use this wrapper now instead
of calling `untappedManaSources` directly. None of the 12 dual-color cards
are creatures (all Town-cycle lands), so this doesn't add a new
sickness-adjacent case.

### Hybrid mana pips and `{X}` costs — `mana.ts`/`engine.ts` (closed 2026-09-12, ENGINE_GAPS.md gap #6)

`parseManaCost` used to throw on Hybrid (`{G/U}`-shaped), Phyrexian, `{X}`,
and a colorless-in-a-cost `{C}` pip. Grepped every real `manaCost:` string
across the ~321-card pool first: exactly 3 real cards need Hybrid or `{X}`
(Thranduil, Sindarin Liege // Silvan Rally's `{2}{G/U}{G/U}`/
`{1}{G/U}{G/U}`; Choco Comet's `{X}{R}{R}`; Doppelgang's
`{X}{X}{X}{G}{U}`) — zero need Phyrexian or a `{C}` cast-cost pip, so those
two stay unmodeled (fail-loud, not silently mis-costed).

`ParsedManaCost` gained two fields: `hybrid: ManaColor[][]` (one 2-color
entry per printed Hybrid pip) and `xCount: number` (a COUNT of `{X}`
symbols, not a value — CR 107.3c: multiple `{X}`s in one cost share the
SAME chosen value). Paying a Hybrid pip reuses the exact same
`assignManaRequirements` machinery the dual-color-SOURCE closure above
introduced — a Hybrid pip is just a requirement accepting 2 colors instead
of 1. A new `resolveXCost(cost, x)` folds a caller-chosen `x` (default 0,
a real CR 107.3b-legal choice) into `generic` before `canAfford`/`payMana`
ever see the cost; `engine.ts`'s `effectiveCastCost`/`canCastSpell`/
`castSpell` (and `engine-trace.ts`'s `pilotCast`) all take a new optional
`x` param threaded the same way `declaredTarget` already is — `x` only
affects affordability/payment, a caller wanting the card's own EFFECT to
see the same value must also set `ctx.xPaid` itself (`card.ts`'s
pre-existing field). `formatManaCost` renders both a resolved `{X}` cost
(the real paid total, e.g. `{3}{R}{R}`, not the printed template) and real
Hybrid pips (`{G/U}`); `basicLandsFor` provisions one land per Hybrid pip
too (arbitrarily the pip's first printed color — a real payer could choose
either, this helper just needs ONE legal board state).

Neither Choco Comet's, Doppelgang's, nor Thranduil // Silvan Rally's own
`scenarios.ts` needed touching — `harness.ts` never calls `parseManaCost`
at all (a scenario's own board setup is manual, not derived from
`manaCost`), so this gap only ever blocked `engine.ts`'s real-pilot
`canCastSpell`/`castSpell` path, which none of these 3 cards' own
scenarios use.

### Sacrifice-cost activated abilities — trusted, not re-paid, `unsupportedCostComponent`

Checked every real `Sacrifice`-shaped `activationCost` string (12 files).
Three — Ahriman, Phantom Train, Quina, Qu Gourmet — already declare a
matching `{ kind: 'sacrifice', notSelf: true, ... }` as the FIRST effect
in `card.effects`, each with its own comment explaining this is a
deliberate "cost modeled as effect #1, for trace visibility" choice, not
an oversight. That meant the real consequence already happened for real
at resolution — the ONLY thing broken was that `canActivateAbility`
rejected the cost string outright, so these 3 real cards couldn't be
activated through the engine at all.

Rather than have the engine ALSO pay this cost (which would
double-sacrifice, since the card's own effect already does it),
`unsupportedCostComponent` now recognizes the shape and trusts the
card:

```ts
if (/^Sacrifice (another|an?|two)\b/i.test(part) && (card.effects ?? []).some((e) => e.kind === 'sacrifice')) continue;
```

The "another/a/an/two" wording is the key signal — it's the one that
NEVER means self (unlike "Sacrifice this X"/"Sacrifice <CardName>"), and
every real card using it in this pool already pairs it with a matching
effect. A "Sacrifice N X" cost with NO matching effect (The Gold
Saucer's own "Sacrifice two artifacts," whose own comment says the
sacrifice is cost-only, not modeled) still correctly falls through and
gets rejected — accepting it would mean nothing is ever actually
sacrificed.

**Self-sacrifice is deliberately never recognized, on purpose, not by
omission**: Blazing Bomb ("Sacrifice this creature") and Zack Fair
("Sacrifice Zack Fair") both read `ctx.self`'s own live power/counters
in their OWN effects, and both currently rely on the sacrifice NEVER
actually happening for that to stay correct (their own comments say so).
Real Forge would read this off 608.2h last-known-information instead —
a real, separate, unbuilt gap here — so genuinely sacrificing `self` as
part of paying the cost would silently break both cards (their own
`ctx.self` would report post-zone-change-reset values instead). Left
unsupported rather than risk that regression.

### "Play the top card of your library" (CR 601/305) and "attacked this turn" (508.1) — `engine.ts`/`state.ts`/`card.ts` (closed 2026-09-12, ENGINE_GAPS.md gap #16)

The Lunar Whale's own "As long as The Lunar Whale attacked this turn, you
may play the top card of your library" needed two independent, real
primitives:

```ts
// engine.ts — reuses playLand/canPlayLand or castSpell/canCastSpell
// verbatim, dispatched on the revealed card's own real typeLine (real
// Forge citation: PlayEffect.java's own identical land-vs-spell branch).
canPlayFromLibraryTop(engine, caster, cardReal, card); // ALSO checks cardReal is genuinely caster.library[0]
playFromLibraryTop(engine, caster, cardReal, card, ctx, actions);

// state.ts — a real, persistent per-permanent flag, not a fresh-each-combat
// list like GameEngine.attackers.
card.attackedThisTurn; // set by declareAttackers, cleared by state.clearAttackedThisTurn() at Cleanup
```

`card.ts`'s new `kind:'playFromLibraryTop'` Effect (no fields — this
dispatch is total over whatever's on top, never scoped to a subset) peeks
`ctx.you.getCardsIn('Library')[0]` and calls a new `Actions.play(player,
target, card?)` — the `card` param (a new `EffectContext.topLibraryCard`,
threaded in by whoever built the `ctx`) is REQUIRED for any real dispatch,
since `RealCard` carries no live `CardDefinition` reference (the same
"caller supplies the real fact" convention `castFrom`/`declaredTarget`
already establish). `harness.ts`'s own `loggingActions.play` is a real but
plain (no legality/mana) fallback; `engine-trace.ts`'s `pilotActions`
overrides JUST this one method with the real `canPlayFromLibraryTop`/
`playFromLibraryTop` dispatch, since only an engine-piloted caller has the
`GameEngine` reference those need — every other `Actions` method stays
`loggingActions`'s own shared implementation, reused as-is.

`RealCard.attackedThisTurn` mirrors real Forge's own
`CardDamageHistory.attackedThisTurn`/`hasAttackedThisTurn` (set via
`setCreatureAttackedThisCombat`, cleared each turn by `newTurn()`) — a
plain boolean, not a turn-number comparison, since clearing it at this
engine's own Cleanup (the last phase before the next Untap) is functionally
identical to Forge's own "clear at the start of a new turn."

The Lunar Whale's own `definition.ts` wires both together via a
`triggers: [{name:'playFromLibraryTop', effects:[{kind:'playFromLibraryTop'}]}]`
entry — NOT a real CR 603 trigger (this clause is a continuous granted
permission, not something that triggers), but reusing the same "named
effect bundle, manually invoked via `pilotFireTrigger`" shape this engine
already uses for a real triggered ability it can't auto-fire (Ultima
Weapon's own `onEquippedAttacks`); a pilot script is responsible for only
invoking it once `attackedThisTurn` is genuinely set (the engine primitive
itself doesn't know about a specific card's own gating condition, same
split `crewedBy`/`declaredTarget` already establish elsewhere). Its own
`scenarios.ts` (`runEngineScenarios`) is also the FIRST real engine-piloted
Crew scenario in the pool (`pilotActivate` extended to accept a
`crewedBy: RealCard[]`, mirroring `canActivateAbility`/`activateAbility`'s
pre-existing param) — every other `crewCost` card stayed on the flat
`harness.ts` style specifically to sidestep the latent crew/second-ability
collision bug (ENGINE_GAPS.md's own Crew entry), which doesn't apply here
since The Lunar Whale has no second ability.

**Real, still-open, adjacent gap**: The Regalia's own attack-triggered
"reveal cards from the top of your library UNTIL you reveal a land" is an
UNBOUNDED dig-until-a-match effect, genuinely different machinery from
"look at exactly the top card, dispatch on its type" — `kind:
'playFromLibraryTop'` deliberately isn't reused for it (see ENGINE_GAPS.md
gap #16's own closure writeup for why forcing it would misrepresent an
unbounded search as a single-card peek).

### Trigger-doubling ("Panharmonicon effect") — new `triggers.ts` (closed 2026-09-12, ENGINE_GAPS.md gap #13)

A real, general "a triggered ability triggers an additional time" mechanism
— 3 real FIN cards need it (Cloud, Midgar Mercenary; The Masamune; Traveling
Chocobo), each with a genuinely different gate, confirmed by grepping the
pool for "additional time" before building anything narrower. `card.ts`'s
new `CardDefinition.triggerDoubling?: TriggerDoublingGrant[]` declares the
gate (`scope` — who can double; `causedBy`/`entersMatch` — which real cause
qualifies); `state.ts`'s new `shouldDoubleTrigger` is the query-time check
(same "recalculated on read" treatment `effectiveKeywords` already
establishes for gap #14's continuous grants), consulted by a new file,
`triggers.ts`'s `fireTrigger(state, card, ctx, actions, triggerName, cause?,
onDoubled?)` — the ONE shared chokepoint every real trigger-firing call site
in this codebase (`stack.ts`, `engine.ts`'s 3 dispatch sites, `saga.ts`,
`harness.ts`'s scenario runner, `engine-trace.ts`'s `pilotFireTrigger`) now
funnels a named trigger's resolution through, instead of calling
`card.ts`'s `resolveCard` directly. `triggers.ts` is its own new file rather
than living in `state.ts` or `engine.ts` specifically to avoid a genuine
circular VALUE import (`engine.ts` already imports `{advanceSaga}` from
`saga.ts` as a value; `saga.ts` calling back into a `fireTrigger` that lived
in `engine.ts` would be a real runtime cycle neither file has today). See
ENGINE_GAPS.md gap #13's own closure writeup for the full per-call-site
migration, the 3 cards' real gate shapes, and a real, useful, genuinely
unplanned consequence its own scenario surfaced (a card's own ETB doubling
itself via a board-wide grant, when the card matches the grant's own
`entersMatch` filter).

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
- **Queued extra phase groups (500-series)** — a real "insert one more
  occurrence of this turn's own End Step or Combat phase" primitive
  (`turn.ts`'s `queueExtraPhase`/`isFirstPhaseGroupOccurrenceThisTurn`),
  genuinely distinct from a whole extra turn above — see "Queued extra
  phase groups" above.
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
- **Non-basic mana sources — single- AND dual-color** — a real
  unrestricted `{T}: Add {X}.` OR `{T}: Add {X} or {Y}.` static ability
  derived at ETB onto `RealCard.manaAbility` (`ManaColor | ManaColor[]`),
  with real 302.6 summoning-sickness enforcement for a creature mana
  source and a genuine backtracking assignment (`assignManaRequirements`)
  letting a dual source pay either of its two colors — see "Non-basic mana
  sources" above.
- **Hybrid mana pips and `{X}` costs** — real Hybrid (`{G/U}`-shaped) pips
  (paid via the same assignment machinery as a dual-color source above)
  and real `{X}` symbols (resolved via a caller-supplied `x`, CR 107.3b/c)
  — see "Hybrid mana pips and `{X}` costs" above.
- **Sacrifice-cost activated abilities (non-self)** — a real
  "Sacrifice another/a/two X" cost trusted whenever the card's own
  `effects` already pay it for real at resolution, with no risk of
  double-payment — see "Sacrifice-cost activated abilities" above.
- **Trigger-doubling ("Panharmonicon effect")** — a real, general
  `CardDefinition.triggerDoubling` gate, checked at query time
  (`shouldDoubleTrigger`) by a new shared chokepoint (`triggers.ts`'s
  `fireTrigger`) every real trigger-firing call site in this codebase now
  funnels a named trigger through — see "Trigger-doubling" above.

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
- **Non-basic mana sources — the remainder.** A restricted ability
  (Cargo Ship's own real "Spend this mana only to cast an artifact
  spell...") or a variable one (Elvish Archdruid's own
  `{T}: Add {G} for each Elf you control`) are still not recognized mana
  sources — the single-color AND dual-color slices both are now (see
  "Non-basic mana sources" above and `mana.ts`'s own header) — closing
  either of these two remaining shapes needs materially bigger
  infrastructure (a real spendable-mana-pool tracker; teaching `payMana`
  that one tap can yield a variable amount), assessed and deliberately not
  attempted.
- **Phyrexian mana and a colorless-in-a-cast-cost `{C}` pip.** Checked, no
  real FIN card needs either (unlike Hybrid/`{X}`, both closed — see
  "Hybrid mana pips and `{X}` costs" above) — `parseManaCost` still throws
  on either, fail-loud rather than silently mis-costed.
- Modal/split costs, casting from anywhere but hand beyond the existing
  Flashback/Jump-start-shaped `AlternateCost`.
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
skipped shapes: restricted, dual, colorless, variable, none),
`manaAbilityColorsFromStaticText`/`deriveManaAbility` (single-color,
dual-color, and the still-unrecognized restricted/variable shapes), and
`untappedManaSources` picking up a real `manaAbility`-bearing non-Land
source (single- AND dual-color). New (2026-09-12, ENGINE_GAPS.md gaps #5/#6):
`parseManaCost`/`resolveXCost`/`formatManaCost` for real Hybrid pips and
`{X}` (parsing, resolving a chosen `x`, formatting the real paid total,
still throwing on Phyrexian/`{C}`), and `canAfford`/`payMana` describe
blocks for both Hybrid pips AND dual-color sources — including a genuine
backtracking-forced case (a source tried first for one requirement has to
be un-picked once a later, stricter requirement turns out to have no
other option) proving `assignManaRequirements` is real exhaustive search,
not a greedy heuristic that happens to work on the easy cases.
`engine.test.ts`'s own `Non-basic mana sources` describe block covers a
resolved artifact mana rock genuinely becoming payable (and really
getting tapped), a freshly-resolved mana-dork CREATURE correctly NOT
counting toward affordability the turn it enters (302.6), the same dork
correctly counting on a later turn, and (updated 2026-09-12) a dual-color
ability now genuinely paying for EITHER of its two colors via a real
`canCastSpell`/`castSpell` cast (plus the negative "can't pay a third
color" case). New `Hybrid mana costs`/`{X} mana costs` describe blocks
cast synthetic `CardDefinition`s using the SAME real cost strings as
Thranduil // Silvan Rally / Choco Comet through `canCastSpell`/`castSpell`,
proving both are now genuinely castable (and still genuinely rejected when
unaffordable). Its `Sacrifice cost trusted...` describe block covers a
legal Ahriman-shaped activation, a real resolution proving exactly one
OTHER permanent is sacrificed (never the source, never twice — the actual
double-payment risk this fix avoids), a Gold-Saucer-shaped cost with no
matching effect staying rejected, and self-sacrifice cost text staying
rejected even alongside a matching effect.

New (2026-09-12, ENGINE_GAPS.md gap #16): `engine.test.ts`'s own
`canPlayFromLibraryTop / playFromLibraryTop` describe block covers a
rejected non-top card (mutating nothing), a real land dispatched to
`playLand` (Battlefield move, no Stack, real ETB fires, the per-turn
counter increments), a real spell dispatched to `castSpell` (real mana
paid, pushed onto the Stack), an unaffordable spell correctly rejected,
and a rejection outside sorcery-speed timing — all sharing the same
`canCastSpell`/`canPlayLand` legality this primitive reuses, not a
parallel check. Two new cases in its existing `declareAttackers` describe
block cover the real `attackedThisTurn` flag: set on a legal declaration,
NOT set on a rejected one. `turn.test.ts`'s two new cases cover the same
flag's full lifecycle at the `state.ts`/`turn.ts` level: it persists
through every remaining phase of the turn it was set, then clears at the
real Cleanup; it does not persist into a later turn (a real per-turn
reset, not a one-time clear).

New (2026-09-12, ENGINE_GAPS.md gap #13): `functional-model/triggers.test.ts`
(new file, 12 cases) covers `fireTrigger`/`shouldDoubleTrigger` directly —
a baseline no-grant case, all 3 real cards' own gate shapes each genuinely
doubling, and the negative cases proving each gate's own real precondition
is enforced (not just its presence): Cloud's shape doesn't double while
unequipped; Masamune's shape doesn't double with no/wrong cause or a
different creature's own trigger; Chocobo's shape doesn't double a
non-land/non-Bird cause or an opponent's own permanent. `engine.test.ts`'s
new `Trigger-doubling` describe block (3 cases) additionally proves the
real `engine.ts` wiring itself, not just `triggers.ts`'s own pure logic: a
permanent's own ETB does NOT double through the real `castSpell`->
`resolveTop` path before anything is equipped to it; a LATER real
upkeep/end-step auto-fire (`fireOnPhaseEnterTriggers`) DOES double once
genuinely equipped; an unrelated permanent's own trigger does NOT double.

New (2026-09-12, ENGINE_GAPS.md gap #17): `turn.test.ts`'s new `queued
extra phase group` describe block covers a queued extra End Step
genuinely re-entering End Step exactly once (not infinitely) before
Cleanup, a queued extra Combat phase re-entering the WHOLE 6-step combat
sequence without re-running Untap/Upkeep/Draw/Main1, a full turn with no
queued extra phase behaving identically to before this pass (regression),
and `phaseGroupEntryCount` resetting at the next turn-wrap. `engine.test
.ts`'s new `queueExtraPhase` describe block proves the real `engine.ts`/
`card.ts` wiring end-to-end: a real `onEndStep` trigger fired through
`castSpell`/`resolveTop`/`fireOnPhaseEnterTriggers` genuinely re-fires once
when it queues, does not re-queue a third time, and Cleanup still runs
normally afterward — plus its own regression case.

## Gap analysis vs. real Forge

See `ENGINE_GAPS.md` for the full, prioritized "what's still missing to reach
parity with Forge" writeup (turn/phase completeness, combat, alternate costs,
replacement effects, state-based actions, and what's an intentional,
accepted simplification vs. a real gap still worth closing).
