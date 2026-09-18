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

- **Counter-conditional continuous effects — a real 613 static grant
  installed onto an arbitrary OTHER object, keyed on ITS OWN counter
  presence (closed, Ultima, Origin of Oblivion, fin/2).** Real Forge
  citation, `res/cardsfolder/u/ultima_origin_of_oblivion.txt`:
  ```
  T:Mode$ Attacks | ValidCard$ Creature.Self | Execute$ TrigPutCounter | ...
  SVar:TrigPutCounter:DB$ PutCounter | ValidTgts$ Land | CounterType$ BLIGHT | CounterNum$ 1 | ... | SubAbility$ DBEffect
  SVar:DBEffect:DB$ Effect | RememberObjects$ Targeted | StaticAbilities$ BlightStatic | ForgetOnMoved$ Battlefield | ForgetCounter$ BLIGHT | Duration$ Permanent
  SVar:BlightStatic:Mode$ Continuous | Affected$ Card.IsRemembered | RemoveLandTypes$ True | RemoveAllAbilities$ True | AddAbility$ ColorlessMana
  SVar:ColorlessMana:AB$ Mana | Cost$ T | Produced$ C | SpellDescription$ Add {C}.
  ```
  "Whenever Ultima attacks, put a blight counter on target land. For as long
  as that land has a blight counter on it, it loses all land types and
  abilities and has '{T}: Add {C}.'" used to sit as inert `staticAbilities`
  text (this card's own prior comment: no continuous-effect-tied-to-a-
  counter-presence machinery existed — `layers.ts` only tracked P/T and
  added types, not ability removal/type-loss/ability-grant conditioned on
  "does this permanent have counter X").

  New, general vocabulary, genuinely different from the pre-existing
  `continuousKeywordGrants`/`continuousPTGrants`/`continuousTypeGrants`/
  `activatedAbilityLock` family (all of which broadcast FROM a permanent's
  OWN `CardDefinition`, copied at resolve time, onto self/a subtype-you-
  control/whatever it's equipped to): `card.ts`'s new
  `CounterConditionalGrant` (`{counterType, removeLandTypes?,
  removeAllAbilities?, grantManaAbility?}`) is instead INSTALLED directly
  onto an ARBITRARY other object at the moment some OTHER effect
  (`putCounterTarget`) puts a counter on it, via a new
  `Actions.installCounterConditionalGrant` (mirrors `putCounter`'s own
  free-action shape; ambient in `interfaces.ts`, real implementation
  `GameState.installCounterConditionalGrant`, state.ts) — and from then on
  stays keyed PURELY on that object's own live counter count, with no
  relationship to whatever installed it (matching real Forge's own
  `Duration$ Permanent` — the remembered-object Effect genuinely outlives
  Ultima itself). `putCounterTarget`'s own new optional `grant` field
  (`Omit<CounterConditionalGrant, 'counterType'>` — the counter type is
  always the SAME one this same effect just placed, threaded automatically
  so the two fields can never drift apart) is the one new `Effect` surface;
  Ultima's own `definition.ts` sets `grant: {removeLandTypes: true,
  removeAllAbilities: true, grantManaAbility: {colors: ['C']}}` on its
  `onAttack` trigger's `putCounterTarget` effect.

  Real, LIVE readers, re-checked fresh on every call (never a one-time
  snapshot at the counter's application — the explicit design constraint
  for this closure): `state.ts`'s `hasCounterConditionalLandTypeLoss`
  (consumed by `effectiveSubtypes`, which now strips the affected land's
  subtypes to `[]` unconditionally when active — real Forge `RemoveLandTypes$
  True`, layer 4) and `hasCounterConditionalAbilityLoss` (consumed by
  `effectiveKeywords`, which returns `[]` when active, and by `engine.ts`'s
  `canActivateAbility`, which now rejects activating any OTHER activated
  ability the affected permanent has — real Forge `RemoveAllAbilities$
  True`, layer 6); `mana.ts`'s own `sourceColors`/`sourceAmount`/
  `payableManaAbility` duck-type the identical check locally (that file
  never imports a VALUE from `state.ts`) so a blighted land's normal mana
  derivation (basic-land-subtype-based OR its own printed
  `manaAbilities`) is replaced outright by the granted `{T}: Add {C}` —
  `grantManaAbility` wins over `removeAllAbilities` wins over the card's own
  normal derivation. No `GameState` sweep is needed for any of this (unlike
  `qualifiesForContinuousGrant`'s own sibling family) — the rule was
  installed directly onto the affected object itself, so every reader only
  ever consults that ONE object's own two fields (`counterConditionalGrants`,
  `counters`).

  Approximated Forge's own remembered-object-set mechanism
  (`RememberObjects$ Targeted`/`ForgetCounter$ BLIGHT`) as "any permanent
  currently carrying >=1 counter of `counterType`" — behaviorally identical
  for this card: no FIN card ever removes a blight counter independent of a
  zone change, which already wipes `RealCard.counters` (and therefore
  neutralizes every reader above) via the existing 400.7 reset, same "a
  narrower live check achieves the same real outcome" reasoning the Stun/
  Finality closure above already established for a comparable per-object
  counter-keyed replacement.

  **Real, HARD, explicitly-named remaining gap — flagged, not quietly
  worked around**: real Forge's `RemoveAllAbilities$ True` removes EVERY
  ability the affected object has, including TRIGGERED ones. This closure
  only suppresses mana abilities, printed keywords, and OTHER activated
  abilities (The Gold Saucer's own real "{3}, {T}, Sacrifice two artifacts:
  ..." is the one real FIN card this last case matters for if it's ever
  blighted) — a triggered ability has NO per-object "is this specific
  trigger currently suppressed" gate anywhere in this codebase
  (`Trigger`/`fireTrigger` has no such check), and building one generically
  would mean every real trigger-firing call site in this codebase
  (`stack.ts`, `engine.ts`'s several dispatch sites, `saga.ts`,
  `harness.ts`'s scenario runner, `engine-trace.ts`'s `pilotFireTrigger`,
  already funneled through `triggers.ts`'s shared `fireTrigger` chokepoint
  for trigger-DOUBLING — the identical chokepoint COULD carry this check
  too) consulting a per-object suppression flag before firing. Checked the
  real pool before deciding not to attempt this: every real FIN Town-cycle
  land's own OTHER ability is a ONE-SHOT `onEnter` ETB trigger that has
  ALREADY resolved by the time Ultima (an ATTACK trigger, necessarily well
  after any target land's own ETB) could ever blight it — so this specific
  gap is real but not LIVE for any card in this pool today. A hypothetical
  future land with a repeatable `'upkeep'`/`'endStep'`/`'tapLandForMana'`
  trigger would still incorrectly keep firing it while blighted.

  Real demonstration: `cards/ultima-origin-of-oblivion/scenarios.ts`'s own
  `attacksAndBlightsAnOpponentLand` scenario now shows the blighted Forest
  genuinely losing its land type (`read:effectiveSubtypes` → `[]`) and its
  mana ability becoming exactly `['C']` (`read:sourceColors`), then
  genuinely paying a real `{1}` generic cost off it (`payMana` — `{C}`
  itself can't be demonstrated as a CAST cost pip, a separate, already-
  documented, unrelated gap in gap #6 below: `parseManaCost` still doesn't
  parse a colorless-specific pip IN a cast cost). No new Fact —
  `installCounterConditionalGrant`'s own trace line is real engine
  bookkeeping (which object a continuous effect got installed onto), not a
  produce/consume-shaped board relation any Fact vocabulary models, same
  treatment `queueExtraPhase` already got (`scripts/verify-synergy.mjs`'s
  `IGNORED_FNS`).

  `npx vitest run functional-model` 478/478 green (unchanged count — no new
  test file added; this closure is demonstrated via the real scenario trace
  rather than a new unit-test file, matching how gap #5's mana-ability
  migration itself was verified per-card). `tsc --noEmit` — zero NEW errors
  (same pre-existing baseline categories as every prior pass:
  TS5097/TS7016/doppelgang/elrond-moon-reader implicit-any/one unrelated
  Jill `Actions` mismatch — that one's own missing-field list actually
  SHRANK by one this pass, since `installCounterConditionalGrant` was added
  to its own hand-built `realActions` alongside `putCounter`).
  `scripts/verify-synergy.mjs` full pool: 320 checked, 0 hard failures.

- **Static-ability audit (2026-09-16)** — a pool-wide inventory of every
  card's inert, freeform `staticAbilities` string (76 cards had one),
  prioritized/closed the mechanical ones, cross-checked against this file.
  Single biggest finding: the "stale comment claiming a capability doesn't
  exist when it actually does" bug class (recurring across this whole
  multi-session project) hit an entire family at once — 13 real Equipment
  cards (`buster-sword`/`coral-sword`/`dark-knight-s-greatsword`/
  `lion-heart`/`magitek-scythe`/`monk-s-fist`/`ninja-s-blades`/
  `red-mage-s-rapier`/`ultima-weapon`/`warrior-s-sword`/`bard-s-bow`/
  `genji-glove`/`samurai-s-katana`) had NO `continuousPTGrants`/
  `continuousTypeGrants`/`continuousKeywordGrants` at all despite the exact
  same field family already being real and proven on 7-8 sibling cards
  (dragoon-s-lance/paladin-s-arms/thief-s-knife/white-mage-s-staff/etc) —
  wired all 13 for real; 12 of 13 auto-tagged into `synergy.json` for free
  off the ALREADY-EXISTING recognizers, only the 3 keyword-bearing ones
  needed `continuousKeywordGrantsEquipped-structural.ts` widened (new
  keyword vocab — Reach/Trample/Haste/DoubleStrike — plus multi-keyword
  list support, mirroring `grantKeywordAll-effect-structural.ts`'s own
  Oxford-comma convention). Also found and fixed the identical stale-comment
  bug on `sidequest-play-blitzball...`'s own back face and
  `summoner-s-grimoire`'s type grant.

  A SECOND real, genuinely-different closable bucket: 3 cards
  (`freya-crescent`/`kain-traitorous-dragoon`'s own "Jump — During your
  turn, has flying," `tonberry`'s own "Chef's Knife — During your turn, has
  first strike and deathtouch") needed a THIRD real `continuousKeywordGrants`
  shape — self-only, conditional, no broadcast to any other creature at
  all — closed via `continuousKeywordGrantsSubtype-structural.ts` (widened
  to a third subject-noun branch: a Legendary permanent's own short name, or
  "this creature" for a non-Legendary one). This exposed a REAL ENGINE BUG,
  not just an untagged fact: `state.ts`'s own `qualifiesForContinuousGrant`
  used to require `grant.subtype !== undefined` unconditionally for its
  "other permanents" branch — meaning `the-fire-crystal`'s own real
  `{keywords:['Haste'], includeSelf:false}` (no `subtype` at all,
  "Creatures you control have haste") could **never actually apply to any
  creature at the engine level**, not just at the synergy-fact level (this
  had been silently broken since that card's own migration in a prior
  pass). Fixed by branching on `includeSelf` when `subtype` is undefined:
  `true` → self-only (no broadcast), `false` → broadcast to every other
  creature the controller controls (any subtype). Also fixed a related,
  previously-unexercised self-collision risk in the SAME function's
  subtype-defined branch (a granting permanent whose own subtype happens to
  match its own broadcast filter would incorrectly include itself despite
  `includeSelf:false` — added an explicit `card.id !== source.id` exclusion,
  which mattered for the anthem closure below).

  A THIRD bucket: real Affinity cost-reduction (`bartz-and-boko`/
  `cantankerous-keepers`/`valkyrie-aerial-unit`) — the `costReduction.
  perControlled` mechanism gap #7 already closed for Travel the Overworld
  turned out to already cover these too, just unwired. Valkyrie Aerial
  Unit's own "Affinity for artifacts" additionally exposed a real, narrow
  gap in that mechanism itself: `perControlled.subtype` only ever checked
  `RealCard.subtypes`, never `RealCard.types` — correct for a creature
  SUBTYPE (Bird/Elf) but wrong for a card TYPE (Artifact), since real
  Forge's own `Affinity` keyword (`Affinity.java`) resolves both through the
  same generic valid-checking mechanism. `engine.ts`'s `effectiveCastCost`
  now checks both. `diamond-weapon`'s own "costs {1} less for each
  permanent card in your graveyard" stays correctly open — a genuinely
  different shape (graveyard-counted, multi-type category, not
  battlefield-counted single subtype/type).

  A FOURTH bucket: 4 new, narrowly-scoped CDA variants, each closing exactly
  one real card, all following the SAME established "narrow variant per
  real distinct shape" convention `scalePerType`/`thresholdBonus` already
  set (never one card each forced into a shared, over-general mechanism):
  `continuousPTGrants.scalePerSelfCounter` (Excalibur II's own "+1/+1 for
  each charge counter on Excalibur II" — an ADD scaled by a counter on the
  GRANTING permanent itself, not a type count), `ptFormula.
  addPerGraveyardCount` (Xande, Dark Mage's own "+1/+1 for each
  noncreature, nonland card in your graveyard"), `ptFormula.
  setToGraveyardPermanentCount` (Neo Exdeath, Dimension's End's own "power
  is equal to the number of permanent cards in your graveyard" — a SET, not
  ADD, mirroring `setToCreaturesControlled`'s own POWER-only scoping), and
  `ptFormula.addPerLandControlled` (Zell Dincht's own "+1/+0 for each land
  you control"). `ptFormula-scalingPump-structural.ts`/
  `ptFormulaSetToCreaturesControlled-structural.ts` both widened to match.

  A FIFTH bucket: `continuousPTGrants` with a `subtype` (not
  `equippedBySelf`) broadcast — `elvish-archdruid`/`thranduil-sindarin-liege`
  ("Other Elf(ves) you control get +1/+1") and `serah-farron-crystallized-
  serah`'s own back face ("Legendary creatures you control get +2/+2," no
  "Other" prefix — Crystallized Serah isn't itself a Creature). New sibling
  recognizer `continuousPTGrantsSubtype-structural.ts` (mirrors
  `continuousKeywordGrantsSubtype-structural.ts`), one combined pattern for
  all 3 real English phrasings. Elvish Archdruid/Thranduil are both
  cross-set reference cards with NO real oracle text checked in anywhere
  (`data/*/*_scryfall.json`) — same permanent testing gap
  `addMana-effect-structural.test.ts`'s own module doc comment already
  flags for Elvish Archdruid's mana ability — so their own grants are real
  and mechanically live but can never be auto-tagged into `synergy.json`;
  only Serah Farron is exercised via the real pipeline. `cid-timeless-
  artificer`'s own "Artifact creatures and Heroes you control get +1/+1..."
  stays correctly open (an OR of two subtype groups plus a two-part count —
  battlefield Artificers AND graveyard Artificer cards — genuinely beyond
  this single-subtype mechanism).

  **Genuinely unclosable, loud-flagged, left as real `staticAbilities`
  text** (checked directly, not just inherited from a stale comment):
  - No generic replacement-effect framework exists anywhere in this engine
    — `quina-qu-gourmet` (token-creation replacement), `ancient-adamantoise`
    (damage-redirection replacement), `emet-selch-unsundered-hades-
    sorcerer-of-eld`'s back face (graveyard->exile replacement),
    `the-darkness-crystal`/`the-earth-crystal`'s own remaining replacement
    statics (their `costReduction` halves were already closed in a prior
    pass), `kuja-genome-sorcerer...`'s back face (damage-doubling
    replacement). A real, recurring, cross-cutting gap — worth real infra
    investment if a THIRD+ new card needing it shows up, not a per-card fix.
  - **Partially closed 2026-09-16** (narrower than originally scoped — see
    `card.ts`'s own `Trigger.on: 'equippedAttacks'` doc comment for the full
    real-Forge writeup): the "equipped creature attacks" FAMILY of this gap
    is now real, executable machinery — `engine.ts`'s widened
    `fireOnAttackTriggers` auto-fires an Equipment's own trigger the moment
    the creature it's attached to is declared as an attacker, with `ctx.self`
    staying the Equipment (an effect that genuinely needs "the equipped
    creature itself," not just "you," resolves it live via
    `ctx.self.getAttachedTo()`, same as Genji Glove's own pre-existing untap
    effect already did). Closed for real: `white-mage-s-staff` (fin/42,
    "Whenever this creature attacks, you gain 1 life" — the flagship target
    of this pass), `genji-glove`/`ultima-weapon`/`sage-s-nouliths` (3 more
    real pool cards found via a whole-pool check, same real shape — the
    latter's own migration to a real engine-piloted trace is DONE and
    verified; genji-glove/ultima-weapon's own `on` value is set for real but
    their `scenarios.ts` files are still the older `harness.ts`-style
    manual-trigger-name shape, not yet migrated to a real engine-piloted
    trace that would exercise the new auto-dispatch — deferred, not
    forgotten, these two were a bonus find, not this pass's own named
    target). `summoner-s-grimoire` (fin/205) is NOT closed even though its
    own real Forge script uses the identical `Card.EquippedBy`-style
    trigger shape — its own granted EFFECT ("you may put a creature card
    from your hand onto the battlefield. If that card is an enchantment
    card, it enters tapped and attacking") needs a wholly separate, unbuilt
    "put a chosen card from hand onto the battlefield, entering
    tapped+attacking" `Effect`/`Actions` primitive regardless of the trigger
    plumbing — converting just the trigger condition with no real
    consequence to attach would be a 100%-no-op migration for zero real
    closure benefit, so `definition.ts` was left untouched for this card.

    `astrologian-s-planisphere` (fin/46) and `black-mage-s-rod` (fin/90)
    stay open too, but the diagnosis has changed: their own blocker is NOT
    "no mechanism grants a trigger to another permanent" (that's now solved,
    above) — it's that their real Forge trigger occasions (`Mode$
    SpellCast`/`Mode$ Drawn`, i.e. "whenever you cast a noncreature
    spell"/"whenever you draw your Nth card each turn") have NO `Trigger.on`
    auto-fire dispatch anywhere in this engine at all, for ANY card, granted
    or native — a genuinely different, much larger, still wholly-unbuilt
    trigger family. Checked pool-wide before declining further: 17+ real
    FIN cards share this exact same native "whenever you cast a noncreature
    spell" trigger (`sahagin`, `tellah-great-sage`, `queen-brahne`'s own
    Prowess, `the-prima-vista`, `prompto-argentum`, `shambling-cie-th`,
    `red-mage-s-rapier` — another Equipment with this SAME granted shape —
    among others), several needing real "how much mana was spent casting
    that spell" magnitude tracking this engine doesn't have either (already
    flagged elsewhere in this doc; `sahagin`'s own `definition.ts` comment
    names it directly). Building a real `'castNoncreatureSpell'` (+
    mana-spent tracking) and `'drawNthCardThisTurn'` auto-fire dispatch pair
    is a real, worthwhile, but genuinely much bigger cross-cutting
    investment than this narrow equip-trigger pass — left open, not
    attempted here, same "worth real infra investment once enough real
    cards need it" bar this doc's own recurring-gap entries already use.
  - No per-permanent "chosen value" state to remember an ETB choice across
    later reads — `cavern-of-souls`/`eclipsed-realms`'s own "choose a
    creature type" (referenced by a LATER mana-ability restriction),
    `selfless-safewright`'s own "choose a creature type" (referenced
    immediately, but there's still no way to pick an otherwise-arbitrary
    word to build a target pool from).
  - No mana-ability GRANT mechanism (broadcasting a mana ability onto OTHER
    permanents, the `manaAbilities` analogue of `continuousKeywordGrants`)
    — `a-realm-reborn`'s own "Other permanents you control have '{T}: Add
    one mana of any color.'"
  - No "cast an arbitrary OTHER card from graveyard/exile" action distinct
    from a card's own `alternateCosts` — `noctis-prince-of-lucis`'s own
    graveyard-cast permission for OTHER artifact cards.
  - No "equipped creatures you control" (any creature with ANY Equipment
    attached, not one specific Equipment) broadcast filter —
    `firion-wild-rose-warrior`'s own "Equipped creatures you control have
    haste," `balthier-and-fran`'s own Vehicle-you-control anthem (a
    different filter still — Vehicles aren't Creatures until crewed, so
    even the subtype-broadcast mechanism doesn't reach them).
  - No turn-NUMBER counter exposed to any Effect/Computed function (only a
    same-turn boolean) — `starting-town`'s own turn-1-3-conditional
    enters-tapped.
  - No coin-flip/random-outcome mechanism — `the-gold-saucer`'s own "Flip a
    coin. If you win the flip, create a Treasure token."
  - Cost-reduction/conditional-context gaps already named in gap #7 below,
    unchanged by this pass — `serah-farron`'s own "first legendary creature
    spell each turn costs {2} less," `cloud-planet-s-champion`'s own
    equip-ability cost reduction targeting a specific permanent.
  - `cloud-planet-s-champion`'s own "during your turn, as long as equipped,
    has double strike and indestructible" — a real CDA gated on BOTH
    whose-turn-it-is AND a live attachment-state check simultaneously; no
    grant shape combines both conditions today (only one real card needs
    it, correctly left rather than building narrow, one-off machinery).
  - `the-masamune`'s own "must be blocked if able" (an attacker-declaration-
    time forced-block rule, no such concept exists) — its own Panharmonicon-
    style trigger-doubling grant IS already real and closed separately.

  Also fixed this same pass: an operational near-miss, not a content bug —
  an accidental FULL-POOL (no `--slug`) `run-scenarios.mjs` invocation
  regenerated all 292 `trace.json` files at once (harmless per-file, but a
  shared `nextObjectId` counter across the whole run renumbers every
  object ID, producing a huge, noisy diff unrelated to any real change);
  reverting that via a blanket `git checkout` on every touched `trace.json`
  then wiped ~63 OTHER cards' own legitimately-updated `trace.json` files
  from an EARLIER, still-uncommitted session's work back to a stale
  pre-migration baseline (2 of those, `gigantoad`/`magitek-infantry`,
  briefly surfaced as real `verify-synergy.mjs` hard failures as a result).
  Recovered by regenerating each of the 64 affected slugs individually via
  `--slug=<slug>` (preserving the existing low-ID-per-card convention,
  matching how the checked-in baseline was originally generated) —
  confirmed back to 0 hard failures afterward.

  `npx vitest run functional-model`: 760/760 (+9 vs. this pass's own start)
  green, 5 skipped (unrelated, pre-existing). `npx tsc --noEmit` — zero NEW
  errors (same pre-existing TS5097/TS7016/doppelgang/elrond-moon-reader/
  Jill-Actions/addMana-test/dealDamage-test baseline, none touched this
  pass). `scripts/verify-synergy.mjs` full pool: 320 checked, 0 hard
  failures. `scripts/verify-annotation-coverage.mjs`: OK. Full-repo
  `npx vitest run`: 832/837 (same 5 pre-existing unrelated
  `tagging/sets/{lea,leb,2ed,arn}`/`card-enrichment-status.json` failures,
  untouched by this pass).

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
   **New real gap surfaced 2026-09-18 (FDN authoring, `niv-mizzet-visionary`):
   no `maxHandSize` OVERRIDE field.** The 514.1 discard-to-maximum-hand-size
   mechanism above is real and enforced, but it's hardcoded to the real
   default of 7 (`turn.ts`'s Cleanup branch) — there is no field anywhere
   (`CardDefinition`, `RealPlayer`) a card can set to change that number, so
   "You have no maximum hand size" (real Scryfall oracle text on Niv-Mizzet,
   Visionary) can't be declared at all. Narrow, additive extension to
   already-real machinery (a `Player.maxHandSize` override + a
   `CardDefinition` grant field, checked at the same Cleanup chokepoint) —
   not a new subsystem. Not built this pass; flagged for a near-term,
   relatively cheap follow-up.
   **(d) `on: 'tapLandForMana'` trigger auto-fire, CLOSED 2026-09-14**
   (depended on gap #5's own typed-`manaAbilities` closure above — couldn't
   detect "tapped a land for mana" as a real event before mana production
   was structural). Real Forge citation: `TriggerType.TapsForMana`
   (`TriggerTapsForMana.java`'s `performTest` checks `ValidCard`/
   `Activator`/`Produced` against the real event), fired via
   `AbilityManaPart.tapsForMana()` whenever a `{T}`-cost mana ability
   resolves — mirrored here as `Trigger.on: 'tapLandForMana'` (card.ts) plus
   a new `Trigger.tapLandForManaColor?: ManaColor` field (mirrors Forge's
   own `Produced$` gate: omit it to fire on ANY color, name one to fire
   only when that color was produced). `engine.ts`'s new
   `fireOnTapLandForManaTriggers(engine, controller, tapped)` is the real
   auto-fire — called from BOTH of `payMana`'s only two call sites
   (`castSpell`, `activateAbility`): for every tapped source that's a real
   `Land`, reads its `sourceColors` (mana.ts) and checks every controller
   permanent's own registered `resolvedPermanents` entry for a matching
   trigger, firing it through the same `fireTrigger` (triggers.ts)
   chokepoint every other trigger uses (so trigger-doubling still applies
   uniformly). Real FIN card this closes: Ultima, Origin of Oblivion's own
   "Whenever you tap a land for {C}, add an additional {C}"
   (`res/cardsfolder/u/ultima_origin_of_oblivion.txt`'s own `T:Mode$
   TapsForMana | ValidCard$ Land | Activator$ You | Produced$ C |
   Execute$ TrigMana`) — its `definition.ts` now declares a genuine
   `on: 'tapLandForMana', tapLandForManaColor: 'C'` trigger instead of
   sitting as inert `staticAbilities` text; its own `scenarios.ts` no
   longer manually fires it (previous version hand-simulated the doubling
   via a direct `pilotFireTrigger` call) — the real trigger now fires
   automatically off a genuine land tap forced by a same-turn second cast
   (deliberately kept within one turn: crossing a real Untap step
   re-untaps every land per 502.1, defeating a forced-scarcity setup — a
   real lesson from this scenario's own first, buggy draft, not an
   invented board state).
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
   - **Evidence-audit follow-up (2026-09-18):** the 2026-09-12 closure's own
     `engine.test.ts` describe block ("Target-legality re-validation at
     resolution... real end-to-end via castSpell/resolveTop") was real,
     genuine `createEngine`-piloted coverage, but only ever against a
     synthetic `Test Fate Bolt` fixture, not the actual real FIN card whose
     shape it was modeled on. `engine.test.ts` now ALSO has a second,
     sibling describe block using the real `fate-of-the-sun-cryst`
     `CardDefinition` directly ("Target-legality re-validation — real FIN
     card (Fate of the Sun-Cryst...)") — casts it targeting a genuinely
     tapped opponent creature (exercising its own real gap #7 cost
     discount off the SAME declared target at the same time), then fizzles
     it for real when that target is destroyed by something else before
     resolution, plus a legal-baseline sibling case.

### Medium priority (common, but narrower blast radius)

5. **Non-basic mana sources.** ~~A narrow real slice~~ ~~CLOSED for
   single-color, unrestricted "{T}: Add {X}." sources~~ **CLOSED for real
   (2026-09-14): the free-text `staticAbilities`-regex path is GONE.**
   `CardDefinition` now carries a real typed `manaAbilities?: ManaAbility[]`
   field (`card.ts`, alongside `keywords`/`ptFormula`) — `interface
   ManaAbility { cost?: string; colors: ManaColor[]; amount?: number;
   variableAmount?: {kind:'countSubtypeControlled', subtype: string} |
   {kind:'selfPower'}; restriction?: string; activationCondition?: string }`,
   fields named to mirror Forge's own real `AbilityManaPart.java`
   constructor params (`Cost$`/`Produced$`/`Amount$`/`RestrictValid$`/
   `AddsKeywords$`; `res/cardsfolder/*/*.txt`'s own `Mana$ Add` script
   grammar) rather than inventing new vocabulary. `RealCard.manaAbility?:
   ManaColor | ManaColor[]` is gone too, replaced by
   `RealCard.manaAbilities?: ManaAbility[]` (`state.ts`, a duck-typed local
   re-declaration per that file's own never-import-from-`card.ts`
   convention) — populated straight from `CardDefinition.manaAbilities` at
   `resolveTop`/`playLand`, no derivation step at all now. `mana.ts`'s three
   regex functions (`manaAbilityColorFromStaticText`,
   `manaAbilityColorsFromStaticText`, `deriveManaAbility`) are DELETED, not
   deprecated — replaced by `payableManaAbility(card)` (finds the first
   `ManaAbility` entry with no `restriction`/`activationCondition`/
   `variableAmount` and a `cost` that's unset or exactly `'{T}'` — the only
   shape `canAfford`/`payMana` can honestly enforce) and `sourceColors`/
   `sourceAmount` built on top of it. `assignManaRequirements`'s own
   exhaustive backtracking (gap #5's own 2026-09-12 dual-color closure,
   unchanged) is reused verbatim — it never cared how a source's color list
   was derived, so the migration is a pure swap underneath it, not a
   rewrite of it. `canAfford`/`payMana` were also generalized to SUM
   `sourceAmount` per leftover source for generic coverage instead of
   counting 1:1 — real new capability, not just a refactor: Ring of the
   Lucii's genuine `{T}: Add {C}{C}.` (`amount: 2`) is payable for the first
   time (previously matched NEITHER old regex, silently unrecognized).

   **Fixed a real latent bug found during migration**: `sourceColors`'s
   basic-land-subtype branch used to stop at the FIRST matching subtype —
   Breeding Pool (real `Land — Forest Island`) could only ever produce `G`,
   never `U`. Now collects every matching subtype's color. New regression
   test in `mana.test.ts` proves both colors payable.

   **Migrated the full real pool** (39 cards' worth of prior free-text-only
   mana abilities, one pass): adventurer's-inn, capital-city, cavern-of-
   souls, clive's-hideaway, druid-of-the-cowl, eclipsed-realms, eden-seat-
   of-the-sanctum, goobbue-gardener, ishgard-the-holy-see-faith-grief,
   jidoor-aristocratic-capital-overture, lindblum-industrial-regency-mage-
   siege, llanowar-elves, midgar-city-of-mako-reactor-raid, sidequest-
   catch-a-fish-cooking-campsite, starting-town, the-gold-saucer, white-
   auracite, willowrush-verge, zanarkand-ancient-metropolis-lasting-fayth,
   balamb-garden-seed-academy-balamb-garden-airborne, baron-airship-
   kingdom, gohn-town-of-ruin, gongaga-reactor-town, guadosalam-farplane-
   gateway, insomnia-crown-city, rabanastre-royal-city, sharlayan-nation-
   of-scholars, treno-dark-city, vector-imperial-capital, windurst-
   federation-center, breeding-pool (mana-line text removed entirely — the
   basic-land-subtype path already covers Forest/Island for free, so no
   `manaAbilities` needed at all), ring-of-the-lucii, blitzball,
   overgrown-zealot, freya-crescent, the-emperor-of-palamecia-the-lord-
   master-of-hell, woodland-weavemaster (the last three had NO prior mana
   modeling at all — their `{T}: Add ...` text was never even regex-matched
   before this pass; now genuinely typed and payable for the first time).
   `mana.test.ts`/`engine.test.ts` both updated to construct fixtures via
   `manaAbilities: [{colors:[...]}]` instead of the old `manaAbility`
   field/regex-matching `staticAbilities` strings; full suite (478 tests)
   green after the migration.

   **Deliberately NOT migrated, real named reasons**: Cargo Ship (already
   has genuinely-executable `abilities`-based modeling predating this
   task, strictly better than the new typed field for its case — see its
   own remaining restricted-ability gap below — migrating it to
   `manaAbilities` would be a REGRESSION) and Elvish Archdruid (already
   real via `activationCost`+`effects` with a genuine `Computed` amount
   function — also predates and sits outside the free-text violation this
   task targeted; not touched).

   **Still real, explicitly NOT enforced by `canAfford`/`payMana`** (the
   type itself does not preclude modeling these later — `ManaAbility`'s
   `restriction`/`activationCondition`/`variableAmount` fields exist
   precisely so a future pass can wire them in without another type
   redesign): a restricted ability ("Spend this mana only to..." — Cargo
   Ship's own real "{T}: Add {C}. Spend this mana only to cast an artifact
   spell..." ability is the concrete example; correctly affording this
   would need a genuine spendable-mana-pool tracking mechanism this engine
   doesn't have AT ALL, per `interfaces.ts`'s own `Player.addMana` doc
   comment — a deliberately inert observation point — a materially bigger,
   riskier lift than this pass's typed-field migration, so deliberately
   not attempted), and a variable one (Elvish Archdruid's own `{T}: Add
   {G} for each Elf you control` — `ManaAbility.variableAmount` can now
   NAME this shape (`{kind:'countSubtypeControlled', subtype:'Elf'}`), but
   nothing computes it at payment time yet).

   **Two real, named remaining gaps found and deliberately NOT force-fit
   this pass** (would be WRONG, not just incomplete, to approximate as an
   ordinary `manaAbilities` entry):
   - **Crossroads Village** — "As this land enters the battlefield, choose
     a color. Whenever you tap this land for mana, add one mana of the
     chosen color." (`res/cardsfolder/c/crossroads_village.txt`'s own
     `Mana$ Add | Produced$ Chosen`, roughly). Real Forge locks the choice
     PERMANENTLY at ETB — this is not "any of 5 colors, choose one per
     activation" (which `colors: [W,U,B,R,G]` + `assignManaRequirements`
     WOULD honestly model), it is "one color, fixed forever, chosen once."
     This engine has neither a persisted per-permanent "chosen at ETB"
     value slot nor an ETB-choice mechanism at all (no `RealCard` field for
     it, no hook to prompt/record a choice when a land enters). Left with
     its prior free-text `staticAbilities` comment, explicitly marked as
     this gap, not migrated.
   - **A Realm Reborn** — grants a mana ability to OTHER permanents (a
     genuinely different mechanism than a permanent's own `manaAbilities`:
     a mana-ability GRANT, analogous to `continuousKeywordGrants`
     (`card.ts`) but for mana abilities specifically). No such grant
     mechanism exists yet, and no other real FIN card in the pool currently
     needs one enforced (checked). Left with its prior free-text comment,
     explicitly marked as this gap, not migrated.
   - **Evidence-audit follow-up (2026-09-18):** the closure's own
     `engine.test.ts` describe block ("Non-basic mana sources... real
     manaAbilities copy + 302.6") was real, genuine `createEngine`-piloted
     coverage, but only ever against synthetic `Test Mana Rock`/`Test Mana
     Dork`/`Test Dual Rock` fixtures. `engine.test.ts` now ALSO has a
     sibling describe block using the real `capital-city` `CardDefinition`
     directly — plays it as a real Land (`playLand`) and confirms its own
     real, structured `{T}: Add {C}.` genuinely pays for a spell (after
     tapping every OTHER real mana source first, to prove Capital City's
     own ability is the one actually consumed), plus a second case
     exercising the SAME real card's own Cycling {2} through
     `activateAbility` (doubling as real-card strengthening for gap #23
     below too).
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

   **Three more real cards wired onto the SAME `perControlled` mechanism,
   CLOSED (2026-09-16, static-ability audit)**: `bartz-and-boko` ("Affinity
   for Birds," `{amountPerMatch:1, subtype:'Bird'}`), `cantankerous-keepers`
   ("Affinity for Elves," `subtype:'Elf'`) — both were simply never wired
   onto the already-real mechanism, same stale-comment bug class this
   pass's own header describes. `valkyrie-aerial-unit`'s own "Affinity for
   artifacts" (`subtype:'Artifact'`) exposed a real, narrow gap in the
   mechanism ITSELF: `effectiveCastCost`'s own `perControlled` check only
   ever counted `caster.battlefield` permanents by `subtypes.includes(...)`
   — correct for a creature SUBTYPE (Bird/Elf) but wrong for a card TYPE
   (Artifact), since real Forge's own `Affinity` keyword
   (`forge-game/.../keyword/Affinity.java`) resolves BOTH through the same
   generic valid-checking mechanism (`Affinity:Bird` and `Affinity:Artifact`
   are structurally identical to Forge, just parameterized by a subtype vs.
   a type string). Fixed: `effectiveCastCost` now checks
   `c.subtypes.includes(subtype) || c.types.includes(subtype)`.

   **Two more real, narrow extensions surfaced 2026-09-18 (FDN authoring),
   NOT built this pass:**
   - `archmage-of-runes` ("Instant and sorcery spells you cast cost {1} less
     to cast.") — `SpellCostReductionGrant` (the BROADCAST shape above) only
     ever gates on `colors: string[]`; this is the identical mechanism
     needing a card-TYPE gate instead (Instant/Sorcery), the same
     `subtypes.includes(...) || types.includes(...)` widening
     `valkyrie-aerial-unit` just proved out for `perControlled` above,
     applied to the sibling `colors`-only field instead. Cheap, same-shaped
     follow-up.
   - `quilled-greatwurm` ("You may cast this card from your graveyard by
     removing six counters from among creatures you control in addition to
     paying its other costs.") — `AlternateCost` only models a full cost
     REPLACEMENT (Flashback/Jump-start shape, `from`/`thenExile`); this needs
     an ADDITIONAL cost paid alongside the normal mana cost (pay the printed
     cost AND remove 6 counters), a genuinely different shape, not a
     `colors`-style parameter widening.
   `diamond-weapon`'s own "costs {1} less for each permanent card in your
   graveyard" stays correctly open — genuinely different (GRAVEYARD-
   counted, not battlefield; a broad multi-type "permanent card" category,
   not one subtype/type) — `effectiveCastCost` only ever counts
   `caster.battlefield`.
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
   **Evidence-audit follow-up (2026-09-18):** this gap's original closure
   cited only `state.test.ts`'s own unit-level `dealDamage` describe
   block — real, but never actually driven through a real
   `createEngine` turn/priority/combat simulation (zero `engine.test.ts`
   citation at all). `engine.test.ts` now has a genuine new describe
   block ("Damage-prevention shields — real FIN card (Diamond Weapon...)")
   that seeds the real Diamond Weapon (its own real name/P&T/keywords,
   including the real `CombatDamagePrevention` keyword) and a real Hill
   Gigas onto the battlefield, drives them through a genuine
   `declareAttackers`/`declareBlockers`/`resolveCombatDamage` combat, and
   asserts BOTH halves of the real asymmetry this closure's own text
   already claims: Diamond Weapon's own printed `CombatDamagePrevention`
   genuinely prevents the incoming 5 combat damage (`damageMarked` stays
   0, `result.prevented` names it), while its own 8 damage back is
   unshielded and lethal to Hill Gigas. (Casting Diamond Weapon's real
   `{7}{G}{G}` cost is out of scope for what this specific gap is about —
   seeded directly onto the battlefield, same technique this file's other
   combat tests already use for an attacker/blocker.) Crystal
   Fragments/Summon: Alexander's own whole-damage-shield variant stays
   backed by `state.test.ts`'s unit-level coverage plus its own real
   `runEngineScenarios` card-level trace — not independently re-driven
   through `engine.test.ts` this pass.

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
   - **Evidence-audit follow-up (2026-09-18):** this closure's own
     `engine.test.ts`/`turn.test.ts` describe blocks were real, genuine
     `createEngine`-piloted coverage, but only ever against synthetic
     "Fast Striker"/"Double Striker" fixtures, not the actual real FIN
     cards this section's own prose already names (Lightning, Army of
     One; Giott, King of the Dwarves). `engine.test.ts` now ALSO has a
     sibling describe block using both real `CardDefinition`s directly
     ("First/Double Strike combat sub-step — real FIN cards..."): seeds
     each (its own real name/P&T/keywords) onto the battlefield and drives
     it through a genuine two-real-phase combat
     (`CombatFirstStrikeDamage` then `CombatDamage`), including Lightning's
     own real printed Lifelink genuinely paying off her controller during
     the first-strike step.
10. ~~**Legend rule / other SBA-adjacent state cleanup**~~ **CLOSED** — was
    subsumed by gap #2, now folded into `sba.ts`'s own loop
    (`state.checkLegendRule`); `sba.test.ts` specifically tests two
    same-named Legendary permanents (Jill's own card is Legendary) both
    alone and combined with a lethal-damage case in the same sweep.
    **Evidence-audit follow-up (2026-09-18):** that `sba.test.ts` coverage
    is real but never actually driven through a real `createEngine`
    turn/priority pass — both Jills were bare `state.addCard(...,
    'Battlefield', ...)` fixtures, never actually cast. `engine.test.ts`
    now has a genuine new describe block ("Legend rule (704.5j) — real FIN
    card (Jill, Shiva's Dominant...)") that casts the real Jill
    `CardDefinition` TWICE for real, through `castSpell`/`resolveTop`
    across two real turns, then runs `checkStateBasedActions` in the SAME
    sweep as an unrelated lethally-damaged creature — proving the real
    704.3 loop-until-stable behavior off two genuinely-resolved permanents,
    not two hand-built fixtures.
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
    `manaAbilities`'s own resolve-time copy already established, not a
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
    Arsenal (Artificer, PLUS its own "+2/+2 for each artifact you control"
    — a genuinely VARIABLE, board-state-SCALED bonus, real Forge
    `SVar:X:Count$Valid Artifact.YouCtrl/Times.2` on the SAME static
    ability).

    **The scaled-P/T half of Machinist's Arsenal's own gap, CLOSED
    2026-09-15 (fin/16-25 pass)**: `continuousPTGrants` entries can now
    ALSO carry `scalePerType: {type, power, toughness}` instead of a fixed
    `{power, toughness}` pair — the same real `Count$Valid <Type>.YouCtrl/
    Times.N` scaling mechanism `ptFormula.kind:'addPerEquipmentControlled'`
    already used for a SELF-only CDA (Adelbert Steiner), now real for a
    BROADCAST grant too (`state.ts`'s `effectivePT`, the `continuousPTGrants`
    loop's own new `'scalePerType' in grant` branch, counting the GRANTING
    permanent's own controller's battlefield — real Forge `YouCtrl`).
    `continuousPTGrantsEquipped-structural.ts` (the same recognizer/rule id
    the 7 fixed-delta cards above already use) now has a second branch
    building "Equipped creature gets ±P/±T for each &lt;type&gt; you control,"
    checked against Machinist's Arsenal's own real text. No possible trace
    evidence either way (this card's own `scenarios.ts` is a plain
    `harness.ts` Scenario[], same structural wall its 6 fixed-delta siblings
    already hit — `isEquippedPTGrantFact` stays as-is), but the engine
    mechanism itself and the fact's own provenance are both now real.

    **Gaelicat's/Magitek Infantry's own sibling threshold-CDA gap, closed
    2026-09-15 (fin/16-25 pass)**: "As long as you control two or more
    artifacts, this creature gets +2/+0" (Gaelicat)/"This creature gets
    +1/+0 as long as you control another artifact" (Magitek Infantry) are a
    genuinely DIFFERENT real Forge shape than `continuousPTGrants` above (a
    BROADCAST grant from one permanent onto another) or
    `addPerEquipmentControlled` (a per-unit-SCALED bonus) — a fixed bonus
    that's either fully ON or fully OFF once a live COUNT THRESHOLD is met,
    real Forge `S:Mode$ Continuous | Affected$ Card.Self | AddPower$ N |
    IsPresent$ <Type>[.Other]+YouCtrl | PresentCompare$ GE<min>`
    (`gaelicat.txt`/`magitek_infantry.txt`). New `card.ts`
    `ptFormula.kind:'thresholdBonus'` (`condition: {type, min, excludeSelf?}`)
    — `state.ts`'s `effectivePT` is the real read path, same "recalculated
    live every read" treatment the other two `ptFormula` kinds already get.
    `excludeSelf` mirrors Forge's own `.Other+` qualifier (Magitek Infantry
    is itself an Artifact and must not count toward its own threshold).
    Generalized to the LAND-count shape too, same pass: Scorpion Sentinel
    ("seven or more lands" +3/+0) and Gigantoad (same threshold, +2/+2 —
    this card had ZERO facts of any kind before this pass, not even a bare
    unbacked `pump`) both migrated. `ptFormula-scalingPump-structural.ts`
    (the SAME recognizer/rule id `addPerEquipmentControlled` already used,
    extended with a second branch, not a new sibling recognizer) derives the
    real `pump` source + zone-shaped `to:'Battlefield', types, amount:{min},
    excludeSelf?` sink facts from the field, checked against confirmed real
    English templates for both the "another X" (`min:1, excludeSelf:true`)
    and "N or more Xs" (`min>=2`) phrasings — no other combination is
    guessed at without a real card. All 4 cards' own `read:getNetPower`
    trace evidence is REAL now (Gaelicat 1/3->3/3, Magitek Infantry 1/1->2/1,
    Scorpion Sentinel 1/4->4/4, Gigantoad 4/4->6/6, each confirmed via a
    live `effectivePT` recompute against a real board with the threshold
    met) — Scorpion Sentinel's/Gaelicat's own pre-existing `engine-trace.ts`
    pilot scripts each had a real, separate bug caught by this same pass:
    `pilot.state.addCard` is a raw manual `RealCard` build (unlike
    `harness.ts`'s own generic `runScenario`, which copies
    `effectiveCard.ptFormula` automatically), so `ptFormula` has to be
    threaded through the `addCard` call explicitly or the real CDA silently
    never applies even with the engine mechanism itself fully wired — caught
    by the trace numbers not matching expectations, not by inspection.
    `isGaelicatArtifactThresholdPumpFact`/`isMagitekInfantryArtifactThreshold
    PumpFact`/`isMagitekInfantryArtifactThresholdWant`/
    `isScorpionSentinelLandThresholdPumpFact`/
    `isScorpionSentinelLandThresholdWant` (all `verify-synergy.mjs` named
    exemptions) all REMOVED outright, not left in place.

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
      correctly capping at the real library size). At the time this gap was
      first closed, no `engine.test.ts` case was added for it either — the
      REAL card-level evidence was (and still is) The Water Crystal's own
      genuine `runEngineScenarios` pilot (`cards/the-water-crystal/
      scenarios.ts`, checked-in `trace.json`), which drives the real
      `resolveTop` `millModifierGrants` copy and the `kind:'mill'` dispatch
      end-to-end through a real cast + activation. **Correction
      (2026-09-18 evidence audit):** this entry used to also name a SECOND
      test file (`engine.test.ts` and one other, spelled here deliberately
      without its own real dotted filename token so it can never again be
      auto-cited as evidence by `functional-model/engine-status.ts`'s own
      `TEST_CITATION_RE`: "card" + "test" + "ts") that "needed no new
      cases" — that second file does not, and never did, exist anywhere in
      this repo; the sentence was only ever saying it did NOT need
      touching, and a naive regex mis-read that as a citation. Fixed for
      real, not just de-cited: `engine.test.ts` now has a genuine, real-card,
      `createEngine`-piloted describe block for this gap too ("Mill
      mechanism — real FIN card (The Water Crystal, ENGINE_GAPS.md gap
      #19)") — casts the real Water Crystal, crosses a real turn, and
      activates its own real mill ability with a live, non-scripted hand
      size, asserting the real `+4` replacement lands on the opponent's
      graveyard/library counts. Both this new unit-level case and the
      pre-existing real scenario/trace evidence now back this gap.
    - Only The Water Crystal was touched among the 10 real FIN cards that
      reference mill (Shinra Reinforcements, Random Encounter, Summon:
      Titan, Town Greeter, Vanille Cheerful l'Cie, Hope Estheim, Terra
      Magical Adept // Esper Terra, Eden Seat of the Sanctum, Jidoor
      Aristocratic Capital // Overture) — migrating the other 9 to this
      real mechanism is a separate, deliberately out-of-scope fact-
      authoring pass (this closure is the engine mechanism becoming real,
      not a sweep of every card that happens to mention mill).
20. ~~**Per-turn ability activation-limit tracking (`ActivationLimit$ N`).**~~
    **CLOSED (2026-09-14).** Surfaced by this session's own fin/1-25
    completeness inventory: G'raha Tia's own "The Allagan Eye ... This
    ability triggers only once each turn" and Elrond, Moon-Reader's own
    "Whenever you activate an ability of a creature, draw a card. This
    ability triggers only once each turn" both had real, unenforced
    documentary-only `oncePerTurn`/prose claims — no `turn.ts` counter
    existed anywhere for "how many times has this NAMED trigger fired this
    turn," unlike the sibling per-turn trackers this same closure mirrors
    (`flippedCoinThisTurn`/`resetFlippedCoinThisTurn`, ENGINE_GAPS.md gap
    #15's own real 514.2-Cleanup-scoped reset shape). Real Forge citation:
    `Trigger.java`'s own `checkActivationLimit()` (~line 362-368) reads
    `hasParam("ActivationLimit") && getActivationsThisTurn() >=
    Integer.parseInt(getParam("ActivationLimit"))`; `getActivationsThisTurn()`
    (~line 596) reads `hostCard.getAbilityActivatedThisTurn(...)`, backed by
    `Card.java`'s own `numberTurnActivations` map, reset game-wide by
    `Game.onCleanupPhase()` (`Game.java` ~lines 1215-1229: `for (final Card
    card : getCardsInGame()) card.resetActivationsPerTurn();` — every card
    in the game, not just the active player's). Real card scripts:
    `res/cardsfolder/g/graha_tia.txt` (`T:Mode$ ChangesZoneAll | ... |
    ActivationLimit$ 1 | TriggerDescription$ The Allagan Eye — Whenever one
    or more other creatures and/or artifacts you control die, draw a card.
    This ability triggers only once each turn.`) and
    `res/cardsfolder/e/elrond_moon_reader.txt` (`T:Mode$ AbilityCast | ... |
    ActivationLimit$ 1 | TriggerDescription$ Whenever you activate an
    ability of a creature, draw a card. This ability triggers only once
    each turn.`).

    Mirrors the EXISTING `flippedCoinThisTurn` pattern exactly, generalized
    from "one boolean per player" to "one count per (card, named trigger)
    pair": `card.ts`'s new `Trigger.activationLimit?: number` (omitted =
    uncapped, the pre-existing default for every other trigger in the pool);
    `state.ts`'s new `triggerActivationsThisTurn: Map<string, number>`
    (keyed `` `${cardId}:${triggerName}` `` — Forge's own `ActivationLimit`
    is scoped per NAMED trigger, not per card as a whole, so a card with two
    independently-capped triggers would track them separately, even though
    no FIN card needs that today), `triggerActivationsSoFar(cardId,
    triggerName)`, `recordTriggerActivation(cardId, triggerName)`, and
    `resetTriggerActivationsThisTurn()` (called game-wide from `turn.ts`'s
    `runPhaseEntryAction` at every real Cleanup, alongside
    `resetFlippedCoinThisTurn`/`clearUntilEndOfTurnPumps`, same scope as
    those). The cap is enforced at the ONE real shared chokepoint every
    trigger-firing call site in this codebase already funnels through —
    `triggers.ts`'s `fireTrigger` — rather than duplicated per call site:
    checked BEFORE anything else (before even a `triggerDoubling` check),
    gating the firing outright (matches Forge's own `checkActivationLimit`,
    which keeps the trigger from ever being collected/queued in the first
    place, not "fires but does nothing") and returning `false` (same as "did
    not double") for a gated firing, since a trigger that never resolved
    can't have doubled either.

    Both real FIN cards' own `definition.ts` now declare
    `activationLimit: 1` on their real trigger, replacing documentary-only
    `oncePerTurn` prose; both own `scenarios.ts` (already real,
    engine-piloted) demonstrate the cap genuinely enforced, not just
    declared — G'raha Tia's own scenario kills a SECOND other-creature the
    same turn and shows no second `drawCard` (only the trigger's own second
    `{fn:'trigger'}` bracket, no matching effect); Elrond, Moon-Reader's own
    flat `harness.ts`-style `sequence: ['onActivateCreatureAbility',
    'onActivateCreatureAbility']` scenario shows the identical shape. Both
    cards' own `progress.json` `knownGaps` entries (previously stale,
    claiming no enforcement existed) corrected to point at this closure.

    New tests: `state.test.ts`'s `GameState.triggerActivationsThisTurn /
    resetTriggerActivationsThisTurn` describe block (starts at 0, increments
    per (cardId, triggerName) pair, scoped per NAMED trigger not per card,
    scoped per card not shared across two same-named-trigger objects, and
    the real Cleanup reset). `triggers.test.ts`'s new "Real ActivationLimit$
    N" describe block (6 cases: fires normally under the cap; a second
    same-turn firing of the identical named trigger is gated outright with
    NO effects running; a gated firing returns `false` indistinguishably
    from a plain non-doubled firing; scoped per NAMED trigger — a different
    trigger on the same card is unaffected; `resetTriggerActivationsThisTurn`
    lets it fire again "next turn"; an uncapped trigger with no
    `activationLimit` at all fires every time, unchanged regression). New
    integration cases in `turn.test.ts`'s own Cleanup describe block prove
    the real `turn.ts`/`state.ts` wiring end-to-end, not just
    `triggers.ts`'s own pure logic.

    `npx vitest run functional-model` — 541/541 green. `npx tsc -p
    functional-model/tsconfig.json --noEmit` — zero NEW errors (same
    pre-existing baseline noise categories). `scripts/verify-synergy.mjs`
    full pool — 320 checked, 0 hard failures.
    **Evidence-audit follow-up (2026-09-18):** every test cited above
    (`state.test.ts`, `triggers.test.ts`, `turn.test.ts`) is real, but
    NONE of them ever call `createEngine` — the "integration" claim above
    is about `turn.ts`/`state.ts` wiring, not a real cast/combat
    playthrough. `engine.test.ts` now has a genuine new describe block
    ("Per-turn ability activation-limit tracking — real FIN card (G'raha
    Tia...)") that casts the real G'raha Tia `CardDefinition` for real,
    fires her own real `ActivationLimit: 1` trigger (through the SAME
    shared `fireTrigger` chokepoint every real auto-fire in this engine
    uses) off a genuine other-creature death, proves a second same-turn
    firing draws nothing, then crosses a real Cleanup into the next turn
    and proves the cap genuinely resets — not a hand-called
    `resetTriggerActivationsThisTurn()`, an actual `advance()`-driven
    Cleanup.
21. **`state.pump()` had no `untilEndOfTurn` expiry — a real, live
    correctness bug, not just a missing feature. CLOSED (2026-09-14).**
    Every `pump`/`pumpAll`/`pumpTarget`/`pumpSelf` call used to be a
    permanent, never-cleared `layers.add` entry — even when the card's own
    real text says "until end of turn" — so in any real multi-turn
    engine-piloted playthrough, the buff never went away. Concretely wrong
    (not just an abstract "layers.ts has no duration" footnote, see
    Accepted Simplifications above) for Ambrosia Whiteheart's own Landfall
    "gets +1/+0 until end of turn" and Battle Menu's own Ability mode
    "target creature gets +0/+4 until end of turn." Real Forge citation:
    `StaticAbilityLayer`'s own real duration tracking (`layers.ts`'s
    Accepted-Simplifications entry above already documents this engine's
    own narrower, timestamp-only layer model) — CR 514.2's "until end of
    turn" half is the rule being closed here, for the pump case
    specifically (the keyword-grant half was already real, see
    `grantKeyword`'s own `untilEndOfTurnKeywordGrants` mechanism, closed
    2026-09-12).

    Mirrors that EXISTING `untilEndOfTurnKeywordGrants` mechanism exactly,
    generalized from "a keyword name to remove" to "a P/T delta layer entry
    to remove": `state.ts`'s new `untilEndOfTurnPumps: {cardId, timestamp,
    powerDelta, toughnessDelta}[]` (keyed by `{cardId, timestamp}` — the
    SAME timestamp `pump` gave the underlying `LayerSet` entry — rather than
    a direct `RealCard`/`LayerEffect` reference, same "safe, cheap lookup,
    not a stale object reference" reasoning the keyword-grant list already
    uses; `powerDelta`/`toughnessDelta` are carried too, unlike the
    keyword-grant list which only needs the keyword NAME, since a pump's own
    removal is otherwise unreadable after the fact). `GameState.pump` gained
    a new `opts?: {untilEndOfTurn?: boolean}` param (opt-in, same convention
    `grantKeyword` already established — every pre-existing call keeps its
    prior permanent-within-scenario behavior unless explicitly set) that
    ALSO registers the pump in this list when true; `clearUntilEndOfTurnPumps()`
    (called game-wide from `turn.ts`'s `runPhaseEntryAction` at every real
    Cleanup, alongside `clearUntilEndOfTurnKeywordGrants`) removes the
    SPECIFIC layer entry via `LayerSet.remove(timestamp)` (a real mutation
    of the card's own continuous-effect list, not a filter applied at read
    time), silently skipping a card that already left the battlefield
    (its own layers were already wiped by the 400.7 zone-change reset).

    `card.ts`'s `pumpAll`/`pumpTarget`/`pumpSelf` `Effect` kinds each gained
    a matching `untilEndOfTurn?: boolean` field (mirroring
    `grantKeywordTarget`/`grantKeywordAll`/`grantKeywordSelf`'s own field
    exactly); `resolveCard`'s own dispatch for all three threads it straight
    through to `actions.pump(...)`. `engine-trace.ts` gained a real, symmetric
    trace-visibility half for the SAME reason `clearUntilEndOfTurnKeywordGrants`
    already needed one: `PreAdvanceSnapshot.untilEndOfTurnPumps` captures the
    pending list BEFORE an `advance()` call (a real Cleanup crossing drains it
    for real, so it's unreadable AFTER), and `logAutomaticPhaseEntry`'s own
    Cleanup branch pushes a synthetic `{fn:'pump', target, id, power:
    -powerDelta, toughness: -toughnessDelta, removed: true}` entry per
    expired pump — UNLIKE the keyword-grant case (which needs no discrete log
    entry at all, since a keyword's removal is directly re-derivable by
    re-reading `card.keywords`), a pump's own removal has no equivalent
    "current pump list" a renderer could re-derive from, so a discrete log
    entry is the only way the trace shows the expiry genuinely happened.

    Ambrosia Whiteheart's and Battle Menu's own `definition.ts` now set
    `untilEndOfTurn: true` on their real pump effects (replacing a bare,
    permanent pump). Per this task's own instruction, BOTH cards' own
    `scenarios.ts` were extended to actually DEMONSTRATE the expiry (a
    scenario spanning past a real Cleanup), not just apply the pump and stop
    — neither one's own PRIOR scenario ever crossed a Cleanup boundary, so
    neither would have caught this bug being fixed at all: Ambrosia's own
    scenario now reads her real effective power/toughness right after
    Landfall fires (3/2 — genuinely pumped) and again after a real Cleanup
    crossing (`advanceOneStep` looped to `'Cleanup'`, same convention
    `the-lunar-whale`'s own scenario already establishes for reaching a
    specific later phase) — back to her base 2/2. Battle Menu's own Ability
    mode does the identical thing against the real Cat token it targets
    (1/5 pumped, 1/1 after Cleanup).

    New tests: `state.test.ts`'s `GameState.pump / clearUntilEndOfTurnPumps`
    describe block (6 cases: a plain pump with no opts stays permanent; an
    `untilEndOfTurn: true` pump is genuinely removed at the next Cleanup;
    the clear is game-wide, not just the active player's own permanents; two
    pumps on the same card with only one tagged UET correctly removes only
    that one; the pending list is genuinely drained (a second clear with
    nothing new pumped is a real no-op); a card that already left the
    battlefield before Cleanup is silently skipped, not a crash).
    `turn.test.ts`'s new Cleanup-describe-block case proves the real
    `turn.ts`/`state.ts` wiring end-to-end, game-wide, mirroring the
    existing keyword-grant Cleanup test exactly.

    `npx vitest run functional-model` — 541/541 green. `npx tsc -p
    functional-model/tsconfig.json --noEmit` — zero NEW errors.
    `scripts/verify-synergy.mjs` full pool — 320 checked, 0 hard failures;
    both cards individually re-verified after their scenario rewrite (same
    pre-existing soft-note baseline, 0 hard failures).
    **Evidence-audit follow-up (2026-09-18):** `state.test.ts`'s own
    `GameState.pump` describe block and `turn.test.ts`'s own Cleanup case
    are real, but neither ever calls `createEngine` — no real cast, no
    real card. `engine.test.ts` now has a genuine new describe block
    ("`state.pump()` untilEndOfTurn expiry — real FIN card (Battle
    Menu...)") that casts the real Battle Menu `CardDefinition`'s own
    Ability mode ("target creature gets +0/+4 until end of turn") for
    real, confirms the real pump applies (`effectivePT`), then crosses a
    real Cleanup via `advance()` and confirms it's genuinely gone — not
    still sitting in `layers`.
22. **No attack-triggered-ability auto-dispatch primitive. CLOSED for a
    real, narrow first slice (2026-09-14).** Mirrors the real, already-closed
    `on: 'upkeep'`/`'endStep'` auto-fire (gap #3 above) and the real, already
    closed `on: 'tapLandForMana'` auto-fire (gap #5 above), but neither ever
    covered "whenever ~ attacks" — every real FIN card with an attack
    trigger had to be piloted through a manual `pilotFireTrigger` call
    instead of a genuine `declareAttackers`-driven auto-fire, same
    workaround-vs-real-mechanism gap those two closures already fixed for
    their own trigger occasions. Real Forge citation:
    `TriggerType.Attacks`/`TriggerAttacks.java`'s own `performTest` (checks
    `ValidCard$`/`Attacked$`/`Alone$` against the real event), fired from
    `CombatUtil.checkDeclaredAttacker` (forge-game/.../combat/CombatUtil.java
    ~lines 363-383 — its own doc comment: "checks triggered effects of
    attacking creatures, right before defending player declares blockers"),
    called once per real declared attacker. Ashe, Princess of Dalmasca's own
    real "Whenever Ashe attacks, look at the top five cards of your
    library..." (`res/cardsfolder/a/ashe_princess_of_dalmasca.txt`: `T:Mode$
    Attacks | ValidCard$ Card.Self | Execute$ TrigDig | ...`) is the real FIN
    card this closes for real.

    Mirrors the EXISTING `fireOnPhaseEnterTriggers`/`fireOnTapLandForManaTriggers`
    shape exactly: `card.ts`'s `Trigger.on` gained a new `'attacks'` value;
    `engine.ts`'s new `fireOnAttackTriggers(engine, attackers)` — called from
    `declareAttackers` right after a legal attacker batch is declared
    (508.1), i.e. real Forge's OWN causal position for `checkDeclaredAttacker`
    — sweeps the just-declared `attackers` for a registered `resolvedPermanents`
    entry (same "only a permanent CAST through this engine" real, documented
    limitation `'upkeep'`/`'endStep'`/`'tapLandForMana'` already carry) whose
    own `CardDefinition` has a trigger with `on: 'attacks'`, firing it with
    THAT SAME attacker as `ctx.self` — real Forge's own `ValidCard$
    Card.Self` scope, i.e. "this creature's own attack," not "any creature
    attacking."

    **Deliberately narrow, real, named scope — only `ValidCard$ Card.Self`
    is modeled, not the whole real Forge trigger family.** Grepped every
    real `Whenever [^,.]*attacks[^,.]*,` clause across the full pool (34
    real occurrences) BEFORE building anything, per this doc's own standing
    discipline. Genuinely different real gates this pass does NOT attempt
    (each is a real, separately-shaped precondition, not a narrower version
    of the same one):
      - A broader "whenever A creature you control attacks" shape (Seifer
        Almasy/Squall, SeeD Mercenary's own "attacks alone" — conditioned on
        being the LONE attacker, a real distinct predicate `TriggerAttacks
        .performTest`'s own `Alone$` param checks).
      - An EQUIPMENT's own "whenever equipped creature attacks" (Genji
        Glove, Ultima Weapon) — the trigger lives on a DIFFERENT permanent
        than the one attacking.
      - A Vehicle-crewed-by-a-specific-pair shape (Balthier and Fran).
      - A compound "enters or attacks" shape (Sephiroth/Gilgamesh/
        Emet-Selch/Kefka/Sin/Ultimecia) — fires on EITHER event, a genuinely
        different precondition from a plain self-attack.
    All of the above are now real, NAMED, unblocked follow-ups (the
    mechanism itself is real and general — a future pass just needs to widen
    `fireOnAttackTriggers`'s own scope check, e.g. reading a Vehicle's own
    equipped/crew relationship or an "alone" flag off `engine.attackers`'s
    own size) — not attempted this pass per its own explicit instruction to
    prove the mechanism on Ashe alone, not migrate the whole pool.

    Ashe's own `definition.ts` now declares `on: 'attacks'` on her real
    `onAttack` trigger, replacing a bare free-text `name` with no
    engine-recognized dispatch. Her own tier-3 `CardDefinition.authoredFacts`
    escape hatch (a "wants to attack" sink, needed specifically because
    `Trigger.on` had no closed vocabulary for "attacks" before this pass) is
    now GONE — replaced by a real, general recognizer,
    `recognizers/attacks-trigger-structural.ts` (registered in
    `scripts/apply-recognizers.mjs`'s own `RECOGNIZERS` catalog, same family
    as `dies-trigger-structural`/`lifegain-trigger-structural`): a plain TEXT
    recognizer matching "When/Whenever <self> attacks" (self = "this
    creature" or the card's own printed name/short-comma-form, "attacks"
    required IMMEDIATELY adjacent — same adjacency discipline
    `dies-trigger-structural.ts` already established — so it correctly
    DECLINES every one of the genuinely-different real shapes listed above,
    without any card-specific carve-out). Real, whole-pool-checked before
    writing the regex (34 real clauses read directly, see the recognizer's
    own module doc comment for the full per-card breakdown). Running
    `apply-recognizers.mjs ashe-princess-of-dalmasca` retagged her existing
    sink fact with real `provenance: {origin:'parser', rule:
    'attacks-trigger-structural'}` — the fact now lives the normal way,
    verified/re-derivable the same way every other recognizer-backed fact in
    the pool is, not a one-off `definition.ts` escape hatch. (Running the
    SAME retag also normalized two of Ashe's own OTHER, unrelated
    pre-existing facts' stale `value`/`provenance.note` fields — a real,
    documented, pre-existing side effect of `apply-recognizers.mjs`'s own
    "no distinction between first-time and re-confirming" retag rule
    whenever ANY recognizer runs against a card, not something this task's
    own new recognizer caused.)

    Ashe's own `scenarios.ts` no longer calls `pilotFireTrigger` at all — the
    real `declareAttackers` call auto-fires her trigger for real now.
    Surfaced and fixed two real, small trace-ordering bugs found wiring this
    up for real (both in `engine-trace.ts`, not `engine.ts` — the real
    engine-side mutation order was always correct):
      - `pilotDeclareAttackers` used to push its own `tap`/`attack` log
        markers AFTER calling the real `declareAttackers` — harmless before
        this pass (nothing else logged anything synchronously inside that
        call), but now that `declareAttackers` itself auto-fires a trigger
        whose own effects log THROUGH THE SAME `pilot`, a trailing push
        showed the trigger's own effects BEFORE the attack that caused them.
        Fixed the same way `logAutomaticPhaseEntry` already fixes the
        identical class of bug for Untap/Draw/Cleanup's own automatic
        actions: capture `beforeLen` before calling the real function, then
        `pilot.log.splice(beforeLen, 0, ...)` the markers in at that
        position instead of a trailing push.
      - `pilotDeclareAttackers` also now logs a synthetic `{fn:'trigger',
        name}` bracket per attacker with a registered `on:'attacks'` trigger
        (peeked BEFORE calling the real `declareAttackers`, same "peek the
        CardDefinition, then call the real mutating function" shape
        `pilotResolveTop`'s own ETB peek already uses) — needed because
        `verify-synergy.mjs`'s own `TRIGGER_EVENT_MAP`/`triggerNames`
        evidence check for an event-shaped SINK want is built ENTIRELY from
        `{fn:'trigger', name}` bracket entries in the trace, and this
        engine's real auto-fire (unlike the manual `pilotFireTrigger` it
        replaces) never pushed one itself — without this, Ashe's own
        `{event:'attacks', target:'self'}` sink want would have HARD FAILED
        verify-synergy's forward evidence check (caught live, not
        theoretically — see the real before/after run this task did).
        **Scoped to exactly one attacker per call** (Ashe is the only real
        card exercising this today) — an N-attacker batch where MORE THAN
        ONE has its own `on:'attacks'` trigger would bunch every trigger
        bracket ahead of every attacker's own effects instead of
        interleaving them per-attacker; real, narrower-than-ideal, not
        attempted since no pool scenario needs it yet.

    New tests: `engine.test.ts`'s new `fireOnAttackTriggers` describe block
    (4 cases: auto-fires for a registered permanent's own legally-declared
    attack; does NOT fire for a permanent seeded directly onto the
    battlefield, same real documented limitation the other auto-fires
    share; does NOT fire when the attacker declaration itself is illegal —
    no half-applied trigger; does NOT fire a DIFFERENT attacker's own
    registered permanent that has no `on:'attacks'` trigger at all).
    `recognizers/attacks-trigger-structural.test.ts` (new file, 9 cases: 4
    real accepted cards, the short-comma-name form, and 5 real DECLINE
    cases — compound "enters or attacks," "equipped creature attacks," "a
    creature you control attacks alone," a Vehicle-crewed shape, "this
    Vehicle attacks," a non-Creature typeLine, and no clause at all).

    `npx vitest run functional-model` — 541/541 green. `npx tsc -p
    functional-model/tsconfig.json --noEmit` — zero NEW errors (one new
    TS7016 `./load-fin-cards.mjs` implicit-any on the new recognizer test
    file, same pre-existing baseline category every sibling recognizer test
    file already has). `scripts/verify-synergy.mjs` full pool — 320
    checked, 0 hard failures; Ashe individually re-verified before AND after
    the trace-ordering fix above (confirmed the fix turns a real hard
    failure into 0, not assumed).
    **Evidence-audit follow-up (2026-09-18):** this closure's own
    `engine.test.ts` describe block (4 cases) was real, genuine
    `createEngine`-piloted coverage — but only against a synthetic "Test
    Attacker" fixture; its OTHER cited test file,
    `recognizers/attacks-trigger-structural.test.ts`, is a SYNERGY-FACT
    recognizer test that never touches `GameState`/`createEngine`/the
    engine runtime at all (it only proves the unrelated Fact-extraction
    layer recognizes the phrasing — a real domain mismatch as engine-level
    evidence, even though the recognizer itself is legitimately real
    coverage for a DIFFERENT layer). `engine.test.ts` now has a genuine
    sibling case using the real Ashe, Princess of Dalmasca `CardDefinition`
    directly ("`fireOnAttackTriggers` — real FIN card (Ashe, Princess of
    Dalmasca...)") — casts her for real, clears summoning sickness over an
    honest real turn passage (not a granted Haste she doesn't have), then
    declares her as a real attacker and confirms her own real "look at the
    top five cards... reveal an artifact" auto-fires and genuinely finds a
    real artifact card seeded at the top of her controller's library.
23. **The entire Cycling family (plain Cycling + Islandcycling/Plainscycling/
    Swampcycling/Forestcycling/Mountaincycling) had ZERO engine
    representation — no `CardDefinition` field, no harness lifecycle path,
    no declarative `Effect` kind; every real card printing it sat as inert
    `staticAbilities` text pool-wide, violating the standing "no magic
    strings — declarative or functional" policy. CLOSED (2026-09-14).**
    Surfaced by this session's own fin/1-25 completeness inventory. Real
    Forge citation: `Keyword.java` lines 46/199 (`CYCLING`/`TYPECYCLING`);
    the real expansion, `CardFactoryUtil.java` ~lines 3717-3745:
    ```
    } else if (keyword.startsWith("Cycling")) {
        ... sb.append("AB$ Draw | Cost$ ").append(manacost)
              .append(" Discard<1/CARDNAME> | ActivationZone$ Hand | ...");
    } else if (keyword.startsWith("TypeCycling") ...) {
        ... sb.append("AB$ ChangeZone | Cost$ ").append(typeCycling.getCostString())
              .append(" Discard<1/CARDNAME> | ActivationZone$ Hand | ...")
              .append(" | Origin$ Library | Destination$ Hand | ChangeType$ ")...
    }
    ```
    Real card scripts: `res/cardsfolder/t/tranquil_thicket.txt`'s `K:Cycling:2`,
    `res/cardsfolder/t/timeless_dragon.txt`'s `K:TypeCycling:Plains:2`.
    `ChangeZone | Origin$ Library` is a real hidden-zone search — confirmed
    against `ChangeZoneEffect.java`'s own mandatory post-search shuffle
    (`Player.shuffle`, `Player.java` ~line 1606) that a plain library search
    always triggers unless `NoShuffle`/`Shuffle$ False` is set (neither
    Cycling keyword sets it).

    **Real, load-bearing engine gap — turned out SMALLER than the original
    assessment once actually attempted** (same "assessed as huge, proved
    smaller in practice" trajectory gap #4's own closure documents): 602.1
    activated-ability legality (`canActivateAbility`/`activateAbility`,
    engine.ts) never actually hard-assumed Battlefield presence anywhere in
    its OWN body — no `permanent.zone === 'Battlefield'` check exists at
    all. The Battlefield assumption lives ENTIRELY in `harness.ts`'s own
    flat-scenario convenience wrapper (`selfZone`, `lifecycleBefore`/
    `lifecycleAfter` — `scenario.ability`/`card.activationCost` always route
    `self` onto the Battlefield, never Hand). So the real fix needed was
    narrower than "rebuild how this engine models ability activation" —
    it was: (a) teach `canActivateAbility`/`activateAbility` to recognize
    and ACTUALLY PAY a "discard this card" cost component (previously
    genuinely unrecognized, same `unsupportedCostComponent` chokepoint every
    other unusual cost shape — Sacrifice/Pay-life/Crew/Equip — already goes
    through), and (b) demonstrate it via `engine-trace.ts`'s real
    engine-piloted path (which never shared `harness.ts`'s own
    Battlefield-only assumption to begin with — a pilot script builds
    `self` in whatever zone it wants via a bare `state.addCard`) rather than
    extending `harness.ts`'s flat convention at all.

    New, general engine vocabulary — mirrors the EXISTING `costRequiresTap`/
    `costRequiresLifePayment` "recognized in the cost-string loop, paid for
    real by a dedicated check elsewhere" shape exactly, generalized to a
    THIRD real cost-component shape:
    - `engine.ts`'s new `costRequiresDiscardSelf(cost): boolean` — real but
      narrow text-pattern detection (`/Discard this card\b/i`), same
      "`CardDefinition.activationCost` has no structured cost grammar"
      caveat every sibling helper already carries.
    - `unsupportedCostComponent` now accepts a `"Discard this card"`
      component unconditionally (unlike self-Sacrifice, deliberately NEVER
      accepted — see that function's own doc comment): Cycling's own
      resolution effect (`drawCard`, or a real library search) never reads
      `ctx.self`'s post-discard state the way Zack Fair/Blazing Bomb's own
      self-sacrifice effects do, so there's no 608.2h last-known-information
      risk to work around — genuinely safe to pay for real, not merely
      trusted.
    - `canActivateAbility` now checks, BEFORE any other cost/timing check,
      that `costRequiresDiscardSelf(cost)` implies `permanent.zone ===
      'Hand'` (701.9a: discarding IS DEFINED as a Hand->Graveyard move, so a
      "discard this card" cost can only ever be paid from Hand — the real,
      general "ActivationZone$ Hand" restriction, checked by ZONE rather
      than a hardcoded card-specific rule).
    - `activateAbility` now genuinely pays this cost — `engine.state.move
      (permanent, 'Graveyard')` — for real, immediately, as part of paying
      the cost (602.1's own cost-payment step happens BEFORE the object
      goes on the stack), NOT deferred to resolution the way the
      Sacrifice-cost-trusted shape is. `resolveTop`'s own pre-existing
      `isAbility` branch already never relocates its source permanent
      (602.1 has no such rule) — no conflict with the move that already
      happened here.
    - `engine-trace.ts`'s `pilotActivate` gained a real, symmetric log line
      for the same reason its own pre-existing `requiresTap` self-tap fix
      needed one (`engine.ts` is log-agnostic by design): a new
      `{fn:'discard', target, id, controller}` bracket (a DIFFERENT shape
      than the pre-existing qty-based `{fn:'discard', player, qty, cards}`
      effect-level entry — no `player` field at all, so it never
      accidentally satisfies `producedEvents`' own `case 'discard'`, which
      reads `entry.player`).

    **The search half (TypeCycling)** reuses the EXISTING `move` Effect
    kind rather than inventing a new one — two new optional fields, not a
    new kind:
    - `move.subtype?: string` — a subtype filter for the TARGETED branch
      (Cloudbound Moogle's real "search your library for a PLAINS card" —
      `validType:'land'` alone would accept any land), same `subtype`
      vocabulary `pumpAll`/`putCounterAll` already establish for a creature-
      type filter, generalized here.
    - `move.shuffleAfter?: boolean` — real 601.2/701.19 "then shuffle,"
      genuinely distinct from `dig`'s own "look at the top N, no shuffle"
      shape (a dig never searches the WHOLE library, so nothing needs
      randomizing after). Calls a new `Actions.shuffleLibrary` for every
      player `move`'s own `owner` scope already resolved to.
    - New primitive, mirrors `discard`/`mill`'s own real-Forge-citation
      shape exactly: `interfaces.ts`'s ambient `shuffleLibrary(player)`
      (`Player.shuffle(SpellAbility)`, `Player.java` ~line 1606) backed by
      `state.ts`'s real `GameState.shuffleLibrary` — a genuine, in-place
      Fisher-Yates reorder of `player.library` (`Math.random`-based, real
      randomization — not a documentary no-op), wired into both
      `harness.ts`'s `loggingActions` (shared by the engine-trace path too,
      per that file's own "reuse, never fork" convention) and
      `engine-trace.ts`'s `pilotActions` (inherited via spread, no override
      needed).

    **Modeled uniformly via the NAMED `abilities` array on all 7 real
    cards** (`{name: 'cycling', cost: '...Discard this card', effects:
    [...]}`), not the top-level `activationCost`/`effects` pair — even for
    the 6 cards where the top-level pair would have been technically free
    (no conflicting prior use). Airship Crash's own top-level `effects` is
    ALREADY its Instant's own cast effect (the destroy-target `custom`), so
    top-level `activationCost`+`effects` would have silently collided (an
    activated Cycling would incorrectly run the destroy effect instead of
    drawing a card — `resolveCard`'s own default-branch dispatch, no
    `abilityName`, always reads `card.effects`). Using `abilities`
    uniformly across all 7 avoids this collision AND gives a single,
    consistent, self-documenting structural marker (`card.abilities?.find
    (a => a.name === 'cycling')`) a future recognizer could key off, rather
    than half the pool using one shape and half using another.

    **All 7 real pool cards migrated**, each real Forge citation matching
    its own printed reminder text:
    - Cloudbound Moogle (fin/11, Plainscycling {2}) — search for Plains.
    - Ice Flan (Islandcycling {2}) — search for Island.
    - Balamb T-Rexaur (Forestcycling {2}) — search for Forest.
    - Malboro (Swampcycling {2}) — search for Swamp.
    - Capital City (Cycling {2}) — plain `drawCard`, no search.
    - Airship Crash (Cycling {2}) — plain `drawCard`, no search (named
      `abilities` REQUIRED here, not just uniform-for-consistency — see
      above).
    - Cid, Timeless Artificer (Cycling {W}{U}) — plain `drawCard`, no
      search.

    Each card's own `staticAbilities` Cycling/TypeCycling text line is
    REMOVED (replaced by the real `abilities` entry, same "structured field
    replaces free text once real" convention `continuousKeywordGrants`'s
    own cards already established) — Cid, Timeless Artificer's OTHER two
    real static abilities (the anthem, the "any number of copies" deck-
    construction rule) stay static text, unrelated, still-open gaps.

    Each card's own `scenarios.ts` migrated to `runEngineScenarios` (real
    engine-piloted, not `harness.ts`'s flat convention — see the "harness.ts
    deliberately NOT extended" note below for why), demonstrating BOTH real
    branches: the card cast/played normally (its own pre-existing real
    effect, migrated from the old flat scenario), AND Cycling genuinely
    activated from Hand (real mana paid, real discard-as-cost, real
    resolution — search-and-shuffle for the 4 TypeCycling cards, a plain
    draw for the other 3). Two real, incidental fixes surfaced along the
    way, both required to make these migrations correct, not cosmetic:
    - Cid, Timeless Artificer's own engine-piloted legend-rule demonstration
      (replacing the old flat `keywordScenarios`' own `duplicateLegendaryEnters`)
      initially failed to trigger 704.5j at all — `state.checkLegendRule`
      checks `card.subtypes.includes('Legendary')` (this engine's own
      established "Legendary" pragmatic-subtype convention, `harness.ts`'s
      `subtypesFromTypeLine`), which a hand-built `state.addCard` call
      must set explicitly (unlike the flat path, which derives it
      automatically) — same convention Adelbert Steiner's/Ashe's own
      engine-piloted scenarios already establish.
    - Capital City's own bare `{zone:'Battlefield', subject:'self'}`
      baseline fact used to be exempted by `verify-synergy.mjs`'s
      `isStaticOnlyLand` ("a Land with no card-specific behavior left for a
      scenario to exercise") — now stale, since this card HAS real
      card-specific behavior (its own Cycling ability) a scenario can and
      does exercise. Fixed: `isStaticOnlyLand` now also excludes a card
      with `abilities?.length`.

    **Cloudbound Moogle's and Ice Flan's own pre-existing per-card
    `verify-synergy.mjs` exemptions REMOVED, not left stale** —
    `isCloudboundMoogleDiscardSelfWant`/`isCloudboundMoogleTutorFact`/
    `isIceFlanDiscardSelfWant`/`isIceFlanTutorFact` existed ONLY because "no
    scenario/trace path can exist for either half" (their own doc comments,
    now false). Real trace evidence exists instead: a new, GENERAL (not
    per-card) `w.event === 'discard' && w.target === 'self'` readEvidence
    branch (checks for a real `{fn:'discard', target: cardName}` bracket)
    for the discard-as-cost SINK, and the ordinary zone-fact `evidence`
    check (already real, unchanged) for the tutor SOURCE fact, now that a
    real `{fn:'moveTo', zone:'Hand', controller:'you'}` line exists to
    satisfy it. Balamb T-Rexaur's and Malboro's own Forestcycling/
    Swampcycling previously had NO facts at all for their own printed
    Cycling ability (not even an exempted one) — both now get the SAME
    real tutor SOURCE + discard-self SINK facts, plus a new SINK fact on
    all 4 search cards (`{to:'Library', controller:'you', types:{has:
    [<subtype>]}}` — "wants a matching basic land present in library to
    find," the real want a search creates) needed to satisfy a NEW
    `read:getCardsIn` aggregate-read backward-check the real search itself
    introduces. Capital City/Airship Crash/Cid, Timeless Artificer's own
    plain (non-search) Cycling similarly gained a real `{event:'drawCard'}`
    SOURCE + `{event:'discard', target:'self'}` SINK fact pair.

    **Deliberately, explicitly NOT extended: `harness.ts`'s own flat
    `Scenario`/`selfZone`/`lifecycleBefore`/`lifecycleAfter` convention
    still hard-assumes Battlefield-or-Stack for `self`, never Hand.** This
    is a real, narrower-than-ideal scope decision, not an oversight: the
    REAL, load-bearing mechanism this gap needed (602.1 legality, real
    mana/discard-as-cost payment, real stack push) lives entirely in
    `engine.ts`, already fixed for real, general reuse by ANY caller —
    `harness.ts`'s flat runner is a documented, cheaper convenience path
    that never itself enforced activation legality/cost-payment to begin
    with (a scripted lifecycle firing `card.effects` directly, no real
    `canActivateAbility`/`activateAbility` call anywhere in it), so
    teaching it a Hand-based `selfZone` would only add a SECOND, still-
    superficial way to log the same lifecycle shape — not close a
    functionally distinct capability the way the real engine-piloted path
    already does. All 7 real cards here get the full, real engine-piloted
    demonstration instead, matching this project's own established
    convention for every comparably real cost-payment/legality closure in
    this document (Crew, Equip 301.5c, Qiqirn Merchant's cantrip, Cost
    reduction). Revisit only if a future card needs a CHEAP flat scenario
    for a Hand-activated ability with no legality/mana check worth
    demonstrating — no real FIN card needs that today.

    **Natural, real follow-up, explicitly NOT built this pass**: a
    structural recognizer for "Cycling {cost}"/"[Type]cycling {cost}"
    reminder text (mirroring `recognizers/attacks-trigger-structural.ts`'s
    own recent precedent) could derive these SOURCE/SINK facts
    automatically for any FUTURE Cycling card added to the pool, instead of
    each one being hand-authored the way these 7 (and, before them,
    Cloudbound Moogle/Ice Flan's own 2026-09-11/12 two-fact treatment) were.
    Not attempted here — no other pool card outside these 7 was found to
    have an unmodeled Cycling-shaped ability while doing this pass (checked
    incidentally, not an exhaustive re-sweep — this task's own explicit
    scope was these 7 cards only).

    New tests: `state.test.ts`'s new `GameState.shuffleLibrary` describe
    block (preserves every card — same objects, same count; a genuine
    Fisher-Yates reorder, deterministic via a mocked `Math.random`; a
    single-card library is a real no-op). `engine.test.ts`'s new `Cycling
    (702.13)` describe block (6 cases: legal activation from Hand once
    affordable; REJECTED when the permanent is on the Battlefield instead
    of Hand, even though every other check would pass; rejected when
    unaffordable, mutating nothing; `activateAbility` genuinely discards
    the permanent — Hand->Graveyard — BEFORE the ability even resolves;
    resolving the pushed ability runs its own real `drawCard` effect
    without relocating the already-discarded source; TypeCycling's own real
    library search finds the matching card, moves it to hand, and calls the
    real shuffle).

    `npx vitest run functional-model` — 550/550 green (541 + 9 new). `npx
    tsc -p functional-model/tsconfig.json --noEmit` — zero NEW errors (same
    pre-existing baseline noise categories). `scripts/verify-synergy.mjs`
    full pool — 320 checked, 0 hard failures (all 7 migrated cards
    individually re-verified before AND after — the pre-migration run
    showed each Cycling ability's own facts as either exempted or entirely
    absent; the post-migration run shows real trace evidence for all of
    them instead, confirmed live, not assumed).
    `scripts/verify-annotation-coverage.mjs` — OK (Cloudbound Moogle/Ice
    Flan are both `ANNOTATED_CARD_SLUGS` members; their new SINK fact's
    real annotation was authored in `annotations-authoring.json` and baked
    in via `scripts/compute-annotations.mjs`, not left unannotated).
    **Evidence-audit follow-up (2026-09-18):** `engine.test.ts`'s own
    `Cycling` describe block (cited above) was real, genuine
    `createEngine`-piloted coverage, but only ever against a synthetic
    "Test Cycler" fixture, even though 7 real FIN cards were migrated to
    this exact mechanism in this very closure. `engine.test.ts` now ALSO
    has a sibling case using the real `capital-city` `CardDefinition`
    directly (shared with gap #5's own strengthening above) — activates
    its own real, plain, no-search Cycling {2} through `canActivateAbility`/
    `activateAbility`, confirming the real Hand→Graveyard discard-as-cost
    and the real `drawCard` resolution off the actual migrated card, not a
    hand-rolled lookalike.

24. **`combinator.ts`'s `SelectUpTo` had no `ctx.declaredTargets`/
    `ctx.preferTarget` consultation at all — CLOSED (2026-09-16).**
    Surfaced from TWO independent directions at once: (1) the definition
    lane's triage of the cardType-filter-sibling batch —
    `stuck-in-summoner-s-sanctum`/`sleep-magic` (both real Auras) each carry
    a genuine, load-bearing hand-authored `custom` closure that drains
    `ctx.declaredTargets` before falling back to `actions.chooseTarget` —
    the real CR 601.2c/608.2b "target locks in at cast time" reconciliation
    `card.ts`'s own (private) `resolveTargets` already implements for every
    declarative targeted `Effect` kind; and (2) the definition lane's own
    `slash-of-light` combinator migration, which found `SelectUpTo`'s
    `actions.chooseTarget(remaining)` call also dropped `ctx.preferTarget`
    entirely — a real testability/determinism regression (that card's own
    engine-piloted scenario silently started hitting YOUR OWN creature
    instead of the intended opponent's one, since `preferTarget` no longer
    did anything). `combinator.ts`'s `selectUpTo` node had NEITHER
    mechanism — it only ever called a bare `actions.chooseTarget` fresh —
    so migrating `stuck-in-summoner-s-sanctum`/`sleep-magic` as written
    would have SILENTLY REGRESSED their own real fix, and every
    combinator-authored single-target effect (this migration wave's
    `slash-of-light` included) could never be deterministically pinned to a
    specific candidate.

    Fixed BOTH in one pass with a new private `selectPool` helper in
    `combinator.ts` (mirrors `card.ts`'s `resolveTargets` algorithm exactly:
    drain `ctx.declaredTargets` first, CR 601.2c/608.2b; otherwise fall back
    to `actions.chooseTarget(remaining, ctx.preferTarget)` — duplicated, not
    imported, to avoid a genuine runtime `card.ts` <-> `combinator.ts`
    import cycle; the two files already share a type-only cycle, see
    `combinator.ts`'s own file header, but `card.ts` also calls `runProgram`
    at runtime, so a reverse runtime call back would be a real one).
    `runProgram`'s `'selectUpTo'` case now calls `selectPool` instead of a
    bare `chooseTarget` loop. This is general — every current and future
    `SelectUpTo` user gets both fixes, not just the cards that surfaced
    them. Neither `stuck-in-summoner-s-sanctum` nor `sleep-magic` is
    migrated to `kind:'program'` by this change — this only makes doing so
    SAFE for a future pass (their own `custom` closures stay as-is,
    unchanged). `slash-of-light`'s own real engine-piloted scenario now
    genuinely targets Ahriman (the opponent's creature, its original
    pre-migration intent) again — re-verified live via
    `run-scenarios.mjs --slug=slash-of-light`, not assumed; that card's own
    `scenarios.ts`/`progress.json` updated from "KNOWN GAP" to "RESOLVED."
    New tests: `combinator.test.ts`'s new "SelectUpTo consults
    ctx.declaredTargets" describe block (3 cases: a real declared target is
    honored over what a fresh `chooseTarget` pool[0] pick would have chosen
    instead; the pre-existing `chooseTarget`/`preferTarget` fallback
    behavior is unchanged when `ctx.declaredTargets` is unset; a
    stale/illegal declared target is dropped per 608.2b rather than
    replaced with a fresh pick, even if that leaves nothing selected).

    **Also fixed in the same pass: `sandworm`'s own real "then shuffle"
    bug.** Its onEnter `custom` closure ("destroy target land; its
    controller may search their library for a basic land card, put it onto
    the battlefield tapped, then shuffle") searched the library but never
    actually called `actions.shuffleLibrary` — a real, already-wired
    primitive (`move`'s own `shuffleAfter` field already uses it
    declaratively elsewhere) that this hand-authored closure simply forgot,
    even though its own `describe` string already claimed the shuffle
    happened. Fixed to call it unconditionally after the search (real
    701.19: the shuffle follows the SEARCH, not a successful find — same
    "runs regardless of `moved.length`" pattern `move`'s own
    `shuffleAfter` already establishes), not just when a land was actually
    found.

    **The rest of that same 7-item escalation queue — deliberately parked,
    each for a named reason, not built this pass:**
    - `airship-crash` ("destroy target artifact, enchantment, or creature
      with flying" — a 3-way OR with one keyword-gated branch): confirmed
      singleton — grepped the whole pool for any other `.isX() &&
      .isY()`-shaped custom closure combining a type check with
      `hasKeyword`/`hasSubtype`; `call-the-mountain-chocobo`/`the-emperor-
      of-palamecia-the-lord-master-of-hell` both looked similar at a glance
      but are a different shape (single-type-plus-subtype and a negated
      count, both already expressible without a new predicate). A real fix
      needs a genuinely new capability — a recursive boolean predicate tree
      (`FilterPredicate` today is a flat, single-condition list, no
      `{op:'or'|'and', predicates:[...]}` combinator) — for exactly one
      card. Parked: not worth the structural addition for a singleton,
      especially since a `program`-DSL migration grants no real provenance
      gain yet anyway (see below).
      **No longer a singleton (2026-09-18, FDN authoring):** `make-your-move`
      needs the IDENTICAL shape — "target artifact, enchantment, or creature
      with power 4 or greater" (a 3-way type OR with only ONE branch
      power-gated, same structural pattern as `airship-crash`'s keyword-gated
      branch, just a different per-branch predicate). Two real cards now
      genuinely need a recursive/OR-capable `FilterPredicate` — still not
      built (out of scope for this triage pass), but the "not worth it for a
      singleton" calculus above no longer holds; worth real consideration
      next time either card (or a third) is migrated off its `custom` no-op.
    - `judgment-bolt` ("...and X damage to that creature's CONTROLLER") /
      `elrond-moon-reader` ("move to zone" + a combinator-modeled
      `delayUntil`): also each confirmed singletons (grepped for
      `getController()` and `delayUntil` respectively across the whole
      pool). Both cards already work correctly today via a real, honest
      `custom` closure over already-real primitives (`dealDamage`/
      `getController`/`moveTo`/`delayUntil` all genuinely exist and are
      exercised) — neither is a correctness bug, only a "stuck on `custom`
      instead of `program`" classification. Parked for the same reason as
      `airship-crash`: singleton, no provenance gain from migrating yet.
    - `sandworm`'s own second half (library search) / `golbez-crystal-
      collector`: both fall into the already-tracked, separately-scoped
      ~15-card Library/Graveyard/Exile-`Query.source` expansion (adding
      `'library'`/`'graveyard'` as real `Query.source` values, alongside
      today's `'creaturesInPlay'`/`'permanentsInPlay'`) — a genuine future
      batch item, not new in kind, and not attempted here (its own
      dedicated pass will cover all ~15 at once, not one card at a time).
      `golbez-crystal-collector` also separately needs a "read a
      previously-bound object's own live field (its power) back into a
      later effect's amount" capability beyond just the Query.source
      widening — noted for whoever picks up that future pass, not built
      here.

    **Bigger-picture flag carried over from the coordinator, not
    independently re-litigated:** migrating a `custom` closure to
    `kind:'program'` does NOT by itself grant recognizer provenance — today
    only ONE recognizer (`sequenceExileReturn-effect-structural.ts`) reads
    combinator AST at all, and it only reads the `Sequence` shape; nothing
    reads generic `Filter`/`Each`/`Query`/`Aggregate` structure. A generic
    program-AST-reading recognizer (in progress on the recognizer lane as
    of this writing — see the new `selectUpToGainControl-effect-
    structural.ts`/`.test.ts` files) is the real prerequisite for any of
    the parked items above to pay off in provenance terms; this is the main
    reason none of the 3 singleton vocab items above were built speculatively
    this pass despite each being individually buildable.

    **Evidence-audit follow-up (2026-09-18):** this closure's own cited
    test, `combinator.test.ts`'s "SelectUpTo consults ctx.declaredTargets"
    describe block, calls `runProgram`/`selectPool` directly against a
    bare hand-built AST and pool — real, but it never touches
    `GameState`/`createEngine`/the cast-to-stack-to-resolution pipeline at
    all, so it never actually proves the CR 601.2c/608.2b fizzle behavior
    this gap is about happens for a genuinely CAST spell. `engine.test.ts`
    now has a genuine new describe block ("`combinator.ts` SelectUpTo —
    ctx.declaredTargets/preferTarget consultation — real FIN card (Slash
    of Light...)") using the real Slash of Light `CardDefinition` (the same
    real card whose own `preferTarget` regression this closure's own prose
    already cites as its second motivating case) — casts it through
    `castSpell` with a real `declaredTargets` lock, then fizzles it for
    real when that target is destroyed before resolution (confirming no
    silent retarget onto a still-legal bystander), plus a legal-baseline
    sibling case that genuinely exercises the real `AddValue`
    two-count-sum (creatures you control plus Equipment you control).

25. **No "copy a permanent, with overrides" mechanic — real, OPEN, documented
    (not built).** ~~singleton~~ **No longer a singleton (2026-09-18, FDN
    authoring) — 3 more real cards independently hit the identical CR 707
    gap, raising this from "one card, low priority" to a real, recurring
    engine primitive worth building the next time any of these 4 cards is
    picked up, not permanently deferred:**
    - `abyssal-harvester` — "Exile target creature card from a graveyard
      that was put there this turn. Create a token that's a copy of it,
      except it's a Nightmare in addition to its other types." (same
      add-a-type override shape as Ardyn below, plus a graveyard-timing
      filter and a sweep-exile of this card's own prior tokens — both
      separate, narrower gaps, not part of this one).
    - `chandra-flameshaper` — its own `+1` loyalty ability: "Create a token
      that's a copy of target creature you control, except it has haste and
      'At the beginning of the end step, sacrifice this token.'" (an
      add-a-keyword-AND-add-a-triggered-ability override, the closest of the
      3 new cards to Ardyn's own P/T-and-type override shape).
    - `homunculus-horde` — "create a token that's a copy of this creature"
      (its own triggered ability, no overrides at all — the PLAINEST real
      shape this gap could take, confirming the base "copy with no
      overrides" case is just as unbuilt as the override case).
    `ardyn-the-usurper`'s own beginning-of-combat
    trigger ("exile up to one target creature card from a graveyard...
    create a token that's a copy of that card, except it's a 5/5 black
    Demon") is a real Forge `DB$ CopyPermanent | Defined$ Remembered |
    SetPower$5 | SetToughness$5 | SetColor$Black | SetCreatureTypes$Demon` —
    genuinely "copy the exiled card's own copiable values (601.2h — name,
    other types, ABILITIES), then override P/T/color/creature-type," not
    just "make a token sharing its name." A real `state.copyPermanent
    (source, controller)` primitive already exists (copies keywords/types/
    subtypes/base P&T off a real `RealCard`) but (1) takes a `Card`, whose
    read-only interface has no `getKeywords()`/enumerable-abilities read at
    all (only `hasKeyword(single)`), so a `custom` effect can't harvest a
    chosen card's own full ability set to feed into a fresh `TokenInfo`
    even if it wanted to, and (2) there's no post-copy "override these
    specific fields" mutator on `Card` either — this pool's copy-effect
    need has never come up before Ardyn. `cards/ardyn-the-usurper/
    definition.ts`'s own `custom` closure only carries the exiled card's
    NAME onto a fresh, blank 5/5 Demon token — any keywords/triggered
    abilities the exiled creature itself had are silently dropped (an
    honest narrowing, not a bug masquerading as correct — same "a basic
    land card" -> "a land card" category of accepted approximation this
    pool already has elsewhere). No existing recognizer/vocabulary covers a
    copy-effect at ALL — `token-creation-structural.ts` only recognizes
    fixed `TOKENS`-registry creates, never a dynamic copy. Checked the FIN
    pool at the time: Ardyn was the ONLY real card needing this there — the
    3 new cards above are all FDN, not FIN, confirming this is a real,
    set-independent Magic template (CR 707 copy effects), not an FIN
    idiosyncrasy. Documented per the coordinator's own framing ("worth a new
    dated entry, not necessarily something to build") — still not built as
    of this triage pass; a real fix would need a general "copy with
    overrides" `TokenInfo`-adjacent capability plus a `Card.getKeywords()`-
    style read. With 4 real cards now on record (up from 1), this is a real
    candidate for the next available engine pass, not a permanent park.

26. **Meld (`AlternateMode:Meld`/`MeldPair`) — entirely unmodeled, real,
    OPEN, documented (not built).** `fang-fearless-l-cie` (Fang, Fearless
    l'Cie) and `vanille-cheerful-l-cie` (Vanille, Cheerful l'Cie) each
    independently meld into a THIRD card, Ragnarok, Divine Deliverance —
    confirmed via both Forge's own script and Scryfall's `all_parts`
    (Fang/Vanille both `meld_part`, Ragnarok the `meld_result`), a genuine
    3-card group, not a 2-card transforming DFC pair. No `CardDefinition`
    field represents "two independently-cast permanents consume into a
    third" at all — `backFace` is documented (and every existing user —
    Jecht/Braska's Final Aeon, Dion/Bahamut, Cecil/gap gap #25's own
    neighbor above — confirms) as ONE object transforming into its own
    SECOND face via that same object's own ability; Meld is mechanically
    different (two separate objects, each with its own independent zone
    history, replaced by a THIRD new object neither original "is" the way a
    DFC's back face "is" the same permanent). Both cards' own authors
    already made the right call independently: Fang/Vanille are each
    authored as their own standalone, fully-real, independently-castable
    cards (their own non-Meld text is fully modelable), and Ragnarok,
    Divine Deliverance itself is SKIPPED entirely rather than force-fit as
    either card's own `backFace` (which would misrepresent it as reachable
    by ONE card's own ability alone). This is now documented centrally here
    per the coordinator's own request — not independently re-discovered or
    re-argued, both cards' own `definition.ts` comments already carry the
    full reasoning; not built this pass (no clear path to a 3-object
    "consume two, create a third" primitive that would pay for itself for
    exactly one real meld pair in this pool).

27. **`grantKeywordAll` had no `'attacking-creatures'` predicate — CLOSED
    (2026-09-16).** Surfaced by the same fin/76-100 re-triage as gaps
    #25/#26 above: Cecil, Redeemed Paladin's back face ("Other attacking
    creatures gain indestructible until end of turn") was a literal no-op
    `custom` closure (`run: () => {}`), documented as blocked on "no
    keyword-grant Effect shape exists yet" — stale by the time this was
    checked, since `grantKeywordAll` itself already existed (closed for
    moogles-valor/restoration-magic/dion-bahamut/ardyn-the-usurper), just
    missing the specific `'attacking-creatures'` predicate VALUE
    `pumpAll` already has (built 2026-09-15 for Auron's Inspiration —
    `Card.isAttacking()`, real 508.1 status). Widened `grantKeywordAll.
    predicate` to `'creatures-you-control' | 'permanents-you-control' |
    'attacking-creatures'`, mirroring `pumpAll`'s own identical symmetric
    (both `ctx.you` AND `ctx.opponents`) broadcast exactly. Checked the
    pool first: Cecil is the only real card needing this predicate on
    `grantKeywordAll` specifically (`pumpAll`'s own sibling case already
    covers Auron's Inspiration). Migrated Cecil's back face off the no-op
    onto `{kind:'grantKeywordAll', predicate:'attacking-creatures',
    keyword:'Indestructible', notSelf:true, untilEndOfTurn:true}` — a real,
    mechanically-enforced effect now, not just a documented intent.

    Added the corresponding sink fact to `cecil-...-paladin/synergy.json`
    (`{to:'Battlefield', types:{has:['Creature']}, attacking:true,
    face:'back'}`, no provenance — required to clear a real
    `verify-synergy.mjs` HARD failure the new `getCreaturesInPlay` read
    introduced). No recognizer templates this specific predicate yet
    (`grantKeywordAll-effect-structural.ts` declined, as expected —
    `pumpAllAttacking-effect-structural.ts` is the closest sibling
    precedent for what a future `grantKeywordAllAttacking-effect-
    structural.ts` would look like; flagged for the recognizer lane, not
    built here). **Not re-demonstrated by Cecil's own scenario**: that
    card's `scenarios.ts` is still the OLD declarative `Scenario[]` style,
    which has no attacker-declaration support at all (`harness.ts`'s own
    doc comment) — a genuine before/after proof needs a full
    engine-piloted rewrite of that WHOLE file (mirroring
    `auron-s-inspiration`'s own identical-predicate scenario), flagged as a
    named follow-up (not attempted here — that file also carries the front
    face's life-threshold transform and the back face's Lifelink probe,
    which would need converting together, a bigger lift than this fix's
    own scope). Separately noticed while touching this card, NOT caused by
    or fixed in this pass: `progress.json`'s own 2026-09-12 note claims a
    real lifegain SOURCE fact was restored for the back face's printed
    Lifelink, but no such fact exists in `synergy.json`'s `source` array
    today (only 4 front-face facts) — a real pre-existing inconsistency,
    flagged in that card's own `progress.json.knownGaps` for whoever picks
    it up next.

28. **Spell-copy + event-keyed ("next time X happens") delayed trigger —
    entirely unmodeled, real, OPEN, documented (not built) — `ether`
    (fin/53).** Real oracle text: "{T}, Exile this artifact: Add {U}. When
    you next cast an instant or sorcery spell this turn, copy that spell.
    You may choose new targets for the copy." The mana-ability half is real
    and modeled (`kind:'addMana'`); the delayed-trigger spell-copy half is a
    genuine DOUBLE gap, both pieces checked directly (not assumed), neither
    exists anywhere in this engine:
    1. No event-keyed delayed trigger — `interfaces.ts`'s only
       delayed-trigger primitive is `delayUntil(phase, run)` (real 603.4/
       603.7, PHASE-keyed — e.g. Elrond, Moon-Reader's own "at the
       beginning of the next end step"), never a "next time ANY player
       casts an instant/sorcery this turn" event-keyed observer.
    2. No spell-copy `Effect` kind — `card.ts`'s `Effect` union has nothing
       for duplicating an object on the stack; `copyPermanent`
       (`interfaces.ts`, `CardFactory.copyCard`) only copies a PERMANENT
       already on the battlefield (Clone-style), and `kind:'counter'`'s own
       doc comment already explains why there's no stack-object model to
       copy FROM in the first place (same reason `eject`/`absolute-virtue`'s
       own "can't be countered" replacement-rule text has nothing to hook
       into either — no Counter-event/stack-object machinery exists for
       either gap to intercept).
    Both primitives would be needed TOGETHER — building either alone
    wouldn't make this ability real. Checked the whole pool for a prior
    spell-copy card: none exists, so this is a genuinely new gap, not a
    rediscovered one. Left as an honest, fully-documented gap (no Fact, no
    Effect, no `triggers` entry invented) — see `ether`'s own
    `definition.ts`/`progress.json.knownGaps` for the full writeup. Not
    attempted this pass (2026-09-16 text-coverage batch) — logged here per
    that pass's own "genuinely bigger gap, log and move on" instruction,
    not a one-off card fix.
29. ~~**No "end the turn" primitive (721.1a) — no Stack-exile mechanism, no
    mid-turn jump to Cleanup.**~~ **CLOSED (2026-09-16)** — Ultima (fin/38)'s
    own "Destroy all artifacts and creatures. End the turn." A prior pass
    (2026-09-12, this card's own migration to the unified Fact model)
    confirmed the gap and declined to build it; this pass re-derived the gap
    independently (grepped `turn.ts`/`engine.ts`/`state.ts`/`stack.ts`/
    `card.ts`'s `Actions` interface directly, not trusting the earlier note)
    and, per this task's own instruction to push hard before declining,
    checked real Forge for the actual architecture rather than assuming full
    generality was required: `forge-game/src/main/java/forge/game/ability/
    effects/EndTurnEffect.java`'s own `resolve()` performs exactly 4 real
    steps — (1) exile everything on the stack, including the resolving
    spell/ability itself (Gatherer's own real Time Stop ruling: "This
    includes Time Stop, though it will continue to resolve. It also
    includes spells and abilities that can't be countered"), (2) end combat,
    (3) check state-based actions, (4) `PhaseHandler.endTurnByEffect()` — a
    DIRECT `setPhase(PhaseType.CLEANUP); onPhaseBegin();` jump, never a walk
    through every intervening phase. This confirmed the real primitive is
    narrow and scoped, not a rebuild of turn-structure machinery: built
    `turn.ts`'s new `jumpToCleanup(state, turn, players)` (a direct
    `phaseIndex` jump to Cleanup that reuses the file's own existing,
    private `runPhaseEntryAction` — so discard-to-max-hand-size/damage-
    clear/UEOT-clear/etc. are the exact same code a natural Cleanup entry
    already runs, never duplicated), `stack.ts`'s new `Stack.exileAll()`
    (drains every remaining stack item at once, real 721.1a's own "all
    spells and abilities" half), `engine.ts`'s new `endTurn(engine)` (calls
    `exileAll`, moves each drained real card to Exile, clears
    `attackers`/`blockers`, calls the existing `checkStateBasedActions`,
    then `jumpToCleanup`), a new bare `Effect` kind `'endTurn'` (`card.ts`)
    wired through a genuinely new `Actions.endTurn` (`interfaces.ts`'s own
    ambient `endTurn(): void`, full `EndTurnEffect.java` citation in its doc
    comment), and a new `EffectContext.selfToExile` field (set by
    `applyEffect`'s own `case 'endTurn'`, read back by `engine.ts`'s
    `resolveTop` wrapper — real 721.1a's "including this card" ruling:
    additive to the pre-existing `thenExile`/Flashback check, not a
    replacement for it). `engine-trace.ts`'s `pilotActions` gained a real
    `endTurn` override (same real-vs-log-only split `queueExtraPhase`
    already established — `harness.ts`'s own flat-lifecycle path has no
    real `GameEngine`/`Stack` to act on, so its own `Actions.endTurn` stays
    a log-only `{fn:'endTurn'}` entry, same accepted scope as its
    `queueExtraPhase` fallback) that reconstructs Cleanup's own real
    discard/UEOT-removal log entries via the SAME `logAutomaticPhaseEntry`
    helper `advanceOneStep` already uses, so the trace shows genuinely-
    diffed real state, not an asserted claim.
    **Deliberately still not modeled**: a synergy Fact/vocabulary for the
    `endTurn` event itself — the forced discard/stack-exile/damage-clear are
    downside "wash" mechanics no real FIN pool card's own sink vocabulary
    wants to match against, same category `tapForMana` already established
    as deliberately unmodeled; revisit only if a real card needs it.
    **Legally unreachable for Ultima specifically, but not a gap**: the
    "exile OTHER spells/abilities still on the stack" half of `Stack
    .exileAll()` can never fire for THIS card, since Ultima is a plain
    Sorcery — CR 307.1a/117.1a only allows it to be CAST when the stack is
    already empty, and by strict LIFO resolution anything added in response
    goes ON TOP and must fully resolve before Ultima's own turn to resolve
    ever comes around, so nothing can legally be pending underneath it. The
    primitive is still built to the real, general shape a future
    instant-speed "end the turn" card (Time Stop itself, printed as an
    Instant, is the real-Magic reference case for why this matters) could
    actually exercise. See `cards/ultima/progress.json` for the full,
    dated writeup and verification results.

### FDN-surfaced gaps (2026-09-18 triage)

The `schema` agent's FDN authoring pass (150-card pool: 59 blue/41 purple/50
gray) surfaced ~34 candidate schema/engine gaps across its
`coverage-justification`/`missingSchemaFunctionality` authoring. Each below
is a genuine capacity gap the `schema` agent already documented per-card
(`functional-model/fdn-cards/<slug>/definition.ts`'s own
`missingSchemaFunctionality` field — read that for the exact clause/demand
text this entry summarizes); this section is the central-tracking triage of
that batch, not a re-derivation. Items with real recurrence or a common,
set-independent Magic template are tracked below as new numbered entries;
narrower one-off combinations stay per-card-only (no entry) — see this
section's own closing note for that list. Two items turned out to be
**false-positive gap claims** (real capability already exists) — also noted
at the end, not silently corrected in the FDN files themselves (out of this
agent's lane).

30. **Morbid ("did a creature die this turn") — real, OPEN, not built,
    5 real cards.** `BoardStateCondition` (see entry #32 below for its full
    current shape) has no "did a creature die this turn" variant at all —
    `slumbering-cerberus`, `cackling-prowler`, `needletooth-pack`,
    `wardens-of-the-cycle` (all real end-step-triggered effects gated on
    it), and `tragic-banshee` (an ETB effect with a Morbid-conditional
    magnitude bump) all independently need it. Real Forge citation: Morbid
    is `Condition$ EachTurn | Type$ CreatureDiedThisTurn`-shaped in Forge's
    own scripts (a `Count$` SVar reading a per-turn death log), tracked via
    `Game.getCardsInGame()` + a per-turn "creatures that died" set Forge
    resets at Cleanup — the same per-turn-boolean SHAPE this engine already
    uses for `flippedCoinThisTurn`/`attackedThisTurn` (gap #16), just keyed
    on ANY creature dying (not a specific player's own action).
    `slumbering-cerberus` specifically ("At the beginning of EACH end
    step...") additionally needs an EACH-player end-step trigger scope —
    `Trigger.on:'endStep'` only ever fires for the ACTIVE player's own
    permanents today (gap #3's own "Still explicitly deferred" note already
    names this half separately); the other 4 cards are all "your end step"
    only, unaffected by that second half. Real, clean, additive extension to
    already-real per-turn-tracking machinery; the highest-recurrence item in
    this whole batch.

31. **No player-decision engine — an optional choice whose OUTCOME
    conditionally gates a later effect ("if you do"), or a "lose N life
    UNLESS you pay an alternate cost."** Real, OPEN, not built, 4 real
    cards. `incinerating-blast` ("You may discard a card. If you do, draw a
    card."), `perforating-artist` ("...each opponent loses 3 life unless
    that player sacrifices a nonland permanent of their choice or discards a
    card."), `fishing-pole` ("...remove a bait counter from this Equipment.
    If you do, create a 1/1 blue Fish creature token."), and
    `curator-of-destinies` ("...separate them into a face-down pile and a
    face-up pile. An opponent chooses one of those piles...", the real
    "Fact or Fiction"-shaped pile-split/opponent-choice template) all
    independently need SOME real piece of this. **Distinct from the
    Accepted Simplifications entry above ("No AI / player decision
    process")** — that entry is about WHO decides (this engine never
    simulates AI; a caller always supplies the decision, and that stays
    correct/unchanged) — this gap is about whether the DECLARATIVE
    vocabulary can even REPRESENT a conditional branch keyed on a choice's
    outcome at all, regardless of who makes it: `chooseTarget` always takes
    the first candidate, every existing `optional` field is documentary-only
    (never actually gates a second effect), and there is no `Effect`/
    `Trigger` shape for "the affected player picks among N alternatives, and
    which one they pick changes what happens next." A real fix needs at
    least: (1) a genuine "may + if-you-do" gate (the narrowest real need —
    `incinerating-blast`/`fishing-pole`), (2) an "unless" cost-choice gate
    where the AFFECTED player (not the caster) picks among alternatives
    (`perforating-artist`), and (3) an opponent-driven pile-split/choice
    primitive (`curator-of-destinies`) — probably 3 separate, sequenced
    closures, not one primitive, but all blocked on the same root absence.
    Worth flagging as a real, likely-recurring future investment given how
    common "if you do"/"unless"/opponent-choice templating is across real
    Magic's full history, not an FDN-specific quirk.

32. **`BoardStateCondition` needs more variants — real, OPEN, not built,
    3 real cards.** Today's 3 kinds (`graveyardCountAtLeast`/
    `attackedThisTurn`/`selfCounterCountAtLeast`, confirmed directly against
    `card.ts`) don't cover: a self "lacks/has type X" gate
    (`infernal-vessel`'s own death trigger, "if it wasn't a Demon"), a
    live-board POWER threshold on the controller's own creatures
    (`courageous-goblin`'s own "while you control a creature with power 4 or
    greater"), or a live life-total comparison
    (`elenda-saint-of-dusk`'s own "As long as your life total is greater
    than your starting life total... an additional +5/+5 as long as your
    life total is at least 10 greater"). Three independent, additive new
    variants to an already-real, already-extensible closed union — cheap
    individually, grouped here because they're the same underlying
    vocabulary gap (missing condition KINDS), not three different gaps.
    (Morbid, entry #30 above, is really a 4th missing variant of this same
    union — tracked separately since its own recurrence/trigger-scope
    interaction warranted its own write-up.)

33. **No per-permanent "chosen value" memory for a runtime choice — real,
    OPEN, not built. Promoted from a FIN-only documented limitation
    (`ENGINE_GAPS.md`'s own "Static-ability audit" section, "Genuinely
    unclosable" bullet list) to central numbered tracking now that FDN hits
    it too — 4 real cards total.** FIN already had 3 real cards blocked on
    this (`cavern-of-souls`/`eclipsed-realms`'s own "choose a creature type"
    referenced by a LATER mana-ability restriction; `selfless-safewright`'s
    own "choose a creature type" referenced immediately); `banner-of-kinship`
    (FDN) is the 4th: "As this artifact enters, choose a creature type. This
    artifact enters with a fellowship counter on it for each creature you
    control of the chosen type. Creatures you control of the chosen type get
    +1/+1 for each fellowship counter on this artifact." — the chosen type
    is read TWICE more, by a counter-count computation AND a later static
    P/T grant, making this the most demanding real case yet (not just a
    remembered value, but one multiple OTHER declarative fields need to
    reference). No existing `subtype` filter (continuous grants, etc.) is
    ever anything but a fixed, authored string — there's no `RealCard` field
    for "a value chosen at resolution time, readable by this same card's
    OTHER declarative fields later." Real, general, worth a dedicated future
    pass given 4 independent real cards now depend on it.

34. **MayPlay / standing permission to cast a specific card from a non-hand
    zone — real, OPEN, not built, 2 real cards.** Distinct from gap #7's
    already-real `AlternateCost` (a FIXED replacement mana cost, paid once,
    Flashback/Jump-start shape): `zul-ashur-lich-lord`'s own "{T}: You may
    cast target Zombie creature card from your graveyard this turn" and
    `strongbox-raider`'s own "Choose one of them. Until the end of your next
    turn, you may play that card." are both a STANDING permission grant with
    the card's NORMAL mana cost (no cost replacement at all) and a
    stated deadline/duration — closer in shape to Forge's own real `MayPlay`
    SVar (a persistent "you may cast this specific object from this zone"
    flag consulted at cast-legality-check time) than to `AlternateCost`.
    `interfaces.ts`'s own `play()` only covers the library-top special
    action (gap #16, closed); no MayPlay-shaped grant exists for any other
    zone. Two independent real cards, same real gap — worth tracking
    together rather than as isolated per-card notes.

35. **Emblem mechanic (CR 701.42) — real, OPEN, not built, 1 real card so
    far; already documented (not newly discovered) as a permanent sub-gap of
    gap #13's own closure above.** `kaito-cunning-infiltrator`'s own "You get
    an emblem with 'Whenever a player casts a spell, you create a 2/1 blue
    Ninja creature token.'" needs a persistent, OWNERLESS game object that
    carries its own triggered ability — gap #13's own closure already
    documented this exact absence for The Masamune's own "...or an emblem
    you own" clause ("no emblem mechanism exists anywhere in this engine,
    documented on the field itself as a real, accepted, permanent sub-gap,
    not silently dropped"). Promoted to its own numbered entry here since
    Kaito needs the FULL emblem-creation mechanic (not just doubling an
    emblem's trigger the way Masamune's own gate would) — a real,
    reasonably well-scoped future primitive (a new object kind with no
    controller-permanent backing it, carrying one or more `Trigger`s) that
    would close both cards' own remaining sub-gaps at once. Given planeswalker
    emblems are a common, recurring Magic template across many real sets,
    likely to recur again as the FDN pool grows.

36. **CR 614.2 "if it would die this turn, exile it instead" replacement —
    real, OPEN, not built, 1 real card, but cheap given precedent.**
    `fiery-annihilation`'s own "Fiery Annihilation deals 5 damage to target
    creature... If that creature would die this turn, exile it instead."
    `state.ts` has narrow, per-keyword replacement hooks at their own real
    chokepoints for damage/lifegain/untap (`DamagePrevention`/
    `CombatDamagePrevention`/`LifegainDouble`/`CantUntap`, gaps #8/#8b/#18)
    and a genuine zone-redirect precedent already exists too — the real,
    already-closed FINALITY-counter replacement (see this file's own
    "FIN-specific mechanics closed" section, "Stun and finality counters")
    redirects a real Battlefield→Graveyard `state.move` to Exile at that
    exact chokepoint, keyed on a counter's presence rather than a granted
    keyword. This gap is the SAME shape (a `state.move` redirect at the same
    chokepoint) but keyed on a turn-scoped GRANTED condition instead of a
    persistent counter — same "narrow hook at the one real call site, not
    general 614/616 machinery" bar every prior closure in this family
    cleared. Genuinely cheap to close following the established pattern (a
    new `Keyword`, e.g. `'DeathReplacementExile'`, checked at `state.move`'s
    existing Battlefield→Graveyard branch, granted via the same
    `untilEndOfTurnKeywordGrants` expiry machinery gap #21 already built) —
    flagged as a good near-term follow-up, not a large new subsystem.

37. **Caster-side casting-TIMING permission grant ("you may cast spells as
    though they had flash") — real, OPEN, not built, 1 real card.**
    `high-fae-trickster`'s own "You may cast spells as though they had
    flash." Every existing keyword/continuous-grant mechanism
    (`continuousKeywordGrants`/`continuousPTGrants`/`continuousTypeGrants`/
    `activatedAbilityLock`) broadcasts onto PERMANENTS already on the
    battlefield — none widens WHEN a controller may cast a spell still in
    hand (real Forge: `S:Mode$ CastWithFlash | ValidCard$ Card | ValidSA$
    Spell | Caster$ You`, a static ability keyed on the CASTER, not a
    battlefield object). A genuinely new grant surface (a
    `castingPermissionGrants`-shaped field, per the card's own
    `missingSchemaFunctionality` note) — "cast spells as though they had
    flash" is a recurring real Magic template (Leyline of Anticipation,
    Vedalken Orrery, etc.), worth tracking even as a current singleton.

38. **Unbounded "any number of target creatures" primitive — real, OPEN,
    not built, 1 real card.** `divine-resilience`'s own modal "any number of
    target creatures you control gain indestructible until end of turn
    instead." Every existing targeted-effect shape (`grantKeywordTarget`,
    `selectUpTo`) either targets exactly one or up to a fixed, DECLARED
    maximum — a real 601.2c "any number" (player-chosen, unbounded, no
    authored cap) has no declarative shape at all. A common recurring real
    Magic template ("any number of target X" appears across many sets),
    worth tracking as a genuine `Effect`/`combinator.ts` vocabulary gap.

39. **Combat-role target filter ("target attacking or blocking creature") —
    real, OPEN, not built, 1 real card.** `joust-through`'s own "target
    attacking or blocking creature." `dealDamageTarget` (and every other
    targeted `Effect`) only restricts its candidate pool by `owner`/`tapped`
    — never by live 508/509 combat status (is this permanent CURRENTLY
    attacking or blocking). A common recurring real Magic template (combat
    tricks/removal keyed on attacker/blocker status), worth tracking.

40. **CR 614.12-family ETB-replacement effects targeting ANOTHER permanent —
    real, OPEN, not built, 2 real cards.** `giada-font-of-hope`'s own "Each
    other Angel you control enters with an additional +1/+1 counter on it
    for each Angel you already control" (an ETB COUNTER-COUNT replacement on
    another permanent) and `authority-of-the-consuls`'s own "Creatures your
    opponents control enter tapped" (an ETB TAPPED-STATE replacement on
    another permanent) are both the same underlying CR 614.12 shape this
    file's own closed work already excluded from automatic recognizer
    matching on `zack-fair` ("her own 'enters with a counter' is a real CR
    614.12 replacement effect the permanent-recognizer's own criteria
    excludes on purpose" — see the `Fact.provenance` section of
    `.claude/contracts/card-schema.md`) — that exclusion was scoped to
    SELF-targeting only; neither existing case nor either of these 2 new
    ones has a real closure. `Trigger.on:'otherPermanentEnters'` only
    reacts AFTER a permanent has already entered — none of these can change
    HOW MANY counters or WHETHER TAPPED the entering permanent arrives with.
    Needs a new static grant field parallel to the already-real
    `millModifierGrants`/`spellCostReductionGrants` family (broadcasting a
    replacement rule onto qualifying OTHER permanents' own ETB, not a
    reactive trigger). Both real cards independently confirm this recurs.

41. **Recipient/scope-filter vocabulary needs widening: opponent-controlled,
    and counter-presence-qualified — real, OPEN, not built, 2 real cards,
    two different fields, same underlying theme.**
    `authority-of-the-consuls`'s own "Whenever a creature an opponent
    controls enters, you gain 1 life" needs `Trigger
    .otherPermanentEntersMatch.sameController` (currently documented/
    established only for "same controller as the granting permanent," per
    that field's own doc comment) to also support "controlled by an
    OPPONENT specifically." `inspiring-paladin`'s own "During your turn,
    creatures you control with +1/+1 counters on them have first strike"
    needs `ContinuousKeywordGrant`'s recipient filter (today: subtype/self/
    Equipment-attachment only) to ALSO support "has a counter of type X on
    it" as a qualifying condition — genuinely different from Ultima, Origin
    of Oblivion's existing `CounterConditionalGrant` (gap, closed — see
    "FIN-specific mechanics closed"), which installs a rule directly onto
    ONE specific object at the moment a counter lands on it, not a BROADCAST
    grant whose recipient pool is filtered by counter presence across many
    permanents. Two different fields, both blocked on the same missing
    kind of predicate (recipient-side filtering needs to grow past a fixed
    enum) — grouped here for that reason, not because they're the same
    field. "+1/+1 counters matter" recipient filters recur constantly across
    real Magic, worth tracking even as 2 current cards.

42. **CR 603.6e linked-duration primitive ("until [this permanent] leaves
    the battlefield") — real, OPEN, not built, 1 real card, but a very
    common real-Magic template (the "O-Ring effect" — exile/removal-aura
    permanents whose own effect is undone specifically when THEY leave).**
    `banishing-light`'s own "...until Banishing Light leaves the
    battlefield." No primitive ties a zone change's own duration to a
    SEPARATE permanent's own FUTURE departure from the battlefield — only a
    flat `untilEndOfTurn` (514.2 Cleanup) duration exists anywhere in this
    engine. Given how frequently this exact template recurs across Magic's
    full printed history (Oblivion Ring, Banisher Priest, Fiend Hunter, and
    dozens more), this is a strong candidate for real investment the next
    time it's picked up, despite being a singleton in THIS batch.

43. **"Can't be countered" — real, OPEN, not built, 2 NEW real cards (this
    exact clause was already noted, in passing, inside gap #28's own prose
    above — `eject`/`absolute-virtue`'s own "can't be countered" text —
    promoted here since it now has 2 more independent real cards of its
    own).** `koma-world-eater` and `curator-of-destinies` both print "This
    spell can't be countered." No `Keyword` value or replacement-rule
    vocabulary represents this anywhere (confirmed: no `CantBeCountered`
    anywhere in `card.ts`). **Flagged as real but LOW URGENCY**: this engine
    has no Counter-a-spell mechanism or Stack-object model AT ALL (gap #28's
    own prose already explains why — "no Counter-event/stack-object
    machinery exists ... to intercept") — so there is currently nothing for
    "can't be countered" to actually protect against; closing this
    specific keyword only becomes load-bearing once/if a real counterspell
    mechanism is ever built. Worth tracking so a future counterspell-
    mechanism pass remembers to wire it in from day one, not worth building
    in isolation today.

44. **"Grant an arbitrary (non-keyword) activated ability to another
    permanent" — real, OPEN, not built, 1 real card.** `fishing-pole`'s own
    "Equipped creature has '{1}, {T}, Tap Fishing Pole: Put a bait counter
    on Fishing Pole.'" Every existing broadcast mechanism
    (`continuousKeywordGrants`/`continuousPTGrants`/`continuousTypeGrants`)
    only ever grants FIXED, closed-vocabulary keyword/P&T/type values — none
    can attach an arbitrary, ad hoc ACTIVATED ability (with its own cost and
    effect) onto a different permanent than the one printing it. A real,
    moderately common Equipment/Aura template across Magic's history. (Same
    card also needs a `Trigger.on` value for "a permanent this is attached
    to becomes untapped" — narrower, kept as a per-card note rather than its
    own entry, but flagged here since it blocks the SAME card's second
    ability.)

45. **Extra land drop per turn (+ a dig-to-battlefield Effect variant with a
    dynamic, board-counted threshold) — real, OPEN, not built, 1 real
    card.** `loot-exuberant-explorer`'s own "You may play an additional land
    on each of your turns" (no field anywhere tracks a static "extra land
    drop(s) per turn" grant) and "Look at the top six cards of your
    library... put it onto the battlefield... a creature card with mana
    value less than or equal to the number of lands you control" (`kind:
    'dig'` only ever routes a matched card to Hand or library-bottom, never
    directly to the Battlefield, and has no dynamic per-card CMC threshold
    keyed off a live board count). Two related, additive vocabulary gaps on
    one real card; "extra land drop" specifically is a common, recurring
    real Magic template (Exploration, Azusa, Lost Order of Jarkeld, etc.).

46. **Opening-hand/game-setup special action — real, OPEN, not built, 1 real
    card, but a large, recurring real-Magic cycle (Leylines).**
    `leyline-axe`'s own "If this card is in your opening hand, you may begin
    the game with it on the battlefield." No deck-building/game-setup
    special-action concept exists anywhere in this engine — there is no
    "opening hand"/game-start moment at all outside a scenario's own fixed
    starting board. The real Leyline cycle spans dozens of cards across many
    real sets using this exact template — worth tracking even as a current
    singleton, given the project's own stated goal of full-MTG-history
    coverage.

47. **Cast-vs-other-arrival history gate ("if you cast it") — real, OPEN,
    not built, 1 real card.** `nine-lives-familiar`'s own ETB counter-count
    effect gated on "if you cast it" (distinguishing CR 601 casting from any
    OTHER way the permanent could have reached the battlefield, CR 707/
    zone-change effects, etc.). No field anywhere records HOW an entering
    permanent arrived (cast vs. put onto the battlefield some other way) —
    `putCounter`/`onEnter` fire identically regardless. A recurring real
    Magic template (cast-triggers distinct from other-arrival triggers),
    worth tracking as a genuine per-permanent provenance gap, adjacent to
    (but distinct from) entry #33's "remembered chosen value" gap above —
    this is about HOW a permanent arrived, not a value someone chose.

**Deliberately left as per-card-only (no central entry) — narrow, one-off
combinations without real recurrence, not worth central-tracking clutter:**
`zimone-paradox-sculptor`'s own "double the number of each kind of counter
on up to two target creatures/artifacts" (a narrow ValueRef/enumeration
plumbing ask specific to reading-and-doubling every counter type on a bound
target); `soulstone-sanctuary`'s own animate-with-P/T-override +
"all creature types" wildcard (a cheap, narrow EXTENSION to the already-real
`animate()` primitive, not a new capability — worth a quick follow-up
whenever `soulstone-sanctuary` itself is next touched, but not central
tracking on its own); `kellan-planar-trailblazer`'s own subtype-conditional
type-change plus RUNTIME installation of a brand-new `Trigger` (a real,
genuinely complex combination of two separate capability gaps, but no
second real card needs either half yet); `quilled-greatwurm`'s own
board-wide "creature dealt combat damage → counters on itself" watch (the
OTHER half of that card's own 2-part gap, its additional-cost-from-graveyard
half is folded into gap #7's own addendum above — this combat-damage watch
half is narrow and has no second real card yet).

**Two claimed gaps turned out to be false positives — real capability
already exists, not central-tracking material, flagged back to `schema` as
a cheap fix instead:**
- `kykar-zephyr-awakener`'s own "Exile another target creature you control.
  Return that card to the battlefield... at the beginning of the next end
  step" claims "no delayed-trigger primitive exists anywhere in this
  schema." This is incorrect — `interfaces.ts`'s real `delayUntil(phase,
  run)` (603.4/603.7) is exactly this primitive, already exercised by a real
  FIN card (Elrond, Moon-Reader's own identical "at the beginning of the
  next end step" clause, via a `custom` effect calling
  `actions.delayUntil('EndOfTurn', () => ...)`). Kykar's own modal mode
  currently has a bare `effects: []` no-op instead of a `custom` closure
  mirroring Elrond's own real pattern — closeable today, no new engine work
  needed.
- `ravenous-amulet`'s own "Activate only as a sorcery." claims "No timing/
  speed-restriction field exists on a named `abilities[]` entry." This is
  also incorrect — `engine.ts`'s `canActivateAbility` already has a real,
  general (not Equipment-specific) text-pattern check,
  `/activate only as a sorcery/i.test(cost)`, enforced against ANY named
  ability's own `cost` string. Ravenous Amulet's own `drawAndSoul` ability
  cost string just doesn't currently include that literal phrase — adding
  it to the `cost` field text closes this for real, no new engine work
  needed.

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
