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

5. **Non-basic mana sources.** `mana.ts`'s own header: only basic lands
   (subtype-inferred color) are recognized mana sources. Real, common
   activated mana abilities like Elvish Archdruid's own
   `{T}: Add {G} for each Elf you control` (a genuine card in this
   project's pool) aren't modeled as mana sources at all — a player who
   only has dorks/rocks/duals can't be given legal affordability today.
6. **Hybrid/Phyrexian/`{X}`/generic-colorless (`{C}`) mana symbols.**
   `parseManaCost` throws on any of these rather than mis-costing them
   (deliberate fail-loud choice) — but that means a cost like `{X}{R}` or
   `{2/W}` simply can't be cast through this engine at all yet.
7. **Alternate costs, modal/split costs, casting from anywhere but hand.**
   `AlternativeCost.java`/`StaticAbilityAlternativeCost.java` (real Forge
   classes) cover flashback, foretell, alternative-cost-reduction effects,
   etc. — none of that exists in `castSpell` today; `card.ts`'s own
   pre-existing modal-effect support (used by Louisoix's Sacrifice, e.g.) is
   a resolution-time concept, unrelated to a cast-time alternate-cost
   legality check.
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
    Still open: `Sacrifice another artifact or creature`, `{X}`,
    `Pay N life` — all real, common cost shapes verified by grepping every
    `activationCost:` string across every card's own `definition.ts`.
    Actually supporting them (not just rejecting) is the remaining work.

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
