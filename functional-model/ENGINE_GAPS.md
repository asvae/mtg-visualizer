# Gap analysis: this engine vs. real Forge

Companion to `ENGINE_DESIGN.md`. That doc explains what `engine.ts`/`mana.ts`
DO; this one is the prioritized inventory of what real Forge does that this
engine still doesn't, plus which gaps are **intentional, accepted
simplifications** (per direct instruction — don't spend effort closing these)
vs. **real gaps still worth closing** toward "more-less feature parity with
Forge."

Every row below is checked against `../mtg-forge`'s actual source, not
guessed — file/line citations follow each item.

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
2. **State-based actions (704).** No equivalent anywhere in this codebase.
   Real Forge: `GameAction.java`'s state-based-effects pass (rule citations
   like `704.5f`/`704.5g`/`704.5h` appear directly in that method's own
   comments, ~lines 1455-1760) — lethal damage, 0-toughness, legend rule,
   aura/equipment attachment legality, etc., all rechecked after every
   priority pass. There is no `StateBasedAction` class by that name; it's
   folded into `GameAction`'s own method. Without this, a creature reduced
   to 0 toughness or dealt lethal damage simply... doesn't die, unless some
   effect explicitly calls `destroy`.
3. **Turn-structure completeness (2-player only — see Accepted
   simplifications above for the >2-player exclusion).** Two real gaps,
   both raised to High priority: (a) **upkeep/end-step triggers, cleanup's
   real actions** — `turn.ts`'s header: upkeep/end-step triggers and
   cleanup's discard-to-hand-size + until-end-of-turn cleanup are
   unimplemented; those phases exist and are reachable in sequence with no
   automatic action. A card whose own ability triggers "at the beginning of
   your upkeep" has no engine hook to fire it automatically today (a caller
   would have to notice and call `resolveCard` manually) — this could get
   better with `Trigger.on` (already extended with `'enter'` this pass)
   growing `'upkeep'`/`'endStep'` variants, mirroring how `on: 'enter'` now
   lets `resolveTop` auto-fire an ETB. (b) **extra turns and skipped
   phases** — the other half of the old "multiplayer" gap, split out per
   the user's own scope call: this is NOT a >2-player concept (an extra
   combat, an extra turn, a skipped draw step all happen in normal 2-player
   games too) and stays real, high-priority work; `turn.ts`'s own
   `TurnState`/`advancePhase` have no hook for "insert an extra
   turn/phase" or "skip the next one" at all today.
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

### Lower priority (narrow, or already partially mitigated)

9. **First/double strike combat sub-step** — folded into gap #1 above but
   called out separately since it's a distinct real phase
   (`PhaseType.COMBAT_FIRST_STRIKE_DAMAGE`) this engine's `PHASES` list
   doesn't even include, not just an unimplemented step within an existing
   one.
10. **Legend rule / other SBA-adjacent state cleanup** — subsumed by gap #2;
    called out because it's a commonly-hit case (Jill's own card is
    Legendary) worth testing first once SBAs exist.
11. **Activated-ability cost components beyond `{T}` + mana.** Just closed
    partially this pass: `canActivateAbility` now explicitly REJECTS (rather
    than silently mispaying) costs like `Sacrifice another artifact or
    creature`, `Crew N`, `{X}`, `Pay N life` — all real, common cost shapes
    verified by grepping every `activationCost:` string across
    `functional-model/cards/<slug>/definition.ts`. Actually supporting them
    (not just rejecting) is the remaining work.

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
  including Trample/Deathtouch/First-and-Double-Strike ordering (510) — see
  gap #1's own "CLOSED" note above for the one thing still deferred
  (creature death from lethal damage, which needs SBAs, gap #2).
