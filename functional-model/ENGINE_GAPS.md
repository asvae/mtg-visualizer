# Gap analysis: this engine vs. real Forge

Companion to `ENGINE_DESIGN.md`. That doc explains what `engine.ts`/`mana.ts`
DO; this one is the prioritized inventory of what real Forge does that this
engine still doesn't, plus which gaps are **intentional, accepted
simplifications** (per direct instruction — don't spend effort closing these)
vs. **real gaps still worth closing** toward "more-less feature parity with
Forge."

Every row below is checked against `../mtg-forge`'s actual source, not
guessed — file/line citations follow each item.

**Scope note (user's own words):** "Generally I want all mechanics for FIN
be implemented. As we're focusing on that set right now." Priority from
here on is justified by "does a real FIN card (`functional-model/cards/*`,
~312 cards) actually need this" — grep the real pool first, same discipline
already used for activation-cost shapes, the replacement-effect scope cut,
and this doc's own turn-structure-completeness closure — not abstract
"parity with Forge in general." The prioritized list below stays as a guide
to the underlying rules-engine gaps, but a new item's priority (or whether
it's worth building at all) should cite a real card, not a hypothetical one.

## FIN-specific mechanics closed (real, checked against the pool)

- **Saga lore-counter automation (714)** — `saga.ts` (new file). Verified
  first: 22 real FIN cards model Saga chapters as named `chapterI`/
  `chapterII`/`chapterIII`/(`chapterIV`) triggers (grep `chapterI` across
  `functional-model/cards/<slug>/definition.ts`), 3 of them transforming
  (Jill, Shiva's Dominant // Shiva, Warden of Ice; Dion, Bahamut's Dominant
  // Bahamut, Warden of Light; Jecht, Reluctant Guardian // Braska's Final
  Aeon). `advanceSaga` puts a real lore counter (`RealCard.counters`,
  reusing the existing `putCounter` primitive — no parallel counter
  mechanism invented) and fires the matching chapter (714.2b/c), then
  checks 714.4's own sacrifice once the greatest chapter number is reached
  — SKIPPED, with no card-specific special-casing, when the chapter's own
  effect already reset the permanent's lore counters via a real zone change
  (`state.move`'s existing 400.7 reset) — the exact, general signal that
  distinguishes Jill/Dion's own "transform back instead of being
  sacrificed" chapter III from Jecht/Braska's own "just gets sacrificed
  normally" chapter III, with zero per-card logic. `engine.ts`'s
  `resolveTop` calls it on a fresh Saga's own ETB; a new
  `advanceSagasAfterDrawStep` (called from `doAdvance` on entering Main1,
  structurally exact for "the draw step just ended" in this engine's fixed
  phase list) calls it for the ACTIVE player's own Sagas each turn.
  `transformPermanent` handles the "transforms INTO a Saga" direction
  (Jill/Dion/Jecht's own front-face activated ability) by re-registering
  `GameEngine.resolvedPermanents` to the new face and immediately running
  the same 714.2b/c initialization.
  **Real, deliberately scoped gap**: a transforming card's own `custom`
  effect (card.ts, engine-agnostic by design) has no way to call
  `transformPermanent` itself — a caller piloting the game must call it
  explicitly right after running the transform's own activated ability,
  same "explicit signal, not auto-inferred" convention `harness.ts`'s own
  `SequenceStep.face` field already established. Retrofitting the 3
  transforming cards' own effects to somehow trigger this automatically is
  out of scope (there's no hook for them to call even if retrofitted).
  "Skip a lore counter"/"add an extra lore counter" effects: no FIN card
  needs either (checked).

- **Stun and finality counters — real per-object replacement effects at
  their one real chokepoint.** Checked the real pool for every
  `counterType:` value used (`putCounter`/`putCounterTarget` across
  `functional-model/cards/<slug>/definition.ts`): `stun` (Ice Flan, Tonberry
  — lowercase) / `Stun` (Omega, Heartless Evolution — uppercase, a real
  inconsistency between the cards themselves, `cards/*` out of scope to
  fix) and `finality` (Relentless X-ATM092). Real Forge models both as
  genuine `ReplacementEffect`s registered per-object whenever the counter is
  present (`Card.java` ~7056-7076: `STUN` replaces the `Untap` event by
  removing a counter instead; `FINALITY` replaces a Battlefield→Graveyard
  `Moved` event with Battlefield→Exile) — general 614/616 machinery this
  engine deliberately doesn't have (gap #8 below). Since each of these two
  only ever intercepts exactly ONE real mutation method here
  (`GameState.untap`/`GameState.move`), modeled as a narrow check at that
  one chokepoint instead — same "narrow hook at the one real call site,
  not a general dispatcher" shape gap #8 itself proposes for damage
  prevention. `untap()` checks BOTH the lowercase and uppercase counter key
  so all 3 real stun cards work despite the cards' own inconsistent
  casing. `move()`'s finality check needs no counter removal on redirect —
  moving to Exile already wipes `card.counters` via the existing 400.7
  reset, so the counter can't cause a second (incorrect) redirect later.
  Tests: `state.test.ts`'s `GameState.tap / untap` and `GameState.move —
  FINALITY counter` describe blocks (7 new tests: both counter cases,
  multi-counter decrement, the "no counter → untaps/dies normally"
  negative paths, and "a non-Graveyard destination isn't redirected").

## Accepted simplifications — NOT gaps to close

These came up in conversation explicitly ("we don't need AI yet, and we
simplified layers, I know. Everything else can more-less stay") — noted here
so a future pass doesn't mistake them for missing work:

- **No AI / player decision process.** `priority.ts`'s own header already
  documents this: every round's choices are supplied by the caller, not
  decided by anything in this codebase. Real Forge's equivalent is the whole
  `forge-ai` module — genuinely out of scope here.
- **No persistent priority-holder tracking between calls.** Same file —
  priority is scripted per-round, not simulated continuously
  (`PhaseHandler.getPriorityPlayer()`/`setHasPriority`,
  forge-game/.../phase/PhaseHandler.java ~line 135/1158). A caller keeps this
  honest by convention (only casting between `stepPriority` rounds), not by
  the engine enforcing it.
- **`layers.ts`'s simplified 613.** Only layers 4/6/7 implemented (vs. real
  Forge's full 1-7 + P/T sublayers, `StaticAbilityLayer.java` lines 5-34); no
  613.8 dependency-based reordering (timestamp order only); no duration
  tracking (an applied effect never expires). Documented, accepted as-is.
- **Multiplayer (more than 2 players).** `turn.ts`'s header already notes
  only simple 2-player round-robin is modeled — explicitly out of scope, not
  worth spending effort on. Extra turns and skipped phases are NOT part of
  this exclusion (those stay real gaps — see High priority #3 below);
  strictly the >2-player turn-order case is excluded.

## Real gaps — prioritized

### High priority (load-bearing for "pilot a real game")

1. ~~**Combat: blockers, damage, first/double strike, trample.**~~ **CLOSED**
   (`engine.ts`'s `canBlock`/`declareBlockers`/`resolveCombatDamage`,
   `engine.test.ts`): blocker legality (509.1 — controller/tapped/
   Unblockable/Flying-Reach) and Menace (509.1b/702.111b), both
   all-or-nothing like `declareAttackers`; real damage assignment for
   unblocked/blocked/blocked-but-blockers-already-gone attackers, Trample
   overflow (702.19c), Deathtouch lethal-amount (702.2e), and First/Double
   Strike's two-sub-step ordering (510.5, modeled as two internal passes
   within one call rather than a separate `turn.ts` phase — see below).
   Real reference: `CombatUtil.java` (forge-game/.../combat/CombatUtil.java)
   for blocker legality shape, `Combat.java`'s own `attackerToBlockers`
   multimap for the assignment data shape `engine.blockers` mirrors.
   **What's still NOT done** (folds into gap #2, not re-litigated here): a
   creature this engine computes as lethally damaged is NOT destroyed —
   `resolveCombatDamage` returns a `lethal` flag per creature instead of
   acting on it, since real creature death from damage is itself a
   state-based action (704.5g/704.5h), and general SBAs don't exist yet.
   The real 13th Forge phase (`PhaseType.COMBAT_FIRST_STRIKE_DAMAGE`,
   `PhaseType.java` line 23) is still not a literal `turn.ts` phase — see
   gap #9 below, unchanged, since the two-internal-pass approach only
   fixes damage ORDERING, not phase-list completeness.
2. ~~**State-based actions (704).**~~ **CLOSED for a narrow, real subset**
   (`sba.ts`'s `checkStateBasedActions`, `sba.test.ts`): 704.5f (toughness
   <= 0 → graveyard, bypassing Indestructible), 704.5g (lethal marked
   damage → destroy, respecting Indestructible), 704.5h (any Deathtouch
   damage → destroy), and 704.5j (the legend rule — already real,
   pre-existing `state.checkLegendRule`, now folded into this same
   loop-until-stable sweep, 704.3). Required a real, necessary change to
   `state.dealDamage`: damage to a creature used to be a documented no-op
   (nothing consumed it) — now genuinely marks `card.damageMarked`/
   `deathtouchDamaged` (120.3/702.2b), which `engine.ts`'s
   `resolveCombatDamage` also reads (via the same shared
   `state.isLethallyDamaged`, so combat's own lethal-flag and this sweep's
   destroy-decision never disagree). Real reference:
   `GameAction.java`'s state-based-effects pass (forge-game/.../game/
   GameAction.java, rule citations directly in that method's own comments,
   ~lines 1455-1760 for 704.5f/g/h, ~2006-2065 for 704.5j) — there is no
   `StateBasedAction` class by that name; it's folded into `GameAction`'s
   own method, same here.
   **What's still NOT done, real gaps**: 704.5a (a player at 0-or-less
   life loses the game — no "game over"/game-loss concept exists anywhere
   in this codebase yet, a separate primitive); 704.5i (planeswalker
   loyalty 0 — no FIN card in this pool has a Planeswalker typeLine today,
   checked); aura/equipment illegal-attachment SBAs (no attachment-legality
   tracking exists anywhere in this codebase to check against). Damage
   CLEARING at cleanup (514.2 — a separate rule from the SBA check itself)
   is now done too — see gap #3 below.
3. ~~**Turn-structure completeness (2-player only — see Accepted
   simplifications above for the >2-player exclusion).**~~ **CLOSED for
   real, checked-against-the-pool needs**: (a) **Cleanup's own automatic
   actions** — 514.1 discard-to-maximum-hand-size (default 7 — no FIN card
   modifies max hand size, checked) and 514.2 damage-clearing
   (`state.clearAllDamage()`, NOT the "until end of turn effects end" half
   — `layers.ts`'s duration-not-tracked simplification stays accepted,
   unchanged) — both wired into `turn.ts`'s existing `runPhaseEntryAction`,
   same place Untap/Draw's own actions already lived. (b) **`on:
   'upkeep'`/`'endStep'` trigger auto-fire** — `Trigger.on` (card.ts,
   already extended with `'enter'` in an earlier pass) now also accepts
   `'upkeep'`/`'endStep'`; `engine.ts`'s new `fireOnPhaseEnterTriggers`
   (called from `advance`/`stepPriority` after every phase transition)
   fires them for the ACTIVE player's own permanents, via a new
   `GameEngine.resolvedPermanents` map (populated by `resolveTop`,
   mirroring how a `StackObject` already carries the
   card/ctx/actions triple a trigger needs to resolve, long after the
   original cast). Two real FIN cards would use `'endStep'` (Yuna, Hope of
   Spira; Ultimecia, Time Sorceress) — retrofitting their own
   `definition.ts` is deferred, same as `'enter'`. (c) **Extra turns
   (500.7)** — `TurnState.extraTurns`, a FIFO queue `advancePhase`'s
   turn-wrap branch consumes instead of blindly rotating, plus
   `engine.ts`'s `queueExtraTurn(engine, player)` wrapper. Ultimecia, Time
   Sorceress's own "take an extra turn after this one" is the real FIN
   card that needs this (its own `definition.ts` already flagged this as a
   known gap before this pass — confirmed, not guessed).
   **Still explicitly deferred** (real, but no FIN card in this pool needs
   either today — checked): "each player's"/"each opponent's" upkeep/
   end-step triggers (as opposed to "your own"); "skip your next X
   step/phase" effects.
4. ~~**Target-legality checking at cast/declare time, and re-validation at
   resolution (608.2b, "fizzle").**~~ **CLOSED for the real, load-bearing
   shape (2026-09-12)** — real cast-time target LOCKING (601.2c/602.1) plus
   resolution-time RE-VALIDATION with genuine 608.2b fizzle (including
   partial multi-target fizzle), for every single/multi-target `Effect` kind
   a real FIN removal/bounce/pump/tap/etc. spell actually uses. Turned out
   smaller than the original "redesign Effect's whole resolution model"
   assessment, once actually attempted: `applyEffect`'s own per-branch
   candidate `pool` (already rebuilt from LIVE game state at resolution
   time, in every targeted branch) already doubles as a genuine CR 115
   legality check for free — the only real piece missing was a way to
   PIN which object was chosen, at CAST time, and re-check ITS membership
   in that same pool instead of picking fresh.
   - **Cast-time locking**: `card.ts`'s new `EffectContext.declaredTargets?:
     Card[]` (see its own long doc comment for the full design writeup) —
     `engine.ts`'s `castSpell`/`activateAbility` gained a new
     `declaredTargets?: RealCard[]` param (defaulting to `[declaredTarget]`
     when the pre-existing, cost-reduction-only `declaredTarget` single
     param is given instead — Fate of the Sun-Cryst's own real shape, a
     cost-reduction condition keyed on the SAME object the spell targets,
     is exactly why this default is safe and correct, not just convenient),
     wraps each via `state.ts`'s `wrapCard`, and records them on the pushed
     `StackObject` (`stack.ts`'s new `StackObject.declaredTargets`).
   - **Resolution-time re-validation + fizzle**: `stack.ts`'s `resolveTop`
     now unconditionally copies `StackObject.declaredTargets` onto
     `ctx.declaredTargets` right before resolving (clearing it to `undefined`
     when absent — a resolved permanent's own `ctx` is reused across many
     LATER resolutions, so a stale array from a prior one must never leak
     forward). `card.ts`'s new shared `resolveTargets(pool, qty, ctx,
     actions)` is the one chokepoint 9 targeted-effect branches now call
     instead of a raw `chooseTarget` loop — `destroy`, `move`'s targeted
     branch, `putCounterTarget`, `dealDamageTarget`, `fightTarget`,
     `pumpTarget`, `grantKeywordTarget`, `tapTarget`, `untapTarget`. When
     `ctx.declaredTargets` is set, it takes up to `qty` entries off the
     FRONT (FIFO) that are STILL present in `pool` (by `getId()`), dropping
     — never replacing — any that aren't (608.2b: no new target is ever
     substituted for an illegal one); when unset, behavior is BYTE-FOR-BYTE
     the prior lazy `chooseTarget(pool, ctx.preferTarget)` loop — zero
     regression risk for any of this pool's existing scenarios, all of
     which drive `card.ts` via `harness.ts`'s flat lifecycle and never set
     this field.
   - Real card demonstration: `cards/fate-of-the-sun-cryst/scenarios.ts`
     gained a third real engine-piloted scenario (alongside its existing
     two gap #7 cost-reduction ones) — casts targeting the opponent's real
     Coeurl (a legal target at cast time), then Coeurl is destroyed by
     something else in response (`pilot.state.move` to Graveyard, same
     "represent the real zone change directly" technique
     crystal-fragments-summon-alexander's own scenario already uses for an
     unrelated off-card event) before the spell resolves — the trace shows
     the spell still correctly resolving into its owner's graveyard with NO
     `destroy` log line (contrast the other two scenarios, which each log
     one), real, checkable evidence of the fizzle.
   - New tests: `stack.test.ts`'s new `StackObject.declaredTargets` describe
     block (baseline: a legal declared target is destroyed normally; fizzle
     via the target leaving the battlefield to hand; fizzle via the target
     being destroyed outright; multi-target partial fizzle — two declared
     targets, one dies before resolution, the other is still destroyed, a
     third untouched bystander is never substituted in; the no-
     `declaredTargets`-at-all backward-compatible case). `engine.test.ts`'s
     new describe block is the same shape but end-to-end through the real
     `castSpell`/`resolveTop` pair instead of a bare `Stack` (baseline;
     fizzle via destroy; fizzle via bounce to hand; the no-`declaredTarget`
     backward-compatible case).
   - **Real, deliberately narrower scope, not attempted this pass** (see
     `EffectContext.declaredTargets`'s own doc comment for the full list):
     (1) `dealDamageAnyTarget` ("any target" — mixes `Player`/`Card`, not
     the plain `Card[]` pool shape every other branch shares) isn't wired
     to this; no real FIN card needs a demonstrated fizzle on that specific
     kind. (2) This pass does NOT gate the cast/activation ITSELF on the
     declared target being legal at THAT moment (CR 601.2c's own stricter
     "can't even be put on the stack targeting something illegal" rule) —
     only the resolution-time 608.2b re-check is real; a cast at an
     already-illegal target still goes on the stack and correctly fizzles
     at resolution instead of being rejected up front (same real-game-
     visible outcome, one priority-round later). Would need each targeted
     `Effect` kind's own pool/validity logic exposed a layer higher, in
     `canCastSpell`/`canActivateAbility`, which today have zero visibility
     into `card.effects`' targeting shape at all — a real, separate,
     deliberately-deferred extension. (3) When a spell has MORE THAN ONE
     effect and only ONE of them is targeted (Eject's own real "return
     target nonland permanent to hand. Draw a card." shape, e.g.), this
     pass's fizzle granularity is PER-EFFECT, not per-whole-resolution:
     only the targeted effect itself no-ops on an illegal target; a
     separate, genuinely untargeted sibling effect on the SAME card
     (Eject's own unconditional "draw a card") still runs. Strict CR 608.2b
     says the WHOLE spell fails to resolve once ALL of its targets (for
     every instance of the word "target," collectively) are illegal — a
     real, narrower divergence, flagged here rather than silently assumed
     correct; deliberately not built this pass since it would need
     computing every targeted effect's own legal-target survival BEFORE
     running any effect at all (a two-pass restructure of `resolveCard`'s
     loop), and no real FIN card's own scenario currently exercises or
     depends on the stricter whole-spell reading — `eject`'s own
     `scenarios.ts` is untouched by this pass. (4) `activateAbility` also
     gained the same `declaredTargets` param for symmetry (602.1's "choose
     targets" step is the direct analogue of 601.2c) and is exercised by
     this pass's own unit tests, but no real FIN card's own scenario
     demonstrates a targeted ACTIVATED ability fizzling yet (Coeurl's own
     "tap target creature" is piloted directly via `resolveCard`, not
     through the real cast/stack path, in its own scenario) — real,
     tested machinery without its own `cards/*` demonstration this pass.

### Medium priority (common, but narrower blast radius)

5. **Non-basic mana sources.** ~~A narrow real slice~~ **CLOSED for
   single-color, unrestricted "{T}: Add {X}." sources** (unchanged from
   before) — checked every real `{T}: Add ...` static-ability string across
   the pool (35 cards total): 10 qualify for this narrow slice (Druid of
   the Cowl, Goobbue Gardener, Llanowar Elves — creatures, so 302.6
   summoning-sickness genuinely applies via a new `payableManaSources`
   wrapper; Midgar, Ishgard, Jidoor, Lindblum, Zanarkand — Adventure lands;
   White Auracite, an artifact; Willowrush Verge, a plain land with a
   second, correctly still-ignored restricted ability). `mana.ts`'s
   `manaAbilityColorFromStaticText` derives the color at the exact moment
   a permanent resolves (`resolveTop`/`playLand`), stored on
   `RealCard.manaAbility` — `RealCard` carries no live `CardDefinition`
   reference to re-derive it from later, same reasoning `enteredThisTurn`/
   `resolvedPermanents` already established.

   **Also now CLOSED (2026-09-12) for the dual/choice-of-color remainder** —
   checked every real `{T}: Add {X} or {Y}.` static-ability string across
   the pool: 12 real Town-cycle lands qualify (Vector, Imperial Capital's
   own "{T}: Add {B} or {R}.", e.g.). `RealCard.manaAbility` is now
   `ManaColor | ManaColor[]` (widened from a bare `ManaColor`); a new
   `mana.ts` `deriveManaAbility` (the single real call site `resolveTop`/
   `playLand` now both use, replacing the old single-color-only call) tries
   the single-color match first, falling back to the existing
   `manaAbilityColorsFromStaticText` (which already existed for
   `scripts/prefill-mana-facts.mjs`'s own synergy-FACT generation, but was
   explicitly NOT wired into affordability before this pass) for a
   two-color match. The actual matching problem this needed — "one of these
   two colors, whichever the player needs" — is real, general assignment
   machinery, not a bigger lookup table: `mana.ts`'s new
   `assignManaRequirements` (exhaustive backtracking: try the first
   not-yet-used source whose own producible color(s) overlap a
   requirement's legal color(s); recurse; undo and retry on failure) is
   shared by BOTH this closure and gap #6's own Hybrid-pip closure below,
   since both are the same underlying shape (a requirement or a source that
   accepts more than one color). `canAfford`/`payMana` (`mana.ts`) were
   rewritten around this shared assignment instead of the old fixed
   per-color loop — verified NOT to regress the ordinary single-color case
   (same iteration order preserved, `mana.test.ts`/`engine.test.ts` both
   still pass unchanged for every prior single-color scenario). New tests:
   `mana.test.ts`'s own dual-source `describe` blocks (a dual source paying
   either of its two colors; correctly NOT paying a third; two dual sources
   splitting across two different requirements; and a real
   backtracking-forced case — a dual source tried first for one
   requirement has to be un-picked and retried once a later, stricter
   requirement turns out to have no other source), `engine.test.ts`'s own
   updated `Non-basic mana sources` describe block (a real
   `canCastSpell`/`castSpell` cast of a `{U}`-costed spell paid for by a
   dual `{T}: Add {G} or {U}.` rock with no Island anywhere on the board,
   plus the negative "can't pay a third color" case).

   **Still real, explicitly NOT modeled** (the harder remainder of this
   gap, narrower than before): a restricted ability ("Activate only if...",
   "Spend this mana only to..." — Cargo Ship's own real "{T}: Add {C}.
   Spend this mana only to cast an artifact spell..." ability is the
   concrete, already-declared example; checked before attempting anything
   here — correctly affording this would need a genuine spendable-mana-pool
   tracking mechanism this engine doesn't have AT ALL (`interfaces.ts`'s own
   `Player.addMana` doc comment: a deliberately inert observation point),
   a materially bigger, riskier lift than the assignment problem above, so
   deliberately NOT attempted this pass — Cargo Ship's own mana ability
   stays exactly as undemonstrated as before), and a variable one (Elvish
   Archdruid's own real, already-declared `{T}: Add {G} for each Elf you
   control` — its `amount` is a live-computed function of board state, not
   a fixed symbol at all; unlike the dual-color case, there's no way to
   represent "this source produces a variable amount" as a
   `RealCard.manaAbility` value without teaching `payMana` that ONE tap can
   yield more than one mana unit, a real, separate extension to the payment
   model itself, not a lookup-widening — also deliberately NOT attempted).
   A player who only has one of those TWO remaining source shapes still
   can't be given legal affordability off it.
6. **Hybrid/`{X}` mana symbols.** ~~`parseManaCost` throws on any of
   these~~ **CLOSED for real Hybrid pips (`{G/U}`-shaped) and real `{X}`
   symbols (2026-09-12)** — grepped every real `manaCost:` string across
   the ~321-card pool first, per this doc's own "does a real card need
   this" discipline: exactly 3 real cards need either shape. Hybrid:
   Thranduil, Sindarin Liege // Silvan Rally's own two faces
   (`{2}{G/U}{G/U}`/`{1}{G/U}{G/U}`). `{X}`: Choco Comet's own `{X}{R}{R}`
   and Doppelgang's own `{X}{X}{X}{G}{U}` (already real, playable cards via
   `harness.ts`'s own flat `Scenario.xPaid` field — this gap only ever
   blocked `engine.ts`'s real-pilot `canCastSpell`/`castSpell` path, which
   neither of those two cards' own `scenarios.ts` uses, so neither needed
   touching this pass; see below).
   - **Hybrid**: `ParsedManaCost` gained a `hybrid: ManaColor[][]` field (one
     entry per pip, e.g. `['G','U']`); `parseManaCost` recognizes
     `{X/Y}`-shaped tokens instead of throwing. Paying a Hybrid pip needs
     the SAME real assignment problem gap #5's own dual-color-source
     closure introduced (`assignManaRequirements`) — a Hybrid pip is just a
     requirement that accepts 2 colors instead of 1, matched against
     sources the exact same way. `formatManaCost`/`basicLandsFor` both
     updated to render/provision real Hybrid pips too (the latter always
     picks the pip's FIRST printed color for scenario-setup convenience —
     a real payer could legally choose either, `assignManaRequirements`
     does, but this helper only needs ONE legal board state, not every
     possible one).
   - **`{X}`**: `ParsedManaCost` gained an `xCount: number` field (a count,
     not a value — CR 107.3c: multiple `{X}`s in one cost share the SAME
     chosen value) instead of throwing on the `X` token. A new
     `resolveXCost(cost, x)` folds a caller-chosen `x` (defaulting to 0, a
     real, legal CR 107.3b choice) into `generic` before `canAfford`/
     `payMana` ever see the cost — neither function reads `xCount` at all,
     so an un-resolved `{X}` cost behaves safely as X=0 rather than
     crashing (a caller SHOULD resolve first whenever the caster actually
     wants to pay more). `engine.ts`'s `effectiveCastCost`/`canCastSpell`/
     `castSpell` (and `engine-trace.ts`'s `pilotCast`) all take a new
     optional `x` param, threaded the same way `declaredTarget` already is
     — `effectiveCastCost` calls `resolveXCost` internally and reformats
     the logged cost string to the real resolved total (`{3}{R}{R}`, not
     the printed `{X}{R}{R}` template) once resolved, same treatment a real
     `costReduction` discount already gets. `x` only affects
     affordability/payment — a caller wanting the card's own EFFECT to see
     the same chosen value must also set `ctx.xPaid` itself
     (`card.ts`'s pre-existing field this gap doesn't touch).
   New tests: `mana.test.ts`'s `parseManaCost`/`resolveXCost`/
   `formatManaCost` additions (real Hybrid pip parsing/formatting, `{X}`
   counting/resolving/formatting), its `canAfford / payMana` additions for
   both shapes (including a genuine backtracking-forced Hybrid case),
   `engine.test.ts`'s new `Hybrid mana costs`/`{X} mana costs` describe
   blocks (synthetic `CardDefinition`s using the SAME real cost strings as
   Thranduil // Silvan Rally / Choco Comet, proving `canCastSpell`/
   `castSpell` can now actually cast them, plus the negative
   "still genuinely unaffordable with too few sources" cases).
   **Not touched, deliberately**: `cards/thranduil-sindarin-liege-silvan-
   rally/`, `cards/choco-comet/`, `cards/doppelgang/`'s own `scenarios.ts` —
   none of the three needed a scenario change, since none of their existing
   scenarios were ever blocked by this gap in the first place (`harness.ts`
   never calls `parseManaCost` at all; only `engine.ts`'s real pilot path
   did, and none of these three cards use it).
   **Still real, explicitly NOT modeled** — checked, no real FIN card needs
   either: Phyrexian mana (`{U/P}`-shaped) and a colorless-specific PIP IN
   A CAST COST (`{C}` — e.g. a spell printed as "{3}{C}"; unrelated to a
   SOURCE that PRODUCES `{C}`, which is a separate, already-real thing —
   see gap #5). `parseManaCost` still throws (fail-loud, not silently
   mis-costed) on either. Revisit only if a future card added to the pool
   actually needs one.
7. **Alternate costs, modal/split costs, casting from anywhere but hand.**
   `AlternativeCost.java`/`StaticAbilityAlternativeCost.java` (real Forge
   classes) cover flashback, foretell, alternative-cost-reduction effects,
   etc. **Narrowed (2026-09-11, `auron-s-inspiration`'s migration): plain
   Flashback/Jump-start-shaped alternate costs — a fixed replacement mana
   cost, paid from graveyard or exile instead of hand, CR 702.32/702.67 —
   are now real**, not a no-op: `canCastSpell`/`castSpell` (`engine.ts`) take
   an optional `alt?: AlternateCost` (`card.ts`'s pre-existing
   `{name, cost, from, thenExile}` shape) — when given, `alt.cost` REPLACES
   `card.manaCost` for affordability/payment (timing is still checked
   against the card's own type, per 702.32's "following the normal rules
   for casting that card" — Flashback doesn't change instant vs. sorcery
   speed), and a `thenExile` alt cost tags the pushed `StackObject`
   (`stack.ts`) so `resolveTop` sends the resolved spell to Exile instead of
   the Graveyard. `engine-trace.ts`'s `pilotCast` takes the same optional
   `alt` and logs the real `from`/`cost` it names instead of hardcoded
   `from:'hand'`/`card.manaCost`. **Still real, explicitly NOT modeled**:
   modal/split costs (choose-a-mode-then-pay), Foretell (a two-step
   exile-then-cast-later sequence, not a same-turn alternate cost), and the
   engine does not itself verify the caller's `cardReal` is actually
   sitting in `alt.from`'s zone before casting it from there (same
   pre-existing "trust the caller" contract `canCastSpell`/`castSpell`
   already have for an ordinary hand-cast, which
   also isn't zone-checked).

   ~~**Real, textually-precise cost-reduction example, target-conditional
   spell shape**~~ **CLOSED (2026-09-12, `fate-of-the-sun-cryst`/fin-19):**
   "This spell costs {2} less to cast if it targets a tapped creature."
   (real Scryfall oracle text, `data/fin/fin_scryfall.json` collector_number
   19; real Forge citation, `res/cardsfolder/f/fate_of_the_sun_cryst.txt`:
   `S:Mode$ ReduceCost | ValidCard$ Card.Self | Type$ Spell | Amount$ 2 |
   EffectZone$ All | ValidTarget$ Creature.tapped`) — a real CR 601.2f
   dynamic reduction keyed on the CHOSEN TARGET's state at cast time (not a
   fixed discount, and not a cost REPLACEMENT the way Flashback's
   `AlternateCost` is). Real, general (not one-off) engine vocabulary now
   exists for this shape: `card.ts`'s new `CostReduction` (`{amount,
   condition}` — only `'tappedCreatureTarget'` is modeled, checking BOTH
   Creature type via `effectiveTypes` AND `tapped`, matching Forge's own
   `ValidTarget$ Creature.tapped` exactly, not just "any tapped permanent")
   on a new optional `CardDefinition.costReduction` field; `engine.ts`'s
   `canCastSpell`/`castSpell` take an optional caller-supplied
   `declaredTarget: RealCard` (same "caller supplies the real object,
   engine validates" shape `crewedBy` already established for Crew — real
   601.2b "choose targets" genuinely precedes 601.2f "determine cost," so a
   real caster always knows their target before the discount is computed)
   and a new exported `effectiveCastCost(card, alt, declaredTarget)`
   computes the real discounted `ParsedManaCost` (via `mana.ts`'s new
   `reduceGenericCost` — generic-only, floored at 0, real 118.9) plus a
   printed-style string (`mana.ts`'s new `formatManaCost`) for trace
   logging. `engine-trace.ts`'s `pilotCast` takes the same optional
   `declaredTarget` and logs the REAL cost actually paid, not the nominal
   printed one. `cards/fate-of-the-sun-cryst/definition.ts` now declares
   `costReduction: { amount: 2, condition: 'tappedCreatureTarget' }`
   (replacing the old documentary-only `staticAbilities` text, same
   "structured field replaces free text once real" convention
   `continuousKeywordGrants`'s own cards already established); its
   `scenarios.ts` (real engine-piloted, `runEngineScenarios`) passes the
   SAME real Coeurl as `declaredTarget` in both scenarios — only its real
   tapped state differs — proving the discount is genuinely mechanical, not
   scripted: the tapped-target scenario's own trace shows `cost:'{2}{W}'`
   and only 3 real `tapForMana` lines, the untapped-target scenario shows
   the full `cost:'{4}{W}'` and 5. New tests: `mana.test.ts`'s
   `reduceGenericCost / formatManaCost` describe block, `engine.test.ts`'s
   `Cost reduction (CR 601.2f)` describe block (discount making an
   otherwise-unaffordable cost payable; no discount for an untapped
   target, a tapped non-creature, or no `declaredTarget` at all; and a
   real `AlternateCost` correctly NOT stacking with `costReduction` — see
   `effectiveCastCost`'s own doc comment for why the two are mutually
   exclusive rather than combined, no real card needing both existing to
   check the interaction against).
   **Both remaining real, separate mechanisms below are now ALSO CLOSED
   (2026-09-12, same pass)** — a BROADCAST discount on OTHER spells
   (color-gated, not keyed on this card's own chosen target — the-wind-
   crystal/fin-43), and a discount on an ACTIVATED ABILITY's own cost
   rather than a spell's cast cost (qiqirn-merchant/fin-65). Both reuse
   the SAME generalized hook, not two one-off patches — see below for the
   shared design. ~~**Still explicitly NOT modeled**: a variable/dynamic
   `amount` for the CAST-side `CostReduction` shape~~ **Also now CLOSED
   (2026-09-12, `travel-the-overworld`/fin-82's migration)** — real Scryfall
   oracle text (`data/fin/fin_scryfall.json` collector_number 82): "Affinity
   for Towns (This spell costs {1} less to cast for each Town you control.)"
   Real Forge citation: `res/cardsfolder/t/travel_the_overworld.txt`
   declares `K:Affinity:Town`; `tmp/mtg-forge`'s own source confirms this
   keyword expands (via `forge-game/.../keyword/Keyword.java` line 12 +
   `CardFactoryUtil.java`'s `addStaticAbility`, ~lines 3749-3766) into
   exactly a `Mode$ ReduceCost | ValidCard$ Card.Self | Type$ Spell |
   Amount$ AffinityX | EffectZone$ All` static ability paired with a
   dynamically-built `SVar:AffinityX:Count$Valid Town.YouCtrl` — the SAME
   real board-counted mechanism qiqirn-merchant's own `ActivationCostReduction`
   already models on the ACTIVATION side, generalized here to the CAST side.
   `card.ts`'s `CostReduction` gained a new `perControlled: {amountPerMatch,
   subtype}` field (mutually exclusive with the existing target-conditional
   `amount`/`condition` pair, both now optional) reusing
   `ActivationCostReduction`'s exact shape; `engine.ts`'s `effectiveCastCost`
   counts real `caster.battlefield` permanents matching `subtype` and applies
   the discount the same generic-only/floored-at-0 way every other cast-cost
   discount already does. `cards/travel-the-overworld/definition.ts` now
   declares `costReduction: {perControlled: {amountPerMatch: 1, subtype:
   'Town'}}`, replacing the old documentary-only `staticAbilities` string;
   its own real engine-piloted scenario controls 2 real Town lands (Capital
   City, Gongaga, Reactor Town) and shows the logged `cast` cost genuinely
   reading `{3}{U}{U}` (5 minus 2), not the printed `{5}{U}{U}` — only 5
   real lands tapped for mana, not 7. The two shapes (target-conditional
   `amount`/`condition` vs. board-counted `perControlled`) stay genuinely
   mutually exclusive on any one card, same as before — no real FIN card
   needs both at once to check the interaction against.

   **Second real example, a plainer shape, CLOSED (2026-09-12,
   `the-wind-crystal`/fin-43's migration):** "White spells you cast cost
   {1} less to cast." (real Scryfall oracle text,
   `data/fin/fin_scryfall.json` collector_number 43) — unlike
   `fate-of-the-sun-cryst`'s target-conditional discount, this one is a
   flat, UNCONDITIONAL color-gated discount that applies to OTHER spells,
   not this card's own cast (real Forge `Mode$ ReduceCost | ValidCard$
   Card.White | Activator$ You | Amount$ 1`, `res/cardsfolder/t/
   the_wind_crystal.txt` — a broadcast static ability, not a target-keyed
   one). New `card.ts` vocabulary: `SpellCostReductionGrant {amount,
   colors}`, lives on `CardDefinition.spellCostReductionGrants` (an array,
   since a permanent could in principle grant more than one) — copied onto
   the resolved `RealCard` at `resolveTop` (same pattern
   `continuousKeywordGrants` already established), NOT onto the discounted
   spell itself. `state.ts`'s new `activeSpellCostDiscount(caster,
   cardColors)` sums every matching grant across the CASTER's OWN
   battlefield (Forge's `Activator$ You` — a grant never applies to an
   opponent casting a white spell, checked and tested). `engine.ts`'s
   `effectiveCastCost` gained a 5th param, `caster?: RealPlayer` — when
   given (and no `alt` is in play), the broadcast discount is summed
   together with any target-conditional `card.costReduction` discount
   before both are applied via the existing `reduceGenericCost`.
   `cards/the-wind-crystal/definition.ts` now declares
   `spellCostReductionGrants: [{amount: 1, colors: ['W']}]` (replacing the
   old documentary-only `staticAbilities` string); a real
   `event:'costReduction'` `Fact` is authored (`synergy.ts`'s new
   `Fact.colors` reuse + `value`) — exempted from trace-evidence checking
   (`scripts/verify-synergy.mjs`'s new `card.name === 'The Wind Crystal' &&
   p.event === 'costReduction'` line) since demonstrating it needs a
   DIFFERENT spell's own cast-cost log line to differ, which this card's
   own scenario (its own `grantKeywordAll` activation) doesn't produce —
   same zero-possible-evidence class as `isAuronsInspirationBroadcastPumpFact`.
   **Known, deliberate limitation**: `the-wind-crystal/scenarios.ts` was
   NOT touched this pass (a concurrent agent was actively migrating this
   same card's own separate lifegain-doubling clause, gap #8b, in the same
   file at the same time) — the discount is real and independently
   unit-tested (`engine.test.ts`'s new "Cost reduction — flat,
   unconditional, BROADCAST" describe block, a synthetic fixture, NOT this
   card's own scenario), but this card's OWN scenario does not itself cast
   a second white spell to show the discount applying end-to-end. Revisit
   if a future pass wants this card's own trace to demonstrate it directly
   (would need a second real white spell cast from the same controller's
   hand in that scenario).

   **Third real example, extends the gap to ACTIVATED-ABILITY costs, not
   just spell-cast costs, CLOSED (2026-09-12, `qiqirn-merchant`/fin-65's
   migration):** "{7}, {T}, Sacrifice this creature: Draw three cards. This
   ability costs {1} less to activate for each Town you control." (real
   Scryfall oracle text, `data/fin/fin_scryfall.json` collector_number 65)
   — a real, dynamic, board-state-counted discount (real Forge
   `SVar:X:Count$Valid Town.YouCtrl`-style reduction,
   `res/cardsfolder/q/qiqirn_merchant.txt`) on an ACTIVATED ABILITY's own
   cost, not a spell's. New `card.ts` vocabulary:
   `ActivationCostReduction {amountPerMatch, subtype}`, lives on the
   individual ability entry (`CardDefinition.abilities[].costReduction`),
   not the whole card, since a card could have more than one activated
   ability and Forge's own reduction is scoped per-ability. New `engine.ts`
   exported `effectiveActivationCost(engine, controller, card, abilityName?,
   x?)` generalizes the SAME cost-discount machinery to activated
   abilities: resolves `{X}` (see gap #11 below) first, then counts the
   controller's own battlefield permanents matching `reduction.subtype`
   (`card.subtypes.includes(...)`, exactly Forge's `Count$Valid
   Town.YouCtrl`), multiplies by `amountPerMatch`, and applies the result
   via the existing `reduceGenericCost`, patching the single generic-cost
   bracket token back into the printed cost string via a targeted
   `cost.replace(/\{\d+\}/, ...)` substitution (the rest of the cost string
   — `{T}`, `Sacrifice this creature` — is untouched free text).
   `canActivateAbility`/`activateAbility` (`engine.ts`) both now call this
   helper instead of parsing the raw mana portion inline. `cards/
   qiqirn-merchant/definition.ts`'s `bigDraw` ability now declares
   `costReduction: {amountPerMatch: 1, subtype: 'Town'}`; the pre-existing
   self-sacrifice-cost `Fact` gained a new, purely-descriptive
   `costReductionPerControlled` field (`synergy.ts`, NOT consulted by
   `factsInteract`, same "documentary" convention `tapped`/
   `untilEndOfTurn` already establish) — no new `verify-synergy.mjs`
   exemption needed, since this fact was already covered by the
   pre-existing `isSelfSacrificeActivationCostFact` shape check (bigDraw's
   own self-sacrifice cost remains separately, unrelatedly unpayable
   through `canActivateAbility` — see gap #11 below, unaffected by this
   closure). `cards/qiqirn-merchant/scenarios.ts` (real engine-piloted)
   now demonstrates the discount computation is genuinely mechanical: the
   scenario's own board controls 2 real Town lands (Capital City, Gongaga,
   Reactor Town — real FIN `Land — Town` cards, not invented
   placeholders), and the logged "bigDraw" cost is computed via
   `effectiveActivationCost` rather than hardcoded, reading `{5}, {T},
   ...` (7 minus 2) instead of the raw printed `{7}, {T}, ...` — still
   fired directly rather than through `canActivateAbility` end-to-end (see
   that scenario's own header: self-sacrifice-as-cost remains unpayable,
   an unrelated, separate, still-open gap, see gap #11 below), so this
   demonstrates the discount's own computation, not the full activation
   being paid start-to-finish.
   New tests (`engine.test.ts`): "Cost reduction — flat, unconditional,
   BROADCAST from a DIFFERENT permanent" (3 cases: discount applies for a
   matching color, no discount for a non-matching color, no discount from
   an opponent's permanent) and "Cost reduction — board-state-COUNTED, on
   an ACTIVATED ABILITY's own cost" (2 cases: discount with 5 matching
   permanents controlled, correctly unaffordable with 0).
8. ~~**Damage-prevention shields — a narrow `dealDamage` hook, NOT full
   614.**~~ **CLOSED (2026-09-12)**. Checked the real pool: only 2 of 312
   FIN cards need a replacement effect at all — Crystal Fragments/Summon:
   Alexander ("Prevent all damage that would be dealt to creatures you
   control this turn") and Diamond Weapon ("Prevent all combat damage that
   would be dealt to Diamond Weapon"). Both are the same narrow 614.2
   damage-prevention-shield pattern. Full general replacement-effect
   machinery (`ReplacementEffect.java`/`ReplacementHandler.java`/
   `ReplacementLayer.java`, forge-game/.../replacement/ — arbitrary event
   interception, dynamic 616 ordering, any event type) would mean gating
   every mutation call site (`dealDamage`/`move`/`drawCard`/`destroy`/...)
   — still assessed as too invasive/risky and NOT built; the narrow version
   is what's real now: two new `Keyword` values, `'DamagePrevention'` (ALL
   damage, per Crystal Fragments' `R:Event$ DamageDone | Prevent$ True |
   ActiveZones$ Command | ValidTarget$ Creature.YouCtrl`,
   `res/cardsfolder/c/crystal_fragments_summon_alexander.txt`) and
   `'CombatDamagePrevention'` (combat damage only, per Diamond Weapon's own
   `R:Event$ DamageDone | Prevent$ True | IsCombat$ True | ValidTarget$
   Card.Self`, `res/cardsfolder/d/diamond_weapon.txt`) — checked inside
   `state.dealDamage`'s own one real chokepoint (a new `opts?: {combat?:
   boolean}` param, threaded from `engine.ts`'s `resolveCombatDamage`'s 5
   call sites, distinguishes combat from non-combat damage at the only
   place that needs to), via the SAME `effectiveKeywords`/keyword-grant
   machinery a real keyword grant already uses (the `'Unblockable'`
   precedent) — no new `CardDefinition`/`RealCard` field invented. A
   prevented hit returns `{prevented: true}` instead of marking damage or
   triggering Lifelink.
   **`cards/*` wired for real**: Crystal Fragments/Summon: Alexander's
   Chapters I/II no longer no-op — both now run
   `{kind: 'grantKeywordAll', predicate: 'creatures-you-control', keyword:
   'DamagePrevention', untilEndOfTurn: true}`, reusing the existing 514.2
   Cleanup-based `untilEndOfTurnKeywordGrants` expiry (not a new duration
   mechanism). Diamond Weapon's old freeform "Immune" `staticAbilities`
   text is replaced by `keywords: ['Reach', 'CombatDamagePrevention']` — a
   structured field where one now exists, same convention gap #7's
   cost-reduction migrations already established. **Scope, precisely**:
   Crystal Fragments' shield covers ALL damage to its own creatures (any
   source, combat or not); Diamond Weapon's shield covers ONLY combat
   damage to itself — the two cards are deliberately NOT symmetric, and
   this asymmetry is mechanically enforced (the `combat` opt-in on
   `dealDamage`), not just documented. `engine.ts`'s `CombatDamageResult`
   gained a `prevented: RealCard[]` field; `harness.ts`'s
   `loggingActions.dealDamage` now logs `fn:'damagePrevented'` in place of
   `fn:'dealDamage'` when a shield fires (same "replace, don't append"
   precedent `destroy`/`destroyPrevented` already set); a new
   `engine-trace.ts` `pilotResolveCombatDamage` (the first real-combat
   pilot helper in the pool, since no card had piloted real combat damage
   through `engine-trace.ts` before Diamond Weapon's own migration) logs
   the same `damagePrevented` line for the piloted-combat path. Real facts
   (`event: 'preventDamage'`) now have genuine trace evidence via
   `scripts/verify-synergy.mjs`'s new `case 'damagePrevented'`
   `producedEvents` branch — the old `isSummonAlexanderDamagePreventionFact`
   exemption (which assumed "no possible trace evidence, ever") is now
   stale and has been REMOVED, not left in place. New tests:
   `state.test.ts`'s `GameState.dealDamage — damage-prevention shields`
   describe block (6 cases: all-damage shield blocks combat + non-combat,
   combat-only shield blocks combat but NOT non-combat, a granted
   (non-printed) shield works identically to a printed one, no-shield
   negative path, a fully-prevented hit grants no Lifelink, Lifelink still
   works when not prevented). Scenarios: Crystal Fragments/Summon:
   Alexander's own scenario now deals 3 damage to its own creature per
   chapter and shows it genuinely prevented; Diamond Weapon's own
   `scenarios.ts` was migrated from the flat `harness.ts` style (no combat
   modeling at all) to a real `engine-trace.ts` pilot (cast → a real
   opponent attacker, Hill Gigas, attacks → Diamond Weapon blocks → real
   combat damage resolves with Diamond Weapon's own 5 damage genuinely
   prevented while it still deals its own 8 back, unshielded).

8b. ~~**Life-total replacement effects — a real, distinct 614 gap, NOT the
   same as gap #8's damage shields.**~~ **CLOSED (2026-09-12)**.
   `the-wind-crystal`/fin-43's own real oracle text: "If you would gain
   life, you gain twice that much life instead." (`data/fin/
   fin_scryfall.json` collector_number 43; real Forge citation,
   `res/cardsfolder/t/the_wind_crystal.txt`: `R:Event$ GainLife |
   ReplaceWith$ GainDouble ... SVar:X:ReplaceCount$LifeGained/Twice`) — a
   genuine CR 614.2 self-replacement effect on the LIFEGAIN event, not
   damage. `state.ts`'s `gainLife` (the one real chokepoint, previously a
   bare `real.life += amount; return true;` with no interception point at
   all) now checks a new `'LifegainDouble'` `Keyword` (same
   `effectiveKeywords`-based approximation gap #8's shields use, the
   `'Unblockable'` precedent again — no parallel replacement-effect
   dispatcher built) across the gaining player's own battlefield, doubling
   the amount actually applied when present; `dealDamage`'s own Lifelink
   payout now routes through this SAME `gainLife` chokepoint, so a
   Lifelink source under a lifegain-doubler is ALSO doubled for free, no
   separate wiring. `cards/the-wind-crystal/definition.ts` now declares
   `keywords: ['LifegainDouble']` (replacing the old documentary-only
   `staticAbilities` text). A new synthetic-probe `Scenario.playerGainsLife?:
   {amount: number}` field (`harness.ts`, mirroring the existing
   `dealsCombatDamage` synthetic-probe precedent — a real MTG event
   happening independent of any card's own effect) lets this card's own
   scenario demonstrate the doubling with real trace evidence even though
   the card itself never causes a lifegain event: `harness.ts`'s
   `loggingPlayer.gainLife` now diffs real player life before/after the
   call (rather than trusting the input `amount`) and additively logs a
   `requestedAmount` field only when it differs from the real applied
   amount. A real `event: 'lifegainDouble'` Fact is authored with genuine
   trace evidence via `scripts/verify-synergy.mjs`'s new
   `producedEvents` handling (`case 'gainLife'` now also emits
   `lifegainDouble` when `entry.amount > entry.requestedAmount`) — no
   exemption needed. New tests: `state.test.ts`'s `GameState.gainLife —
   lifegain-doubling replacement` describe block (6 cases: doubles the
   amount, no doubler = normal amount, an opponent's doubler doesn't
   cross-affect, two doublers still only double once — a documented
   non-stacking simplification, no real FIN card needs true multiplicative
   stacking here — Lifelink routes through the same chokepoint and gets
   doubled too, amount 0 stays 0). Scenario: The Wind Crystal's own
   `scenarios.ts` gained a second scenario demonstrating a real 3-life gain
   event doubled to 6 by this card's own presence.

### Lower priority (narrow, or already partially mitigated)

9. ~~**First/double strike combat sub-step**~~ **CLOSED (2026-09-12)** — was
   folded into gap #1 above (blocker legality/damage math was already real,
   two-INTERNAL-pass-shaped), but genuinely incomplete until now: this
   engine's own `turn.ts` `PHASES` list didn't include the real 13th Forge
   phase at all (`PhaseType.COMBAT_FIRST_STRIKE_DAMAGE`, `PhaseType.java`
   line 23), so a first/double-strike combat had no REAL, separately-
   reachable turn-structure step — just internal math inside one
   `resolveCombatDamage` call. Real, checked-against-Forge fix:
   - `turn.ts`'s own `PHASES` now literally includes
     `'CombatFirstStrikeDamage'` between `'CombatDeclareBlockers'` and
     `'CombatDamage'` — an unconditional, structural mirror of the real
     `PhaseType` enum's own 13-entry list/order (`PhaseType.java` lines
     16-28) and its `PHASE_GROUPS` combat-step grouping (lines 29-35).
     `turn.ts`'s own `advancePhase` always walks through it, same as the
     real enum has no notion of "skip an index" — deliberately NOT this
     file's job to decide the real 510.5 conditionality (it has no combat
     state to decide it with, same reason `resolveCombatDamage` itself
     lives in `engine.ts`, not here).
   - `engine.ts`'s own `doAdvance` is the real equivalent of Forge's
     `PhaseHandler.isSkippingPhase`/`onPhaseBegin` (`PhaseHandler.java`
     lines 219-238, 321-332): a new `combatHasFirstOrDoubleStrike(engine)`
     check (`effectiveKeywords`, not raw `.keywords` — a GRANTED First
     Strike, Coral Sword's own real Equip trigger, counts too) decides
     whether ANY currently-declared attacker or blocker has First or
     Double Strike; if not, `doAdvance` auto-advances PAST
     `'CombatFirstStrikeDamage'` without ever presenting it to a caller —
     Forge's own real mechanism is slightly different (always transitions
     through the phase, just withholds priority and assigns no damage,
     `combat.assignCombatDamage(true)` returning false, `Combat.java`
     ~lines 906-926) but identical in what a player actually OBSERVES.
   - `engine.ts`'s own combat-damage assignment is now genuinely SPLIT
     into two separate exported functions instead of two internal passes
     within one call: `resolveFirstStrikeCombatDamage` (creatures with
     First OR Double Strike only) for the real `CombatFirstStrikeDamage`
     step, and `resolveCombatDamage` (creatures with Double Strike, again,
     PLUS every creature without First Strike) for the real `CombatDamage`
     step — exact real reference: `Combat.java`'s own
     `dealDamageThisPhase(combatant, firstStrikeDamage)` (~lines 906-916)
     and `PhaseHandler.java`'s own `COMBAT_FIRST_STRIKE_DAMAGE`/
     `COMBAT_DAMAGE` cases (~lines 321-344), one real call per real phase.
     A creature already lethally damaged (`isLethallyDamaged` — real,
     persistent `damageMarked`/`deathtouchDamaged` state, read fresh on
     EVERY call, not cached across the two real steps) deals no further
     damage and receives none, whether or not a caller actually ran
     `checkStateBasedActions` between the two real steps (this engine
     still does not call `state.destroy` itself from within combat
     resolution — real creature death from combat damage stays a
     caller-invoked state-based action, same established design). A
     caller with NO First/Double Strike creature in play needs no other
     change at all: `resolveCombatDamage` alone, once, at the (only) real
     `CombatDamage` step, is byte-for-byte identical to this function's
     own pre-this-pass behavior.
   - Real unit tests (`turn.test.ts`: the fixed-phase-order test now
     asserts `'CombatFirstStrikeDamage'` is reached in sequence;
     `engine.test.ts`'s `resolveCombatDamage (510)` describe block): a
     normal-creature-vs-normal-creature combat never even reaches
     `CombatFirstStrikeDamage` (asserted via `currentPhase`, real skip);
     a First Strike creature vs. a normal blocker — the engine genuinely
     STOPS at `CombatFirstStrikeDamage`, the blocker dies there, and deals
     zero damage back in the following real `CombatDamage` step; Double
     Strike deals damage in BOTH real steps (asserted mid-sequence:
     exactly 2 damage marked after the first real step alone, 4 after
     both); a blocked Double Strike attacker whose blocker already died in
     the first real step deals no further damage without Trample.
   - Real FIN card demonstration: `keywords/first-strike-double-strike/
     scenarios.ts` (Lightning, Army of One — real First Strike; Giott,
     King of the Dwarves — real Double Strike; both on this closure's own
     assigned real-card list) — REWRITTEN from its earlier single-call,
     internal-two-pass version to genuinely advance through the real
     `CombatFirstStrikeDamage` phase (asserting `currentPhase`, throwing
     if not reached — a real regression trip-wire, not just narrative
     text) via `engine-trace.ts`'s new `pilotResolveFirstStrikeCombatDamage`
     wrapper, running a real `checkStateBasedActions` sweep between the
     two real steps (704.3), then the real `CombatDamage` step via the
     existing `pilotResolveCombatDamage`. Regenerated `trace.json` for both
     scenarios shows the real, distinct `{fn:'phase', phase:
     'CombatFirstStrikeDamage', ...}` log entry before `CombatDamage`, with
     `dealDamage`/`destroy` entries landing in the correct real step.
   - Checked the OTHER 9 real FIN cards referencing First/Double Strike in
     `data/fin/fin_scryfall.json` (Tonberry, Coral Sword, Seifer Almasy,
     Sidequest: Play Blitzball // World Champion Celestial Weapon, Squall
     SeeD Mercenary, Genji Glove, The Masamune, Cloud Planet's Champion,
     Magitek Scythe) — regenerated every one's own `trace.json`
     (`run-scenarios.mjs --slug=...`) and confirmed BYTE-IDENTICAL output
     (zero regression) plus a clean `verify-synergy.mjs` pass (0 hard
     failures) for all 11. None of their own `scenarios.ts` currently
     drives a real FIRST/DOUBLE-STRIKE creature through combat via this
     engine (Tonberry's own First Strike is real printed text but a
     TURN-CONDITIONAL self-grant left as undemonstrated freeform
     `staticAbilities` text, same real gap `continuousKeywordGrants`'s own
     `onlyDuringYourTurn`/`includeSelf` shape could close but hasn't been
     retrofitted onto this specific card yet, out of scope here; The
     Masamune's own "equipped creature has first strike... as long as
     attacking" is the same kind of unmodeled freeform text, already
     flagged in its own `definition.ts`; the rest are plain Equipment
     grants exercised only via their own generic `keywordScenarios()`
     bundle, which never drives full combat) — so no OTHER card's own
     `scenarios.ts` needed rewriting for this pass beyond the keyword
     bundle above, which already demonstrates the real mechanic end to end
     with two real FIN creatures.
   - **Real, still-open, honest simplification**: multi-blocker damage
     ASSIGNMENT ORDERING (509.2, an attacking player choosing which
     blocker gets how much before any is known-dead) is untouched by this
     pass — same accepted simplification gap #1 already flagged
     ("declaration order stands in for" the real choice). Also untouched:
     Forge's own "always transition through the phase, just silently"
     shape (see above) vs. this engine's "never present it at all" — a
     deliberate, documented divergence, not a bug, since nothing in this
     pool needs to observe the difference. `vitest run functional-model`:
     366/366 passing; full-pool `verify-synergy.mjs`: 320 checked, 0 hard
     failures.
10. ~~**Legend rule / other SBA-adjacent state cleanup**~~ **CLOSED** — was
    subsumed by gap #2, now folded into `sba.ts`'s own loop
    (`state.checkLegendRule`); `sba.test.ts` specifically tests two
    same-named Legendary permanents (Jill's own card is Legendary) both
    alone and combined with a lethal-damage case in the same sweep.
11. **Activated-ability cost components beyond `{T}` + mana.** ~~Equip
    {N}~~ **CLOSED** — `unsupportedCostComponent` now strips a real
    "Equip"/"Equip—" cost-string prefix the same way `{T}` is, and
    `canActivateAbility` gates any Equipment-typeLine permanent's
    activation to sorcery-speed (301.5c) via a new `isEquipment` check —
    real Forge ties this restriction to the permanent's TYPE, not to
    printed cost text, so the existing "activate only as a sorcery"
    text-pattern check alone would've missed it. Verified against the real
    pool: unlocks Coral Sword (`Equip {1}`), Magitek Scythe (`Equip {2}`),
    Bard's Bow (`Equip {6}`), Ultima Weapon (`Equip {7}`) — 4 of 11 real
    Equipment cards, the other 7 already had a bare mana-only
    `activationCost` (no literal "Equip" text) so were already payable,
    just (until this pass) missing the 301.5c timing gate they now also
    get. Dark Knight's Greatsword's own `Equip—Pay 3 life` correctly still
    rejects (Pay-life remains unsupported).
    ~~Crew N~~ **CLOSED** — `card.crewCost` (a structured field that
    already existed, unused, before this pass) now drives a real cost
    path: `canActivateAbility`/`activateAbility` take an explicit
    `crewedBy: RealCard[]` (same "caller supplies the real objects,
    engine validates" shape `declareBlockers` already established for
    combat), bypassing the free-text cost-string checks entirely for a
    `crewCost` card. Legal iff every listed creature is controlled by the
    activator, actually a creature, untapped, and their combined
    `effectivePT` power meets `crewCost` — no sorcery-speed restriction
    and no 302.6 summoning-sickness check on the tapped creatures (both
    real: 702.121c has no such restriction, and sickness only restricts a
    creature's OWN {T} ability/attacking, not being tapped as a cost by
    something else). No new Effect kind needed — the real cards here
    already declare `effects: [{ kind: 'animate', ... }]`, which resolves
    for real through the existing stack/`resolveCard` pipeline once the
    cost is payable at all.
    Verified against the real pool: of 5 Vehicle cards with `crewCost`,
    3 (Magitek Armor, The Prima Vista, The Lunar Whale) declare the
    matching `activationCost`+`effects: [animate]` needed to actually
    resolve — real and tested. **Updated 2026-09-12 (Cargo Ship/fin-47
    migration): Cargo Ship now also declares this pair** (added alongside
    its own real mana ability, see below) — 4 of 5 now resolve for real.
    The Regalia's own `definition.ts` still sets `crewCost` but declares
    NEITHER field (its own comment says so explicitly), so
    `activationCostFor` correctly returns `undefined` for it and
    `canActivateAbility`'s existing "has no such activated ability" check
    rejects it — same "blocked on `cards/*`, not on engine design"
    situation as gap #8's damage-shields above, not a bug.
    **Gap found while migrating Cargo Ship (2026-09-12) — FIXED
    (2026-09-12, same pass as gap #7's closures above)**:
    `canActivateAbility`/`activateAbility` (`engine.ts`) used to branch on
    `card.crewCost !== undefined` UNCONDITIONALLY, before even looking at
    the caller-supplied `abilityName` — so a Vehicle that has BOTH
    `crewCost` AND a separate named ability (`card.abilities`) would have
    ANY activation attempt, including one explicitly naming the other
    ability, incorrectly routed through the crew-cost legality/payment
    path if it were ever piloted through `engine.ts`'s own real
    `canActivateAbility`/`activateAbility` (as opposed to `harness.ts`'s
    flat `Scenario` lifecycle, which calls `resolveCard` directly and
    never consults `crewCost` at all — so this bug never affected Cargo
    Ship's own scenario, which stays on the flat `harness.ts` style
    regardless). Cargo Ship is the first real card in this pool with this
    exact shape (crew + a second, independent activated ability); the 4
    other `crewCost` Vehicles have no second ability to collide with.
    **Fix**: the crew-cost gate is now `card.crewCost !== undefined &&
    abilityName === undefined` — a caller that explicitly names an
    ability routes to the normal named-ability cost path instead (the
    "or the requested ability doesn't exist" case was already correctly
    handled by the pre-existing early return in `canActivateAbility`,
    `if (!cost) return {ok:false, reason:'has no such activated ability'}`
    — no separate change needed for it). New tests (`engine.test.ts`, a
    synthetic Cargo-Ship-shaped fixture with BOTH `crewCost` AND a named
    ability): naming the ability activates it via the normal cost path
    (not crew); omitting `abilityName` still crews normally.
    One inherited, pre-existing limitation: the `animate` Effect (and
    `LayerSet` generally) has no duration tracking (`layers.ts`'s own
    documented scope), so a crewed Vehicle becomes a creature
    PERMANENTLY, not "until end of turn" as 702.121b's real text says —
    the same simplification the 3 real cards' own `effects: [animate]`
    already commits to by using this mechanism, not a new gap introduced
    here.
    ~~Sacrifice another/a/two X~~ **CLOSED for the non-self cases, trusting
    an already-real matching effect** — checked every real
    `Sacrifice`-shaped `activationCost` string across the pool (12 files):
    Ahriman ("another creature or artifact"), Phantom Train ("another
    artifact or creature"), and Quina, Qu Gourmet ("a Frog") each already
    declare a matching `{ kind: 'sacrifice', notSelf: true, ... }` as the
    FIRST effect in their own `effects` array — their own comments
    explicitly document this as a deliberate "cost modeled as effect #1,
    for trace visibility" choice, not something this pass invented.
    `unsupportedCostComponent` now accepts a `Sacrifice another/a/an/two`-
    shaped cost component IFF `card.effects` already contains a
    `sacrifice` effect — trusting the card's own resolution to pay it for
    real, with NO risk of double-payment (the engine itself never calls
    `state.sacrifice` for this cost component; the card's own effect
    still does, exactly as before, just now actually reachable through
    `canActivateAbility` at all).
    **Still open, deliberately NOT recognized**: The Gold Saucer's own
    "Sacrifice two artifacts" has no matching effect in its own
    `definition.ts` (its own comment says the sacrifice is cost-only, not
    modeled) — correctly still rejected, since accepting it would let the
    ability resolve with nothing ever actually sacrificed; a real
    `cards/*`-boundary gap, not an engine-design one. Self-sacrifice
    ("Sacrifice this creature"/"Sacrifice <CardName>" — Blazing Bomb, Zack
    Fair, and Elven Passage's compound cost) is deliberately never
    recognized at all: both real self-sacrifice cards' own `effects` read
    `ctx.self`'s live state (power/counters) AFTER the ability would
    resolve, which only stays correct today because the sacrifice never
    actually happens — genuinely sacrificing `self` as a cost would need
    real 608.2h last-known-information tracking (a real, separate,
    unbuilt gap) to keep those two cards correct, so this stays a
    deliberately deferred gap rather than risk a regression.
    ~~Still fully open: `{X}`, `Pay N life`~~ **CLOSED (2026-09-12)** — both
    real, common cost shapes, verified by grepping every `activationCost:`/
    `manaCost:` string across every card's own `definition.ts` first (real
    Forge citation for the general shape: `AbilityManaPart.java`'s own X-cost
    handling and `Cost.java`'s `CostPayLife`, though the specific closure
    here is general-purpose, not keyed to any one card by name).
    - **`{X}` on an activated ability.** New `engine.ts` exported
      `effectiveActivationCost(engine, controller, card, abilityName?, x?)`
      (also the same function gap #7's third example above reuses for its
      own board-counted discount) resolves an `{X}` token in an ability's
      own mana portion via the SAME `resolveXCost` gap #6 already built for
      spell-casting — no separate X-resolution mechanism invented.
      `canActivateAbility`/`activateAbility` both take a new optional `x?`
      param, threaded through to this helper exactly like `declaredTarget`/
      `crewedBy` already are. Rydia, Summoner of Mist's own real `{X}`-costed
      activated ability is the concrete real-pool example motivating this
      (checked before building). New tests (`engine.test.ts`, a synthetic
      Rydia-shaped `{X}` fixture): a real chosen X resolved and paid;
      unaffordable X correctly rejected; omitted X defaults to 0 (CR
      107.3b).
    - **"Pay N life" as an ability cost.** New `engine.ts` exported
      `costRequiresLifePayment(cost)` (`/\bPay (\d+) life\b/i`) —
      `unsupportedCostComponent` now accepts this shape instead of
      rejecting it; `canActivateAbility` rejects if `controller.life <
      lifeCost`, and `activateAbility` genuinely deducts
      `controller.life -= lifeCost` on top of any mana paid. This directly
      changes previously-documented behavior: Dark Knight's Greatsword's
      own real `Equip—Pay 3 life` (gap #11's earlier Equip closure above)
      is now genuinely payable rather than rejected — `engine.test.ts`'s
      old negative test for this exact case was rewritten into two real
      tests (successfully paid, life genuinely drops 20→17; correctly
      still rejected when life is too low to pay, e.g. `life: 2`).
    **Still explicitly out of scope, unchanged** (per direct instruction):
    modal/split costs (choose-a-mode-then-pay) and Foretell — neither
    touched by this closure, both remain gap #7's own still-open items
    above.

12. ~~**CR 305 "playing a land" — real special-action mechanics, still only
    closed for the harness/trace-generation path, not `engine.ts`'s own
    real pilot.**~~ **CLOSED (2026-09-09, later same day)**: a real
    `canPlayLand`/`playLand` pair now exists in `engine.ts`'s own real
    pilot path (`engine.test.ts`'s new `canPlayLand / playLand` describe
    block), plus `engine-trace.ts`'s `pilotPlayLand`/
    `pilotExpectIllegalPlayLand`. Real Forge reference, this time from an
    actual `../mtg-forge` checkout (sparse-cloned this pass —
    `Player.java`/`PlayerController.java`/`GameAction.java`/
    `PhaseHandler.java`), not reasoned from CR text alone as the prior
    same-day pass below had to: `Player.playLand` (`Player.java`
    ~1624-1651) does a direct `game.getAction().moveTo(Battlefield, land,
    cause)` — no Stack trip — then fires `TriggerType.LandPlayed`, then
    `addLandPlayedThisTurn()`; `Player.canPlayLand` (~1653-1688) gates on
    305.3's own timing via `canCastSorcery()` (~2508-2511: own turn + main
    phase + empty stack — the SAME rule this engine's own
    `sorcerySpeedTimingOk` already implements for sorcery-speed spells,
    reused directly) plus `getLandsPlayedThisTurn() < getMaxLandPlays()`
    (default max 1, `Player.java` ~1690-1696, reset each cleanup by
    `Player.onCleanupPhase()`'s own `resetLandsPlayedThisTurn()` call,
    ~2456-2473 — mirrored here in `turn.ts`'s Cleanup branch, active
    player only). New `RealPlayer.landsPlayedThisTurn` (`state.ts`) tracks
    the counter. `playLand` is ONE call, not a cast+resolve split like
    `castSpell`+`resolveTop` — CR 305.1 lands never wait on the Stack, so
    there's no separate "resolve" step. The dormant mis-cast bug flagged
    below is ALSO fixed in this same pass: `canCastSpell` now rejects a
    Land typeLine outright at the top (so `castSpell`/`pilotCast` inherit
    the guard for free, since both call `canCastSpell` first). **Real,
    deliberately not closed**: Zell Dincht's own "You may play an
    additional land on each of your turns" — real, checked (grepped the
    pool, exactly one hit), but `canPlayLand`'s once-per-turn check stays a
    hardcoded `>= 1` (mirroring Forge's own default max) since Zell's own
    grant is freeform `staticAbilities` text, not a structured field this
    engine can read yet — same "blocked on `cards/*` boundary, not engine
    design" situation as gap #8's damage-shields/gap #11's Vehicle
    `crewCost` gaps. No FIN land currently exercises this path for real
    (no card's own `scenarios.ts` migrated to `runEngineScenarios()` —
    out of scope for this pass, proven instead via `engine.test.ts`'s new
    tests with a synthetic Land `CardDefinition`, same "Test Bear"/"Test
    Bolt" convention that file's own pre-existing fixtures already use).
    Original gap writeup, preserved below for history:

    Surveyed first (2026-09-09, the same session that added
    `synergy.ts`'s new `event: 'playLand'`/harness.ts's own `playLand`
    lifecycle branch): before this pass, NEITHER `harness.ts` NOR
    `engine.ts` distinguished "a land was played" from "a permanent was
    cast" at all — `harness.ts`'s own `lifecycleBefore` unconditionally
    emitted `fn: 'cast'` for any non-Instant/Sorcery/non-triggered/
    non-activated card, land included, and `engine.ts`'s `castSpell` has
    no land-typeLine branch whatsoever: a land goes through the exact same
    `canCastSpell`/`payMana`/`state.move(..., 'Stack')`/stack-push path as
    any other permanent spell, with an empty `manaCost` incidentally making
    it "affordable," but with none of 305.1's real restrictions actually
    enforced (no once-per-turn limit, no "sorcery-speed timing" gate
    distinct from spell-casting, and — wrongly — a real trip through the
    Stack a land never actually takes). **Closed for `harness.ts`**: a
    Land typeLine going through the ordinary scenario path now emits a
    real, distinct `fn: 'playLand'` (see synergy.ts's own `EventFact` doc
    comment for the paired Fact-vocab half, and `scripts/verify-synergy.mjs`'s
    matching `producedEvent` case) — this is what makes a card's own
    `play` fact require genuine trace evidence instead of an
    assumed/derived label, and is what actually proves Elven Passage's own
    library-fetched land (a bare `moveTo`, never a `cast`/`playLand`
    bracket) correctly does NOT produce one.
    **Still open, corrected framing (2026-09-09 follow-up)**: the real gap
    in `engine.ts`/`engine-trace.ts` is NOT "`castSpell` is missing a land
    case" — a land is never cast at all (CR 305), so "add a land branch to
    `castSpell`" would repeat the exact conceptual mistake `harness.ts` just
    got fixed for, just in a different file. The actual gap is that the
    real-engine pilot path has **no `playLand` action whatsoever** —
    nothing analogous to `castSpell`/`pilotCast` exists for CR 305's own
    special action (no stack, own once-per-turn limit, its own
    sorcery-speed-equivalent timing check, separate from spell-casting
    entirely). Building it is a genuinely separate, larger lift than the
    harness-side trace fix (a new per-turn-per-player counter `turn.ts`
    would need to track, plus the timing/legality check itself) — not
    attempted here.
    **Distinct from the gap, and worth flagging separately: whether
    `castSpell`/`canCastSpell` actively MIS-treat a land as castable today.**
    Checked: yes, structurally, if either is ever called on a land — nothing
    in either function branches on `typeLine`, so a Land `CardDefinition`
    passed to `canCastSpell` is checked under ordinary spell-casting rules
    (its empty `manaCost` parses as trivially affordable) and `castSpell`
    would genuinely `state.move(cardReal, 'Stack')` and push a `StackObject`
    for it — the same wrong "a land takes a trip through the Stack" behavior
    `harness.ts`'s own pre-fix `lifecycleBefore` used to produce, and
    `engine-trace.ts`'s `pilotCast` (~line 381) would unconditionally log
    `fn: 'cast'` for it too, regardless of typeLine. **However**: this is
    reachable only if some caller actually invokes `castSpell`/`pilotCast`
    with a Land `CardDefinition` — surveyed the real pool (2026-09-09): no
    FIN land's own `scenarios.ts` exports `runEngineScenarios()` today, so
    nothing in this codebase currently DOES call either function that way.
    So: a **live, dormant bug** — the code would misbehave the exact moment
    any FIN land adopts the real-engine-piloted path, not a hypothetical —
    but not (yet) an actively wrong result for any real card's own generated
    trace.json/synergy.json today, unlike the harness.ts case (which WAS
    live for every land in the pool, since every land already goes through
    `harness.ts`'s ordinary scenario path). Whoever builds the real
    `playLand` action above should treat guarding `castSpell`/`canCastSpell`
    against a Land typeLine (reject outright, same "fail loud" convention
    `parseManaCost` already uses for an unsupported mana symbol) as part of
    the same pass, not a separate follow-up — leaving the dormant mis-cast
    path reachable once a real `playLand` action exists alongside it would
    reintroduce exactly the ambiguity this whole gap is about.

13. ~~**Trigger-doubling ("Panharmonicon effect") — no general machinery for
    "a triggered ability triggers an additional time" under a condition.**~~
    **CLOSED (2026-09-12) — see this item's own final subsection below for
    the real closure writeup; everything through the "Re-checked fresh"
    subsection is kept as historical record of why a narrow fix was
    correctly rejected twice before the general mechanism was actually
    built.**
    Surfaced by Cloud, Midgar Mercenary (fin/10)'s own second static ability:
    "As long as Cloud is equipped, if a triggered ability of Cloud or an
    Equipment attached to it triggers, that ability triggers an additional
    time." Real Forge citation (`res/cardsfolder/cardsfolder.zip`'s
    `c/cloud_midgar_mercenary.txt`, the actual card script — a source
    checkout wasn't available, this is the real shipped script, grepped
    directly): `S:Mode$ Panharmonicon | ValidCard$ Card.Self+equipped,
    Equipment.Attached | Description$ ...` — Forge names this static-ability
    mode `Panharmonicon` after the card that originated the effect, and
    implements it as a general condition any card's own script can opt into
    (`ValidCard$` gates which permanents it applies to), not a one-off.
    This engine has no equivalent: `resolveCard()` dispatches a named
    trigger exactly once per scenario call, full stop — no conditional
    "fire this again" hook anywhere in the trigger-dispatch path
    (`card.ts`/`engine.ts`), and adding one is NOT a narrow, single-card
    fix the way Ultima, Origin of Oblivion's `onTapLandForC` gap was (a
    single new named trigger with a self-contained effect) — it requires
    teaching the general dispatch mechanism itself to conditionally re-fire
    ANY triggered ability, checked against a real "is this permanent
    equipped" condition, for BOTH the permanent itself and anything
    attached to it. Left as descriptive `staticAbilities` text only
    (`cards/cloud-midgar-mercenary/definition.ts`'s own comment already
    documents this — not new information, just now cross-referenced from
    here with the real Forge citation), no fact authored for it (would have
    zero real trace evidence to verify against — the same "genuinely empty,
    not missed authoring" treatment the pool's own already-audited
    parked-action-only cards get, per `SYNERGY_DESIGN.md`'s "Implementation
    notes"). Cloud's OWN ETB tutor ability (the card's other, fully
    real/traced/verified ability) is unaffected by this gap.

    **Re-checked fresh, 2026-09-12 (per direct user request — "fin 563
    could be used to test", fin/563 = Ultima Weapon, a real Legendary
    Equipment: "Whenever equipped creature attacks, destroy target creature
    an opponent controls. Equipped creature gets +7/+7. Equip {7}."):**
    before building anything, re-assessed whether this is now a narrow,
    scoped chokepoint worth adding (same "narrow hook at the one real call
    site" bar gap #8's damage-shields and the STUN/FINALITY counter
    replacements above already cleared) rather than just re-citing the
    standing writeup above. Conclusion: still NOT narrow, confirmed two new
    ways:
    - There is no single existing chokepoint function every trigger-firing
      call site in this codebase already funnels through — `resolveCard()`
      is called directly from at least 6 independent sites (`stack.ts`,
      `engine.ts`'s two separate enter-trigger dispatch sites, `saga.ts`,
      `harness.ts`'s scenario runner, and `engine-trace.ts`'s own
      `pilotFireTrigger` for triggers with no auto-dispatch at all, like
      Cloud's own equip-attack trigger). STUN/FINALITY's own counter
      replacements (above) each intercept exactly ONE real mutation method
      (`untap`/`move`) — trigger-doubling would need to intercept ALL of
      the above, or refactor them to funnel through one, either of which is
      a real, broader infrastructure change, not a narrow hook.
    - This is genuinely not Cloud-specific. Grepped the full pool for
      "additional time": 2 OTHER real FIN cards need the identical general
      mechanism, each with a DIFFERENT gating condition — The Masamune
      ("Equipped creature has 'If a creature dying causes a triggered
      ability of this creature or an emblem you own to trigger, that
      ability triggers an additional time.'" — a dying-trigger-or-emblem
      gate, not an equipped-attacks gate) and Traveling Chocobo ("If a land
      or Bird you control entering the battlefield causes a triggered
      ability of a permanent you control to trigger, that ability triggers
      an additional time." — a land/Bird-ETB gate, on ANY permanent you
      control, not just self). Three real cards, three genuinely different
      gating conditions and trigger occasions — confirming this needs a
      real, general "is this trigger-firing event double-able, and by what
      condition" dispatch mechanism, not a single-card special case.
    Built instead, since real machinery for the CONDITION (not the
    doubling) already existed: a real, full engine-piloted combo scenario
    (`cards/cloud-midgar-mercenary/scenarios.ts`) — cast Cloud, real ETB
    tutors the real Ultima Weapon into hand, cast + equip it for real
    (Equip {7}, real `actions.equip`), real 508.1f attack declaration,
    Ultima Weapon's own real `onEquippedAttacks` trigger fires (manually,
    via the pre-existing `pilotFireTrigger` — no attack-trigger
    auto-dispatch exists in this engine at all, a separate, already-
    accepted gap every attack/dies-triggered card hits, not new), producing
    ONE real `destroy` log entry against a real opponent creature. The
    doubling itself is NOT modeled and NOT fabricated — only one destroy
    fires, honestly, matching this section's own standing conclusion.
    **Real, good side effect**: this trace is the first in the pool where
    an ATTACHED Equipment's own triggered ability genuinely fires while
    attached — `cloud-midgar-mercenary/synergy.json`'s own equipment-half
    `triggeredAbility` want fact (`target:{types:{has:['Equipment']},
    attachedToSelf:true}`) previously had ZERO possible trace evidence
    (documented above and in that card's own `progress.json`); it now does,
    and `verify-synergy.mjs` was updated with a real evidence branch
    recognizing this exact shape (a real `equip` bracket naming this card,
    followed anywhere later by a real `trigger` bracket naming that same
    attached equipment) — see that script's own updated
    `isCloudEquipmentTriggeredAbilityFact` doc comment. This closes the
    CONDITION-side evidence gap for that one fact; the DOUBLING-side gap
    documented in this whole section is unchanged.

    **REAL CLOSURE (2026-09-12, later the same day):** built the general
    mechanism the two subsections above correctly concluded was needed,
    rather than a third narrow-fix re-assessment. One new shared function,
    a new field on `CardDefinition`/`RealCard`, and a real migration of
    every trigger-firing call site in this codebase:
    - **`card.ts`'s new `TriggerDoublingGrant`** (`CardDefinition
      .triggerDoubling?: TriggerDoublingGrant[]`) — a real, structured
      declaration of the gate, mirroring `continuousKeywordGrants`'s own
      `ContinuousGrantTargeting` shape/doc-comment convention (gap #14).
      `scope` picks WHO can double (`'selfAndAttachedEquipment'` — Cloud;
      `'equippedSelf'` — Masamune, same real `equippedBySelf` recipient
      resolution an Equipment-broadcast grant already uses;
      `'anyPermanentYouControl'` — Traveling Chocobo); `causedBy` (optional
      — Cloud's own gate has none) restricts WHICH real cause of the
      firing qualifies (`'dying'` or `'entersBattlefield'`); `entersMatch`
      (only for the latter) is an OR-list of `{isLand?, subtype?}` filters
      against the REAL entering permanent (Traveling Chocobo's own "a land
      OR Bird").
    - **`state.ts`'s new `RealCard.triggerDoubling`** (a duck-typed,
      structurally-identical field — `state.ts` deliberately never imports
      from `card.ts`, same convention `continuousKeywordGrants` already
      established) and **`shouldDoubleTrigger(state, firing, cause?)`** —
      the one real, shared QUERY-TIME check (same "recalculated on read,
      never a fixed/timestamped delta" treatment `effectiveKeywords`
      already establishes), looping every real `Battlefield` permanent's
      own `triggerDoubling` grants and checking each against the firing
      permanent + optional cause. Copied onto `RealCard` at the same
      resolve-time chokepoints `continuousKeywordGrants`/
      `spellCostReductionGrants` already use (`engine.ts`'s `resolveTop`/
      `playLand`).
    - **New file `functional-model/triggers.ts`, `fireTrigger(state, card,
      ctx, actions, triggerName, cause?, onDoubled?)`** — the ONE shared
      chokepoint every trigger-firing call site now funnels a NAMED
      trigger's resolution through, instead of calling `card.ts`'s
      `resolveCard` directly: resolves once, checks `shouldDoubleTrigger`
      off `ctx.self` (the RealCard whose trigger this is), and if it
      qualifies, resolves the SAME named trigger a second time — the
      literal, simplest faithful model of "triggers an additional time"
      given this engine has no separate "trigger object queued on the
      stack" concept to duplicate instead. Lives in its own new file (not
      folded into `state.ts` or `engine.ts`) specifically to avoid a real
      circular VALUE import: `engine.ts` already imports `{advanceSaga}`
      from `saga.ts` as a value, so `saga.ts` calling a `fireTrigger` that
      lived in `engine.ts` would be a genuine runtime cycle neither file
      has today (their existing cross-references are all `import type`,
      erased before anything runs) — `triggers.ts` sits below both,
      importing only `card.ts` (a real value import, `resolveCard`) and
      `state.ts` (a real value import, `shouldDoubleTrigger`), with nothing
      importing it back.
    - **All 6 real call sites migrated**, exactly the 6 both earlier
      subsections identified: `stack.ts`'s `Stack.resolveTop` (now takes an
      optional `state` param — a triggerName-bearing object routes through
      `fireTrigger` when given one, unchanged bare `resolveCard` behavior
      otherwise, so every existing plain-LIFO test stays correct with zero
      changes); `engine.ts`'s THREE dispatch sites (not two — a fresh count
      while migrating found `fireOnPhaseEnterTriggers`'s own upkeep/
      end-step auto-fire is a third, distinct from `playLand`'s and
      `resolveTop`'s own ETB firings) — `playLand`/`resolveTop` both pass a
      real `{kind:'entersBattlefield', entered:<the resolving/entering
      permanent itself>}` cause (a permanent's own ETB genuinely IS "a
      permanent entering the battlefield causing a trigger," including
      potentially its OWN — see Traveling Chocobo's own scenario below for
      why this self-referential case is real, not a bug),
      `fireOnPhaseEnterTriggers` passes no cause (no real FIN card's
      upkeep/end-step trigger needs one); `saga.ts`'s `advanceSaga` (no
      cause — a Saga's own lore-counter chapter tick isn't caused by dying
      or entering); `harness.ts`'s scenario runner (both the top-level
      `scenario.trigger` dispatch and the `sequence` step's `trigger`
      branch — ability/activate dispatch stays on bare `resolveCard`,
      correctly unaffected, since Panharmonicon-style doubling only ever
      applies to a TRIGGERED ability, never an ACTIVATED one);
      `engine-trace.ts`'s `pilotFireTrigger` (gained a new optional trailing
      `cause` param — every one of its ~14 existing real call sites across
      the pool stays unchanged, since it's purely additive).
    - **Real causal-order trace logging**: `fireTrigger`'s own `onDoubled`
      callback parameter lets a caller that logs a `{fn:'trigger', ...}`
      bracket entry (`pilotFireTrigger`, and `engine-trace.ts`'s
      `pilotResolveTop`/`pilotPlayLand` via a pre-check against the same
      `shouldDoubleTrigger`) log a SECOND bracket at the exact right moment
      — bracket, first round of real effects, SECOND bracket, second round
      of real effects — rather than fabricating the doubled bracket
      up-front or after both rounds of effects already ran.
    - **All 3 real FIN cards wired for real**: Cloud, Midgar Mercenary
      (`triggerDoubling: [{scope:'selfAndAttachedEquipment'}]`), The
      Masamune (`[{scope:'equippedSelf', causedBy:'dying'}]` — the real
      "...or an emblem you own" half stays permanently unreachable, no
      emblem mechanism exists anywhere in this engine, documented on the
      field itself as a real, accepted, permanent sub-gap, not silently
      dropped), Traveling Chocobo (`[{scope:'anyPermanentYouControl',
      causedBy:'entersBattlefield', entersMatch:[{isLand:true},
      {subtype:'Bird'}]}]`) — all three replace the old documentary-only
      `staticAbilities` string for this one clause specifically (their
      OTHER real statics, where present, stay text — unrelated, unmodeled
      mechanisms, e.g. Masamune's first-strike-if-attacking clause).
    - **All 3 cards' own `scenarios.ts` updated to demonstrate the real
      doubling, with genuine trace evidence**: Cloud's own real combo
      scenario (cast Cloud, real ETB tutors Ultima Weapon, cast + equip it,
      real attack) now shows Ultima Weapon's own `onEquippedAttacks`
      trigger firing TWICE — two real `destroy` log lines against TWO real
      opponent creatures (Coeurl AND Hill Gigas, added specifically because
      the doubled trigger needs two distinct legal targets, not one
      destroyed twice) — the old "doubling NOT modeled, only one destroy
      fires honestly" framing is gone from its own comments/`progress.json`.
      The Masamune's own new real combo scenario (replacing its old flat
      `harness.ts` scenario) equips a real Al Bhed Salvagers (a real FIN
      card with its own real `onDies` trigger), which then genuinely dies
      in real lethal combat (Hill Gigas blocks, a one-sided 704.5g death) —
      its own dying trigger, fired manually with a real `{kind:'dying'}`
      cause (same "no auto-fire for a dies-triggered ability" pattern
      dwarven-castle-guard's own scenario already established), genuinely
      fires TWICE. Traveling Chocobo's own new real scenario (replacing its
      old "no resolvable effect" placeholder) reuses Ambrosia Whiteheart (a
      real FIN card with a real Landfall trigger) — a real land entering
      the battlefield, fired manually with a real
      `{kind:'entersBattlefield', entered:<the real land>}` cause, doubles
      Ambrosia's own Landfall pump. **Real, genuinely unplanned but
      textually correct consequence, found running the scenario and kept
      rather than avoided**: Ambrosia Whiteheart is herself a Bird, so her
      own ETB (auto-fired by `engine.ts`, which threads the identical
      `entersBattlefield` cause through for a resolving permanent's own
      ETB) ALSO doubles — the first real trace in the pool showing a
      card's own ETB double itself via a board-wide Panharmonicon-style
      grant, not a bug.
    - **New unit tests**: `functional-model/triggers.test.ts` (new file, 12
      cases) — a baseline no-grant case (fires once); all 3 real gate
      shapes each doubling for real (including Cloud's shape doubling BOTH
      the equipped self's own trigger AND the attached Equipment's own
      trigger); the negative cases proving each gate's own real
      precondition is genuinely enforced, not just its presence (Cloud's
      own gate does NOT double while unequipped; Masamune's own gate does
      NOT double with no/wrong cause, and does NOT double a DIFFERENT
      creature's own trigger; Chocobo's own gate does NOT double a
      non-land/non-Bird cause, and does NOT double an opponent's own
      permanent). `engine.test.ts`'s new `Trigger-doubling` describe block
      (3 cases) proves the real `engine.ts` wiring specifically (not just
      `triggers.ts`'s own pure logic): a permanent's own ETB does NOT
      double through the real `castSpell`->`resolveTop` path while nothing
      is equipped to it yet (Cloud's own real story — the static is present
      from the moment he resolves, but his own ETB tutor still only fires
      once); once genuinely equipped, a LATER real upkeep/end-step
      auto-fire (`fireOnPhaseEnterTriggers`) DOES double; a wholly
      unrelated permanent's own trigger does NOT double even once Cloud is
      equipped.
    - **Verified**: `vitest run functional-model` — 340/340 (325 baseline +
      12 new `triggers.test.ts` + 3 new `engine.test.ts` cases).
      `verify-synergy.mjs` (scoped to the 6 touched/reused cards — Cloud,
      Masamune, Chocobo, Ultima Weapon, Al Bhed Salvagers, Ambrosia
      Whiteheart): 0 hard failures (one new real hard failure surfaced and
      fixed during this pass — Traveling Chocobo's own new combo trace
      reuses Ambrosia Whiteheart's own `read:getCardsIn` battlefield read,
      which `verify-synergy.mjs` initially flagged against Chocobo's own
      synergy.json as an unexplained aggregate read; fixed with a new
      `isTravelingChocoboAmbrosiaComboRead` exemption, same shape/treatment
      `isCloudUltimaWeaponComboRead` already established for the identical
      structural situation — a combo scenario reusing a different card's
      own effect). `verify-synergy.mjs` (full pool): 0 hard failures.
      `tsc --noEmit`: unchanged pre-existing baseline (48 errors, none in
      any file this pass touched).
    - **Deliberately NOT done this pass** (a synergy-authoring, not engine,
      question): no NEW source Fact was authored on any of the 3 cards'
      own `synergy.json` for the doubling EFFECT itself (as opposed to the
      pre-existing CONDITION-side sink facts, unaffected) — Cloud's own
      `progress.json` already records the user's own 2026-09-11 call not
      to author one; this pass didn't re-litigate that call, but also
      didn't treat it as a permanent bar now that real trace evidence is
      achievable. Left open for whoever authors synergy.json content next.

14. **Continuous, turn-conditional static keyword/P&T/type grants.** **Closed
    (2026-09-12), same "narrow rather than delete" treatment gap #7's
    Flashback narrowing established.** Real FIN cards: Dion, Bahamut's
    Dominant's own "Dragonfire Dive — During your turn, Dion and other
    Knights you control have flying" (fin/16), and Ardyn, the Usurper's own
    "Demons you control have menace, lifelink, and haste" (checked fresh
    against real oracle text: genuinely unconditional, no "during your
    turn" restriction, unlike Dion's). Real machinery now exists:
    `CardDefinition.continuousKeywordGrants?: {keywords, includeSelf,
    subtype?, onlyDuringYourTurn?}[]` (`card.ts`) — copied onto the live
    `RealCard` only at the moment a permanent actually resolves onto the
    battlefield (`engine.ts`'s `resolveTop`, same pre-existing pattern
    `manaAbility`'s own resolve-time derivation already established, not a
    new one). `state.ts`'s new `effectiveKeywords(state, card)` is the real
    QUERY-TIME read path (mirrors `effectivePT`'s "recalculated on read"
    CDA pattern) — unions a card's own printed `keywords` with every
    currently-qualifying grant from any battlefield permanent, checking
    `includeSelf`/`subtype`+same-controller and (if `onlyDuringYourTurn`) a
    new `GameState.activePlayerId` field kept in sync by `engine.ts`'s
    `doAdvance()` on every real phase/turn change (`isActiveOrDefault`
    treats `undefined` as "yes," so a plain harness.ts `Scenario` with no
    turn concept still reads as "your turn," matching its own documented
    baseline). This is now the REAL read path, not cosmetic: `wrapCard`'s
    `hasKeyword`, `state.dealDamage`'s Deathtouch/Lifelink checks, and
    `engine.ts`'s Haste/Defender sickness/attack-legality checks all route
    through it — a granted keyword genuinely exempts summoning sickness,
    triggers lifegain, and blocks attacking, not just a label. Both cards
    have real `grantKeyword` SOURCE facts backed by this
    (`dion-bahamut-s-dominant-bahamut-warden-of-light`'s front face,
    `ardyn-the-usurper`). **Real, still-open sub-gap**: a continuous grant
    is derived/query-time and never produces a discrete `fn:'grantKeyword'`
    trace-log ACTION line (nothing ever calls `actions.grantKeyword` for
    it) — the only possible trace evidence is a deliberate `read:hasKeyword`
    query against real board state (new `verify-synergy.mjs` evidence
    branch, same "manual CDA read" pattern `adelbert-steiner`'s own
    `read:getNetPower` line already established); Dion's own
    `engine-trace.ts` pilot-script scenario can inject this, but Ardyn's
    plain `harness.ts` `Scenario[]` style structurally cannot (no field
    lets a pilot script push an arbitrary custom log line mid-scenario), so
    Ardyn's own 3 grant facts are covered by a narrow, documented
    `isArdynDemonGrantFact` exemption instead of real trace evidence — real
    fact, real mechanism, zero possible evidence given this one card's
    scenario-authoring style. **Also still open**: nothing in this engine
    ever logs a discrete action for a continuous grant, so the app's replay
    UI (`app/SCENARIO_REPLAY.md`'s own documented keyword-icon rendering,
    keyed off either a card's static `cardKeywords` prop or a discrete
    `grantKeyword` log entry) currently has no way to visually show a
    query-time grant turning on/off across turns — a `card`-agent-side
    change to consult `CardDefinition.continuousKeywordGrants` directly
    against the replay's own per-step turn state, not a further engine
    change.
    **Generalized further (2026-09-12, Dragoon's Lance/fin/17):** a third
    real recipient mode, `equippedBySelf` — the grant follows whatever
    real, LIVE creature THIS permanent is currently attached to
    (`RealCard.attachedToId`, re-checked fresh on every read, so it
    genuinely moves with the Equipment if re-equipped) — covers "During
    your turn, equipped creature has flying." Functionally verified both
    directions (on while equipped+your turn, off unequipped, off on the
    opponent's turn). Same real evidence wall as Ardyn's own facts:
    Dragoon's Lance's plain `harness.ts` Scenario style can't inject a
    `read:hasKeyword` line either, covered by a new SHAPE-scoped (not
    card-name-scoped) `isEquippedKeywordGrantFact` exemption — reusable by
    any future Equipment-broadcast turn-conditional grant.

    **That same card's OTHER static clause ("+1/+0 and is a Knight in
    addition to its other types") — the real, separate sub-gap this row
    used to leave open — is now ALSO CLOSED (2026-09-12, same day):** the
    identical query-time recipient-resolution mechanism generalizes to TWO
    new sibling `CardDefinition` fields, `continuousPTGrants` (a FIXED P/T
    delta, layer 7c) and `continuousTypeGrants` (a creature-subtype
    broadcast, layer 4) — both share `continuousKeywordGrants`'s own
    `includeSelf`/`subtype`/`onlyDuringYourTurn`/`equippedBySelf` targeting
    shape (factored into one shared type, `card.ts`'s
    `ContinuousGrantTargeting`, and one shared resolution function,
    `state.ts`'s `qualifiesForContinuousGrant`, so the logic isn't
    duplicated three times). `effectivePT` (state.ts) folds a qualifying
    `continuousPTGrants` delta into its existing layer-7a-CDA-then-counters
    computation; a new `effectiveSubtypes` (mirroring `effectiveKeywords`
    exactly) is the real read path for creature-type grants, now consulted
    by `wrapCard`'s `hasSubtype` instead of a raw `card.subtypes.includes`
    read. Real Forge citation: `StaticAbilityContinuous.java` — layer
    SETPT/CHARACTERISTIC (`addPTBoost`, ~line 679-702) and layer TYPE
    (`addChangedCardTypes`, ~line 866-867) are the SAME real static ability
    Forge itself uses for these Equipment cards' `Mode$ Continuous |
    Affected$ Creature.EquippedBy | AddPower$/AddToughness$/AddType$ ...`
    scripts (`dragoons_lance.txt`/`paladins_arms.txt`/`crystal_fragments_
    summon_alexander.txt`/`white_mages_staff.txt`/`sages_nouliths.txt`/
    `machinists_arsenal.txt`/`astrologians_planisphere.txt`, `../mtg-forge`).

    **7 real cards checked and updated**: Dragoon's Lance (`+1/+0`/Knight —
    both now real, Flying already was), Paladin's Arms (`+2/+1`/Knight —
    Ward already was), Crystal Fragments (`+1/+1`), White Mage's Staff
    (`+1/+1`/Cleric), Sage's Nouliths (`+1/+0`/Cleric), Astrologian's
    Planisphere (Wizard only — this card has no P/T clause), Machinist's
    Arsenal (Artificer only — its own "+2/+2 for each artifact you control"
    is a genuinely VARIABLE, board-state-SCALED bonus, real Forge
    `SVar:X:Count$Valid Artifact.YouCtrl/Times.2` on the SAME static
    ability, which `continuousPTGrants`'s deliberately-fixed `{power,
    toughness}` shape structurally can't represent — stays real
    `staticAbilities` text only, a real, separate, still-open gap, same
    class as Gaelicat's/Magitek Infantry's own threshold-CDA gaps, NOT
    closed by this pass).

    **Evidence, checked per-card, not assumed uniform** (same "Ardyn vs.
    Dion" distinction this gap's own keyword closure already established):
    of these 7 cards, **Crystal Fragments is the one whose own
    `scenarios.ts` is a real `engine-trace.ts` pilot** — its own `pump`
    fact now has REAL, achievable trace evidence (a genuine
    `read:getNetPower` line pushed right after `state.equip()`, showing
    Dwarven Castle Guard's printed 2/1 genuinely recalculate to 3/2), so
    the old `isCrystalFragmentsEquippedPumpFact` name-scoped exemption
    (`verify-synergy.mjs`) is REMOVED outright, not just left in place. The
    other 6 cards' own `scenarios.ts` are plain `harness.ts` Scenario[]
    arrays with no manual-log-injection field (same structural wall
    Ardyn's/Dragoon's-Lance's-own-Flying-grant's facts already hit) — their
    `pump`/`grantType` facts stay exempted, now via two new SHAPE-scoped
    (not card-name-scoped) checks, `isEquippedPTGrantFact`/
    `isEquippedTypeGrantFact`, replacing the old per-card-name exemption
    lines (11 lines collapsed to 2 reusable functions). A `hasSubtypeReadEvidence`
    check (the direct `effectiveSubtypes` analogue of the existing
    `hasKeywordReadEvidence`) is wired into `verify-synergy.mjs` for real,
    ready for a FUTURE Equipment card whose own scenario CAN inject a
    `read:hasSubtype` line, even though no card in the pool exercises it
    yet.

    New tests: `state.test.ts`'s new `effectiveKeywords / effectivePT /
    effectiveSubtypes — continuous, query-time grants` describe block (9
    cases spanning all three grant families: a subtype-matched
    unconditional grant, `onlyDuringYourTurn` on/off for both the keyword
    and P/T families, a fixed-delta `equippedBySelf` grant genuinely
    following a LIVE re-equip for both P/T and type grants, additive
    stacking with a `+1/+1` counter, `wrapCard.hasSubtype` reading a
    granted type exactly like a printed one, and an `includeSelf`+`subtype`
    type grant — proving the shared targeting helper, not a coincidence).
    This also closes a real, pre-existing test-coverage gap: no unit test
    for `effectiveKeywords`/`continuousKeywordGrants` existed at all before
    this pass, despite this gap's own earlier "functionally verified"
    claim (verified only via a throwaway script, never committed as a real
    test) — now real, permanent coverage exists for that half too.

    **Adjacent open item, still real, NOT closed by this pass — checked
    the actual UI consumer directly rather than assuming its shape.**
    `app/components/ScenarioReplayTrace.vue`'s `continuousGrantedKeywords()`
    (the keyword case's own live-recalculated replay consumer — a
    cross-lane touch a prior engine-agent pass made directly into this
    `card`-owned file, same precedent this note follows) does NOT yet
    handle `equippedBySelf` grants AT ALL, even for the pre-existing
    keyword case (Dragoon's Lance's own "During your turn, equipped
    creature has flying") — its own doc comment already documents this as
    an accepted, known gap: `scenarioReplay.ts`'s own `equip` case doesn't
    record WHICH creature an Equipment attached to, only that both chips
    exist, so `grant.equippedBySelf` can never be matched there today. This
    means TWO things are needed before a P/T-/type-grant chip could
    visually toggle in the replay UI, not one:
    1. `scenarioReplay.ts` would need to start recording the real
       attachment target on its own `equip` log consumption (a `card`-lane
       change, prerequisite for EITHER grant family, including the
       already-shipped keyword one).
    2. Sibling `continuousGrantedPT()`/`continuousGrantedType()` functions,
       mirroring `continuousGrantedKeywords()`'s own generic, no-card-
       specific-branch shape, reading `CardDefinition.continuousPTGrants`/
       `continuousTypeGrants` (which would need their own new
       `ScenarioReplayTrace.vue` props, mirroring the existing
       `continuousKeywordGrants` prop) instead of `continuousKeywordGrants`.
    Engine-side machinery is fully ready for either (`RealCard.
    continuousPTGrants`/`continuousTypeGrants` are real, populated fields
    any consumer can read the same way `continuousKeywordGrants` already
    is) — both remaining pieces are `card`-lane UI work, not touched here,
    same "engine ready, UI-side change is a different lane" boundary this
    gap's own original keyword closure already drew. Since NONE of the 7
    real cards this pass touches have their own `equippedBySelf` grant
    visually toggling in the replay UI TODAY regardless (the keyword case
    was never wired for this recipient mode either), this is a real,
    pre-existing, unaffected-by-this-pass limitation, not a regression
    this pass introduces.

15. ~~**Coin flips / random outcomes, and replacement effects on them.**~~
    **CLOSED (2026-09-12)**, narrowly. A minimal, real coin-flip resolution
    primitive now exists: `state.ts`'s new `flipCoin(player, won): boolean`
    — mirrors `priority.ts`'s own established "no AI, caller supplies the
    decision" convention (the caller decides win/loss for an ordinary flip;
    no dice-rolling/RNG infrastructure invented, same as `priority.ts`'s own
    header already commits to for every other decision point in this
    engine). Edgar, King of Figaro (fin/51)'s own "Two-Headed Coin — The
    first time you flip one or more coins each turn, those coins come up
    heads and you win those flips" (real Forge citation:
    `StaticAbilityFlipCoinMod.java`'s `FlipCoinMod`/`Result$ True` mode,
    `S:Mode$ FlipCoinMod | ValidPlayer$ You | CheckSVar$ Count$YouFlipThisTurn
    | SVarCompare$ EQ0 | Result$ True`, `res/cardsfolder/e/
    edgar_king_of_figaro.txt`) is now a real, narrow replacement hook at
    that one chokepoint — NOT general 614/616 machinery: a new
    `GameState.flippedCoinThisTurn: Set<playerId>` tracks whether a
    player's FIRST flip this turn has already happened (cleared at Cleanup
    by a new `resetFlippedCoinThisTurn()`, wired into `turn.ts` alongside
    the other existing Cleanup resets); a new `'TwoHeadedCoin'` `Keyword`
    (same `effectiveKeywords`-based approximation as gap #8/#8b's shields —
    the `'Unblockable'` precedent again) forces a win when this is the
    player's first flip of the turn, overriding whatever the caller
    requested. `cards/edgar-king-of-figaro/definition.ts` now declares
    `keywords: ['TwoHeadedCoin']` (replacing the old documentary-only
    `staticAbilities` text). A real `event: 'winCoinFlip'` Fact is
    authored with genuine trace evidence: Edgar's own `scenarios.ts` invokes
    `state.flipCoin` directly as a synthetic probe (same class as gap #8b's
    `playerGainsLife` probe — a real mechanism demonstrated independent of
    a triggered ability actually causing the flip), deliberately REQUESTING
    a loss to prove the replacement genuinely overrides the caller's own
    input rather than coincidentally agreeing with it; the trace logs
    `{fn:'coinFlip', player, won, requestedWin, forced}`.
    `scripts/verify-synergy.mjs`'s new `producedEvents` case for `coinFlip`
    (`won`+`forced` → `winCoinFlip`, else plain `coinFlip`) gives this real
    evidence — no exemption needed. New tests: `state.test.ts`'s
    `GameState.flipCoin` describe block (5 cases: forces a win overriding
    the caller's own request, no Two-Headed Coin = passthrough both ways,
    a SECOND flip the same turn is unaffected — CR's own "the FIRST time"
    wording, mechanically enforced — `resetFlippedCoinThisTurn` resets the
    "first flip" status, an opponent's Two-Headed Coin doesn't cross-affect
    another player's own flip).
    **Still real, explicitly NOT modeled**: true randomness/probability of
    any kind (an ordinary, non-replaced flip's outcome is still 100%
    caller-supplied, same as every other decision point in this engine —
    accepted, not a gap, per the "no AI" convention above) and any
    OTHER coin-flip payoff card that cares how a flip actually landed
    (checked: no other FIN card needs one). `event:'coinFlip'` (added
    2026-09-09 for The Gold Saucer's own "Flip a coin" ability) is
    unaffected/unchanged by this closure — it's still just "the flip
    happened," now joined by `winCoinFlip` for the win-outcome-specific
    case.

16. ~~**No "play a card from the top of your library" primitive, and no
    persistent "attacked this turn" condition.**~~ **CLOSED (2026-09-12)**:
    surfaced migrating The Lunar Whale (fin/60): "As long as The Lunar Whale
    attacked this turn, you may play the top card of your library." Two
    independent, real gaps, both checked directly rather than assumed, both
    now closed for real:
    - **The "play" primitive.** `card.ts`'s new `kind:'playFromLibraryTop'`
      Effect (no fields — CR 601/305's own "play" dispatch is total over
      whatever's actually on top, never scoped to a subset) reads
      `ctx.you.getCardsIn('Library')[0]` and calls a new `Actions.play`
      (`interfaces.ts`'s own pre-existing but previously-unused ambient
      `play(player, target)` stub, extended with an optional third
      `card?: CardDefinition` param — `RealCard` carries no live
      `CardDefinition` reference, so the caller supplies it via a new
      `EffectContext.topLibraryCard`, same "explicit, caller-supplied real
      fact" convention `castFrom`/`mode`/`declaredTarget` already
      establish). The REAL dispatch — `engine.ts`'s new
      `canPlayFromLibraryTop`/`playFromLibraryTop`, reusing the existing
      `canPlayLand`/`playLand` (a land) and `canCastSpell`/`castSpell`
      (anything else) pairs verbatim, plus a real check that the given
      `RealCard` genuinely IS `caster.library[0]` right now — lives in
      `engine-trace.ts`'s own `pilotActions` override of `Actions.play` (the
      one `Actions` method NOT reused as-is from `harness.ts`'s
      `loggingActions`, since only an engine-aware caller has the
      `GameEngine` reference `canPlayLand`/`castSpell` need); real Forge
      citation confirming the same land-vs-spell dispatch shape,
      `PlayEffect.java` (forge-game/.../ability/effects/PlayEffect.java
      ~line 330-351 for the land branch — `tgtSA.isLandAbility()` resolved
      directly, no stack; ~line 307-473 for the spell branch —
      `playSaFromPlayEffect`, the real cast path). `harness.ts`'s own
      `loggingActions.play` (used by any card NOT opted into the
      engine-piloted pilot path) is a real but plain fallback with no
      turn/mana legality — same accepted, documented scope every other
      `loggingActions` method already has.
    - **The "attacked this turn" condition.** `RealCard.attackedThisTurn`
      (state.ts) — a real, persistent per-permanent boolean, set by
      `engine.ts`'s `declareAttackers` for every real declared attacker
      (unconditionally, regardless of whether the attack is later blocked/
      dealt damage — 508.1's own "has attacked" is about the DECLARATION),
      cleared game-wide by a new `state.clearAttackedThisTurn()` at every
      real Cleanup (`turn.ts`'s own Cleanup branch, alongside
      `clearAllDamage`/`clearUntilEndOfTurnKeywordGrants`) — a plain
      boolean reset, not a turn-number comparison like
      `GameEngine.enteredThisTurn` (that field needs to compare against a
      LATER turn number; this one is simply false again every Cleanup).
      Real Forge citation: `CardDamageHistory.attackedThisTurn`/
      `hasAttackedThisTurn(GameEntity)` (forge-game/.../card/
      CardDamageHistory.java lines 26-27/88-90), set via
      `setCreatureAttackedThisCombat` (~line 54-59, itself called from
      `CombatUtil.java` ~line 386 the moment an attacker is declared),
      cleared each turn by `CardDamageHistory.newTurn()` (~line 282-283) —
      functionally identical to clearing at THIS engine's own Cleanup,
      since Cleanup is always the last phase before the next turn's Untap
      in this engine's fixed phase list.
    Wired together for real on The Lunar Whale itself
    (`cards/the-lunar-whale/definition.ts`): a `triggers:
    [{name:'playFromLibraryTop', effects:[{kind:'playFromLibraryTop'}]}]`
    entry — NOT a real CR 603 triggered ability (this clause is a
    continuous granted PERMISSION, not something that triggers), but reusing
    the same "named effect bundle, manually invoked via `pilotFireTrigger`"
    shape this engine already uses for a real triggered ability it can't
    auto-fire (Ultima Weapon's own `onEquippedAttacks`) — a pilot script is
    responsible for only invoking it once `attackedThisTurn` is genuinely
    set, same "engine primitives don't know about a specific card's own
    gating condition" split `crewedBy`/`declaredTarget` already establish.
    `cards/the-lunar-whale/scenarios.ts` (`runEngineScenarios`) demonstrates
    the full real arc: crew (real `crewedBy`, `engine-trace.ts`'s
    `pilotActivate` extended to accept it — the FIRST real engine-piloted
    Crew scenario in the pool, every prior `crewCost` card having stayed on
    the flat `harness.ts` style to sidestep the latent crew/second-ability
    collision bug noted elsewhere in this doc, which doesn't apply to The
    Lunar Whale since it has no second ability) → real attack declaration
    (genuinely sets `attackedThisTurn`) → real sorcery-speed-timing wait to
    Main2 (305.3/307.1a — playing a land or casting a spell off this
    permission is STILL only legal in a main phase with an empty stack, even
    under a "you may" grant that doesn't itself say otherwise; the engine's
    own `canPlayLand`/`canCastSpell` timing gate catches this for real,
    confirmed by deliberately trying it right after attacking first) → the
    real top card played twice, once a real Forest (dispatches to
    `playLand`) and once — after the Forest is gone — a real Barret Wallace
    underneath it (dispatches to `castSpell`, real `{3}{R}` paid). The
    former `isLunarWhalePlayFromLibraryFact` exemption
    (`scripts/verify-synergy.mjs`) is REMOVED — the card's own `event:'play'`
    fact now has real, achievable trace evidence (a new `case 'play'` in
    `producedEvents`, `'play'` added to `explainableFns`), and a new
    shape-scoped (not name-scoped) `isPlayFromLibraryTopPeekRead` exemption
    covers the one real remaining wrinkle: the effect's own
    `ctx.you.getCardsIn('Library')` peek logs as a `read:getCardsIn`, which
    the reverse "every aggregate read needs a matching declared want" check
    would otherwise misread as "this card wants Library-zone presence" (it
    doesn't — it's just how the effect finds what to play). Traveling
    Chocobo (fin/158, unmigrated) carries the identical clause ("You may
    play lands and cast Bird spells from the top of your library") and can
    reuse this exact `kind:'playFromLibraryTop'` vocabulary/primitive/
    exemption once migrated — its own narrower "lands and Bird spells only"
    scope is a gate on WHETHER to invoke the effect, not a different effect
    shape, so no further engine work is needed for it, just the migration
    itself (out of scope for this pass).
    **Adjacent gap, explicitly NOT closed by this pass, confirmed still
    genuinely different**: The Regalia (fin/58)'s own attack-triggered
    "reveal cards from the top of your library UNTIL you reveal a land, put
    that card onto the battlefield tapped and the rest on the bottom in a
    random order" — an UNBOUNDED dig-until-a-match effect, not "look at
    exactly the top card, dispatch on its type." `card.ts`'s `dig` Effect
    only covers a FIXED `qty` (not "keep going until X"), and the new
    `kind:'playFromLibraryTop'` only ever looks at ONE card (the real top,
    whatever it is) — reusing it for Regalia would silently misrepresent an
    unbounded search as a single-card peek. Still a real, open, separate
    gap (kept as an honest no-op `custom` Effect, that card's own
    `definition.ts` comment).
    New tests: `engine.test.ts`'s `canPlayFromLibraryTop /
    playFromLibraryTop` describe block (rejects a card that isn't genuinely
    the top of the library; dispatches a land to the real `playLand` path;
    dispatches a spell to the real `castSpell` path with real mana paid;
    rejects an unaffordable spell; rejects outside sorcery-speed timing —
    all mutating nothing when illegal) and two new cases in its existing
    `declareAttackers` describe block (a legal attacker's real
    `attackedThisTurn` flag gets set; a REJECTED attempt does not set it);
    `turn.test.ts`'s two new cases (the flag persists through the rest of
    the turn once set, then clears at the real Cleanup; it does not persist
    into a later turn — a real per-turn reset, not a one-time clear).

17. ~~**"Insert one more of this same step before the turn moves on" — a
    real, still-OPEN gap affecting multiple real FIN cards, structurally
    distinct from extra turns (500.7, gap #3).**~~ **CLOSED (2026-09-12).**
    Surfaced migrating Y'shtola Rhul
    (fin/86): "At the beginning
    of your end step, exile target creature you control, then return it to
    the battlefield under its owner's control. Then if it's the first end
    step of the turn, there is an additional end step after this step." (real
    Scryfall oracle text, `data/fin/fin_scryfall.json` collector_number 86;
    real Forge citation, `res/cardsfolder/y/yshtola_rhul.txt`'s own
    `SVar:DBAddEOT:DB$ AddPhase | ExtraPhase$ End of Turn | AfterPhase$ End
    of Turn | ConditionCheckSVar$ X | ConditionSVarCompare$ LT1` (gated by
    `SVar:X:Count$FinishedEndOfTurnsThisTurn` — Forge's own real mechanism
    for "only the FIRST end step of the turn adds another one").) Checked
    `turn.ts` directly before
    concluding this is a real gap, not just an unfamiliar corner of existing
    machinery: `TurnState.phaseIndex` walks the fixed `PHASES` const array
    one index at a time (`advancePhase`'s own `turn.phaseIndex + 1 <
    PHASES.length` branch), wrapping to a brand-new `TurnState` (next
    player, `Untap`, `turnNumber + 1`) only once `Cleanup` is exhausted —
    there is no way to re-enter or repeat an EARLIER index of `PHASES` within
    the SAME turn/player, and `TurnState.extraTurns` (gap #3, closed) only
    ever queues a WHOLE additional TURN at the turn-wrap point, never a
    single extra STEP spliced into the CURRENT turn's own phase list. These
    are genuinely different real MTG concepts (500.7's "extra turn" is a
    fresh turn with its own Untap/Upkeep/Draw/etc.; this card's "additional
    end step" repeats exactly one step, immediately, with no Untap/Upkeep/
    Draw/Combat in between) and Forge itself models them via two entirely
    separate mechanisms (`DB$ AddPhase` for a repeated step, this card's own
    real script above, vs. `DB$ AddTurn` for a genuine extra turn — Ultimecia,
    Time Sorceress // Ultimecia, Omnipotent's own real
    `res/cardsfolder/u/ultimecia_time_sorceress_ultimecia_omnipotent.txt`:
    `SVar:TrigAddTurn:DB$ AddTurn | NumTurns$ 1`, gap #3's own closed
    `queueExtraTurn`/`TurnState.extraTurns`) — confirming this isn't a
    redundant restatement of gap #3. No `Effect` kind, `Actions` method, or `TurnState` field
    anywhere in this model represents "insert one more of this same step" —
    genuinely unsupported, not fabricated: `cards/y-shtola-rhul/definition.ts`
    keeps this half of the ability as real, honest, undemonstrated
    documentary text (same "described but not executed" treatment
    `moogles-valor`'s own once-open keyword-grant gap got) rather than a
    fake `custom` no-op pretending to model it.
    **Correction after actually grepping the real cardsfolder pool-wide
    (don't repeat the mistake of assuming from one card alone): this is NOT
    narrow to Y'shtola.** `AddPhase` also backs 3 other real, already-
    migrated FIN cards' own "additional combat phase" clauses — Balthier
    and Fran (`res/cardsfolder/b/balthier_and_fran.txt`: `SVar:TrigAddCombat:
    AB$ AddPhase | Cost$ 1 R G | ExtraPhase$ Combat | AfterPhase$
    EndCombat`), Genji Glove (`res/cardsfolder/g/genji_glove.txt`:
    `SVar:DBAddCombat:DB$ AddPhase | ExtraPhase$ Combat | AfterPhase$
    EndCombat`), and Tifa, Martial Artist (`res/cardsfolder/t/
    tifa_martial_artist.txt`: `SVar:DBAddCombat:DB$ AddPhase | ExtraPhase$
    Combat | ConditionFirstCombat$ True | AfterPhase$ EndCombat` — not yet
    migrated into this pool, unlike the other two). `cards/balthier-and-fran/
    definition.ts` and `cards/genji-glove/definition.ts` had ALREADY
    independently hit this identical primitive gap (their own comments:
    "no turn/phase-structure Effect shape exists here" / "no phase/turn-
    structure Effect shape exists here") and, correctly, left it as honest
    undemonstrated text the same way this pass does for Y'shtola — but
    neither had a corresponding `ENGINE_GAPS.md` entry until now, so this
    same real gap was silently rediscovered per-card instead of tracked
    once, centrally. This entry is that first central tracking, generalized
    to cover BOTH real shapes actually needed today (an additional END step,
    Y'shtola; an additional COMBAT phase, Balthier and Fran/Genji Glove/Tifa)
    — both are the identical missing primitive ("repeat/insert one more
    occurrence of a specific phase within the CURRENT turn," Forge's own
    single `DB$ AddPhase` covers both via its `ExtraPhase$` parameter), not
    two separate gaps that happen to look similar. Revisit when a future
    migration wants to actually demonstrate it (would need a `TurnState`
    field structurally like `extraTurns` but scoped to "insert one more
    occurrence of a named phase before the turn's own phase list advances
    past `AfterPhase$`," not a new queued player/turn) — 4 real FIN cards
    now depend on it (1 migrated-and-documented here, 2 previously migrated
    with only a per-card comment, 1 not yet migrated), a big enough real
    count that this is genuinely worth closing in a future pass, not
    permanently deferred.
    **Closure (2026-09-12): a real, general mechanism now exists — not
    three name-scoped hacks.** `turn.ts`'s own `TurnState` gained two new
    fields: `queuedExtraPhases: PhaseGroup[]` (a FIFO queue of `'EndOfTurn'
    | 'Combat'` — the two real `PhaseType.PHASE_GROUPS` entries, `PhaseType
    .java` lines 30-37, this pool's cards actually need) and
    `phaseGroupEntryCount: Partial<Record<PhaseGroup, number>>` (a real
    per-turn "how many times has this group been entered" counter). Real
    Forge citation, cross-checked directly against `tmp/mtg-forge` (not
    assumed from the card scripts alone): `AddPhaseEffect.java`
    (forge-game/.../ability/effects/AddPhaseEffect.java) resolves `DB$
    AddPhase` by pushing onto `PhaseHandler.extraPhases: Map<PhaseType,
    Stack<ExtraPhase>>` (`PhaseHandler.java` line 74), keyed by the real
    `AfterPhase$` phase; `PhaseHandler.advanceToNextPhase` (`PhaseHandler
    .java` lines 156-174) checks that map FIRST, the moment the CURRENT
    phase is about to end, and pops (LIFO) an `ExtraPhase` to visit instead
    of its own ordinary `PhaseType.getNext` — mirrored here as `turn.ts`'s
    own `advancePhase`, which now checks `queuedExtraPhases` for a group
    whose LAST step (`PHASE_GROUP_END`) is the phase currently ending
    BEFORE its own prior "next index, or wrap to a new turn" logic, jumping
    `phaseIndex` back to that group's FIRST step (`PHASE_GROUP_START`)
    instead when one is queued (FIFO here vs. real Forge's per-key LIFO
    `Stack` — observably identical, since no FIN card in this pool ever
    queues more than one at a time). `nCombatsThisTurn`/`nEndOfTurnsThisTurn`
    (`PhaseHandler.java` lines 76-80, bumped the instant each group's own
    first step is entered — lines 299/362) and the real `isFirstCombat()`/
    `Count$FinishedEndOfTurnsThisTurn` reads (`PhaseHandler.java` line
    969-971; `AbilityUtils.java` lines 2204-2207) real card scripts gate
    "if it's the FIRST end step/combat phase of the turn" on are mirrored as
    `phaseGroupEntryCount`/`isFirstPhaseGroupOccurrenceThisTurn(turn, group)`
    (`=== 1` meaning "this is the first entry this turn," the same real
    fact Forge's own 1-based "entered" count and 0-based "already finished"
    count both encode from either side).
    A card's own effect triggers this via two new, general (not
    name-scoped) primitives: `card.ts`'s new `EffectContext
    .firstPhaseGroupOccurrenceThisTurn?: boolean` (same "caller-supplied
    real fact, not something an effect computes" convention `castFrom`/
    `mode`/`xPaid` already establish — set for real by `engine.ts`'s own
    `fireOnPhaseEnterTriggers` the moment an `'endStep'` trigger auto-fires,
    or declared per-scenario via a new `Scenario
    .firstPhaseGroupOccurrenceThisTurn` field the same way `mode`/`xPaid`
    are) and a new `Actions.queueExtraPhase(phaseType: PhaseGroup): void`
    (interfaces.ts's own real Forge-cited declaration, alongside
    `delayUntil`'s — genuinely distinct from it: `delayUntil` runs an
    arbitrary callback once a phase is reached, this repeats the phase/step
    ITSELF, re-firing whatever OTHER triggers fire during it too).
    `engine.ts` gained a thin `queueExtraPhase(engine, phaseType)` wrapper
    (mirroring `queueExtraTurn`'s own existing shape) over `turn.ts`'s
    function of the same name. Y'shtola Rhul's own `definition.ts` was
    rewired to actually call `actions.queueExtraPhase('EndOfTurn')` when
    `ctx.firstPhaseGroupOccurrenceThisTurn` is true — the "additional end
    step" clause is real now, not documentary-only text; its own
    `scenarios.ts` demonstrates both the real positive case (queues) and
    the real negative case (a later end step this turn does NOT re-queue,
    matching real Forge's own `ConditionSVarCompare$ LT1` gate that
    prevents an infinite chain of end steps).
    Real 500.1-shaped test coverage (not just the primitive in isolation):
    `turn.test.ts`'s new `queued extra phase group` describe block covers a
    queued extra End Step genuinely re-entering End Step exactly once (not
    infinitely) before moving on to Cleanup, a queued extra Combat phase
    re-entering the WHOLE 6-step combat sequence (CombatBegin through
    CombatEnd) without re-running Untap/Upkeep/Draw/Main1, a full turn with
    no queued extra phase behaving identically to before this pass (a real
    regression check), and `phaseGroupEntryCount` correctly resetting to
    empty at the next turn-wrap. `engine.test.ts`'s new `queueExtraPhase`
    describe block additionally proves the real `engine.ts`/`card.ts` wiring
    end-to-end (not just `turn.ts`'s own pure logic): a real `onEndStep`
    trigger fired through `castSpell`/`resolveTop`/`fireOnPhaseEnterTriggers`
    genuinely re-fires a second time when it queues, does NOT re-queue a
    third time, and Cleanup's own automatic actions still run untouched
    afterward; plus its own regression case (no queued extra phase behaves
    identically to before). `harness.ts`'s plain (non-engine) scenario path
    has no real `TurnState` in scope to mutate, so `loggingActions
    .queueExtraPhase` there just logs the real fact (`fn:'queueExtraPhase'`)
    without a mutation — `engine-trace.ts`'s own `pilotActions` override is
    where a REAL pilot script's `queueExtraPhase` genuinely mutates
    `pilot.engine.turn` (via the same `engine.ts` wrapper), for a future
    engine-piloted card that needs to demonstrate a LATER `advance()`
    actually re-entering the queued phase.
    `scripts/verify-synergy.mjs` gained `queueExtraPhase` in its own
    `IGNORED_FNS` set (real turn-structure bookkeeping, never
    produce-relevant — same bucket as `phase`/`delayUntil`), so the new
    action produces no spurious soft note; no new synergy Fact was added
    for it, same "never modeled as a Fact" treatment `queueExtraTurn`
    (gap #3) already established, since "insert/repeat a turn-structure
    step" isn't a produce/consume-shaped board effect any Fact vocabulary
    covers.
    **Genuinely NOT touched by this closure**: Balthier and Fran and Genji
    Glove's own "additional combat phase" clauses stay exactly as they were
    (an honest, undemonstrated `custom` no-op) — both still need real
    modeling of a "you may pay {cost}. If you do, ..." optional-payment gate
    (Balthier and Fran) and a `FirstCombat$ True`-gated attack trigger (both
    cards — real Forge citation confirms the WHOLE trigger, not just the
    `AddPhase` sub-ability, only fires "if it's the first combat phase of
    the turn," `genji_glove.txt`/`balthier_and_fran.txt`'s own `T:Mode$
    Attacks | ... | FirstCombat$ True`), neither of which this pass
    attempted — only the underlying phase-insertion PRIMITIVE those two
    cards' own comments already correctly identified as missing is now
    real and available for a future pass to wire them up with. Tifa,
    Martial Artist (the 4th real card needing this shape) is still not
    migrated into `cards/` at all — unaffected, no `cards/tifa-*` directory
    exists yet.

18. ~~**A static effect locking a DIFFERENT permanent's own activated-ability
    activation — real, still OPEN.**~~ **CLOSED (2026-09-12).** Surfaced
    migrating Stuck in Summoner's Sanctum (fin/76): "Enchanted permanent
    doesn't untap during its controller's untap step and its activated
    abilities can't be activated." (real Scryfall oracle text,
    `data/fin/fin_scryfall.json` collector_number 76.) The "doesn't untap"
    half stays the same already-known gap sleep-magic's own identical clause
    has (`state.ts`'s `untap()` only special-cases the real STUN counter
    replacement, no general per-object lock) — genuinely NOT touched by this
    closure, still open. The "activated abilities can't be activated" half
    is now real: real Forge citation,
    `res/cardsfolder/s/stuck_in_summoners_sanctum.txt` line 11 — `S:Mode$
    CantBeActivated | ValidCard$ Permanent.EnchantedBy | Secondary$ True |
    Description$ ...` — a genuine `StaticAbilityMode.CantBeActivated` static
    ability (`StaticAbilityMode.java` line 22), checked LIVE at
    `AbilityActivated.checkRestrictions` time (forge-game/.../spellability/
    AbilityActivated.java line 109, `!StaticAbilityCantBeCast.
    cantBeActivatedAbility(...)`, itself sweeping every battlefield card's
    own static abilities for a matching `ValidCard`,
    `StaticAbilityCantBeCast.java` lines 55-71/156-160) — BEFORE any
    cost-affordability check, same order this engine now checks it in.
    Checked the full FIN pool first (grepped every "activated abilities
    can't be activated"-shaped oracle-text clause across
    `data/fin/fin_scryfall.json`): Stuck in Summoner's Sanctum is the ONLY
    real card needing this, confirmed, not assumed.
    New, general (not name-scoped) engine vocabulary: `card.ts`'s new
    `CardDefinition.activatedAbilityLock?: ContinuousGrantTargeting[]` —
    reuses the EXACT same recipient-targeting shape (`includeSelf`/
    `subtype`/`onlyDuringYourTurn`/`equippedBySelf`) `continuousKeywordGrants`/
    `continuousPTGrants`/`continuousTypeGrants` (gap #14) already established,
    with no extra payload at all (presence in the array already means
    "locked" — there's nothing else to carry). `state.ts`'s new
    `RealCard.activatedAbilityLock` (duck-typed, not imported, same
    convention its siblings use) is copied at `resolveTop` time
    (`engine.ts`), same as those siblings; a new exported
    `isActivationLocked(state, card)` sweeps the battlefield via the SAME
    shared `qualifiesForContinuousGrant` helper those siblings' own
    `effectiveKeywords`/`effectivePT`/`effectiveSubtypes` already use — this
    is genuinely the same mechanism, once more with a different (here,
    absent) payload, not a parallel one invented from scratch. `engine.ts`'s
    `canActivateAbility` calls it right after the controller check and
    BEFORE any cost-shape/affordability check, mirroring Forge's own
    ordering above. Stuck in Summoner's Sanctum's own real shape:
    `{ includeSelf: false, equippedBySelf: true }` — the lock genuinely
    follows this Aura's own live `attachedToId` link (Forge's own
    `Permanent.EnchantedBy` is the Aura-flavored spelling of the identical
    "whatever this permanent is attached to" relationship `equippedBySelf`
    already generalizes over both Equipment and Auras).
    **Two more real, necessary bugs fixed in this same card's own
    `definition.ts` while migrating it** (both required for the lock to
    ever have a live `attachedToId` to check against at all, found by
    actually trying to demonstrate this end-to-end, not assumed): (1) its
    own `onEnter` trigger used to be a bare declarative
    `{kind:'tapTarget', ...}` with NO `actions.equip` call — this Aura never
    actually became attached, ever; fixed to a real `custom` effect
    performing both the attach and the tap (mirrors sleep-magic's own
    onEnter trigger, fin's other real Aura, which already did this
    correctly). (2) the trigger was also missing `on: 'enter'` (present on
    sleep-magic's own identical trigger, absent here) — without it,
    `engine.ts`'s real ETB auto-fire (gap #3's own closure) never picks this
    trigger up when the card is genuinely cast through the real engine path.
    `cards/stuck-in-summoner-s-sanctum/scenarios.ts` migrated to a real
    engine-piloted trace (`runEngineScenarios`) — casts this Aura (Flash)
    onto a real Coeurl (fin's own real `{1}{W}, {T}: Tap target creature.`
    creature, chosen specifically because it has a real activated ability
    for the lock to block), then demonstrates via `engine-trace.ts`'s new
    `pilotExpectIllegalActivate` helper (the FIRST real pool card to use the
    `pilotExpectIllegal*` family at all) that Coeurl's own ability is
    genuinely rejected — a real `fn:'illegalAttempt'` trace line with the
    actual CantBeActivated reason. A real `event:'grantKeyword'` Fact
    (`keyword:'CantActivateAbilities'`, `target:{equippedBySelf:true}`,
    `value:-1` — a lockdown, not a boon, same `value:-1` convention
    sleep-magic's own `CantUntap` fact already established) now backs this
    with genuine trace evidence, not undemonstrated text.
    `scripts/verify-synergy.mjs`'s `IGNORED_FNS` gained `illegalAttempt`
    (purely observational by that helper family's own doc comment — never
    produce-relevant by construction, so it belongs with `cast`/`trigger`/
    `phase`/etc., not `PARKED_ACTION_FNS`).
    New tests: `state.test.ts`'s `isActivationLocked` describe block (a
    locked permanent's own activation genuinely refused; a DIFFERENT
    permanent unaffected; removing the locking permanent lifts the lock,
    live; re-attaching moves the lock, live; the no-lock negative
    baseline), `engine.test.ts`'s matching `canActivateAbility` describe
    block (same shape, through the real `canActivateAbility` entry point
    instead of the bare primitive).

19. ~~**No `mill` mechanism/chokepoint at all.**~~ **CLOSED (2026-09-12).**
    Surfaced migrating The Water Crystal (fin/85): "If an opponent would
    mill one or more cards, they mill that many cards plus four instead."
    (real Scryfall oracle text, `data/fin/fin_scryfall.json`
    collector_number 85; real Forge citation,
    `res/cardsfolder/t/the_water_crystal.txt`: `R:Event$ Mill |
    ActiveZones$ Battlefield | ValidPlayer$ Player.Opponent | ReplaceWith$
    MillPlus4 | ...` + `SVar:MillPlus4:DB$ ReplaceEffect | VarName$ Number |
    VarValue$ X` + `SVar:X:ReplaceCount$Number/Plus.4`) — a genuine CR 614.2
    replacement effect on the MILL event. Structurally the same SHAPE as
    gap #8b's lifegain-doubling ("If you would gain life, you gain twice
    that much life instead.", The Wind Crystal/fin-43), but that closure's
    OWN chokepoint (`state.gainLife`) didn't exist for milling — checked
    directly before this pass, not assumed: `state.ts` had NO `mill()`
    method anywhere; `interfaces.ts`'s own `mill(player, qty)` was a pure
    ambient Forge-signature mirror, never given a real body (the same
    status `scry`/`surveil` still carry). Every real mill effect in the
    pool (this card's own "{4}{U}{U}, {T}: Each opponent mills cards equal
    to the number of cards in your hand," its only real user) was instead
    modeled ad hoc through the generic `move` Effect kind, the same shared
    primitive every OTHER zone-change effect in the pool (bounce,
    sacrifice, exile, tutor, ...) also dispatches through, with nothing
    distinguishing "this move is specifically a mill" at the point a
    replacement could intercept it.

    Closed via a real, dedicated chokepoint, same "narrow hook at the one
    real mutation method, not a general 614/616 dispatcher" shape gap #8/
    the STUN/FINALITY counter replacements already establish:

    - **`state.ts`'s new `GameState.mill(player, qty)`** — real, per-card
      top-of-library -> graveyard moves (mirrors real Forge's own per-card
      `moveTo` loop inside `Player.mill`, forge-game/.../player/Player.java
      ~line 1539, not a bulk zone-swap), capped at however many actually
      remain in the library (real Forge: `Iterables.limit(milledView, n)`).
      A request of `qty <= 0` is a real no-op that never even consults a
      replacement — checked directly against real Forge's own
      `MillEffect.resolve` (forge-game/.../ability/effects/MillEffect.java):
      `numCards <= 0` returns before ever calling `Player.mill` at all.
      Deliberately sets NO deck-out flag the way `drawCards` sets
      `attemptedDrawFromEmpty` — real Forge's own `Player.mill` has no
      equivalent check anywhere in its body, and CR 104.3c's "draw more
      than remain -> lose the game" is a rule about DRAWING specifically,
      with no milling analogue anywhere in the Comprehensive Rules; milling
      more than remains in the library is simply a smaller real mill.
    - **A real, general "add N" replacement grant, not a fixed-multiplier
      keyword.** Real Forge's OWN `ReplaceCount$ Number/Plus.N` shape is
      ITSELF a generic "add N to the event's own Number" primitive, not a
      card-specific one — unlike gap #8b's `LifegainDouble` (a boolean,
      fixed-2x keyword, which sufficed because that replacement had no
      per-card parameter to carry), this replacement's own delta (+4) is
      real per-card DATA. `card.ts`'s new `CardDefinition.millModifierGrants
      ?: MillModifierGrant[]` (`{amount: number}`) is copied onto the
      resolved `RealCard` at `resolveTop` (same "copy once at resolve time"
      convention `spellCostReductionGrants`/`continuousKeywordGrants`
      already establish — `RealCard` never holds a live `CardDefinition`
      reference); `state.ts`'s new `activeMillModifier(state, millingPlayer)`
      sums every OTHER player's own battlefield permanents' grants (real
      `ValidPlayer$ Player.Opponent` — relative to the GRANT's own
      controller, the OPPOSITE scoping from `activeSpellCostDiscount`'s own
      `Activator$ You`; in this engine's 2-player-only scope, "every other
      player" and "an opponent of the grant's controller" are the same
      set, so a plain `controllerId !== millingPlayer.id` check is exact).
      `GameState.mill` checks this BEFORE finalizing the real count applied.
    - **A real `card.ts` `Effect` kind, `{kind:'mill', owner: EffectOwner,
      amount: Computed<number>}`**, dispatching through a new
      `Actions.mill` (mirrors `discard`'s own `playersFor` dispatch shape)
      — genuinely distinct from the generic `move` kind precisely so a
      replacement has something real to hook. The Water Crystal's own
      "{4}{U}{U}, {T}: Each opponent mills cards equal to the number of
      cards in your hand" (its only real user; Forge's own `A:AB$ Mill |
      ... | NumCards$ Y | SVar:Y:Count$ValidHand Card.YouOwn` is a live
      hand-size read, `amount: (ctx) => ctx.you.getCardsIn('Hand').length`)
      is the only shape needed — no `'handSize'`-literal amount variant was
      built, since a plain `Computed<number>` function already covers this
      real card's own live read with no new vocabulary.
    - `cards/the-water-crystal/definition.ts` now declares
      `millModifierGrants: [{amount: 4}]` (replacing the old documentary-
      only `staticAbilities` text) and its activated ability uses the new
      `kind:'mill'` Effect instead of `move`. `scenarios.ts` was fully
      migrated to a single real `runEngineScenarios` pilot (the two old
      flat `harness.ts` scenarios never put this permanent through
      `resolveTop` — `runScenario`'s own `addCard` never copies grant-shaped
      `CardDefinition` fields — so `millModifierGrants` could never apply
      to them regardless of how they were shaped; dropped as dead code
      once a real engine-piloted trace existed, same full-migration
      convention diamond-weapon/qiqirn-merchant already established): casts
      The Water Crystal for real, lets it resolve (copying the grant onto
      the real permanent), passes a real turn (this engine's own broader-
      than-real-302.6 `{T}`-cost summoning-sickness approximation applies
      to any permanent, not just creatures — see `engine.ts`'s
      `canActivateAbility` own comment), then activates its own mill
      ability with 3 real cards in hand — the trace shows the real,
      mechanically-computed `{fn:'mill', qty:7, requestedQty:3}` (3 + 4),
      not a scripted number.
    - A new `event:'millIncrease'` Fact is authored (the additive-delta
      sibling of gap #8b's own `event:'lifegainDouble'`), backed by
      genuine trace evidence via `scripts/verify-synergy.mjs`'s new
      `case 'mill'` `producedEvents` branch (emits `millIncrease` only when
      the real applied `qty` exceeds `requestedQty`, same "log the real
      post-replacement amount, only when it genuinely differs" convention
      `gainLife`'s own `requestedAmount` already established) — `case
      'mill'` was also added to `producedZone`/`explainableFns` so the
      pre-existing `event:'mill'` fact (a zone-shaped Library->Graveyard
      fact, unchanged) keeps its own trace evidence now that the base
      ability's own log line reads `fn:'mill'` instead of `fn:'move'`.
    - New tests: `state.test.ts`'s `GameState.mill` describe block (7
      cases: exact requested amount with no replacement, real per-card
      top-of-library order, a 0-qty request never consulting a
      replacement, the real +4 replacement applying to an OPPONENT, the
      grant's own controller milling themselves NOT affected — real
      `ValidPlayer$ Player.Opponent` scoping, not a self-buff — milling
      more than remains in the library capping at what's actually there
      with NO deck-out flag, and a replacement-bumped request ALSO
      correctly capping at the real library size). `engine.test.ts`/
      `card.test.ts` needed no new cases — `resolveTop`'s
      `millModifierGrants` copy and the `kind:'mill'` dispatch are both
      exercised end-to-end by this card's own real
      `runEngineScenarios` pilot instead.
    - Only The Water Crystal was touched among the 10 real FIN cards that
      reference mill (Shinra Reinforcements, Random Encounter, Summon:
      Titan, Town Greeter, Vanille Cheerful l'Cie, Hope Estheim, Terra
      Magical Adept // Esper Terra, Eden Seat of the Sanctum, Jidoor
      Aristocratic Capital // Overture) — migrating the other 9 to this
      real mechanism is a separate, deliberately out-of-scope fact-
      authoring pass (this closure is the engine mechanism becoming real,
      not a sweep of every card that happens to mention mill).

## What's already solid (don't re-litigate)

- Turn/phase order (all 12 real phases except the first-strike sub-step),
  untap, real first-turn-draw-skip.
- Stack LIFO resolution, APNAP priority cycling (scripted).
- Sorcery-speed timing, mana affordability for basic-land-only boards,
  summoning sickness / tapped / Defender / Vigilance attacker legality.
- Activated-ability legality (602.1) for the `{T}` + mana + explicitly-
  rejected-unsupported-cost shape, and the `resolveCard` dispatch collision
  for permanents with both an ETB trigger and their own activation ability.
- Combat: blocker legality (509.1, Menace), and real damage assignment
  including Trample/Deathtouch/First-and-Double-Strike ordering (510).
- State-based actions: a narrow, real 704.5f/704.5g/704.5h/704.5j subset
  (`sba.ts`) — see gap #2's own "CLOSED for a narrow, real subset" note
  above for exactly what's covered vs. still deferred (life-loss, loyalty,
  aura/equipment attachment).
- Turn-structure completeness (2-player only): Cleanup's real 514.1/514.2
  actions, `on: 'upkeep'`/`'endStep'` trigger auto-fire for the active
  player's own permanents, and extra turns (500.7) — see gap #3's own
  "CLOSED for real, checked-against-the-pool needs" note above for exactly
  what's covered vs. still deferred ("each player's" variants, phase-skip).
