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
4. **Target-legality checking at cast/declare time, and re-validation at
   resolution (608.2b, "fizzle").** `card.ts`'s effect system resolves/picks
   targets lazily, inside `resolveCard`, at resolution time — there is no
   pre-resolution "declare and validate targets" step anywhere to hook a
   legality check onto, and `stack.ts`'s own header already flags that
   `resolveTop` never re-checks whether a target became illegal before
   resolving. Retrofitting either means redesigning `Effect`'s whole
   resolution model — a real, structural gap, not attempted in this pass.

### Medium priority (common, but narrower blast radius)

5. **Non-basic mana sources.** ~~A narrow real slice~~ **CLOSED for
   single-color, unrestricted "{T}: Add {X}." sources** — checked every
   real `{T}: Add ...` static-ability string across the pool (35 cards
   total): 10 qualify for this narrow slice (Druid of the Cowl, Goobbue
   Gardener, Llanowar Elves — creatures, so 302.6 summoning-sickness
   genuinely applies via a new `payableManaSources` wrapper; Midgar,
   Ishgard, Jidoor, Lindblum, Zanarkand — Adventure lands; White Auracite,
   an artifact; Willowrush Verge, a plain land with a second, correctly
   still-ignored restricted ability). `mana.ts`'s new
   `manaAbilityColorFromStaticText` derives the color at the exact moment
   a permanent resolves (`resolveTop`), stored on a new `RealCard.manaAbility`
   field — `RealCard` carries no live `CardDefinition` reference to
   re-derive it from later, same reasoning `enteredThisTurn`/
   `resolvedPermanents` already established.
   **Still real, explicitly NOT modeled** (the harder remainder of this
   gap): a dual/choice-of-color ability (`{T}: Add {G} or {U}.` — ~10
   cards; correctly affording this needs a real bipartite-matching
   assignment, not just a bigger lookup table), a restricted one
   ("Activate only if...", "Spend this mana only to..."), a colorless one
   (`{C}` — `parseManaCost` itself doesn't parse `{C}`, gap #6), and a
   variable one (Elvish Archdruid's own `{T}: Add {G} for each Elf you
   control` — not a fixed single symbol). A player who only has ONE of
   those source shapes still can't be given legal affordability.
6. **Hybrid/Phyrexian/`{X}`/generic-colorless (`{C}`) mana symbols.**
   `parseManaCost` throws on any of these rather than mis-costing them
   (deliberate fail-loud choice) — but that means a cost like `{X}{R}` or
   `{2/W}` simply can't be cast through this engine at all yet.
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
   exile-then-cast-later sequence, not a same-turn alternate cost), any
   alternative-cost-REDUCTION effect (layering a discount on top of a cost
   rather than replacing it outright), and the engine does not itself verify
   the caller's `cardReal` is actually sitting in `alt.from`'s zone before
   casting it from there (same pre-existing "trust the caller" contract
   `canCastSpell`/`castSpell` already have for an ordinary hand-cast, which
   also isn't zone-checked).

   **Real, textually-precise cost-reduction example confirmed still open
   (2026-09-11, `fate-of-the-sun-cryst`/fin-19's migration):** "This spell
   costs {2} less to cast if it targets a tapped creature." (real Scryfall
   oracle text, `data/fin/fin_scryfall.json` collector_number 19) — a real
   Forge `SVar:X:Count$..." / "S:Mode$ ReduceCost` style dynamic reduction
   keyed on the CHOSEN TARGET's state at cast time (not a fixed discount,
   and not a cost REPLACEMENT the way Flashback's `AlternateCost` is), i.e.
   exactly the case this bullet already calls out as unmodeled. No
   `Constraints`/`Fact`/engine vocabulary exists for "this spell's own mana
   cost varies with a targeting choice" — `CardDefinition.manaCost` is a
   fixed printed string, never recomputed per-cast, and `canCastSpell`/
   `castSpell` have no discount hook at all (only the `alt` REPLACEMENT
   param above). `cards/fate-of-the-sun-cryst/definition.ts` documents this
   as real, un-executed `staticAbilities` text (consistent with every other
   continuous/cost-affecting static ability in the pool) rather than
   fabricating a `Fact`/effect with no engine backing behind it — no
   fact was authored for this clause; only the "Destroy target nonland
   permanent" half of the card is modeled as facts. Revisit only if a
   future task specifically asks for cost-reduction modeling to actually
   work (would need: (a) a real `chooseTarget`-time state check like
   `isTapped`, (b) a `manaCost`-discount hook parallel to but distinct from
   `alt`, (c) `Fact`/`Constraints` vocabulary to describe "this spell's own
   cost is conditional on a targeting choice" — none of which exist today).
8. **Damage-prevention shields — a narrow `dealDamage` hook, NOT full 614.**
   Checked the real pool: only 2 of 312 FIN cards need a replacement effect
   at all — Crystal Fragments/Summon: Alexander ("Prevent all damage that
   would be dealt to creatures you control this turn") and Diamond Weapon
   ("Prevent all combat damage that would be dealt to Diamond Weapon"). Both
   are the same narrow 614.2 damage-prevention-shield pattern. Full general
   replacement-effect machinery (`ReplacementEffect.java`/
   `ReplacementHandler.java`/`ReplacementLayer.java`,
   forge-game/.../replacement/ — arbitrary event interception, dynamic 616
   ordering, any event type) would mean gating every mutation call site
   (`dealDamage`/`move`/`drawCard`/`destroy`/...) — assessed as too
   invasive/risky for what's actually needed and explicitly rejected in
   favor of the narrow version: a short list of active "prevent damage to X
   (optionally: only combat damage)" shields, checked inside `dealDamage`
   only, before applying damage. Still real, still worth doing — just not
   what "614" as a whole implies.
   **Blocked on the `cards/*` boundary, not on engine design**: checked
   both cards' own current `definition.ts`. Crystal Fragments/Summon:
   Alexander's chapters I/II are already real triggers, but their own
   `run` bodies are explicit no-ops (`run: () => {}`) specifically because
   no hook exists for them to call — activating a `dealDamage`-side shield
   for real means that `run` calling some new `actions.*` method, which
   means editing the card's own `definition.ts`. Diamond Weapon's shield
   is plain `staticAbilities` freeform text, not a structured field at
   all — modeling it without a card-file change would mean matching on
   the card's own NAME inside `dealDamage`, which is exactly the
   per-card special-casing this codebase's own conventions (Saga
   automation, e.g.) deliberately avoid. So: the engine-side design here
   (a short-lived/always-on shield list, checked in `dealDamage`) is
   ready to implement the moment either card's own file can be touched —
   it just can't be done from the engine side alone under the current
   `cards/*`-is-out-of-scope boundary.

### Lower priority (narrow, or already partially mitigated)

9. **First/double strike combat sub-step** — folded into gap #1 above but
   called out separately since it's a distinct real phase
   (`PhaseType.COMBAT_FIRST_STRIKE_DAMAGE`) this engine's `PHASES` list
   doesn't even include, not just an unimplemented step within an existing
   one.
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
    only 3 (Magitek Armor, The Prima Vista, The Lunar Whale) also declare
    the matching `activationCost`+`effects: [animate]` needed to actually
    resolve — those 3 are real and tested. Cargo Ship and The Regalia's
    own `definition.ts` set `crewCost` but declare NEITHER field (their
    own comments say so explicitly), so `activationCostFor` correctly
    returns `undefined` for them and `canActivateAbility`'s existing
    "has no such activated ability" check rejects them — same "blocked on
    `cards/*`, not on engine design" situation as gap #8's damage-shields
    above, not a bug.
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
    Still fully open: `{X}`, `Pay N life` — real, common cost shapes
    verified by grepping every `activationCost:` string across every
    card's own `definition.ts`. Actually supporting them (not just
    rejecting) is the remaining work.

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

13. **Trigger-doubling ("Panharmonicon effect") — no general machinery for
    "a triggered ability triggers an additional time" under a condition.**
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

14. **Continuous, turn-conditional static keyword grants.** **Closed
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
    any future Equipment-broadcast turn-conditional grant. That same card's
    OTHER static clause ("+1/+0 and is a Knight in addition to its other
    types") stays a real, separate, still-open gap — no continuous-effect
    pipeline anywhere in this model for a static P/T bonus OR a dynamic
    type grant flowing from an Equipment to whatever it's attached to
    (checked `card.ts`'s `animate` dispatch: self-only today) — real facts
    exist for both halves (`event:'pump'`, new `event:'grantType'`
    vocabulary) but are honest-but-structurally-inert, same treatment as
    Crystal Fragments' own equivalent pump clause.

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
