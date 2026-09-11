# engine agent notes

Scoped working memory for the `engine` specialist. Update before finishing
any task: decisions made, open questions, current state worth resuming
from. This is what makes a fresh respawn cheap — don't rely on transcript
resume alone (session transcripts are swept after ~30 days).

## Decisions

- **2026-09-12 (latest+47) — Weapons Vendor (fin/40) migrated to the
  unified Fact model; real precedent check settled whether "attach
  Equipment to a creature" gets its own produce fact (it doesn't, pool-
  wide, not just here).** Real oracle text: "When this creature enters,
  draw a card. / At the beginning of combat on your turn, if you control
  an Equipment, you may pay {1}. When you do, attach target Equipment you
  control to target creature you control." {3}{W} Creature — Human
  Artificer, 2/2 (all Scryfall-verified). Old synergy.json had `"source":
  []` (nothing at all — not even baseline self-cast/self-enters) and two
  old-schema (`zone`/`id`/`sourceText`/`highlight`) SINK facts. Facts now:
  baseline self-cast/self-enters (typeLine-anchored, "Creature");
  `{event:'drawCard', controller:'you', value:1}` for the ETB (same bare
  shape g-raha-tia's own migrated drawCard fact uses — no `target`); two
  re-authored SINKs, `{to:'Battlefield', controller:'you',
  types:{has:['Equipment']}}` (the "if you control an Equipment" gate) and
  `{to:'Battlefield', controller:'you', types:{has:['Creature']}}` (the
  "target creature you control" attach target) — same exact 2-sink shape
  Beatrix, Loyal General and Raubahn, Bull of Ala Mhigo already establish
  for their own real "attach Equipment to a creature" abilities (found by
  grepping the pool for existing `types:{has:['Equipment']}` sinks before
  authoring anything new, not guessed).
  **Deliberately did NOT add a SOURCE `event:'equip'` fact for the attach
  action itself, and did NOT promote `equip` off `PARKED_ACTION_FNS`** —
  the task explicitly asked to check real precedent rather than assume the
  pump/tap/animate promotion pattern transfers here. Checked three real
  cards whose own ability IS attaching Equipment (Beatrix, Raubahn) or
  whose own ETB incidentally calls `actions.equip` for real (Dragoon's
  Lance's Job-select token-then-equip) — NONE of the three declares an
  equip produce fact, despite real, achievable trace evidence being
  possible for at least two of them. This is a real, consistent, checked
  3-card precedent, not a gap nobody noticed — followed it rather than
  inventing new vocabulary unprompted. (`harness.ts`'s `loggingActions.equip`
  DOES log a real `{fn:'equip', equipment, equipmentId, target, id}` line —
  confirmed real trace evidence exists in this card's own trace.json now —
  so if a future task decides the pool-wide precedent itself is wrong and
  wants to promote `event:'equip'` for real, the machinery is already
  there; this pass just didn't unilaterally make that call.)
  **Scenario**: collapsed the old 4-scenario flat `harness.ts` `Scenario[]`
  into ONE real engine-piloted playthrough (`engine-trace.ts`): cast ->
  real ETB draw (603.6b auto-fire) -> real one-step turn passage (Main1 ->
  CombatBegin, exactly one `advanceOneStep` — turn.ts's own fixed PHASES
  order has nothing between them) -> `pilotFireTrigger(..., 'onBeginCombat')`
  fires the ability for real, attaching a real Dragoon's Lance (placed
  directly as board-state filler, not cast) to a real second creature,
  Coeurl (also filler), via `ctx.preferTarget` — NOT a trivial self-attach.
  **Two real bugs found and fixed while building this**: (1) `definition.ts`'s
  own `onEnter` trigger was missing `on:'enter'` (needed for
  `pilotResolveTop`'s real 603.6b auto-fire — same fix Cloud/Dion/Jill
  already needed); (2) the card's own `custom` `onBeginCombat` effect
  called `actions.chooseTarget(pool)` directly for BOTH the Equipment and
  creature picks, never routing `ctx.preferTarget` through either call the
  way every other declarative dispatch site in `card.ts` already does —
  fixed to pass `ctx.preferTarget` to both, letting a pilot script actually
  pin a non-default target (confirmed via the trace: `getCreaturesInPlay`
  now correctly reports `count:2` with both real creatures, and the real
  `equip` line targets Coeurl, not Weapons Vendor itself).
  **Verified**: `verify-synergy.mjs` weapons-vendor alone — 0 hard
  failures, 4 benign `tapForMana`-unrecognized soft notes (same pattern
  every real engine-piloted mana-paying card produces, e.g.
  adelbert-steiner/slash-of-light, not new). Full pool — 315 checked, 9
  hard failures, ALL pre-existing/unrelated to this card (confirmed via
  `git status` at session start: none of the 9 failing slugs is
  weapons-vendor, and none were touched this pass). `vitest run
  functional-model` — 238/238 (unchanged from baseline). Real isolated
  `find-synergies.mjs` before/after (git HEAD's old synergy.json/trace.json
  swapped in, ran, swapped back, diffed — not a stale/mixed-in-flight
  diff): **0 lost, +132 gained**, ALL of them Weapons Vendor as the
  PRODUCER side ("enters the battlefield"/"battlefield presence"/"moves to
  battlefield" — the new baseline self-cast/self-enters facts, which
  simply didn't exist before at all); confirmed separately that the SINK
  side (Weapons Vendor as consumer) is unchanged at exactly 110 matches
  before and after — the two re-authored SINK facts are a pure schema
  migration with identical real matching semantics, not a behavior change.
  Added `weapons-vendor` to `ANNOTATED_CARD_SLUGS`
  (`scripts/annotation-coverage.mjs`) — note this file had already grown
  past where an earlier read of it left off (another concurrent session
  had added ~8 more slugs in between reads), appended after the CURRENT
  tail rather than reintroducing a stale copy.
  **Open Forge-verification**: none — oracle text/mana cost/P/T
  Scryfall-confirmed directly against `data/fin/fin_scryfall.json`, no new
  `interfaces.ts` mirror needed (existing `equip`/`getAttachedTo`/
  `getEquippedBy` already cover this card's real mechanism).

- **2026-09-12 (latest+46) — Stiltzkin, Moogle Merchant (fin/34) migrated
  to the unified Fact model; `gainControl` promoted from
  `PARKED_ACTION_FNS` to real fact vocabulary; a real, LIVE cross-session
  file collision hit and worked around mid-task — flagging this last part
  prominently since it's a generalizable hazard, not a one-off.**
  Real oracle text: "Lifelink / {2}, {T}: Target opponent gains control of
  another target permanent you control. If they do, you draw a card."
  {W}, Legendary Creature — Moogle, 1/2 (added `pt:[1,2]`, missing before).
  Facts: baseline self-cast/self-enters (typeLine-anchored); NO fact for
  Lifelink (a new, explicit standing rule for this card — bare, self-only,
  no grant/broadcast — diverges from adelbert-steiner's OLDER, 2026-09-11
  precedent of giving its own bare Lifelink a `lifegain` fact; trust the
  newer, explicit instruction over the older precedent when they conflict,
  don't silently harmonize); dropped the old bare `self-graveyard`
  presence fact entirely (no real death mechanic on this card — matches
  delivery-moogle's own "no death trigger = no baseline dies/graveyard
  fact" precedent, not summon-bahamut's/dwarven-castle-guard's, which DO
  have one because they have real death consequences); `{event:'tap',
  subject:'self', target:'self'}` for the `{T}` cost (Coeurl/fin-12's
  established `isSelfTapActivationCostFact` exemption shape, reused
  verbatim); `{event:'gainControl', controller:'you', recipient:'opp',
  targeted:true}` for the real control-change (no `target` Constraints —
  no type filter on the real effect, "another target permanent" not
  "another target creature"; `subject` correctly omitted — the permanent
  varies, isn't self, same "omitted subject resolves to unknown" Gaius van
  Baelsar convention, NOT a new "another"-exclusion vocabulary need);
  `{event:'drawCard', controller:'you'}` for "If they do, you draw a
  card" — modeled as an independent real fact, NOT encoding the "if they
  do" conditional link as data (per explicit task instruction — this is
  now a real worked example of that "real intact data, don't bake
  conditionals into one mega-fact" philosophy for a genuine two-step
  causal ability, distinct from Aerith/Bahamut's own dies/damage
  precedents). Sink unchanged in shape (`zone`->`to`, unconstrained wants
  any permanent you control). Every fact `value:-1` (standing
  deprioritization rule). Scenarios consolidated to ONE real
  engine-piloted scenario (dropped the old flat `keywordScenarios(...)`
  spread too, since Lifelink/legend-rule no longer back any fact): cast
  (4 real Plains via `basicLandsFor('{3}{W}')`) -> turn passage -> real
  `{2},{T}` activation -> real `gainControl` (one of the same real Plains,
  `chooseTarget`'s documented first-candidate default) -> real `drawCard`.
  `find-synergies.mjs` diff (isolated): 241 -> 351 (+110): -24 lost (old
  graveyard-presence + lifegain facts, both intentionally removed), +134
  gained (the new baseline `self-enters` fact's real battlefield-presence
  matching — pure gain, this card had none before); zero new matches from
  `gainControl`/`drawCard` themselves (no pool card wants either event
  yet — vocabulary-only promotion, same "doesn't itself create a match"
  pattern `pump` already established).
  **`gainControl` promoted off `PARKED_ACTION_FNS`** (`producedEvents`'s
  new `case 'gainControl': return [{event:'gainControl', side:'you'}]` —
  hardcoded `'you'`, NOT derived from `entry.controller`, which names the
  RECIPIENT of the new control on the real trace line, not the doer, the
  opposite of what `side` needs to mean; same "always the scenario's own
  controller" reasoning `cast`/`playLand` already use). The underlying
  `Actions.gainControl`/`RealPlayer.gainControl` machinery was ALREADY
  real and exercised (stolen-uniform, unexpected-request,
  zidane-tantalus-thief) — this was purely a Fact-vocabulary gap. Known,
  accepted pool-wide side effect (same class `pump`/`tap`/`animate` each
  caused on THEIR promotion days): zidane-tantalus-thief's own real
  `fn:'gainControl'` action now surfaces as a soft, non-failing note
  ("no matching declared produce") — a genuine pre-existing authoring gap
  on a different card, not fixed here, out of scope.
  **Cross-session collision, the important part to carry forward**:
  `functional-model/scripts/verify-synergy.mjs` and
  `scripts/annotation-coverage.mjs` were being actively, repeatedly
  rewritten WHOLESALE by a concurrent peer session while this task was
  in progress — confirmed by re-reading the same file multiple times
  within minutes and seeing entirely different, unrelated real content
  land each time (Phoenix Down/fin-29's own exile-event promotion,
  sidequest-catch-a-fish-cooking-campsite, magitek-infantry,
  summon-primal-garuda, etc. all appearing/disappearing across snapshots),
  AND by finding a real `git stash` (`stash@{0}`, "WIP on main:
  970e163...") plus a reflog full of repeated "reset: moving to HEAD"
  entries — at one point BOTH shared files were reverted all the way past
  even today's pre-rollout baseline (no `pump`/`tap`/`animate`
  promotions, no `isSelfTapActivationCostFact` at all) before the peer's
  own further writes brought them back past where they'd been. My own
  edits to both files got silently clobbered THREE separate times over
  the course of this one task before finally landing stably — each time
  I re-applied just the small, targeted addition (the `gainControl` case
  + its `PARKED_ACTION_FNS`/`explainableFns` bookkeeping;
  `isSelfTapActivationCostFact` + its call site; this card's own
  `ANNOTATED_CARD_SLUGS` entry) rather than trying to restore anyone
  else's lost work by guessing, and re-verified immediately after each
  re-application. Confirmed landed and stable as of this task's final
  verification run (see stiltzkin-moogle-merchant's own progress.json for
  the exact re-check commands), but given the observed volatility, ANY
  future task touching these two shared files should grep for
  `gainControl`/`isSelfTapActivationCostFact`/one's own card slug before
  assuming a prior session's edit is still there. This is a real,
  generalizable "two sessions editing the same shared engine script at
  once" hazard (CLAUDE.md's own "Multiple orchestrators" section names
  this as the one real risk of the multi-session model) — not specific to
  this card, worth the orchestrator's attention on its own merits.
  Verified (at time of writing, given the above caveat): scoped
  `verify-synergy.mjs stiltzkin-moogle-merchant` 0 hard failures (3
  expected `tapForMana` soft notes); full pool 315 checked, 14 hard
  failures (none this card's); `vitest run functional-model` 237/238 (the
  1 failure is magitek-infantry's own in-flight incomplete annotations, a
  concurrent peer card, not this task's regression).

- **2026-09-12 (latest+45) — Slash of Light (fin/32) migrated to the
  unified Fact model.** Real oracle text confirmed against
  `data/fin/fin_scryfall.json` #32: `{1}{W}` Instant, "Slash of Light deals
  damage equal to the number of creatures you control plus the number of
  Equipment you control to target creature." No presence-shaped sources
  (Instant) — self-cast/self-graveyard pair mirrors fate-of-the-sun-cryst's
  own real precedent exactly (`{event:'cast',from:'Hand',target:'self'}` /
  `{to:'Graveyard',controller:'you',subject:'self'}`, both typeLine-
  anchored to "Instant"). Real damage produce:
  `{event:'damage',controller:'you',target:{types:{has:['Creature']}},
  targeted:true}` — reuses the already-real `damage` event vocabulary
  (light-of-judgment/judgment-bolt/chocobo-kick already declare it,
  pre-migration), bare "damage" label via `describeFact`'s generic event
  fallback.
  **Two-term CDA-style magnitude condition, resolved by checking Adelbert
  Steiner's real committed shape directly rather than inventing a new
  pattern**: "number of creatures you control PLUS number of Equipment you
  control" is the same category of variable-magnitude source as Steiner's
  own single-term "+1/+1 for each Equipment you control" — Steiner
  represents its ONE term with exactly ONE sink
  (`{to:'Battlefield',controller:'you',types:{has:['Equipment']}}`), so a
  two-term SUM gets TWO sinks, one per term, not a combined/new shape:
  `damage-creatures-count` (`types:{has:['Creature']}`) and
  `damage-equipment-count` (`types:{has:['Equipment']}`), each independently
  oracle-anchored to its own half of the sentence ("the number of creatures
  you control" / "the number of Equipment you control"). Kept a third sink
  from the old v1 file, `damage-target-creature`
  (`{to:'Battlefield',types:{has:['Creature']}}`, no controller) — the real
  CR 601.2c target requirement itself, same "this effect needs a real
  qualifying object other cards produce" shape fate-of-the-sun-cryst's own
  destroy-target sink already establishes.
  `annotations-authoring.json` added (6 facts: 2 typeLine-anchored, 4
  oracle-anchored), `compute-annotations.mjs` run — generated offsets
  matched an independent hand-computed check exactly. Added to
  `ANNOTATED_CARD_SLUGS`.
  `scenarios.ts` rewritten from the old harness.ts-style 2-scenario
  `Scenario[]` to ONE real engine-piloted `runEngineScenarios()` trace, per
  this session's 1-scenario-default standing rule (this card is a simple,
  non-branching Instant): you control 2 real creatures (Coeurl, Dwarven
  Castle Guard) + 1 real Equipment (White Mage's Staff), cast targeting the
  opponent's real Ahriman via `preferTarget` (a genuine CR 601.2c choice
  among legal candidates — your own creatures are also legal
  `dealDamageTarget` pool members). Real trace confirms `amount:3` (2+1)
  dealt to Ahriman.
  `compute-weights.mjs --slug=slash-of-light` run after authoring (damage
  produce bucketed to 5 for magnitude 3 per the steep 1/4/5 rule; sinks at
  neutral 1, no numeric constraint on any of them).
  **Verified**: `verify-synergy.mjs` scoped — 0 hard failures, 2 expected
  soft-note classes (4 filler-permanent `enters` lines with no self-produce
  fact, 2 `tapForMana` — both standard on every engine-piloted card with
  pre-placed board state / real mana payment). `verify-synergy.mjs` full
  pool (315 v2 cards) — 10 pre-existing hard failures, ALL unrelated to
  this task (ashe-princess-of-dalmasca, auron-s-inspiration,
  cloudbound-moogle, crystal-fragments-summon-alexander, delivery-moogle,
  dion-bahamut-s-dominant-bahamut-warden-of-light, dwarven-castle-guard,
  fate-of-the-sun-cryst, sidequest-catch-a-fish-cooking-campsite,
  ultima-origin-of-oblivion) — confirmed via `git status`: every one of
  those cards' own files is already dirty/uncommitted from earlier in this
  same session's rollout, none touched by this task; flagged for whoever
  next works that batch, not fixed here (out of scope). `vitest run
  functional-model`: 238/238 pass (unchanged). `tsc --noEmit -p
  functional-model/tsconfig.json`: 46 errors, up from the documented 45
  baseline — the one new error is `delivery-moogle/scenarios.ts(96,66)`
  (`graveyardArtifactCount` not on `PlayerState`), part of that same
  already-dirty, pre-existing, unrelated batch — zero errors reference
  slash-of-light itself.
  **Real before/after `find-synergies.mjs` diff** (git-HEAD old v1
  `synergy.json` vs. the new migrated one, whole pool): total pool-wide
  interaction line count UNCHANGED (19137 -> 19137); Slash of Light's own
  222 lines unchanged in count — the only diff is a real label fix on its
  13 self-graveyard matches ("graveyard presence" -> "moves to graveyard",
  same `to`/`from`-vs-presence rendering fix already applied pool-wide
  during the summon-bahamut migration, now also correct here since the fact
  has no `from`). Confirmed via a real pool-wide grep that zero other cards
  currently declare a sink wanting `event:'cast'` or `event:'damage'`, so
  the two new SOURCE facts add real, matchable vocabulary for a future
  payoff card without creating any match today — the zero-gain result is
  expected, not a matcher bug.
  **Open Forge-verification note**: none needed — oracle text, mana cost,
  and type line were all confirmed directly against
  `data/fin/fin_scryfall.json`, and the CDA-style "count creatures +
  Equipment" magnitude condition has a real, already-verified in-pool
  precedent (Adelbert Steiner) rather than needing a fresh Forge citation.

- **2026-09-12 (latest+44) — Snow Villiers (fin/33) migrated to the
  unified Fact model.** Real oracle text confirmed against
  `data/fin/fin_scryfall.json` #33: `{2}{W}`, Legendary Creature — Human
  Rebel Monk, `*`/3, "Vigilance\nSnow Villiers's power is equal to the
  number of creatures you control." `definition.ts` already had the right
  mana cost/type line/`pt:[0,3]`/`ptFormula:{kind:'setToCreaturesControlled'}`
  (a real layer-7a CDA, `state.ts`'s `effectivePT` — Forge's own
  `SetPower$ X | CharacteristicDefining$ True`, POWER ONLY, toughness
  stays the printed fixed 3) — pure fact-authoring, no engine/definition
  change needed.
  - **Vigilance gets no Fact** — bare printed keyword, no grant/broadcast,
    per the standing rule.
  - **CDA modeled exactly like adelbert-steiner's own `addPerEquipmentControlled`
    pairing** (checked its real committed `synergy.json` first, per this
    task's own instruction, rather than reinventing): SOURCE
    `{event:'pump', target:'self', value:-1}` (real evidence:
    `harness.ts`'s own flat-scenario runner auto-appends a real
    `read:getNetPower` line for any `ptFormula` card once self is on the
    battlefield — no scenario change needed, `verify-synergy.mjs`'s
    pre-existing `case 'read:getNetPower': return [{event:'pump', side:
    undefined}]` already covers it) paired with SINK `{to:'Battlefield',
    controller:'you', types:{has:['Creature']}, value:-1}` (wants
    creatures on the battlefield — `state.ts`'s own `effectivePT` already
    correctly counts the card's own battlefield instance too, confirmed by
    reading the real `setToCreaturesControlled` branch, matching the
    card's own scenario comment "3 (2 other creatures + self)"). Both
    oracle-anchored to the CDA's one real sentence
    (`annotations-authoring.json`): source highlight "power is equal to
    the number of creatures you control" (the mechanism), sink highlight
    "the number of creatures you control" (the counted population) —
    same narrower-source/broader-ish-sink asymmetry Steiner's own pair
    uses, just a different split since this is a `setTo`, not `addPerX`,
    formula (no separable "+N" delta to isolate).
  - **Scenario count reduced from 4 to 1** (2026-09-12 scenario-count
    standing rule): dropped `...keywordScenarios(snowVilliers)` (the
    3-creature/0-creature CDA re-probes and the legend-rule probe) —
    the kept flat scenario (`you:{creaturesCount:2}`) already demonstrates
    live recalculation (self + 2 = power 3) and, being a `ptFormula` card,
    `harness.ts`'s own flat-scenario runner already auto-logs the real
    `read:getNetPower` line off of it; no fact on this card depends on the
    dropped probes (no legend-rule-tied fact exists here, unlike Aerith).
  - **Old `self-graveyard` baseline dies/graveyard-presence fact dropped,
    not carried forward** — this session independently reached the exact
    same call the concurrent Minwu, White Mage (fin/26) migration
    documents just above/after this entry (checked adelbert-steiner and
    gaelicat first, both real siblings with the same "plain creature, no
    death text of its own" shape, both correctly omit this fact pair) —
    consistent, not a coincidence to flag twice as two separate findings.
  - **Real `find-synergies.mjs` diff, full pool, before/after (isolated
    via `git stash` scoped to just this card's own 3 touched files)** —
    raw line-diff is noisy (154 removed / 233 added) almost entirely
    because renaming the old bare-`zone` "battlefield presence" label to
    the new `to`/`event`-carrying "enters the battlefield" label changes
    every existing match's own rendered line even when the match itself
    is unchanged (same known artifact as summon-bahamut's own precedent);
    re-ran the diff as card-PAIR sets (ignoring the label string) to get
    the real signal: **-20, +103** real pairs.
    - **Lost (20, all real, all graveyard-presence)**: every pool card
      that wanted Snow Villiers' own (now-dropped) graveyard presence —
      Ardyn the Usurper, Cantankerous Keepers, Cloud of Darkness, Deadly
      Embrace, Eden Seat of the Sanctum, Elixir, Emet-Selch Unsundered,
      Evil Reawakened, Exdeath Void Warlock, Fight On!, Golbez Crystal
      Collector, Gran Pulse Ochu, Ignis Scientia, Joshua Phoenix's
      Dominant, Magic Pot, Phoenix Down, Sin Spira's Punishment, The Final
      Days, Thranduil Sindarin Liege, Vanille Cheerful l'Cie — expected,
      accepted consequence of the dropped-fact call above, not a bug.
    - **Gained (103, all real)**: Snow Villiers' new creature-presence
      SINK now matches every unconstrained-creature-presence producer in
      the pool (Adelbert Steiner, Aerith Gainsborough, Llanowar Elves,
      Craterhoof Behemoth, Tifa Lockhart, and ~98 more) — real, expected,
      the CDA's own dependency on "creatures you control" made matchable
      for the first time (previously `sink: []`, no want existed on this
      card at all before this migration).
  - **Verified**: `verify-synergy.mjs snow-villiers` — 0 hard failures,
    all 4 facts carry real annotations (`compute-annotations.mjs` ran
    clean, offsets hand-verified first). Full-pool `verify-synergy.mjs` —
    315 checked, 10 hard failures, **snow-villiers not among them**
    (all 10 are the concurrent fin/1-32 rollout's own pre-existing,
    unrelated in-flight failures — ashe-princess-of-dalmasca,
    auron-s-inspiration, cloudbound-moogle, crystal-fragments-summon-
    alexander, delivery-moogle, dion-bahamut-s-dominant-bahamut-warden-
    of-light, dwarven-castle-guard, fate-of-the-sun-cryst, g-raha-tia,
    ultima-origin-of-oblivion — not touched by this task). `vitest run
    functional-model` — 238/238 unchanged. Added `snow-villiers` to
    `scripts/annotation-coverage.mjs`'s `ANNOTATED_CARD_SLUGS`.
  - **No open Forge-verification** — `ptFormula:'setToCreaturesControlled'`
    and its Forge citation were already established by this card's own
    prior `definition.ts` pass (predates this task); this pass was pure
    Fact-authoring against already-correct, already-cited engine
    machinery, no new engine code or Forge lookup needed.

- **2026-09-12 (latest+43) — Minwu, White Mage (fin/26) migrated to the
  unified Fact model.** Real oracle text confirmed against
  `data/fin/fin_scryfall.json` #26: `{3}{W}{W}`, Legendary Creature — Human
  Cleric, 3/3, "Vigilance, lifelink\nWhenever you gain life, put a +1/+1
  counter on each Cleric you control." `definition.ts` already had the
  right mana cost/P/T/keywords/trigger — no code change needed, pure
  fact-authoring.
  - **Vigilance/Lifelink get no Fact at all**, per the "a card's own bare
    printed keyword never needs a Fact" standing rule (2026-09-12,
    documented above under the innate-keyword-reversal entry) — dropped
    the OLD pre-migration model's own `lifegain` SOURCE fact (it existed
    only to represent "this card's own lifelink produces lifegain," which
    is exactly the case that rule now excludes). Real, measured
    consequence: 2 real `find-synergies.mjs` matches lost (Minwu used to
    match Aerith Gainsborough's and Excalibur II's own lifegain-consuming
    sinks as a producer) — accepted, not a regression, since the fact
    itself was never valid under the current rule.
  - **Dropped the old `self-dies`/`self-graveyard` baseline facts too** —
    this card has no real death-related oracle text of its own to anchor
    them to (no "when Minwu dies" clause, unlike Aerith/Bahamut/Battle
    Menu, which DO have real death text). Checked precedent first: 3
    already-migrated plain creatures with no death text of their own
    (`adelbert-steiner`, `ambrosia-whiteheart`, `cloud-midgar-mercenary`)
    all correctly omit this fact pair too — this card now matches that
    convention rather than the OLD model's fabricated "generic
    creature-dies-to-graveyard fact; no additional death text on this
    card" justification, which is exactly the kind of CR-inference-only,
    no-real-anchor SOURCE fact the annotation-required rule was written to
    exclude (same reasoning `summon-bahamut`'s own deleted
    `self-battlefield`-with-Flying fact used). Real, measured consequence:
    25 real matches lost (22 "graveyard presence" + 3 "dying" — every
    real type-constrained/unconstrained Graveyard-presence sink in the
    pool that used to match Minwu's own baseline dies/graveyard fact),
    accepted for the same reason.
  - **New trigger pair, mirroring established precedent exactly**: SINK
    `{event:'lifegain', controller:'you', value:1}` is a byte-for-byte
    match of Aerith Gainsborough's own identical sink (same oracle phrase
    "Whenever you gain life," same span) — confirmed by diffing, not just
    assumed. SOURCE `{event:'putCounter', counterType:'+1/+1',
    controller:'you', target:{types:{has:['Cleric']}}, targeted:false,
    value:1}` mirrors The Crystal's Chosen's own unconditional +1/+1-to-
    all-creatures broadcast shape verbatim, narrowed to `types:{has:
    ['Cleric']}` only (not `['Creature','Cleric']`) — the oracle text says
    "each Cleric you control," not "each creature that's a Cleric," and a
    real resolved Cleric creature's static types already include both
    words either way, so the narrower constraint costs nothing and is more
    textually honest. `targeted:false` per the standing rule (unconditional
    broadcast to a bucket, no CR 601.2c choice involved). Real trace
    evidence already existed in this card's own pre-existing scenarios (the
    two `trigger:'onLifeGained'` scenarios log real `putCounter` lines) —
    no scenario changes needed.
  - **New presence SINK**, mirroring Aerith Gainsborough's own
    legendary-creature presence want: `{to:'Battlefield', controller:'you',
    types:{has:['Cleric']}, value:1}` — "needs another real Cleric on the
    battlefield to benefit from the broadcast" (Minwu itself always
    benefits from its own trigger regardless, since it's a Cleric too;
    this sink is about OTHER cards' own Cleric-typed producers being
    relevant to this card).
  - All 5 facts authored via a real `annotations-authoring.json` +
    `compute-annotations.mjs` run (not hand-computed offsets, though I
    independently hand-verified the two oracle-text spans first and they
    matched the script's own output exactly) — `self-cast`/`self-enters`
    typeLine-anchored ("Creature"/"Legendary Creature", same span choice as
    Aerith Gainsborough, the closest other real Legendary Creature
    precedent). Slug added to `ANNOTATED_CARD_SLUGS`
    (`scripts/annotation-coverage.mjs`) — noted a concurrent session added
    `'paladin-s-arms'` to the same set between my read and edit (same race
    class SYNERGY_DESIGN.md already documents for this file); both entries
    landed fine, no conflict.
  - **Real, isolated `find-synergies.mjs` diff** (temp-swapped old/new
    `synergy.json`, full pool both ways, diffed just this card's own
    interaction lines): 189 → 161 lines. Fully accounted for: 136 lines on
    each side are a pure rename ("battlefield presence" → "enters the
    battlefield", the same pre-existing `describeFact` zone-movement-name
    fix every other migrated card already benefits from, zero semantic
    change, confirmed by an exact per-label count match both sides). The
    real net change is **-27, 0 gained**: -25 (Graveyard-presence/dying
    matches lost from dropping the unanchored `self-dies`/
    `self-graveyard` baseline) and -2 (lifegain matches lost from dropping
    the bare-keyword `lifegain` SOURCE fact) — both deliberate, both
    direct consequences of applying this session's own standing rules, not
    incidental regressions. 0 gained because no other pool card yet wants
    `types:{has:['Cleric']}` or the new narrower Cleric-scoped `putCounter`
    shape — same "promotion makes vocabulary real, doesn't itself create a
    match" pattern already documented for `pump`/other promotions.
  - `verify-synergy.mjs` (scoped + full pool): 0 hard failures either way.
    Scoped run shows 3 soft notes (unclaimed `dealDamage`/`gainLife`/
    `legendRule` trace lines from the keyword-scenario/legend-rule
    scenarios) — expected and correct, these are exactly the byproducts of
    the facts deliberately NOT authored above, not something to chase.
    Full pool: 314 checked, 1 pre-existing hard failure
    (`paladin-s-arms`) — confirmed via file mtimes to be a different,
    concurrently-active session's own in-progress card, not touched by or
    related to this task. `vitest run functional-model`: 238/238. `tsc
    --noEmit` (root tsconfig): 0 errors.
  - **Open Forge-verification**: none needed — pure fact-model migration,
    no `interfaces.ts`/rules-engine behavior touched, `definition.ts`
    already correct before this task started.

- **2026-09-12 (latest+42) — Machinist's Arsenal (fin/23) migrated to the
  unified Fact model, following dragoon-s-lance's own just-updated real
  template (same Job-select ETB, same "+N/+N-and-is-a-Type in addition to
  its other types" clause shape, same Equip {4} activated ability).** 2
  legacy facts (1 source token-creation, 1 sink wants-creature-to-equip) ->
  5 (4 source, 1 sink): added baseline `self-cast`/`self-enters`
  (typeLine-anchored), converted the token-creation fact to
  `{event:'entersBattlefield', to:'Battlefield', controller:'you',
  subject:{token:'c_1_1_hero'}, value:1}`, converted the equip sink to
  `{to:'Battlefield', controller:'you', types:{has:['Creature']}}`. The
  static clause ("gets +2/+2 for each artifact you control and is an
  Artificer in addition to its other types") is now 2 real facts, reusing
  dragoon-s-lance's own vocabulary rather than staying text-only:
  `{event:'pump', target:{equippedBySelf:true}, value:-1}` and
  `{event:'grantType', type:'Artificer', target:{equippedBySelf:true},
  value:-1}`. **Deliberately NO `power`/`toughness` sub-fields on the pump
  fact** — the per-artifact-count SCALING factor is genuinely uncomputed
  (no live-recalculated CDA/layer-7c pipeline for an Equipment's static
  bonus flowing to whatever it's attached to), so this follows
  adelbert-steiner's own precedent for a scaling per-count pump
  (`{event:'pump', target:'self', value:1}`, no numeric sub-fields), NOT
  dragoon-s-lance's own FLAT +1/+0 pump (which DOES carry real
  `power:1`/`toughness:0`, since that magnitude is fixed and known) —
  checked both precedents before choosing, per the task's explicit
  instruction not to invent a richer shape unprompted. No
  `continuousKeywordGrants`/Flying entry — this card's real oracle text
  (checked fresh against fin_scryfall.json) has no flying clause at all,
  so that half of dragoon-s-lance's own migration doesn't apply here. No
  `equip` event fact added (stays on `PARKED_ACTION_FNS`, same as every
  other Equipment card).
  - `verify-synergy.mjs`: added 2 new name-scoped exemptions
    (`card.name === "Machinist's Arsenal" && p.event === 'pump'`/
    `'grantType'`) mirroring dragoon-s-lance's own exact exemption pair —
    same real documented engine gaps, zero possible trace evidence.
  - Added `'machinist-s-arsenal'` to `scripts/annotation-coverage.mjs`'s
    `ANNOTATED_CARD_SLUGS` (appended after a concurrent peer session's own
    `'gaelicat'`, no conflict).
  - New `annotations-authoring.json` (6 entries) baked via
    `compute-annotations.mjs` — output confirmed byte-identical to a
    hand-computed version checked first.
  - `scenarios.ts` left unchanged (already abstract-count-based, `you:
    {creaturesCount, artifactsCount}`, no named filler cards involved) —
    per this task's own explicit "not checking scenarios, only facts"
    instruction; no scenario polish attempted.
  - **Real `find-synergies.mjs` before/after** (isolated via a
    `synergy.json` swap + `grep -F "Machinist's Arsenal"`, not a stale
    git-HEAD diff): outgoing (as source) 12 -> 54 lines (net +42), same
    3-part breakdown dragoon-s-lance's own diff established — 12
    relabeled (bare "battlefield presence" -> "enters the battlefield"),
    12 duplicate-but-real (same 12 targets gain a second line via
    `self-enters`'s own independent Artifact-entering match), 30
    genuinely new via `self-enters`'s own real Artifact type now
    satisfying type-constrained Artifact/Equipment-aware wants pool-wide
    (Adelbert Steiner, Gaelicat, Ultima, Weapons Vendor, and 26 others).
    Incoming (X-->Machinist's Arsenal) byte-identical, 100 lines both
    times.
  - Verified: `verify-synergy.mjs` scoped (OK, 0 hard/soft) and full pool
    (314 v2 cards checked, 1 pre-existing unrelated hard failure on
    `gaelicat` from a concurrent sibling session, not touched here).
    `npx vitest run functional-model`: 238/238 (unchanged).
    `annotation-coverage.test.ts`: 5/5.
  - **Note, not caused by this task**: `machinist-s-arsenal/trace.json`
    carries an unrelated in-flight diff (new `id`/`equipmentId` fields on
    its 2 `equip` log lines) picked up mid-task from a concurrent sibling
    session's own pool-wide trace regeneration sweep (the same
    per-instance-`id` fix latest+35, above, documents) — left as-is per
    the "file changed on disk, that's usually deliberate" convention.
  - **Open Forge-verification**: none blocking — pure fact-schema
    migration onto already-correct, already-committed engine machinery
    (Job select's `createToken`+`equip` trigger, the standard Equip
    activated ability); the 2 real open items are both documentary gaps
    already flagged pool-wide (equipped-creature static grants, no
    Equipment-sourced live-recalculated count), not new discoveries.

- **2026-09-12 (latest+41) — New standing rule: scenario count defaults to
  1 per card going forward.** User's own words: "for all cards - we should
  default to one scenario (or 0 if the card is very basic). More than 1
  scenario should require a very significant reason (i.e. branching
  spells etc)." Written into SYNERGY_DESIGN.md (generalizes today's own
  repeated 1-scenario consolidations). Checked every card touched THIS
  session against it: dion-bahamut (1, fine), dwarven-castle-guard (now 1,
  fine), fate-of-the-sun-cryst (1, untouched), from-father-to-son (now 1,
  fine) — none violate it. `dragoon-s-lance` (fin/17, still 2 flat
  scenarios: ETB job-select + separate Equip activation) and
  `ardyn-the-usurper` (fin/89, 2 explicit + keywordScenarios extras) both
  still have 2+, but NEITHER had its `scenarios.ts` touched this session
  (only `definition.ts`/`synergy.json` facts were added) and both are
  already-committed, older-batch cards (not "fin/21-30 in-flight" — no
  such batch exists in SET_STATUS.md; checked) — left as-is per the
  explicit "don't force a retroactive audit" instruction. Flagging for
  whoever next touches either card for an unrelated reason: consolidate
  then, don't leave as a separate task.
- **2026-09-12 (latest+40) — From Father to Son (fin/20) consolidated to
  ONE continuous engine-piloted scenario** (hand-cast -> real search finds
  Magitek Armor -> hand -> real Graveyard move -> Flashback-cast from that
  same Graveyard -> real search finds a SECOND distinct real Vehicle
  (Cargo Ship, since the first already left the library) -> Battlefield ->
  real exile), replacing the old 2 separate scenarios, per user's live
  call. Enough combined starting lands ({5}{W}{W}{W}{W}) provided so no
  turn passage was needed between the two real casts. `review` reset to
  `ai` (authored scenarios.ts changed). verify-synergy/vitest/tsc clean.
- **2026-09-12 (latest+39) — Fate of the Sun-Cryst (fin/19): new
  `Constraints.tapped?: boolean`, real sink fact for its cost-reduction
  CONDITION (not the discount mechanism, which stays gap #7's open
  item).** User's own framing: "probably as an additional sink of
  battlefield presence (tapped creature)." Same "real, honest, NOT
  consulted by `satisfiesConstraints`" documentary-only treatment as
  `attacking`/`attachedToSelf`/`equippedBySelf` (checked: `RealCard.tapped`
  is real live state, no pipeline routes it into the matcher). Deliberately
  a NEW field, not a reuse of the existing top-level `Fact.tapped` (that
  one describes the fact's own subject entering/being tapped as part of
  the occurrence — a different meaning from "is the candidate this
  constraint filters currently tapped"). New sink: `{to:'Battlefield',
  types:{has:['Creature']}, tapped:true, value:-1}`.
- **2026-09-12 (latest+38) — Real regression fix: Dwarven Castle Guard
  (fin/18) "dies from nothing, stays on the battlefield."** Root cause:
  the 2026-09-11 consolidation's `sequence:['onDies']` shortcut only runs
  the trigger's own EFFECTS (create the Hero token), never the real
  underlying zone move dying fundamentally IS — `onDies` doesn't auto-fire
  in this engine by design (see aerith-gainsborough's own header). Rewrote
  to a real, fully engine-piloted scenario: cast -> real turn passage ->
  real BLOCKED combat against a real Coeurl (2/2, mutual lethal) -> a
  genuine `checkStateBasedActions` double destruction (both real
  `fn:'destroy'` lines) -> `onDies` fires manually only once
  `guardReal.zone === 'Graveyard'` is confirmed true -> real
  `createToken`. Verified real ORDER in the regenerated trace: destroy
  precedes trigger precedes createToken. Also audited cloudbound-moogle's
  own `sequence:['onEnter']` for the same bug class per explicit request:
  NOT affected (`onEnter` needs no additional real zone move beyond what
  the preceding real cast->enters lifecycle already provides, unlike
  `onDies`'s real LEAVE).
- **2026-09-12 (latest+37) — Dragoon's Lance (fin/17): split its 2 inert
  static clauses for real.** "During your turn, equipped creature has
  flying" is now REAL, executable — generalized gap #14's
  `continuousKeywordGrants` with a new `equippedBySelf` mode (checks the
  real, live `RealCard.attachedToId` link instead of subtype/controller;
  functionally verified: false unequipped, true equipped-on-your-turn,
  false equipped-on-opponent's-turn). New fact
  `{event:'grantKeyword', keyword:'Flying', target:{equippedBySelf:true}}`,
  evidence-exempted via a new SHAPE-scoped (not card-name-scoped)
  `isEquippedKeywordGrantFact` (this card's plain harness.ts Scenario
  style can't inject the `read:hasKeyword` line the evidence needs, same
  wall Ardyn's grants hit) — reusable for any future Equipment-broadcast
  turn-conditional grant. "+1/+0 and is a Knight" stays split into 2 real,
  honest-but-structurally-inert facts (no continuous-effect pipeline for
  an Equipment's static bonus, no dynamic type-grant-to-another-permanent
  pipeline anywhere — checked `card.ts`'s `animate` dispatch, self-only
  today): `{event:'pump', power:1, toughness:0, target:{equippedBySelf:
  true}}` and genuinely NEW vocabulary `{event:'grantType', type:'Knight',
  target:{equippedBySelf:true}}`. **Real bug found+fixed along the way**:
  `grantKeyword` — already real, LIVE pool vocabulary (Dion/Ardyn/
  haste-magic/circle-of-power) — had never gotten an explicit
  `describeFact` branch, so it rendered raw ("GrantKeyword"), same
  camelCase-display-bug class as `preventDamage`; added real branches for
  both `grantKeyword` -> "grant keyword" and the new `grantType` -> "grant
  type" (synergy.ts). Updated synergy.test.ts's own fallback example off
  `grantKeyword` (no longer unrecognized) onto `surveil`. kain-traitorous-
  dragoon/tonberry/yuna-hope-of-spira's own self-only "during your turn,
  has KEYWORD" clauses are now real, ready `continuousKeywordGrants`
  candidates too (no `equippedBySelf` needed) — flagged for a future pass,
  not swept here. ENGINE_GAPS.md gap #14 doc updated to note the
  generalization.
- **2026-09-12 (latest+36) — ENGINE_GAPS.md gap #14 closed: continuous,
  turn-conditional static keyword grants (Dion's "Dragonfire Dive," Ardyn's
  "Demons... have menace, lifelink, and haste").** New `CardDefinition.
  continuousKeywordGrants?: {keywords, includeSelf, subtype?,
  onlyDuringYourTurn?}[]` (`card.ts`), mirrors `ptFormula`'s CDA precedent
  — copied onto the live `RealCard` only at real resolve time
  (`engine.ts`'s `resolveTop`, reusing the exact spot the pre-existing
  `real.manaAbility = manaAbilityColorFromStaticText(...)` line already
  established for this "derive from CardDefinition at resolve" pattern).
  New `GameState.activePlayerId?: number` (defaults to first player added,
  synced by `engine.ts`'s `doAdvance()` every phase/turn change) +
  `isActiveOrDefault` (undefined = "yes," so a plain harness.ts Scenario
  with no turn concept still reads as your own turn) — this engine's
  first "whose turn is it" query. New `state.ts` export
  `effectiveKeywords(state, card)` — real QUERY-TIME read path (same
  "recalculated on read" shape as `effectivePT`), consumed by `wrapCard`'s
  `hasKeyword`, `dealDamage`'s Deathtouch/Lifelink checks, and
  `engine.ts`'s Haste/Defender sickness/attack-legality checks (raw
  `card.keywords.includes` reads replaced pool-wide at those 4 sites) —
  functionally real, not cosmetic. **Real bug found+fixed along the way**:
  `resolveTop` never copied `continuousKeywordGrants`/`keywords` onto a
  scenario-built `RealCard` at all — caught via Dion's own manual evidence
  query reading `false` on his own turn when it should've been `true`;
  fixed by adding the copy right after `manaAbility`'s own line (verified
  the `keywords` copy is a harmless no-op for the 6 existing engine-piloted
  scenarios that already manually pass `keywords` at `addCard` time).
  Verified real query-time correctness BOTH ways (not just "fires once"):
  a throwaway script confirmed Dion's own Flying reads `true` right after
  he resolves (his own turn), `false` after crossing into the opponent's
  turn via a real `advanceOneStep` loop.
  **New verify-synergy.mjs evidence shape**: a continuous grant never logs
  a discrete `fn:'grantKeyword'` ACTION (nothing calls `actions.
  grantKeyword` for it) — only possible evidence is a deliberate
  `{fn:'read:hasKeyword', keyword, result:true}` query (same "manual CDA
  read" pattern `adelbert-steiner`'s `read:getNetPower` line already
  established); new GENERAL (not per-card) evidence branch added for this.
  Dion's own `engine-trace.ts` pilot script can inject one (added to
  `dion-bahamut-s-dominant-.../scenarios.ts`, right after `pilotResolveTop`)
  — real front-face fact added to its `synergy.json`
  (`grantKeyword`/Flying, `target:{types:{has:['Knight']}}`, `face:'front'`
  — deliberately separate from the back face's own pre-existing Wings-of-
  Light Flying fact, different oracle text/face). Ardyn's plain
  `harness.ts` `Scenario[]` style structurally CANNOT inject a custom log
  line mid-scenario (checked: no `Scenario`/`SequenceStep` field allows
  it) — added its 3 real facts (Menace/Lifelink/Haste,
  `target:{types:{has:['Demon']}}`) anyway, matching its existing
  no-`annotations` legacy style, covered by a new narrow
  `isArdynDemonGrantFact` exemption (real fact, real mechanism, zero
  possible evidence given THIS card's own scenario style — not a deeper
  engine limitation). Checked Ardyn's own oracle text fresh: genuinely
  UNCONDITIONAL (no "during your turn"), unlike Dion's — `includeSelf:
  false` (Ardyn is "Elder Human Noble," not a Demon himself),
  no `onlyDuringYourTurn`.
  **Cross-domain gap flagged, not fixed here**: nothing logs a discrete
  action for a continuous grant, so `app/SCENARIO_REPLAY.md`'s own
  documented keyword-icon rendering (keyed off a static `cardKeywords`
  prop or a discrete `grantKeyword` log line) has no way to show a
  query-time grant turning on/off across turns in the replay UI yet —
  needs a `card`-agent change to consult `CardDefinition.
  continuousKeywordGrants` directly against the replay's own per-step turn
  state. Full reasoning: SYNERGY_DESIGN.md's own dated entry,
  ENGINE_GAPS.md gap #14.
  Verified: `verify-synergy.mjs` full pool 314 checked/0 hard failures,
  `vitest run functional-model` 238/238, `tsc --noEmit` baseline unchanged
  (45 pre-existing, unrelated).
- **2026-09-12 (latest+35) — Per-instance trace-log `id` field: real
  regression fix for uneven `putCounter`/`tap`/etc. distribution across
  same-named board instances (The Crystal's Chosen, fin/14, reported live:
  one Grizzly Bears got 2 counters, other 0; one Hero token got 4, other 3
  got 0, instead of 1 each).** Root cause: `harness.ts`'s `loggingActions`
  resolved a trace-log target purely by `name` (`putCounter`/`tap`/`pump`/
  `dealDamage`/`equip`/`animate`/`gainControl`/`destroy`/`untap`/
  `grantKeyword`/dig's own `moveTo` emission) — broken once
  `GENERIC_FILLER_CREATURE`/dynamically-created same-named tokens gave
  multiple real, DISTINCT board instances the same name; this is a
  DIFFERENT, deeper collision than latest+29's own `GENERIC_FILLER_CREATURE`
  owner-scoping fix already caught (that one only disambiguates by
  controller — SAME-owner, same-name, MULTIPLE instances, e.g. 2 Grizzly
  Bears both under "you," still collide). Fixed by adding a real, additive
  `id` field (the pre-existing `RealCard.id`/`Card.getId()` stable
  per-instance id, already used internally for `state.cards.get(id)`) to
  EVERY per-instance action log line in `harness.ts`'s `loggingActions`
  (plus `equipmentId`/`sourceId` companions for `equip`/`dealDamage`'s own
  second real-card party) — additive-only per `.claude/contracts/state-
  event-format.md`'s own non-breaking-field rule, so no consumer breaks
  before being updated. Found and fixed a SECOND, independently-missed
  site of the exact same collision class while re-verifying: `engine-
  trace.ts`'s `pilotDeclareAttackers`/`pilotDeclareBlockers` push raw
  `fn:'tap'`/`fn:'attack'`/`fn:'block'` lines with no id at all (any
  engine-piloted scenario with 2 same-named attackers/blockers would hit
  this) — added `id`/`cardId`-shaped fields there too
  (`id`/`blockerId`/`attackerId`).
  Regenerated the full pool's `trace.json` (`run-scenarios.mjs`, no
  `--slug` — fast, ~2s, confirmed idempotent, does NOT touch
  `compute-weights.mjs`'s own hand-authored weight sentinels).
  **~50 real pool cards found with same-fn+same-target-name collisions**
  (2+) via a one-off scan — `putCounter`/`tap`/`pump`/`grantKeyword`/
  `dealDamage`/`destroy`/`animate`/`untap` all affected across e.g.
  `the-crystal-s-chosen` (the reported card), `summon-esper-ramuh`,
  `bartz-and-boko`, `aerith-gainsborough`, `jill-shiva-s-dominant-...`,
  `dion-bahamut-s-dominant-...`, `crystal-fragments-summon-alexander`,
  `summon-knights-of-round`, `summon-bahamut`, `craterhoof-behemoth`, and
  more (full list in the task report to the orchestrator) — most are now
  correctly disambiguable via the new `id` field, though full user-visible
  benefit needs the consumer-side change below.
  **Re-checked Aerith Gainsborough specifically** (explicitly requested):
  her own 2 `tap` log lines are the SAME single legendary permanent tapped
  twice across two different turns (attacking twice), not 2 distinct
  instances — not actually hit by this collision class; no fix needed
  there, false positive in the original scan's own name-collision list.
  **`card`-agent handoff needed, NOT done here** (out of lane): found the
  card agent's own `app/lib/scenarioReplay.ts` already has a PARTIAL,
  earlier fix for a related but different case (`ensureForZone`/
  `ensureForTap`'s own `owner`-scoping, latest+29) — that fix does NOT
  resolve the ORIGINAL reported bug (same-owner multiple same-name
  creatures still collide, owner-scoping can't distinguish among them);
  `ensureForZone`/`ensureForTap` need to additionally consume the new
  `id` field for real per-instance disambiguation, falling back to
  name(+owner)-only when absent (older trace.json entries/no id) — flagged
  to orchestrator for `card`-agent dispatch, not implemented here (file is
  card-agent's domain).
  `.claude/contracts/state-event-format.md` updated to document the new
  additive fields.
  Verified: full-pool `verify-synergy.mjs` (314/0 hard failures),
  `vitest run functional-model` (238/238), `tsc --noEmit` baseline
  unchanged (45).
- **2026-09-11 (latest+34) — Innate printed keyword reuses `grantKeyword`
  vocabulary (Bahamut Warden of Light + summon-bahamut's own Flying);
  `dion-bahamut-s-dominant`/`crystal-fragments-summon-alexander` migrated
  to full engine-piloted single-scenario shape (mirroring `jill-shiva-s-
  dominant-shiva-warden-of-ice`, fin/58).** `{event:'grantKeyword',
  keyword:'Flying', subject:'self', target:'self'}` on both — user's own
  override of the earlier "no vocabulary for self-inherent keyword" call,
  reusing haste-magic's/circle-of-power's own GRANTED-keyword vocabulary
  for an INNATE one. New general `isInnatePrintedKeywordFact`
  verify-synergy.mjs exemption (cross-checked against real declared
  keywords, can't be gamed). Both cards: old flat multi-scenario shape ->
  1 real `runEngineScenarios()` (cast -> real ETB/equip -> real turn
  passage -> real transform activation -> Saga chapters over real turns ->
  chapter III effect -> real end state). Dion needed `on:'enter'` added to
  its own onEnter trigger for real 603.6b auto-fire. Crystal Fragments'
  real Equip {1} has NO modeled Effect at all (single activationCost slot
  reserved for the transform) — no `pilotEquip` helper exists either, used
  the same manual `state.equip()` technique adelbert-steiner's own
  scenario already established; real "Sacrifice after III" also has no
  SBA machinery (checked sba.ts, none) — matched harness.ts's own
  `sacrificeSelfAfter` mechanism by hand. Both cards' front-face self-cast/
  self-enters facts now have REAL evidence, closing their reliance on
  `isActivationCostPermanentBaselineFact` (function itself untouched,
  still needed by Coeurl). Checked every other exemption on both cards —
  `isCrystalFragmentsEquippedPumpFact`/`isSummonAlexanderDamagePrevention
  Fact` both stay (genuine structural engine gaps, unaffected by piloting).
  Full reasoning: SYNERGY_DESIGN.md's own dated entry.
- **2026-09-11 (latest+33) — Scenario consolidation via `Scenario.sequence`
  chaining a real cast onto a mid-scenario trigger fire, eliminating a
  redundant boilerplate scenario: `dwarven-castle-guard` (2->1),
  `cloudbound-moogle` (3->2).** User's live call: "either one realistic
  scenario, or 0 scenarios," no separate generic cast/enter board next to
  the real one. `harness.ts`'s `selfZone` only skips to Battlefield when a
  top-level `trigger`/`ability`/`activationCost` is set; omit all three and
  `sequence` (pre-existing, Summon: Bahamut's own Saga chapters) fires
  named triggers AFTER the real cast->enters lifecycle, same shared
  `GameState` — so ONE scenario with no top-level `trigger` +
  `sequence:['onDies']`/`['onEnter']` gets both real baseline evidence AND
  the card's own real effect evidence, no tradeoff. Checked the rest of
  fin/11-20 for the same shape — none have it, scoped to these 2 cards
  only. Full reasoning: SYNERGY_DESIGN.md's own dated entry.
- **2026-09-11 (latest+32) — Library-presence tutor-precondition sinks
  restored/added (ashe-princess-of-dalmasca, cloud-midgar-mercenary) for
  consistency with from-father-to-son/delivery-moogle's own pattern; real
  From Father to Son Vehicle-vs-Artifact type bug fixed.** Ashe's own
  sink, removed earlier the same day per direct instruction, was
  RESTORED after the user saw the fuller pattern live (real reversal, not
  relitigated). Cloud's new sink typed `Equipment` (matches its own real
  text/existing tutor fact), not generic `Artifact`. Separately: From
  Father to Son's 3 facts all wrongly used `types:{has:['Artifact']}`
  when the real text says "Vehicle card" specifically (a real, distinct
  subtype) — narrowed to `Vehicle`. find-synergies.mjs (all 3 cards): 0
  diff — no pool card sources a card INTO Library yet, so neither the
  restore/add nor the type-narrowing changed any real match today; pure
  correctness/consistency fixes. Full details: SYNERGY_DESIGN.md's own
  dated entry, each card's own progress.json.
- **2026-09-11 (latest+31) — Self-tap `{T}`-activation-cost fact,
  generalized: Coeurl (fin/12) + Dion, Bahamut's Dominant (fin/16 front),
  the only 2 fin/1-20 cards with a real `{T}` in their own activation
  cost.** `{event:'tap', subject:'self', target:'self'}` SOURCE fact, kept
  separate from Coeurl's own tap-TARGET effect fact. Direction picked by
  analogy to the pre-existing `isCostOnlyArtifactSacrificeFact` (sacrifice-
  as-cost = SOURCE), NOT Cloudbound Moogle's discard-as-cost SINK — real
  flagged inconsistency between the two, not resolved here, see
  SYNERGY_DESIGN.md's own dated entry for the full reasoning. Found+fixed
  a real separate verify-synergy.mjs bug along the way: forward SOURCE
  evidence only compares `event` names (no subject/target-shape check), so
  Coeurl's OWN tap-target effect's real `fn:'tap'` line would have
  silently, wrongly "proven" the unrelated self-tap-cost fact too — added
  a general `isSelfTapActivationCostFact` exemption (scoped by fact SHAPE,
  not card name — future `{T}`-cost cards get it for free), since
  `engine.ts`'s `activateAbility` genuinely never logs `{T}` cost payment
  at all. find-synergies.mjs: 0 diff (real zero-match gap, expected).
- **2026-09-11 (latest+30) — Cloudbound Moogle's Plainscycling gets two
  specific facts (reversal of the earlier "no fact" call), NOT generic
  TypeCycling machinery.** SINK `{event:'discard', target:'self'}` for the
  discard-as-cost act (user's literal words: "sink for discard self" —
  bare-event self-reference like `dies`/`sacrifice`, deliberately not a
  zone fact since this is the payment ACT, not a Graveyard-presence want).
  SOURCE `{to:'Hand', from:'Library', types:{has:['Plains']}}` tutor fact,
  same shape/`tutor` label as Ashe's/Cloud's own tutor facts, scoped to
  `Plains` not `Land`. Zero possible trace evidence either way
  (Plainscycling stays text-only) — two new narrow verify-synergy.mjs
  exemptions, `isCloudboundMoogleDiscardSelfWant`/
  `isCloudboundMoogleTutorFact`. find-synergies.mjs: 0 lost, +2 gained
  (tutor matches Nibelheim Aflame/The Water Crystal); discard-self sink
  stays 0-match (real gap, no other card sources a literal `discard` event
  yet). Full details: `SYNERGY_DESIGN.md`'s own dated entry,
  `cloudbound-moogle/progress.json`.
- **2026-09-11 (latest+29) — `compute-weights.mjs` real shared-tooling
  bug fixed: no per-slug scoping, an unscoped run silently overwrote the
  WHOLE pool's `Fact.value`s (hit twice in one day by concurrent migration
  agents' own hand-set values).** Added `--slug=<slug>` CLI flag, same
  flag/parsing shape as `run-scenarios.mjs`'s own `--slug=` (confirmed by
  reading that file directly, not from memory:
  `process.argv.find((a) => a.startsWith('--slug='))?.split('=')[1]`) —
  NOTE `verify-synergy.mjs` actually uses a DIFFERENT pattern, bare
  positional slug args (`process.argv.slice(2)`), not a `--slug=` flag, so
  the coordinator's "both already support this pattern" framing was
  slightly off for that file; mirrored `run-scenarios.mjs`'s literal
  `--slug=` flag shape since that's the more precise ask. Filtering the
  `slugs` array (built from `readdirSync`) down to `[onlySlug]` BEFORE the
  `entries`-building loop naturally scopes every downstream step (`pool`,
  `items`, `byEntry`, and critically the write-back `writeFileSync` loop)
  with no separate write-back-specific logic needed. Header comment now
  documents the flag and explicitly warns a bare/unscoped invocation
  touches the whole pool. Verified on `cloudbound-moogle`: scoped run
  wrote only that one file (confirmed via `git status --porcelain
  functional-model/cards` before/after, identical); computation itself is
  per-entry with no cross-card dependency, so a scoped 1-card run and an
  unscoped pool-wide run produce byte-identical output for that card by
  construction. No pool-wide run was actually executed.
- **2026-09-11 (latest+27) — Dragoon's Lance (fin/17) migrated to the
  unified Fact model, continuing the fin/1-10 rollout (this is the first
  card of a small parallel batch of Equipment cards with a real "equipped
  creature" clause, siblings dispatched to concurrent sessions — see
  below).** Real oracle text confirmed against `data/fin/fin_scryfall.json`
  (collector_number 17): "Job select (When this Equipment enters, create a
  1/1 colorless Hero creature token, then attach this to it.) / Equipped
  creature gets +1/+0 and is a Knight in addition to its other types. /
  During your turn, equipped creature has flying. / Gae Bolg — Equip {4}".
  Mana cost `{1}{W}`, type line `Artifact — Equipment` — both already
  correct in the pre-existing `definition.ts`, unchanged.
  - **4 final facts** (2 pre-existing old-shape facts converted + 2 new
    baseline facts): `self-cast` (`{event:'cast', from:'Hand', target:'self',
    value:-1}`, typeLine-anchored on "Artifact"); `self-enters`
    (`{event:'entersBattlefield', to:'Battlefield', subject:'self',
    target:'self', value:-1}`, same typeLine anchor) — **per this
    rollout's own explicit instruction, carries BOTH `subject` AND
    `target`**, unlike summon-bahamut's own `self-enters` (which is
    `target`-only — see SYNERGY_DESIGN.md's "Fact unification" section:
    that card's `self-enters` never had a `subject`-carrying sibling fact
    to merge from, so adding one there would've been "opportunistic," not a
    completion of an existing merge). Here it's a deliberate, direct
    instruction, not a merge-completeness argument, and it's real and
    load-bearing: without `subject:'self'`, a zone-shaped `self-enters`
    fact can't resolve this permanent's own real type (Artifact) for a
    TYPE-CONSTRAINED "wants Artifact/Equipment on the battlefield" sink at
    all (`factsInteract`'s zone-zone branch only ever reads `subject` via
    `resolveSubject`, never `target`) — confirmed via the required
    `find-synergies.mjs` diff below that this is exactly what it unlocks.
    The Job-select token-creation fact converted from the old bare
    `{zone:'Battlefield', subject:{token:'c_1_1_hero'}}` to
    `{event:'entersBattlefield', to:'Battlefield', controller:'you',
    subject:{token:'c_1_1_hero'}, value:1}` — same real shape
    aerith-rescue-mission's own migrated token-creation fact already
    established (checked first, used as the direct precedent); `value:1`
    kept as a real, directly-known magnitude (creates exactly one token),
    not run through `compute-weights.mjs`. The Equip-ability sink converted
    `zone`→`to` only, otherwise byte-identical.
  - **No new vocabulary invented anywhere in this migration** — every open
    question the dispatching task flagged already had a real, existing
    pool answer:
    1. **Job select's ETB token-creation vocabulary**: already established
       (aerith-rescue-mission's own migrated `entersBattlefield`-shaped
       token fact — used directly, not reinvented).
    2. **"Equipped creature gets +1/+0 and is a Knight..." / "During your
       turn, equipped creature has flying"**: checked whether a sibling
       task (crystal-fragments-summon-alexander, dispatched concurrently
       for the same "equipped creature" question) had already landed a
       convention — it had NOT (checked its live, currently-mid-edit
       `definition.ts`/`synergy.ts` diff directly; only a `pt`-fix had
       landed, no "equipped creature" target/subject shape at all). Fell
       back to the OTHER, already-committed, directly-on-point precedent
       instead: **5 sibling Equipment cards already in the pool** with an
       identical clause shape — dark-knight-s-greatsword/buster-sword/
       lion-heart/black-mage-s-rod (`"Equipped creature gets +N/+0 and is a
       [Type] in addition to its other types"`) and kain-traitorous-dragoon/
       tonberry/yuna-hope-of-spira (`"During your turn, [creature] has
       [keyword]"`) — **every one of them leaves the clause as
       `staticAbilities` text only, no Fact, no Effect**, each with its own
       comment citing the same real reason: no `Effect` kind exists
       anywhere in this model for a static bonus/type-grant/conditional-
       keyword-grant applied to WHATEVER creature is equipped (only
       self-targeted `pump`/`animate`/`grantKeywordSelf` exist — `animate`
       specifically is `ctx.self`-hardcoded in `card.ts`'s own `case
       'animate'`, no `animateTarget` variant), and no whose-turn-is-it
       tracking exists for the "during your turn" half either. Did the
       same here — text-only, documented as a real, shared, non-novel gap
       in `progress.json.knownGaps`, not modeled as a Fact. This is a
       genuinely settled, repeated pool convention, not an improvised call.
    3. **Equip {4}'s own activated-ability vocabulary**: `equip` is already
       on `verify-synergy.mjs`'s `PARKED_ACTION_FNS` pool-wide (checked) —
       no card in the corpus has ever declared an `event:'equip'` fact.
       Left it parked; the sink's own "wants a creature to attach to" is
       the only Fact-level representation of the Equip ability, matching
       every other already-migrated/unmigrated Equipment card in the pool.
  - **Real `find-synergies.mjs` before/after** (full-pool run, isolated via
    `grep -F "Dragoon's Lance"` on both sides — the rest of the pool was
    concurrently mid-edit from sibling sessions during this task, confirmed
    the "v2-authored" count was identical before/after so no unrelated
    card flipped shape mid-diff): **110 → 151 lines (net +41)**. Breaks
    down cleanly into three real, fully-accounted-for parts, no
    unexplained residue:
    - **12 relabeled, not lost**: the token-creation fact's old bare
      `zone:'Battlefield'` rendered as `battlefield presence`; adding
      `event:'entersBattlefield'` renders the SAME 12 real matches
      (Ambrosia Whiteheart, Clash of the Eikons, Dion Bahamut's Dominant,
      Doppelgang, Formidable Speaker, Omega Heartless Evolution,
      Restoration Magic, Sage's Nouliths, Squall SeeD Mercenary, Stiltzkin
      Moogle Merchant, Summon: Bahamut, The Wandering Minstrel — the pool's
      usual unconstrained-battlefield-presence set) as `enters the
      battlefield` instead — pure label change, same underlying match.
    - **24 duplicate-but-real**: those same 12 targets each gain a SECOND
      line, because the new `self-enters` fact (an Artifact entering) ALSO
      independently satisfies the same unconstrained want — two real,
      distinct in-game events (the Equipment itself entering, and the Hero
      token it creates entering) both legitimately count.
    - **29 genuinely new**: `self-enters`'s own real Artifact type,
      resolvable for the first time via its new `subject:'self'`, now
      correctly satisfies real TYPE-CONSTRAINED Artifact/Equipment-aware
      wants pool-wide — Adelbert Steiner, Ahriman, Airship Crash, Beatrix,
      Coliseum Behemoth, Edgar King of Figaro, Elixir, Elrond Moon-Reader,
      Fate of the Sun-Cryst, Gilgamesh Master-at-Arms, Golbez Crystal
      Collector, Judgment Bolt, Lunatic Pandora, Midgar City of Mako,
      Namazu Trader, Phantom Train, Raubahn, Relm's Sketching, Reno and
      Rude, Ring of the Lucii, Sidequest: Hunt the Mark, Slash of Light,
      Stolen Uniform, Suplex, The Gold Saucer, Ultima, Unexpected Request,
      Venat, Weapons Vendor. Spot-checked several sink shapes directly
      (Adelbert Steiner's `types:{has:['Equipment']}`, Ultima's
      `types:{hasAny:['Artifact','Creature']}`, Weapons Vendor's own
      `types:{has:['Equipment']}` combat-step check) — all genuine,
      type-correct, no false positives.
    - **Sink side (Dragoon's Lance as consumer) is byte-identical
      before/after**: 98 lines both times, confirmed via a direct diff of
      the `--> Dragoon's Lance` slice — the `zone`→`to` rename changed
      nothing.
    - `self-cast` produced zero matches, same as every other card's own
      `self-cast` (no pool sink wants a bare `event:'cast'` yet) — expected,
      not a regression.
  - Added `'dragoon-s-lance'` to `scripts/annotation-coverage.mjs`'s
    `ANNOTATED_CARD_SLUGS` (list had already grown with several concurrent
    sibling sessions' own slugs by the time this landed — `the-crystal-s-
    chosen`, `coeurl`, `cloudbound-moogle`, `from-father-to-son`,
    `dwarven-castle-guard`, `delivery-moogle`, `fate-of-the-sun-cryst`, and
    `dion-bahamut-s-dominant-bahamut-warden-of-light` appended after —
    added mine alongside them with a plain append, no conflict).
  - Updated `progress.json`: `lastVerified`→2026-09-11,
    `textCoverageAudited`→true, `notes` records the full migration summary,
    `knownGaps` names both real documented gaps above; `review` stays
    `"ai"` (was never `"human"`/`"reviewed"`, no reset needed).
  - Verified: `npx vitest run functional-model` → 238/238 (unchanged);
    `annotation-coverage.test.ts` → 5/5; `verify-synergy.mjs` scoped
    (dragoon-s-lance) → 0 hard failures; full pool → 314 v2 cards checked,
    1 hard failure (`dwarven-castle-guard` — a concurrent peer session's
    own in-flight card, confirmed via `git status` that only its own files
    are modified, not touched by this task, pre-existing at check time).
  - **Open Forge-verification**: none blocking — this was a pure
    fact-schema migration onto already-correct, already-committed engine
    machinery (Job select's `createToken`+`equip` trigger, the standard
    Equip activated ability), no new engine mechanics added or needed. The
    two real open items are both documentary gaps already flagged pool-wide
    (see `knownGaps` above and `ENGINE_GAPS.md`'s existing entries for
    equipped-creature static grants), not new discoveries specific to this
    card.

- **2026-09-11 (latest+26) — Coeurl (fin/12) migrated to the unified Fact
  model, continuing the fin/1-10 rollout; two new general, pool-wide
  mechanisms fell out of it, not just this one card.**
  1. **`event:'tap'` promoted off `PARKED_ACTION_FNS`** — Coeurl's own
     "{1}{W}, {T}: Tap target nonenchantment creature." is the first card
     whose own EFFECT (not just its `{T}` activation-cost payment) is a
     tap. Confirmed the cost payment itself is silent (`engine.ts`'s
     `activateAbility` calls bare `engine.state.tap`, no log line) so every
     real `fn:'tap'` trace line is genuinely the targeted effect, never
     double-counted cost. New SOURCE fact: `{event:'tap', target:
     {types:{has:['Creature'], not:['Enchantment']}}, targeted:true}`,
     oracle-anchored. Also kept a companion SINK (`{to:'Battlefield',
     types:{has:['Creature'], not:['Enchantment']}}`) mirroring Battle
     Menu's own established precedent of pairing a targeted ability's
     constraint with a "wants that type present" want, rather than relying
     on the SOURCE target constraint alone. Same documented, expected,
     large soft-note side effect as the `pump` promotion: ~20 other
     unmigrated (v1) pool cards with real tapTarget effects (tonberry,
     ice-flan, sleep-magic, elixir, ...) now surface a real, non-fatal
     "trace has tap ... no matching declared produce" note, previously
     silently parked.
  2. **New harness gap found+fixed: a permanent with its own top-level
     `activationCost` can NEVER get real cast/enters trace evidence.**
     `lifecycleBefore` (harness.ts) always takes the `card.activationCost`
     branch for such a card, unconditionally — checked fin/1-11, none of
     them have a top-level `activationCost` at all, so this never surfaced
     before Coeurl. Added a new, GENERAL exemption to `verify-synergy.mjs`,
     `isActivationCostPermanentBaselineFact` (same "known statically, no
     trace needed" class as `isStaticOnlyLand`), scoped to `subject:'self'`/
     `target:'self'` baseline `cast`/`entersBattlefield` facts on ANY
     activationCost-bearing permanent — not hardcoded to Coeurl, so the next
     migrated card with the same shape (a creature whose whole ability is
     `{X}, {T}: ...`) won't need to rediscover this.
  - Real `find-synergies.mjs` diff (isolated via a same-pool-state
    before/after swap): incoming (Coeurl as sink) unchanged 97->97, exact
    same set — the new `not:['Enchantment']` constraint excluded zero real
    matches (no producer in that set is an Enchantment Creature). Outgoing
    (Coeurl as source) 0->127: 126 new "enters the battlefield" matches via
    the new `self-enters` baseline fact (Coeurl is an ordinary unfiltered
    Creature, so it satisfies every unconstrained battlefield-presence want
    pool-wide) + 1 self-interaction (second-copy). `self-cast`/`event:'tap'`
    matched zero sinks — no pool card wants either event yet, same
    "promotes vocabulary, no match today" shape as `pump`'s own promotion.
  - Also added real `pt:[2,2]` to `definition.ts` (was silently defaulting
    to a fake 1/1, same class of gap adelbert-steiner's own definition.ts
    comment already documents).
  - Note: mid-task, a concurrent session flipped the pool-wide `value`
    sentinel convention on unquantified facts from `-1` to `1` (pump,
    destroy, dies, cast, entersBattlefield, etc. all now read `1`, only
    real-magnitude facts like `lifegain:5` keep their real number) — Coeurl
    picked this up for free since it landed while this task was in flight;
    matched, not fought (per the "file changed on disk, that's usually
    deliberate" convention) — don't re-introduce `-1` for new facts going
    forward without checking the pool's current live convention first.
  - `vitest run functional-model`: 238/238. `verify-synergy.mjs`
    (scoped+full pool): 0 hard failures from this change (2 pre-existing,
    unrelated hard failures elsewhere in the pool — fate-of-the-sun-cryst,
    from-father-to-son — both from other concurrent in-flight sessions, not
    touched, and the latter has since resolved itself).

- **2026-09-11 (latest+25) — correction to `latest+24` (Cloud's own new
  trigger-fires sinks), same day: user reversed the equipment-half scoping
  call after seeing it live, plus a naming fix.**
  1. **Renamed `event:'trigger'` → `event:'triggeredAbility'`** everywhere
     (Cloud's self-half fact, `verify-synergy.mjs`'s dedicated
     `readEvidence` branch, `SYNERGY_DESIGN.md`, this file) — user: bare
     "trigger" undersells it, this is specifically a triggered ABILITY
     firing. Picked the longer, more specific `triggeredAbility` over the
     shorter `ability` on purpose — `ability` alone would read as (or
     collide in spirit with) the already-real, DIFFERENT `event:
     'activateAbility'` (602 activated vs. 603 triggered — deliberately
     distinct real MTG concepts here).
  2. **Added back the equipment-attached half**, previously scoped out
     last round — user: "should be 2 rows... one for self, one for
     equipment." Checked `state.ts`'s own real attachment tracking first
     (`RealCard.attachedToId`/`getAttachedTo`/`getEquippedBy`) before
     inventing a shape: confirmed WHICH Equipment is attached is genuinely
     per-instance runtime state, so a bare `types:{has:['Equipment']}`
     alone would mean "any Equipment anywhere," not "the one attached
     here." Added `Constraints.attachedToSelf?: boolean` (`synergy.ts`) —
     same real/honest/NOT-consulted-by-`satisfiesConstraints` treatment as
     `attacking`. New fact: `{event:'triggeredAbility', target:
     {types:{has:['Equipment']}, attachedToSelf:true}}`, oracle-anchored.
     ZERO possible trace evidence (even further from evidence than the
     self half — would need an attached Equipment with its OWN
     independent trigger firing, not exercised anywhere) — tolerated via
     a new, narrowly-scoped `isCloudEquipmentTriggeredAbilityFact`
     exemption (same class as Auron's own pump exemption). The self-half
     `readEvidence` check was narrowed to `w.target === 'self'` only, so
     it doesn't accidentally also "prove" the equipment half.
  - Verified: both facts re-annotated (real spans, `compute-annotations
    .mjs`). `verify-synergy.mjs` scoped (Cloud) + full pool → 0 hard
    failures. `find-synergies.mjs` diff (isolated) → 0 lines gained/lost
    (both `triggeredAbility`/`attachedToSelf` are brand-new, nothing else
    in the pool matches yet). `vitest run functional-model` → 238/238.
    `tsc --noEmit` → 45 unchanged. The separate `entersBattlefield`-as-
    sink finding from `latest+24` (13 spurious matches) is UNCHANGED,
    unrelated to this correction.
  - Full writeup: `SYNERGY_DESIGN.md`'s "CORRECTION, same day, later
    still" section, right after the original `latest+24` section.

- **2026-09-11 (latest+24) — 3 brand-new event-vocabulary facts across
  Ashe/Cloud, plus a real, IMPORTANT surfaced-matcher-limitation finding
  (not silently resolved).**
  1. **Ashe, Princess of Dalmasca (fin/7)**: SINK `{event:'attacks',
     target:'self'}` — `attacks` had ZERO precedent pool-wide before this
     (checked). Real evidence, no scenario change: `pilotDeclareAttackers`
     already logs `{fn:'attack', card}`; added `producedEvents`' `case
     'attack'` (scoped `entry.card===cardName`) + `explainableFns` entry +
     `TRIGGER_EVENT_MAP.onAttack:'attacks'` (backed by this card's own
     real `onAttack` trigger firing right after). 0 new pool matches
     (expected — nothing else produces this event yet).
  2. **Cloud, Midgar Mercenary (fin/10)**: SINK `{event:'entersBattlefield',
     target:'self'}` for "When Cloud enters" — first-ever use of this
     EXISTING event string as a SINK (checked: zero precedent, only ever
     SOURCE before). Real evidence: `TRIGGER_EVENT_MAP.onEnter:
     'entersBattlefield'`, backed by this card's own real `{fn:'trigger',
     name:'onEnter'}` line.
  3. **Cloud's own Panharmonicon-style static** (ENGINE_GAPS.md gap #13):
     user's own explicit split — SOURCE (the doubling effect) SKIPPED
     ("we don't need that I think," gap #13 stays open/untouched); SINK
     ADDED but ONLY the self half ("a triggered ability of Cloud") —
     `{event:'trigger', target:'self'}`, brand-new event string (zero
     precedent). The equipment-attached half was explicitly scoped OUT by
     the user ("probably too specific"). Real evidence needed a NEW
     mechanism, not `TRIGGER_EVENT_MAP` — that dictionary maps one trigger
     NAME to one event, and `'onEnter'` already needs `'entersBattlefield'`
     for fact #2 above (can't also map it to `'trigger'` in the same plain
     object). Added a dedicated `readEvidence` branch instead:
     `allEntries.some(e => e.fn==='trigger' && e.card===cardName)` — "one
     of THIS card's own triggers fired, whichever," a per-CARD question,
     not a per-NAME one. Cloud's own real `onEnter` firing already
     satisfies it.
  - **Real, IMPORTANT finding from the required `find-synergies.mjs` diff,
    reported plainly, NOT silently fixed or reverted**: Cloud's new
    `entersBattlefield` sink does NOT self-match Cloud's own
    `entersBattlefield` SOURCE fact (that fact is zone-shaped, `to:
    'Battlefield'`; the new sink is event-shaped only — `factsInteract`'s
    own shape-family gate, `isZoneFact(p) !== isZoneFact(w)`, blocks it
    before the event branch's own same-instance logic is ever reached).
    Instead it spuriously matches **13 unrelated, still-v1-schema pool
    cards** whose own `entersBattlefield` SOURCE fact has no `target` at
    all (11 "enters tapped" lands, Elrond Moon-Reader's return-enters, The
    Gold Saucer's token-enters) — an unconstrained producer vacuously
    satisfies ANY self-referencing want per the matcher's own pre-existing
    `pe.target === undefined -> true` rule. Net effect: this sink currently
    does the OPPOSITE of what its `target:'self'` framing implies. BOTH
    halves of this are pre-existing, already-documented matcher semantics
    (not a new bug) — this is just the FIRST card to ever exercise
    `entersBattlefield` as a SINK, so it's the first time the interaction
    between these two rules has produced a visibly wrong result. Left
    as-is per this task's own scope — flagged for a real decision (accept
    as a known imprecision, same class as `Constraints.attacking`'s own
    inertness, vs. invest in a real matcher fix), not patched ad hoc.
  - Both cards' facts oracle-anchored via `compute-annotations.mjs`.
    `verify-synergy.mjs` scoped (both) + full pool → 0 hard failures.
    `vitest run functional-model` → 238/238 unchanged. `tsc --noEmit` → 45
    unchanged. New expected soft note on Ashe (`attack` action with no
    matching produce — correct, only the SINK was added, not a SOURCE).
  - Full writeup: `SYNERGY_DESIGN.md`'s "`event:'attacks'` and
    `event:'trigger'`..." section (includes the full matcher-finding
    writeup, not condensed there either).

- **2026-09-11 (latest+23) — two corrections from the user reviewing live
  Facts-tab output, both real schema/data fixes:**
  1. **Auron's Inspiration's own `pump` fact (from latest+22, below) was
     too weak** — left deliberately bare (no `target`) reasoning "no
     attacking-bucket vocabulary exists." User: that's not good enough,
     the fact must actually SAY "attacking creatures." Added a real,
     forced `Constraints.attacking?: boolean` field (`synergy.ts`) — a
     genuine per-instance COMBAT-state predicate (508.1), deliberately
     NOT added to `StaticAttrs` (no live-state pipeline reaches
     `resolveSubject`/`staticAttrsFor`, only `CardDefinition`/`TokenLike`)
     — so it's real, honest, self-documenting DATA on the fact but is
     NOT yet consulted by `satisfiesConstraints` (same "documented but
     currently inert for matching" class as `types` on an event fact).
     Auron's own fact updated to `target: {types:{has:['Creature']},
     attacking:true}` — `types:Creature` included too because
     `engine.ts`'s own `canAttack`/`declareAttackers` never actually
     enforce a Creature-type check on `GameEngine.attackers` (checked),
     so `attacking` alone doesn't structurally imply Creature-typed in
     THIS engine's data model. `controller`/`recipient` correctly stay
     unset (real text has no controller restriction — `attacking` is
     orthogonal to WHO controls it, not a reason to invent one).
     Annotation unchanged (same sentence, re-ran `compute-annotations.mjs`
     to confirm byte-identical span). Updated
     `isAuronsInspirationBroadcastPumpFact`'s own doc comment (was stale
     "generically bare" reasoning). `find-synergies.mjs` diff (isolated):
     zero change, as expected (`target`'s object-shaped Constraints on an
     event fact only feeds a match when some OTHER card's own sink sets
     `target: 'self'` or a `Constraints` object against this producer —
     none does yet, same "real vocabulary, no live payoff yet" framing as
     `event:'pump'` itself). `card-schema.md` flagged for the `card`
     agent: `app/lib/factConditions.ts`'s `constraintPhrases` doesn't
     render `attacking` (hardcoded field list) — not required, just
     noted.
  2. **Ashe, Princess of Dalmasca (fin/7), two direct instructions:**
     - Removed the `wants-artifact-in-library` SINK fact
       (`{to:'Library', controller:'you', types:{has:['Artifact']}}`)
       entirely — user: "let's remove." Confirmed via `find-synergies.mjs`
       before/after: 0 real matches lost (it never matched anything —
       already noted in this card's own progress.json).
     - Renamed the shared `ZONE_MOVEMENT_NAMES` `Library→Hand` entry from
       `'found'` to `'tutor'` — user's own direct naming call, live. This
       is the SAME table entry `latest+21`'s `describeFact` bugfix added
       (shared by Cloud, Midgar Mercenary's own identical-shaped fact) —
       renamed everywhere it's referenced: `synergy.ts` (table + doc
       comment + inline comment), `synergy.test.ts` (2 assertions),
       `SYNERGY_DESIGN.md`, this file's own `latest+21` entry above
       (corrected in place, not left stale).
  - Verified: `vitest run functional-model` → 238/238 (unchanged count,
    same tests just renamed/reworded). `tsc --noEmit` → 45 unchanged.
    `verify-synergy.mjs` scoped (auron-s-inspiration, ashe-princess-of-
    dalmasca) + full pool → 0 hard failures both times.

- **2026-09-11 (latest+22) — promoted `event:'pump'` to real, matchable
  Fact vocabulary (was in `verify-synergy.mjs`'s `PARKED_ACTION_FNS`) and
  applied it to all 4 real pump-shaped cards in fin/1-10.** User's own
  framing: "we need it, otherwise fin8 [Auron's Inspiration] pretty much
  does nothing." Deliberately GENERIC per explicit instruction — bare
  `{event:'pump', target?/controller?/targeted?, value}`, no amount/
  duration/permanence sub-vocabulary.
  - `verify-synergy.mjs`: removed `pump` from `PARKED_ACTION_FNS`; added
    `producedEvents`' `case 'pump'` (via `sideOf`, same as
    `sacrifice`/`destroy`) and `case 'read:getNetPower'` (Adelbert
    Steiner's own live-recalculated layer-7a CDA has no discrete `pump`
    ACTION to log, only this real read-line); added `pump` to
    `explainableFns`; added a narrowly-scoped
    `isAuronsInspirationBroadcastPumpFact` exemption (real fact, real
    documented engine gap — no live attacker-state reaches `card.ts`'s
    engine-agnostic surface — blocks ALL possible trace evidence, tolerated
    per the user's own explicit "add the fact anyway, documented-but-
    unverifiable" call).
  - Checked all 10 fin/1-10 cards' real oracle text for a stat-boost
    clause (not just assumed) — exactly 4 have one: Adelbert Steiner
    (fin/3, self CDA — real evidence via `read:getNetPower`), Ambrosia
    Whiteheart (fin/6, self Landfall pump — real evidence, already in its
    own trace), Auron's Inspiration (fin/8, broadcast to ALL attacking
    creatures either player controls — no `target`/`targeted` authored at
    all since no "attacking" bucket vocabulary exists to name honestly;
    zero possible trace evidence, exempted), Battle Menu (fin/9, targeted
    "Ability" mode — real evidence, already in its own `abilityMode`
    scenario). The other 6 (Bahamut, Ultima, Aerith Gainsborough, Aerith
    Rescue Mission, Ashe, Cloud) confirmed to have none — Aerith
    Gainsborough's `+1/+1` counters are `putCounter` (permanent state), NOT
    conflated with pump.
  - All 4 annotated for real via `compute-annotations.mjs` (oracle-
    anchored, real printed pump clauses, none needed a typeLine fallback).
  - Verified: `verify-synergy.mjs` scoped+full pool → 0 hard failures
    (unchanged). `find-synergies.mjs` before/after, ISOLATED to just these
    4 facts (not a stale git-HEAD diff — too much has changed today across
    concurrent sessions for HEAD to isolate cleanly; stripped just the 4
    new `pump` facts back out of the CURRENT working-tree files for a true
    before/after) → **zero interaction lines gained or lost**, expected and
    correct (confirmed: no sink anywhere in the pool wants `event:'pump'`
    yet — this promotion makes the vocabulary real for a future payoff
    card, doesn't itself create a match today). `vitest run functional-
    model` → 238/238 unchanged. `tsc --noEmit` → 45 unchanged.
  - **Known, large, EXPECTED side effect, not fixed here**: un-parking
    `pump` surfaces real `fn:'pump'` trace lines with no matching fact as
    new SOFT notes (never hard failures) on ~90 other still-v1-schema pool
    cards that already have a real wired pump effect (Craterhoof Behemoth,
    Rinoa Heartilly, Tifa Lockhart, many more) — previously silently
    parked/invisible. Same "note, not fail" treatment `drawCard`/`addMana`
    promotions already produced pool-wide. Flagged as a real future sweep
    opportunity, out of scope for this task (scoped to fin/1-10).
  - Full writeup: `SYNERGY_DESIGN.md`'s "`event:'pump'` promoted to real
    vocabulary" section.

- **2026-09-11 (latest+21) — real shared-plumbing bug fix: `synergy.ts`'s
  `describeFact` let an unnamed real SOURCE movement fall through to
  presence phrasing.** Caught live by user on Ambrosia Whiteheart's own
  `{to:'Hand', from:'Battlefield'}` bounce fact rendering "Hand presence"
  — the standing rule is "sources are only zone movements, never
  presence." Root cause: the "name via `zoneMovementName`" branch fell
  through past itself to the generic `<zone> presence` fallback whenever
  the `(from,to)` pair had no table entry, even with a real `from`
  populated. Fixed BOTH parts per the user's own ask:
  1. New named `ZONE_MOVEMENT_NAMES` entries: `{from:'Battlefield',
     to:'Hand', name:'bounce'}` (Ambrosia Whiteheart — user's own exact
     naming call) and `{from:'Library', to:'Hand', name:'tutor'}` (RENAMED
     from an original 'found' per the user's own later live-review call on
     fin/7 — see `latest+23` below; shared
     by Cloud, Midgar Mercenary's real full-library search AND Ashe,
     Princess of Dalmasca's real top-5 dig — genuinely different real
     mechanisms per each card's own oracle text, but the table only keys
     on `(from,to)` so one honest non-overclaiming word covers both).
  2. Structural fix (not per-pair patching): inside the existing
     `fact.role==='source' && (to||from populated)` gate, an unnamed pair
     now returns a generic `"moves to X (from Y)"` phrase directly instead
     of falling through — holds for any future unnamed pair too.
  - Fixed the one `synergy.test.ts` test that had codified the bug
    (asserted `'graveyard presence'` for an unnamed real movement —
    rewritten to the corrected `'moves to graveyard (from hand)'`), added
    2 new tests for `bounce`/`tutor` (originally `found`, renamed — see
    `latest+23` below).
  - Verified pool-wide (not just the 3 named cards): scratch-checked all
    18 real `from`-populated SOURCE facts across the whole pool — zero
    presence-style labels. One incidental correctness win outside scope:
    `battle-menu`'s own `{to:'Graveyard', subject:'self'}` (no `from`, an
    any-origin self-graveyard baseline) used to render "graveyard
    presence" (itself a real standing-rule violation) and now correctly
    renders "moves to graveyard" — same fix, not a separate patch.
  - `vitest run functional-model` → 238/238 (was 236). `tsc --noEmit`
    unchanged (45 pre-existing baseline errors). `verify-synergy.mjs`
    unaffected — pure rendering-layer fix, not read by any matching code.
  - Full writeup: `SYNERGY_DESIGN.md`'s "Real bug, shared plumbing:
    `describeFact`..." section (added right before the Ultima section
    below, same day).

- **2026-09-11 (latest+20) — real gap fix: `cards/ultima-origin-of-oblivion`
  (fin/2)'s third oracle-text ability ("Whenever you tap a land for {C},
  add an additional {C}.") had ZERO facts and ZERO engine wiring — not
  just a fact-authoring gap, confirmed end-to-end (`definition.ts` had it
  as pure descriptive text, no `Trigger`; `scenarios.ts` exercised nothing
  related; its own result string said so explicitly).**
  - `definition.ts`: added a real, named, MANUALLY-fired `onTapLandForC`
    trigger — `{kind:'addMana', color:'C', amount:1}` — same already-real
    `addMana` Effect shape Elvish Archdruid's own activated mana ability
    uses. No auto-fire hook for "a land was tapped" exists anywhere in this
    engine (`Trigger.on` only ever recognizes
    `'enter'|'upkeep'|'endStep'`) — manual firing is the pool-wide-dominant
    convention (same as this exact card's own pre-existing `onAttack`),
    not a compromise unique to this card.
  - `scenarios.ts`: pilots a REAL land tap for {C} using a real, already-
    in-project FIN card (Adventurer's Inn — its own and ONLY static
    ability is exactly "{T}: Add {C}.", cleanest fit among the pool's
    several {C}-lands) via a throwaway, scenario-LOCAL `CardDefinition`
    pairing that one real printed line with `activationCost`/`effects`
    (`activateAbility`'s own permanent/card decoupling) — scoped to this
    file only, `adventurer-s-inn/definition.ts` untouched. Real
    `pilotActivate`+`pilotResolveTop` (land's own {C}) then
    `pilotFireTrigger(..., 'onTapLandForC')` (Ultima's additional {C}) —
    two real, distinct `addMana` trace lines.
  - `synergy.json`: 2 new real facts (SOURCE `{event:'addMana',
    colors:{has:['C']}, controller:'you'}`; SINK same shape +
    `types:{has:['Land']}`) plus, per a same-day follow-up ask, a
    `self-cast` baseline fact (`{event:'cast', from:'Hand', target:'self'}`,
    typeLine-anchored — checked `definition.ts` for an alternate-cost
    wrinkle first, found none, `{5}` plain, same as Bahamut's own
    `self-cast`). **Flagged explicitly in SYNERGY_DESIGN.md**: the SINK's
    own `types:{has:['Land']}` is honest documentation but currently INERT
    for matching (`factsInteract`'s event-to-event branch never reads
    `types` on either side) — this causes one real, acknowledged-imprecise
    self-match (Ultima's own addMana source satisfies its own addMana
    sink, since the matcher can't tell Ultima itself isn't a land). Not
    patched ad hoc — filed under the same "future full matcher
    unification" bucket the `Fact` merge's own caveat already opened.
  - `verify-synergy.mjs`: added `TRIGGER_EVENT_MAP.onTapLandForC:
    'addMana'` — first entry mapping a NAMED trigger to the `addMana`
    shape (every other pool-wide `addMana` fact is the plain unrestricted
    "{T}: Add X." static-text shape already exempted from evidence
    entirely via `staticManaColorsFor`; this is the first card whose
    `addMana` fact sits behind a real triggered ability instead).
  - Verified for real: `verify-synergy ultima-origin-of-oblivion` → 0 hard
    failures (pre-existing soft notes for `tapForMana`/`enters`/`drawCard`/
    `attack` unchanged, confirmed identical against the git-HEAD baseline
    via temp file-swap); full-pool `verify-synergy.mjs` → same 1
    pre-existing hard failure as HEAD (`auron-s-inspiration`, unrelated,
    confirmed via `git stash`); `vitest run functional-model` → 236/236;
    `tsc --noEmit -p functional-model/tsconfig.json` → same 45 pre-existing
    baseline errors as HEAD (none of them touch this card's files).
  - **Interactions diff** (`find-synergies.mjs`, full pool, before =
    git-HEAD's old-schema 2-fact version): **+2 lines, 0 lost** — `The
    Gold Saucer --[mana production]--> Ultima, Origin of Oblivion` (real:
    Gold Saucer is the ONLY other pool card whose plain "{T}: Add {C}."
    text was ever turned into a real fact — Eden Seat of the Sanctum/
    Capital City/Starting Town/Adventurer's Inn's identical text never got
    one authored, a separate pre-existing pool-wide gap on THOSE cards,
    untouched here) and the self-match noted above.
  - **Open item, not done**: the pre-existing pool-wide gap where several
    real {C}-producing Town lands (Eden Seat of the Sanctum, Capital City,
    Starting Town, Adventurer's Inn) have NO `addMana` fact authored at
    all for their own plain "{T}: Add {C}." text, unlike The Gold Saucer —
    worth a `prefill-mana-facts.mjs`-style pool sweep some day, explicitly
    out of scope for this single-card task.

- **2026-09-11 (latest+19) — DOC ONLY, no data/code touched: `Fact.value`
  accuracy is a known, deliberately DEPRIORITIZED non-priority, per
  explicit user call.** Stale/imprecise `value`s on already-migrated
  facts (`destroy-nonland`, the merged `dies` fact on summon-bahamut —
  left behind by the Aerith Gainsborough migration below and this
  session's own ZoneFact/EventFact merge) are accepted as-is. User's own
  words: "value we don't care for now (everything should be -1), we
  don't also care how it's being processed, write it down." Did NOT run
  `compute-weights.mjs` on anything, did NOT touch any `synergy.json`.
  Documented in `SYNERGY_DESIGN.md`'s fact-model section (new bullet
  right after the `-1` sentinel one, before "## Tokens") so a future task
  treats this as already-known/already-accepted rather than
  rediscovering it as a fresh bug or unilaterally scoping a recompute.
  **If a future task ever DOES want real `value` accuracy work, that's a
  new, explicit ask — this note doesn't block it, it just prevents
  redundant rediscovery.** Verified trivially (doc-only, no data risk):
  `npx vitest run functional-model` → 234/234 unchanged, no syntax issue
  in the doc edit.

- **2026-09-11 (latest+18) — migrated `cards/aerith-gainsborough` (fin/4) to
  the Fact-unification/annotations model, second card after summon-bahamut
  (own migration ran concurrently with — and independently confirmed
  no collateral with — other in-flight sessions' own migrations of
  adelbert-steiner/aerith-rescue-mission/ultima-origin-of-oblivion, visible
  as pre-existing `M`/`??` in git status at task start, NOT touched by
  this task). Found and fixed TWO real shared-plumbing bugs along the way
  (both in the same "Fact unification broke an old mutual-exclusivity
  assumption" class as the earlier `effectiveController`/`factsInteract`
  bugs from Bahamut's own migration) — flagged clearly, fixed minimally,
  per this task's own explicit allowance.
  - **Per-fact migration** (`cards/aerith-gainsborough/synergy.json` +
    new `annotations-authoring.json`, mirrors `summon-bahamut`'s own split):
    - `self-battlefield` (bare presence `zone:'Battlefield'`, sourceText
      admitted "no special ability text") — presence-shaped SOURCE fact,
      forbidden under the current model. NOT deleted (unlike Bahamut's own
      `self-battlefield`, which had an ungrounded Flying claim) — re-cast as
      a real transition: `{event:'entersBattlefield', to:'Battlefield',
      controller:'you', subject:'self', target:'self', value:-1}`,
      typeLine-anchored (highlight "Legendary Creature", the printed
      supertype+type before the em dash — same pattern as Bahamut's own
      `self-enters`). Kept BOTH `subject` (for zone-shaped type-constrained
      matching) AND `target` (for event-family self-reference) per the
      "don't silently drop a field the original fact already had" lesson
      from Bahamut's own `subject`-drop bug.
    - `self-graveyard` (bare presence `zone:'Graveyard'`, sourceText also a
      pure gloss, "no special ability text") — merged into ONE unified fact
      carrying real from/to AND an event name, same pattern as Bahamut's own
      `self-graveyard`/`self-dies` merge (except Aerith never had a separate
      EventFact half to merge FROM — this is a single fact gaining an
      `event` key, not a two-fact merge): `{event:'dies',
      from:'Battlefield', to:'Graveyard', controller:'you', subject:'self',
      target:'self', value:1}`. RE-ANCHORED to real oracle text (not
      type line) — the card's own dies-trigger sentence ("When Aerith
      Gainsborough dies...") is real printed text asserting this creature
      can die, a legitimate non-fabricated anchor for the SOURCE producer
      claim (same span the sink `wants-self-dies` also points at).
    - `lifelink`, `lifegain-counter-produce` — unchanged shape/values, just
      annotations added (real, pre-existing `sourceText`/`highlight` moved
      to the authoring file, verbatim).
    - `dies-counter-spread` — unchanged shape, gained `targeted:false`
      (oracle: "each legendary creature you control" — broadcast, no
      choice, same reasoning as Bahamut's `chapter-iv-damage`).
    - All 4 SINK facts (`wants-lifegain`, `wants-self-dies`,
      `wants-own-counters`, `wants-legendary-creatures`) — kept
      simple/functional per the SINK exemption (no `targeted`, no
      from/to on the event-shaped ones); `wants-legendary-creatures`'s
      `zone:'Battlefield'` renamed to `to:'Battlefield'` (the "every NEW/
      touched fact should use `to`" convention). All 4 gained real
      annotations, cleaned up to anchor on the FULL real oracle line 2
      (dropping a fabricated "..." ellipsis prefix a couple of the old
      `sourceText`s had — not a genuine verbatim substring, replaced with
      the real full sentence + a real substring highlight).
    - `Fact.id` stayed gone (never reintroduced); no per-card `check.ts`
      needed (vocabulary sufficed).
  - **Bug #1 (found, fixed): `scripts/compute-weights.mjs`'s
    `sourceMagnitude` checked zone-shape (`'to' in fact || 'from' in
    fact`) BEFORE checking `event`, so a merged `{event:'dies', to, from}`
    fact always short-circuited to the flat zone magnitude (1) and NEVER
    reached the `event === 'dies'` branch (which counts real
    destroy/sacrifice occurrences) — silently wrong for EVERY merged `dies`
    fact pool-wide since the 2026-09-11 Fact-unification pass, not just a
    hypothetical: confirmed via grep this ALREADY affected
    `adelbert-steiner`'s and `summon-bahamut`'s own merged `dies` facts too
    (both un-recomputed since their own merge, so the wrong-vs-right values
    hadn't surfaced yet). Fixed by reordering: event-specific magnitude
    branches now checked first, zone/token-count branch is the fallback —
    verified this doesn't change behavior for `aerith-rescue-mission`'s own
    real `event:'entersBattlefield'`+token-subject fact (entersBattlefield
    isn't one of the magnitude-bearing event names, so it still falls
    through to the same token-count branch as before). **Did NOT run
    `compute-weights.mjs` pool-wide to apply this fix** (explicit prior
    caution in this same notes file, latest+ "2026-09-11: do not run
    compute-weights.mjs bulk across the whole corpus casually again" —
    still holds, doubly so mid-migration with other sessions' concurrent
    edits in flight) — hand-verified aerith's own 3 shape-changed facts'
    values against the FIXED formula instead (`self-enters`: `-1`
    placeholder per the Bahamut precedent for a no-magnitude-concept event;
    merged `dies`: `1`, hand-checked against `trace.json`'s own single real
    `destroy` log entry). **Open follow-up, not done here**: Bahamut's own
    `destroy-nonland` (currently stale `value:4`) and adelbert-steiner's own
    merged `dies` fact both have now-provably-wrong `value`s under the
    fixed formula — out of scope to touch their files this task, flagging
    for whoever next runs a real scoped recompute on those cards.
  - **Bug #2 (found, fixed): `selfInteractionKind` (synergy.ts) checked
    `isEventFact(fact)` to decide `'same-instance'` vs
    `'second-copy'`/`'second-copy-legendary'`** — correct pre-merge (when
    `isZoneFact`/`isEventFact` were mutually exclusive by construction) but
    wrong post-merge: `factsInteract` ALWAYS takes the zone branch first
    whenever `isZoneFact` is true on both sides of a match (returns before
    ever reaching the event-string comparison), so a merged fact's
    self-match is ALWAYS actually zone-branch-resolved whenever it's
    zone-shaped at all — checking `isEventFact` instead mislabeled these as
    `'same-instance'` (implying same-object-same-event reasoning) when the
    real reason is the zone/legend-rule one. Caught via this task's own
    required real before/after `find-synergies.mjs` diff: Aerith's own
    self-match (`self-enters` vs her own `wants-legendary-creatures`)
    flipped from the correct pre-migration `'second-copy-legendary'` to a
    wrong `'same-instance'` purely from adding `event:'entersBattlefield'`
    to an otherwise-unchanged zone match. Fixed by checking `isZoneFact`
    first instead (matches `factsInteract`'s own real branch-priority
    exactly, since its shape gate `isZoneFact(p) === isZoneFact(w)`
    guarantees checking either side is equivalent to knowing which branch
    fired). Confirmed via a full-pool before/after diff (excluding Aerith's
    own now-intentionally-different lines) that this is the ONLY other
    change anywhere in the pool: `Summon: Bahamut (self-interaction:
    same-instance)` → `second-copy` (its own `self-cast`, zone-shaped via
    `from:'Hand'`, was equally mislabeled — Bahamut's `typeLine` has no
    "Legendary" supertype, so `second-copy` not `-legendary`, correctly).
    Two new permanent regression tests added to `synergy.test.ts` (a merged
    zone+event self-match now correctly `second-copy-legendary`; a pure
    event-only self-match stays `same-instance`, unaffected).
  - **Real `find-synergies.mjs` before/after diff, this card only** (full
    methodology: swapped `aerith-gainsborough/synergy.json` back to its
    pre-task git HEAD content, ran the whole-pool script, restored, ran
    again — confirmed via a full-pool diff excluding Aerith's own lines
    that ZERO other card changed except the one Bahamut self-interaction
    label fixed by bug #2 above): **net interaction-line count unchanged,
    290 → 290** — this card's migration was a pure relabel + one label-bug
    fix, not a real match gain/loss, because both converted facts KEPT
    their zone-shape (`to`/`from` still present) alongside the new `event`
    name, so they still satisfy every zone-shaped sink they always did:
    131 `--[battlefield presence]-->` lines relabeled to the more specific,
    CR-named `--[enters the battlefield]-->` (same 131 target cards,
    zero added/dropped), 22 `--[graveyard presence]-->` relabeled to
    `--[dies]-->` (same 22 target cards). No new EventFact-shaped `dies`/
    `entersBattlefield` sink matches gained either (same documented
    "merged fact classifies zone-shaped ONLY" rule from Bahamut's own
    migration — this card just never had a standalone EventFact half to
    begin with, so there was nothing to lose there either, unlike
    Bahamut's real -14/+20 shape-family tradeoff).
  - **Task items already satisfied before this session** (verified, not
    re-done): the two bystander scenario names (`Freya Crescent`,
    `Gigantoad`) were already real cards (`verify-scenario-card-names.mjs`
    clean); the opponent-side bystander (`Gigantoad`) already carries a
    real `controller: pilot.opponents[0]!.name` on its manual `enters`
    push — the you-side bystander (`Freya Crescent`) has no `controller`
    field on its own push, but per the exhaustive latest+15 pool sweep
    that's inert for a `pilot.you`-side bystander (`guessOwner` defaults to
    `'you'`), not a live bug. `scenarios.ts`/`trace.json` untouched this
    round (no scenario-affecting change was needed).
  - `scripts/annotation-coverage.mjs`: added `'aerith-gainsborough'` to
    `ANNOTATED_CARD_SLUGS` (same per-card opt-in step every migrated card
    does, not a "shared plumbing" change).
  - Verified (final): `npx vitest run functional-model` → 236/236 (13
    files, +2 new tests); `verify-synergy.mjs` full pool → 313 checked, 1
    pre-existing unrelated hard failure (`auron-s-inspiration`); scoped
    (`aerith-gainsborough`) → 0 hard failures (only pre-existing informational
    notes: unrecognized `tapForMana`/`attack`/`block` actions, `drawCard`/
    `dealDamage` with no declared produce — same tolerated categories every
    other card shows); `verify-annotation-coverage.mjs` → OK;
    `verify-scenario-card-names.mjs` → OK; `npm run typecheck` → exit 0,
    clean. `trace.json` NOT regenerated (scenarios.ts unchanged this round).
  - **Open Forge-verification**: none needed — this was pure fact-model
    migration (annotation authoring, shape unification, two shared-code bug
    fixes with CR-grounded reasoning already established during Bahamut's
    own migration), no `harness.ts`/`interfaces.ts`/rules-engine behavior
    touched.
  - **Open follow-up for a future task, not done here**: a real, scoped
    `compute-weights.mjs` recompute (NOT a casual full-pool run) for
    `summon-bahamut`'s `destroy-nonland` and `adelbert-steiner`'s own merged
    `dies` fact, now that bug #1 above is fixed — both currently carry
    stale pre-fix `value`s.
  - **Same-day follow-up (coordinator-requested): added `self-cast`**
    (`{event:'cast', from:'Hand', target:'self', value:-1}`, typeLine-
    anchored highlight `"Creature"`) — this card genuinely didn't have one
    before (correctly out of the original migration's scope, since nothing
    forced its addition then); now explicit. Checked `definition.ts` first
    for an alternate-cost/flashback/foretell wrinkle (none — plain
    `{2}{W}`, same as Bahamut's own check) before assuming `from:'Hand'`.
    Inserted at index 0 of both `synergy.json`'s `source` array and
    `annotations-authoring.json`'s `source` array (positional realignment
    — every fact after it shifted down one slot in both files together),
    then re-ran `compute-annotations.mjs aerith-gainsborough` (10 facts
    annotated now, up from 9) rather than hand-computing the typeLine
    offset. Real `find-synergies.mjs` before/after diff (this specific
    addition only): **zero interaction-line change, 290 → 290, zero
    collateral to the rest of the pool** — `self-cast`'s `from:'Hand'` has
    no real pool sink wanting Hand-presence today, same as Bahamut's own
    `self-cast` (purely documentary, not yet load-bearing for any match).
    Verified: `npx vitest run functional-model` → 235/236 passing, the 1
    failure is `annotation-coverage.test.ts`'s real-pool check catching
    **`ultima-origin-of-oblivion`'s own 3 zero-annotation facts** — a
    DIFFERENT, concurrently in-flight session's own card (confirmed via two
    back-to-back `verify-annotation-coverage.mjs` runs 3s apart returning
    DIFFERENT violation sets, i.e. genuinely being live-edited by another
    process right now, not a flake) — NOT aerith-gainsborough, which has
    zero violations in every run and isn't named in any failure output;
    `verify-synergy.mjs` scoped to `aerith-gainsborough` → 0 hard failures;
    `npm run typecheck` → exit 0. Flagging the `ultima-origin-of-oblivion`
    failure for whoever owns that concurrent session, not fixing another
    card's in-progress work from here.

- **2026-09-11 (latest+17) — answered concretely: is `self-enters`'s
  `event:'entersBattlefield'` still doing anything now that it also has
  `to:'Battlefield'`? NO, fully inert for matching/rendering — traced
  every real consumer, didn't guess.** `factsInteract`'s shape-partition
  gate rejects it against both real event-shaped `entersBattlefield`
  sinks (Loporrit Scout, Woodland Weavemaster — both confirmed pure
  `{event:...}`, no zone fields) BEFORE the `event` string is ever
  compared — that gate, not a string mismatch, is why those 2 matches are
  lost. `describeFact`'s "enters the battlefield" label comes entirely
  from `zoneMovementName`'s `(from,to)` lookup, not from `event` — same
  for `themeOf`/`factKind`/`factConditions.ts`. Decision: KEEP the field
  anyway — real documentation of what the movement fundamentally is, and
  the exact lever a future matcher-unification pass would read to recover
  those 2 matches; removing it saves nothing today. Documented in both
  `synergy.ts`'s `Fact.event` doc comment and `SYNERGY_DESIGN.md`'s "Fact
  unification" section (no data/code/matching change, doc-only — verified
  234/234 vitest, 0 real tsc errors, unchanged).

- **2026-09-11 (latest+16) — MAJOR: `ZoneFact`/`EventFact` merged into ONE
  `Fact` interface, user-approved architecture shift.** `event`/`to`/
  `from` (and `zone`, folded into `to`) are now independent optional
  fields that freely co-occur — no more union, no more `isZoneFact`/
  `isEventFact` type-narrowing (both now plain `boolean` classifiers over
  the single `Fact` type). Scope: type/plumbing change is pool-wide-safe
  (nothing else touched or broken); only summon-bahamut's own data
  migrated.
  - `synergy.ts`: `ZoneFact`/`EventFact` interfaces removed, replaced by
    one `Fact` interface (full doc comment covers the merge rationale,
    ACT-vs-CONSEQUENCE rule, Stack-invisibility rule, deferred-matcher
    caveat). `ZoneFact`/`EventFact` kept as `export type ZoneFact = Fact;
    export type EventFact = Fact;` — deprecated back-compat ALIASES so
    `app/lib/factConditions.ts` (card-owned) and this file's own
    `synergy.test.ts` keep compiling with zero edits. `isZoneFact`/
    `isEventFact` — same runtime check (`'zone'||'to'||'from' in fact` /
    `'event' in fact`), just `boolean` return now, not a type predicate
    (there's no narrower type left to narrow to).
  - **Two real plumbing bugs found and fixed, not new matching
    semantics**: (1) `effectiveController` used to branch on `isZoneFact`
    to pick `subject` vs `target` — wrong once a merged fact can carry
    `target` with no `subject` while ALSO being zone-shaped (e.g.
    `self-cast`); fixed to check both unconditionally. (2)
    `factsInteract`'s zone-zone branch compared a sink's zone against a
    bare `w.zone` read instead of `effectiveZone(w)` — broke the moment a
    real sink (`mega-flare-you`) started authoring `to` instead of
    `zone`; same bug, same fix, ALSO existed independently in
    `scripts/verify-synergy.mjs`'s own JS-duplicate matcher (its sink
    checks only ever tested `'zone' in w`, never `'to' in w` — surfaced
    as 3 real hard failures on this card's own re-verification before
    the fix). `describeFact` also got a defensive fallthrough for a real
    NEW fact shape this merge introduces — `from`-only, no `to`
    (`self-cast`) — which has no "current zone" to render as a presence
    phrase; falls through to the `event`-named branches instead of
    crashing.
  - **`cards/summon-bahamut/synergy.json` migrated**: `self-graveyard`
    (ZoneFact) + `self-dies` (EventFact) — the same real occurrence
    represented twice — merged into ONE `dies` fact with real `from`/`to`
    AND `event`. `destroy-nonland`/`self-enters`/`self-cast` — `zoneFrom`/
    `zoneTo` simply renamed to `from`/`to` (no ZoneFact sibling to merge
    with). `destroy-act`/`self-sacrifice` unchanged (never had
    zoneFrom/zoneTo). Sink `mega-flare-you`: `zone:'Battlefield'` →
    `to:'Battlefield'`. `annotations-authoring.json` updated in lockstep
    (removed the now-merged-away `self-graveyard` positional slot, 10→9
    entries) — round-tripped byte-identical via `compute-annotations.mjs`.
  - **CAUGHT MY OWN BUG mid-task, via the required real diff — worth
    remembering the lesson, not just the fix**: first merged `self-dies`
    using `target:'self'` ONLY (dropped `subject:'self'`, reasoning
    "redundant, target already says self"). Real `find-synergies.mjs`
    before/after diff caught this as a SILENT, UNDOCUMENTED loss of 17
    real type-constrained zone-shaped matches (Ardyn the Usurper, Cloud
    of Darkness, Elixir, and 14 more) — `factsInteract`'s zone-matching
    branch ONLY ever reads `subject` (`resolveSubject`) to resolve a
    producer's real types for a type-constrained want, never `target`.
    Fixed by keeping BOTH `subject:'self'` AND `target:'self'` on the
    merged fact — a complete merge of two facts that each already
    declared self-reference (one via each field) should carry both
    forward, not arbitrarily drop one. This is "make the merge real," not
    "cleverly preserve matcher behavior" (the deferred/forbidden part) —
    re-ran the full diff again after the fix to confirm it actually
    restored exactly those 17, nothing more/less. **Lesson: run the real
    diff BEFORE writing up the design doc's numbers, not after — the
    first draft of both the doc and this notes file had wrong numbers
    (543→532/-11) that had to be corrected (543→549/+6) once the bug was
    caught.**
  - **Real pool-wide interactions diff, final/correct numbers** (fully
    reasoned and multiplicity-checked, not just raw line-diffed — see
    SYNERGY_DESIGN.md's "Fact unification" section for the full breakdown
    and every card name): Lost 14 lines (9 distinct real cards' own
    EventFact `event:'dies'` sinks, 3 double-counted since two different
    Bahamut facts each matched them before, + 2 real EventFact
    `event:'entersBattlefield'` sinks) — the accepted, expected
    shape-family regression. Gained 20 lines (9 real unconstrained
    zone-shaped Graveyard-presence sinks gaining a 2nd duplicate producer
    match, +10 genuinely NEW zone-shaped Battlefield-presence matches via
    `self-enters`, +1 new self-interaction via the `effectiveController`
    fix). Net 543→549 (+6). Confirmed via a temporary before/after file
    swap (reconstructed pre-task `synergy.ts`/`synergy.json`, ran
    `find-synergies.mjs`, restored real files, re-verified green) — a
    full-pool diff (not just Bahamut's own lines) confirmed ZERO
    collateral change to any other card.
  - Docs: `SYNERGY_DESIGN.md` — old "Two shapes, not one" bullet struck
    through and marked SUPERSEDED (not deleted — reasoning below it is
    still accurate), new "Fact unification" section added with the full
    before/after diff, the `subject`-drop bug-and-fix story, and future
    work (full matcher unification, letting one fact satisfy both
    shape-families' wants, explicitly NOT done this pass — tracked as
    open). `.claude/contracts/card-schema.md` — new bullet for `card`
    agent covering the merge, the `zone`→`to` sink rename, and that the
    Interactions panel for fin/1 will show different real matches (not a
    bug to fix on the card side).
  - Verified (final state): `npx vitest run functional-model` → 234/234
    (13 files; 3 obsolete `zoneFrom`/`zoneTo` tests rewritten to their
    real merged shapes); `verify-synergy.mjs` full pool → 313 checked, 1
    pre-existing unrelated hard failure (`auron-s-inspiration`); scoped →
    0 hard failures; `verify-annotation-coverage.mjs` → OK; `tsc --noEmit`
    → 0 real errors (down from the prior session's 45/58/60 — removing
    the `ZoneFact|EventFact` union actually FIXED a class of pre-existing
    `TS2353` "excess property check against a union" errors that had been
    tolerated for rounds, a genuine improvement, not just neutral).
  - **Open item, explicitly deferred per the task's own instruction, not
    a gap I introduced**: full matcher unification (letting one merged
    fact satisfy BOTH an event-shaped want and a zone-shaped want at
    once) is NOT done — `factsInteract` still hard-partitions on
    `isZoneFact`. If a future task wants to close the 14-line regression
    above for real, that's the redesign to do — don't attempt it via
    dual-classification tricks on individual facts (tried, rejected, same
    reasoning as the `moveZone`/fact-collapse rejections earlier this
    session).

- **2026-09-11 (latest+15) — real bug fix: `cards/summon-bahamut/
  scenarios.ts`'s two manual `pilot.log.push({fn:'enters', ...})` bystander
  entries (Ahriman, Coeurl) carried no `controller` field, so
  `scenarioReplay.ts`'s owner-guessing fallback (`guessOwner`, defaults to
  `'you'` for any unrecognized name) put BOTH on the player's own side —
  even though Coeurl is added via `pilot.state.addCard(pilot.opponents[0]!,
  ...)` and is supposed to be the opponent's own creature chapter I
  destroys.** Card-agent-found while fixing scenario-replay art; confirmed
  cosmetic-only (chapter I's real destroy-target logic reads real engine
  state, not the replay reconstruction) but real board-accuracy bug per
  this project's "real not mocked" replay standard.
  - Fix: added `controller: pilot.you.name` (Ahriman) / `controller:
    pilot.opponents[0]!.name` (Coeurl) to both pushes — exact field
    name/value convention already established elsewhere (checked
    `battle-menu`/`aerith-gainsborough`/`ambrosia-whiteheart`'s own
    scenarios.ts, all already use this same `controller: pilot.<x>.name`
    shape on their own manual `enters` pushes; `harness.ts`'s real
    engine-emitted `moveTo`/`destroy`/`putCounter` etc. all use the same
    `controller.getName()` convention on the engine side). `LogEntry` is a
    loose `{fn: string; [key: string]: unknown}` (harness.ts) so no type
    change needed.
  - Regenerated `trace.json` via `run-scenarios.mjs --slug=summon-bahamut`
    — diffed against a pre-change backup, confirmed the ONLY change is the
    2 new `"controller"` keys on the 2 `enters` entries, nothing else
    moved.
  - Verified LIVE via a scratch script calling the real
    `app/lib/scenarioReplay.ts`'s own `replayTrace` against the
    regenerated `trace.json`: Ahriman now resolves to `owner:'you'`,
    Coeurl now resolves to `owner:'opp0'` (and correctly shows up in
    `Graveyard` after chapter I's real destroy) — the actual reported bug
    confirmed fixed end-to-end, not just "should be fixed by inspection."
  - **Pool-wide sweep for the same gap — done, not deferred**: grepped
    every `functional-model/cards/*/scenarios.ts` and
    `functional-model/keywords/*/scenarios.ts` for `fn:'enters'` without
    `controller`. Found several more instances (adelbert-steiner,
    flying-reach, defender, deathtouch, first-strike-double-strike,
    vigilance-trample, menace) — but checked each one's own `addCard`
    call: EVERY one of them adds the bystander to `pilot.you`, never
    `pilot.opponents[...]`. Since `guessOwner`'s own default IS `'you'`,
    none of these are live bugs the way Coeurl's opponent-side omission
    was — cosmetically inert, not a reason to touch other cards' files
    this round. Cross-checked the OTHER direction too: every
    `addCard(pilot.opponents[0]!, ...)` bystander pool-wide (battle-menu,
    aerith-gainsborough, flying-reach ×2, menace ×2, vigilance-trample,
    deathtouch, first-strike-double-strike ×2) already DOES carry
    `controller: pilot.opponents[0]!.name` on its own `enters` push — this
    card was the only one with the gap on the actually-load-bearing
    (opponent) side. **Conclusion: not a systemic gap needing a follow-up
    sweep** — verified exhaustively, not assumed; scope stayed fin-1 by
    the check's own result, not by convention alone.
  - Verified: `npx vitest run functional-model` → 234/234;
    `verify-synergy.mjs` full pool → 313 checked, 1 pre-existing unrelated
    hard failure; scoped → 0 hard failures; `verify-annotation-coverage.mjs`
    → OK (this fix touches `scenarios.ts`/`trace.json`, not `synergy.json`,
    so annotations are untouched); `tsc --noEmit` → 60 errors, unchanged.

- **2026-09-11 (latest+14) — codified the ACT-vs-CONSEQUENCE
  `zoneFrom`/`zoneTo` distinction (implicit in the `self-cast`/`destroy-act`
  reasoning from latest+11/+8) as a NAMED standing rule, doc-only, no data
  change.** Rule: an ACT-type EventFact (`cast`/`destroy`/`sacrifice`) gets
  `zoneFrom`/`zoneTo` inline on itself only when the movement is a
  guaranteed, DEFINING part of the act (no "act happened but movement
  didn't" case exists — `cast`, CR 601.2a); it stays a bare tag deferring
  to a separate fact when the movement is conditional/preventable
  (`destroy` — indestructible/regeneration) OR already independently
  matched as its own concept (`sacrifice` defers to `self-graveyard`;
  `destroy` defers to `dies`). A CONSEQUENCE-type EventFact (`dies`,
  `entersBattlefield`) always gets the treatment for its fixed ends, since
  by the time it fires the movement is no longer conditional on anything —
  the conditionality lived upstream in whatever ACT may have caused it.
  - Added as a new named `####` subsection in `SYNERGY_DESIGN.md` (right
    after the `destroy-act` paragraph, before the `entersBattlefield`
    rename-rejection addendum) with a worked-examples table covering every
    real fact on this card: `self-cast` (inline, guaranteed), `destroy-act`
    (bare, conditional+separately-matched), `self-sacrifice` (bare,
    separately-matched via `self-graveyard`), `self-dies`/`destroy-nonland`
    (inline both ends, consequence), `self-enters` (inline `zoneTo` only,
    consequence — `zoneFrom` omitted for the separate Stack-invisibility
    reason, not this rule).
  - Added a compact pointer to the same rule + table in `synergy.ts`'s
    `EventFact.zoneFrom`/`.zoneTo` doc comment, right after the `destroy`
    bullet — so a future fact gets judged against the table instead of a
    fresh justification being invented each time.
  - Checked every EventFact on this card while writing the rule down —
    NO inconsistency found. `self-counters`/`chapter-iii-draw`/
    `chapter-iv-damage` aren't zone movements at all, so the
    `zoneFrom`/`zoneTo` question doesn't apply to them (correctly have
    neither field, for a reason outside this rule's scope).
  - No data change — confirmed via a full no-op verification pass:
    `npx vitest run functional-model` → 234/234; `verify-synergy.mjs` full
    pool → 313 checked, 1 pre-existing unrelated hard failure;
    `verify-annotation-coverage.mjs` → OK; `tsc --noEmit` → 60 errors,
    unchanged from the prior round.

- **2026-09-11 (latest+13) — evaluated and REJECTED renaming
  `event:'entersBattlefield'` to a generic `event:'zoneChange'`** (the same
  `moveZone`-style redundancy argument already applied to `dies`, now
  raised for `entersBattlefield` since it too carries its own `zoneTo`).
  Redid the due-diligence check independently, not assumed from the `dies`
  precedent: `grep`'d every `cards/*/synergy.json` — 16 real cards declare
  `event:'entersBattlefield'` (14 SOURCE producers, 2 SINK wants:
  loporrit-scout, woodland-weavemaster). Ran `find-synergies.mjs` against
  the real pool and confirmed all 14 producers — including Summon:
  Bahamut's own `self-enters` — produce real `--[enters the
  battlefield]-->` edges into both sinks today. Renaming Bahamut's own
  event string would silently drop those 2 real matches — same regression
  class as the already-rejected `dies`→`moveZone` rename. Verdict: KEEP
  `entersBattlefield` as-is, same reasoning as `dies` (established,
  actively-matched pool vocabulary + a real CR-defined term, CR
  110.5/603.6) — `zoneFrom`/`zoneTo` already deliver the self-explaining-
  data goal without touching the matched name.
  - No rename happened, so the follow-up ("should `dies` retroactively get
    the same verdict?") doesn't arise here — both event names were
    independently checked and independently kept on their own real
    pool-usage merits, not by transferring one verdict to the other.
  - No data/code change this round — `synergy.json` untouched. Added the
    check + reasoning to `SYNERGY_DESIGN.md`'s "`EventFact.zoneFrom`/
    `.zoneTo`" section as a new "considered and rejected" addendum,
    right after the existing `dies`→`moveZone` one.
  - Verified (no-op confirmation, nothing changed): `npx vitest run
    functional-model` → 234/234; `verify-synergy.mjs` full pool → 313
    checked, 1 pre-existing unrelated hard failure; scoped → 0 hard
    failures; `verify-annotation-coverage.mjs` → OK; `tsc --noEmit` → 60
    errors, unchanged from the prior round's count.

- **2026-09-11 (latest+12) — new `EventFact.targeted?: boolean` field**
  (user-approved, generalized): distinguishes a real CR 601.2c targeted
  choice from an unconditional broadcast, for a fact whose
  `target`/`recipient` names a real bucket of more-than-one candidate.
  - `synergy.ts`: added the field + doc comment right after `recipient`.
    Convention: only ever written (`true` or explicit `false`) when the
    axis is meaningful; omitted (not `false`) when the fact's only real
    subject is `'self'`/singular `you` — omission there means "not
    applicable," not "unreviewed."
  - `cards/summon-bahamut/synergy.json`: `destroy-act`/`destroy-nonland` →
    `targeted:true` (oracle: "Destroy up to one target nonland
    permanent" — real CR-targeting language, checked against
    `annotations-authoring.json`'s own stored source text); `chapter-iv-
    damage` → `targeted:false` (oracle: "...to each opponent" — no choice,
    checked same way). Did a full per-fact pass over every OTHER EventFact
    on the card (`self-cast`, `self-enters`, `self-dies`, `self-sacrifice`,
    `self-counters`, `chapter-iii-draw`) — all omit it: each has only
    `target:'self'` or singular `controller:'you'`, no real bucket of
    candidates to have chosen among or broadcast to.
  - Purely informational: NOT consulted by `factsInteract` (verified via a
    new permanent test — a `targeted:false` want still matches a
    `targeted:true` produce of the same event), and deliberately NOT added
    to `themeOf` (same treatment as `zoneFrom`/`zoneTo`, which also aren't
    in `themeOf` — that function is scoped to attributes a fact actually
    constrains for matching).
  - Updated `SYNERGY_DESIGN.md` (new "`EventFact.targeted`" section) and
    `.claude/contracts/card-schema.md` (new bullet, flagged for `card`
    agent: will appear on served summon-bahamut facts, same
    allowlist-doesn't-choke-on-it check as `zoneFrom`/`zoneTo`, no
    rendering required yet).
  - Verified: `npx vitest run functional-model` → 234/234 (13 files, +1
    new test); `compute-annotations.mjs summon-bahamut` round-trip
    byte-identical; `verify-synergy.mjs` full pool → 313 checked, 1
    pre-existing unrelated hard failure (`auron-s-inspiration`); scoped →
    0 hard failures; `verify-annotation-coverage.mjs` → OK (this change
    doesn't touch `annotations` at all). `tsc --noEmit` → 60 errors, +2
    from the 58 baseline — confirmed these are 2 MORE instances of an
    already-present, already-tolerated `TS2353` "excess property check
    against a `satisfies Omit<Fact,'role'>` union" quirk (identical
    message already occurs at 6 other lines in this same test file, e.g.
    lines 208/209/217/218/225/226) from my new test's own literal
    fixtures — not a new error class, not a real type-safety gap.

- **2026-09-11 (latest+11) — corrected latest+10's `self-cast` conclusion
  after coordinator/user generalized the rule: Stack is the ONE zone this
  model never assigns as a `zoneFrom`/`zoneTo` value (invisible/
  skip-through); every other real zone (Battlefield, Graveyard, Hand,
  Library, Exile, Command, ...) is fair game whenever actually known — the
  earlier framing ("cast has no zone worth tracking since Stack has no
  pool precedent") wrongly let Stack's invisibility on ONE end blank out
  the OTHER end too.**
  - `self-cast` now `{event:'cast', zoneFrom:'Hand', target:'self',
    value:-1, annotations:[...]}` — checked `definition.ts` first (no
    alternate-cost/flashback/foretell wrinkle on Summon: Bahamut, so its
    own cast really does originate in Hand); `zoneTo` still omitted, but
    for the corrected reason (real destination IS the Stack, the
    deliberately-invisible zone — not "unknown").
  - Also corrected the REASONING (not the outcome, which was already
    right) for `self-enters`'s omitted `zoneFrom`: it's not "unknown among
    hand/library/whatever, so we don't know" — the common-case real
    predecessor zone for entering via a normal cast is the Stack itself
    (invisible, correctly never written), and other real entrance effects
    (tutor/blink/token) have other real non-Stack origins that genuinely
    vary. Both reasons independently justify omitting it; get the
    reasoning right for the next fact that needs this call.
  - Re-checked `destroy-act` under the same pass — confirmed correctly
    unaffected, but for an UNRELATED reason: CR 701.6 destroying isn't a
    guaranteed movement (regeneration/indestructible can prevent it), so
    it stays a bare ACT tag regardless of the Stack rule; `destroy` doesn't
    touch the Stack at all anyway.
  - Wrote the generalized rule explicitly into `synergy.ts`'s
    `EventFact.zoneFrom`/`.zoneTo` doc comment and into
    `SYNERGY_DESIGN.md`'s "`EventFact.zoneFrom`/`.zoneTo`" section (as a
    dated correction addendum, not a silent rewrite of the earlier
    now-wrong reasoning).
  - Added a permanent regression test for `cast` + `zoneFrom:'Hand'` to
    `synergy.test.ts` (mirrors the existing `dies`/`entersBattlefield`
    tests) — verified `isZoneFact`/`isEventFact`/`describeFact` all still
    behave correctly.
  - Verified: `npx vitest run functional-model` → 233/233 (13 files, +1
    new test); `verify-synergy.mjs` full pool → 313 checked, 1
    pre-existing hard failure (`auron-s-inspiration`, unrelated); scoped →
    0 hard failures; `verify-annotation-coverage.mjs` → OK; `tsc --noEmit`
    → 58 errors, unchanged baseline. `compute-annotations.mjs
    summon-bahamut` round-trip confirmed byte-identical (the `zoneFrom`
    addition doesn't touch annotation text/highlight).
  - No open Forge-verification needed — rests on CR 601/700.4/701.6 plus
    `definition.ts` (no alternate-cost wrinkle) and a pool-wide grep (zero
    `"Stack"` zone values anywhere), not Forge-specific behavior.

- **2026-09-11 (latest+10) — extended the `zoneFrom`/`zoneTo` treatment
  (latest+8, below) to `self-enters` (`event:'entersBattlefield'`); reviewed
  `self-cast` (`event:'cast'`) for the same and left it unchanged
  (SUPERSEDED — see latest+11 above, this conclusion on `self-cast` was
  wrong).**
  - `cards/summon-bahamut/synergy.json`: `self-enters` now
    `{event:'entersBattlefield', zoneTo:'Battlefield', target:'self',
    value:-1, annotations:[...]}` — `zoneFrom` deliberately OMITTED (not
    forgotten): destination is fixed (`'Battlefield'`, it's in the event
    name) but real origin varies per effect (hand/library/exile/command
    zone/nowhere-for-a-token) — same "omitted = unknown/any origin"
    convention `ZoneFact.from` already uses, not a new rule.
  - `self-cast` left as a bare `{event:'cast', target:'self', value:-1}` —
    NO `zoneFrom`/`zoneTo` added. Two independent reasons: (1) casting is a
    CR 601 ACT, same category as `destroy-act`/`self-sacrifice` (already
    bare event tags, left that way on purpose) — not a consequence that
    structurally always resolves to a fixed real zone; (2) even setting
    that aside, `cast`'s "destination" is CR 601.2i's "the stack", and a
    real pool grep (`grep -rl '"zone": "Stack"\|"to":
    "Stack"\|"from": "Stack"' cards/*/synergy.json`) returned ZERO hits —
    no fact anywhere in this model has ever used a `Stack` zone value;
    adding one here would be precedent-free vocabulary with no real
    matching value, not filling a genuine gap. If a real future card needs
    to match "cast from a specific zone" (flashback/foretell/etc.), design
    real `Stack` vocabulary deliberately then — don't bolt it onto
    `self-cast` as unused decoration now.
  - Added a permanent regression test to `synergy.test.ts` for
    `entersBattlefield` + `zoneTo` (mirrors the existing `dies` +
    `zoneFrom`/`zoneTo` test) — verified `isZoneFact`/`isEventFact`/
    `describeFact` all still behave correctly (structural discriminator
    unaffected, same as the `dies` case).
  - Updated `synergy.ts`'s `EventFact.zoneFrom`/`.zoneTo` doc comment and
    `SYNERGY_DESIGN.md`'s "`EventFact.zoneFrom`/`.zoneTo`" section to cover
    both cases and the `self-cast` reasoning.
  - Verified: `npx vitest run functional-model` → 232/232 (13 files);
    `verify-synergy.mjs` full pool → 313 checked, 1 pre-existing hard
    failure (`auron-s-inspiration`, unrelated); `summon-bahamut`-scoped →
    0 hard failures; `tsc --noEmit` → 58 errors, unchanged baseline.
  - No open Forge-verification needed for this round — both decisions rest
    on CR text (601, 700.4) plus real pool/code checks already done, not on
    Forge card-script behavior.

- **2026-09-11 (latest+9) — removed `mega-flare-opp` (SINK,
  `zone:'Battlefield', controller:'opp'`) from `cards/summon-bahamut/
  synergy.json` — spurious, same bug class as the earlier `self-battlefield`
  removal (a fact anchored to real text that doesn't actually support what
  it claims to want).** Coordinator/user's own reading, VERIFIED (not just
  trusted) against the actual ability logic before removing, per the
  standing "check before deleting" discipline:
  - **`definition.ts`'s chapter IV effect** computes `amount` via
    `ctx.you.getCardsIn('Battlefield').reduce(...)` — reads ONLY the
    controller's OWN battlefield, never the opponent's. The real oracle
    text's "to each opponent" names the damage's RECIPIENT (a player), not
    a scaling dependency on the opponent's board — confirmed by reading the
    live effect code, not just re-parsing the English sentence.
  - **Independently confirmed via a real pool run, not just the code
    read**: ran `findInteractionsForCard('Summon: Bahamut', pool)` against
    the actual 320-card pool — `mega-flare-you` (`controller:'you'`)
    produced 192 real matches; `mega-flare-opp` produced ZERO (its own
    group is silently dropped by `matchOne`'s `if (!matches.length) return
    null`, so it never even showed up in `findInteractionsForCard`'s own
    output) — this fact wasn't just textually ungrounded, it was already
    fully inert in the live pool, unlike `self-battlefield` (which DID
    generate ~130 real matches despite being conceptually wrong — a
    reminder that "produces real matches" and "is a correct fact" are
    independent checks, not substitutes for each other).
  - No scenario/test/script referenced `mega-flare-opp` by name anywhere
    (checked via grep — `Fact.id` is gone, so nothing COULD reference it by
    a literal id either).
  - `cards/summon-bahamut/synergy.json`: removed the sink entirely (2 sink
    facts → 1). `annotations-authoring.json`: removed the corresponding
    POSITIONAL sink entry (index 1) in lockstep — critical since the two
    files are index-aligned, not id-keyed (removing from only one would
    have silently misaligned `mega-flare-you`'s own authoring entry against
    nothing, or worse, silently authored the WRONG fact). Verified the
    round-trip is still correct after the removal: re-ran
    `compute-annotations.mjs summon-bahamut`, diffed against a pre-removal
    backup — byte-identical (11 facts total, 10 source + 1 sink).
  - Verified: `npx vitest run functional-model` → 231/231 (no test
    referenced this fact, none needed updating). `npx vite-node
    functional-model/scripts/verify-synergy.mjs` (full pool) → 313 checked,
    1 hard failure — still only the pre-existing, unrelated
    `auron-s-inspiration`; zero annotation violations. `summon-bahamut`
    -scoped run → 0 hard failures (only pre-existing `tapForMana` soft
    notes) — removing a SINK fact can't create a produce/evidence gap, so
    this was expected, confirmed anyway. `npx tsc --noEmit -p
    functional-model/tsconfig.json` → 58 errors, unchanged.
  - **Open Forge-verification**: none — pure fact-authoring correction
    (removing a fact with no real mechanical basis), no `harness.ts`/
    `interfaces.ts`/rules-engine behavior touched; the `definition.ts` read
    that grounded this decision was of ALREADY-existing, unchanged code.

- **2026-09-11 (latest+8) — same-batch follow-up to `latest+7` below: added
  `EventFact.zoneFrom`/`.zoneTo` (purely descriptive) to `self-dies`/
  `destroy-nonland` on summon-bahamut, so all three "something dies" facts
  (those two plus the ZoneFact `self-graveyard`) carry matching, self-
  explaining zone data instead of two different encodings of the same real
  thing.** User's original ask offered `event: 'moveZone'` as one possible
  fix — evaluated and REJECTED that specific part (see reasoning below);
  implemented the from/to-data half of the ask instead.
  - **The real constraint that shaped this**: `isZoneFact` discriminates
    STRUCTURALLY (`'zone' in fact || 'to' in fact || 'from' in fact`), not
    by a type tag — so literally reusing `ZoneFact`'s own `from`/`to` field
    names on an EventFact would make it misclassify as a ZoneFact, breaking
    the documented "never both" invariant AND silently routing it through
    `describeFact`'s zone-movement branch instead of its event branch.
    Used differently-named fields (`zoneFrom`/`zoneTo`) specifically to
    avoid this — verified EMPIRICALLY, not just reasoned about (a real
    `isZoneFact`/`isEventFact`/`describeFact` call against a fact literal
    carrying both `event` and `zoneFrom`/`zoneTo`, and against the real
    regenerated Bahamut facts themselves): both `event:'dies'` facts still
    classify as `isEventFact` (not `isZoneFact`) and still render bare
    "dying". New permanent regression test added
    (`synergy.test.ts`, "dies with `zoneFrom`/`zoneTo`... still classifies
    as an EVENT fact").
  - **Rejected `event: 'moveZone'` rename, with a concrete reason, not just
    aesthetic preference**: `event: 'dies'` is itself established, actively
    -matched pool vocabulary — 11 real cards' own EventFact sinks declare
    `event:'dies'` today (checked via a real pool grep: al-bhed-salvagers,
    jenova-ancient-calamity, judge-magister-gabranth,
    sephiroth-fabled-soldier, sephiroth-planet-s-heir, undercity-dire-rat,
    vincent-valentine-galian-beast, zodiark-umbral-god, plus
    aerith-gainsborough/dwarven-castle-guard/magic-pot's own
    `target:'self'`-scoped ones). Renaming Bahamut's own producer event
    string would have silently broken every one of those real matches
    while every other card's own sink kept expecting `'dies'` — a real
    regression the task's own explicit "don't silently change matching
    semantics without saying so" caution was checking for. Confirmed this
    is a real, checkable cost, not a hypothetical one, before rejecting it.
  - **Also checked and rejected collapsing `self-graveyard`
    (ZoneFact)/the two `dies`-shaped EventFacts into fewer facts**, now
    that they'd carry matching from/to data — `factsInteract` requires
    both sides of a match to share the SAME shape
    (`isZoneFact(p) !== isZoneFact(w)` → no match), so a real pool sweep
    confirms both shapes are independently load-bearing: 30+ real cards'
    own ZONE-shaped `zone:'Graveyard'` sinks can only ever match a
    ZONE-shaped produce (`self-graveyard`), and the 11 EVENT-shaped
    `event:'dies'` sinks above can only ever match an EVENT-shaped
    produce (`self-dies`/`destroy-nonland`). Collapsing to one shape
    would silently drop real matches on whichever side lost its shape —
    not redundant, despite now carrying the same from/to DATA.
  - `destroy-act` (`event:'destroy'`, the ACT, CR 701.6) deliberately did
    NOT get `zoneFrom`/`zoneTo` — same reasoning `self-sacrifice`
    (`event:'sacrifice'`, also an ACT) already doesn't have them: an ACT
    fact isn't itself the movement, its paired dies-CONSEQUENCE fact is
    (which already carries the descriptive zone data) — adding it to the
    act too would be the exact "two different encodings of the same real
    thing" duplication this whole correction is trying to eliminate, just
    shifted one fact over.
  - `synergy.ts`: new `EventFact.zoneFrom?`/`.zoneTo?: string` fields
    (doc'd at length on the field itself with the misclassification
    warning), a matching doc-comment addition on `isZoneFact` itself
    warning against ever widening it to include these, and an explicit
    comment in `factsInteract`'s EventFact branch confirming they're
    never compared. `SYNERGY_DESIGN.md` — new "`EventFact.zoneFrom`/
    `.zoneTo`" subsection covering all of the above (including both
    rejected alternatives and why). `.claude/contracts/card-schema.md` —
    new bullet flagging the fields for `card` agent (`factConditions.ts`'s
    own `HANDLED_OR_LABEL_KEYS`-style allowlist should account for them
    sensibly, not show them as a mystery field) — not fixed here, out of
    lane.
  - `cards/summon-bahamut/synergy.json`: added `zoneFrom:'Battlefield',
    zoneTo:'Graveyard'` to both `destroy-nonland` and `self-dies`. No
    change to `self-graveyard` (already had real `from`/`to`), no change
    to `destroy-act`/`self-sacrifice` (ACTS, not movements, per above).
    No `annotations-authoring.json`/`annotations` changes needed — these
    are new semantic fields, not textual-anchor fields, so annotation
    computation/indexing is untouched.
  - Verified: `npx vitest run functional-model` → 231/231 (13 files, +1 new
    test). `npx vite-node functional-model/scripts/verify-synergy.mjs`
    (full pool) → 313 checked, 1 hard failure — confirmed still only the
    pre-existing, unrelated `auron-s-inspiration`; zero annotation
    violations. `summon-bahamut`-scoped run → 0 hard failures (only
    pre-existing `tapForMana` soft notes) — confirms the new fields don't
    trip `verify-synergy.mjs`'s own event-evidence check (which only ever
    compares `p.event === ev.event`, ignoring the new fields entirely,
    same as any other extra JS object property). `npx tsc --noEmit -p
    functional-model/tsconfig.json` → 58 errors, unchanged from the
    `latest+7` baseline.
  - **Open Forge-verification**: none — descriptive-field addition +
    reasoning about existing matcher semantics, no `harness.ts`/
    `interfaces.ts`/rules-engine behavior touched. CR 700.4/701.6 citations
    are rules-vocabulary justification for the act-vs-consequence field
    placement, already-established earlier today, not new claims.

- **2026-09-11 (latest+7) — same-batch follow-up to `latest+6` below (four
  more mid-task corrections relayed by the coordinator, all folded into one
  coherent regen/verification rather than four separate passes): made
  `Fact.annotations` REQUIRED (min. one entry), added a new
  `AnnotationRef.target: 'typeLine'` variant, deleted `self-battlefield`
  outright, and moved `sourceText`/`highlight`/`anchor` OFF the served
  `Fact` entirely into a new per-card `annotations-authoring.json`. Also
  confirms the sacrifice/dies fact shapes are already correct (no fix
  needed there). Supersedes `latest+6`'s own `factIdentity()` formula (it
  used `fact.sourceText`, which no longer exists) — read this entry, not
  that one, for the CURRENT identity convention.
  - **Per-fact annotation decisions on `cards/summon-bahamut/synergy.json`**
    (the "every fact needs a real annotation" invariant forced a real
    per-fact judgment call, not a mechanical fix):
    - `self-cast` (`event:'cast'`), `self-enters` (`event:'entersBattlefield'`)
      — RE-ANCHORED to the card's own real TYPE LINE (`"Enchantment
      Creature — Saga Dragon"`), not the oracle text body — genuinely real,
      non-fabricated anchors (the printed type line, not invented text):
      `self-cast` highlights `"Creature"` (licenses "cast AS A CREATURE
      spell" specifically), `self-enters` highlights `"Enchantment
      Creature"` (licenses "IS A PERMANENT," the precondition for
      entering the battlefield at all — deliberately not narrowed to just
      "Creature" since either printed type would equally license this).
      This is the exact "something in the pool actually needs it" case
      that justified adding `AnnotationRef.target:'typeLine'` (previously
      speculatively avoided) — old `sourceText`s here were parenthetical
      glosses ("(baseline — ... is itself cast as a creature spell, like
      any other permanent).") that were NEVER real oracle text, which is
      exactly why they'd never had annotations at all.
    - `self-dies` (`event:'dies'`, target self) — RE-ANCHORED to real
      oracle text: `sourceText`/`highlight` changed to `"Sacrifice after
      IV."` (same span `self-graveyard`/`self-sacrifice` already
      use) — its old parenthetical gloss ("(baseline — the real 704.5x
      sacrifice after chapter IV is still Bahamut dying, whatever the
      cause)") was also never real text; the REAL textual basis for "this
      creature dies" is the printed sacrifice instruction itself (dying IS
      the direct, sole cause here — no separate combat/removal path exists
      on this card), so re-pointing at that real line is not a stretch,
      it's the actual justification finally made explicit.
    - `self-counters` (`event:'putCounter'`) — its `sourceText` was
      ALREADY 100% real, verbatim oracle text (Saga reminder text, line 0:
      `"(As this Saga enters and after your draw step, add a lore
      counter. Sacrifice after IV.)"` — Saga reminder text is genuinely
      printed on the card, not a gloss) — it simply never had a
      `highlight` authored, so `computeFactAnnotations` had nothing to
      slice. Added `highlight: "add a lore counter"` (verbatim substring)
      — no re-anchoring needed, just filling in the missing piece.
    - `self-battlefield` (`zone:'Battlefield'`, presence-with-Flying) —
      **DELETED OUTRIGHT**, not re-anchored, per a SEPARATE, firmer
      correction mid-task: a SOURCE fact must never describe bare
      presence ("sits in this zone"), only a real zone TRANSITION — this
      fact was pure presence (exists only so a hypothetical "you control
      a flying creature" sink could match it; Bahamut doesn't arrive
      anywhere via this fact, it just... has Flying, forever, while on
      the battlefield). This is the SAME rule `self-battlefield` was
      already flagged against once earlier today (reverted from a fake
      `to:'Battlefield'` movement back to bare presence to fix a
      duplicate-label bug) — the right fix was always removal, now done.
      **Checked for a real dependency before deleting** (per the task's
      own explicit "flag back, don't delete blind" instruction): no other
      fact ON THIS CARD, no scenario, no `verify-synergy.mjs` check, and
      no vitest test references it; the only real effect is Bahamut
      losing its own presence in the pool's generic, unqualified
      "battlefield presence" match set (confirmed via a real
      `find-synergies.mjs summon-bahamut` run before deleting — ~130
      OTHER cards' own bare `{zone:'Battlefield'}` sink facts had matched
      it) — this is the deliberate, ALREADY-ANTICIPATED consequence of
      enforcing the rule on this card (the whole POOL still has this same
      bare-presence-SOURCE shape on every other unmigrated card, untouched
      — a much bigger, explicitly out-of-scope cross-cutting migration,
      not a Bahamut-specific dependency worth blocking on). Fact count:
      13 → 12 (11 source → 10).
  - **`AnnotationRef` widened to a real union** (`{target:'oracle',
    line,start,end} | {target:'typeLine',start,end}` — no `line` on the
    `typeLine` variant, a type line has no paragraph structure to index).
    `computeFactAnnotations`/`rawHighlightRange` (`synergy.ts`) reworked to
    branch on this and to take a `texts: {oracle?, typeLine?}` bag instead
    of a single string.
  - **`Fact.annotations` is now `[AnnotationRef, ...AnnotationRef[]]`**
    (TS non-empty-tuple idiom — no runtime array-length keyword exists),
    not `AnnotationRef[] | undefined`. New enforcement, mirroring the
    `scenario-card-names.mjs` three-file shape exactly: `scripts/
    annotation-coverage.mjs` (shared logic — `ANNOTATED_CARD_SLUGS`
    allowlist, today just `summon-bahamut`; `findMissingAnnotationsInSynergy`
    pure/no-I/O for direct unit testing, `findMissingAnnotations` the real
    file-reading sweep), `scripts/verify-annotation-coverage.mjs` (CLI
    wrapper), `annotation-coverage.test.ts` (top-level, wired into `npm run
    test`, 5 new tests: 3 exercise the checker's own logic directly against
    synthetic fixtures — INCLUDING a real "flags a fact with annotations
    entirely absent" case, i.e. actually proven to have teeth, not just
    passing against an already-clean pool — 2 exercise the real pool).
    Wired into `verify-synergy.mjs`'s own combined exit code the same way
    the scenario-name check already is (`ANNOTATED_CARD_SLUGS`
    slug-filtered by `requested` the same way).
    **Verified the check has real teeth END TO END, not just via its own
    unit tests**: temporarily deleted one real annotation from the
    checked-in `cards/summon-bahamut/synergy.json`, ran `verify-synergy.mjs
    summon-bahamut` for real — got a genuine nonzero exit (checked `$?`
    directly off the process, not through a pipe/tail, learned from an
    earlier session's own documented mistake) and the correct violation
    line printed, then restored the file from a backup and re-confirmed
    exit 0 clean.
  - **`sourceText`/`highlight`/`anchor` removed from the served `ZoneFact`/
    `EventFact` shape entirely** — a separate, later mid-task correction:
    once `annotations` is a required, real pointer, the literal text is
    fully re-derivable by slicing `oracleText`/`typeLine` at that pointer,
    so keeping the authored string ALSO on the served object is pure
    duplication (this session's running "facts should be as short as
    possible" theme, restated explicitly by the user this time). New
    types in `synergy.ts`: `FactAnnotationAuthoring` (`{anchor?,
    sourceText, highlight}`) and `AnnotationAuthoringFile` (`{source:
    (FactAnnotationAuthoring|null)[], sink: (...)[]}`) — POSITIONALLY
    aligned with `synergy.json`'s own `source`/`sink` arrays (index-based,
    not id-keyed, since `Fact.id` is gone too — reorder both together or
    they silently misalign; documented prominently on the type itself).
    Lives in a new `cards/<slug>/annotations-authoring.json`, checked into
    git (so the authored intent isn't lost — still needed to regenerate
    `annotations` later if oracle text or the matching logic changes),
    read ONLY by `scripts/compute-annotations.mjs` — never by
    `find-synergies.mjs`/`verify-synergy.mjs` (confirmed via grep neither
    ever read `sourceText`/`highlight` in the first place, so this move is
    zero-impact on matching/reconciliation) and never served.
    - `compute-annotations.mjs` rewritten to read BOTH files per card
      (`synergy.json` for the real semantic facts + `annotations-authoring
      .json` for the per-index authoring entry), zip them by array index,
      compute, and write `annotations` back into ONLY `synergy.json`
      (the authoring file is never written back to by this script — a
      human/AI edits it directly when re-authoring is needed).
    - `computeFactAnnotations(texts, fact)` → `computeFactAnnotations(texts,
      authoring)` — now takes a `FactAnnotationAuthoring | null | undefined`
      instead of reading `sourceText`/`highlight`/`anchor` off a `Fact`
      object; `rawHighlightRange` similarly retyped.
    - `factIdentity()` (the `Fact.id` replacement from `latest+6`) COULD NOT
      keep using `sourceText` (now gone) — redesigned to `` `${fact.role}::
      ${describeFact(fact)}::${JSON.stringify(fact.annotations[0])}` ``.
      Arguably a STRICTLY BETTER identity than the old `sourceText`-based
      one: `annotations[0]` is now guaranteed present (required field) and
      exact-position-precise, vs. `sourceText` being merely a same-string
      coincidence check. **This changes what `card` agent's own `factKey()`
      needs to be** — the guidance in the `latest+6` entry/the
      `card-schema.md` contract as of THIS entry both point at the new
      tuple; don't use the older `role::sourceText::describeFact` formula
      documented in `latest+6`, it's stale as of this entry.
    - `cards/summon-bahamut/annotations-authoring.json` created (10 source +
      2 sink entries, positionally matching the post-`self-battlefield`
      -deletion `synergy.json`). `synergy.json` itself had `sourceText`/
      `highlight`/`anchor` stripped from every fact via a one-off Node
      script (not hand-edited) — kept only semantic fields + `annotations`.
      **Verified the round-trip is real, not assumed**: backed up the
      already-annotated `synergy.json`, stripped the three fields, wrote
      the new authoring file, re-ran `compute-annotations.mjs`, diffed the
      regenerated file against the backup — byte-identical.
  - **Confirmed, not re-fixed (coordinator asked for explicit confirmation
    given a user complaint "there is no from and to in sacrifice")**: three
    facts represent Bahamut dying/being sacrificed on the current
    `synergy.json` — `self-graveyard` (`ZoneFact`,
    `from:'Battlefield',to:'Graveyard'`, subject self — the DYING
    consequence, lets another card's plain `zone:'Graveyard'` sink match
    it), `self-sacrifice` (`EventFact`, `event:'sacrifice'`, target self —
    the ACT itself, no from/to at all, EventFacts never carry zone fields
    in this schema), `self-dies` (`EventFact`, `event:'dies'`, target self
    — the CR 700.4 consequence-as-an-event, also no from/to). **Only
    `self-graveyard` carries `from`/`to`, and it's a genuine, deliberate
    zone-movement fact, not presence in disguise** — CR 701.20a's own
    text: "To sacrifice a permanent, its controller moves it from the
    battlefield to its owner's graveyard" literally describes a
    battlefield→graveyard transition, the exact same category the
    pre-existing 2026-09-11 "SOURCE ZoneFact reworked" design already cites
    CR 700.4 for. This is NOT the same violation category as
    `self-battlefield` (which was presence-with-a-property, no arrival/
    departure at all) — a sacrifice-caused zone change genuinely IS an
    arrival (at the graveyard) with a well-defined origin (the
    battlefield), which is precisely what `from`/`to` exists to express.
    Left the DATA/shape unchanged. **Follow-up naming correction, same
    batch**: the coordinator relayed a second, narrower objection to how
    I'd been REFERRING to this fact in prose — I'd been calling it
    "self-sacrifice-graveyard" (its literal `id` before `Fact.id` was
    removed earlier this same task), which the user correctly read as
    conflating "dying" (what this fact actually represents) with
    "sacrifice" (a different fact, `self-sacrifice`, entirely) — the same
    act-vs-consequence split `destroy-act`/its own dies-consequence fact
    already keep separate for the destroy case. Checked: the actual DATA
    has no name/id field to rename (already removed), and no script/JSON
    conflates the two either (`compute-annotations.mjs`,
    `annotations-authoring.json` are purely positional, no names at all)
    — this was PURELY my own prose/comment naming, not a real data/code
    bug. Fixed the live (non-historical) references: `synergy.test.ts`'s
    own `describeFact` test description (also dropped a second, unrelated
    stale citation of the deleted `self-battlefield` fact in the adjacent
    test while there), and a `verify-synergy.mjs` code comment explaining
    the `sacrifice` fn's two-events shape — both now say `self-graveyard`
    and spell out the dying-vs-sacrifice distinction explicitly.
    Deliberately did NOT rewrite older, already-historical entries in this
    same notes.md file or in `SYNERGY_DESIGN.md`'s own dated "Correction"
    addenda that still say "self-sacrifice-graveyard" — those are accurate
    records of what the fact was literally CALLED at the time (before
    `Fact.id` removal), rewriting them would be revisionist, not a
    naming fix. `.claude/agent-memory/card/notes.md` also has several
    "self-sacrifice-graveyard" references — not mine to edit (another
    agent's memory), flagged for `card` agent instead. Happy to revisit
    the underlying `self-graveyard`/`self-sacrifice`/`self-dies` shape
    itself with a more specific pointer if this analysis is missing
    something, but as of this entry the DATA was already conceptually
    correct — only the prose naming needed the fix.
  - **Docs updated**: `SYNERGY_DESIGN.md` — new "No `id`, no `sourceText`/
    `highlight` on the served fact — `annotations` required" subsection
    under "The fact model" covering all of the above in one place (not
    duplicating `latest+6`'s already-superseded framing).
    `.claude/contracts/card-schema.md`'s "Fact-to-oracle-text pointers"
    section rewritten (the `latest+6`-era paragraph about `Fact.id` there
    is now itself superseded — replaced, not left stale) with the full
    current shape and a complete, updated card-agent action-item list.
  - **Full app/server call-site list for `card` agent, current as of THIS
    entry (supersedes the shorter `latest+6` list)**:
    - `app/components/FunctionalModelText.vue:66` — `factKey()`:
      `` return f.id ?? `${f.role}::${f.sourceText}::${describeFact(f)}`; ``
      — replace entirely with the new tuple (`f.role`, `describeFact(f)`,
      `f.annotations[0]` stringified) — NEITHER `f.id` NOR `f.sourceText`
      exist anymore.
    - `app/pages/app/card/[set]/[number].vue:285` — page's own `factKey()`,
      identical old shape, same fix.
    - `app/pages/app/card/[set]/[number].vue:331` — `openFactDebugModal`:
      `` `Fact JSON — ${fact.id ?? factKey(fact)}` `` → just `factKey(fact)`.
    - `app/pages/app/card/[set]/[number].vue:919` — Facts-table row hover
      `:title="row.fact.sourceText"` — NEW this entry (`sourceText` didn't
      exist as a served-field concern before today) — needs to derive the
      same full-sentence hover text from `oracleText` + the fact's own
      first `annotations` entry instead (slice the whole line for an
      `'oracle'`-targeted annotation, or the whole `typeLine` string for a
      `'typeLine'`-targeted one).
    - `server/api/graph-links.ts:93` — `` `${name}::${group.fact.id ??
      group.description}` `` — reads `.id` directly off a `Fact`, will fail
      to type-check now; same tuple swap (or just drop to
      `group.description` alone, already the existing `??` fallback).
    - `app/lib/graphRenderer.ts:81` — a DOC COMMENT only (not executable)
      citing the now-doubly-stale `${producer}::${fact.id}` formula —
      cosmetic fix once the `graph-links.ts` site above is fixed.
    - `app/lib/factOrder.ts` — confirmed (again) does NOT reference
      `fact.id`/`fact.sourceText` anywhere — no fix needed.
    - `app/lib/factConditions.ts:208` — `HANDLED_OR_LABEL_KEYS` still lists
      `'sourceText'`/`'id'` as "shown elsewhere" keys — harmless dead
      entries now (neither key will ever actually be present on a real
      served fact going forward), not a functional bug, but worth a
      cleanup pass whenever `card` agent is next in this file.
  - Verified (full, final pass, after ALL of the above): `npx vitest run
    functional-model` → 230/230 (13 test files). `npx vite-node
    functional-model/scripts/verify-synergy.mjs` (full pool) → 313 checked,
    1 hard failure — confirmed still only the pre-existing, unrelated
    `auron-s-inspiration`; zero annotation-coverage violations printed.
    `summon-bahamut`-scoped run → 0 hard failures (only the pre-existing
    `tapForMana` soft notes). `npx tsc --noEmit -p
    functional-model/tsconfig.json` → 58 errors, up from the documented
    57-error pre-task baseline by exactly ONE — the unavoidable TS7016
    "could not find a declaration file" for `annotation-coverage.test.ts`'s
    own plain-`.mjs` import (same known, harmless, already-tolerated class
    `scenario-card-names.test.ts`'s own identical TS7016 already is); the
    OTHER `synergy.test.ts` fallout from `annotations` becoming required
    (16 disposable fixture literals needed a shared `FIXTURE_ANNOTATIONS`
    constant added to stay green — explicitly NOT real annotations, just
    the minimum shape a wholly-imaginary matching-logic fixture needs to
    compile, documented as such inline) is now fully resolved, zero net
    new errors from that path.
  - **Open Forge-verification**: none — this whole batch is fact-schema/
    identity-convention/generation-pipeline rework (data model + tooling +
    docs), no `harness.ts`/`interfaces.ts`/rules-engine behavior touched.
    The one CR citation used above (701.20a, for confirming
    `self-graveyard`'s `from`/`to` is correct) is a rules-vocabulary
    justification for a label/shape decision already made earlier today,
    not a new engine-behavior claim.

- **2026-09-11 (latest+6) — removed `Fact.id` entirely from `ZoneFact`/
  `EventFact` (`synergy.ts`), per explicit user call: facts are shorter/
  simpler under the new `annotations` model, and the "stable identity
  across regen/diffing" argument for keeping `id` (raised and REJECTED by
  the user this same session, see the `latest+3` entry below — that entry's
  own framing that `id` "stays exactly as-is" is now superseded by this
  later, final decision) is no longer needed. The pre-existing `role`+
  `sourceText`+`describeFact(fact)` fallback tuple (already used by the
  card page's own `factKey()`) is now the ONLY fact-identity convention,
  not a fallback.
  - `synergy.ts`: deleted `id: string` (and its doc comment) from both
    `ZoneFact` and `EventFact`. Added a new private `factIdentity(fact)`
    helper (`` `${fact.role}::${fact.sourceText}::${describeFact(fact)}` ``)
    — mirrors the card page's `factKey()` exactly, documented as such so the
    two don't drift. Used it to replace `InteractionMatch.theirFactId:
    theirs.id` (was reading the now-gone field) — `theirFactId` itself
    (consumed only by `server/api/graph-links.ts` for its own sink-grouping
    key, already `?? group.description`-guarded) keeps its name/shape, just
    now always a real derivable string instead of sometimes-`undefined`.
    Updated `InteractionMatch.theirFactId`'s own doc comment accordingly.
  - `functional-model/scripts/prefill-mana-facts.mjs`: deleted the whole
    `freshManaId()` helper (existed ONLY to mint `Fact.id` values —
    `"mana"`/`"mana-2"`/...) and the `id: freshManaId(synergy)` line from
    both fact-literal builders (single-color and choice-of-color shapes).
    No other script (`verify-synergy.mjs`, `find-synergies.mjs`,
    `compute-weights.mjs`, `compute-annotations.mjs`,
    `verify-scenario-card-names.mjs`, `scenario-card-names.mjs`) reads or
    writes `.id` on a Fact at all — confirmed via grep, nothing else to fix
    there.
  - `synergy.test.ts`: stripped every literal `id: '...'` field from fact
    fixtures (16 occurrences) and simplified the `zf`/`ef` test-builder
    helpers (`Partial<Omit<ZoneFact/EventFact, 'id' | 'role'>>` →
    `Partial<Omit<..., 'role'>>`, dropped their own `id: 'test'` default).
  - `cards/summon-bahamut/synergy.json` (the ONLY synergy.json touched, per
    scope): stripped the literal `"id": "..."` field from all 13 facts (11
    source + 2 sink) via a one-off Node script (JSON parse → delete `.id` on
    every element of both arrays → re-stringify with the same 2-space
    indent), not hand-edited — confirmed valid JSON and confirmed via `git
    status --porcelain -- functional-model/cards/*/synergy.json` that no
    other card's synergy.json was touched.
  - `SYNERGY_DESIGN.md`: checked — the "The fact model" section (and the
    whole file) never actually documented `id` as part of the schema in the
    first place (confirmed via a whole-file `id`/`identity` grep, zero
    hits), so no edit was needed there.
  - `.claude/contracts/card-schema.md`: the one stale line asserting
    "`Fact.id` is unaffected by any of this" (written during the earlier
    `annotations` rework, now false) rewritten into a proper "`Fact.id` has
    been removed entirely" section, explicitly telling `card` agent what to
    drop (`factKey()`'s `fact.id` branch, `openFactDebugModal`'s modal
    title) and pointing at the surviving `role`/`sourceText`/`describeFact`
    convention.
  - **Full app/server call-site list found via grep, NOT touched (out of
    lane, for `card` agent)**:
    - `app/components/FunctionalModelText.vue:66` — its own `factKey()`:
      `return f.id ?? \`${f.role}::${f.sourceText}::${describeFact(f)}\`;`
      — drop the `f.id ??` branch, keep the rest.
    - `app/pages/app/card/[set]/[number].vue:285` — the page's own
      `factKey()`, same shape: `return fact.id ?? \`${fact.role}::
      ${fact.sourceText}::${describeFact(fact)}\`;` — same fix.
    - `app/pages/app/card/[set]/[number].vue:331` —
      `openFactDebugModal`'s modal title: `` `Fact JSON — ${fact.id ??
      factKey(fact)}` `` — drop `fact.id ??`, just use `factKey(fact)`.
    - `app/lib/graphRenderer.ts:81` — a DOC COMMENT only (not executable
      code) citing `` `${producer}::${fact.id}` `` as the (no-longer-
      accurate) formula server-side; worth a wording fix once the
      `graph-links.ts` site below is fixed, not urgent.
    - `server/api/graph-links.ts:93` — `sourceKey` construction:
      `` `${name}::${group.fact.id ?? group.description}` `` — reads `.id`
      directly off a `Fact` object, will now fail to type-check (property
      doesn't exist) and needs the same role/sourceText/describeFact swap
      (or just drop to `group.description` alone, since that branch was
      already the same "??" fallback pattern) — this file is
      `server/api/graph-links.ts`, flagging for whichever of `card`/`ui`
      actually owns graph-link generation to pick up, per the task's own
      instruction to route findings through `card`.
    - `app/lib/factOrder.ts` — checked, does NOT reference `fact.id`
      anywhere (keys off `row.key`/`fact.annotations` only) — no fix needed
      there.
  - Verified: `npx vitest run functional-model` → 225/225 (unchanged
    baseline). `npx vite-node functional-model/scripts/verify-synergy.mjs`
    → 313 checked, 1 hard failure (confirmed still only the pre-existing,
    unrelated `auron-s-inspiration`). `npx tsc --noEmit -p
    functional-model/tsconfig.json` → 57 errors, same count as the
    documented `latest+5` baseline (the new `synergy.test.ts` errors this
    pass's `id`-removal surfaces — TS2353 excess-property complaints now
    naming `event`/`from`/`to`/`zone` instead of `id` — are the SAME
    pre-existing union-excess-property-check false positive documented
    under the `2026-09-11 — SOURCE ZoneFact reworked...` entry below, not a
    new class of error; net count unchanged).
  - **Open Forge-verification**: none — pure fact-schema/identity-
    convention removal (data model + reconciliation-tooling + test-fixture
    cleanup), no `harness.ts`/`interfaces.ts`/rules-engine behavior touched.

- **2026-09-11 (latest+5) — fixed all 4 fabricated (non-Scryfall) scenario
  card names the `scenario-card-names.mjs` check had been flagging since it
  landed (documented in the entry below as explicitly out-of-scope at the
  time), by swapping each for a real card whose real stats satisfy the exact
  same scenario role — checked what each stub's surrounding code/comments
  actually needed before picking a replacement, not name-matched blind.**
  - `cards/summon-bahamut/scenarios.ts`: `'Ally Legend'` → **Ahriman**
    (`data/fin/fin_scryfall.json`: `{2}{B}` Creature — Eye Horror, 2/2, mana
    value 3) — chapter IV's own "total mana value of other permanents you
    control" has no legendary restriction (confirmed by reading
    `definition.ts`'s chapter IV effect, not assumed from the old stub's
    name), so only nonzero mana value under your control was ever
    load-bearing; kept the exact same `basePower`/`baseToughness`/`cmc`
    (2/2/3) the old stub already had since Ahriman's real stats happen to
    match verbatim. Updated the top-of-scenario comment, the chapter-IV
    inline comment, and the `result` string to name Ahriman instead of "Ally
    Legend".
  - `cards/aerith-gainsborough/scenarios.ts`: `'Bystander Legend'` →
    **Freya Crescent** (`{R}` Legendary Creature — Rat Knight, 1/1) —
    confirmed via `definition.ts`'s `onDies` effect
    (`ctx.you.getCreaturesInPlay().filter((c) => c.hasSubtype('Legendary'))`)
    that legendary-ness on an OTHER creature you control is genuinely
    load-bearing here, not flavor — Freya's real stats (1/1) matched the old
    stub's hardcoded values exactly, no numeric change needed, just
    name/subtypes (`['Legendary','Rat','Knight']`) and a new comment
    explaining why a legendary is required. `'Lethal Blocker'` →
    **Gigantoad** (`{3}{G}` Creature — Frog, 4/4) — the only real FIN
    power≥4 creature; FIN has none with the old stub's toughness 1 (checked:
    no real FIN creature has power≥4 AND toughness≤2), so the old "double
    kill" side-effect (blocker also dying to Aerith's 2 power) isn't
    reproducible with a real card — confirmed this doesn't matter to the
    fact under test (`onDies` only branches on `aerithReal.zone ===
    'Graveyard'`, never on the blocker's own fate) before accepting the
    toughness change; updated `basePower`/`baseToughness` to Gigantoad's
    real 4/4 and reworded the nearby "704.5g can kill EITHER combatant"
    comment since Gigantoad no longer actually dies in this exchange (kept
    the general defensive-correctness point about `sideOf`/`controller`,
    dropped the now-inapplicable "was wrong for Lethal Blocker" specific
    claim). Confirmed Gigantoad's own conditional-land static buff and its
    ETB trigger, and Ahriman's/Freya's own printed abilities, are all inert
    here — none of these three are wired to a `CardDefinition` the harness
    would ever fire abilities from (they're raw `addCard` board-furniture,
    same as every other pool-wide filler stub), so their extra oracle text
    genuinely doesn't matter to the trace.
  - `cards/battle-menu/scenarios.ts`: `'Behemoth'` → **Coliseum Behemoth**
    (`{5}{G}{G}` Creature — Beast, 7/7) — confirmed this was a
    truncation/typo of a real card, not a fully separate invention (the real
    card exists in `data/fin/fin_scryfall.json`, well over the mode's power
    ≥4 threshold); updated `basePower`/`baseToughness` from the old stub's
    4/4 to Coliseum Behemoth's real 7/7, added `subtypes: ['Beast']`, and a
    comment noting its own ETB "choose one" trigger is inert for the same
    not-wired-to-a-CardDefinition reason as above.
  - Regenerated `trace.json` for all three via `run-scenarios.mjs
    --slug=<slug>` (one slug per invocation — the script only accepts a
    single `--slug=`, confirmed by reading its arg parsing after a
    multi-`--slug=` invocation silently only picked up the first one) —
    each regenerated cleanly, no engine exceptions.
  - Verified: `node functional-model/scripts/verify-scenario-card-names.mjs`
    → 0 violations (was 4). `npx vitest run functional-model` → 225/225
    (was 224/225 — the `scenario-card-names.test.ts` failure this fixes is
    now green, no other test regressed). `npx vite-node
    functional-model/scripts/verify-synergy.mjs` → 313 checked, 1 hard
    failure — same pre-existing, unrelated `auron-s-inspiration`; all three
    touched cards are clean `note`s (only the pre-existing pool-wide
    `tapForMana` soft-note noise, nothing new).
  - **Open Forge-verification**: none — pure scenario-authoring content swap
    (real card in, fabricated stub out), no `harness.ts`/`interfaces.ts`/
    rules-engine behavior touched. The one thing worth a future glance if
    anyone touches this area again: Gigantoad's own real "control seven or
    more lands" static buff and Coliseum Behemoth's own real ETB trigger are
    currently inert only because these stubs aren't wired to a
    `CardDefinition` — if this pool ever starts letting board-filler stubs
    reference their OWN real `CardDefinition` (not the case today), these
    two would need a second look.

- **2026-09-11 (latest+4) — deleted the deprecated `annotateOracleText`/
  `AnnotatedSegment`/`AnnotatedFactRef` outright from `synergy.ts`**, per
  coordinator confirmation that the `card` agent finished migrating
  `app/`/`server/` off them (zero remaining real references, only
  historical comments). Direct follow-up to the entry immediately below.
  - Confirmed BEFORE deleting: `computeFactAnnotations`/`rawHighlightRange`
    never called `annotateOracleText` (dependency ran the other direction —
    `annotateOracleText` called the shared `rawHighlightRange` helper), so
    the delete is a clean removal, not a break of the new path.
  - Cleaned up now-stale prose in surviving doc comments that named the
    deleted function/types as if they still existed in this file (the
    `AnnotationRef`/`rawHighlightRange`/`computeFactAnnotations` doc
    comments, and the `Fact.id`/`Fact.highlight` field doc comments that
    used to point at `annotateOracleText`'s "hover wiring"/"inline
    card-text view") — reworded to past tense / point at the real current
    consumer instead of a dangling name.
  - `.claude/contracts/card-schema.md`'s handoff section was already marked
    DONE by the coordinator before this pass — no doc change needed there.
  - Verified: `npx vitest run functional-model` → 224 passed, 1 failed
    (225 total, same pre-existing unrelated `scenario-card-names.test.ts`
    failure). `npx vite-node functional-model/scripts/verify-synergy.mjs`
    → 313 checked, 1 hard failure (pre-existing, unrelated
    `auron-s-inspiration`). `npx tsc --noEmit -p
    functional-model/tsconfig.json` → 57 errors, unchanged from the
    pre-deletion baseline.
  - **Open Forge-verification**: none — pure dead-code removal, no
    behavior change.

- **2026-09-11 (latest+3) — replaced the "annotated card" live-recompute
  design with pointer-based `Fact.annotations`, per explicit user design
  ask (card = plain copy of real data; facts = pointers into it).** Scoped
  to summon-bahamut ONLY, per an explicit mid-task coordinator correction
  (dropped the "check other FIN cards, do the cheap ones" exploration
  entirely — single-card change this pass, pool-wide is a separate later
  decision). Also explicitly did NOT touch `Fact.id` — a second mid-task
  correction reversed an earlier "ids become irrelevant" framing; `id`
  stays exactly as-is (stable identity across regen/diffing, Facts-table
  row key, debug-modal title — unrelated to what `annotations` replaces).
  - `synergy.ts`: added `AnnotationRef` (`{target:'oracle', line, start,
    end}`) + `Fact.annotations?: AnnotationRef[]` on both `ZoneFact`/
    `EventFact`. **Indexing convention** (documented on the interface
    itself, since `card` agent needs to implement matching slice logic):
    `line` = 0-indexed within the OWNING FACE's own real
    `oracleText.split('\n')` (which face = `Fact.face`); `start`/`end` =
    character offsets WITHIN THAT LINE ONLY (half-open) — a consumer
    slices via `oracleText.split('\n')[line]!.slice(start, end)`, no
    whole-text offset math needed. Chose line-relative over whole-text-
    absolute specifically so a renderer never has to also carry the line-
    splitting logic just to use the numbers.
  - New exported `computeFactAnnotations(oracleText, fact)` — the ONE
    place `sourceText`/`highlight` get turned into a real range, shared by
    the new baked-once path AND (via a new private `rawHighlightRange`
    helper both now call) the OLD live `annotateOracleText`, so the two
    can't drift on what counts as a match. Same "first match, best effort"
    tolerance the old code had (`indexOf` returns first occurrence); a
    `highlight` phrase spanning more than one line (a genuine ambiguity
    line-relative indexing can't express) returns `undefined` rather than
    guessing — not hit by any real summon-bahamut fact.
  - `annotateOracleText`/`AnnotatedSegment`/`AnnotatedFactRef` marked
    `@deprecated` (JSDoc, not removed) — left working BYTE-IDENTICAL
    (confirmed via the refactor sharing `rawHighlightRange`, not a rewrite)
    so the pre-existing `card`-agent call sites
    (`server/api/card/[set]/[number].ts`'s `buildAnnotatedCard`,
    `app/components/FunctionalModelText.vue`) don't break before that
    agent finishes migrating off them.
  - New script `functional-model/scripts/compute-annotations.mjs` — the
    generation step: reads a card's `synergy.json`, resolves its real name
    via `definition.ts`, looks up real oracle text from
    `data/<set>/<set>_scryfall.json` (excluding `*_tokens_scryfall.json`,
    same real-card-data convention `scenario-card-names.mjs` already
    established), computes `computeFactAnnotations` per fact (face-aware:
    `fact.face ?? 'front'` selects `card_faces[0]`/`[1]` vs. the plain
    `oracle_text` field), and writes the result back into `synergy.json`.
    Written to generalize to the whole pool (`npx vite-node
    functional-model/scripts/compute-annotations.mjs [<slug>...]`, no args
    = whole pool) but ONLY RUN for summon-bahamut this pass, per the scope
    correction above.
  - `cards/summon-bahamut/synergy.json`: ran the script — 8 of 11 facts got
    real `annotations` (`destroy-act`, `destroy-nonland`,
    `chapter-iii-draw`, `chapter-iv-damage`, `self-sacrifice-graveyard`,
    `self-sacrifice`, `mega-flare-you`, `mega-flare-opp`); 3 facts have no
    `annotations` because they fail the SAME match the old
    `annotateOracleText` already silently skipped for them — not a new
    gap: `self-cast`/`self-enters`/`self-dies` have no `highlight` at all
    (bare parenthetical `sourceText` only), and `self-battlefield`'s own
    `sourceText` ("Flying (Summon: Bahamut is itself a flying creature
    permanent on your battlefield).") was NEVER a verbatim oracle-text
    substring (the parenthetical gloss isn't real card text) — confirmed
    this already failed to match under the OLD live code too, so nothing
    regressed. Verified every computed `(line,start,end)` slices back to
    exactly the authored `highlight` string via a real `oracle_text.split
    ('\n')[line].slice(start,end)` check against `data/fin/fin_scryfall.json`'s
    own real Summon: Bahamut entry, not just reasoned about.
  - `SYNERGY_DESIGN.md`: fact-model section rewritten to document
    `annotations` (shape, indexing convention, what it replaces) in place
    of the old `annotateCardText`/live-recompute description.
    `.claude/contracts/card-schema.md`: new "Fact-to-oracle-text pointers"
    section — the exact served-shape change `buildAnnotatedCard`/
    `AnnotatedCard`/`AnnotatedFace` need (drop `oracleLines:
    AnnotatedSegment[][]`, serve raw `oracleText: string` instead) and
    what `FunctionalModelText.vue` needs to do instead, file-by-file, for
    the `card` agent to pick up — **not done here, explicitly out of lane**
    (`server/api/card/[set]/[number].ts`, `app/types.ts`,
    `app/components/FunctionalModelText.vue`, `app/lib/factOrder.ts` all
    still reference the deprecated segment-tree shape, untouched by this
    pass on purpose).
  - Verified: `npx vitest run functional-model` → 224 passed, 1 failed
    (225 total) — same pre-existing, out-of-scope
    `scenario-card-names.test.ts` failure as every other recent entry in
    this file (4 fabricated names, not fixed here per explicit scope).
    `npx vite-node functional-model/scripts/verify-synergy.mjs` → 313
    checked, 1 hard failure (pre-existing, unrelated
    `auron-s-inspiration`); summon-bahamut itself clean (only pre-existing
    `tapForMana` soft notes). `npx tsc --noEmit -p
    functional-model/tsconfig.json` → 57 errors, same as the last
    documented baseline in this file (all pre-existing
    `synergy.test.ts`/card `definition.ts` noise) — confirmed zero new
    errors from this change. `trace.json` untouched (this is a
    `synergy.json`-only generation step, independent of scenario
    execution).
  - **Noted, not investigated further**: `functional-model/scripts/
    scenario-card-names.mjs`, `verify-scenario-card-names.mjs`,
    `scenario-card-names.test.ts` exist on disk as untracked (`??`) files
    NOT created by this task, predating it per this file's own earlier
    2026-09-11 entry ("new permanent, enforced check...") but absent from
    THIS conversation's own initial `git status` snapshot — almost
    certainly a concurrent/peer orchestrator session's work landing on
    disk between that snapshot and this task starting (this project's
    documented "multiple orchestrators" norm). Left untouched, not
    reverted, not claimed as mine.
  - **Open Forge-verification**: none needed — this is a synergy fact-
    schema/served-shape change (data model + a new offline generation
    script), not new engine mechanics.

- **2026-09-11 (latest+2) — fixed a real duplicate-label bug the zone-
  change rework (entry below, "SOURCE `ZoneFact` reworked...") introduced:
  `self-battlefield` on summon-bahamut got mechanically converted to
  `to: 'Battlefield'` even though it was never a movement — it's a
  presence-with-Flying fact (sourceText/highlight are both about Flying,
  exists only so another card's "you control a flying creature" sink can
  match), and forcing it through `zoneMovementName` made it render "enters
  the battlefield", identical to the genuine ETB fact (`self-enters`).
  Reverted `self-battlefield` back to `zone: 'Battlefield'` (presence-
  shaped) in `cards/summon-bahamut/synergy.json` — now renders "battlefield
  presence" again, no longer colliding. `self-sacrifice-graveyard`'s own
  `from:'Battlefield',to:'Graveyard'` → "dies" conversion is untouched and
  stays correct (sacrifice really is a zone-change event).
  - **Pool-wide sweep, not just this card**: `grep '"to": "Battlefield"'
    cards/*/synergy.json` — summon-bahamut was the ONLY card with any
    SOURCE `to`/`from` fact at all (confirmed by the rework's own doc —
    it was explicitly scoped to just this one card, no pool-wide
    migration ever happened), so there was nothing else to fix.
  - Added a "Correction" addendum directly under the original rework's own
    `SYNERGY_DESIGN.md` writeup (not a silent edit — the original entry's
    reasoning about `self-battlefield` was wrong, now flagged as such
    inline where a future reader would otherwise trust it).
  - **`trace.json` NOT regenerated** — it's built purely from
    `scenarios.ts` execution (`run-scenarios.mjs`), independent of
    `synergy.json`; confirmed no reference to `synergy.json` in that
    script. A `synergy.json`-only fix has nothing for a trace regen to
    pick up.
  - Verified: `npx vitest run functional-model` → 224 passed, 1 failed
    (225 total) — the 1 failure is the separately-scoped, pre-existing
    `scenario-card-names.test.ts` (4 fabricated scenario card names
    pool-wide, documented in the entry above this one as intentionally
    out-of-scope-to-fix-here); this exactly matches the "224/224 baseline"
    this fix was asked to confirm, that new test just wasn't in the count
    when that number was first established. `node
    scripts/verify-synergy.mjs` → 313 checked, 1 hard failure (same
    pre-existing unrelated `auron-s-inspiration`), summon-bahamut itself
    clean (only pre-existing `tapForMana` soft notes). Real regenerated
    `describeFact` output against the actual fact objects (not hand-typed):
    `self-enters` → "enters the battlefield", `self-battlefield` →
    "battlefield presence" (previously identical to each other before this
    fix).
  - **Open Forge-verification**: none — pure fact-schema correction
    (reverting a mechanical-conversion mistake in a label-derivation
    rework), no `harness.ts`/`interfaces.ts`/rules-engine behavior touched.

- **2026-09-11 (latest) — new permanent, enforced check: every literal
  `addCard(...)` card NAME across every `cards/*/scenarios.ts` must be a
  real Scryfall card, not an invented placeholder — wired into BOTH
  `npm run test` and the manual `verify-synergy.mjs` sweep, not left a
  one-off script (explicit ask: don't repeat `.tmp-check-images.mjs`'s
  bitrot).** Direct follow-up to this same file's own 2026-09-11-earlier
  entry flagging `allyLegend`/`otherLegend`-shaped stubs as systemic.
  **Fixing the flagged cards themselves is explicitly OUT of this task's
  scope** — building+landing the check, and confirming it actually catches
  what's already broken, was the whole ask.
  - New files: `scripts/scenario-card-names.mjs` (shared logic — plain JS,
    no vite-node/TS-import needed, since it's pure text/JSON, deliberately
    kept `node`-runnable per its own header), `scripts/
    verify-scenario-card-names.mjs` (CLI wrapper, human-readable report,
    `node functional-model/scripts/verify-scenario-card-names.mjs`),
    `scenario-card-names.test.ts` (top-level, matching the pool's existing
    `*.test.ts`-alongside-subject convention — this is what makes it run
    under plain `npm run test`/`vitest run`, the strongest "actually
    blocks" form available, not just a manually-invoked script).
  - **Scope, deliberately narrow** (matches the task's own explicit
    constraint): only a literal `name: '...'`/`name: "..."` STRING inside an
    `addCard(...)` call's own object-literal argument is checked — a
    `name: someCard.name` PROPERTY ACCESS (referencing an imported
    `CardDefinition`, the overwhelming majority of `name:` usages in the
    pool) is skipped, not a literal. A `PlayerState.tokens` catalog key
    (`tokens: ['c_a_treasure_sac']`, `tokens.ts`'s own `TOKENS` map) is
    explicitly out of scope per the task's own instruction — confirmed via
    grep that no scenario in the pool ever constructs a token via a literal
    `addCard(..., {name:...})` call anyway (`TOKENS.` never appears in any
    `cards/*/scenarios.ts`), so this never even has to special-case it.
    Basic lands (Plains/Island/Swamp/Mountain/Forest/Wastes) are a small
    static allowlist (real, universally-reprinted cards regardless of
    whether one particular set's own data file happens to carry them).
  - **Real-card ground truth**: every `data/<set>/<set>_scryfall.json` file
    (today, only `fin/` — written to generalize to whatever sets the
    historical-sets sweep adds later, per the task's own "across all set
    files under data/*/" ask), explicitly EXCLUDING `*_tokens_scryfall.json`
    (a different Scryfall card space — a same-named TOKEN existing
    shouldn't validate a fabricated nontoken-permanent name). Double-faced
    cards indexed by both their combined `name` and each individual
    `card_faces[].name`, for a hypothetical future scenario naming just one
    face. Uses `data/`, never `dist/` (the generated build copy).
  - Brace-balanced parsing (not a naive `[^}]*` regex) for the `addCard(...)`
    object literal itself, so a future opts object nesting another
    `{...}`-shaped field (`ptFormula`, a real flat-object `RealCard` field
    per `state.ts`) can't truncate the scan early — verified safe across the
    full real 320-card pool with zero exceptions/false parses.
  - **Wired into `verify-synergy.mjs`** (not just the new `.test.ts`): added
    an import + a final pool-wide (or `requested`-slug-filtered, matching
    that script's own existing slug-scoping) check after the existing
    per-card loop, contributing to the SAME `hardFailures`-driven nonzero
    exit — so `verify-synergy.mjs summon-bahamut` now ALSO reports that
    card's own `'Ally Legend'` violation in the same run, not a separate
    command someone has to remember to also run. Matched the file's own
    documented hard-failure (not soft-note) convention explicitly, per the
    task's own instruction that a fabricated name is a straight authoring
    violation, not an "engine can't represent this yet" gap.
  - **Verified real, not asserted**: ran the CLI cold against the current
    pool (below); ran a disposable scratch-dir fixture pair (one real
    literal name, one fabricated one) through `findFabricatedScenarioCardNames`
    directly to confirm it's discriminating, not blanket-flagging everything
    — the real one passed silently, only the fabricated one was reported;
    confirmed `verify-synergy.mjs`'s exit code is genuinely 1 (not just its
    printed text) both pool-wide and slug-scoped, via a real `$?` check
    piped through a logfile (not through `tail`, which would have reported
    tail's own exit code instead — caught and fixed this exact mistake
    mid-task).
  - **Current pool result — 4 violations, all already flagged/expected, not
    new discoveries**: `cards/summon-bahamut/scenarios.ts:42` (`'Ally
    Legend'`), `cards/aerith-gainsborough/scenarios.ts:42` (`'Bystander
    Legend'`), `cards/aerith-gainsborough/scenarios.ts:54` (`'Lethal
    Blocker'`), `cards/battle-menu/scenarios.ts:39` (`'Behemoth'` — close to
    but not the same as the real `Coliseum Behemoth`). This is the full
    current-pool list — no fabricated name outside what this file's own
    earlier 2026-09-11 entry had already flagged. **`npm run test` is now
    RED because of this** (1 new failing test on top of the 5 pre-existing
    unrelated `scripts/relations.test.mjs` ENOENT failures — 6 total, 340
    passing, confirmed via a real `vitest run` — matches the documented
    "expected non-passing on current pool" outcome exactly) — the follow-up
    to actually fix these 4 names is separately scoped, NOT done here.
  - **tsc delta**: added ONE net-new tolerated tsc error (57, up from the
    documented 56 baseline) — a TS7016 "could not find declaration file"
    for `scenario-card-names.test.ts`'s own import of the deliberately
    plain-JS `scenario-card-names.mjs` (no `.ts`/`.d.ts` possible without
    breaking the "importable under plain `node`, no build step" requirement
    both CLI entry points need — tried a colocated `.d.ts`/`.mjs.d.ts`
    first, neither got picked up by this tsconfig's `Bundler` resolution for
    an explicit `.mjs` specifier, abandoned rather than fight the resolver
    further). Inert to runtime (vitest transpile-only; the actual violation
    array IS correctly typed via an explicit `: ScenarioCardNameViolation[]`
    local annotation, which DOES type-check — only the raw module import
    itself is `any`) — same "small stable duplicate, tolerated tsc noise"
    class of trade this file's own 2026-09-11-earlier `ZONE_NOUN`/local
    `effectiveZone` entries already accept, not a new category of problem.
  - **Open Forge-verification**: none — this is pool-authoring-discipline
    tooling (a static text/JSON check), not engine mechanics; nothing in
    `harness.ts`/`interfaces.ts`/rules behavior was touched.

- **2026-09-11 (later) — summon-bahamut scenario A's opponent destroy
  target switched from a Treasure TOKEN to a real, non-token FIN creature
  (Coeurl — `data/fin/fin_scryfall.json`: `{1}{W}` Creature — Cat Beast,
  2/2), per direct user instruction that the target be a real card, not
  generic filler. This directly removed the reason scenario B (the
  forced-self-destroy corner case, reinstated 2026-09-10 to back the
  `destroy-act` event fact) existed at all.**
  - `scenarios.ts`: replaced `opponents: [{ tokens: ['c_a_treasure_sac'],
    ... }]` with a plain `opponents: [{ libraryCount: 10 }]` plus a real
    `pilot.state.addCard(pilot.opponents[0]!, 'Battlefield', {name:
    'Coeurl', ...})` + a manual `enters` log entry (needed because,
    unlike `PlayerState.tokens`, an `addCard`'d permanent isn't part of
    `raw.opponents[0]` for the replay UI to reconstruct from setup alone —
    same reasoning the pre-existing `allyLegend`/`otherLegend` pattern in
    this file and `aerith-gainsborough`'s own scenario already establish).
    `preferTarget` updated `c.getName() === 'Treasure'` →
    `c.getName() === 'Coeurl'`. Rewrote the top-of-file doc comment and the
    inline chapter-I/II comments and `result` string to describe Coeurl,
    not Treasure, and to drop the now-inapplicable 704.5d/token-
    ceases-to-exist citations (Coeurl is a real permanent — a normal
    701.6/704.5g graveyard-bound destroy, not a ceases-to-exist).
  - **Verified before removing scenario B, not assumed**: regenerated
    `trace.json` via `run-scenarios.mjs --slug=summon-bahamut` with BOTH
    scenarios still present, confirmed scenario A's own kill now logs a
    literal `{fn:'destroy', target:'Coeurl', controller:'opp0'}` line
    (previously `ceasesToExist`, per the Treasure-token gap the
    2026-09-10 entry below documents) — checked the actual regenerated
    `trace.json`, not reasoned about it. `verify-synergy.mjs
    summon-bahamut` — 0 hard failures with both scenarios (18 tapForMana
    soft notes, same as before). Only THEN removed `scenarioB` and
    `runEngineScenarios`'s reference to it, regenerated `trace.json` again
    (1 scenario now), re-ran `verify-synergy.mjs summon-bahamut` — still 0
    hard failures, 9 tapForMana soft notes (half of the 2-scenario count,
    as expected) — confirming scenario A alone now fully backs
    `destroy-act` with no scenario B needed, same evidence-check
    discipline as the original 2026-09-10 scenario-B removal.
  - `progress.json`: fixed one now-factually-wrong `knownGaps` bullet this
    change directly contradicted ("opponent's own artifact is never
    actually a reachable destroy target" — false as of this change:
    `preferTarget` overrides the pool's own self-first default pick, it
    isn't blocked by pool ordering the way plain `chooseTarget` would be)
    — replaced with a dated "resolved" note rather than deleting it
    silently. **Flagged, not touched**: this file's own top-level `notes`
    field is a separate, much older narrative (predates even the
    Treasure-token version of this scenario — describes both chapters I
    AND II declining, which hasn't been true since well before this task)
    — clearly stale, but out of THIS task's scope to rewrite wholesale;
    worth a real cleanup pass sometime. `lastVerified` was already
    `2026-09-11` from an earlier pass today — left as-is (same day).
  - Verified: `npx vitest run functional-model` 224/224 (unchanged count —
    no test touches this card's scenario shape by name). Full-pool
    `verify-synergy.mjs`: 313 checked, 1 hard failure — same pre-existing,
    unrelated `auron-s-inspiration` as every prior baseline in this file.
  - **Flagged, not fixed (out of this task's scope but worth a follow-up)**:
    while sourcing a real replacement name, found this card's OWN
    `allyLegend`/`otherLegend`-style stub (`name: 'Ally Legend'`, line
    ~42) is itself an invented placeholder name, not a real Scryfall card
    (confirmed absent from `data/fin/fin_scryfall.json` and every other
    set file) — and the exact same pattern recurs elsewhere in the pool
    (`battle-menu`'s `'Behemoth'` — close to but not identical to the real
    `Coliseum Behemoth`; `aerith-gainsborough`'s `'Bystander Legend'`/
    `'Lethal Blocker'`). This appears to be an established, systemic
    convention for pure board-furniture stubs across the pool, not an
    isolated slip — but it's in real tension with the project's own
    "scenario replay: real not mocked" rule as written. Left untouched
    (not this task's ask, and fixing it pool-wide is a real separate
    task), but flagged since it's the same rule category as this task's
    own explicit instruction.
  - **Open Forge-verification**: none needed — swapping which real
    permanent a scenario destroys is scenario-authoring/board-content
    only; the underlying `destroy`/`ceasesToExist`/`704.5d` engine
    behavior in `harness.ts` was already correct and untouched.

- **2026-09-11 — SOURCE `ZoneFact` reworked into an explicit zone-CHANGE
  shape (`to`/`from`), replacing bare presence-style `zone` on the source
  side only — SINK facts untouched.** Full rationale/shape now in
  `SYNERGY_DESIGN.md`'s "The fact model" section + a matching addendum at
  the file's end (read those before touching this area again — not
  re-duplicating the full writeup here). Summary for quick resume:
  - `synergy.ts`: `ZoneFact.zone` is now optional; added `to?`/`from?`
    (SOURCE-only — `to` = destination, `from` = optional origin, omitted
    = unknown/any). New private `effectiveZone(fact)` choke point
    (`fact.zone ?? fact.to`) used by `isZoneFact`, `factsInteract`,
    `factKind`, `describeFact` so a pre-rework bare-`zone` source fact
    keeps matching/rendering byte-identically — **no pool-wide migration
    was needed for this to be safe**, only the two facts on
    `summon-bahamut` were actually converted. `factsInteract`'s zone-vs-
    zone branch compares SOURCE `to` against SINK `zone` only — `from` is
    deliberately excluded from that comparison (the explicit "match on
    `to` alone, ignore origin" design goal).
  - New exported vocabulary (data, not buried in `describeFact`'s control
    flow, so `card`-agent Facts-tab work can consume it directly):
    `ZONE_MOVEMENT_NAMES` (`{from?, to, name}[]`) and
    `zoneMovementName(from, to)`. Two entries seeded (grow only when a
    real card forces it, same discipline as the rest of the constraint
    vocabulary): `to:'Battlefield'` (any `from`) → "enters the
    battlefield"; `from:'Battlefield', to:'Graveyard'` → "dies" (CR 700.4
    — battlefield→graveyard is dying regardless of cause, including
    sacrifice; no extra type/target constraint needed since a `ZoneFact`
    always describes a persistent object). `describeFact` calls this for
    any SOURCE zone fact declaring `to`/`from`, falling back to the
    unchanged bare "<zone> presence" when the pair isn't named yet.
  - `cards/summon-bahamut/synergy.json`: converted `self-battlefield`
    (`zone:'Battlefield'`→`to:'Battlefield'`, now labels "enters the
    battlefield") and `self-sacrifice-graveyard` (`zone:'Graveyard'`→
    `from:'Battlefield',to:'Graveyard'`, now labels "dies"). Its two SINK
    zone facts (`mega-flare-you`/`mega-flare-opp`) untouched, per scope.
    `progress.json.lastVerified` bumped to 2026-09-11 (re-ran
    verify-synergy.mjs as part of this pass, real pass).
  - **`scripts/verify-synergy.mjs`, `scripts/find-synergies.mjs`,
    `scripts/compute-weights.mjs` all needed fixes** — each has its own
    local `isV2Shaped` (all three widened to accept `'to' in f || 'from' in
    f`, not just `'zone' in f`) and, in verify-synergy.mjs/
    compute-weights.mjs, a `'zone' in p`-gated branch reading `p.zone`
    directly for a SOURCE fact's forward/reverse trace-evidence check —
    all switched to the same `p.to ?? p.zone` fallback (a small local
    `effectiveZone(f)` mirror in each .mjs file, since these plain scripts
    don't import synergy.ts's own PRIVATE helper — consistent with the
    existing "small stable duplicate rather than widen the engine import"
    trade elsewhere in this codebase, e.g. `ZONE_NOUN` in
    factConditions.ts). **This was a real gap, not a defensive add**:
    without it, `isV2Shaped` would have wrongly excluded summon-bahamut
    from `find-synergies.mjs`/`compute-weights.mjs` entirely (a `.every()`
    check — ANY fact missing both `zone` and `event` fails the WHOLE
    file), and verify-synergy.mjs's `'zone' in p` branch would have
    misrouted a converted fact into the EVENT-fact evidence path (reading
    `p.event`, undefined on a zone fact) and hard-failed it.
  - Verified: `npx vitest run functional-model` 224/224 (216 prior + 8 new
    — a new `describeFact` zone-change describe block + a new top-level
    `factsInteract`/`findInteractionsForCard` matching describe block, both
    exercising real `(from,to)` shapes, not invented ones). Full-pool
    `verify-synergy.mjs`: 313 checked, 1 hard failure — same pre-existing,
    unrelated `auron-s-inspiration` (Exile-zone produce gap) as every
    prior pass. `find-synergies.mjs`: 313 v2-authored (unchanged from
    before this pass — confirmed summon-bahamut wasn't dropped). Isolated
    A/B via a scoped `git stash push -- <the touched files>` around
    `find-synergies.mjs`'s own Summon: Bahamut output: same set of matched
    cards before/after, only the LABEL text changed (battlefield
    presence→enters the battlefield, graveyard presence→dies) — confirms
    the matching-logic change is label-only, not a behavior change.
  - **`npx tsc --noEmit -p functional-model/tsconfig.json`: 56 errors, up
    from the documented 50-error baseline — flagged, not silently
    accepted as zero-delta.** All 6 new ones are the SAME pre-existing TS
    union-excess-property-check false positive `synergy.test.ts` already
    had 7 instances of before this pass (lines 28-74, e.g. `{event:
    'addMana', ...} satisfies Omit<EventFact,'role'>` inside a `poolCard(
    ..., [literal], ...)` call — TS's weak-type excess-property check
    misfires once the literal is contextually typed against the `Omit<
    Fact,'role'>` UNION rather than one concrete branch) — my new
    `factsInteract`/`findInteractionsForCard` matching tests use the
    identical established `poolCard([{...} satisfies Omit<ZoneFact,
    'role'>], ...)` pattern for the new `to`/`from` shape and hit the same
    quirk. Inert to runtime (vitest transpile-only, doesn't type-check;
    all 224 tests pass for real) and to `verify-synergy.mjs`/
    `find-synergies.mjs` (plain `.mjs`, no static type-checking at all) —
    but it IS a real, visible tsc-count regression from the documented
    baseline, unlike every other entry in this file. Left as-is rather
    than restructuring the new tests around a known, already-tolerated
    quirk — flagging here so a future pass doesn't mistake it for a fresh
    regression.
  - **Card-agent-facing, explicitly NOT done here (out of lane)**: the
    Facts tab's own rendering (labels, notes/conditions column, any
    `from`/`to` display) — `zoneMovementName`/`ZONE_MOVEMENT_NAMES` are
    exported specifically so that work doesn't need to re-derive the
    mapping independently.
  - **Not done, flagged rather than silently skipped**: a full pool-wide
    migration of every other card's own SOURCE `zone` fact to `to`/`from`
    — real per-card authoring judgment (what's the actual origin zone),
    not a mechanical rename; explicitly out of this task's scope
    ("Summon: Bahamut and whatever other FIN cards are in the current
    uncommitted diff" only). The `effectiveZone` backward-compat fallback
    means nothing else regressed by leaving this undone.
  - Also touched, WIP conflict check: `git diff` before starting showed
    uncommitted work already in flight on `synergy.ts`/`synergy.test.ts`/
    `compute-weights.mjs`/`verify-synergy.mjs`/summon-bahamut's own
    `synergy.json`/`scenarios.ts`/`progress.json` (the `-1` Weight
    sentinel, `EventFact.recipient`, the bare-label single-dimensional
    redesign, `self-cast`/`self-enters`/`self-counters`/`destroy-act`/
    literal-`sacrifice` event facts — all documented in this file's own
    prior entries above). None of it touched `ZoneFact`'s own shape or
    `zone`-matching logic, so there was no real conflict — built on top of
    it cleanly, didn't revert or clobber any of it. (`find-synergies.mjs`
    was NOT already in the WIP diff before this task — untouched by any
    earlier session today — first touched by this pass.)
  - **Open Forge-verification**: none needed — pure fact-schema/label-
    derivation rework (data model + reconciliation-tooling fixes), no
    rules-engine behavior touched; the CR 700.4 "dies" citation justifies
    the DERIVED LABEL mapping's naming choice, not any `harness.ts`
    execution behavior.

- **2026-09-10 (latest+4) — literal `destroy` EventFact added to Summon:
  Bahamut (`destroy-act`), mirroring the `sacrifice` act-vs-consequence
  split from the entry just below.** `describeFact` had no `destroy` branch
  — confirmed it falls through the generic fallback (`return event`),
  which already renders bare `"destroy"` correctly per the single-
  dimensional label design; no branch added (verified via a real
  `describeFact` call against the actual authored fact object, not just
  reasoned about — see below).
  - `synergy.json`: added `{id:'destroy-act', event:'destroy',
    target:{types:{not:['Land']}}, value:-1, sourceText:"I, II — Destroy up
    to one target nonland permanent.", highlight:"Destroy up to one target
    nonland permanent"}` — same `target` shape and highlighted span as the
    pre-existing `destroy-nonland` fact (`{event:'dies', target:{types:
    {not:['Land']}}}`), which stays the CONSEQUENCE-only fact, untouched.
    No `target:'self'`/self-reference — same as `destroy-nonland`, Bahamut
    is the source/actor here, not what dies. `value:-1` (the hand-authored-
    placeholder sentinel, not yet run through `compute-weights.mjs`), same
    convention as `self-cast`/`self-enters`/`self-counters`/`self-sacrifice`
    below.
  - **Real gap found and fixed in `verify-synergy.mjs`, same shape as the
    `sacrifice` fix**: `producedEvents()`'s `case 'destroy'` only returned
    `[{event:'dies',...}]` — `harness.ts`'s own `destroy` handler (line
    ~784-802) already logs a literal `{fn:'destroy', target, controller}`
    entry (CR 701.6, distinct from the `dies` consequence) whenever the
    destroyed target is a REAL (non-token) permanent, but nothing mapped it
    to a `destroy` event fact. Added a second element to the returned array,
    `{event:'destroy', side: sideOf(entry, cardName)}`, mirroring
    `sacrifice`'s own two-events-per-log-line shape exactly. **Deliberately
    did NOT also add `destroy` to the `ceasesToExist` case** (used when the
    destroyed target is a TOKEN — 111.7/704.5d, it ceases to exist instead
    of sitting in the graveyard): that log shape is genuinely ambiguous —
    an unrelated `moveTo(target, 'Graveyard')` effect on a token (e.g.
    tellah-great-sage/elven-passage/eden-seat-of-the-sanctum's own real
    "put this card into its owner's graveyard" effects, none of which are a
    CR 701.6 destroy) logs an IDENTICAL `{fn:'ceasesToExist', zone:
    'Graveyard', ...}` line, so crediting every such line as `destroy`
    evidence would be a real false positive, not a conservative widening.
  - **Real scenario-coverage gap found, not just a synergy.json/script fix**:
    summon-bahamut's own scenario A (the only one checked into `HEAD`,
    working-tree at the time still had scenario B removed as a WIP
    uncommitted edit from an unrelated earlier task) destroys the
    opponent's Treasure TOKEN — which means its own supporting trace line
    for `destroy-nonland` was always `ceasesToExist`, never a literal
    `fn:'destroy'` — so scenario A alone can't back a `destroy-act` event
    fact at all. `git diff HEAD` on `scenarios.ts` showed scenario B (chapter
    I forced to destroy Bahamut ITSELF — the only legal nonland target, a
    real non-token permanent) had been removed uncommitted, for a
    documented reason that predates this task ("added no fact coverage
    verify-synergy.mjs actually needed beyond [scenario A]" — true for the
    OLD fact set, no longer true now). Restored it via `git checkout HEAD --
    functional-model/cards/summon-bahamut/scenarios.ts` (confirmed via
    `git diff HEAD` that the file's ONLY divergence from HEAD was that one
    scenario-B removal, so a full-file revert was safe/equivalent to a
    surgical undo), then added an explanatory comment on top of the
    existing scenario-B doc comment recording BOTH the original removal
    reasoning and why it's back (rather than silently reverting a
    documented decision with no trace of why). Regenerated `trace.json` via
    `npx vite-node functional-model/scripts/run-scenarios.mjs
    --slug=summon-bahamut` — came out byte-identical to the already-checked-
    in `HEAD` version of `trace.json` (2 scenarios), confirming this
    "restore" is a genuine no-op relative to committed history, not a new
    trace shape.
  - Verified: `verify-synergy.mjs summon-bahamut` → 0 hard failures (same
    pre-existing `tapForMana` soft notes only, now 18 instead of 9 since
    scenario B also casts Bahamut for {9} — expected, not a regression).
    Full-pool sweep: 313 checked, 1 hard failure — confirmed still only the
    pre-existing, unrelated `auron-s-inspiration` (Exile-zone produce gap).
    `npx vitest run functional-model` → 216/216. `npx tsc --noEmit -p
    functional-model/tsconfig.json` → 50 errors, same pre-existing count as
    every prior entry in this file. Real regenerated label, via
    `describeFact` against the actual authored fact object (not
    hand-typed): `destroy-act` → `"destroy"`.
  - **Open Forge-verification**: none needed — this is synergy-vocabulary/
    verify-synergy.mjs reconciliation-tooling plumbing + fact authorship +
    a scenario-coverage restoration, not new engine mechanics; the
    underlying `destroy`/`ceasesToExist` engine behavior in `harness.ts` was
    already correct (Forge-cited via CR 701.6/111.7/704.5d in its own
    existing comments) and untouched by this pass.

- **2026-09-10 (latest+3) — `-1` sentinel added to `Weight`, distinct from
  `undefined`.** `undefined` still means "predates the weight fields
  entirely" (unknown); `-1` now means "has a value field, but it's a
  hand-authored placeholder pending a real `compute-weights.mjs` pass," per
  explicit task ask.
  - `synergy.ts`: `Weight` widened to `-1 | 1 | 2 | 3 | 4 | 5`; `factTotal`
    changed from `fact.value ?? null` to `fact.value != null && fact.value >
    0 ? fact.value : null` — the ONE choke point every arithmetic consumer
    goes through (`InteractionMatch.theirTotal`, `server/api/graph-links.ts`'s
    `mineValue`/`theirValue`, both already `?? 1`-floor a `null`), so `-1`
    is excluded from weighting/combination math without touching any
    consumer. Raw `fact.value` (e.g. the Facts-table `AnnotatedFactRef`,
    line ~575) is untouched — still shows `-1` verbatim, which is the
    point (stays findable, doesn't silently disappear back to unset).
  - `compute-weights.mjs`: confirmed NO code change needed for the "does a
    future run resolve `-1` naturally" ask — the write-back step already
    never reads a fact's own existing `value` before overwriting it with a
    freshly computed one (only strips `role`/`weight`/`typeWeight`/
    `themeWeight`/`ease`, not `value`, then always sets `value: it.value`).
    Added a doc-comment clause making this explicit so nobody later "fixes"
    it with an unnecessary skip-if-negative guard.
  - `summon-bahamut/synergy.json`: checked `git diff HEAD` on the file to
    tell "hand-typed placeholder this session" apart from "already went
    through a real compute-weights.mjs pass, just happens to also be 1"
    (self-battlefield/self-dies/self-sacrifice-graveyard's `value:1` all
    trace to the 2026-09-05 commit that also gave destroy-nonland:4/
    chapter-iii-draw:4/chapter-iv-damage:5 their real computed values — same
    batch, so their neutral 1s are real "no magnitude concept" outputs, not
    placeholders — left alone). Switched to `-1`: `self-cast`, `self-enters`,
    `self-counters`, and the new event-fact `self-sacrifice` (NOT
    `self-sacrifice-graveyard`, the older zone fact it was renamed from,
    which keeps its real historical `1`) — all four are net-new facts
    authored by hand earlier this session with a typed-in `value: 1` never
    run through the real script.
  - `SYNERGY_DESIGN.md`'s weighting section got a short addendum + a flag
    that the `ease`/`strength` prose above it is stale (predates the
    single-`value` collapse) — not rewritten, out of scope for this task,
    but worth a real pass sometime.
  - `ValueBar.vue` (app/components) already had a matching `<= 0` ⇒
    "no value to show" guard by the time I got to it — a concurrent/peer
    change (not made by me), confirmed via `git status`/`git diff` showing
    it modified without my touching it. Didn't duplicate the work.
  - Verify: `npx vitest run functional-model` (216 tests) and full
    `npx vitest run` (327 passed; the only failures are
    `scripts/relations.test.mjs`'s 5 ENOENT cases, unrelated pre-existing
    cwd/tagging-pipeline issue, not touched). `verify-synergy.mjs` full
    sweep: summon-bahamut still a clean `note` (not `FAIL`); the pool's one
    `FAIL` (auron-s-inspiration, an Exile-zone trace-matching gap) is
    unrelated and pre-existing. `npm run typecheck` exits 0.
  - **Open Forge-verification**: none needed — this was a data-model/
    sentinel-value change, no rules-engine behavior touched.

- **2026-09-10 (latest+2) — two more self-referencing facts on Summon:
  Bahamut (`self-enters`, `self-sacrifice`), plus a `verify-synergy.mjs`
  refactor to support them.** Confirmed the parallel task's `self-counters`
  (LORE `putCounter`) fact had already landed in `synergy.json` before
  starting — not duplicated.
  - `self-enters`: `{event:'entersBattlefield', target:'self'}` — bare
    "enters the battlefield" label already existed in `describeFact`
    (synergy.ts:503), just unused by any fact until now. Traceable for
    free — harness.ts's `lifecycleBefore`/engine-trace.ts's
    `pilotCast`/`pilotResolveTop` already emit `{fn:'enters', zone:
    'Battlefield', ...}` for every permanent resolving onto the
    battlefield (`producedZone` already read this fn for the zone-presence
    side); the actual gap was `producedEvent` in verify-synergy.mjs having
    no case translating `fn:'enters'` into an `entersBattlefield` EVENT
    fact — added one (`{event:'entersBattlefield', side:'you'}`, matching
    `moveTo`'s existing zone==='Battlefield' case for the same event).
  - `self-sacrifice` (event fact, `{event:'sacrifice', target:'self'}`) —
    the card ALREADY had an id `self-sacrifice` for a *different*,
    pre-existing fact (a `zone:'Graveyard'` presence fact named for WHY —
    the saga's forced sacrifice — not WHAT it is). Renamed that one to
    `self-sacrifice-graveyard` and gave the new literal-sacrifice-event
    fact the (now free) `self-sacrifice` id, mirroring `self-dies`/
    `self-cast`'s own "id names the event" convention. `sacrifice`'s bare
    label already existed in `describeFact` (synergy.ts:555, from Gold
    Saucer's own cost-only sacrifice fact, 2026-09-09).
  - **Real gap found and fixed**: `producedEvent(entry, cardName)` in
    verify-synergy.mjs was a switch returning ONE `{event,...}` object per
    log entry — but `fn:'sacrifice'` already had a case producing `dies`
    (for `self-dies`-shaped facts pool-wide), and now ALSO needs to
    produce `sacrifice` (CR 701.20a — sacrificing IS dying, by a specific
    cause; both are simultaneously true of the same action). Refactored
    `producedEvent` → `producedEvents`, returning an ARRAY (every other
    case just wraps its old single object in a 1-element array; only
    `sacrifice` now returns two: `dies` AND `sacrifice`). Updated both call
    sites (forward produce-evidence check, reverse action-explained check)
    to use `.some(...)` across the array instead of a single equality
    check. Confirmed this doesn't regress `self-dies`-shaped facts
    elsewhere in the pool: Bahamut's own `self-dies` fact evidence
    actually comes from a separate `ceasesToExist`/`destroy` trace entry
    (chapter I's Treasure kill), not the `sacrifice` fn entry, and the
    full-pool sweep confirmed zero new failures pool-wide either way.
  - Verified: `verify-synergy.mjs summon-bahamut` — 0 hard failures (same
    pre-existing `tapForMana` soft notes only). Full-pool sweep — 313
    checked, 1 hard failure (still only the pre-existing unrelated
    `auron-s-inspiration`), same as always. `npx vitest run
    functional-model` — 216/216 passing, no new/changed test needed (no
    new `describeFact` branch, no new synergy.ts vocabulary — both facts
    reused existing bare-label branches). `app/lib/factConditions.ts`
    needed NO update (unlike the earlier `damage`/`recipient` case) — both
    new facts' fields (`id`/`event`/`target`/`value`/`sourceText`/
    `highlight`) are all already in its generic `HANDLED_OR_LABEL_KEYS`
    allowlist and `isSelfReferencing`'s generic `target === 'self'` check,
    so "self" renders in the notes column with no card-specific wiring.
  - **Open Forge-verification**: none needed — this is synergy/vocabulary
    plumbing (a verify-synergy.mjs reconciliation-tooling fix + fact
    authorship), not new engine mechanics; Bahamut's real `entersBattlefield`/
    `sacrifice` engine behavior was already correct and unchanged.

- **2026-09-10 (latest+1) — fixed a missed `putCounter` `target:'self'` suffix
  the earlier bare-label pass (entry directly below) didn't catch, surfaced by
  the newly-authored `self-counters` fact on summon-bahamut's own
  `synergy.json`.** That earlier pass correctly dropped `putCounter`'s
  `controller`-derived suffix ("on permanents you control"/"...an opponent
  controls") but missed a SEPARATE `target === 'self'` branch that appended
  "on itself" — no prior fact in the pool exercised `target:'self'` on a
  `putCounter` fact until summon-bahamut's `self-counters` (LORE counter,
  Saga chapter mechanic) was authored this session, so the bug was latent,
  never caught by the earlier pass's own pool-wide verification. Fixed by
  deleting the `target === 'self'` branch entirely — `putCounter` now always
  renders bare `` `${counterType} counters}`.trim() `` (e.g. "LORE counters"),
  matching `cast`'s own already-bare self-referencing treatment ("cast a
  spell", never "cast a spell on itself") exactly, per the single-dimensional
  bare-label design. Verified real before/after via the actual
  `self-counters` fact object (not a hand-typed guess): `describeFact` went
  from `"LORE counters on itself"` → `"LORE counters"`. Updated
  `synergy.test.ts`'s own `putCounter` describe block (3 assertions that
  expected the old "... on itself" suffix, including one exercising the real
  summon-bahamut shape with `controller` + `target:'self'` both present).
  Verified: `npx vitest run functional-model` 216/216 clean; full-pool
  `verify-synergy.mjs` sweep unchanged (313 checked, 7 skipped, still exactly
  1 pre-existing unrelated hard failure, `auron-s-inspiration`).
  **No Forge verification needed** — pure label-templating fix in card-facing
  text, no `interfaces.ts`/engine-mechanics change.

- **2026-09-10 (latest) — closed the last 4 inconsistent `describeFact`
  branches (`synergy.ts`) with the same bare-label treatment battlefield/
  graveyard presence, dying, damage, sacrifice, putCounter, and the generic
  fallback already got earlier this session**: `lifegain` (was
  `"${describeSide(controller)} life gain"` → now bare `'life gain'`),
  `addMana` (was `"${describeSide(controller)} mana production"` → now bare
  `'mana production'`), and a QUALIFIED zone fact (a `types`/`cmc`
  constraint on the fact's own top-level fields — `wants: {zone:
  Battlefield, types:{has:['Equipment']}}`-shaped) which used to render full
  oracle-text-style phrasing ("creature permanents you control on the
  battlefield", "creature cards in your graveyard") and now collapses to the
  exact same bare `"<zone> presence"` the unqualified case already used
  (this was flagged as a real, open exception in the function's own doc
  comment from earlier this session — now closed, not left inconsistent).
  Removed now-dead helpers this deletion made unused: `describeSide`,
  `constraintBits`, `ZONE_NOUN` (kept `ZONE_PRESENCE_PHRASE`, still used).
  `controller`/`types`/`cmc` themselves are untouched — still real, intact
  fields on every `Fact`; only the label templating changed. Confirmed via
  `app/lib/factConditions.ts` (card-owned, already generic per its own doc
  comment) that the notes/conditions column actually surfaces this detail
  for REAL non-fin/1 cards, not just checked in the abstract: Adelbert
  Steiner's own `event:'lifegain'` fact → label `'life gain'`, notes
  `'yours'`; its own qualified `{zone:Battlefield, types:{has:['Equipment']}}`
  want → label `'battlefield presence'`, notes `'yours · equipment
  permanents'`; Llanowar Elves' own `addMana` fact → label `'mana
  production'`, notes `'yours · G mana'`; Ardyn, the Usurper's own
  `{zone:Graveyard, controller:'opp', types:{has:['Creature']}}` want →
  label `'graveyard presence'`, notes `"opponent's · creature cards"`.
  `synergy.test.ts` updated to match (old qualified-zone/lifegain/addMana
  assertions rewritten to bare; the old dedicated "constraintBits / qualifier
  building" describe block for zone facts retired with a pointer to
  `factConditions.test.ts`, which already covers that constraint-rendering
  vocabulary card-side). Full pool `verify-synergy.mjs` sweep: 313 checked,
  7 skipped, 1 hard failure (`auron-s-inspiration` — confirmed via stash/
  unstash to be a PRE-EXISTING, unrelated produce/trace-evidence gap, not
  caused by this change). Full `functional-model` + `factConditions.test.ts`
  suite (235 tests) and `tsc --noEmit` both clean.
  **No Forge verification needed** — pure label-templating/vocabulary
  cleanup in card-facing text, no `interfaces.ts`/engine-mechanics change.
  All 3 remaining `describeFact`/`app/lib/factConditions.ts`-boundary items
  from `.claude/contracts/card-schema.md`'s own flagged violation ("engine-
  owned label-templating logic ... imported ... by the card page") are
  unaffected by this pass — still open, not touched here, per that
  contract's own "not urgent" framing.

- **2026-09-10 (later still) — authored the actual `self-cast` fact onto
  summon-bahamut (fin/1), the card the earlier "cast a spell" vocabulary
  research this same day was done FOR but never instantiated.** Added
  `{id:'self-cast', event:'cast', target:'self', value:1, sourceText:...}`
  as the first `source` entry in `cards/summon-bahamut/synergy.json`
  (before `self-battlefield`, matching `self-dies`/`self-sacrifice`'s own
  bare-parenthetical `sourceText` style, no `highlight`). Trace-level
  support (`harness.ts`'s `lifecycleBefore`/`engine-trace.ts`'s `pilotCast`
  logging `fn:'cast'`) was already real and unchanged — confirmed by
  regenerating `trace.json` via `run-scenarios.mjs --slug=summon-bahamut`
  (this incidentally also caught up a real, unrelated drift: the checked-in
  trace.json still had the second "forced self-destroy" scenario that
  `scenarios.ts`'s own comment already documented as removed earlier this
  session — regenerating dropped it, a legitimate catch-up, not caused by
  this fact).
  **Real gap found and fixed in `verify-synergy.mjs` (not just `synergy.json`
  authorship)**: a bare self-referencing `{event:'cast'}` SOURCE fact is a
  produce fact, verified through the file's forward "every declared produce
  needs supporting trace evidence" path (`producedEvent()`), not through
  `TRIGGER_EVENT_MAP` (that map is want/trigger-name evidence only, and no
  trigger name is involved here at all) — but `producedEvent()` had no
  `case 'cast'` branch (only `IGNORED_FNS` had `'cast'`, which just
  exempts it from the unrelated REVERSE "explain every action" soft-note
  pass), so the fact would have hard-failed verification with zero engine
  changes. Added `case 'cast': return { event: 'cast', side: 'you' };` to
  `producedEvent()` (scripts/verify-synergy.mjs), mirroring `playLand`'s own
  unconditional `side:'you'` immediately above it (harness/engine-trace's
  own `cast` log line carries no `controller`/`player` field — it's always
  the scenario's own 'you' pilot casting the card under test). Verified:
  `verify-synergy.mjs summon-bahamut` → 0 hard failures (only pre-existing,
  unrelated soft notes: `tapForMana`, LORE `putCounter`); full-pool run →
  same single pre-existing hard failure as before my change
  (`auron-s-inspiration`'s unrelated Exile-zone produce gap, confirmed via
  `git stash` that it predates this change) — my `producedEvent` addition
  is event-only and provably can't touch that card's zone-shaped failure.
  Full suite (222 tests) + `tsc --noEmit` clean.
  Confirmed live: `/api/card/fin/1`'s `functionalModel.synergy.source[0]`
  now serves the `self-cast` fact, and `describeFact(fact)` returns
  `"cast a spell"` directly (the bare, flat label per this session's
  single-dimensional design decision above — no creature/noncreature
  variation). **Not independently confirmed in an actual browser render**
  (no screenshot/browser tool available to this specialist) — verification
  is via the same API response + `describeFact()` call the Facts tab
  itself consumes, which is the full data contract the UI renders from;
  the card agent/orchestrator should do a final visual pass if a literal
  screenshot is wanted.
  **Open Forge-verification**: none needed — this is a synergy-vocabulary/
  verification-script addition, not new engine mechanics; the underlying
  `cast` lifecycle behavior (`harness.ts`/`engine-trace.ts`) was already
  correct and untouched.


- **2026-09-10 (yet later same day): user decided the Facts-tab label design
  is fully bare/single-dimensional — this PARTIALLY REVERSES the very next
  entry below (`cast`/`dies` fix) AND the "damage direction"/"either
  player's" side-prefix work from the task before that one.** Every
  `describeFact` label is now just the bare category noun/phrase for its
  zone/event kind ("battlefield presence", "dying", "damage", "graveyard
  presence", "sacrifice", plain `event` string) — no `describeSide`/
  `'your '`/`"opponent's"` WHO-prefix, and (per an explicit mid-task
  correction from the coordinator) no type-derived WHAT-KIND-noun either
  (a `dies` fact with `target:{types:{not:['Land']}}}` now renders "dying",
  not "nonland permanent dying"). Underlying `controller`/`recipient`/
  `target` fact DATA is untouched — a parallel `card`-agent task
  (`app/lib/factConditions.ts`) surfaces that in the notes/conditions column
  instead. Branches touched: zone-presence unqualified (bare `<zone>
  presence` regardless of `controller`), `dies` (always bare "dying"),
  `putCounter` (dropped the `controller`-derived "on permanents you
  control"/"...an opponent controls" suffix; KEPT `counterType`, e.g. "+1/+1
  counters" — treated as the counter's own real mechanic/category, not a
  who/what-kind qualifier, matching the orchestrator's own explicit
  instruction on this one field), `damage` (bare "damage", dropped both the
  dealer prefix and `recipient` "to the opponent"/"to you" suffix),
  `sacrifice` (bare "sacrifice", dropped both the `controller` prefix and
  its `types`-qualifier, e.g. "artifact sacrifice" → "sacrifice"), and the
  generic fallback (bare `event` string only, e.g. "land landfall" →
  "landfall"). `describeSide()` itself (including its `undefined` →
  "either player's" fallback) was NOT deleted — still genuinely used by
  `lifegain`, `addMana`, and the qualified non-Battlefield zone branch (`...
  in your/an opponent's/either player's <zone>`), none of which this task
  touched (see open question below). fin/1 (Summon: Bahamut) verified
  before/after via a real script run against `synergy.json` (not just
  reasoned about) — see PR/diff for the exact 8-fact table.
  - **Deliberately left untouched, flagged as an open follow-up, not
    silently inconsistent**: `lifegain`/`addMana`'s own `describeSide`
    prefix (e.g. "your life gain", "an opponent's mana production") and the
    qualified-zone branches' own type+control phrasing (e.g. "creature
    permanents you control on the battlefield", "creature cards in your
    graveyard") both predate this session entirely and were never in this
    task's explicit branch list — left as-is rather than unilaterally
    expanding scope, but they're now visibly inconsistent with every other
    label in the same Facts-tab column being fully bare. Worth a real
    follow-up decision: either extend the same bare-label treatment to
    these two remaining spots, or explicitly accept zone-with-type-
    constraint and lifegain/addMana as permanent exceptions.
  - Updated `synergy.test.ts` assertions for every touched branch (the
    zone-presence "you"/"opp" tests, `dies`, `putCounter`'s controller
    suffix test, `sacrifice`, the generic-fallback/landfall test, and the
    whole `damage` describe block) to expect the new bare output; did NOT
    touch `lifegain`/`addMana`/qualified-zone tests (untouched branches).
    Full suite green: `npx vitest run functional-model/` → 222/222 passed.
    `npx tsc --noEmit -p functional-model/tsconfig.json` shows the exact
    same pre-existing errors before and after this change (verified via
    `git stash`) — all in unrelated card `definition.ts` files
    (`.ts`-import-extension TS5097, implicit-any TS7034/7005) and
    `synergy.test.ts` lines 28-74 (an unrelated `event`-property-typing
    issue in a different describe block, pre-existing) — zero new errors
    introduced.

- **2026-09-10 (later same day): added a generic `cast` event kind +
  fixed two `describeFact` mislabels found live on fin/1 (Summon: Bahamut),
  scoped ONLY to `synergy.ts`/`synergy.test.ts` per explicit orchestrator
  instruction (no other cards, no `verify-synergy.mjs` `TRIGGER_EVENT_MAP`
  wiring, no retroactive per-card authoring — all deferred).**
  - **`cast`**: `EventFact.event` was already a loose `string` (confirmed,
    no type change needed) — added ONE `describeFact` branch,
    `if (event === 'cast') return 'cast a spell';`, deliberately flat and
    ignoring any `Constraints.types`/`target` the fact might carry for
    WORDING purposes (type-specificity for a future sink — "wants
    specifically a creature spell cast" — stays real MATCHING data, per
    the user's own explicit "Creature and whatnot is not needed here"
    instruction). No card's `synergy.json` authored with `cast` yet — this
    is vocabulary-only, for fin/1's own future use. Existing
    `castCreatureSpell`/`castNoncreatureSpell`-shaped camelCase event
    strings elsewhere in the pool are UNRELATED and untouched.
  - **`dies` mislabel (real bug, not fin/1-specific)**: `describeFact`'s
    `dies` branch hardcoded the noun "creature" regardless of what the
    fact's own `target` `Constraints` object actually said — Summon:
    Bahamut's `destroy-nonland` fact (`target:{types:{not:['Land']}}}`,
    i.e. "destroy up to one target NONLAND permanent") rendered as "either
    player's creature dying", never mentioning Creature at all. Fixed by
    deriving the qualifier/noun from `fact.target` via the SAME
    `constraintBits` helper every zone-fact label already reuses (not a
    one-off string) — a `target` constraint present widens the noun to
    "permanent" (dies is CR-glossary creature-only by default, so an
    absent/bare target still says "creature", unchanged); a real
    `types.not` constraint renders "nonland"/"noncreature nonland" etc.
    **Root cause was one level deeper than just the `dies` branch**:
    `constraintBits` itself had NO `not`-handling at all (only
    `has`/`hasAny`/`cmc`) — so every OTHER card in the pool with a
    `types.not` constraint directly on a zone/event fact (not under
    `target`) was ALSO silently losing that qualifier from its label
    (checked via `grep '"not"' cards/*/synergy.json`: lunatic-pandora,
    white-auracite, summon-esper-ramuh, elrond-moon-reader, elixir,
    the-emperor-of-palamecia-the-lord-master-of-hell,
    venat-heart-of-hydaelyn-hydaelyn-the-mothercrystal,
    fate-of-the-sun-cryst — e.g. lunatic-pandora's sink `{types:{not:
    ['Land']}}}` rendered as bare "battlefield presence" before this fix,
    now "nonland permanents on the battlefield"). Added the generic `not`
    case to `constraintBits` itself (`non${type.toLowerCase()}`, joined
    per type — "nonland", "noncreature nonland" for a 2-item list), which
    is what actually fixed ALL of the above, `dies` included — this is a
    shared-code fix with pool-wide label-rendering fallout, NOT retroactive
    per-card `synergy.json` authoring (no `.json` files touched, only
    `synergy.ts`'s rendering function) — flagged in case the pool-wide
    rendering change itself needs a second look.
  - **`damage` fact direction — flagged back, NOT fixed, per explicit
    instruction not to invent schema on my own judgment.** Checked every
    real `event:'damage'` fact in the pool (23 cards): `controller` is
    `'you'` on 100% of them — it names the CASTER's side, never the
    recipient. There is no field anywhere on `EventFact` capturing "which
    player receives the damage" (`target` is `'self'|Constraints`, used
    for TARGETED-creature filters like Nibelheim Aflame/Self-Destruct's own
    `target:{types:{has:['Creature']}}}` — there's no way to express "the
    opponent player" as a `Constraints`-satisfying object, `Constraints`
    only describes card/permanent objects). Bahamut's own Mega Flare fact
    (`{event:'damage', controller:'you'}`) genuinely cannot say "to each
    opponent" today — the data doesn't carry it, so the label can't either
    without inventing a new field. **Note this is a real, load-bearing
    inconsistency worth the user's attention**: `lifeloss`'s own
    `controller` already means the OPPOSITE thing pool-wide (the RECIPIENT
    — summon-primal-odin's own two `lifeloss` facts, `controller:'you'`/
    `'opp'`, model "each player loses life" as two distinct facts keyed by
    who loses) — so `damage.controller` and `lifeloss.controller` are two
    different semantics under the same field name today. Left the
    `damage` fact/label completely untouched pending the user's own call
    on how to extend the schema (a `recipient?: Side` field on `EventFact`,
    reusing `target` some new way, or something else) — flagging rather
    than picking one unilaterally, per the task's own explicit instruction.
  - **Verified**: `npx vitest run functional-model` 224/224 (was 219 before
    this session's earlier controller-phrasing pass + this pass's own 5 new
    assertions: 3 for `dies`+target-constraint, 1 for `cast`, 1 for
    `constraintBits`'s `not` case — all passed on the FIRST run). Full-pool
    `verify-synergy.mjs` sweep unchanged (still exactly 1 pre-existing
    unrelated hard failure, `auron-s-inspiration`; summon-bahamut's own
    pre-existing soft notes — 9 `tapForMana`, 4 LORE `putCounter` —
    byte-identical). `tsc --noEmit -p functional-model/tsconfig.json`: 50
    errors before AND after (confirmed via a throwaway reconstructed
    "before" copy of `synergy.ts`, NOT `git stash` — today's working tree
    already carries substantial uncommitted engine work from earlier
    sessions today, predating this task, so a straight `git stash`/HEAD
    diff would have wrongly reverted THAT too; used a hand-reconstructed
    pre-edit copy of `describeFact`/`constraintBits` instead, scratchpad
    `synergy-before.ts`, to get a true isolated before/after for fin/1's
    own Facts). Real regenerated fin/1 (Summon: Bahamut) Facts, both real,
    via `describeFact` against the actual unmodified `synergy.json` (no
    `.json`/`definition.ts`/`scenarios.ts` touched, so no `trace.json`
    regeneration needed):
    - `destroy-nonland`: `"either player's creature dying"` → `"either
      player's nonland permanent dying"`
    - `chapter-iv-damage`: `"your damage"` → unchanged (flagged above)
    - `cast a spell`: new vocabulary, not yet used by any fact
    - every other fin/1 fact unchanged (`self-battlefield`,
      `chapter-iii-draw`, `self-sacrifice`, `self-dies`, `mega-flare-you`,
      `mega-flare-opp`).
  - Open Forge-verification: none — pure synergy-matching label/vocabulary
    change, no rules-engine behavior touched.

- **2026-09-10: removed `summon-bahamut`'s second scenario (forced
  self-destroy corner case) on the user's own call that it added no
  distinct coverage.** Checked before deleting, per the scenario-content
  rule: the only genuinely NEW thing scenario B exercised vs scenario A
  was chapter I's "destroy" targeting Bahamut itself when it's the sole
  legal nonland permanent on an otherwise-empty board (scenario A instead
  has chapter I hit a real opponent Treasure via `preferTarget`, then
  chapter II decline). Verified via `verify-synergy.mjs` internals
  (`producedEvent`'s `ceasesToExist`/zone==='Graveyard' case) that the
  synergy.json `destroy-nonland` source fact (`{event:'dies',
  target:{types:{not:['Land']}}}`, no `controller`) is side-agnostic —
  scenario A's own Treasure kill (logged as `ceasesToExist`, not
  `destroy`, per 704.5d) already fully backs it, so scenario B's unique
  `fn:'destroy'` log line was never load-bearing evidence. Removed
  `scenarioB` from `functional-model/cards/summon-bahamut/scenarios.ts`,
  regenerated `trace.json` via `run-scenarios.mjs --slug=summon-bahamut`
  (1 scenario now, was 2). `synergy.json` untouched (hand-authored,
  unaffected). Confirmed via `git stash`/pop diff that
  `verify-synergy.mjs`'s summon-bahamut soft-note set (9 pre-existing
  `tapForMana`-unrecognized + 4 pre-existing `putCounter`/LORE-unmatched
  notes) is byte-identical before/after — no new failures, full-pool sweep
  unchanged (still only the 1 pre-existing unrelated `auron-s-inspiration`
  hard failure), `npx vitest run functional-model` 219/219 unchanged.

- **2026-09-10: `describeFact()`'s `controller` phrasing made explicit
  everywhere — display-string change only, matching logic (`Side`,
  `sidesCompatible`, `effectiveController`) untouched.** Root problem: an
  unqualified zone-presence fact with `controller:'you'` was rendering
  IDENTICALLY to one with `controller` omitted ("battlefield presence"
  either way) — a real, silent collapse, not just a stylistic gap. Also
  found (via a full-pool grep, not guesswork) that `controller` was being
  read for zone/`putCounter`/`sacrifice` facts but completely IGNORED by
  a huge swath of event facts falling through the generic
  `` `${qualifier}${event}` `` fallback — `damage` (23 facts),
  `grantKeyword` (20), `lifeloss` (18), `landfall` (9), plus
  `graveyardLeaves`/`castCreatureSpell`/`scry`/`surveil` — 73 of 75 such
  facts in the pool DO declare a real `controller` that was silently
  dropped. Worst concrete case: `summon-primal-odin` has two `lifeloss`
  facts, `controller:'you'` and `controller:'opp'` (Odin's own "each
  player loses X life" modeled as two distinct facts) — both rendered as
  the bare, indistinguishable string `"lifeloss"` before this fix.
  - Changes, all in `functional-model/synergy.ts`:
    - Unqualified zone-presence branch: added the missing `controller ===
      'you'` case (`` `your ${presence}` ``) alongside the existing `'opp'`
      case; omitted stays bare (means "either player," now genuinely
      distinct from `'you'` instead of colliding with it).
    - `describeSide()`'s undefined-controller fallback changed from bare
      `'a'` (ambiguous — "a graveyard" reads like "some specific unstated
      graveyard," not clearly "either") to `"either player's"` — feeds
      `lifegain`/`dies`/`addMana`/non-Battlefield-qualified-zone labels.
    - `putCounter` branch: added a `controller`-aware suffix (`" on
      permanents you control"` / `" on permanents an opponent controls"`)
      for the non-`target:'self'` case — `controller` here names who
      controls the RECIPIENT permanent (Minwu's "each Cleric you control,"
      Ice Flan's opponent-controlled stun target), not the caster; used
      `"permanents"` not `"creatures"` since Clash of the Eikons's own LORE
      counters target a Saga, not a creature (same reason the `target`
      type constraint itself stays unrendered — see this function's own
      doc comment).
    - `sacrifice` branch: added the same `"your "`/`"opponent's "` prefix
      every other branch now has (only `'you'` exists in the pool today,
      but the label shouldn't silently drop a future `'opp'` one either).
    - Generic fallback (everything not explicitly branched — `damage`,
      `lifeloss`, `grantKeyword`, `landfall`, etc.): added the same
      `"your "`/`"opponent's "` prefix; bare stays reserved for a fact that
      genuinely omits `controller` (Louisoix's Sacrifice's own
      side-agnostic `counter` event, e.g.), not a silent default.
    - Explicitly did NOT touch `activateAbility`/`entersBattlefield`/
      `playLand`/`coinFlip`/`drawCard`/`drawCards` — every real
      `controller` on these events is `'you'` (100% of the pool, no `'opp'`
      example exists) AND the event is inherently self-scoped (`subject:
      'self'`/an ability of the card's own), so `controller` there is a
      tautological annotation, not a discriminator the way it is for
      zone-presence/`putCounter`/the generic fallback's own events, and a
      grammatical rewrite like "your enters the battlefield" would be a
      real wording redesign, not the "display-string change ONLY" this
      task asked for. Flagging in case a future card breaks that 100%
      assumption.
  - Test updates in `functional-model/synergy.test.ts`: fixed the ONE test
    (`Battlefield — controller "you"`) that was asserting the OLD collapsed
    behavior as correct-by-design ("you is the default, stays unstated" —
    that was the bug, not a real design choice, despite reading like one);
    updated every other test asserting the old bare `'a'`/no-prefix
    behavior for a genuinely-undefined controller to the new
    `"either player's"` phrasing; added new real-shape coverage for
    `putCounter`+`controller` (Minwu/Ice Flan shapes), `sacrifice`+`'opp'`,
    and the generic fallback's `lifeloss`/`damage` (previously zero
    coverage of controller on any of these). All net-new/updated
    assertions describe real card shapes already in the pool, not invented
    ones.
  - Verified: `npx vitest run functional-model` 221/221 (219 prior + 2 net
    new), full `npm run test` unchanged (same 5 pre-existing unrelated
    `tagging/*` failures), `verify-synergy.mjs` full-pool sweep unchanged
    (still exactly 1 pre-existing unrelated hard failure,
    `auron-s-inspiration` — label rendering isn't part of what it checks
    anyway, matching logic wasn't touched), `tsc --noEmit -p
    functional-model/tsconfig.json` — exactly 50 errors before AND after
    (confirmed via `git stash`/pop diff on the error count) — zero new type
    errors. Also confirmed real before/after label output via a throwaway
    `vite-node` script (not hand-typed) reading actual `synergy.json` for
    `minwu-white-mage`/`ice-flan`/`the-gold-saucer`/`clash-of-the-eikons`/
    `golbez-crystal-collector`/`summon-primal-odin` through both the old
    (stashed) and new `describeFact` — e.g. `summon-primal-odin`'s two
    `lifeloss` facts went from both-identical `"lifeloss"` to distinct
    `"your lifeloss"` / `"opponent's lifeloss"`.
  - Open Forge-verification: none — pure display-string wording, no rules
    behavior or fact schema touched.

- **2026-09-09 (Gold Saucer, fourth follow-up): 3 annotation gaps + 1 new
  fact, per user's own card-page review** — (1) `mana` fact's `highlight`
  widened `"{C}"` → `"Add {C}"`. (2) both Treasure-token facts
  (battlefield-presence, entersBattlefield) got `sourceText`/`highlight`
  added (same `sourceText` as `coin-flip`, `highlight:"create a Treasure
  token"`) — previously had neither. (3) new `source` fact:
  `{event:'sacrifice', controller:'you', types:{has:['Artifact']}, ...}` —
  the ACT of sacrificing, parallel to how `coinFlip` models the
  deterministic flip separately from its outcome; distinct from the
  existing `Battlefield`/`types:{has:['Artifact']}` sink fact (wants vs.
  performs). Also gave the sink fact a `highlight:"two artifacts"` it
  didn't have before.
  - `describeFact` got a new `sacrifice` branch: `` `${qualifier}sacrifice`.trim() ``
    — deliberately reuses the shared `constraintBits` qualifier machinery
    instead of hardcoding "artifact," so it renders "artifact sacrifice"
    for Gold Saucer's own `types:{has:['Artifact']}` and stays correct for
    a differently-typed sacrifice on some future card. Verified directly
    (real fact object → "artifact sacrifice") and via 2 new
    `synergy.test.ts` assertions (with/without a `types` qualifier),
    folded into the `describeFact` coverage added earlier this session.
  - `verify-synergy.mjs` got `isCostOnlyArtifactSacrificeFact` — the
    produce-side sibling of `isCostOnlyArtifactSacrificeWant`, reusing the
    exact same `hasCostOnlyArtifactSacrifice` predicate, scoped identically
    (only `{event:'sacrifice', types:{has:['Artifact']}}` on a card whose
    sacrifice cost is genuinely unmodeled as a real effect — a card whose
    sacrifice IS modeled, e.g. ahriman/phantom-train/quina-qu-gourmet,
    still needs real trace evidence for its own `sacrifice` fact, no
    change there).
  - Re-verified: `the-gold-saucer` OK on its own, full `verify-synergy.mjs`
    sweep unchanged (still 1 pre-existing unrelated hard failure,
    auron-s-inspiration), `npx vitest run functional-model` 219/219 (218
    prior + 1 new test), full `npm run test` unchanged (same 5
    pre-existing unrelated `tagging/*` failures).

- **2026-09-09: added real unit test coverage for `describeFact`
  (`functional-model/synergy.ts`) to `functional-model/synergy.test.ts`** —
  previously ZERO tests existed for it despite it being hand-fixed via
  manual browser inspection 4 times this session (`playLand` trailing
  period, `entersBattlefield` tapped-redundancy, `types.has`
  capitalization, `coinFlip` label). Covers every branch: all 6 zones'
  unconstrained "<zone> presence" phrasing (incl. the Exile
  `ZONE_PRESENCE_PHRASE` override and confirming it does NOT apply once a
  qualifier is present), the Battlefield-with-control-qualifier branch, the
  non-Battlefield qualified branch, every named event (`lifegain`, `dies`
  both target shapes, `putCounter` with/without `target:'self'`/
  `counterType`, `drawCard`/`drawCards`, `entersBattlefield`, `playLand`,
  `activateAbility`, `addMana`, `coinFlip`), the generic
  `${qualifier}${event}` fallback, and `constraintBits` (`types.has`
  lowercased, `types.hasAny` parenthesized-original-casing, `cmc` min/max/eq
  variants). Also added a bulk "label convention" regression guard (every
  representative fact's label matches `/^[a-z(]/` and never ends in
  `.`/`!`/`?`) plus two explicit non-leak assertions (`addMana` never
  contains its own color letters, `entersBattlefield` never contains
  "tap") — this is what would have caught all 4 of this session's
  hand-fixed bugs automatically. `zf`/`ef` are tiny local fixture builders
  (id/role are irrelevant to `describeFact` itself). All 42 new
  assertions passed on the FIRST run (confirms the derivations matched
  the real implementation, not a rewrite-to-fit). Verified: `npx vitest
  run functional-model` 218/218 (181 prior + 37 new test cases — the
  existing 5 `EventFact.colors` tests were already in the 181), full
  `npm run test` unchanged (same 5 pre-existing unrelated `tagging/*`
  failures). Confirmed via `tsc --noEmit` that the new test block adds
  zero NEW type errors (the file already had 7 pre-existing ones in the
  untouched `EventFact.colors` block, unrelated to my new code, unchanged
  before/after).

- **2026-09-09 (later same day): added explicit, author-set `Fact.face?: 'front'
  | 'back'` to `synergy.ts` and backfilled it on every real multi-face card's
  synergy.json** — replaces the card page's own (peer `card`-agent-owned)
  oracle-text-matching heuristic for grouping a multi-face card's Facts table
  into "Main card"/"Other faces," which was confirmed WRONG for
  `sidequest-catch-a-fish-cooking-campsite`'s own front-face upkeep-trigger
  sink fact (its authored `sourceText` had a trailing "..." never in the real
  Scryfall oracle text, so the fact silently matched NEITHER face and fell
  into the fallback bucket despite genuinely belonging to the front face).
  **Shape chosen: `'front'|'back'` string, not a numeric faces-array index**
  — deliberately reused harness.ts's own pre-existing `Scenario.face`/
  `SequenceStep.face` vocabulary (same field name, same two values) rather
  than inventing a parallel numbering scheme, since `'front'` always maps to
  a card's own top-level `CardDefinition` and `'back'` to `.backFace` (see
  card.ts) — the same objects `resolveSubject('self', ...)` and
  `Scenario`'s own face-selection already treat as canonical. A future
  `card`-agent consumer maps `'front'`→`faces[0]`/`'back'`→`faces[1]`
  trivially. Field is on BOTH `ZoneFact` and `EventFact` (documented once in
  full on `ZoneFact`, `EventFact`'s copy is a `@see` shorthand, matching the
  existing `sourceText`/`highlight` convention) — NOT matched against
  anything by `factsInteract`/`themeOf` (purely documentary/rendering, same
  treatment as `sourceText`), so this is a genuinely additive, non-breaking
  schema change (confirmed: `npm run typecheck`, `vitest run functional-model`
  181/181, full-pool `verify-synergy.mjs` sweep all unchanged except the
  new-but-unenforced `face` field itself — same single pre-existing
  `auron-s-inspiration` hard failure as before this pass).
  **Discovery: 33 real multi-face cards exist in the pool** (every
  `definition.ts` that declares a real `backFace`), not just the 6 named in
  the task brief — found via `grep -rl backFace cards/*/definition.ts` (37
  hits), then hand-verified 4 were false positives (`fang-fearless-l-cie`,
  `summon-brynhildr`, `summon-fat-chocobo`, `summon-leviathan` — each only
  MENTIONS `backFace` in a comment citing another card, or explicitly
  documents NOT using it for its own real mechanic). Backfilled `face` on
  every fact in all 33 real ones' `synergy.json`, hand-classified per card by
  reading its own `definition.ts` (which effect/trigger actually produces or
  wants each fact — front's own top-level `triggers`/`effects` vs.
  `backFace`'s), not by re-running the same broken sourceText-matching
  heuristic this task exists to replace. Full list: balamb-garden-seed-
  academy-balamb-garden-airborne, cecil-dark-knight-cecil-redeemed-paladin,
  clive-ifrit-s-dominant-ifrit-warden-of-inferno, crystal-fragments-summon-
  alexander, dion-bahamut-s-dominant-bahamut-warden-of-light, emet-selch-
  unsundered-hades-sorcerer-of-eld, esper-origins-summon-esper-maduin,
  exdeath-void-warlock-neo-exdeath-dimension-s-end, garland-knight-of-
  cornelia-chaos-the-endless, ishgard-the-holy-see-faith-grief, jecht-
  reluctant-guardian-braska-s-final-aeon, jidoor-aristocratic-capital-
  overture, jill-shiva-s-dominant-shiva-warden-of-ice, joshua-phoenix-s-
  dominant-phoenix-warden-of-fire, kefka-court-mage-kefka-ruler-of-ruin,
  kuja-genome-sorcerer-trance-kuja-fate-defied, lindblum-industrial-
  regency-mage-siege, midgar-city-of-mako-reactor-raid, sephiroth-fabled-
  soldier-sephiroth-one-winged-angel, serah-farron-crystallized-serah,
  sidequest-card-collection-magicked-card, sidequest-catch-a-fish-cooking-
  campsite, sidequest-hunt-the-mark-yiazmat-ultimate-mark, sidequest-play-
  blitzball-world-champion-celestial-weapon, sidequest-raise-a-chocobo-
  black-chocobo, terra-magical-adept-esper-terra, the-emperor-of-palamecia-
  the-lord-master-of-hell, thranduil-sindarin-liege-silvan-rally, ultimecia-
  time-sorceress-ultimecia-omnipotent, venat-heart-of-hydaelyn-hydaelyn-
  the-mothercrystal, vincent-valentine-galian-beast, zanarkand-ancient-
  metropolis-lasting-fayth, zenos-yae-galvus-shinryu-transcendent-rival.
  **Generic "baseline" self facts (self-battlefield-presence/self-graveyard/
  self-dies with no real ability text) were assigned `'front'` by
  convention** — they're true regardless of which face is showing but
  `resolveSubject('self', ...)`/every other "which identity is canonical"
  convention in this file already treats the top-level `CardDefinition` as
  the default, so `'front'` for a genuinely face-agnostic baseline fact is
  consistent, not arbitrary.
  **Two genuinely ambiguous cards, flagged rather than silently resolved**:
  `sephiroth-fabled-soldier-sephiroth-one-winged-angel` and (one fact of)
  `sidequest-play-blitzball-world-champion-celestial-weapon` have a real
  mechanic DUPLICATED near-identically on both faces (Sephiroth: both front's
  `onCreatureDies` and back's `onAnyCreatureDies` are the same "any creature
  dies → opponents lose 1, you gain 1" shape; Blitzball: front's
  `pumpTarget` and back's Equip both equally want "a creature you control").
  A single `face` value can't represent "true of both" — picked `'front'`
  for all of Sephiroth's shared facts and the one shared Blitzball sink,
  consistent with the baseline-fact tie-break above, but this is a real
  approximation, not a clean single-face fact — worth a second look if the
  `card` page's own consumer ever needs to actually disambiguate these two
  specifically.
  **Contract file checked, not touched**: `.claude/contracts/card-schema.md`
  documents `synergy.json` only at the "source/sink facts" level, never
  enumerating `Fact`'s own internal field list — silent on this exactly the
  way it's silent on `id`/`sourceText`/`highlight` too, so no edit was
  needed; flagging per the task's own ask rather than assuming silence
  meant "forgot to check."
  **Explicitly did NOT touch** `app/pages/app/card/[set]/[number].vue` or
  `app/components/ReviewStatusBadge.vue` — a peer `card`-agent task owns
  wiring the page's grouping logic to read `fact.face` directly instead of
  its current oracle-text-heuristic; this pass is schema+data only.
  Open Forge-verification: none — this is a pure schema/authoring-metadata
  change, no rules-engine behavior touched, so no new Forge citation
  applies (every underlying `Effect`/`trigger` this pass read from was
  already Forge-cited in its own `definition.ts` from earlier sessions).


- **2026-09-09 (follow-up to the Town-cycle pass below): extended `mana.ts`'s
  `ManaColor` to include colorless (`C`) as a real value through the SAME
  WUBRG code path** (`manaAbilityColorFromStaticText`/
  `manaAbilityColorsFromStaticText` regexes widened to `[WUBRGC]`), per
  explicit user request — no longer deferred. Deliberately did NOT widen
  `COLORS`/`parseManaCost` (still WUBRG-only) — a permanent's mana ABILITY
  producing `C` is a different question from a SPELL's own cost containing
  a literal `{C}` pip, and only the former was asked for; the latter stays
  a real, separately-scoped, unchanged gap. `LAND_FOR_COLOR` had to become
  `Partial<Record<ManaColor,...>>` (TS exhaustiveness) since no basic land
  produces colorless here. Wrote the-gold-saucer's real `mana` fact
  (`color:'C'`) off this — now covered by the PRE-EXISTING addMana static
  exemption automatically, no new verify-synergy.mjs logic needed for this
  part (unlike crossroads-village's separate "choose a color" exemption).
  Updated mana.test.ts (1 pre-existing test asserted the OLD "not
  recognized" behavior — updated it to the new expectation, added 2 more
  cases). Checked blast radius before running full tests: none of the 6
  real "{T}: Add {C}." lands (capital-city/cavern-of-souls/starting-town/
  eclipsed-realms/clive-s-hideaway/the-gold-saucer) appear as filler in any
  OTHER card's or keyword bundle's scenarios.ts, so the only place
  `manaAbility='C'` newly flowing into `canAfford`'s generic-mana-coverage
  check could matter is each such card's own scenario (none of which
  invoke `canAfford`/`payMana` at all — confirmed). Verified broadly per
  the user's own ask: `npx vitest run functional-model` 181/181, full
  `npm run test` unchanged except the 3 new/updated mana tests (still the
  same 5 pre-existing unrelated `tagging/*`-missing-file failures), full
  `verify-synergy.mjs` sweep still exactly 1 pre-existing unrelated hard
  failure (auron-s-inspiration).
  - **Coin-flip/Treasure fact — proposed, NOT written, flagged back
    unresolved** (genuinely two options, not silently decided): checked
    for precedent — edgar-king-of-figaro's own "Two-Headed Coin" static
    ability gets NO fact at all, and Gold Saucer is the only OTHER
    coin/die-roll card in the whole pool, so there is zero precedent for a
    probabilistic-only ability getting any fact, atypical/low-value or
    otherwise. Structurally: `synergy.ts`'s `Fact`/`EventFact` has no field
    for "conditional/probabilistic, not guaranteed" — `value` (1-5) is
    explicitly documented as trace-computed MAGNITUDE only, not a
    certainty dimension, so repurposing a low `value` to mean "50/50"
    would conflate two different axes dishonestly. Mechanically: no
    scenario could ever produce real trace evidence for a `createToken`
    fact here without either (a) fabricating an unconditional Treasure-
    creation effect in definition.ts (directly contradicting that file's
    own explicit reasoning for why this stays static text, and going
    beyond "already correct, don't rewrite"), or (b) hard-failing
    verify-synergy.mjs (no exemption function of this shape exists, unlike
    the "known statically TRUE" exemptions elsewhere, which are the
    opposite justification). Two options laid out for the orchestrator/
    user rather than picked solo: (A) no fact at all (matches every
    existing precedent + the reconciliation design's own invariants,
    recommended), or (B) add a genuinely NEW schema capability
    (`probabilistic?: boolean` or similar on `EventFact`, PLUS a new
    verify-synergy.mjs exemption for it) — a pool-wide design decision
    that reaches beyond this one card, not something to introduce
    unilaterally for one card's sake.
  - **RESOLVED same day, per explicit user correction**: the ask was never
    about the probabilistic Treasure OUTCOME — it's about the coin FLIP
    itself, which the user correctly pointed out is NOT probabilistic at
    all: activating the ability always performs a flip, guaranteed by its
    own printed text, same class of claim as `playLand`/
    `entersBattlefield`. Wrote a real `{id:'coin-flip', event:'coinFlip',
    controller:'you', ...}` source fact (`EventFact.event` is already
    plain `string`, zero synergy.ts type change needed for the field
    itself). Two things this NEW event value needed, both added:
    1. `synergy.ts`'s `describeFact` — added a real `'coin flip'` label
       branch (would otherwise fall through to the generic `${event}`
       fallback and render literally as "coinFlip").
    2. `verify-synergy.mjs` — needed a NEW static exemption
       (`hasCoinFlipAbility`/`isCoinFlipFact`, right after
       `isSelfBattlefieldPresenceLand`, wired into the forward per-fact
       check next to `isSelfPlayableLand`): the flip's own occurrence is
       tautologically guaranteed by the ability's printed "Flip a coin"
       text existing at all (same reasoning class as
       `isSelfPlayableLand`/`isLandEntersTappedSelfFact`), so no
       scenario/trace evidence should be required — none could ever exist
       anyway (no coin-flip mechanism in this engine). Scoped to an exact
       "Flip a coin" substring match, since Gold Saucer is the only
       coin-flip card in the whole 313-card pool (checked) — no
       speculative generality added for a mechanism nobody else needs yet.
  - Re-verified after this closing round: `the-gold-saucer` OK on its own,
    full `verify-synergy.mjs` sweep unchanged (still 1 pre-existing
    unrelated hard failure, auron-s-inspiration), `npx vitest run
    functional-model` 181/181, full `npm run test` unchanged (same 5
    pre-existing unrelated `tagging/*` failures).
  - **Label wording follow-up**: `describeFact`'s `coinFlip` branch was
    initially `'coin flip'` (noun phrase) — corrected to `'flip a coin'`
    (verb phrase) per explicit user request, matching the `playLand`→
    `'play a land'` convention already established this session. Just the
    string, no other change.
  - **Third follow-up, same day — 3 more Gold Saucer facts requested from
    the card page directly**: (1) self battlefield-presence — already
    present, confirmed, untouched. (2) Treasure token's OWN battlefield
    presence — added `{zone:'Battlefield', controller:'you',
    subject:{token:'c_a_treasure_sac'}, value:1}`, mirroring
    zanarkand-ancient-metropolis-lasting-fayth's own Hero-token fact shape
    exactly (no id/sourceText) per the user's own explicit instruction —
    tracked as real regardless of the coin flip's outcome uncertainty,
    same "we don't care about probabilistic" stance as the coinFlip fact
    itself. (3) Treasure's ETB — added `{event:'entersBattlefield',
    controller:'you', subject:{token:'c_a_treasure_sac'}, value:1}` — a
    genuinely NEW pattern (checked: no other card in the pool has an
    `entersBattlefield` fact with a token subject, source OR sink side).
    (4) artifact-sacrifice sink, the one I'd previously recommended
    NOT adding — user explicitly overrode that; added
    `{zone:'Battlefield', controller:'you', types:{has:['Artifact']},
    value:1}`, matching ahriman/phantom-train/quina-qu-gourmet's own
    precedent shape (no id/sourceText).
  - New `verify-synergy.mjs` exemptions needed for (2)+(3)+(4), since none
    could ever get real trace evidence (no coin-flip mechanism, and the
    sacrifice cost is never modeled as a real effect — same reasoning as
    before, now deliberately overridden by explicit user instruction, not
    silently reversed):
    - `isCoinFlipTokenSubjectFact` (covers both (2) and (3), zone- or
      event-shaped either way) — gated specifically on
      `hasCoinFlipAbility`, NOT a general "any token-creating ability text
      is exempt" rule (that would wrongly also exempt real, resolvable
      token-creators like zanarkand/gysahl-greens from needing genuine
      scenario evidence — deliberately kept narrow).
    - `hasCostOnlyArtifactSacrifice`/`isCostOnlyArtifactSacrificeWant` for
      (4) — a card whose `activationCost` (checked both faces) matches
      "Sacrifice a/an/two artifact(s)" AND has no real `{kind:'sacrifice'}`
      effect gets the want for free, tautologically (same class as
      `isLandTapSelfWant`/`hasStaticLandTapSelfTrigger`). **Scope check
      done before writing**: `sidequest-catch-a-fish-cooking-campsite`'s
      own back face (Cooking Campsite) has the EXACT same cost-only-
      sacrifice-an-artifact shape (its own `knownGaps` already documents
      it unmodeled) — this new exemption would cover a matching want fact
      there too, but I did NOT touch that card (out of scope, not asked) —
      flagged in the-gold-saucer's own progress.json notes as a loose end
      worth revisiting if the user wants parity there.
  - Re-verified after all 3 facts: `the-gold-saucer` OK, full
    `verify-synergy.mjs` sweep unchanged (still 1 pre-existing unrelated
    hard failure), `npx vitest run functional-model` 181/181, full
    `npm run test` unchanged (same 5 pre-existing unrelated `tagging/*`
    failures).

- **2026-09-09: wrote real v2 `synergy.json` content for the 11 FIN Town-cycle
  lands whose synergy.json was still the empty `{"source":[],"sink":[]}` stub
  (baron-airship-kingdom, gohn-town-of-ruin, gongaga-reactor-town,
  guadosalam-farplane-gateway, insomnia-crown-city, rabanastre-royal-city,
  sharlayan-nation-of-scholars, windurst-federation-center, treno-dark-city,
  crossroads-village, the-gold-saucer) — an interrupted prior session had
  already written these 9 + crossroads-village's progress.json/scenarios.ts
  with a "verifySynergy: pass" story but never actually wrote the synergy.json
  itself. definition.ts was already correct for all 11, untouched.**
  - The 9 plain "enters tapped, {T}: Add X or Y" lands + crossroads-village:
    exact vector-imperial-capital template (played/battlefield-presence/
    enters-tapped/mana, all static exemptions in verify-synergy.mjs, no
    scenario needed). Cleared the 3 stale "no enters produce possible"
    knownGaps entries (sharlayan/windurst/treno) the same way
    vector-imperial-capital's own note already resolved it.
  - **crossroads-village's mana ability is "choose a color, {T}: Add one
    mana of the chosen color"** — no `any:true`-style field exists on
    `Constraints`/`TypeConstraint`; modeled it as `colors:{hasAny:['W','U',
    'B','R','G']}`, reusing the existing choice-of-color convention just
    widened to all five. To make this pass, **extended
    `verify-synergy.mjs`'s `staticManaColorsFor`** with a narrowly-scoped
    exemption recognizing the exact unique "{T}: Add one mana of the chosen
    color." text (checked: no other pool card uses this phrasing) as the
    same "known statically" shape the fixed single/choice-of-two case
    already gets — an engine-side script change, not just a synergy.json
    fact; flagged back to orchestrator as a judgment call since it's new
    exemption logic.
  - **the-gold-saucer** (enters untapped, unlike the other 10): wrote
    played/battlefield-presence + a real `event:drawCard` fact for the one
    modeled ability ("{3},{T},Sacrifice two artifacts: Draw a card").
    Deliberately did NOT write: (1) a mana fact for "{T}: Add {C}." — {C}
    is never recognized by `mana.ts`'s `manaAbilityColorsFromStaticText`
    (WUBRG-only, a documented gap) and no other static-mana-only land in
    the pool (capital-city/cavern-of-souls/starting-town/eclipsed-realms/
    clive-s-hideaway) has ever written this fact either; (2) a sink fact
    for "wants artifacts to sacrifice" — `engine.ts`'s own
    `unsupportedCostComponent` comment documents this exact cost as
    deliberately NOT modeled as a real `{kind:'sacrifice'}` effect (unlike
    ahriman/phantom-train/quina-qu-gourmet, which DO model theirs), so the
    scripted scenario never calls `actions.sacrifice` or any artifact
    zone/type read — no trace evidence could ever back this fact, and no
    static exemption covers it; (3) any fact for the coin-flip/Treasure
    ability, matching edgar-king-of-figaro's own "Two-Headed Coin" precedent
    (no fact at all for a probabilistic-only ability anywhere in the pool).
    All three flagged as judgment calls, not silently decided.
  - Verified: all 11 pass `npx vite-node functional-model/scripts/verify-synergy.mjs
    <slugs>`; full pool sweep (no args) still only has the ONE pre-existing
    unrelated hard failure (auron-s-inspiration, untouched by this pass).
    `npx vitest run functional-model` — 178/178 pass. Full `npm run test`
    has 5 unrelated pre-existing failures (missing `tagging/*` files, the
    separate historical-sets sweep project's data, confirmed pre-existing
    via `git stash`).
  - Open Forge-verification: none needed — all 11 cards' definition.ts was
    already Forge-cited and untouched; the only new engine-side logic
    (verify-synergy.mjs's crossroads-village exemption) is a reconciliation
    script change, not a rules-engine behavior change, so no Forge citation
    applies.

- **2026-09-09: audited every `functional-model/keywords/<bundle>/scenarios.ts`
  for synthetic filler cards (project rule: scenario board content must be
  real Scryfall data, not invented placeholders) — 5 of the 12
  `ai_reviewed` bundles had one, all fixed, all real cards drawn from FIN
  (data/fin/fin_scryfall.json), since `server/api/keywords/index.get.ts`'s
  `cardArtFor` only ever resolves art off that FIN-only pool — a real but
  non-FIN card name would still render as a placeholder chip, so FIN was a
  hard constraint here, not just a preference:
  - `flying-reach`: "Grounded Blocker" (2/2) → **Coeurl** (FIN, Creature —
    Cat Beast, 2/2, no Flying/Reach — its own tap-ability is inert here).
  - `vigilance-trample`: "Small Blocker" (1/1) → **Magitek Infantry** (FIN,
    Artifact Creature — Robot Soldier, 1/1, its own conditional +1/+0
    never fires, no other artifact on the board).
  - `deathtouch`: "Big Blocker" (4/4) → **Gigantoad** (FIN, Creature —
    Frog, printed base 4/4; its own 7-lands +2/+2 condition never fires).
  - `first-strike-double-strike`: "Would-Be Trader" (3/3) → **Shambling
    Cie'th** (FIN, Mutant Horror, 3/3); "Two-Toughness Blocker" (1/2) →
    **Stiltzkin, Moogle Merchant** (FIN, Legendary Creature — Moogle, 1/2,
    real Lifelink unused since filler cards never get a `keywords` array
    in these bundles — added `'Legendary'` to its `subtypes` per
    `state.ts`'s own legend-rule convention, same as every other Legendary
    FIN card already reused this way elsewhere in these bundles).
  - `menace`: "Blocker One"/"Blocker Two" (1/1 each) → **Hecteyes** +
    **Town Greeter** (both FIN, both keyword-free, ETB triggers inert
    since `addCard` never runs trigger detection).
  All 5 fixed bundles' P/T exactly match the original synthetic numbers
  (no scenario math changed), `registry.ts`'s own `cardNames` arrays got
  the new names appended (drives `KeywordEntryCard.vue`'s `namedCardArt`
  art lookup), and `run-keyword-scenarios.mjs` was rerun to regenerate all
  12 bundles' `trace.json` (only the 5 touched ones actually changed).
  Verified live via Playwright against the already-running dev server:
  all 5 pages (`/app/keywords/{flying-and-reach,vigilance-and-trample,
  menace,deathtouch,first-strike-and-double-strike}`) render real
  `<img>`s for every card on the board, zero placeholder chips remain.
  The other 7 `ai_reviewed` bundles (defender, flash, haste, indestructible,
  landfall, lifelink, saga) were audited too and are already clean — every
  `addCard` in those either reuses a real `cards/<slug>/definition.ts`
  import or (landfall) a real basic land ("Forest"). No entry in
  registry.ts uses `human_reviewed` status yet (confirmed via grep — the
  vocabulary is reserved but unused so far), so the "reset human_reviewed
  → ai_reviewed on content change" rule didn't actually apply to any of
  these 5; all 5 were already `ai_reviewed` and stayed that way, no status
  edit needed. `npm run typecheck` and the full `functional-model` +
  `app/lib/scenarioReplay.test.ts` suites pass (170 + 21 tests). No
  Forge-verification needed for this pass — pure filler-card substitution,
  no rules/engine-behavior change.

- **2026-09-09: mana producers are visible to synergy matching now.**
  `synergy.ts`'s `EventFact` gained a `color?: string` field (same
  "free-form, matched by plain equality when both sides declare it"
  treatment as `counterType`) — `factsInteract`/`themeOf` both wired for
  it. `scripts/prefill-mana-facts.mjs` (new) mechanically inserts/enriches
  an `{event:'addMana', controller:'you', color, value:1}` source fact for
  every real corpus card recognized by `mana.ts`'s own
  `manaAbilityColorFromStaticText` (a plain, unrestricted single-color
  `"{T}: Add {X}."` static-ability string) OR a structured
  `{kind:'addMana'}` Effect — same "bulk-add the zero-judgment stuff"
  precedent `prefill-main-types.mjs` set for theme tagging, just applied to
  synergy.json. Ran once already: touched cards/{druid-of-the-cowl,
  elvish-archdruid, goobbue-gardener, ishgard-the-holy-see-faith-grief,
  jidoor-aristocratic-capital-overture, lindblum-industrial-regency-mage-
  siege, llanowar-elves, midgar-city-of-mako-reactor-raid, sidequest-catch-
  a-fish-cooking-campsite, white-auracite, willowrush-verge, zanarkand-
  ancient-metropolis-lasting-fayth}/synergy.json — re-running the script is
  idempotent (safe to rerun after new cards are authored). Willowrush
  Verge's SECOND, restricted mana ability is still correctly unrecognized
  (mana.ts's own scope, not a bug).
  `scripts/compute-weights.mjs` got a matching `addMana` magnitude case
  (reads the real trace `amount`, same as putCounter/damage/lifegain) — do
  **not** run `compute-weights.mjs` bulk across the whole corpus casually
  again without diffing first: it silently overwrote ~9 unrelated cards'
  hand/AI-tuned `value` fields down to the neutral floor (1) this session
  (drawCard/grantKeyword/counter events have no magnitude case in the
  script — those values apparently came from a since-trimmed older version
  of the script, or were hand-set, and nobody's re-run the bulk script
  since). Those 9 were reverted via `git checkout` before finishing; if a
  future task needs a real bulk recompute, add the missing magnitude cases
  first or scope the run to touched slugs only.
  `scripts/verify-synergy.mjs` gained `staticManaColorsFor(card)` — a plain
  static-text mana Fact is verified statically off `definition.ts` (no
  trace/scenario evidence required), same "known statically" treatment
  `DEATH_TRIGGER_NAMES` already gets. This is the real mechanism behind
  "don't require scenario authoring for plain mana-tapping lands" — **not**
  `scripts/REVIEW_PROCESS.md`, which is the unrelated theme-tagging loop
  (`data/fin/fin_relations.json`), a separate dedicated-session process per
  SHARED.md's "known process boundaries." Flag this if a future ask
  conflates the two again.
- **2026-09-09: `describeFact`'s Battlefield-zone wording bug fixed.** A
  qualified (type/cmc-constrained) Battlefield fact used to render "X in
  your battlefield" — not real MTG terminology, battlefield is a shared
  zone (CR 400.2), no possessive form. Now renders "X you control on the
  battlefield" / "X an opponent controls on the battlefield" / "X on the
  battlefield" (controller omitted). Only the Battlefield branch changed;
  Hand/Graveyard/Library/Exile's own "in your/an opponent's <zone>" phrasing
  is untouched (those genuinely are per-player zones). Verified against
  fin/293 (Zanarkand, Ancient Metropolis // Lasting Fayth).
- **2026-09-09 (follow-up): acted on the "land-presence sink is graph
  noise" flag from earlier this session — removed pool-wide, verified per-
  card, not blanket-deleted by shape.** For all 17 Town-cycle cards sharing
  the ETB-tap-self trigger (`{kind:'tapTarget', validType:'land',
  owner:'you'}`), checked each one's OWN full effect set (front + any back
  face) individually before touching anything. 16 had the sink fact
  `{zone:'Battlefield', controller:'you', types:{has:['Land']}, value:1}`
  produced SOLELY by that trigger shape (no independent land-count want
  anywhere else in the card) — removed it from their `synergy.json`:
  baron-airship-kingdom, crossroads-village, gohn-town-of-ruin,
  gongaga-reactor-town, guadosalam-farplane-gateway, insomnia-crown-city,
  ishgard-the-holy-see-faith-grief, jidoor-aristocratic-capital-overture,
  lindblum-industrial-regency-mage-siege, midgar-city-of-mako-reactor-raid,
  rabanastre-royal-city, sharlayan-nation-of-scholars, treno-dark-city,
  vector-imperial-capital, windurst-federation-center,
  balamb-garden-seed-academy-balamb-garden-airborne (the 17th sibling's real
  slug — corrected from the notes-shorthand "balamb-garden-seed-academy"
  used in the original flag). For cards with a second sink (ishgard's
  Graveyard-artifact/enchantment, jidoor's opponent-Library, midgar's
  Creature/Artifact-battlefield), only the one matching Land-shaped entry
  was removed — the other sink(s) are real, untouched.
  **`zanarkand-ancient-metropolis-lasting-fayth` deliberately KEPT** — its
  back face ("Lasting Fayth") has a real, independent
  `actions.putCounter(created, '+1/+1', ctx.you.getLandsInPlay().length)`
  effect (counters on a token scaled by lands you control), a genuine
  "cares about land count" want unrelated to the front face's ETB-tap
  trigger — verified this is the ONLY one of the 17 with any such
  independent effect (checked every other sibling's full `definition.ts`,
  including all 4 other Adventure-Town backs — ishgard/jidoor/lindblum/
  midgar's back-face effects are graveyard-return/mill/token/sac+draw,
  none reference land count).
  None of the 16 touched cards' `progress.json` had `review`/
  `scenariosReview` at `"reviewed"`/`"human_reviewed"` (all already `"ai"`)
  — so the standing "reset reviewed→ai on content change" rule had nothing
  to actually flip this time; still added a dated `notes` entry + bumped
  `lastVerified` to today on all 16 for traceability (appended, did not
  overwrite pre-existing notes text on ishgard/jidoor/lindblum/midgar).
  Confirmed via `find-synergies.mjs` before/after that no land-related
  sink edge remains into any of the 16 (Midgar/Jidoor/Ishgard's OTHER real
  sink edges still correctly present), and that Zanarkand's land-battlefield-
  presence edges are unchanged/still present from every land-producing
  card in the pool. `verify-synergy.mjs` (same single pre-existing
  `auron-s-inspiration` hard failure, unchanged) and `vitest run
  functional-model` (170/170) both clean after. No `definition.ts`/
  `scenarios.ts`/`trace.json`/code changed — pure hand-authored
  `synergy.json` fact removal + `progress.json` notes, so no
  `run-scenarios.mjs` regeneration was needed. No new Forge citation
  needed (no rules-behavior change, purely a synergy-fact-authoring
  correction of an already-Forge-cited trigger shape).

- **2026-09-09: real bug found+fixed — Adventure spells were logged to
  Graveyard instead of Exile.** `harness.ts`'s `lifecycleAfter` only
  special-cased `alternateCosts.thenExile` (Flashback) for the
  Instant/Sorcery post-resolution zone; a real Adventure sorcery/instant
  cast normally (no alternate cost involved) was never recognized, so
  EVERY real Adventure card's own trace.json wrongly showed `to:
  "Graveyard"` (CR 715.3d actually redirects to Exile). Fixed generically
  via `/\bAdventure\b/.test(card.typeLine)` on the resolving face — not a
  per-card special case. This is what produced Zanarkand's own spurious
  `{zone:'Graveyard', subject:'self'}` source fact (an AI reading the
  buggy trace and taking it at face value) — removed after confirming
  `verify-synergy.mjs` now hard-FAILS that exact fact once the trace is
  corrected (proof the fact was never real). Re-ran `run-scenarios.mjs`
  corpus-wide; only the 6 real Adventure cards' trace.json actually changed
  (ishgard-the-holy-see-faith-grief, jidoor-aristocratic-capital-overture,
  lindblum-industrial-regency-mage-siege, midgar-city-of-mako-reactor-raid,
  thranduil-sindarin-liege-silvan-rally,
  zanarkand-ancient-metropolis-lasting-fayth) — all 6 progress.json's own
  notes updated to match. Checked jidoor/midgar's own separate Graveyard
  facts (mill, sacrifice) — legitimate, unrelated to this bug, left as-is.
  `adventurer-s-airship`/`adventurer-s-inn` are name-only false positives
  for "Adventure" (not the real subtype), not touched.

- **2026-09-09: broadened the mana-tapping-land scenario exemption to two
  more "common/simple land" shapes, same `verify-synergy.mjs` mechanism.**
  Per user's own stance ("for lands ... I don't think we need scenarios")
  — surveyed all 29 real FIN land `definition.ts` files first. Added
  `isStaticOnlyLand(card)` (a land with NO `effects`/`triggers`/
  `activationCost`/`modal` at all — every real ability is static text only
  — exempts its own baseline `{zone:'Battlefield', subject:'self'}`
  produce fact, since that's true by construction) and
  `hasStaticLandTapSelfTrigger`/`isLandTapSelfWant` (a land's `onEnter`
  trigger containing the real, identical-across-17-cards "enters tapped"
  replacement — `{kind:'tapTarget', validType:'land', owner:'you'}` —
  exempts the matching plain `{zone:'Battlefield', types:{has:['Land']}}`
  want, since `validType:'land'` IS "needs a land on the battlefield to
  tap," knowable straight off the Effect's own shape). Verified end-to-end
  with disposable `cards/_tmp-verify-test` fixtures (created + deleted,
  never left in the tree): both exemptions pass with a genuinely EMPTY
  `scenarios.ts`/`[]` trace.json; two negative controls (a land with a
  real, non-boilerplate effect; a non-land/non-`validType:'land'` tapper)
  still correctly hard-fail with no evidence — the exemption doesn't
  swallow anything actually unique. Full corpus re-verified afterward:
  still exactly 1 pre-existing hard failure (auron-s-inspiration, unrelated,
  documented below), 165/165 vitest.
  **Exempted (no scenario/trace needed for these facts)**:
  - Plain static mana-tap text (pre-existing, unchanged) — 10+ cards.
  - Static-only land baseline self-fact — 6 cards (cavern-of-souls,
    capital-city, clive-s-hideaway, starting-town, eclipsed-realms,
    willowrush-verge).
  - ETB-tap-self "enters tapped" Land-sink want — 17 cards (the whole
    Town-cycle: baron-airship-kingdom, crossroads-village,
    gohn-town-of-ruin, gongaga-reactor-town, guadosalam-farplane-gateway,
    insomnia-crown-city, ishgard-the-holy-see-faith-grief,
    jidoor-aristocratic-capital-overture,
    lindblum-industrial-regency-mage-siege,
    midgar-city-of-mako-reactor-raid, rabanastre-royal-city,
    sharlayan-nation-of-scholars, treno-dark-city, vector-imperial-capital,
    windurst-federation-center, zanarkand-ancient-metropolis-lasting-fayth,
    balamb-garden-seed-academy — front face only; back-face Vehicle stays
    scenario-required).
  **Deliberately LEFT scenario-required** (genuinely card-specific, only
  1 real FIN instance each, can't cross-check a "shape" against a single
  example the way the exemptions above do): breeding-pool's ETB pay-2-life
  shockland pattern (common in MTG generally, singleton in this pool);
  adventurer-s-inn's ETB gain-2-life; the-gold-saucer's sac-2-artifacts
  activated draw; elven-passage's self-sac + library search-to-battlefield;
  eden-seat-of-the-sanctum's mill+sac+return chain; sidequest-catch-a-fish's
  transforming Enchantment//Land; balamb-garden's transform+Vehicle back
  face; all 5 Adventure-Town lands' own back-face spell effects (only their
  shared front-face ETB-tap got exempted, not the Adventure side). Flagged
  for discussion, not silently locked in — if any of the "leave
  scenario-required" singletons later gets siblings in a future set, worth
  revisiting the same way.
  Also relayed a coordinator course-correction mid-task: this change is
  scoped PURELY to `verify-synergy.mjs`'s coverage requirement — did not
  touch any card's `progress.json` review/confirmation flags, and did not
  build any "empty scenarios.ts implies reviewed" logic anywhere. Whether/
  when to actually empty out any of these cards' own `scenarios.ts` is a
  separate authoring decision, out of scope here.
- **2026-09-09 (same day, follow-up): actually emptied `scenarios.ts` for
  the exempted cards** — the coordinator confirmed live in the Facts/UI
  (fin/291, vector-imperial-capital) that being merely "not REQUIRED" by
  verify-synergy still left the old boilerplate scenario sitting in the
  file, visible in the UI. 17 of the 23 exempted cards had NO other facts
  needing scenario evidence at all, so their `scenarios.ts` went straight
  to `export const scenarios: Scenario[] = [];` (the 11 plain Town-cycle
  ETB-tap lands + the 6 static-only lands). The other 6 (ishgard, jidoor,
  lindblum, midgar, zanarkand, balamb-garden — all Adventure-Town/transform
  cards) still have REAL, non-exempted facts from their own back
  face/transform (mill, sacrifice+draw, token creation, legend rule, ...)
  that genuinely still need scenario evidence — for these, only removed
  the now-redundant FIRST entry (`{result:'enters tapped', trigger:
  'onEnter'}`), left every other scenario in the array untouched. Did NOT
  blindly empty all 23 to `[]` — would have silently dropped real evidence
  for those 6 cards' still-unique facts and produced real hard failures,
  not just a scenario-authoring cleanup. Re-ran `run-scenarios.mjs`
  (regenerated all 23 `trace.json`), full-corpus `verify-synergy.mjs` (same
  single pre-existing `auron-s-inspiration` hard failure, unchanged), and
  `vitest run functional-model` (165/165) — all clean. No `progress.json`
  touched by this follow-up (confirmed via `git diff` — the `progress.json`
  changes visible in `git status` for willowrush-verge/ishgard/jidoor/
  lindblum/midgar/zanarkand all predate this session, from the earlier
  mana-color/Adventure-Graveyard-bug work already in notes.md above, not
  from this edit).

- **2026-09-09: `functional-model/keywords/registry.ts` expanded from a
  15-entry FIN-only subset to the full historical MTG keyword taxonomy
  (369 entries).** Source: Scryfall's live public catalog endpoints
  (`/catalog/keyword-abilities` 223, `/catalog/keyword-actions` 79,
  `/catalog/ability-words` 69 — fetched 2026-09-09, same source WotC's own
  CR glossary is built from, more current than any static list). Shape
  changes (all 3 confirmed against `card`'s parallel work, which had
  already built a `reviewStatus`/`ReviewStatus` bridge in
  `server/api/keywords/{index.get,review-status}.ts` anticipating exactly
  this): `KeywordStatus` is now `'not_implemented' | 'ai_reviewed' |
  'human_reviewed'` (was `'covered'|'gap'`; existing `covered`→`ai_reviewed`,
  `gap`→`not_implemented`, nothing newly reviewed); `category`'s
  `'fin-mechanic'` value renamed `'set-specific'` (field name/grouping
  semantics unchanged); new `setsUsed?: string[]` (lowercase Scryfall set
  codes) on every `'set-specific'` entry, sourced from `data/cards.db`
  (local full per-printing Scryfall mirror, 1993-2027, NOT the oracle-cards
  bulk file) — excludes `set_type: promo|token` printings, keeps everything
  else (Commander/Duel-deck/Un-set included) — see registry.ts's own header
  for the full caveat writeup. `card.ts`'s `Keyword` union got exactly 2
  new members fixing a REAL pre-existing inconsistency (`Protection`,
  `Saga` — both already referenced by registry.ts's `keywords` field before
  this pass despite not being union members; `Convoke` was NOT actually
  missing, contrary to the initial task brief — already present) —
  deliberately did NOT bulk-extend the union with the other 354 new
  taxonomy terms (kept scoped to "an identifier some real
  CardDefinition/effect actually uses," registry's own `keywords` field
  stays plain `string[]`, no compile-time coupling). Of the 354 new
  entries, 27 are FIN-relevant (appear on a real FIN card) and got an
  individually hand-checked `gapNote` against current engine.ts/card.ts/
  state.ts/tokens.ts/ENGINE_DESIGN.md (several — Equip, Crew, Fight,
  Surveil, Mill — are actually already well-supported in the engine, just
  missing a keywords/ bundle for THIS page; gapNote says so explicitly
  rather than implying a false engine gap). Per explicit orchestrator
  mid-task correction: NO new engine implementation or
  functional-model/keywords/<bundle> scenarios were built for this pass —
  every non-FIN keyword, and every FIN keyword lacking a pre-existing
  bundle, is `not_implemented` by design regardless of how buildable a
  gapNote's own research made it look; the pre-existing 12 `ai_reviewed`
  bundles are the only ones. Also completed the handoff `card` had left
  TODO-flagged: collapsed `index.get.ts`'s two-field `status`/`reviewStatus`
  split back into one `status` field now that registry.ts's own status IS
  the shared 3-way vocabulary, and fixed `review-status.ts`'s stale
  `'gap'` check to `'not_implemented'`. Also mechanically updated
  `app/pages/app/keywords/index.vue`/`app/components/KeywordEntryCard.vue`'s
  literal `'covered'`/`'gap'`/`'fin-mechanic'` comparisons just enough to
  typecheck (binary-styled badge, `!== 'not_implemented'` treated as
  covered) — explicitly flagged in both files' own comments as a stopgap;
  a real 3-way visual treatment (ai_reviewed vs. human_reviewed,
  `setsUsed` display, and the 356-item `set-specific` sidebar list's own
  scale/searchability) is real follow-up work for `ui`, not attempted here.
  `npm run typecheck` (whole repo) and `vitest run functional-model`
  (165/165) both verified passing after all changes.

- **2026-09-09 (same day, follow-up): prototyped two new source-fact shapes
  on ONE card only** (`cards/vector-imperial-capital`, fin/291) — a trial
  for the coordinator to look at before deciding on a corpus-wide rollout.
  Explicitly did NOT run either fix corpus-wide; only this one card's
  `synergy.json` changed data-wise.
  1. **"Enters tapped" split off the generic bare `entersBattlefield`
     event.** Added `EventFact.tapped?: boolean` (same documented
     free-form-field/plain-equality-when-both-sides-declare-it treatment as
     `counterType`/`color`), wired into `themeOf` and `factsInteract`'s
     equality check the same way those two already are, and extended
     `describeFact`'s `entersBattlefield` branch: `'enters the battlefield
     tapped'` when set, unchanged bare `'enters the battlefield'`
     otherwise. Added the actual fact to vector-imperial-capital only:
     `{id:'enters-tapped', event:'entersBattlefield', controller:'you',
     subject:'self', tapped:true, sourceText:'Vector, Imperial Capital
     enters tapped.', highlight:'enters tapped', value:1}`. Also added
     `isLandEntersTappedSelfFact` to `verify-synergy.mjs` (the SOURCE-side
     counterpart to the pre-existing `hasStaticLandTapSelfTrigger` sink
     exemption) so this fact needs no scenario/trace evidence — same
     "known statically off definition.ts" reasoning as everything else in
     that file. This new exemption function is structurally generic (would
     recognize the identical fact shape on any of the other 16 Town-cycle
     lands sharing this same trigger shape) but is CURRENTLY INERT for all
     of them since none of their `synergy.json` files declare the fact yet
     — nothing was regenerated/touched for those 16.
     **`subject: 'self'` judgment call, explicitly made, not defaulted
     into**: the modeled trigger itself is `{kind:'tapTarget',
     validType:'land', owner:'you'}` — literally "tap A land you control,"
     not "tap this specific permanent" — already flagged in this exact
     card's own file header (and treno-dark-city's, the canonical
     citation) as a deliberate approximation that "finds exactly self as
     long as no OTHER land is set up for 'you' in a given scenario."
     Despite that, `subject: 'self'` is the ACCURATE fact here: the real
     oracle text ("Vector, Imperial Capital enters tapped") is genuinely a
     self-only replacement effect (CR 614-shaped), and the trigger's
     pool-based tap is a known, already-documented MECHANICAL shortcut for
     implementing that — not evidence the ability itself is "tap any
     land." Caveat worth flagging forward, not new: if a FUTURE scenario
     ever puts a second land into play for 'you' before this trigger fires
     (none currently exist for any of the 17 Town-cycle cards —
     `scenarios.ts` is empty for all of them per the earlier "actually
     emptied scenarios.ts" pass), the modeled EFFECT could tap the wrong
     land even though the FACT itself would still correctly describe the
     real card. Not a new problem introduced here, just now has a fact
     riding on top of it worth remembering.
  2. **The missing two-color mana fact.** Confirmed why
     `prefill-mana-facts.mjs`/`mana.ts`'s own `manaAbilityColorFromStaticText`
     never picked up Vector's own `"{T}: Add {B} or {R}."` — that function
     only ever recognized a single plain color symbol (`^\{T\}: Add
     \{([WUBRG])\}\.$`), an "X or Y" choice fails the regex outright and
     falls through to `undefined`. Added a new, separate export,
     `manaAbilityColorsFromStaticText` (plural) — recognizes BOTH the
     existing single-color shape and a new `^\{T\}: Add \{X\} or
     \{Y\}\.$` shape, returning an array of every color the FIRST matching
     ability names. Deliberately kept SEPARATE from the existing
     `manaAbilityColorFromStaticText`/`manaColorOf`/`RealCard.manaAbility`
     path used for real engine-play affordability (`engine.ts`) — that
     path stays single-color-only, unchanged; the new function is
     explicitly documented as fact-generation-only, since correctly
     affording a real choice-of-color source at cast time needs a genuine
     bipartite-matching assignment (ENGINE_GAPS.md gap #5's own documented
     remainder), not attempted here.
     **Fact shape decided: two separate `addMana` facts, one per color**
     (`mana-b`/`mana-r`, each `value:1`, same `sourceText`, per-color
     `highlight`) — not one fact with an array-valued `color`. This was
     forced, not arbitrary: `EventFact.color` is already documented as
     "matched by plain equality when both sides declare it," the same
     contract `counterType` already relies on; an array would silently
     break that equality contract for every existing single-color
     `addMana` fact in the corpus. Two facts also correctly lets a future
     "wants a red mana source" sink match on just the R half without
     implying the land produces BOTH colors simultaneously (it produces
     one OR the other per activation, same as the real card).
     `prefill-mana-facts.mjs` updated generically (now emits one entry per
     recognized color off the plural function; `verify-synergy.mjs`'s
     `staticManaColorsFor` updated the same way, unioning both faces' own
     recognized colors) — this is a real, generically-correct fix
     affecting all 12 real FIN cards with this exact "Add X or Y" land
     shape (grepped: balamb-garden-seed-academy, baron-airship-kingdom,
     breeding-pool, gohn-town-of-ruin, gongaga-reactor-town,
     guadosalam-farplane-gateway, insomnia-crown-city, rabanastre-royal-
     city, sharlayan-nation-of-scholars, treno-dark-city,
     vector-imperial-capital, windurst-federation-center — NONE had a
     hand-authored `addMana` fact before this pass, confirmed by grep), but
     per explicit scoping instruction only ACTUALLY RUN for
     vector-imperial-capital: `prefill-mana-facts.mjs` gained a new
     `--slug=<slug>` CLI filter (alongside the pre-existing `--dry`)
     specifically so a single-card trial run doesn't require a temporary
     script fork — used it here, verified via `--dry` first that only
     vector-imperial-capital's own file would be touched, then ran for
     real. The other 11 real cards' own `synergy.json` are completely
     untouched by this pass; running the (now dual-color-aware) script
     bare (no `--slug`) would pick all of them up whenever the corpus-wide
     rollout is actually approved.
  Verification: `verify-synergy.mjs vector-imperial-capital` (OK),
  `verify-synergy.mjs` full corpus (same single pre-existing
  `auron-s-inspiration` hard failure, unchanged — 312 checked/8
  skipped/1 hard failure, identical counts to before this pass),
  `vitest run functional-model` (165/165), `tsc --noEmit` (no
  functional-model errors). Confirmed live via `curl
  localhost:3000/api/card/fin/291` that the served `functionalModel.synergy`
  matches the file exactly (server passes it through untouched, per
  contract), and via a standalone `describeFact` invocation against the
  card's own `synergy.json` that the rendering is exactly `'enters the
  battlefield tapped'` / `'your mana production'` (×2, one per color) /
  the unchanged sink description. Did NOT independently confirm the
  rendered DOM in an actual browser — no browser/screenshot tool available
  in this session; the dev-server API-level check is the closest
  substitute available here. `(・_・?)` if the coordinator wants an actual
  visual check before signing off, that still needs a human or a
  browser-capable tool, not this session.
  Also, same "no per-color grouped rendering" flag as the original
  `color` field note above applies to `tapped` too — `describeFact` only
  renders the terse "enters the battlefield tapped," no richer templating;
  that's `card`'s own follow-up territory per the contract, not extended
  here.

- **2026-09-09 (follow-up): "played" is now a real, structurally-grounded
  Fact-vocab event, distinct from `entersBattlefield` — CR 305's land-drop
  special action.** Surveyed first: before this pass, NEITHER
  `harness.ts` NOR `engine.ts` distinguished "a land was played" from "a
  permanent was cast" at all — `harness.ts`'s own `lifecycleBefore`
  unconditionally emitted `fn:'cast'` for a Land typeLine same as any
  other permanent, and `engine.ts`'s `castSpell` has no land branch
  whatsoever (a real, separate, bigger gap — logged as ENGINE_GAPS.md's
  new gap #12, not attempted here since no FIN land uses
  `runEngineScenarios` today). Fixed the harness/trace-generation half,
  which is what actually produces every FIN land's own `trace.json`:
  `lifecycleBefore` now emits a real, distinct `fn: 'playLand'` (not
  `cast`) for a Land typeLine going through the ordinary
  (non-trigger/non-ability/non-activation) scenario path — `describeAction`
  updated to match ("played as a land (CR 305 special action)" instead of
  "cast from hand"). `synergy.ts`'s `EventFact` gained a new documented
  vocabulary value, `event: 'playLand'` (no new field — `event` is a plain
  string, same as `castCreatureSpell`/`activateAbility`'s own verb+noun
  naming convention), with a doc comment explicitly warning `playLand` and
  `entersBattlefield` are NEVER derivable from each other (a land can enter
  without being played — Elven Passage's own library-fetch — or be played
  and then also enter; author both facts independently, never assume one
  implies the other). `describeFact` renders it as "being played as a
  land". `scripts/verify-synergy.mjs` gained a matching `producedEvent`
  case for `fn:'playLand'` (added to `explainableFns` too) — critically,
  this fact got **NO static "known from definition.ts alone" exemption**
  (unlike `isStaticOnlyLand`/`isLandEntersTappedSelfFact`/
  `staticManaColorsFor`, all in the same file): those exemptions are safe
  because the fact they cover is true regardless of HOW the permanent
  reached the battlefield; `played` is specifically about the mechanism
  itself, which is exactly the thing that risks being silently wrong (a
  fetch/ramp effect putting a land onto the battlefield directly must NOT
  get credited with a `played` fact) — so it deliberately keeps demanding
  real scenario/trace evidence, the opposite call from the mana/enters-
  tapped exemptions, made and justified explicitly, not defaulted into.
  `scripts/run-scenarios.mjs` gained a `--slug=<slug>` filter (same
  convention `prefill-mana-facts.mjs` already established) so a single-card
  trial regenerates only that card's own `trace.json`.
  **Prototyped on `vector-imperial-capital` only** (fin/291): added a real
  (non-empty) `scenarios.ts` — one plain default scenario — whose
  regenerated `trace.json` now shows a genuine `{fn:'playLand', ...}` line
  distinct from the following `{fn:'enters', zone:'Battlefield'}`. Added
  matching `synergy.json` source facts: `played` (`event:'playLand'`,
  `subject:'self'`) and, to clear a soft note the new real trace surfaced
  (this card never had ANY trace evidence before, so its baseline
  "permanent on your battlefield" fact was simply never authored),
  `battlefield-presence` (`zone:'Battlefield', subject:'self'`, matching
  the same baseline convention `cavern-of-souls`/`starting-town` already
  use). Full fact set after this change (source): `played` → "being played
  as a land", `battlefield-presence` → "battlefield presence",
  `enters-tapped` → "enters the battlefield tapped", `mana-b`/`mana-r` →
  "your mana production" (×2). Verified `elven-passage`'s own
  `synergy.json`/`trace.json` are completely untouched and correctly
  produce NO `playLand` fact for its fetched land (its own `custom` effect
  calls `actions.moveTo` directly — never reaches `lifecycleBefore`'s Land
  branch at all, since that fetched land is a different `RealCard`, not
  the scenario's own `self`; elven-passage's OWN card also never reaches
  the new branch either, since it has `activationCost` set, which is
  checked first).
  Verification: `verify-synergy.mjs vector-imperial-capital elven-passage`
  (both OK/clean — vector-imperial-capital fully clean, elven-passage's
  2 `loseLife`-soft-notes confirmed pre-existing via `git stash` A/B, not
  from this change), full-corpus `verify-synergy.mjs` (same single
  pre-existing `auron-s-inspiration` hard failure, 312 checked/8 skipped/1
  hard failure — identical counts to before this pass), `vitest run
  functional-model` (165/165), `tsc --noEmit` (no functional-model
  errors), and a standalone `describeFact` check confirming all 5 of
  vector-imperial-capital's own source facts render correctly.
  **Deliberately did NOT run `run-scenarios.mjs` bulk** (no `--slug`) —
  would have touched every OTHER real land's own checked-in `trace.json`
  too (their `fn:'cast'` bracket is now stale relative to the new
  harness.ts code — still harmless today since `IGNORED_FNS` treats `cast`
  the same as before and nothing currently declares/needs a `playLand`
  fact for any of them), per explicit task scoping to prototype on one
  card. Also found the repo's working tree already had a large amount of
  OTHER uncommitted work in progress (keywords registry rewrite, mana-color
  prototype, Adventure-Graveyard bugfix, etc. — all previously documented
  above in this same notes file) sitting in the tree from earlier
  session(s) — confirmed via `git stash`/`git stash pop` that my own edits
  round-tripped cleanly and I did not disturb any of it; left entirely
  alone, not part of this task.

## Open questions / still open

- **This session's own trial, awaiting the coordinator's rollout
  decision**: whether to (a) run `prefill-mana-facts.mjs` bare (no
  `--slug`) to pick up the other 11 real "Add X or Y" Town-cycle lands,
  and (b) hand-author the equivalent `{event:'entersBattlefield',
  subject:'self', tapped:true, ...}` fact on the other 16 real Town-cycle
  lands sharing the exact same trigger shape (`isLandEntersTappedSelfFact`
  in verify-synergy.mjs already recognizes the shape generically the
  moment any of them gets the fact — no further code change needed to
  extend, just the data). Not done pending that decision, per explicit
  task scoping.
- **Same open rollout question, now also for `played`/`playLand`**: the
  code (harness.ts's `playLand` branch, synergy.ts's vocab, verify-
  synergy.mjs's `producedEvent` case) is already generic — the moment any
  other real land gets a genuine (non-empty) `scenarios.ts` with a plain
  default entry, its own regenerated `trace.json` will show the same real
  `playLand` evidence, and its own `synergy.json` can then honestly declare
  the fact. NOT rolled out corpus-wide here (prototyped on
  vector-imperial-capital only, per explicit task scoping) — a future pass
  would need to (re-)populate a plain default scenario for every OTHER
  real land whose `scenarios.ts` was emptied to `[]` in the earlier
  "actually emptied scenarios.ts" pass (the 6 static-only lands + the 17
  Town-cycle ETB-tap lands), since `played` deliberately has no static
  exemption the way those cards' other facts do — this is real added
  authoring work per land, not a one-line script run, unlike the mana-
  color/enters-tapped rollouts.
- **Real Forge-verification still needed, not done this pass**: I did not
  independently re-verify CR 305.1's exact wording/section number against
  a live rules text or Forge's own `PlayerZoneBattlefield`/land-drop
  handling code — this pass reasoned from the CR number already used
  elsewhere in this codebase's own comments (E.g. Equip's 301.5c citation
  style) and well-established general MTG rules knowledge, not a fresh
  `../tmp/mtg-forge` citation. If a future pass builds the real `engine.ts`
  CR 305 special-action mechanics (ENGINE_GAPS.md's new gap #12), it
  should cite the real Forge land-play source file/line the way every
  other `interfaces.ts`/engine mirror entry does, same as this project's
  own ground-truth discipline requires — flagging this rather than
  silently treating my citation as Forge-verified.

- **Follow-up for `ui`, not started here**: the "Keywords" page's sidebar
  now has 356 `set-specific` entries (up from 2) with no search/filter/
  virtualization — a flat scrollable list works but will be unwieldy;
  real UI work, out of this pass's scope. Also the section label text
  "FIN-set mechanics" (index.vue) is now inaccurate now that the bucket
  covers the full taxonomy — cosmetic rename, not required for typecheck,
  left for `ui`.
- **`ruleCite` precision for the 354 newly-added entries is intentionally
  generic** ("CR 702 (keyword ability)" / "CR 701 (keyword action)" /
  "CR 207.2c (ability word)") rather than a specific numbered CR
  subsection — verifying 354 individual subsection numbers against a
  specific current rules build was out of scope for this pass; a future
  pass could tighten high-traffic ones (Ninjutsu, Cycling, Kicker, etc.)
  the same way the pre-existing hand-authored entries already are.
- **`setsUsed` for a handful of catalog terms is an empty array** — mostly
  generic keyword ACTIONS (Tap, Untap, Destroy, Cast, ...) that Scryfall's
  own per-card `keywords` tagging apparently never actually applies to any
  single printing (confirmed: 24 of 371 catalog terms have zero
  `data/cards.db` hits) — not a bug in the extraction, just how Scryfall's
  own tagging works for pure generic verbs.



- No new Forge citation needed for this pass — the 17 exempted lands'
  "enters tapped" replacement was already individually Forge-cited in each
  card's own `definition.ts` comment before this change; this pass only
  changed what evidence `verify-synergy.mjs` demands, not any rules
  behavior. Flag for later: if a FUTURE land's `onEnter` trigger LOOKS like
  this same `tapTarget`/`validType:'land'`/`owner:'you'` shape but its real
  Forge script actually does something subtly different (e.g. taps a
  player-chosen OTHER land, not just self), `hasStaticLandTapSelfTrigger`
  would wrongly treat it as the boilerplate case — worth re-checking the
  real script text against this exact structural match before trusting it
  for a new card, not just pattern-matching the TypeScript shape.

- **Pre-existing, confirmed unrelated to this session's changes**:
  `auron-s-inspiration` hard-fails `verify-synergy.mjs`
  (`produce {zone:Exile,controller:you} has no supporting trace line`) —
  verified via `git stash` that this fails identically without any of this
  session's edits. Not investigated further (out of this task's scope);
  flagging for whoever picks up general verify-synergy hygiene next.
  `midgar-city-of-mako-reactor-raid`'s `progress.json` also records
  `verifySynergy: "pass"` despite 2 real pre-existing soft notes (`drawCard`
  unrecognized) — flagged in its own notes field, not fixed (predates this
  session, unrelated to the addMana/Adventure work).
- **Not done, flagged as a real follow-up for the `card` agent**: the new
  `EventFact.color` field is intentionally NOT rendered by `describeFact`
  beyond the terse "your mana production" (no per-color text, no grouped/
  summarized "Source: Mana (G)" display) — per `.claude/contracts/card-
  schema.md`'s existing note that `describeFact`/`constraintBits` shouldn't
  gain more templating/grouping logic, that richer rendering is `card`'s
  own follow-up work once it reads `fact.color` directly.
- Full FIN corpus re-verified (`verify-synergy.mjs`, `find-synergies.mjs`,
  `compute-weights.mjs` narrowly for the addMana case, `vitest run
  functional-model` — 165/165 pass) after all changes above; `npm run test`
  (whole repo) also run — only unrelated pre-existing failures
  (`scripts/relations.test.mjs`, missing `tagging/` files, a different
  domain/process entirely).

- **2026-09-09 (later same day) — follow-up pass, 4 items:**
  1. **ENGINE_GAPS.md gap #12 reframed** (was: "no land branch in
     `castSpell`/`pilotCast`" — same conceptual mistake `harness.ts`'s
     fix corrected in wording, not code). Corrected to: the real gap is
     `engine.ts`/`engine-trace.ts` having **no `playLand` action at all**
     in the real pilot path (a land is never cast, full stop) — separately,
     flagged that `castSpell`/`canCastSpell`/`pilotCast` WOULD actively
     mistreat a land as a spell if ever called with one (no typeLine
     guard exists) — a real **dormant/live-the-moment-triggered bug**, not
     just an absent feature, but currently unreachable since no FIN land's
     `scenarios.ts` uses `runEngineScenarios()` today (checked). Whoever
     builds the real `playLand` pilot action should add the typeLine guard
     to `castSpell`/`canCastSpell` in the same pass.
  2. **New `EventFact.colors: TypeConstraint` field** (synergy.ts) — reuses
     `TypeConstraint`'s exact `has`/`hasAny`/`not` vocabulary AND its
     existing `satisfiesType` matcher (no new matching code), via a new
     `colorSetOf(fact)` helper that flattens a produce's own `colors`
     (or legacy singular `color`, wrapped as a one-element set) into the
     real enumerable color list `satisfiesType` checks a want's `colors`
     (or legacy `color`) against. `factsInteract`'s old
     `pe.color !== we.color` plain-equality line is now this unified
     check — fully backward compatible (verified: a legacy `color`-only
     produce still matches a new `colors`-shaped want and vice versa, see
     `synergy.test.ts`). `describeFact`'s `addMana` case now renders a
     `colors`-shaped fact's label using the SAME has-joined-by-space /
     hasAny-joined-by-slash wording `constraintBits` already uses for type
     wants ("your mana production (B/R)") — deliberately does NOT render
     the legacy singular `color` field the same way (kept the prior
     terser wording for the other 11 cards, since a past explicit call
     said not to add more `color` rendering — only the NEW field changes
     the label).
  3. **`vector-imperial-capital`'s `mana-b`/`mana-r` migrated to ONE
     `mana-b-r` fact** (`colors: {hasAny:['B','R']}`) in its `synergy.json`.
     **The other 11 real single-color `addMana` cards (Druid of the Cowl,
     Goobbue Gardener, Llanowar Elves, Midgar, Ishgard, Jidoor, Lindblum,
     Zanarkand, White Auracite, Willowrush Verge, Elvish Archdruid) are
     NOT migrated** — still using the legacy singular `color` field, which
     still matches correctly (backward-compat, see above) but is now the
     "old" shape; a real follow-up would migrate them to `colors:{has:[X]}}`
     for consistency, not required for anything to keep working.
  4. **`prefill-mana-facts.mjs` rewritten** to emit ONE `colors:{hasAny:
     [...]}` fact for a real choice-of-color ability (was: two separate
     `color:'B'`/`color:'R'` facts) — single-color abilities unchanged
     (still legacy `color:string`). Idempotency check updated to match
     on either shape. Dry-run against the full pool confirms
     `vector-imperial-capital` is now correctly skipped (already has the
     matching combined fact) and would newly write 11 OTHER real
     Town-cycle choice-of-color lands (treno-dark-city, baron-airship-
     kingdom, breeding-pool, etc.) if run for real — **not run for real,
     scope stayed to vector-imperial-capital only**, per explicit task
     scoping.
  5. **New `functional-model/synergy.test.ts`** (this codebase's first
     `synergy.ts` unit test file) — 5 tests proving `colors` matching
     end-to-end via the real `findInteractionsForCard` entry point (not a
     private-helper unit test): `hasAny` produce vs. `has` want (match),
     non-overlapping color (no match), `hasAny` want overlap (match),
     `not` want excluding a produced color (no match), and legacy
     `color`-produce vs. new `colors`-want backward compat (match).
  6. **Course-corrected on the `played`/`playLand` scenario-exemption
     call from earlier this session**: reverted `vector-imperial-capital`'s
     `scenarios.ts` back to empty `[]` (was a real default scenario added
     to force genuine trace evidence for the `playLand` fact) — the
     correct read (per coordinator relay) is that a Land's own SELF-play
     fact is exactly as tautologically true-by-construction as its
     other facts already got exempted for; the real risk `playLand`'s
     evidence requirement guards against (a DIFFERENT card fetching a land
     other than itself, elven-passage-style) doesn't apply to a land's own
     fact about itself. Added `isSelfPlayableLand` (verify-synergy.mjs) —
     statically exempts a Land's own `{event:'playLand', subject:'self'}`
     fact. This exposed a SECOND, previously-untouched fact that also lost
     its only evidence once the scenario went away: `battlefield-presence`
     (`{zone:'Battlefield', subject:'self'}`) — `isStaticOnlyLand` doesn't
     cover it (requires NO triggers/effects at all; Vector has an onEnter
     tap trigger), so I added a new, narrower
     `isSelfBattlefieldPresenceLand` (same file) — same reasoning again:
     a Land's own bare unconstrained battlefield-presence is tautological
     regardless of what OTHER abilities it has, since resolving a land
     always puts IT on the battlefield no matter what its triggers/mana
     abilities do. Regenerated `trace.json` back to `[]` via
     `run-scenarios.mjs --slug=vector-imperial-capital`. `verify-synergy.mjs`
     OK for this card afterward, full-pool sweep unchanged (still only the
     one pre-existing unrelated `auron-s-inspiration` failure).
  7. **Fixed a real review-flag regression**: `progress.json`'s
     `scenariosReview` had been left at `"reviewed"` after a prior turn's
     edit to `scenarios.ts` changed what it was reviewing — reset to
     `"ai"` per the user's explicit instruction ("Any changes - status back
     to AI", applies going forward to every future task touching
     `scenarios.ts`/`synergy.json`/`definition.ts`, not just this one).
     **Flagged, not built**: a generic automated safeguard (a
     `verify-synergy.mjs`-style check, or a content-hash comparison
     against what `scenariosReview: reviewed` last saw) would catch this
     class of regression corpus-wide instead of relying on each agent
     turn remembering to reset it by hand — worth having someone actually
     build, not attempted here per explicit "don't build unprompted."
  8. **`describeFact`'s `playLand` wording changed to the user's exact
     ask**: `'Play a land.'` (was `'being played as a land'` from earlier
     this session). Investigated the "why is the live page showing raw
     `playLand`" report: confirmed directly (`describeFact` called with a
     `playLand` fact) that the function itself now returns the right
     string, and found no OTHER place a card-page/graph render path
     bypasses `describeFact` for this fact (`server/api/graph-links.ts`
     also routes through the same live `findInteractionsForCard` call, no
     caching layer in dev). The ONE place a raw `fn` string genuinely
     still renders verbatim is `app/components/ScenarioReplayTrace.vue`'s
     own "fn" debug column (`row.entry.fn`, line ~553) — that's a
     deliberate raw/technical trace-log view (every fn renders unrendered
     there, not just `playLand`), not a `describeFact` bypass bug; flagged
     for `card`/`ui` in case the user actually meant that column, but
     didn't touch it (out of engine's lane, and it's arguably correct as
     designed). Best guess for what the user actually saw: a stale
     page/HMR state from before the wording landed, or genuinely looking
     at that raw fn column — couldn't reproduce a live bug in the code as
     of this pass.
  9. **Land-presence sink fact — flagged this pass, ACTED ON in a later
     same-day follow-up** (see the dated entry higher up this file, "acted
     on the 'land-presence sink is graph noise' flag" — removed pool-wide
     from 16 of the 17 Town-cycle siblings, kept on
     zanarkand-ancient-metropolis-lasting-fayth since it has a genuine
     independent land-count want). Original reasoning preserved here:
     the fact originates from the `tapTarget{validType:'land', owner:'you'}`
     effect's own candidate-pool requirement, which is ALWAYS trivially
     self-satisfied (the card itself is a land, already on the battlefield,
     the instant the trigger fires — harness.ts's own selfZone rule) — the
     [continued below — see the rest of that note further down this file]

- **2026-09-09 (later same day again) — ENGINE_GAPS.md gap #12 actually
  CLOSED this pass: a real `playLand`/`canPlayLand` action now exists in
  `engine.ts`'s real pilot path, not just harness.ts's trace-label fix.**
  Got a real Forge checkout this time (network was available; sparse-cloned
  `Player.java`/`PlayerController.java`/`GameAction.java`/`PhaseHandler.java`
  into `/home/sva/Projects/mtg-forge` — matches the `../mtg-forge`-relative-
  to-this-repo path every other citation in this codebase already assumes;
  left the checkout in place afterward per that same standing convention,
  not scratchpad-cleaned). Real Forge reference, cited directly (not
  reasoned from CR text alone, unlike the earlier same-day pass that
  flagged this as owed): `Player.playLand` (`Player.java` ~1624-1651) does
  a direct `game.getAction().moveTo(Battlefield, land, cause)` — no Stack
  trip at all — then fires `TriggerType.LandPlayed`, then
  `addLandPlayedThisTurn()`. `Player.canPlayLand` (~1653-1688) gates on
  305.3's own timing via `canCastSorcery()` (~2508-2511: own turn + main
  phase + empty stack — the EXACT SAME rule this engine's own
  `sorcerySpeedTimingOk` already implements for sorcery-speed spells, so
  reused directly rather than re-derived) plus
  `getLandsPlayedThisTurn() < getMaxLandPlays()` (default max 1,
  `Player.java` ~1690-1696). Reset: `Player.onCleanupPhase()`
  (~2456-2473) calls `resetLandsPlayedThisTurn()` unconditionally each
  cleanup — this engine's own `turn.ts` mirrors that for the ACTIVE
  player only (same established "only the active player's own Cleanup
  actions are modeled" scope 514.1's discard already uses; a non-active
  player's count can never be nonzero here anyway, since only the active
  player passes `sorcerySpeedTimingOk`'s own-turn check).

  **What got built** (all in this one pass):
  - `state.ts`: new `RealPlayer.landsPlayedThisTurn?: number`.
  - `turn.ts`: Cleanup's `runPhaseEntryAction` now resets it for the active
    player, right alongside 514.1/514.2.
  - `engine.ts`: new `canPlayLand`/`playLand` pair, same `ActionResult`/
    "check separately from the mutating action" shape `canCastSpell`/
    `castSpell` already use. `playLand` is ONE call (not a cast+resolve
    split) — CR 305.1 lands never wait on the Stack, so there's no
    separate "resolve" step to pair it with, unlike a spell. It does the
    real Hand->Battlefield `state.move`, stamps `enteredThisTurn` (302.6
    summoning sickness — yes, a creature-land could still be sick) and
    `resolvedPermanents` (so upkeep/end-step auto-fire and Saga automation
    machinery would work on a land too, if a future one needed it) exactly
    like `resolveTop` already does for a cast permanent, derives
    `manaAbility` from the land's own `staticAbilities` text (so a
    mana-producing land like Midgar becomes a real payable mana source the
    instant it's played, not just when cast), fires the real
    `Trigger.on === 'enter'` ETB if the land declares one, then increments
    the counter.
  - **The dormant bug, actually fixed, not just flagged**: `canCastSpell`
    now rejects a Land typeLine outright, at the very top, before any
    other check — `castSpell` calls `canCastSpell` first, so this alone
    closes it for both; no separate check needed in `castSpell` itself.
    `engine-trace.ts`'s `pilotCast` needed NO direct edit either — it
    already just calls `canCastSpell`/`castSpell` and throws on
    `!check.ok`, so it inherits the guard for free (confirmed via the new
    "rejects a Land typeLine" describe block in `engine.test.ts` calling
    `castSpell` directly, plus reasoning through `pilotCast`'s own call
    chain — not separately unit-tested through `engine-trace.ts` itself,
    since nothing in this codebase exercises `pilotCast` against a Land
    today to make that concrete, same "no FIN land uses
    `runEngineScenarios()` yet" situation as everything else here).
  - `engine-trace.ts`: new `pilotPlayLand` (the `playLand`-equivalent of
    `pilotCast`+`pilotResolveTop` combined into one call, same reasoning)
    and `pilotExpectIllegalPlayLand` (the `playLand`-equivalent of
    `pilotExpectIllegalCast`) — both follow the exact same
    `beginStep`/legality-check-then-log-then-mutate shape every other
    `pilot*` helper in that file already uses, logging the same
    `{fn:'playLand',...}`/`{fn:'enters',...}`/`{fn:'trigger',...}` bracket
    shapes `harness.ts`'s own `lifecycleBefore` and `pilotResolveTop`
    already establish (so a future card that migrates to
    `runEngineScenarios()` produces a trace.json indistinguishable in
    shape from the harness-path one for the same events).
  - `engine.test.ts`: 8 new tests (`canPlayLand`/`playLand` describe
    block: rejects non-Land, legal play proves real zone move + no Stack
    trip + ETB fired (life gain) + counter increment, once-per-turn
    rejection with a mutate-nothing check, 305.3 timing rejection with a
    non-empty stack, 305.3 timing rejection outside main phase, Cleanup
    reset allowing a second land next turn; plus a `canCastSpell`/
    `castSpell` describe block proving the Land-rejection guard). All 178
    functional-model tests pass (170 pre-existing + 8 new); full-pool
    `verify-synergy.mjs` unchanged (still only the one pre-existing
    unrelated `auron-s-inspiration` failure); `npm run test` (whole repo)
    unchanged (still only the 5 pre-existing unrelated
    `scripts/relations.test.mjs` failures, a different domain/process).

  **Real, deliberately NOT closed in this pass, flagged for later**:
  Zell Dincht's own "You may play an additional land on each of your
  turns" (`staticAbilities`, freeform text) — `canPlayLand`'s once-per-turn
  check is a hardcoded `>= 1` (mirroring Forge's own default
  `getMaxLandPlays() == 1`), same "no FIN card modifies X yet" shape this
  codebase already accepts elsewhere (514.1's hardcoded 7-card hand size,
  e.g.) — but Zell is a REAL, checked exception (grepped the pool for
  "additional land"/"extra land"/"play two lands"/`maxLandPlays`; exactly
  one hit). Not closed here because it needs a structured field this
  engine can read (no `CardDefinition.extraLandPlays`-shaped field exists;
  Zell's own text is unstructured, same "engine-side design ready, blocked
  on `cards/*` boundary" situation ENGINE_GAPS.md's gap #8 damage-shields
  and gap #11's Vehicle crewCost gaps already document) — `RealPlayer.
  landsPlayedThisTurn`'s own new doc comment flags this explicitly so a
  future pass doesn't rediscover it from scratch. ENGINE_GAPS.md's own gap
  #12 entry needs updating to reflect this closure — not yet edited this
  pass (flagging here first per this file's own "record before finishing"
  convention; whoever picks this up next should mark gap #12 CLOSED in
  ENGINE_GAPS.md's own prioritized list, following the exact "~~old
  gap~~ **CLOSED**" strikethrough convention every other closed gap there
  already uses, and fold in this real Forge citation).
  Also NOT built: no FIN land currently exercises this real path (no
  card's own `scenarios.ts` migrated to `runEngineScenarios()` — out of
  this task's explicit scope, "you don't need to migrate any card").
     ability gains zero real benefit from more lands existing, unlike a
     genuine "lands matter" want.

- **2026-09-10 research (no code changed) — "cast a spell" fact-category
  gap, for a `castSpell` sibling to `playLand`**: findings only, nothing
  built.
  - **Trace level is ALREADY symmetric with `playLand`** — not a
    foundational gap. `harness.ts`'s `lifecycleBefore` (functional-model/
    harness.ts:920) emits `{fn:'cast', card, instanceId, from, cost}` for
    every non-Land, non-activation cast, same automatic-bracketing
    treatment `playLand` gets for lands (harness.ts:912); `engine-trace.ts`'s
    `pilotCast` (line 383) does the same for the piloted-engine path. The
    real gap is entirely one layer up, in the fact-vocabulary/`describeFact`
    layer, not the trace.
  - **`describeFact` (synergy.ts) has no dedicated `event==='cast*'`
    branch at all** — every cast-shaped fact today falls through to the
    generic string fallback (synergy.ts:523-535, which literally names
    `castCreatureSpell` as an example of what it's catching).
  - **Authored coverage is real but narrow and half-broken**: 6 cards use
    a named `onCast*` trigger (`grep "name: 'onCast" */definition.ts`) —
    `onCastCreatureSpell` (champions-of-the-perfect, the ONLY one wired:
    `TRIGGER_EVENT_MAP` in scripts/verify-synergy.mjs:264 maps it to a real
    `castCreatureSpell` sink fact), `onCastNoncreatureSpell` (shantotto-
    tactician-magician, tellah-great-sage, vivi-ornitier — NOT in
    `TRIGGER_EVENT_MAP` despite verify-synergy.mjs:261-263's comment
    implying it already is a wired convention; all three cards' own
    synergy.json `sink` is empty `[]` even though the trigger genuinely
    fires in trace.json — a real, silent authoring gap, not by design),
    `onCastSpellYouDontOwn` (vaan-street-thief — deliberately unmapped per
    SYNERGY_DESIGN.md:613-624, a produce-side trigger, no want needed),
    `onCastLegendarySpell` (venat-heart-of-hydaelyn — unmapped, NOT
    included in that same audited "no mapping needed" list, so its status
    is genuinely undetermined, not confirmed-deliberate).
  - `playLand`'s own shape to mirror: one dedicated harness/engine-trace
    log fn (`fn:'playLand'`, no `from`/`cost`) plus one dedicated
    `describeFact` branch (synergy.ts:481, `'play a land'`) — see
    synergy.ts:108-122's own doc comment for why `playLand` and
    `entersBattlefield` are deliberately two separate facts (the special
    action itself vs. the zone change), the same split a `castSpell`
    sibling should keep against `cast`'s own existing lifecycle `fn` and
    the (currently absent) `entersBattlefield`/`cast` fact pairing.
  - **Scope estimate**: 6 cards already have real cast-trigger machinery
    that could gain a fact for free once `castSpell`/`castCreatureSpell`/
    `castNoncreatureSpell` gets a real `describeFact` label + (for the 3
    `onCastNoncreatureSpell` cards) a `TRIGGER_EVENT_MAP` entry — no new
    authoring needed for those, just wiring. Separately, 11 cards have
    "whenever you/a player casts..."-shaped oracle/static text
    (`grep -li "whenever you cast\|whenever .* casts" */definition.ts`),
    a superset including the 6 above — the other 5
    (black-mage-s-rod, astrologian-s-planisphere, shambling-cie-th,
    queen-brahne, circle-of-power, the-prima-vista,
    lindblum-industrial-regency-mage-siege, red-mage-s-rapier,
    prompto-argentum — some of these may be *reacting* to a cast granting
    a keyword/ability rather than declaring their OWN cast trigger; not
    individually vetted this pass) are candidates for retroactive
    authoring once real vocabulary exists, not yet confirmed to need it.

- **2026-09-10 — `EventFact.recipient` added, damage direction fix
  (fin/1 Bahamut Mega Flare)**: `damage.controller` was 100% dealer-only
  pool-wide (23/23 real `event:'damage'` facts, all `controller:'you'`)
  while `lifeloss.controller` already means the RECIPIENT
  (summon-primal-odin) — same field, opposite semantics by event type.
  Fixed by ADDING a new optional `EventFact.recipient?: Side`
  (synergy.ts), documented as distinct from both `controller` (dealer/doer)
  and `target` (a `Constraints`-shaped permanent filter, `dies`/
  `putCounter`'s own use — not a `Side`, doesn't fit a player-recipient
  concept). Deliberately did NOT migrate `lifeloss`'s existing
  controller-as-recipient convention — left as a documented special case
  in `EventFact.controller`'s own doc comment (a real re-authoring pass
  across the pool's existing `lifeloss` facts is out of scope; only
  `recipient` is new vocabulary). `describeFact`'s `damage` branch is now
  its own named branch (was previously falling through to the generic
  fallback) — renders bare `"your damage"` when `recipient` is omitted
  (every pre-existing fact, unchanged), `"your damage to the opponent"`
  when declared. Authored `recipient: 'opp'` onto
  `cards/summon-bahamut/synergy.json`'s own `chapter-iv-damage` fact only
  (fin/1-scoped, per explicit instruction — no other card's damage fact
  touched). `verify-synergy.mjs` doesn't check `recipient` at all (it only
  compares `event`/`counterType`/`controller` against trace evidence), so
  it's inert to verification — confirmed 0 hard failures for both
  summon-bahamut and summon-primal-odin after the change (pre-existing
  soft notes only: `tapForMana`/LORE-counter/drawCard, unrelated).
  `synergy.test.ts` gained a dedicated `describeFact — damage` block
  (4 cases: no recipient, `recipient:'opp'`, `recipient:'you'`, recipient
  with no controller) rather than folding into the old generic-fallback
  test block, since damage is no longer generic-fallback. Full
  `functional-model` suite (228 tests) + `tsc --noEmit` clean after.
  **Flagged, not fixed (out of my lane)**: `app/lib/factConditions.ts`
  (card-owned, mirrors `describeFact`'s branch dispatch by hand per its
  own documented "known duplication risk") doesn't know about `damage`'s
  new named branch or `recipient` field yet — Bahamut's damage fact will
  show a redundant raw `{"recipient":"opp"}` in the Facts tab's condition
  column until `card` agent updates that file's `EVENTS_WITH_HAND_WRITTEN_LABEL`/
  hidden-field lists to match. Not a hidden-information bug (the doc's own
  stated worst case — "a field a hair too generously" shown), just
  cosmetic duplication.
  **Open Forge-verification**: none needed for this change — it's a
  synergy/vocabulary schema addition, not new engine mechanics; Bahamut's
  actual `dealDamage` engine behavior (card.ts's `case 'dealDamage'`) was
  already correct and unchanged, only the synergy fact's own label gained
  a way to state direction.

- **2026-09-10 — `self-counters` (`putCounter`) fact authored onto
  `cards/summon-bahamut/synergy.json`**, same self-cast/self-dies pattern:
  `{id:'self-counters', event:'putCounter', counterType:'LORE',
  target:'self', value:1, sourceText:'(As this Saga enters and after your
  draw step, add a lore counter. Sacrifice after IV.)'}`. Two things
  confirmed rather than guessed, per the task's own explicit ask:
  - `putCounter`'s self-reference field is `target` (an `EventFact` field),
    NOT `subject` (`subject` is the ZONE-fact self-reference field —
    `self-battlefield`/`self-sacrifice` on this same card use `subject`
    because they're zone facts; `self-cast`/`self-dies`/this new
    `self-counters` fact are event facts and all three use `target`).
    `effectiveController`/`describeFact`/`app/lib/factConditions.ts`'s own
    `isSelfReferencing` all branch on `EventFact.target === 'self'`
    specifically for this reason.
  - `counterType` must be `'LORE'` (uppercase), matching real trace
    evidence (`saga.ts`'s own `state.putCounter(real, 'LORE', 1)`,
    `engine-trace.ts`'s own `{fn:'putCounter', ..., counterType:'LORE'}`
    log entries) and the one other pool card that already declares this
    same counter type (`clash-of-the-eikons`'s own non-self-referencing
    `putCounterTarget` fact) — NOT lowercase `'lore'` as the task's own
    illustrative example spelled it; `verify-synergy.mjs`'s `counterType`
    comparison is case-sensitive plain equality (line ~651), so the wrong
    case would have produced a NEW hard failure instead of closing the
    existing soft note.
  - **No `producedEvent()`/trace gap existed this time** (unlike the
    `cast` case the task referenced as precedent) — `verify-synergy.mjs`'s
    `case 'putCounter':` branch (line 113) already existed and already
    correctly mapped a `{fn:'putCounter'}` log entry to `{event:
    'putCounter', counterType: entry.counterType}`; the pre-existing
    "trace has putCounter (...) with no matching declared produce" soft
    note for this card was purely a missing FACT, not a missing
    trace/verify-synergy vocabulary branch. Confirmed via a before/after
    `verify-synergy.mjs summon-bahamut` run: the 4 duplicate `putCounter`/
    LORE soft-note lines are gone after adding the fact, leaving only the
    unrelated pre-existing `tapForMana` soft notes (mana-payment logging,
    a separate known gap, out of scope here).
  - Regenerated `trace.json` via `run-scenarios.mjs --slug=summon-bahamut`
    as instructed — this incidentally also caught the file up to an
    EARLIER same-session `scenarios.ts` edit (the forced-self-destroy
    second scenario was removed from `scenarios.ts` itself already, per
    that file's own header comment, but the checked-in `trace.json` still
    had its old log entries until this regen) — not a regression I
    introduced, just stale generated output this task's own regen step
    happened to fix in passing.
  - Verified: `functional-model` vitest suite 216/216 pass; full-pool
    `verify-synergy.mjs` unchanged (still exactly 1 pre-existing unrelated
    hard failure, `auron-s-inspiration`); full-repo `npm run test`
    unchanged (still only the 5 pre-existing unrelated
    `scripts/relations.test.mjs`-domain failures). Confirmed live via the
    dev server's own `/api/card/fin/1` response (the `self-counters` fact
    is present, `role:'source'`) and a direct `describeFact()` call
    (`"LORE counters on itself"` — the bare, single-dimensional label this
    session's `putCounter` branch already produces) plus a read of
    `app/lib/factConditions.ts`'s `isSelfReferencing`/`(cardName)` branch
    confirming it fires for `target:'self'` event facts (so the Facts tab
    note renders `(Summon: Bahamut)` automatically, same as the `self-cast`
    fact from earlier this session — didn't independently re-verify in a
    live browser render, `card` agent's own lane if that specific pixel
    output needs a second look).
  - **No open Forge-verification** — pure synergy/vocabulary authoring
    onto an already-correct, already-cited engine mechanic (`saga.ts`'s
    real 714.2c lore-counter automation, unchanged).

- **2026-09-10, later same day — user OVERRODE the just-above `putCounter`
  design call**: `counterType` no longer stays in the label at all; the
  "distinct category in its own right" reasoning quoted at the top of that
  branch's own doc comment is retired. `describeFact`'s `putCounter` branch
  is now `return 'counters'` unconditionally — bare, no variation,
  consistent with every other single-dimensional label this session
  (`cast`/`dying`/`damage`/`sacrifice`/battlefield-graveyard-presence/
  lifegain/`addMana`/qualified-zone facts). Two changes, one on each side
  of the engine/card boundary:
  - `functional-model/synergy.ts`'s `describeFact` `putCounter` branch —
    comment rewritten, `kind`/template logic removed.
  - `app/lib/factConditions.ts` (card-owned, but the fix was a literal
    one-line guard removal the task explicitly authorized making the call
    on): `counterType` used to be suppressed there specifically FOR
    `putCounter` facts (`if (fact.counterType && fact.event !==
    'putCounter')`) — that carve-out existed only because the label used
    to show it there instead; removed the `fact.event !== 'putCounter'`
    guard so it now renders in the notes/conditions column for `putCounter`
    facts same as any other event that carries one. **Not silently
    guessed** — confirmed via a real `describeFact`/`factConditions` call
    against `cards/summon-bahamut/synergy.json`'s own `self-counters` fact
    (`{event:'putCounter', counterType:'LORE', target:'self', ...}`):
    label is now bare `"counters"` (was `"LORE counters"`), notes column
    is now `"self · LORE counters"` (was just `"self"` — `LORE` was fully
    invisible anywhere on the page before this fix, not just redundant).
  - Updated the two now-stale test files touching this: `synergy.test.ts`'s
    `putCounter` describeFact block (all cases now assert bare `'counters'`
    regardless of `counterType`/`controller`/`target`; added a `putCounter`
    case to the "every label branch is static" representative-fact sweep;
    fixed a comment in that sweep that named `putCounter`'s `counterType`
    as the one remaining verbatim-passthrough exception, since there isn't
    one anymore) and `app/lib/factConditions.test.ts`'s two `putCounter`/
    `counterType` cases (now expect `counterType` shown, not hidden).
  - Verified: `npx vitest run functional-model app/lib/factConditions.test.ts`
    — 235/235 pass. `npx tsc --noEmit` clean. Full-pool
    `verify-synergy.mjs` unchanged (still exactly 1 pre-existing unrelated
    hard failure, `auron-s-inspiration`; `counterType` isn't part of its
    own match/verify logic changing here, only the label template).
  - **No open Forge-verification** — pure label-presentation change, no
    engine mechanic or fact vocabulary touched.

- **2026-09-11 (rollout) — ultima-origin-of-oblivion (fin/2) migrated to
  the unified Fact/annotations model, second card after summon-bahamut.**
  Task scope: pure per-card migration, no `synergy.ts` schema changes
  needed (already pool-wide-safe from the Bahamut pass).
  - Card only has 2 facts total (1 source, 1 sink) — much smaller than
    Bahamut. Real oracle text (fin/2, from `data/fin/fin_scryfall.json`):
    `"Flying\nWhenever Ultima attacks, put a blight counter on target
    land. For as long as that land has a blight counter on it, it loses
    all land types and abilities and has \"{T}: Add {C}.\"\nWhenever you
    tap a land for {C}, add an additional {C}."` — line 1 (0-indexed) is
    the only line either fact anchors to.
  - **No presence-shaped SOURCE fact existed to fix** — the one source
    fact (`{event:'putCounter', counterType:'blight', target:{types:{has:
    ['Land']}}}`) was already a real event, not bare presence. No
    facts removed, none re-anchored, none newly invented (deliberately did
    NOT add baseline self-cast/self-enters facts the way Bahamut has —
    those never existed on this card pre-migration and adding them would
    be net-new authoring beyond "migrate what's there," out of this task's
    explicit scope; Ultima's own `entersBattlefield` trace event stays an
    unexplained `verify-synergy.mjs` soft note, same as before the
    migration, not a regression).
  - Changes made: moved `sourceText`/`highlight`/`id` off both facts into
    a new sibling `annotations-authoring.json` (mirrors summon-bahamut's
    file exactly); ran `compute-annotations.mjs ultima-origin-of-oblivion`
    to bake real `annotations` (verified both slices byte-match the real
    oracle text: `[25,60)` of line 1 = "put a blight counter on target
    land", `[49,60)` = "target land"); added `targeted: true` to the
    source fact (real "target land" CR-targeting language, genuine choice
    among candidates — oracle text has NO owner restriction, confirmed via
    the card's own `scenarios.ts` comment, so `controller` stays
    unconstrained on both facts, unchanged); folded the sink's legacy
    `zone: 'Battlefield'` to `to: 'Battlefield'` per the unified-shape
    convention for newly-touched facts; added `'ultima-origin-of-oblivion'`
    to `scripts/annotation-coverage.mjs`'s `ANNOTATED_CARD_SLUGS`.
  - Did NOT run `compute-weights.mjs` (would rewrite `value` pool-wide,
    ~300 cards, out of this task's "don't touch other cards' files" scope)
    — neither fact's magnitude changed (still 1 blight counter), so the
    existing `value: 1` on both stays valid without a recompute.
  - **Real find-synergies.mjs diff (stash-isolated A/B on just this card's
    synergy.json): byte-identical before/after** — 20 interaction lines
    both times, same set of land-permanent cards, same "battlefield
    presence" label (Ultima's sink matching every land-producer's own
    bare-presence source fact; none of Ultima's own facts match anything
    on the source side — no pool card sinks on "counters placed on a
    land"). Confirms this was a pure shape migration with zero matching
    behavior change, same as Bahamut's own SOURCE-zone-fold case.
  - Verified: `npx vitest run functional-model` 234/234;
    `verify-synergy.mjs` (whole pool) 313 checked, 1 hard failure (still
    only the pre-existing unrelated `auron-s-inspiration`);
    `verify-annotation-coverage.mjs` clean; `verify-scenario-card-names.mjs`
    clean (this card's own `scenarios.ts` only ever adds real Forest lands
    via `setupEnginePilot`, no fabricated names); `npm run typecheck`
    clean. Bystander-controller check (task's own item 7): N/A for this
    card — its one scenario is a real engine-piloted trace with zero
    manually-pushed log entries of any kind (no legacy-style raw `enters`
    push for a bystander at all), so the Bahamut-class bug has no
    applicable surface here. `scenarios.ts`/`trace.json` both untouched
    (no diff), so no `run-scenarios.mjs` regen was needed.
  - **Noticed but not touched**: a concurrent peer session added
    `adelbert-steiner` to the same `ANNOTATED_CARD_SLUGS` line in
    `scripts/annotation-coverage.mjs` while this task was in flight (shared
    file, expected multi-orchestrator collision per CLAUDE.md) — left it
    alone, both entries coexist correctly, re-verified the file's final
    state still contains this card's own slug after the interleaving.
  - **No open Forge-verification** — pure synergy/annotation-shape
    migration onto already-correct, already-cited real oracle text; no
    engine mechanic touched.

- **2026-09-11 (rollout) — aerith-rescue-mission (fin/5) migrated to the
  unified Fact/annotations model, third card in the rollout.** Task scope:
  pure per-card migration, no `synergy.ts` schema changes needed.
  - Real oracle text (fin/5, `data/fin/fin_scryfall.json`): `"Choose one —\n•
    Take the Elevator — Create three 1/1 colorless Hero creature tokens.\n•
    Take 59 Flights of Stairs — Tap up to three target creatures. Put a stun
    counter on one of them. (If a permanent with a stun counter would become
    untapped, remove one from it instead.)"`. Type line: plain `"Sorcery"`
    (no creature subtype at all) — checked `definition.ts` (a `modal` Effect,
    2 modes: `createToken`, and a `custom` tap-then-stun combo) before
    assuming anything Bahamut-shaped applied; this card never occupies the
    battlefield as a permanent at all, so there's no `self-enters`/`self-dies`
    analog possible — confirmed by NOT inventing either.
  - **3 source + 1 sink facts, all pre-existing, none removed, none
    invented new** (deliberately did NOT add a `self-cast` fact the way
    Bahamut has one — checked: Bahamut's `self-cast` was ALREADY present
    pre-migration in its own v1 file, this card's v1 file never had one, so
    adding it now would be net-new authoring beyond "migrate what's there,"
    same scope boundary `ultima-origin-of-oblivion`'s own migration already
    drew). All 3 source facts had genuine textual backing already — no
    presence-shaped-with-nothing-real-behind-it case to fix here (unlike
    Bahamut's `self-battlefield`).
    - `create-hero-tokens` (`zone:'Battlefield'` → `to:'Battlefield'`): also
      given `event:'entersBattlefield'` — CR 111.7, a created token
      genuinely enters the battlefield (same real-occurrence labeling
      Bahamut's own `self-enters` established for a cast permanent) —
      purely documentary, confirmed via `factsInteract`'s shape-partition
      gate that this doesn't add any NEW matching capability (it's already
      zone-shaped via `to`), just real, accurate data. Annotated to oracle
      line 1, highlight "Create three 1/1 colorless Hero creature tokens".
    - `stun-counter-produce` (`event:'putCounter', counterType:'stun',
      target:{types:{has:['Creature']}}`) — added `targeted:true` (real CR
      601.2c "target creatures" language, genuine choice among legal
      candidates, oracle text has NO controller restriction — can hit either
      player's creatures). Annotated to oracle line 2, highlight "Put a stun
      counter on one of them".
    - `self-graveyard` (`zone:'Graveyard'` → pure `to:'Graveyard'`,
      `controller:'you', subject:'self'`, no `event`) — CR 608.2m: a
      non-permanent spell is put into its owner's graveyard as it resolves,
      Stack → Graveyard; `from` deliberately omitted per the Stack-
      invisibility rule (the real origin IS the Stack, not unknown). No real
      oracle-text basis for this baseline rule (same situation Bahamut's own
      `self-cast`/`self-enters` were in) — re-anchored to the printed TYPE
      LINE instead (`target:'typeLine'`, highlight "Sorcery": being a
      Sorcery is exactly what licenses CR 608.2m's guaranteed graveyard
      trip). No `event` key added — there's no established consequence
      vocabulary for "a non-permanent spell resolves to its owner's
      graveyard" distinct from `dies` (which specifically requires
      Battlefield origin, CR 700.4, inapplicable here since this card never
      touches the battlefield) — left as a bare zone fact, same minimalism
      Bahamut's own pre-`dies`-merge `self-graveyard` had.
    - Sink `wants-target-creatures` (`zone:'Battlefield'` →
      `to:'Battlefield', types:{has:['Creature']}`) — reshaped only, kept
      functional/simple per the sink-side exemption (SINKs don't need to be
      data-driven, only to function). Annotated to oracle line 2, highlight
      "Tap up to three target creatures".
  - `id`/`sourceText`/`highlight`/`anchor` moved off all 4 facts into a new
    `annotations-authoring.json` (positionally aligned, mirrors
    summon-bahamut's file exactly); ran `compute-annotations.mjs
    aerith-rescue-mission` — all 4 facts annotated, byte-verified offsets
    (line 1 `[22,69)` = "Create three 1/1 colorless Hero creature tokens",
    line 2 `[64,97)` = "Put a stun counter on one of them", line 2 `[30,62)`
    = "Tap up to three target creatures", typeLine `[0,7)` = "Sorcery").
    Added `'aerith-rescue-mission'` to `scripts/annotation-coverage.mjs`'s
    `ANNOTATED_CARD_SLUGS` (re-read the file fresh first — two OTHER
    concurrent sessions had already appended `ultima-origin-of-oblivion`/
    `adelbert-steiner` and later `aerith-gainsborough` to the same line
    while this task was in flight; all four entries plus mine coexist
    correctly, confirmed by re-running `verify-annotation-coverage.mjs`
    clean after each interleaving).
  - **Real find-synergies.mjs diff, full pool, isolated from concurrent
    noise**: before/after line count for "Aerith Rescue Mission" went
    115→116, but the +1 is `Adelbert Steiner --[enters the battlefield]-->
    Aerith Rescue Mission` — confirmed via `git status` that
    `adelbert-steiner/synergy.json` was independently modified by a
    concurrent peer session mid-task (its own new `entersBattlefield`-shaped
    produce fact now satisfies this card's pre-existing, UNCHANGED
    `wants-target-creatures` sink) — NOT caused by anything in this diff.
    Excluding that one line: 0 matches gained, 0 lost. The ONLY real change
    from this card's own migration is a LABEL rename on the 11 existing
    unconstrained-battlefield-presence matches (Clash of the Eikons, Dion
    Bahamut's Dominant, Doppelgang, Formidable Speaker, Omega Heartless
    Evolution, Restoration Magic, Sage's Nouliths, Squall SeeD Mercenary,
    Stiltzkin Moogle Merchant, Summon: Bahamut, The Wandering Minstrel) —
    "battlefield presence" → "enters the battlefield", purely because
    `create-hero-tokens` now declares `to` instead of `zone`
    (`describeFact`'s zone-movement-name branch fires regardless of the
    `event` field's presence) — same cosmetic-only change class Bahamut's
    own `self-enters`/`self-graveyard` conversions produced. The 9
    unconstrained-graveyard-presence matches (via `self-graveyard`) are
    unaffected — no `ZONE_MOVEMENT_NAMES` entry exists for
    (Stack-invisible)→Graveyard, so that fact correctly keeps rendering bare
    "graveyard presence".
  - Updated `progress.json`: `lastVerified` → 2026-09-11,
    `textCoverageAudited` → true, `notes` records the migration summary;
    `review`/`enrichment` were already `"ai"` (never `"reviewed"`), so no
    review-status reset was needed.
  - Bystander-controller check (task item 8): N/A — this card's
    `scenarios.ts` uses the real engine-piloted path (`setupEnginePilot`/
    `pilotCast`/`pilotResolveTop`) with zero manually-pushed `pilot.log.push`
    entries of any kind, so the Bahamut-class "missing controller on a
    manual bystander `enters` push" bug has no applicable surface here.
    `scenarios.ts`/`trace.json` both untouched (no diff), so no
    `run-scenarios.mjs` regen was needed. `verify-scenario-card-names.mjs`
    (both scoped and full-pool) clean — this card's own scenarios only ever
    add real cards/tokens (`c_1_1_hero`, `w_1_1_cat`, basic Plains).
  - Verified: `npx vitest run functional-model` 234/234; `verify-synergy.mjs`
    (whole pool) 313 checked, 1 hard failure (still only the pre-existing
    unrelated `auron-s-inspiration`); scoped → 0 hard failures (only
    pre-existing `tapForMana` soft notes, same class Bahamut's own scoped
    run has); `verify-annotation-coverage.mjs` clean (whole pool, all 5
    opted-in cards including 3 concurrent ones); `npm run typecheck` clean
    exit 0.
  - **No open Forge-verification** — pure synergy/annotation-shape migration
    onto already-correct, already-cited real oracle text (CR 111.7/608.2m/
    601.2c citations are rules-vocabulary justification for fact placement,
    not new engine-mechanic claims); no `harness.ts`/`engine-trace.ts`/
    `interfaces.ts` behavior touched.

- **2026-09-11 (rollout) — adelbert-steiner (fin/3) migrated to the unified
  Fact/annotations model.** Task scope: pure per-card migration, no
  `synergy.ts` schema changes needed.
  - Real oracle text (fin/3, `data/fin/fin_scryfall.json`): `"Lifelink\n
    Adelbert Steiner gets +1/+1 for each Equipment you control."`. Type
    line: `"Legendary Creature — Human Knight"`.
  - **4 pre-existing facts (3 source, 1 sink) → 3 source + 1 sink after a
    real merge, none newly invented** (same "don't add facts beyond what's
    there" scope boundary ultima-origin-of-oblivion/aerith-rescue-mission
    both drew):
    - `self-battlefield` (bare `zone:'Battlefield', subject:'self'`
      presence, `sourceText` a parenthetical gloss, never real oracle text)
      — this WAS the presence-shaped-SOURCE violation the task's rule 2
      exists for. Converted to `{event:'entersBattlefield', to:'Battlefield',
      subject:'self', target:'self'}`, re-anchored to the real printed TYPE
      LINE (`target:'typeLine'`, highlight "Creature") — same "being a
      Creature is what licenses this permanent entering the battlefield"
      reasoning summon-bahamut's own `self-enters` already established.
      **Kept `subject:'self'` deliberately, not dropped**: a first draft
      without it silently lost all ~130 real type-constrained
      Battlefield-presence matches (Aerith Gainsborough, Beatrix, Craterhoof
      Behemoth, Elrond, and ~126 more) — caught via the REQUIRED
      find-synergies.mjs before/after diff, not assumed clean; fixed by
      restoring `subject:'self'` since the OLD `self-battlefield` fact this
      one replaces already carried it (unlike Bahamut's own `self-enters`,
      which had no `subject`-carrying predecessor to inherit from at all —
      different starting state, different correct outcome). Re-ran the diff
      after the fix: fully restored, net 0 change on that side.
    - `self-graveyard` (ZoneFact, `zone:'Graveyard', subject:'self'`) +
      `self-dies` (EventFact, `event:'dies', target:'self'`) — the same
      real occurrence (this creature dying) represented twice, exactly
      Bahamut's own `self-graveyard`/`self-dies` situation — merged into
      ONE `{event:'dies', from:'Battlefield', to:'Graveyard',
      controller:'you', subject:'self', target:'self', value:1}`, keeping
      BOTH `subject` and `target` per the same lesson. Neither original
      fact had real oracle-text backing (`sourceText` was baseline-death
      parenthetical gloss, same "no real ability text" situation
      `self-battlefield` was in) — re-anchored to the type line too
      (highlight "Creature": being a Creature permanent is exactly what
      licenses the generic CR 700.4/704.5f "this can die" consequence, same
      real-anchor standard as the entering case, not a fabricated
      annotation). Deliberately reuses the identical typeLine span as the
      `entersBattlefield` fact above — considered giving it a different
      span for cosmetic distinctness, rejected: there is no other real text
      to point at, and two distinct facts (different `describeFact` labels)
      legitimately sharing one real anchor isn't a violation of anything —
      `factIdentity` (role + describeFact + annotations[0]) still
      disambiguates them.
    - `lifelink` (`event:'lifegain', controller:'you'`) — real oracle text
      already ("Lifelink", line 0), untouched structurally, just gained a
      real annotation.
    - Sink `wants-equipment` (`zone:'Battlefield', types:{has:['Equipment']}`)
      — folded `zone` → `to` per the unified shape, kept functional/simple
      per the sink-side exemption. Real oracle text line 1, highlight "gets
      +1/+1 for each Equipment you control".
  - No `targeted` added anywhere — every EventFact here has only
    `target:'self'`/singular `controller:'you'`, no real bucket of
    candidates (same as most of Bahamut's own self-referencing facts).
  - `id`/`sourceText`/`highlight` moved off all 4 facts into a new
    `annotations-authoring.json` (mirrors summon-bahamut's file exactly);
    ran `compute-annotations.mjs adelbert-steiner` — all 4 facts annotated,
    byte-verified offsets (typeLine `[10,18)` = "Creature" ×2, oracle line 0
    `[0,8)` = "Lifelink", oracle line 1 `[17,58)` = "gets +1/+1 for each
    Equipment you control"). Added `'adelbert-steiner'` to
    `scripts/annotation-coverage.mjs`'s `ANNOTATED_CARD_SLUGS` (found
    `'ultima-origin-of-oblivion'` already added there by a concurrent peer
    session when I first read the file — left it, added mine alongside;
    that peer session's own notes entry above independently records finding
    mine there too, both sides confirmed the coexistence is correct).
  - **Real find-synergies.mjs diff, isolated via a temporary before/after
    file swap (NOT `git stash` — tried that first, immediately caught it
    would have reverted OTHER sessions' concurrent uncommitted work
    pool-wide too, `git stash pop`'d back out within the same command batch
    before running anything else; used a plain file copy/restore instead for
    the rest of the diff)**: before had this card's own `self-battlefield`
    matching ~130 cards' own bare Battlefield-presence sinks (label
    "battlefield presence") + `self-graveyard`/`self-dies` separately
    matching ~21 graveyard-presence sinks (label "graveyard presence") +
    3 real event-shaped `event:'dies'` sinks (Judge Magister Gabranth,
    Sephiroth Fabled SOLDIER, Zodiark Umbral God). After: the SAME ~130
    matches now render as "enters the battlefield" (pure label rename, `to`
    replacing `zone`, once `subject` was restored — see above), the same
    ~21 graveyard matches now render as "dies", and the 3 event-shaped
    `dies` sinks are LOST — the same accepted shape-family regression
    summon-bahamut's own merge already established and documented (a
    merged fact classifies zone-shaped only, `factsInteract`'s
    `isZoneFact(p) !== isZoneFact(w)` gate rejects it against an
    event-only want before `event` string equality is ever checked). Net:
    155 → 152 real interaction lines for this card, -3, fully accounted
    for, not a silent loss. `wants-equipment` sink: 0 real incoming matches
    both before and after — no Equipment card in the pool authors a SOURCE
    fact of its own yet (checked `buster-sword`'s own `synergy.json`: empty
    `source: []`) — a pre-existing pool-authoring gap on the OTHER side,
    not something this card's own migration introduced or can fix.
  - Bystander-controller check (task item 7): checked the one manual
    `pilot.log.push({fn:'enters', card: secondCopy.name, ...})` in
    `scenarios.ts` (the legend-rule second-copy demo) — no `controller`
    field, but `secondCopy` is added via `pilot.state.addCard(pilot.you,
    'Battlefield', ...)`, i.e. genuinely controlled by `pilot.you`, and
    `scenarioReplay.ts`'s `guessOwner` already defaults an unrecognized name
    to `'you'` — same "checked, not a live bug" conclusion the original
    `latest+15` pool-wide sweep already reached for this exact card. Left
    unchanged, not "fixed a bug that wasn't there."
  - `verify-scenario-card-names.mjs`: clean (this card's own scenario adds
    real cards/tokens only — Adelbert Steiner itself, the real `sword`
    token, real basic lands via `basicLandsFor`).
    `scenarios.ts`/`trace.json` both untouched (no diff), so no
    `run-scenarios.mjs` regen was needed.
  - Did NOT run `compute-weights.mjs` — kept the already-real `value`s
    (lifelink 5, merged `dies` 1, `wants-equipment` 1) since their
    magnitude didn't change; the newly-shaped `entersBattlefield` fact
    (materially different from the old bare presence fact it replaces, not
    just a rename) got the standard `-1` "needs a real weights pass"
    placeholder, same convention Bahamut's own brand-new `self-cast`/
    `self-enters` used.
  - Updated `progress.json`: `lastVerified` → 2026-09-11, `notes` records
    the migration summary (kept the pre-existing, unrelated combat-damage
    soft-note text, appended rather than replaced); `review`/`enrichment`
    were already `"ai"` (never `"reviewed"`), so no review-status reset was
    needed.
  - Verified: `npx vitest run functional-model` 234/234; `verify-synergy.mjs`
    (whole pool) 313 checked, 1 hard failure (still only the pre-existing
    unrelated `auron-s-inspiration`); scoped → 0 hard failures (only
    pre-existing `tapForMana`/`attack`-unrecognized-action/combat-damage/
    opponent-land-draw soft notes, all pre-existing, unrelated to this
    migration); `verify-annotation-coverage.mjs` clean (whole pool);
    `verify-scenario-card-names.mjs` clean (whole pool); `npm run
    typecheck` clean, exit 0.
  - **No open Forge-verification** — pure synergy/annotation-shape migration
    onto already-correct, already-cited real oracle text (CR 700.4/704.5f
    citations are rules-vocabulary justification for the type-line-anchored
    baseline "this creature can die" fact, same standing as CR 111.7's own
    citation for "this creature enters the battlefield" elsewhere in this
    rollout — not new engine-mechanic claims); no `harness.ts`/
    `engine-trace.ts`/`interfaces.ts` behavior touched.

- **2026-09-11 (rollout follow-up) — added `self-cast` to
  aerith-rescue-mission (fin/5), per an explicit coordinator ask after the
  initial migration above deliberately left it out (correctly, at the
  time — out of that pass's own "migrate what's there" scope).** Same
  pattern as summon-bahamut's own `self-cast`: `{event:'cast',
  from:'Hand', target:'self', value:-1}`, added as the FIRST source entry
  (matching Bahamut's own ordering) with its positionally-aligned
  `annotations-authoring.json` entry (`anchor:'typeLine'`,
  sourceText/highlight `"Sorcery"` — same "Sorcery" span `self-graveyard`
  already anchors to, no real oracle-text basis for a baseline "this is
  cast like any spell" claim, same reasoning as Bahamut's own
  `self-cast`/`self-enters`). Re-checked `definition.ts` per the
  coordinator's own instruction before assuming `from:'Hand'` — no
  alternate cost/flashback/foretell wrinkle, plain `{3}{W}` mana cost,
  cast from hand is the only real path onto the stack for this card.
  `value:-1` per the concurrent, now-documented "`Fact.value` accuracy is
  deliberately deprioritized" note (`SYNERGY_DESIGN.md`, added by a peer
  session mid-rollout, same day) — not computed, not meant to be.
  - Ran `compute-annotations.mjs aerith-rescue-mission` — 5 facts
    annotated now (was 4); new fact's annotation verified `{target:
    'typeLine', start:0, end:7}` = "Sorcery", byte-correct.
  - **Real find-synergies.mjs diff, isolated to this one change (before =
    post-initial-migration state, after = with `self-cast` added): ZERO
    lines changed anywhere in the pool.** `event:'cast'` currently has
    exactly one other real declaration pool-wide (summon-bahamut's own
    `self-cast`, also a SOURCE, never a sink) — no pool card sinks on it
    yet, so this is purely documentary today, same real-world impact
    Bahamut's own `self-cast` already has. Confirmed via a full-pool
    `find-synergies.mjs` run, not assumed from the vocabulary check alone.
  - Verified: `verify-synergy.mjs` scoped to this card → 0 hard failures
    (same pre-existing `tapForMana` soft notes as before);
    `verify-annotation-coverage.mjs` → this card clean. **Full-pool
    `verify-synergy.mjs`/`vitest` both show 1 unrelated failure each
    (`ultima-origin-of-oblivion`, a DIFFERENT card) — confirmed via
    `git status` this is a concurrent peer session's own live
    in-progress edit (`definition.ts`/`synergy.json`/`progress.json` all
    mid-flight, 3 new zero-annotation facts:
    `[source][0] cast`/`[source][2] addMana`/`[sink][1] addMana`), NOT
    caused by this task and NOT this card's file to touch — left
    strictly alone.** `npm run typecheck` clean, exit 0 (typecheck
    doesn't touch per-card JSON content, unaffected either way).
  - **No open Forge-verification** — same as the initial migration; no new
    engine-mechanic ground being covered, `event:'cast'` vocabulary and
    the type-line-anchor pattern were both already established by
    summon-bahamut.

- **2026-09-11 (rollout follow-up) — added `self-cast` to adelbert-steiner
  (fin/3), per an explicit coordinator ask after the initial migration
  above deliberately left it out (correctly, at the time — out of that
  pass's own "migrate what's there" scope).** Same pattern as
  summon-bahamut's own `self-cast`: `{event:'cast', from:'Hand',
  target:'self', value:-1}`, added as the FIRST source entry (matching
  Bahamut's own ordering) with its positionally-aligned
  `annotations-authoring.json` entry (`anchor:'typeLine'`,
  sourceText/highlight `"Creature"` — the SAME span this card's own
  `entersBattlefield`/`dies` facts already anchor to; no other real type
  exists to differentiate it, and reusing an already-real anchor across
  distinct `describeFact` labels is the established, accepted pattern on
  this card, not a new judgment call). No `subject` added (matches
  Bahamut's own `self-cast`, which never had a subject-carrying
  predecessor — same as this card's own brand-new fact, unlike
  `self-battlefield`→`entersBattlefield`'s real merge above). Re-checked
  `definition.ts` before assuming `from:'Hand'` — plain `{1}{W}` mana cost,
  no alternate-cost/flashback/foretell effect anywhere in the definition,
  cast from hand is the only real path onto the stack for this card.
  `value:-1` per the concurrent "`Fact.value` accuracy is deliberately
  deprioritized" note (`SYNERGY_DESIGN.md`, added by a peer session
  mid-rollout) — not computed, not meant to be.
  - Ran `compute-annotations.mjs adelbert-steiner` — 5 facts annotated now
    (was 4); new fact's annotation verified `{target:'typeLine', start:10,
    end:18}` = "Creature", byte-correct (same offsets the other two
    typeLine-anchored facts on this card already use).
  - **Real find-synergies.mjs diff, isolated to this one change** — could
    NOT reuse a plain `git stash`/direct pool-state diff this time since
    several OTHER cards' `synergy.json` were mid-edit by concurrent peer
    sessions at the time (aerith-gainsborough, aerith-rescue-mission,
    ultima-origin-of-oblivion all showed up in `git status`); instead
    isolated the marginal effect by running `find-synergies.mjs` twice
    against the SAME current full-pool state, swapping only this card's
    own `synergy.json` between "with self-cast" and "without" (a plain
    file copy/restore, not `git stash`) — this holds every OTHER card's
    concurrent in-flight state constant across both runs, so only this
    card's own new fact's effect shows up in the diff. **Result: ZERO
    lines changed anywhere in the pool.** Confirmed pool-wide: 0 sink facts
    anywhere declare `event:'cast'` (checked directly via a small Node
    script over every `cards/*/synergy.json`), so this is purely
    documentary today, same real-world impact Bahamut's own `self-cast`
    (and aerith-rescue-mission's own, added by a concurrent peer session
    this same round) already has.
  - Updated `progress.json`: appended the follow-up to `notes` (did not
    replace the existing migration summary) — `lastVerified` already
    2026-09-11 from the initial pass, left as-is.
  - Verified: `verify-synergy.mjs` scoped to this card → 0 hard failures
    (same pre-existing `tapForMana`/`attack`-unrecognized-action/
    combat-damage/opponent-land-draw soft notes as before, `cast` produces
    no new unaccounted-for trace evidence since `pilotCast` in this card's
    own `scenarios.ts` already logs a real `cast` action);
    `verify-annotation-coverage.mjs`/`verify-scenario-card-names.mjs` →
    this card clean. **Full-pool `verify-synergy.mjs`/`vitest` both show 1
    unrelated failure each (`ultima-origin-of-oblivion`, a DIFFERENT
    card) — confirmed via `git status` this is the SAME concurrent peer
    session's own live in-progress edit already flagged in the
    aerith-rescue-mission follow-up entry just above (3 new
    zero-annotation facts: `[source][0] cast`/`[source][2]
    addMana`/`[sink][1] addMana`) — NOT caused by this task and NOT this
    card's file to touch, left strictly alone.** `npm run typecheck` clean,
    exit 0.
  - **No open Forge-verification** — no new engine-mechanic ground being
    covered; `event:'cast'` vocabulary and the type-line-anchor pattern
    were both already established by summon-bahamut.

- **2026-09-11 (rollout correction) — coordinator caught a real authoring
  bug in adelbert-steiner's own merged `dies` fact: it had been re-anchored
  to the bare type line ('Creature') for lack of real oracle-text basis,
  the same treatment `entersBattlefield`/`cast` correctly got — but
  "dies" is NOT a universal truth the way "is cast"/"enters the
  battlefield" are.** Casting/entering are guaranteed, deterministic
  consequences of a permanent spell resolving (CR 601.2a, 111.7/608.2b) —
  there's no "was cast but didn't move to the stack" or "resolved but
  didn't enter" case. Dying is CONTINGENT: it requires something to
  actually happen to the creature (combat damage, a removal spell, a
  printed self-sacrifice like summon-bahamut's own "Sacrifice after
  IV."). This card's ENTIRE oracle text (`"Lifelink\nAdelbert Steiner
  gets +1/+1 for each Equipment you control."`) has zero death/sacrifice/
  removal-related text — nothing licenses "this WILL die" the way the
  type line genuinely licenses "this WILL enter the battlefield." Same
  overreach class as the already-removed `self-battlefield` (bahamut)/
  `mega-flare-opp` (bahamut) — a fact whose claimed textual basis doesn't
  actually support what it asserts. Verdict: REMOVE, don't re-anchor —
  correctly agreed with the coordinator's own reasoning, not a
  contested call.
  - **Checked for dependency before removing** (same "check before
    deleting" discipline as every prior removal this rollout): ran
    `find-synergies.mjs` against the current on-disk state first — 22 real
    matches depended on this fact (all unconstrained Graveyard-presence
    sinks: Ardyn the Usurper, Cantankerous Keepers, Cloud of Darkness,
    Deadly Embrace, Eden Seat of the Sanctum, Elixir, Emet-Selch
    Unsundered, Evil Reawakened, Exdeath Void Warlock, Fight On!, Golbez
    Crystal Collector, Gran Pulse Ochu, Ignis Scientia, Joshua Phoenix's
    Dominant, Magic Pot, Phoenix Down, Qutrub Forayer, Rydia's Return, Sin
    Spira's Punishment, The Final Days, Thranduil Sindarin Liege, Vanille
    Cheerful l'Cie) — reported before removing, per instruction.
  - Removed the fact from `synergy.json` (4→3 source facts) and its
    positionally-aligned `annotations-authoring.json` entry (index 3,
    same "keep both files in lockstep" discipline every prior
    add/remove/merge this rollout has followed). Re-ran
    `compute-annotations.mjs adelbert-steiner` — byte-identical round-trip
    on the remaining 3 facts (`cast`, `entersBattlefield`, `lifegain`),
    confirmed removal didn't disturb anything else.
  - **Real find-synergies.mjs diff, isolated against the current (still
    concurrently-changing) pool state via a same-snapshot before/after
    file swap**: lost exactly those 22 real lines, nothing else changed —
    155→133 total interaction lines for this card. Fully accounted for,
    matches the pre-removal dependency check exactly (not a surprise
    count).
  - **Side effect, expected and correct, not a new gap**: `verify-
    synergy.mjs` scoped to this card now surfaces one new SOFT note (still
    0 hard failures) — the scenario's own real 704.5j legend-rule removal
    (`fn:'legendRule'`, second copy enters, one is removed — the real
    battlefield→graveyard move a legend-rule removal genuinely is) now has
    NO supporting produce fact at all, since the fact that used to cover
    "this creature moves battlefield→graveyard" is gone. This is the
    HONEST outcome of removing an unfounded claim, not a regression to
    chase — the model correctly no longer asserts something about this
    card's own death path that the real printed text never supported.
  - **Double-checked `entersBattlefield` under the same scrutiny, per the
    coordinator's own explicit request, rather than assuming the earlier
    reasoning still held**: confirmed it's fine, for the reason above —
    entering the battlefield is a guaranteed, deterministic outcome of a
    permanent spell resolving (real CR 111.7/608.2b), no contingent
    external cause required the way dying needs one. Same distinction
    summon-bahamut's own `self-enters` already rests on (that fact has
    survived the same scrutiny every round of this rollout so far);
    holds identically for this card. No change made to it.
  - Updated `progress.json`: appended the correction to `notes` (kept the
    full prior history, didn't rewrite it) — `lastVerified` stays
    2026-09-11.
  - Verified: `npx vitest run functional-model` 236/236 (the earlier
    concurrent `ultima-origin-of-oblivion` failure flagged in the prior two
    entries is gone now — that peer session finished its own work in the
    meantime); `verify-synergy.mjs` (whole pool) 313 checked, 1 hard
    failure (still only the pre-existing unrelated `auron-s-inspiration`);
    scoped → 0 hard failures (the new `legendRule` soft note above, plus
    the same pre-existing `tapForMana`/`attack`/combat-damage/opponent-
    land-draw notes); `verify-annotation-coverage.mjs` clean (whole pool);
    `verify-scenario-card-names.mjs` clean (whole pool); `npm run
    typecheck` clean, exit 0.
  - **No open Forge-verification** — pure fact-authoring correction
    (removing a fact with no real mechanical/textual basis, same category
    as the earlier `self-battlefield`/`mega-flare-opp` removals on
    summon-bahamut), no `harness.ts`/`engine-trace.ts`/`interfaces.ts`
    behavior touched. CR 601.2a/111.7/608.2b citations are the
    rules-vocabulary basis for WHY casting/entering stay universal while
    dying doesn't — not new engine-mechanic claims.

- **2026-09-11 (doc-only, no data change) — parked a real, GENERAL category
  gap surfaced by adelbert-steiner's own migration: pump/stat-scaling
  SOURCE effects have no `Fact` representation anywhere in the pool, and
  there's no vocabulary that could express one today.** User's own framing
  (relayed by the coordinator): "the effect is totally uncovered in facts,
  which is ok for now... probably at some point we have to account for
  that, as some effects require specific power/toughness and that's also a
  synergistic direction" — explicitly NOT Steiner-specific, flagged
  broadly. Written into `SYNERGY_DESIGN.md` as a new `###` subsection
  ("Known, deliberately parked gap: pump/stat-scaling SOURCE effects have
  no `Fact` representation") right after the Ultima mana-doubling gap
  section, same "document, don't fix" treatment as the `Fact.value`
  deprioritization note earlier today.
  - Concrete case: Steiner's own "gets +1/+1 for each Equipment you
    control" is a real layer-7a CDA (`ptFormula:
    {kind:'addPerEquipmentControlled'}`, `state.ts`'s own `effectivePT`,
    CR 613.1/613.3). The SINK half is covered (`wants-equipment`). The
    SOURCE half (Steiner's own P/T varying) has NO fact — and there's no
    existing `Constraints`/`Fact` shape that could express "this
    permanent's own stats are a live function of board state" at all; it's
    not a zone movement, event, or static type/cmc/name filter.
  - **Checked, per the coordinator's own explicit ask, not assumed: is
    base P/T tracked as a fact anywhere today?** Yes, but only the FIXED
    PRINTED value, implicitly (never authored on a `Fact` object directly)
    — `Constraints.power`/`.toughness` already exist and are already
    matchable against a `subject:'self'` zone-shaped produce via
    `resolveSubject` → `staticAttrsFor(card).power`/`.toughness`, which
    reads `CardDefinition.pt` (the printed base, e.g. Steiner's `[2, 1]`).
    **Confirmed this NEVER consults `state.ts`'s own `effectivePT`** (the
    live, `ptFormula`-recalculated number) — so a hypothetical "power 4+"
    sink checking Steiner would only ever see his printed base power (2),
    never his real live power once Equipment is attached. Same blindness
    would apply to any other pool pump source (anthem effects, +1/+1
    counters already tracked as `putCounter` EVENT facts but never fed
    back into a re-derived P/T for constraint-matching) — a real, general
    limitation, not unique to CDA-formula cards.
  - No new vocabulary designed or proposed — deliberately just documented
    the gap and the concrete mechanism (`staticAttrsFor`/`resolveSubject`
    reading only `CardDefinition.pt`, never `effectivePT`) so a future task
    doesn't have to re-derive where the blind spot actually lives. Not
    scheduled; revisit only if a real future task specifically asks for
    dynamic-P/T matching.
  - No verification round needed/run beyond a quick sanity check that the
    doc edit didn't break Markdown structure (headers/checked manually) —
    no code, `synergy.json`, or test files touched.

- **2026-09-11 (rollout) — battle-menu (fin/9) migrated to the unified
  Fact/annotations model, per an explicit coordinator task.** Task scope:
  pure per-card migration, no `synergy.ts` schema changes needed. Read the
  full `SYNERGY_DESIGN.md` (all corrections from the fin/1-5 rollout) first
  per the task's own instruction, rather than re-deriving anything.
  - Real oracle text (fin/9, `data/fin/fin_scryfall.json`): `"Choose one —\n•
    Attack — Create a 2/2 white Knight creature token.\n• Ability — Target
    creature gets +0/+4 until end of turn.\n• Magic — Destroy target
    creature with power 4 or greater.\n• Item — You gain 4 life."`. Type
    line: plain `"Instant"`. The one earlier, narrower fix (`'Behemoth'` →
    the real "Coliseum Behemoth" in `scenarios.ts`'s Magic-mode scenario,
    already committed before this task started, confirmed via `git status`
    showing `scenarios.ts` untouched) was NOT redone — confirmed still
    correct (real controller field: `controller:
    pilot.opponents[0]!.name`, not a bare `'opp'` — the bystander-controller
    check this rollout's task list keeps asking for was already satisfied).
  - **6 source + 2 sink facts, one real merge, one removal, one addition,
    one type-line-anchor correction, none newly invented beyond what the
    real text supports**:
    - Added `self-cast` (`{event:'cast', from:'Hand', target:'self',
      value:-1}`, FIRST source entry, matching Bahamut's own ordering) —
      checked `definition.ts`: plain `{1}{W}`, no alternate cost, cast from
      hand is the only real path. `anchor:'typeLine'`, highlight "Instant".
    - `attack-token` (was bare `zone:'Battlefield', subject:{token:
      'w_2_2_knight'}`, a presence-shaped SOURCE violation — rule 2)
      reshaped into a real zone-CHANGE fact: `{event:'entersBattlefield',
      to:'Battlefield', controller:'you', subject:{token:'w_2_2_knight'}}`
      — the created token genuinely enters the battlefield (CR 111.7), same
      pattern aerith-rescue-mission's own `create-hero-tokens` already
      established for a created-token source. Kept its original `value:1`
      (not reset to `-1`) — this is a decoration (adding `event` alongside
      the same real `to`), not a materially different claim, same
      "reshape-only keeps its value" treatment aerith-rescue-mission's own
      analogous `create-hero-tokens` conversion got, not Bahamut's
      "materially different, reset to -1" case. Annotated to oracle line 1,
      highlight "Create a 2/2 white Knight creature token".
    - **Merged two redundant Magic-mode facts into one, per the exact
      Bahamut/Steiner `dies`-merge pattern.** The old file had BOTH
      `magic-destroy` (`event:'dies'`, target filter, no zone data) AND
      `magic-destroy-graveyard-opp` (bare `zone:'Graveyard',
      controller:'opp'`, whose OWN `sourceText` already admitted: "real
      text has no controller restriction on the target — this fact assumes
      it lands in an opponent's graveyard, but the printed mode can equally
      hit your own creature") — the same real occurrence encoded twice,
      one of the two copies carrying a self-documented-wrong assumption.
      Merged into ONE `{event:'dies', from:'Battlefield', to:'Graveyard',
      target:{types:{has:['Creature']}, power:{min:4}}, targeted:true,
      value:-1}` — **no `controller` at all**, since the real oracle text
      genuinely has no such restriction (removing the assumption, not
      carrying it forward). Also added a separate `destroy-act` ACT fact
      (`{event:'destroy', target: same filter, targeted:true, value:-1}`,
      bare tag, no zone fields) alongside it, mirroring Bahamut's own
      `destroy-act`/`dies` split under the standing ACT-vs-CONSEQUENCE rule
      (CR 701.6: destroying is conditional/preventable via
      indestructible/regeneration, so the ACT stays bare while the
      guaranteed `dies` consequence carries `from`/`to`) — this reuses
      ALREADY-ESTABLISHED pool vocabulary (`event:'destroy'` exists
      already, only ever declared by summon-bahamut, never as a sink), not
      new vocabulary. Both facts anchored to the same real oracle line 3
      span "Destroy target creature with power 4 or greater" (dual-anchor
      reuse, same accepted pattern Bahamut/Steiner already established).
    - `item-lifegain` (`event:'lifegain', controller:'you', value:5`) —
      untouched structurally, just gained a real annotation (oracle line 4,
      "You gain 4 life").
    - `self-graveyard` baseline fact — **found and fixed a real authoring
      bug in its own pre-existing comment**: it said `"(baseline — this
      sorcery goes to your graveyard after resolving...)"` but this card's
      real type line is plain `"Instant"`, not Sorcery. Re-anchored to the
      real typeLine "Instant" (CR 608.2m: a non-permanent spell is put into
      its owner's graveyard as it resolves — Stack → Graveyard, `from`
      omitted per the Stack-invisibility rule, same treatment
      aerith-rescue-mission's own `self-graveyard` already got for its own
      plain-`"Sorcery"` type line). Kept `value:1` unchanged (shape
      unchanged, just a rename `zone`→`to` and a corrected anchor).
    - Sinks: `wants-target-creature-pump` (Ability mode, "Target creature
      gets +0/+4 until end of turn") and `wants-power-4-creature` (Magic
      mode's own target-availability want) — both reshaped `zone`→`to`
      only, kept functional/simple per the sink-side exemption.
  - **Deliberate, documented gap — NOT fixed, NOT invented around (rule 7's
    "or a documented reason it doesn't"): the Ability mode's own pump
    effect ("Target creature gets +0/+4 until end of turn") has ZERO
    source fact.** `definition.ts` DOES implement it for real
    (`pumpTarget` effect, executed and logged for real in
    `scenarios.ts`'s `abilityMode` scenario — `trace.json` shows a real
    `fn:'pump'` line) — this is NOT a missing-implementation engine gap
    (rule 7's "fix it for real" branch doesn't apply), it's a missing
    FACT-VOCABULARY gap: `event:'pump'` has never been given any `Fact`
    representation anywhere in the 313-card pool, and `verify-synergy.mjs`
    explicitly lists `'pump'` in its own `PARKED_ACTION_FNS` set (his own
    comment: "no fact vocabulary defined by the design at all"). Considered
    inventing new `event:'pump'` vocabulary + wiring `producedEvents`(the
    Ultima mana-doubling precedent's own treatment) but concluded this
    task's own explicit constraint — "Scope: this card only... pure
    per-card data migration + judgment" + "Don't touch synergy.ts/shared
    scripts unless you find a genuine shared bug" — means growing brand-new
    pool-wide vocabulary is out of this task's scope (unlike Ultima's own
    gap, which was a genuinely UNIMPLEMENTED ability, not just
    unauthored). Documented in `progress.json`'s own `knownGaps` instead,
    same "document, don't fix" treatment the pump/stat-scaling SOURCE gap
    already got. The WANT side is already fully covered
    (`wants-target-creature-pump`).
  - `id`/`sourceText`/`highlight` moved off all 8 facts (6 source + 2 sink)
    into a new `annotations-authoring.json` (positionally aligned, mirrors
    summon-bahamut's file exactly); ran `compute-annotations.mjs
    battle-menu` — all 8 facts annotated, byte-verified via the script's
    own output (`8 facts annotated`) and a manual read-back of the computed
    offsets against the real oracle text/type line. Added
    `'battle-menu'` to `scripts/annotation-coverage.mjs`'s
    `ANNOTATED_CARD_SLUGS` — re-read the file fresh right before editing
    and again right after via `git status`, found a CONCURRENT peer session
    had independently added `'cloud-midgar-mercenary'` to the same line
    while this task was in flight; both entries coexist correctly, left
    the peer's alone (same multi-orchestrator collision class every prior
    round of this rollout has hit and correctly not touched).
  - **Real `find-synergies.mjs` diff, isolated via a plain file
    copy/restore (not `git stash`, for the same "don't revert concurrent
    peer sessions' own uncommitted work" reason every prior round of this
    rollout used)**: 153 → 157 total interaction lines for this card
    (producer side). Breakdown, fully accounted for:
    - **12 lines relabeled only** (same matched cards before/after —
      Ambrosia Whiteheart, Clash of the Eikons, Dion Bahamut's Dominant,
      Doppelgang, Formidable Speaker, Omega Heartless Evolution,
      Restoration Magic, Sage's Nouliths, Squall SeeD Mercenary, Stiltzkin
      Moogle Merchant, Summon: Bahamut, The Wandering Minstrel):
      "battlefield presence" → "enters the battlefield", purely from
      `attack-token`'s `zone`→`to`+`event` reshape (cosmetic, `describeFact`
      label change only, not a new/lost match).
    - **-5 lost** (accepted shape-family regression, same class documented
      in `SYNERGY_DESIGN.md`'s "Fact unification" section): Judge Magister
      Gabranth, Sephiroth Fabled SOLDIER, Sephiroth Planet's Heir, Vincent
      Valentine, Zodiark Umbral God — real bare `event:'dies'`-shaped sinks
      (no `to`/`from` of their own) that the OLD bare `magic-destroy`
      EventFact used to satisfy as an event-shaped match; the merged fact
      now carries real `to`/`from` too, so `factsInteract`'s
      `isZoneFact(p) !== isZoneFact(w)` shape-partition gate classifies it
      zone-shaped only and rejects these event-only wants before `event`
      string equality is ever checked.
    - **+9 gained** (a real accuracy fix, not a side effect to explain
      away): Cantankerous Keepers, Eden Seat of the Sanctum, Emet-Selch
      Unsundered, Ignis Scientia, Magic Pot, Qutrub Forayer, Rydia's
      Return, Thranduil Sindarin Liege, Vanille Cheerful l'Cie — real
      unconstrained-controller, unconstrained-type Graveyard-presence
      sinks (the SAME 9 cards `SYNERGY_DESIGN.md`'s own Fact-unification
      section names for Bahamut's own analogous merge) that the merged
      `dies` fact now matches because it dropped the old, self-documented-
      wrong `controller:'opp'` assumption — the real card text has no
      controller restriction at all, so removing that assumption is a
      genuine correctness improvement, not an accepted tradeoff.
    - Net: -5 + 9 = +4 (153→157), matches exactly.
    - **Consumer side (other cards' matches INTO Battle Menu, via its own
      sink facts) — 0 change, 120 → 120, confirmed via a separate diff**:
      both sink reshapes (`zone`→`to`) are label/shape-only, not a matching
      change (neither sink's constraint set changed).
    - No new matches from `self-cast`/`destroy-act` (both reuse existing
      pool vocabulary with zero current sink-side declarations pool-wide,
      confirmed — same "purely documentary today" outcome every prior
      `self-cast`/`destroy-act` addition this rollout has had).
  - Updated `progress.json`: `lastVerified` → 2026-09-11,
    `textCoverageAudited` → true, `notes` records the full migration
    summary plus the documented pump gap in `knownGaps`; `review`/
    `enrichment` were already `"ai"` (never `"reviewed"`), so no
    review-status reset was needed.
  - Verified: `npx vitest run functional-model` 236/236; `verify-synergy.mjs`
    scoped to this card → 0 hard failures (only the same pre-existing
    `tapForMana` soft notes every other migrated card has); full pool → 313
    checked, 1 hard failure (still only the pre-existing, unrelated
    `auron-s-inspiration` — the task's own heads-up that a peer session
    might be fixing it concurrently didn't materialize during this task's
    own window, still present at the same baseline);
    `verify-annotation-coverage.mjs` clean (whole pool, all 6 opted-in
    cards including the concurrently-added `cloud-midgar-mercenary`);
    `verify-scenario-card-names.mjs` clean (whole pool — this card's own
    `scenarios.ts` only ever adds real cards/tokens, confirmed the earlier
    Coliseum Behemoth fix is intact); `npm run typecheck` clean, exit 0.
    `scenarios.ts`/`trace.json` both untouched (no diff, confirmed via
    `git status`), so no `run-scenarios.mjs` regen was needed.
  - **No open Forge-verification** — pure synergy/annotation-shape
    migration onto already-correct, already-cited real oracle text (CR
    111.7/608.2m/701.6/700.4/601.2a citations are rules-vocabulary
    justification for fact placement/shape, not new engine-mechanic
    claims); no `harness.ts`/`engine-trace.ts`/`interfaces.ts` behavior
    touched. The one still-open item, already flagged above and in
    `progress.json`, is NOT a Forge-verification question — it's the
    pool-wide "no `event:'pump'` fact vocabulary exists yet" gap, to
    revisit only if a future task specifically asks for pump-effect
    fact coverage.

- **2026-09-11 (rollout) — ambrosia-whiteheart (fin/6) migrated to the
  unified Fact/annotations model.** Real oracle text (`data/fin/
  fin_scryfall.json`): `"Flash\nWhen Ambrosia Whiteheart enters, you may
  return another permanent you control to its owner's hand.\nLandfall —
  Whenever a land you control enters, Ambrosia Whiteheart gets +1/+0 until
  end of turn."` Type line: `"Legendary Creature — Bird"`.
  - **2 pre-existing facts (1 source, 1 sink) → 3 source + 2 sink.** No
    unfounded fact ever existed or was added/removed — this card has zero
    death/sacrifice text, so unlike adelbert-steiner there was never a
    bogus `dies` fact to catch.
    - `self-battlefield` (bare `zone:'Battlefield', controller:'you',
      subject:'self'` presence, `sourceText` a parenthetical gloss, never
      real oracle text) — the presence-shaped-SOURCE violation rule 2
      exists for. Converted to `{event:'entersBattlefield',
      to:'Battlefield', subject:'self', target:'self', value:-1}`,
      re-anchored to the real type line (`target:'typeLine'`, "Creature",
      offset 10-18 — same span adelbert-steiner's own converted fact uses,
      since both type lines share the identical `"Legendary Creature — "`
      prefix). Added `target:'self'` even though the original single fact
      never had one, matching adelbert-steiner's own precedent exactly
      (its own note: "same reasoning summon-bahamut's own self-enters
      already established" — bahamut's `entersBattlefield` fact has always
      used `target:'self'`, and Steiner's conversion added it alongside
      the original's own `subject:'self'` rather than picking one or the
      other). `value` reset to the `-1` sentinel (not the old `value:1`)
      — matches BOTH prior conversions' identical treatment; the fact's
      real match set is actually numerically unchanged by this rename
      (zone-zone matching only ever compares `effectiveZone`, never
      `event`), but resetting to the sentinel is the established
      convention for any renamed/reshaped fact regardless, not something
      to second-guess per-card.
    - Added `self-cast` (`{event:'cast', from:'Hand', target:'self',
      value:-1}`), per the rollout's own standing "every card gets one"
      instruction — checked `definition.ts` first: `keywords: ['Flash']`
      only, no alternate cost/flashback/foretell wrinkle (Flash is a
      timing permission, not an alternate cast origin), so `from:'Hand'`
      stands unmodified. Anchored to the same typeLine "Creature" span
      (10-18) `self-enters` uses, per the same "reuse an already-real
      anchor across distinct `describeFact` labels" pattern already
      established on adelbert-steiner (both facts on that card share one
      span too).
    - `bounce-produce` (the real ETB, "When Ambrosia Whiteheart enters,
      you may return another permanent you control to its owner's hand.")
      kept its own real value (1, unchanged — this fact's own match set is
      genuinely unaffected by adding `from`, since `factsInteract`'s
      zone-zone branch never reads a producer's `from` at all, only
      `to`/`subject`/type constraints — confirmed against `synergy.ts`'s
      own doc comment before assuming a reset was needed here too).
      Converted to unified shape: `{to:'Hand', from:'Battlefield',
      controller:'you', value:1}` — no `event` field: grepped every real
      pool `synergy.json` for an established "bounce"/"return"-style event
      string first (none exists — the pool's real `event` vocabulary is
      `dies`/`putCounter`/`lifegain`/`addMana`/`damage`/`grantKeyword`/
      `entersBattlefield`/`lifeloss`/`playLand`/`landfall`/`cast`/
      `drawCard`/`sacrifice`/`surveil`/`scry`/`graveyardLeaves`/`destroy`/
      `counter`/`coinFlip`/`castCreatureSpell`/`activateAbility`, nothing
      resembling a return-to-hand concept), so inventing one here would be
      speculative vocabulary this fact doesn't need — pure zone-shaped
      matching (via `to`) already covers every real want this could
      satisfy. No `subject` (the thing moving isn't self, matches the
      original's own omission — Gaius van Baelsar's own precedent: an
      omitted `subject` resolves to "unknown," matching only unconstrained
      wants, which is correct here since the bounced permanent's own real
      types are whatever the target happened to be, not Ambrosia's own).
      **`targeted` deliberately OMITTED, not set true or false** — checked
      every one of the 4 real pool cards that use `targeted` today
      (aerith-gainsborough, aerith-rescue-mission, summon-bahamut,
      ultima-origin-of-oblivion) and confirmed EVERY real usage is on an
      EVENT-shaped fact with a real `target`/`recipient` bucket; this
      fact is purely zone-shaped with no `target`/`recipient` field at
      all, so the axis doesn't apply by the same "not applicable, don't
      default to false" convention `targeted`'s own doc comment already
      uses for `self`-only facts. Separately, the real oracle text itself
      doesn't use the word "target" at all ("you may return another
      permanent you control" — a real, non-broadcast CHOICE among a real
      bucket, but not formal CR 601.2c targeting, since hexproof/
      protection can't matter for your own permanent) — a genuine third
      case the field's own docstring only describes two extremes for
      (`true` = real "target" language, `false` = unconditional broadcast
      to everyone). Flagging this reasoning here rather than forcing an
      inaccurate boolean either way; purely documentary either way
      (`factsInteract` never reads it), so no matching impact either
      choice.
  - **REAL BUG FOUND AND FIXED, not just migrated** — the old
    `wants-permanent-you-control` sink fact declared `types:
    {has:['Creature']}`, but its OWN pre-existing comment already said so
    explicitly: `"(NOTE: real text has no Creature-type restriction on the
    bounce target — this fact's type constraint looks broader than the
    printed ability; flagged, not corrected here.)"`. Checked, not just
    trusted the comment: `definition.ts`'s own `move` effect has no
    `validType` set at all (`matchesValidType(c, undefined)` in `card.ts`
    accepts any candidate), confirming the real ability has zero type
    restriction — and this card's own real scenario trace independently
    corroborates it: the pilot bounces a real Plains (a Land, not a
    Creature) as "another permanent you control." Since this migration is
    a full re-authoring pass and the old fact's own comment already
    flagged it as wrong, fixed it for real this time: dropped `types`
    entirely, now a plain unconstrained `{to:'Battlefield',
    controller:'you', value:1}` want (converted from `zone` to `to` in the
    same pass, per "every NEW fact should use `to`").
  - **Real `find-synergies.mjs` diff** (isolated via a same-snapshot
    before/after file swap, since concurrent peer sessions had other
    cards' `synergy.json` mid-edit at the time — same isolation technique
    adelbert-steiner's own `self-cast` follow-up used): **0 lines lost,
    101 lines gained, all net-new matches INTO this card's own sink** (the
    type-constraint fix). Confirmed via a normalized set-diff (treating
    this card's own `battlefield presence` → `enters the battlefield`
    relabel, from the `self-enters` conversion, as neutral before
    comparing) rather than a raw line-count diff, so the relabel noise
    didn't hide or inflate the real functional change. Two distinct real
    causes for the 101 gains, both confirmed rather than assumed:
    - ~98 previously-blocked-by-type-constraint zone-shaped Battlefield-
      presence producers with a real `subject:'self'` that happens to be
      a non-Creature type (A Realm Reborn, Ardyn the Usurper, Astrologian's
      Planisphere, Breeding Pool, Elrond Moon-Reader, dozens more) now
      correctly match the now-unconstrained want.
    - 3 SOURCE `entersBattlefield` facts from OTHER already-migrated cards
      (Summon: Bahamut, Aerith Rescue Mission, Battle Menu) that
      deliberately have NO `subject` at all (per this same rollout's own
      "self-enters/self-cast deliberately do NOT get a subject addition"
      precedent) — these were TYPE-BLOCKED outright by the old constrained
      sink (no subject to resolve type from → `resolveSubject` returns
      nothing → fails `satisfiesConstraints`), and now match trivially
      since `factsInteract`'s zone branch short-circuits to `true` for any
      unconstrained want before subject resolution is even attempted.
  - Verified: `verify-synergy.mjs` scoped → 0 hard failures (same
    pre-existing `drawCard`/`tapForMana` soft notes every migrated card in
    this rollout already has); full pool → 314 checked, 1 hard failure
    (still only the pre-existing, unrelated `auron-s-inspiration`, stable
    across repeated re-runs); `verify-annotation-coverage.mjs` clean
    (whole pool); `verify-scenario-card-names.mjs` clean (whole pool);
    `npx vitest run functional-model` 236/236 on a clean re-run (one
    transient failure mid-task on `cloud-midgar-mercenary`, confirmed via
    `git status` to be a concurrent peer session's own in-flight,
    uncommitted edit, not this task's — resolved itself once that
    session's own edit settled); `npm run typecheck` clean, exit 0.
    `scenarios.ts`/`trace.json`/`definition.ts` all untouched (no diff,
    confirmed via `git status`) — the existing scenario already exercises
    every real ability for real (Flash cast on the opponent's own turn,
    real ETB bounce of a real Plains, a real manual Landfall fire), so no
    engine gap was found and no `run-scenarios.mjs` regen was needed.
  - Added `'ambrosia-whiteheart'` to `scripts/annotation-coverage.mjs`'s
    `ANNOTATED_CARD_SLUGS` (a concurrent peer session added
    `'ashe-princess-of-dalmasca'` to the same list around the same time —
    both entries coexist fine, confirmed no conflict).
  - **No open Forge-verification** — pure synergy/annotation-shape
    migration plus one real fact-authoring bug fix (dropping an
    already-self-flagged-wrong type constraint), both already grounded in
    real oracle text/`definition.ts`/scenario trace evidence, not new
    engine-mechanic claims; no `harness.ts`/`engine-trace.ts`/
    `interfaces.ts` behavior touched.

- **2026-09-11 (rollout) — cloud-midgar-mercenary (fin/10) migrated to the
  unified Fact/annotations model, per an explicit coordinator task.** Task
  scope: pure per-card migration, no `synergy.ts` schema changes needed.
  Read `SYNERGY_DESIGN.md` in full first per the task's own instruction.
  - Real oracle text (fin/10, `data/fin/fin_scryfall.json`): `"When Cloud
    enters, search your library for an Equipment card, reveal it, put it
    into your hand, then shuffle.\nAs long as Cloud is equipped, if a
    triggered ability of Cloud or an Equipment attached to it triggers,
    that ability triggers an additional time."`. Type line: `"Legendary
    Creature — Human Soldier Mercenary"`.
  - **1 pre-existing fact (1 source, 0 sink) → 3 source facts.** The one
    pre-existing fact (`tutor-equipment`, bare `zone:'Hand'`, no `subject`,
    no type filter) WAS the presence-shaped-SOURCE violation this rollout's
    rule 2 exists for — converted to a real zone-CHANGE fact:
    `{to:'Hand', from:'Library', controller:'you', types:{has:['Equipment']},
    value:1}`. `from:'Library'` is real, well-known (a genuine search, CR
    701.19, not an "unknown origin" ETB-style case). Deliberately did NOT
    add `subject` — the thing entering Hand is a fetched Equipment card, not
    Cloud itself (same Gaius van Baelsar precedent this file's own earlier
    "Implementation notes" section already documents: an omitted `subject`
    resolves to "unknown," never defaults to the producer's own attrs).
    Added `types:{has:['Equipment']}` (the TRUE oracle-text filter, not the
    engine's own coarser `validType:'artifact'` approximation — checked
    `definition.ts`'s own comment, which already flags this as "not a claim
    this is subtype-precise") — this closes the exact gap this card's OWN
    pre-existing `progress.json.knownGaps` note already named ("real
    read:isArtifact evidence... but no want fact was added to match —
    addable now"). **Traced the matcher and confirmed this `types`
    constraint is currently INERT for matching** (not a new bug, a
    pre-existing, documented matcher limitation): `factsInteract`'s
    zone-zone branch reads `constraintsOf(w)` (the SINK's own constraint)
    to decide whether to even LOOK at the producer's attrs at all — an
    unconstrained sink returns `true` unconditionally regardless of the
    producer's own `p.types`, and a constrained sink resolves the
    producer's attrs via `resolveSubject(p.subject, ...)`, which is
    `undefined` here since this fact correctly has no `subject`. So
    `p.types` on a produce fact is real, honest, self-documenting data
    (same category as `targeted`/`tapped`) but doesn't currently change any
    match outcome either way — kept anyway, not removed, per the `Fact`
    model's own stated intent ("Constraints appear on sink facts, and on
    source facts only where the effect itself is filtered").
  - Added the two universal-truth baseline facts every migrated card gets:
    `self-cast` (`{event:'cast', from:'Hand', target:'self', value:-1}` —
    checked `definition.ts` first, plain `{W}{W}`, no alternate-cost/
    flashback/foretell wrinkle) and `self-enters`
    (`{event:'entersBattlefield', to:'Battlefield', controller:'you',
    subject:'self', target:'self', value:-1}` — this card's own
    `scenarios.ts` is a REAL engine-piloted trace with a genuine
    `{fn:'enters', card:'Cloud, Midgar Mercenary', zone:'Battlefield'}` log
    line, real trace evidence, not inferred). Both typeLine-anchored
    (highlight "Legendary Creature", same span reused for both facts, same
    "no other real text to differentiate them" precedent adelbert-steiner's
    own migration already established).
  - **Deliberately did NOT author any fact for this card's OTHER real
    ability** — the "As long as Cloud is equipped... triggers an additional
    time" static (a real Panharmonicon-style trigger-doubling effect,
    confirmed via Forge's own actual shipped card script,
    `res/cardsfolder/cardsfolder.zip`'s `c/cloud_midgar_mercenary.txt`:
    `S:Mode$ Panharmonicon | ValidCard$ Card.Self+equipped,
    Equipment.Attached`). Checked per task item 7 whether this was a
    straightforward engine gap to close for real (the Ultima precedent) —
    it is NOT: `resolveCard()` dispatches a named trigger exactly once per
    scenario call, and this ability needs GENERAL trigger-dispatch
    machinery (conditionally re-fire ANY triggered ability, for both the
    permanent itself and anything attached to it) rather than one new named
    trigger with a self-contained effect — a real, larger, cross-cutting
    engine feature, not a per-card fix. Documented as a NEW gap,
    `ENGINE_GAPS.md` gap #13 (with the real Forge citation above), rather
    than fixed. No fact authored for it — would have zero real trace
    evidence to verify against (no scenario, no engine machinery, nothing
    to point `verify-synergy.mjs` at), same "genuinely empty, not missed
    authoring" treatment this rollout's own audited parked-action-only
    cards already get.
  - `id`/`sourceText`/`highlight` moved off the one real fact into a new
    sibling `annotations-authoring.json` (mirrors summon-bahamut's file
    exactly); ran `compute-annotations.mjs cloud-midgar-mercenary` — all 3
    facts annotated, byte-verified offsets (typeLine `[0,18)` = "Legendary
    Creature" ×2, oracle line 0 `[19,60)` = "search your library for an
    Equipment card"). Added `'cloud-midgar-mercenary'` to
    `scripts/annotation-coverage.mjs`'s `ANNOTATED_CARD_SLUGS` (found
    `'battle-menu'` already there from a concurrent peer session, added
    mine alongside; a THIRD concurrent session added `'ambrosia-whiteheart'`
    to the same line while this task was in flight — all three coexist
    correctly, confirmed via a clean `verify-annotation-coverage.mjs` run
    after).
  - **Real `find-synergies.mjs` before/after diff, isolated via a plain
    file-copy swap of just this card's own `synergy.json` (pre-migration
    git-HEAD content vs. the migrated content), holding the rest of the
    concurrently-changing pool constant across both runs**: **0 lines
    lost, +130 lines gained, every single one of them mentioning "Cloud,
    Midgar Mercenary."** All 130 are `--[enters the battlefield]-->` lines
    from the new `self-enters` fact's real `to:'Battlefield'` shape — this
    card never had ANY battlefield-presence fact before (the old
    `tutor-equipment` fact only ever described Hand-zone presence for the
    fetched Equipment, never Cloud's own board presence), so `self-enters`
    gives it genuinely NEW membership in the pool's ~130-card unconstrained-
    battlefield-presence match set. Some target cards (You're Not Alone,
    Venat Heart of Hydaelyn, Tyvar the Pummeler, Slash of Light, Sidequest:
    Hunt the Mark, Dion Bahamut's Dominant, Clash of the Eikons) show up
    TWICE — verified this is correct, not a bug: each of those cards
    declares BOTH an unconstrained `{zone:'Battlefield', controller:'you'}`
    want AND a type-constrained `{zone:'Battlefield', controller:'you',
    types:{has:['Creature']}}` want (checked Clash of the Eikons directly),
    and Cloud's own `self-enters` (real `subject:'self'`, and Cloud
    genuinely IS a Creature) satisfies both. `self-cast`/the reshaped
    `tutor-equipment` fact contributed zero net matching change (confirmed
    via the `types`-inertness trace above for the latter; `self-cast` has
    no pool sink wanting `event:'cast'` yet, same as every other card's own
    `self-cast`).
  - Bystander-controller check (task item 9): N/A — this card's
    `scenarios.ts` is a fully real engine-piloted trace (`setupEnginePilot`/
    `pilotCast`/`pilotResolveTop`) with zero manually-pushed `pilot.log.push`
    entries of any kind, so the Bahamut-class "missing controller on a
    manual bystander `enters` push" bug has no applicable surface here.
    `definition.ts`/`scenarios.ts`/`trace.json` all untouched (no diff), so
    no `run-scenarios.mjs` regen was needed. `verify-scenario-card-names.mjs`
    (full pool) clean — this card's scenario only ever adds real cards
    (Plains via `basicLandsFor`, Forest bystanders via the harness's own
    library-fill convention).
  - Updated `progress.json`: `lastVerified` → 2026-09-11,
    `textCoverageAudited` → true, `notes` records the full migration
    summary (replacing the stale, now-resolved `knownGaps` note about the
    missing type filter), `knownGaps` now names the real Panharmonicon
    engine gap instead; `review` was already `"ai"` (never `"reviewed"`),
    so no review-status reset was needed.
  - Verified: `npx vitest run functional-model` → 236/236 (13 files, no new
    tests needed — pure data migration, no shared-code changes this round);
    `verify-synergy.mjs` (whole pool) → 314 checked, 1 pre-existing
    unrelated hard failure (`auron-s-inspiration` — still present at
    verification time, a concurrent peer session's own in-flight fix per
    the task's own heads-up, not yet landed); scoped
    (`cloud-midgar-mercenary`) → 0 hard failures, only the standard
    pre-existing `tapForMana` soft notes; `verify-annotation-coverage.mjs`
    → OK (whole pool, all opted-in cards including the 2 concurrent ones);
    `verify-scenario-card-names.mjs` → OK (whole pool); `npm run typecheck`
    → exit 0, clean.
  - **No open Forge-verification for the engine mechanics that already
    exist and are exercised** (the real ETB search/library-to-hand move,
    already correct and unchanged) — the one real open item is the NEW
    ENGINE_GAPS.md gap #13 itself (general trigger-doubling machinery,
    genuinely unbuilt, not merely uncited): a future task implementing it
    for real should re-derive the design from Forge's own `Panharmonicon`
    static-mode semantics (`ValidCard$` gating which permanents/attached
    equipment it applies to) rather than starting from this card's text
    alone, since Forge treats it as a general, reusable static-ability mode,
    not a one-off hack.

- **Ashe, Princess of Dalmasca (fin/7) migrated to the unified Fact/
  annotations model (2026-09-11, same rollout).** This card was one of the
  original "8 audited, genuinely empty" cards from the full FIN migration —
  its own `progress.json.knownGaps` already named the real reason:
  "`dig` effect (library search) logs zero `read:` lines even after full
  trace regen — harness instrumentation gap, not a synergy-authoring gap."
  Chased that down for real rather than treating it as a permanent dead
  end (task item 7's own Ultima-precedent rigor):
  - **Real, fixed `harness.ts` bug, same class as the already-fixed
    `move`/`sacrifice` gaps (2026-09-05/06), just never hit until this card
    declared a want against it**: the declarative `dig` effect's own
    `matches` predicate checked `effectiveTypes(c)` directly
    (`validType === 'artifact' && effectiveTypes(c).includes('Artifact')`),
    bypassing `loggingCard` entirely — a `validType:'artifact'` dig
    produced literally zero `read:*` evidence for its own filter, exactly
    like `move`'s pre-fix bug. Fixed the same way: wraps each candidate via
    `loggingCard(state, c, log)` and calls `.isArtifact()` on the wrapped
    object before the filter decision, so real `read:isArtifact` lines now
    appear per candidate. Removed the now-unused `effectiveTypes` import
    from `harness.ts` (its only remaining call site was this one).
  - **Checked blast radius before assuming pool-wide safety, not just
    reasoned about it**: grepped every `kind:'dig'` user (5 others —
    esper-origins-summon-esper-maduin, dark-confidant,
    choco-seeker-of-paradise, commune-with-beavers, memories-returning) —
    none declare `validType:'artifact'` (all `'any'`/omitted, which
    short-circuits before the new `loggingCard` wrap even runs), then
    actually regenerated all 5 via `run-scenarios.mjs` and diffed
    byte-for-byte against their pre-fix `trace.json`: identical, confirmed
    genuinely no-op for every card but this one. Only
    `ashe-princess-of-dalmasca/trace.json` itself needed (and got) a real
    regen — its new trace shows 4 real `read:isArtifact` entries (3 filler
    `Forest` → false, 1 real `Phoenix Down` → true) right before the
    existing `dig`/`moveTo` lines.
  - **Four facts authored** from the real, single-paragraph oracle text
    ("Whenever Ashe attacks, look at the top five cards of your library.
    You may reveal an artifact card from among them and put it into your
    hand. Put the rest on the bottom of your library in a random order."):
    `self-cast` (`{event:'cast', from:'Hand', target:'self', value:-1}`,
    typeLine-anchored "Creature" `[10,18)` — checked `definition.ts`, plain
    `{2}{W}`, no alternate-cost/flashback/foretell wrinkle) and a fresh
    baseline `self-enters` (`{event:'entersBattlefield', to:'Battlefield',
    controller:'you', subject:'self', target:'self', value:-1}`,
    typeLine-anchored "Legendary Creature" `[0,18)`) — no pre-existing bare
    presence fact existed to convert (the file was fully empty), so both
    were added fresh, same as every other card in this rollout gets a
    `self-cast`. The real ability itself is a genuine SOURCE zone-CHANGE
    fact, not presence-shaped: `{to:'Hand', from:'Library', controller:'you',
    types:{has:['Artifact']}, value:-1}` (oracle-anchored "reveal an
    artifact card from among them and put it into your hand"), mirrored by
    a SINK `{to:'Library', controller:'you', types:{has:['Artifact']},
    value:-1}` ("wants an artifact card in your library for this ability to
    find," oracle-anchored "an artifact card") — this exact SOURCE/SINK
    shape-pair is established pool precedent, not invented here:
    `delivery-moogle`'s own `find-artifact-to-hand`/`wants-artifact-in-
    library` facts are the identical pattern (checked before authoring).
    **No `dies`/sacrifice fact invented** — real oracle text has zero
    death/sacrifice/self-destruction mechanism, same discipline that
    removed adelbert-steiner's unfounded one.
  - **Known, pre-existing matcher limitation, documented not fixed** (same
    category as ultima-origin-of-oblivion's own `addMana`-sink note): the
    artifact-to-hand SOURCE fact's own `types:{has:['Artifact']}` is
    currently INERT for narrowing matches — `factsInteract`'s zone-zone
    branch only ever resolves a producer's static attrs via `subject`
    (correctly omitted here, since the found card's identity genuinely
    varies), never reads a bare `types` field declared directly on the
    SOURCE fact. Confirmed empirically, not just read from code: this fact
    matches Nibelheim Aflame/The Water Crystal's own UNCONSTRAINED
    hand-presence wants, never a hypothetical artifact-specific one — same
    behavior `delivery-moogle`'s identical-shaped fact already has today.
  - `annotations-authoring.json` added (4 entries, positionally aligned
    with `synergy.json`'s `source`/`sink`); ran
    `compute-annotations.mjs ashe-princess-of-dalmasca` — all 4 facts
    annotated, byte-verified offsets (typeLine `[10,18)` "Creature",
    `[0,18)` "Legendary Creature"; oracle line 0 `[75,140)` "reveal an
    artifact card from among them and put it into your hand", `[82,98)`
    "an artifact card"). Added `'ashe-princess-of-dalmasca'` to
    `scripts/annotation-coverage.mjs`'s `ANNOTATED_CARD_SLUGS` (found
    `'ambrosia-whiteheart'` already added by a concurrent peer session when
    editing, appended mine after it with no conflict).
  - **Real `find-synergies.mjs` before/after**: this card had `{source:[],
    sink:[]}` before (a fully empty, previously-audited-correct file), so
    "before" is trivially 0 matches; "after" is 132 real interaction lines,
    100% gained, 0 lost — 130 `--[enters the battlefield]-->` lines from
    `self-enters`'s real `to:'Battlefield'` (e.g. Aerith Gainsborough,
    Battle Menu, Summon: Bahamut, Zodiark Umbral God — the pool's usual
    ~130-card unconstrained-battlefield-presence set) and 2
    `--[hand presence]-->` lines from the artifact-to-hand fact (Nibelheim
    Aflame, The Water Crystal — the same 2 cards `delivery-moogle` also
    matches for the identical reason). The sink's own
    `wants-artifact-in-library` fact has 0 incoming matches (no pool card
    currently authors a SOURCE fact producing an artifact card into a
    library) — a pre-existing pool-authoring gap, not fixable from this
    card's side, same as adelbert-steiner's own 0-incoming
    `wants-equipment` sink.
  - Bystander-controller check (task item 9): N/A — `scenarios.ts` is a
    fully real engine-piloted trace (`setupEnginePilot`/`pilotCast`/
    `pilotDeclareAttackers`/`pilotFireTrigger`), no manually-pushed bare
    `enters` log entries at all.
  - Updated `progress.json`: `verifySynergy` "empty" → "notes",
    `lastVerified`/`reviewedAt` → 2026-09-11, `textCoverageAudited` → true,
    `notes` records the full migration + harness-fix summary, `knownGaps`
    now empty (the one real gap it named is fixed for real, not just
    documented away); `review` stays `"ai"` (was never `"reviewed"`, so no
    reset needed, but also genuinely not human-reviewed yet).
  - Verified: `npx vitest run functional-model` → 236/236; `verify-
    synergy.mjs` (whole pool) → 314 checked, 0 hard failures (the
    previously-flagged `auron-s-inspiration` baseline failure was resolved
    by a concurrent peer session partway through this task, exactly as the
    task brief's own heads-up predicted); scoped
    (`ashe-princess-of-dalmasca`) → 0 hard failures, only the standard
    pre-existing `tapForMana`/`drawCard`/`attack` soft notes;
    `verify-annotation-coverage.mjs` → OK; `verify-scenario-card-names.mjs`
    → OK; `npm run typecheck` → exit 0, clean.
  - **No open Forge-verification** — the real ability (attack-triggered
    library dig, reveal-and-take an artifact) was already correctly
    implemented in `definition.ts`/executed by the harness; this task fixed
    a pure instrumentation gap (the effect never failed to WORK, it just
    failed to LOG its own filter check) and authored the facts that gap had
    been blocking, not new engine mechanics.

- **2026-09-11 (latest) — `auron-s-inspiration` (fin/8) migrated, AND the
  session-long pre-existing hard failure fixed for real, at the root, not
  carried forward.** Note: while this task was in flight, other concurrent
  peer sessions were also actively committing FIN migrations to this same
  repo (adelbert-steiner, aerith-gainsborough, aerith-rescue-mission,
  ambrosia-whiteheart, battle-menu, cloud-midgar-mercenary, summon-bahamut,
  ultima-origin-of-oblivion all showed unstaged changes mid-task, and one of
  their own progress.json notes above already references this fix, having
  seen it land on disk before this entry was written) — this entry only
  covers auron-s-inspiration + the shared `engine.ts`/`stack.ts`/
  `engine-trace.ts`/`ENGINE_GAPS.md`/`annotation-coverage.mjs` edits this
  task made; anything else in `git status` at the time wasn't touched here.
  - **Root cause, diagnosed for real (not assumed from the pre-existing
    flag)**: `verify-synergy.mjs auron-s-inspiration` failed with
    `produce {zone:Exile,controller:you} has no supporting trace line`.
    The old `flashback-exile` fact was real (the card's own printed
    "Flashback {2}{W}{W} ... Then exile it" text), but COULD NEVER have
    trace evidence: `scenarios.ts` used the engine-piloted path
    (`runEngineScenarios`, `engine-trace.ts`), and `engine.ts`'s
    `canCastSpell`/`castSpell` had no alternate-cost/cast-from-graveyard
    legality path at all (ENGINE_GAPS.md gap #7) — the OLD `harness.ts`
    pipeline already fully supports `castFrom`/`alternateCosts`/
    `thenExile` (`lifecycleBefore`/`lifecycleAfter`, confirmed by reading),
    but this card (like every other recent migration — summon-bahamut,
    ultima-origin-of-oblivion, adelbert-steiner, aerith-gainsborough,
    aerith-rescue-mission — checked, all 5 use `runEngineScenarios`) is on
    the newer real-engine path, which never had the equivalent. Switching
    back to the old harness path to dodge this would have been a real
    regression in rigor relative to the other 5 migrations' own standard,
    not a fix — built the real engine capability instead.
  - **Real engine fix, narrowly scoped to the actual Flashback/Jump-start
    shape (a fixed replacement mana cost, graveyard-or-exile origin,
    `thenExile` on resolution) — NOT the full gap #7 (modal/split costs,
    Foretell, cost-reduction effects all still unmodeled, ENGINE_GAPS.md
    updated to say so precisely):**
    - `engine.ts`: `canCastSpell`/`castSpell` take a new optional
      `alt?: AlternateCost` (`card.ts`'s pre-existing
      `{name, cost, from, thenExile}` shape — was already declared,
      never consumed by the engine before this). `alt.cost` REPLACES
      `card.manaCost` for affordability/payment when given; timing is
      still checked against `card` itself (CR 702.32: a flashback spell
      follows the normal casting-timing rules for that CARD, not a new
      timing derived from the alt cost — an Instant flashbacked is still
      instant-speed). `castSpell` tags the pushed `StackObject` with
      `thenExile: alt?.thenExile`.
    - `stack.ts`: `StackObject` gained `thenExile?: boolean` (same
      optional-flag shape `isAbility` already has).
    - `engine.ts`'s `resolveTop`: the non-permanent (Instant/Sorcery)
      post-resolution branch now moves to `resolved.thenExile ? 'Exile' :
      'Graveyard'` instead of an unconditional `'Graveyard'` — the ONE
      real behavior change to a function every other engine-piloted card
      also goes through; verified via the full pool run below that this
      changed nothing for any other card (every other `StackObject` this
      engine ever pushes has `thenExile` structurally absent/undefined,
      which the ternary treats identically to `false` — Graveyard,
      unchanged).
    - `engine-trace.ts`: `pilotCast` takes the same optional `alt`,
      passes it through to `canCastSpell`/`castSpell`, and logs the real
      `from`/`cost` it names (`alt.from`/`alt.cost`) instead of the
      hardcoded `'hand'`/`card.manaCost` — matches `harness.ts`'s own
      `lifecycleBefore` `castFrom` log shape exactly (`from: 'graveyard'`
      already a real, established value there — several existing
      harness-path cards, e.g. `dreams-of-laguna`/`from-father-to-son`,
      already produce this exact shape, so no new contract surface for
      the `card`/`ui` agents to handle). `pilotResolveTop`'s own
      non-permanent branch reads `peeked.thenExile` (peeked BEFORE
      `resolveTop` pops it, same causal-order convention every other
      `pilot*` helper here already follows) to log `to: 'Exile'` instead
      of the hardcoded `'Graveyard'`.
    - `ENGINE_GAPS.md` gap #7 narrowed in place (not closed — modal/split
      costs, Foretell, cost-REDUCTION effects, and "engine doesn't verify
      the caller's card is actually in `alt.from`'s zone" all explicitly
      still flagged as open).
  - **`scenarios.ts` rewritten to 2 real engine-piloted scenarios**
    (`aerith-rescue-mission`'s own 2-scenario-per-file shape as the
    template): `normalCast()` (Hand → Stack → resolve → Graveyard, as
    before) and `flashbackCast()` (NEW — seeds the card directly into
    the Graveyard via `addCard`, casts it via
    `auronSInspiration.alternateCosts[0]` paying real `{2}{W}{W}` off 4
    real Plains, resolves, moves to real Exile — `trace.json` regenerated
    and manually verified: the `move` log entry really does say
    `to:'Exile'`, real `tapForMana` entries for all 4 lands).
  - **`definition.ts`'s own comment on the OTHER real ability ("Attacking
    creatures get +2/+0 until end of turn") corrected, not left stale**:
    the old comment claimed "no attack-declaration step exists in this
    model at all" — checked against the CURRENT `engine.ts` and found
    that's now WRONG: `GameEngine.attackers`/`declareAttackers`/
    `canAttack` are real (aerith-gainsborough's own combat scenario
    already pilots them). The REAL, narrower gap: no live attacker state
    reaches `card.ts`'s `Effect`/`EffectContext`/`Actions` surface at all
    (deliberately engine-agnostic, no `GameEngine` reference), AND
    `pumpAll`'s own predicate union has no "any player's creatures"
    option (`ctx.you` only) let alone an attacking-filtered one. Closing
    this for real needs new `Card`/`Player` interface surface PLUS wiring
    `state.ts`'s card wrappers to consult `engine.attackers` PLUS a new
    `pumpAll` predicate spanning both `ctx.you`/`ctx.opponents` — judged
    genuinely cross-cutting/deep (comparable in kind to the already-
    deferred target-legality/full-614 gaps), not a one-card fix; left an
    honest no-op with NO fact authored for it (same "don't fabricate a
    fact for something the engine can't demonstrate" discipline that
    already governs adelbert-steiner's own parked pump/stat-scaling gap)
    — flagged in both `definition.ts` and `progress.json.knownGaps`, not
    silently dropped.
  - **Facts, before → after** (old shape: bare `zone`, `id`,
    `sourceText`/`highlight` inline; `sink: []` throughout, unchanged):
    - `self-graveyard` (old: `{zone:'Graveyard', subject:'self'}`) →
      `{to:'Graveyard', controller:'you', subject:'self', value:1}` —
      shape-only rename, same matches (`effectiveZone` already treated
      the two identically).
    - NEW `self-cast` — `{event:'cast', from:'Hand', target:'self',
      value:-1}`, typeLine-anchored "Instant" `[0,7)` — added per this
      rollout's own standing rule (every migrated card gets one), no
      alternate-cost/flashback wrinkle on the NORMAL cast path itself
      (checked `definition.ts`: the card's own base `manaCost` is a plain
      `{2}{W}`, Hand-origin, unaffected by having a separate flashback
      option).
    - The single old `flashback-exile` (`{zone:'Exile', subject:'self',
      sourceText:'Flashback {2}{W}{W} (...)', highlight:'Flashback
      {2}{W}{W}'}`) SPLIT into two independent facts, matching the
      ACT-vs-CONSEQUENCE standing rule (SYNERGY_DESIGN.md) the same way
      summon-bahamut's own `self-cast`/`self-dies` already do — casting
      via Flashback and being exiled afterward are two separate real
      occurrences, not one:
      - NEW `{event:'cast', from:'Graveyard', target:'self', value:-1}`
        (the alternate-cost ACT itself — `zoneTo` correctly omitted, same
        Stack-invisibility rule `self-cast` follows), oracle-anchored
        "cast this card from your graveyard for its flashback cost"
        (line 1).
      - NEW `{to:'Exile', controller:'you', subject:'self', value:1}`
        (the guaranteed post-resolution CONSEQUENCE, parallel in shape to
        `self-graveyard`), oracle-anchored "Then exile it" (line 1).
    - **No fact invented for "Attacking creatures get +2/+0"** — real
      text, but genuinely no engine representation to anchor a real,
      trace-verifiable fact to (see the definition.ts gap above);
      correctly left uncovered rather than fabricated, same as
      aerith-rescue-mission's own precedent for an ability with zero
      engine representation.
  - `annotations-authoring.json` added (4 entries; 2 `typeLine`-anchored
    "Instant" duplicates for self-cast/self-graveyard, 2 oracle-anchored
    entries splitting the Flashback line into its cast-cost clause and its
    "Then exile it" clause). Ran `compute-annotations.mjs
    auron-s-inspiration`: 4/4 facts annotated for real, byte-verified
    offsets against the real Scryfall oracle text
    (`data/fin/fin_scryfall.json`). Added `'auron-s-inspiration'` to
    `scripts/annotation-coverage.mjs`'s `ANNOTATED_CARD_SLUGS`.
  - **Real `find-synergies.mjs` full-pool before/after diff: BYTE-IDENTICAL
    output, 0 lines gained, 0 lines lost anywhere in the pool** (confirmed
    via a real swap-old-synergy.json-back-in A/B, not assumed) — the two
    NEW facts (`event:'cast',from:'Graveyard'` and `to:'Exile'`) currently
    match nothing real: no pool card wants a bare `event:'cast'` sink at
    all (checked — 0 exist), and the ONE real `to:'Exile'`-shaped sink in
    the pool (`the-darkness-crystal`) is type-constrained to Creature,
    which Auron's Inspiration (an Instant) structurally fails via
    `subject:'self'`'s own real type resolution. This is an honest,
    fully-verified "no new matches yet" result, not a sign anything's
    wrong — the vocabulary is now real and correctly scoped; a future
    card with an unconstrained "wants something exiled" or "wants a spell
    cast from a graveyard" sink would pick these up for real. The 13
    existing `self-graveyard`-driven "graveyard presence" matches
    (Cantankerous Keepers, Eden Seat of the Sanctum, Elixir, Emet-Selch
    Unsundered, Ignis Scientia, Magic Pot, Qutrub Forayer, Rydia's Return,
    Sorceress's Schemes, Summon: Esper Ramuh, The Emperor of Palamecia,
    Thranduil Sindarin Liege, Vanille Cheerful l'Cie) are byte-identical
    before/after.
  - Verified (own scope only — full-pool numbers captured amid the
    concurrent peer activity noted above, so treat as a snapshot, not a
    number to diff against a DIFFERENT session's own before/after):
    `verify-synergy.mjs auron-s-inspiration` → 0 hard failures (only the
    standard pre-existing `tapForMana` soft notes every engine-piloted
    card gets); `verify-synergy.mjs` full pool → 314 checked, 6 skipped,
    **0 hard failures** (the long-standing single failure this whole
    session had been carrying is gone); `npx vitest run functional-model`
    → 236/236; full `npx vitest run` → 352/357 (5 failures are the
    same pre-existing, unrelated `scripts/relations.test.mjs` ENOENT/cwd
    issue every prior session in this file also saw, untouched here);
    `verify-annotation-coverage.mjs` → OK; `verify-scenario-card-names.mjs`
    → OK; `npm run typecheck` → exit 0, clean; `npx tsc --noEmit -p
    functional-model/tsconfig.json` → 45 pre-existing errors, none in any
    file this task touched (drifted down from the historically-cited ~50
    baseline via unrelated concurrent work, not this task).
  - **Open Forge-verification**: none blocking — no real Forge source
    checkout was available in this environment (checked `../tmp/mtg-forge`
    and the WSL `/mnt/c/Games/ForgeInstaller` fallback; the latter has
    compiled jars/cardscripts, not `AlternativeCost.java` source), so the
    new `engine.ts` comments cite CR 702.32/702.67 (Flashback/Jump-start)
    rather than a specific Forge file/line the way `interfaces.ts` mirrors
    normally would — same "CR-number-only" citation style `engine.ts`'s
    OTHER existing comments already use pool-wide (this file was never
    held to the interfaces.ts-mirror citation standard specifically). If a
    real Forge checkout becomes available later, worth a quick check that
    `AlternativeCost.java`'s real cast-time gating matches this narrow
    slice (replace-not-add cost, no timing change) — not expected to
    surface anything, just unverified against primary source for now.

- **2026-09-11 (rollout continuation) — cloudbound-moogle (fin/11) migrated
  to the unified Fact/annotations model.** Read SYNERGY_DESIGN.md in full
  first, per the task's own instruction (no relitigating: fact unification,
  no `id`, required `annotations`, ACT-vs-CONSEQUENCE, `to`/`from` on new
  SOURCE facts, `targeted`, self-cast/self-enters baselines).
  - Real oracle text (fin/11, `data/fin/fin_scryfall.json`): "Flying / When
    this creature enters, put a +1/+1 counter on target creature. /
    Plainscycling {2} ({2}, Discard this card: Search your library for a
    Plains card, reveal it, put it into your hand, then shuffle.)".
    `{3}{W}{W}`, `Creature — Moogle`.
  - **1 pre-existing fact (etb-counter, 1 source/1 sink) → 3 source + 1
    sink.** Converted `etb-counter` from bare `zone`/`id`/`highlight`/
    `sourceText` to the current shape: `{event:'putCounter',
    counterType:'+1/+1', target:{types:{has:['Creature']}}, targeted:true,
    value:1}` — `targeted:true` added (real CR 601.2c choice: "target
    creature," same class as Battle Menu's own targeted pump). Its paired
    sink `wants-creature-target` converted `zone`→`to` only (unconstrained
    controller preserved — either player's creature is a legal target for
    the real text). Added the two rollout baseline facts: `self-cast`
    (`{event:'cast', from:'Hand', target:'self', value:-1}` — checked
    `definition.ts`: plain `{3}{W}{W}`, no alternate-cost wrinkle) and
    `self-enters` (`{event:'entersBattlefield', to:'Battlefield',
    controller:'you', subject:'self', target:'self', value:-1}`), both
    typeLine-anchored ("Creature" in "Creature — Moogle").
  - **Real, non-obvious wrinkle this card hit that fin/1-10 didn't**: this
    card's `scenarios.ts` predates the engine-piloted convention every
    fin/1-10 card already used — it's plain `harness.ts` `trigger:'onEnter'`
    scenarios only. `harness.ts`'s own `selfZone`/`lifecycleBefore` rule
    means a `trigger`-shaped scenario starts the card ALREADY on the
    battlefield and skips the cast→enters lifecycle bracket entirely — zero
    real `fn:'cast'`/`fn:'enters'` trace evidence existed for this card,
    which would have hard-failed `verify-synergy.mjs` the moment
    `self-cast`/`self-enters` were declared. Fixed the minimal way, not by
    migrating the whole file to `runEngineScenarios()` (real but
    out-of-scope-sized work per rule 11's own "don't over-invest in
    scenario polish" instruction): added ONE new scenario with no
    `trigger`/`ability` field at all (a plain cast) — `harness.ts`'s own
    `lifecycleBefore`/`lifecycleAfter` then run for real (`fn:'cast'` then
    `fn:'enters'`), and since this card's only real effect lives in
    `triggers` (not untriggered `card.effects`), nothing else fires in that
    scenario — correct, since the two pre-existing `trigger:'onEnter'`
    scenarios already cover the ETB effect itself. Regenerated
    `trace.json` via `run-scenarios.mjs` (ran pool-wide by mistake —
    confirmed via `git status` that only 4 `trace.json` files changed
    pool-wide, 3 of which were ALREADY dirty from concurrent peer sessions'
    own in-flight `scenarios.ts`/`definition.ts` edits before this run —
    `ultima-origin-of-oblivion`'s regen was a correct, harmless catch-up
    for THEIR own already-edited scenario, not something this task caused
    or needs to revert).
  - **Plainscycling — deliberately NO fact authored, per task item 12's own
    "use judgment" instruction.** Checked the real shipped Forge card
    script directly (`/mnt/c/Games/ForgeInstaller/res/cardsfolder/
    cardsfolder.zip`, `c/cloudbound_moogle.txt`): `K:TypeCycling:Plains:2`
    — Forge implements this as its own generic `TypeCycling` keyword, not a
    composed cost+effect activated ability. This engine has zero machinery
    for an activated-from-hand, discard-this-card-as-cost ability of any
    kind — checked, this is a REAL, already 5-times-repeated, consistently
    undocumented-as-a-fact gap across the pool (malboro's Swampcycling,
    hill-gigas' Mountaincycling, ice-flan's Islandcycling,
    balamb-t-rexaur's Forestcycling, capital-city's and
    cid-timeless-artificer's plain Cycling) — every one of those cards'
    own `definition.ts` documents it as freeform `staticAbilities` text
    only (cross-referencing each other, a chain this card's own
    pre-existing comment was already part of) and NONE of them authored a
    fact for it. Followed the same precedent exactly: real text-only
    comment (already present, unchanged), a `progress.json.knownGaps`
    note, no new `ENGINE_GAPS.md` entry (matching the established
    convention that this widespread gap stays as cross-referenced
    `definition.ts` comments, unlike Cloud Midgar Mercenary's one-off
    Panharmonicon gap which got its own numbered entry) — not a fact
    fabricated to force coverage.
  - `annotations-authoring.json` added (4 entries: 2 `typeLine`-anchored
    "Creature" duplicates for self-cast/self-enters, 1 oracle-anchored
    "put a +1/+1 counter on target creature" for etb-counter, 1
    oracle-anchored "target creature" for the sink). Ran
    `compute-annotations.mjs cloudbound-moogle`: 4/4 annotated, byte-verified
    offsets against real oracle text/type line. Added `'cloudbound-moogle'`
    to `scripts/annotation-coverage.mjs`'s `ANNOTATED_CARD_SLUGS` (found
    `'the-crystal-s-chosen'`/`'coeurl'` already there from concurrent peer
    sessions, `'from-father-to-son'` appended by another concurrent session
    while this task was in flight — all coexist cleanly).
  - **Real `find-synergies.mjs` before/after, isolated via a plain
    swap-this-card's-synergy.json-only A/B (HEAD's old id/highlight-shaped
    file vs. the migrated one, rest of the pool held constant)**: **0 lines
    lost, +128 gained** — 127 real `--[enters the battlefield]-->` lines
    from `self-enters`'s new `to:'Battlefield'` fact (the pool's usual
    ~127-card unconstrained-battlefield-presence set, e.g. Aerith Rescue
    Mission, Ambrosia Whiteheart, Battle Menu, Craterhoof Behemoth), plus 1
    new self-interaction (`second-copy`, NOT `second-copy-legendary` — this
    card isn't Legendary) from `self-enters` now also satisfying this
    card's OWN `wants-creature-target` sink (Cloudbound Moogle is itself a
    Creature). `etb-counter`/`wants-creature-target`'s own matches are
    byte-identical before/after (the `zone`→`to` rename and `targeted:true`
    addition changed nothing matching-wise, confirmed via 0 lost). `self-cast`
    has no pool sink wanting a bare `event:'cast'` yet, same as every other
    card's own `self-cast`.
  - Updated `progress.json`: `lastVerified`→2026-09-11, `textCoverageAudited`
    →true, `notes` records the full migration summary, `knownGaps` now
    names the real Plainscycling gap; `review` stays `"ai"` (was never
    `"reviewed"`, no reset needed).
  - Verified: `npx vitest run functional-model` → 238/238; `verify-synergy.mjs`
    scoped → 0 hard failures (only pre-existing `tapForMana`-class soft
    notes elsewhere in the pool, none on this card); full pool → 314
    checked, 1 hard failure (`coeurl` — a concurrent peer session's own
    in-flight card, unrelated, pre-existing at the time of this check, not
    introduced here); `verify-annotation-coverage.mjs` → OK;
    `verify-scenario-card-names.mjs` → OK; `npm run typecheck` → exit 0;
    `npx tsc --noEmit -p functional-model/tsconfig.json` → 45 pre-existing
    errors, none in any file this task touched.
  - **Open Forge-verification**: none blocking for the migrated facts
    themselves (pure fact-schema migration + one new evidentiary scenario,
    no new engine mechanics). The one real open item is documentary, not
    behavioral: Plainscycling/TypeCycling has no engine machinery at all —
    a future task building generic "activated ability with a discard-this-
    card cost, searches library" support should treat all 6+ real
    `*cycling`-bearing pool cards as one shared design surface (Forge's own
    `TypeCycling`/`Cycling` keywords are already generic, not per-card
    scripts), not fix this one card in isolation.
  - **Note on `value`**: authored `self-cast`/`self-enters` with the `-1`
    sentinel per rule 10; a concurrent peer session's own pool-wide
    `compute-weights.mjs` run (that script, also mid-edit in this same
    working tree — see its own header: unconditionally overwrites every
    fact's `value`, `-1` placeholders included, no special-casing needed)
    swept this card up and recomputed real magnitude-bucketed values (`1`
    for both, correct for a single cast/enter occurrence) before this task
    finished — not something this task did directly, not a bug, and
    verified harmless (`...rest` spread preserves every other field/order,
    confirmed via a clean re-run of `verify-synergy.mjs`/
    `verify-annotation-coverage.mjs` afterward).

- **2026-09-11 (latest+26) — `fate-of-the-sun-cryst` (fin/19, "Fate of the
  Sun-Cryst") migrated to the unified Fact/annotations model.** Real
  Scryfall oracle text confirmed (`data/fin/fin_scryfall.json` #19):
  "This spell costs {2} less to cast if it targets a tapped creature. /
  Destroy target nonland permanent." Instant, `{4}{W}`, cmc 5.
  - **5 facts, all annotated, none presence-shaped**: `self-cast`
    (`{event:'cast', from:'Hand', target:'self'}`, typeLine "Instant") and
    `self-graveyard` (`{to:'Graveyard', controller:'you', subject:'self'}`,
    also typeLine "Instant" — CR 608.2m, the spell itself resolving into
    its own graveyard) mirror aerith-rescue-mission's own self-cast/
    self-graveyard pair exactly (same word annotated twice, no
    entersBattlefield/dies-of-self facts — correct for an Instant). The
    destroy effect follows the ACT-vs-CONSEQUENCE table verbatim, mirroring
    summon-bahamut's own `destroy`/`dies` pair: a bare ACT
    `{event:'destroy', target:{types:{not:['Land']}}, targeted:true}` (CR
    701.6, a real mandatory single target — CR 601.2c — not Bahamut's own
    "up to one," so no `optional`) plus a separate CONSEQUENCE
    `{event:'dies', from:'Battlefield', to:'Graveyard', target:{types:
    {not:['Land']}}, targeted:true}` (CR 700.4, unconditionally guaranteed
    once destroy actually resolves). Neither carries `subject` (the thing
    dying is a chosen TARGET, not this card itself — same "omitted subject
    resolves to unknown, matches only unconstrained wants" rule the Gaius
    van Baelsar bug fix established) or `controller` (the real text has no
    controller restriction on either side).
  - **SINK collapsed to ONE unconstrained fact**, replacing the old v1
    file's two controller-split facts (`wants-own-permanent`/
    `wants-opp-permanent`): `{to:'Battlefield', types:{not:['Land']}}`, no
    `controller` — checked precedent first, not invented: this is the exact
    same shape venat-heart-of-hydaelyn-hydaelyn-the-mothercrystal's own real
    "Exile target nonland permanent, no controller restriction" produce/
    want already uses (a single unrestricted fact, not a split pair) —
    confirmed by reading that card's own `synergy.json` directly before
    committing to the collapse, not assumed from the design doc's `move`-
    effect owner-restriction-bug precedent alone.
  - **Cost-reduction clause — confirmed genuinely unimplemented, documented
    as a gap, NOT fabricated as a fact.** Checked `ENGINE_GAPS.md` gap #7
    first: explicitly lists "any alternative-cost-REDUCTION effect (layering
    a discount on top of a cost rather than replacing it outright)" as
    still NOT modeled (distinct from the already-real Flashback-style cost
    REPLACEMENT `alt?: AlternateCost` machinery) — confirmed current, not
    stale, by re-checking `canCastSpell`/`castSpell` (`engine.ts`) for any
    discount hook: none exists. `definition.ts`'s own `staticAbilities`
    freeform-text treatment (already correct, predates this task, left
    unchanged) documents the real Forge `S:Mode$ ReduceCost` shape without
    executing it, same as every other continuous/cost-affecting static
    ability in the pool. Added this card as a real, textually-precise
    concrete example to gap #7's writeup (a genuine dynamic reduction keyed
    on the CHOSEN TARGET's state at cast time, not a fixed discount) — no
    fact authored for it, no vocabulary invented.
  - `scenarios.ts` migrated to the engine-trace pilot format
    (`runEngineScenarios`) to match the rest of the fin/1-10-era batch (the
    old file used harness.ts's flat `Scenario[]` shape with a generic
    `creaturesCount`-generated target). One real scenario: casts targeting
    the opponent's real, NON-TOKEN Coeurl (same real FIN card — `{1}{W}`
    Creature — Cat Beast, 2/2 — summon-bahamut's own scenario A already
    uses). **This substitution was load-bearing, not cosmetic**: the first
    draft targeted a real token (`w_1_1_cat`) and `verify-synergy.mjs`
    hard-failed with "produce {event:destroy} has no supporting trace
    line" — `card.ts`'s `destroy` case logs a literal `fn:'destroy'` line
    only for a real, non-token permanent; a token instead logs
    `ceasesToExist` (111.7/704.5d), which can't back a real `event:'destroy'`
    ACT fact as evidence (same reasoning already documented on
    summon-bahamut's own scenario file, re-confirmed here by actually
    hitting the failure rather than just trusting the precedent).
  - **Real `find-synergies.mjs` diff**, isolated via an old/new
    `synergy.json` swap (not a stale git-HEAD diff — several concurrent
    peer sessions have unrelated in-flight pool edits in this same working
    tree right now): **lost** 5 controller='opp'-scoped `dying` lines
    (Judge Magister Gabranth, Sephiroth Fabled SOLDIER, Sephiroth Planet's
    Heir, Vincent Valentine, Zodiark Umbral God) + 18 controller='opp'-
    scoped, type-unconstrained `graveyard presence` lines (Cantankerous
    Keepers, Eden Seat of the Sanctum, Elixir, Emet-Selch Unsundered, Ignis
    Scientia, Magic Pot, Qutrub Forayer, Rydia's Return, Sorceress's
    Schemes, Summon: Esper Ramuh, The Emperor of Palamecia, Thranduil
    Sindarin Liege, Vanille Cheerful l'Cie) — both explained entirely by
    dropping the old v1 controller-split representation, same accepted
    shape-of-representation tradeoff the SYNERGY_DESIGN.md rework already
    established elsewhere, not a silent loss. **Gained** the correctly-
    typed replacements: 9 `dies` lines (the identical unconstrained-
    Graveyard-sink set summon-bahamut's own `destroy-nonland`/`dies` facts
    already match, since this fact is likewise subject-less/type-
    constrained-only) + 13 `moves to graveyard` lines (the new
    `self-graveyard` fact, `subject:'self'`, resolves this card's own real
    type "Instant" — broader than the 9 since it also satisfies
    controller='you'-scoped and Instant-type-constrained wants the old
    opp-scoped fact never could). The destroy SINK side's own real matches
    (~122 before, ~126 after — battlefield-presence/enters-the-battlefield
    producers pool-wide) net +4 from the single-fact collapse, not
    independently re-litigated further (matches the venat precedent's own
    scope exactly).
  - Added `'fate-of-the-sun-cryst'` to `scripts/annotation-coverage.mjs`'s
    `ANNOTATED_CARD_SLUGS` (found the list had already grown to include
    `'dwarven-castle-guard'`/`'delivery-moogle'` from concurrent peer
    sessions between reads — appended after those, no conflict; a further
    peer append, `'dragoon-s-lance'`, landed immediately after mine, also
    no conflict).
  - Verified: `verify-synergy.mjs` scoped → 0 hard failures (5 expected
    soft notes: `tapForMana` ×5 + 1 `enters` note for the real Coeurl setup
    entry, same shape every other engine-piloted scenario's own soft notes
    take); full pool → 314 checked, 2 hard failures, both pre-existing and
    unrelated (`delivery-moogle`, `dwarven-castle-guard` — concurrent peer
    sessions' own in-flight cards). `npx vitest run functional-model` →
    238/238. `npx tsc --noEmit -p functional-model/tsconfig.json` →
    unchanged baseline errors, none in any file this task touched.
  - **Note on `value`**: authored all 5 facts with the `-1` sentinel per
    rule 10; a concurrent peer session's own pool-wide `compute-weights.mjs`
    run swept this card up mid-task and recomputed real values (`1` for all
    5) before this task finished — same harmless, not-done-by-this-task
    mechanism the immediately-preceding `cloudbound-moogle` entry above
    already documents; re-verified clean afterward via `compute-annotations.mjs`
    (byte-identical annotation offsets) and a fresh `verify-synergy.mjs`
    pass.
  - **Open Forge-verification**: none needed for the migrated facts
    themselves (pure fact-schema migration + one new evidentiary scenario
    substitution, no new engine mechanics). The one real open item is the
    documented ENGINE_GAPS.md #7 cost-reduction gap itself — genuinely
    open, not something this task could or should have closed; a future
    task implementing cost-reduction support should treat this card as its
    concrete worked example.

- **2026-09-11 (latest+N) — Dwarven Castle Guard (fin/18) migrated to the
  unified Fact model.** Real oracle text (verified against
  `data/fin/fin_scryfall.json` collector_number 18): `{1}{W}` Creature —
  Dwarf Soldier, 2/1, "When this creature dies, create a 1/1 colorless Hero
  creature token." **Found and fixed a real pre-existing bug while
  verifying**: `definition.ts` was missing `pt: [2, 1]` entirely (mana
  cost/typeLine were already correct) — added.
  - 4 SOURCE facts: `self-cast` (`{event:'cast', from:'Hand', target:'self'}`,
    typeLine-anchored "Creature" [0,8)), `self-enters`
    (`{event:'entersBattlefield', to:'Battlefield', controller:'you',
    subject:'self', target:'self'}`, same typeLine anchor), a real
    `self-dies` fact per the standing instruction — `{event:'dies',
    from:'Battlefield', to:'Graveyard', controller:'you', subject:'self',
    target:'self'}`, oracle-anchored "When this creature dies" [0,23) —
    mirrors summon-bahamut's own merged `dies` fact shape exactly (BOTH
    `subject` and `target` set, per the earlier-caught regression), and the
    token-creation fact, migrated from a bare legacy `zone:'Battlefield'`
    to `{to:'Battlefield', event:'entersBattlefield', controller:'you',
    subject:{token:'c_1_1_hero'}}` — the `event:'entersBattlefield'`
    addition matches the-crystal-s-chosen's own already-landed convention
    for a token-creation fact (checked its synergy.json before authoring,
    per the task's own explicit instruction to check sibling conventions
    first rather than invent `event:'createToken'`, which has zero
    precedent anywhere in the pool).
  - 1 SINK fact, unchanged in substance: `{event:'dies', target:'self'}`
    (the card's own trigger condition, "wants itself to die") — now
    annotation-bearing, same oracle span as `self-dies`.
  - All 5 facts authored with `value:-1` per rule 10, then resolved to real
    `1` via `compute-weights.mjs` (see the pool-wide incident below) — hand-
    verified the algorithm first (event `dies` with no `destroy`/`sacrifice`
    trace lines → magnitude 1; `entersBattlefield`+token with `createToken
    qty:1` → magnitude 1; bare `cast`/`entersBattlefield` ACT tags → no
    magnitude concept → 1), matching what the script actually produced.
  - **New scenario added**: a plain `{ result: 'is cast from hand and
    enters the battlefield' }` entry (no `trigger`) — the existing
    `trigger:'onDies'` scenario alone never logs a real `fn:'cast'`/
    `fn:'enters'` pair (`harness.ts`'s own `lifecycleBefore` short-circuits
    on `scenario.trigger` before reaching the cast-emission branch), so
    `self-cast`/`self-enters` had zero real trace evidence without it —
    same precedent as cloudbound-moogle's own scenarios.ts (checked before
    adding, not invented fresh). `run-scenarios.mjs --slug=dwarven-castle-guard`
    regenerated a real, 2-scenario `trace.json`.
  - annotations-authoring.json added (5 entries, positionally aligned);
    `compute-annotations.mjs dwarven-castle-guard` → 5/5 annotated, offsets
    verified against the real Scryfall oracle text. Added
    `'dwarven-castle-guard'` to `scripts/annotation-coverage.mjs`'s
    `ANNOTATED_CARD_SLUGS` (a concurrent peer session's own append of the
    same slug, plus `'delivery-moogle'`/`'dragoon-s-lance'`, landed around
    the same time — no conflict, both converge on the same entry).
  - **Real, documented, NOT fixed here**: the new zone-shaped `self-dies`
    SOURCE fact does not satisfy this card's own event-shaped
    `{event:'dies', target:'self'}` SINK — same real fact represented in
    two different Fact shape-families (`isZoneFact` partition), the exact
    accepted regression class the summon-bahamut Fact-unification pass
    already documented at length (that pass's own diff literally names
    Dwarven Castle Guard as one of the 9 cards whose EventFact-shaped
    `dies` sink lost a match when Bahamut's own facts merged). Confirmed by
    checking `find-synergies.mjs` output directly: no
    `Dwarven Castle Guard (self-interaction: ...)` line appears anywhere.
    Considered converting the SINK to zone-shaped instead so it'd match —
    rejected: the zone-zone match branch (`factsInteract`) never checks
    `target`/self-reference at all, so a zone-shaped version of this sink
    would stop meaning "wants ITSELF specifically to die" and instead match
    ANY producer reaching Graveyard pool-wide, a much bigger, wrong
    widening. Left as a known, deferred gap (same bucket as the "full
    matcher unification" open work already tracked in SYNERGY_DESIGN.md),
    not something this task's scope (facts + annotations, minimal scenario
    work per explicit instruction) should invent a fix for.
  - **Real pool-wide `find-synergies.mjs` before/after diff** (isolated via
    an old/new `synergy.json`+`definition.ts` swap, not a stale git-HEAD
    diff — several concurrent peer sessions have unrelated in-flight edits
    in this same working tree): **12 lines relabeled** (the pre-existing
    token-creation fact's 12 real "battlefield presence" matches — Ambrosia
    Whiteheart, Clash of the Eikons ×1, Dion Bahamut's Dominant, Doppelgang,
    Formidable Speaker, Omega Heartless Evolution, Restoration Magic,
    Sage's Nouliths, Squall SeeD Mercenary, Stiltzkin Moogle Merchant,
    Summon: Bahamut, The Wandering Minstrel — now correctly render "enters
    the battlefield" instead of "battlefield presence," per the standing
    "no presence in sources" rule; same matches, not new or lost ones,
    confirmed via `effectiveZone` being unaffected by the `zone`→`to`
    rename). **150 new real lines gained** (162 total gained minus the 12
    relabeled) across 141 distinct partner cards — entirely from
    `self-cast`/`self-enters` now broadcasting real `Fact` evidence this
    card never had before (every bare, unconstrained `{to:'Battlefield'}`-
    or `{event:'entersBattlefield'}`-shaped sink in the pool now also
    matches this card, on top of the pre-existing token fact). **Zero
    losses beyond the 12 relabels, zero collateral change to any other
    card's own lines** (confirmed: every diff line names Dwarven Castle
    Guard on one side).
  - **Real, unrelated incident surfaced and fixed mid-task**: ran
    `compute-weights.mjs` pool-wide (no per-slug scoping option exists) to
    resolve the `-1` sentinels — its `isV2Shaped` classifier is too loose
    (any fact with a bare legacy `zone` key counts, which is true of nearly
    every UNMIGRATED v1-schema fact too), so it silently rewrote ~9 clean,
    HEAD-committed, still-v1-schema cards it should never have touched at
    all (`elrond-moon-reader`, `deadly-embrace`,
    `jill-shiva-s-dominant-shiva-warden-of-ice`, `louisoix-s-sacrifice`,
    `crossroads-village`, `sorceress-s-schemes`, `the-gold-saucer`,
    `ultima`, `vincent-s-limit-break`) — degrading several real hand-
    authored `value` fields (5→1, 4→1, 3→1, 2→1) and reformatting inline
    arrays to multi-line. Caught via a `git diff --stat` check before
    trusting the run; reverted all 9 via `git checkout --` (confirmed via
    `git show HEAD:...` they were genuinely clean/uncommitted-free
    beforehand, safe to hard-revert). Left every ALREADY-in-flight v2-
    shaped peer card's own compute-weights recomputation alone (their `-1`
    sentinels resolving to real numbers is the correct, intended next step
    of their own migration, not collateral damage) — this script's loose
    `isV2Shaped` check is a real, standing bug worth a future fix (should
    require the FULL fact — not just one — to look v2-shaped, or take an
    explicit `--slug=` argument the way `run-scenarios.mjs`/
    `compute-annotations.mjs` already do), flagged here rather than fixed
    in this pass (would touch shared script logic mid-way through several
    concurrent peer sessions' own active use of it).
  - Verified (own scope): `verify-synergy.mjs dwarven-castle-guard` → OK,
    0 hard failures. `verify-synergy.mjs` full pool → 314 checked, 6
    skipped, 0 hard failures (the one transient `crystal-fragments-summon-
    alexander` FAIL seen mid-task was a concurrent peer's own in-flight
    card, confirmed via `git diff --stat` — untouched by this task).
    `npx vitest run functional-model` → 238/238. `verify-annotation-
    coverage.mjs` → OK. `scenario-card-names.mjs` → exit 0. `npx tsc
    --noEmit -p functional-model/tsconfig.json` → 45 errors, unchanged
    baseline count, the one dwarven-castle-guard hit
    (`cards/dwarven-castle-guard/definition.ts` `.ts`-extension import) is
    the same pool-wide pre-existing pattern every other card's
    `definition.ts` already has.
  - **Open Forge-verification**: none needed — pure Fact-schema migration
    + one baseline P/T data-correctness fix + one new evidentiary scenario,
    no new engine mechanics or `interfaces.ts` surface touched. The one
    real open item is the documented shape-family gap above (self-dies
    SOURCE vs. self's own event-shaped SINK) — tracked as the same open
    "full matcher unification" work SYNERGY_DESIGN.md already lists, not
    Forge-verification-shaped.
  - **Flag for `scripts/compute-weights.mjs`'s own future maintainer**:
    its `isV2Shaped` check needs tightening (or a `--slug=` filter added)
    before its next pool-wide run — see the incident above.

## dion-bahamut-s-dominant-bahamut-warden-of-light (fin/16) — fact migration + real grantKeywordAll wiring

- Migrated to the unified `Fact` model. 11 source + 2 sink facts, all
  annotated (added to `ANNOTATED_CARD_SLUGS` — appended after whatever the
  list already held from concurrent peer sessions, no conflict). Real,
  Scryfall-checked P/T added to BOTH faces (front 3/3, back 5/5) —
  `definition.ts` had neither before this pass, a real accuracy gap fixed
  in passing.
- **Front**: baseline `self-cast`/`self-enters` (typeLine-anchored, exempt
  from forward trace evidence via `isActivationCostPermanentBaselineFact`
  — this card's own `activationCost` makes every real scenario
  trigger/ability-shaped, never a plain cast, same as Jill/Jecht/Clive's
  own family); ETB Knight token (`to:'Battlefield', event:
  'entersBattlefield', subject:{token:'w_2_2_knight'}` — reused
  aerith-rescue-mission's exact token-produce shape, no new vocabulary);
  the `{4}{W}{W},{T}` transform as TWO real `to`/`from` movements
  (`Battlefield→Exile`, `Exile→Battlefield` w/ `event:'entersBattlefield'`)
  — both have real forward evidence (`fn:'moveTo'` × 2, already in the
  trace, `controller:'you'`).
- **Front static "Dragonfire Dive" (During your turn, Dion and other
  Knights you control have flying) — NO FACT, real engine gap, not a
  card-authoring omission.** Checked `grantKeywordAll`/`layers.ts` first
  per the task's own instruction: real, executable machinery exists, but
  ONLY ever runs from inside a triggered/activated `Effect` — there is no
  hook anywhere for a plain always-on `staticAbilities` line to run once
  and apply continuously, and no "is it your turn" condition exists
  anywhere a trigger could check even if one did. Same class as Ardyn, the
  Usurper's own "Demons you control have menace, lifelink, and haste"
  (checked: `grantKeywordAll` was added 2026-09-09, Ardyn's file last
  touched 2026-09-04 — genuinely never revisited, not an oversight in
  THIS task). New ENGINE_GAPS.md item #14 documents this generally (not
  just as a Dion-specific note) since it's a real, reusable gap class, not
  a one-off.
- **Back "Wings of Light" (chapters I/II) — split into TWO real facts, not
  conflated**: `putCounter` (+1/+1 on each other creature) unchanged from
  the card's prior authoring; **"those creatures gain flying until end of
  turn" was previously a documented no-op** (`run()`'s own comment said
  `grantKeywordAll` "wasn't available" when written — checked: it WAS
  added 2026-09-09, well before this pass, the comment was just stale) —
  wired a real `{kind:'grantKeywordAll', predicate:'creatures-you-control',
  keyword:'Flying', notSelf:true}` effect alongside the existing `custom`
  putCounter effect, regenerated `trace.json`
  (`run-scenarios.mjs --slug=...`), confirmed real `fn:'grantKeyword'`
  lines now present (2 per chapter, matching the same 2 creature tokens
  the counters hit). `event:'grantKeyword'` is established pool vocabulary
  already (11+ old-schema cards, e.g. jill-shiva-s-dominant, craterhoof-
  behemoth) — no new vocabulary needed, just the first NEW-schema
  (annotated) card to use it. Updated the scenario's own stale `result`
  text to mention the flying grant too (a one-line honesty fix, not
  scenario polish).
- **Back Gigaflare ("Destroy target permanent," no controller/type
  restriction — real script `ValidTgts$ Permanent`)**: `destroy` stays a
  bare ACT tag (indestructible/regeneration can prevent it), `dies` carries
  the real `from:'Battlefield'/to:'Graveyard'` consequence — same
  ACT-vs-CONSEQUENCE split as summon-bahamut's own `destroy-nonland`/
  `dies`. Deliberately left `target` UNSET (not an empty `{}`) on both —
  confirmed via `factsInteract` that an omitted `target` on an event fact
  already means fully-unconstrained (`pe.target === undefined → return
  true`), so this is the honest, minimal way to say "destroys ANY
  permanent," not a corner case. Chapter III's own exile-then-return is
  the SAME two-movement pattern as the front-face transform (own pair of
  `to`/`from` facts, `face:'back'`, anchored to the same oracle span).
- **Back sinks collapsed from the old file's 2 controller-split copies
  (`wants-own-permanent`/`wants-opp-permanent`) into ONE unconstrained
  sink** (`to:'Battlefield'`, no `controller`) — confirmed via
  `sidesCompatible` that an omitted `controller` already matches either
  side, so the old 2-fact split was redundant under the current design, not
  a distinction worth preserving. Verified via the real find-synergies
  diff that incoming (sink-side) match counts are IDENTICAL before/after
  (297/297, same labels) — the collapse cost nothing.
- **Real bug found+fixed in `scripts/compute-annotations.mjs`, pool-wide,
  not card-specific**: `loadOracleTextByName` keys its map by Scryfall's
  own combined `name` field ("Front // Back" for a two-faced card), but the
  script looked up oracle text via `card.name` alone — which on every real
  transforming `CardDefinition` in this pool (Jill/Shiva, Jecht/Braska,
  Clive/Ifrit, this card) is only the FRONT face's own printed name, never
  the combined string. This is the FIRST two-faced card run through
  `compute-annotations.mjs`, so the bug was previously latent, not
  previously hit. Fixed: reconstructs `` `${card.name} // ${card.backFace.name}` ``
  as the lookup key whenever `backFace` is present. Any future two-faced
  card added to `ANNOTATED_CARD_SLUGS` (crystal-fragments-summon-alexander,
  a sibling task working concurrently today, is one) benefits from this
  fix automatically — flag this in case that task hit the same skip
  message independently before this fix landed.
- Verified: `verify-synergy.mjs` scoped → 0 hard failures, 0 soft notes.
  Full pool → 314 checked, 0 hard failures (unchanged). `npx vitest run
  functional-model` → 238/238. `npx tsc --noEmit -p
  functional-model/tsconfig.json` → 45 errors, unchanged baseline (this
  card's own pre-existing `TS5097` `.ts`-extension-import error, shared by
  ~30 other cards, untouched by this pass). Real `find-synergies.mjs`
  diff (git-stash A/B, since HEAD has diverged too far from several
  concurrent sessions to diff cleanly): outgoing 30→297 lines; net
  breakdown — 11 "battlefield presence" renamed to "enters the
  battlefield" (same 11 targets, pure label change from the old bare-`zone`
  shape); 7 EVENT-shaped `dying` matches lost + 9 ZONE-shaped `graveyard
  presence` matches renamed to `dies` (same accepted shape-partition
  tradeoff the summon-bahamut fact-unification pass already established
  and documented — NOT a new regression, the identical tradeoff class);
  everything else (22 `enters the battlefield` + 258 `moves to
  battlefield/exile` + 5 new self-interaction legend-rule lines) is
  genuinely NEW signal from facts the old file never captured at all
  (self-cast/self-enters/token-ETB/both transforms). Incoming (sink) side:
  297→297, byte-identical labels — the sink collapse above cost nothing.
- **Open Forge-verification**: none needed — real oracle text was
  Scryfall-confirmed directly (`data/fin/fin_scryfall.json`, collector
  number 16) against the task's own quoted text, byte-for-byte match on
  both faces including P/T. `grantKeywordAll`'s own Forge citation was
  already established when that Effect kind was added (not re-derived
  here). The one open item is the new ENGINE_GAPS.md #14 gap itself —
  genuinely unclosed, not something this task could close (no Forge
  citation needed beyond what's already in that entry — it's a structural
  "no hook exists" gap, not a mis-modeled mechanic).

- **delivery-moogle (fin/15) migrated to the unified Fact/annotations
  model (2026-09-11), continuing the fin/1-10 rollout.** Full reasoning in
  the card's own `progress.json.notes` (detailed) — summary here. 4 source
  facts (`self-cast`, `self-enters`, Library→Hand `tutor`, and a BRAND NEW
  Graveyard→Hand `regrowth` — `ZONE_MOVEMENT_NAMES` had no Graveyard→Hand
  entry before this card; named after the card Regrowth, same convention
  `tutor`/Demonic Tutor already set; deliberately not reusing `card.ts`'s
  existing `graveyard-recursion` tag, a different concept). Both tutor
  facts carry a real `cmc:{max:2}` (this card is textually more precise
  than Cloud's/Ashe's own tutors) — confirmed currently INERT for
  matching pool-wide (same class as Ashe's own "types on a SOURCE is
  inert" finding): `factsInteract` never checks a SOURCE's own cmc against
  an unconstrained want, and a constrained want needs the matched
  producer's own `CardDefinition.cmc` populated, which is an opt-in-only
  field almost nothing in the pool sets. Kept both pre-existing SINK facts
  (`wants-artifact-in-library/graveyard`, migrated, cmc-gated too) rather
  than removing them the way Ashe's identical-shaped sink was removed —
  that removal was a specific live user Facts-tab call for THAT card, not
  a general rule (adelbert-steiner's own 0-incoming sink is the standing
  "keep it" precedent).
  - **Real bug fixed**: `definition.ts`'s own `custom` effect had a STALE,
    WRONG comment claiming mana value couldn't be filtered at all and
    citing a nonexistent comment on cloud-midgar-mercenary — `Card.getCMC()`
    is real (interfaces.ts ~line106/state.ts/harness.ts's `loggingCard`
    already wires `read:getCMC` trace evidence). Fixed the effect for real
    (`c.isArtifact() && c.getCMC() <= 2`) instead of leaving a false gap
    documented.
  - **Real harness gap fixed**: added `harness.ts` `PlayerState
    .graveyardArtifactCount` (mirrors `libraryArtifactCount`) — the
    graveyard branch was real code with no way to seed a real graveyard
    artifact candidate at all before this.
  - **Two real, distinct shared-plumbing bugs found, NOT fixed pool-wide
    (flagged here for a future dedicated pass)**: (1) `EnginePilotSetup`
    with no `opponents` produces a genuinely 1-player game; `turn.ts`'s
    `shouldSkipDraw` correctly requires `playerCount===2` (CR103.8a is a
    2-player-specific rule), so a 1-player pilot does NOT skip its turn-1
    draw, silently drawing away a seeded library/graveyard candidate
    before the card's own ETB runs. Reproduced LIVE against
    cloud-midgar-mercenary's own checked-in scenario (its seeded library
    artifact is already in hand before its own `pilotCast` even runs, via
    a scratch debug script, not just theorized). (2) `harness.ts`'s shared
    declarative `move` action (`move: (player, from, to, qty, validType)`)
    logs `fn:'move'` UNCONDITIONALLY even when `chosen` is empty — so
    Cloud's own checked-in trace.json's "successful tutor" line is
    currently fabricated by the log, not real (its real ETB runs against
    an artifact-less library post-draw and finds nothing). Fixed (1) for
    THIS card only (added a real second player to both of its own
    playthroughs, same shape Ashe's scenario already uses); did NOT touch
    `harness.ts`'s `move` action itself or regenerate any other card's
    trace — that needs a dedicated full-pool audit (fixing the log could
    flip other currently-"passing" cards' verify-synergy evidence checks).
    **Open Forge-verification-adjacent follow-up for a future session**:
    audit every `kind:'move'`/dig-style tutor card with an
    `EnginePilotSetup` lacking `opponents` for this same silent failure,
    then fix `harness.ts`'s `move` logging to only log on a non-empty
    `chosen`, regenerating whichever traces actually change.
  - `find-synergies.mjs` diff (isolated to this card): 17 → 132 lines.
    Lost: 15 old presence-shaped graveyard matches (13 real cmc>2
    overclaims correctly rejected by the new cmc gate; 2 real cmc-eligible
    cards — Excalibur II, Lunatic Pandora — blocked only by the
    `CardDefinition.cmc` opt-in-field gap above, not by this migration).
    Gained: 128 new baseline `entersBattlefield` matches, 2 `tutor` + 2
    `regrowth` matches (same 2 cards as before, both directions, just
    correctly relabeled). `verify-synergy.mjs` (scoped + full pool): 0
    hard failures. `vitest run functional-model`: 238/238. `tsc --noEmit`:
    0 errors.

- **2026-09-11 (latest+26) — The Crystal's Chosen (fin/14) migrated to the
  unified `Fact` model, PLUS a real self-inflicted pool-wide `value`
  regression found and fully repaired the same session. Record both parts;
  the recovery is the more important lesson.**
  - **The migration itself** (real oracle text verified against
    `data/fin/fin_scryfall.json` #14, `{5}{W}{W}` Sorcery: "Create four 1/1
    colorless Hero creature tokens. Then put a +1/+1 counter on each
    creature you control."): 4 source facts + 1 sink, all annotated via
    `compute-annotations.mjs`, slug added to `ANNOTATED_CARD_SLUGS`.
    - `self-cast` — `{event:'cast', from:'Hand', target:'self', value:-1}`,
      typeLine-anchored (0-7, "Sorcery"). Standard baseline.
    - **Token creation** — `{to:'Battlefield', event:'entersBattlefield',
      controller:'you', subject:{token:'c_1_1_hero'}, value:5}` (steep
      bucket of real qty=4, matches valueFromMagnitude's 3+→5 rule),
      oracle-anchored to the full first sentence (0-46). Reused the EXACT
      shape `aerith-rescue-mission` (fin/5) already established for this
      same real token (`TOKENS.c_1_1_hero`, already in `tokens.ts` from
      that card) — confirms token creation is NOT its own `event` name in
      this vocabulary; it's a `zone`-shaped (`to:'Battlefield'`) produce
      with `subject:{token}` like any other permanent showing up, PLUS the
      generic `entersBattlefield` event tag for consistency/rendering. No
      new vocabulary needed.
    - **putCounter broadcast** — `{event:'putCounter', counterType:'+1/+1',
      controller:'you', target:{types:{has:['Creature']}}, targeted:false,
      value:1}`, oracle-anchored to "Then put a +1/+1 counter on each
      creature you control" (48-101). `targeted:false` per the standing
      rule (unconditional broadcast to a bucket, no choice) — same shape
      Aerith Gainsborough's own Legendary-scoped broadcast already
      established, just without the Legendary constraint (this card hits
      ALL creatures you control, no filter). `value:1` is the real
      per-application trace magnitude (`compute-weights.mjs`'s
      `maxAmount(log,'putCounter','amount')` reads amount-per-instance, not
      recipient count) — same known, accepted, deprioritized "doesn't
      capture the real number of recipients" gap Aerith Gainsborough's own
      dies-payback broadcast already has; not re-litigated or hand-fixed
      here, per the standing "value accuracy deliberately deprioritized"
      ruling (`SYNERGY_DESIGN.md` "Fact.value accuracy is a KNOWN,
      DELIBERATELY DEPRIORITIZED non-priority" section).
    - `self-graveyard` — `{to:'Graveyard', controller:'you', subject:'self',
      value:1}`, typeLine-anchored (0-7) — same "baseline cast+graveyard,
      no entersBattlefield/dies for a Sorcery" treatment as
      `aerith-rescue-mission`'s own precedent (a Sorcery has no
      battlefield-presence lifecycle of its own, but DOES have a real
      resolves-to-graveyard zone movement, CR 608.2m — that's a real
      movement, not presence, so it's allowed under the "sources are zone
      movements only" rule).
    - Sink: `{to:'Battlefield', controller:'you', types:{has:['Creature']},
      value:1}` — wants a creature already on the battlefield (relevant to
      the broadcast counter payoff), oracle-anchored to "each creature you
      control" (76-101). Same shape as Aerith Gainsborough's own
      "recipients of dies payback" sink, minus the Legendary filter.
    - Scenario (`you: {creaturesCount:2}`) left as-is per the user's own
      "not checking scenarios, only facts" instruction — the harness's
      generic count-based filler creatures are an established convention
      (abstract placeholders, not fabricated named MTG cards), not a
      violation of the real-cards-only rule.
    - `find-synergies.mjs` before/after (real, isolated — old v1-schema
      file swapped in, ran, swapped back, diffed line-by-line): **127 → 127
      lines, zero real gain/loss** — only the DISPLAY LABEL changed (old
      bare "battlefield presence"/"graveyard presence" phrasing → real
      movement names "enters the battlefield"/"moves to graveyard", the
      same `describeFact`/`ZONE_MOVEMENT_NAMES` fix already documented
      earlier this session for other cards). Expected for a pure
      re-encoding with no constraint changes. `verify-synergy.mjs` (scoped
      + full pool): OK, 0 hard failures (the pool's one hard failure,
      `crystal-fragments-summon-alexander`, is unrelated — a different,
      concurrently-active session's own in-progress card, confirmed via
      file mtimes, not touched). `vitest run functional-model`: 238/238.
  - **The self-inflicted regression, found and fully repaired — a real
    cautionary tale, not just a note.** Ran `run-scenarios.mjs
    the-crystal-s-chosen` with a bare positional arg instead of
    `--slug=the-crystal-s-chosen` — the script silently ignored it and
    regenerated `trace.json` for the ENTIRE POOL (harmless in the end —
    only 5 files' `trace.json` actually differed byte-for-byte, all of
    them genuine staleness fixes bringing an already-updated
    `scenarios.ts` back in sync with a stale on-disk `trace.json`, not
    semantic damage). Then, separately, ran `compute-weights.mjs` (no
    slug-scoping option exists at all for that script) to fill in "real"
    `value` numbers for this card's own facts — directly against the
    explicit, repeated standing precedent already recorded multiple times
    earlier in this very file ("did NOT run compute-weights.mjs — would
    rewrite value pool-wide") and against `SYNERGY_DESIGN.md`'s own
    explicit ruling that `value` accuracy is deliberately deprioritized
    pool-wide right now. This rewrote `value` on every v2-shaped fact
    across all 314 pool cards, including several cards a DIFFERENT,
    actively-concurrent engine-agent session was mid-migration on at the
    exact same real-world time (confirmed via file mtimes — `coeurl`
    fin/13 and `crystal-fragments-summon-alexander` were being written by
    a peer session literally minutes apart from this one; ANNOTATED_CARD_
    SLUGS itself was observed to gain a `'coeurl'` entry from that other
    session BETWEEN this session's own read and edit of the same file).
    - **Real damage found, on forensic audit** (compared every touched
      file against `git show HEAD:...` where HEAD had the real
      pre-migration content, against this session's own earlier `cat`
      captures where available, against `SYNERGY_DESIGN.md`'s own directly
      quoted fact values, and against real oracle text for magnitude
      sanity checks): `aerith-gainsborough`'s hand-authored accumulation
      values (`lifegain-counter-produce` value 4→1, the Legendary-broadcast
      putCounter value 4→1, `lifegain` value 5→1, `self-cast`/`self-enters`
      -1→1) and `aerith-rescue-mission`'s `self-cast` (-1→1) were flattened
      to the script's own (structurally correct but NOT what the pool's
      real convention wants right now) computed numbers. `summon-bahamut`
      (which has its own dedicated, already-committed migration commit,
      `92b59d5`) had 4 facts drift away from that committed baseline
      (`destroy-act` -1→1, `putCounter` LORE -1→1, `sacrifice` -1→1,
      `drawCard` 4→1) plus the ALREADY-known-and-explicitly-accepted-stale
      `destroy-nonland` merged-dies fact (4→1, explicitly named in
      `SYNERGY_DESIGN.md`'s "value accuracy deliberately deprioritized"
      section as a pre-existing, accepted staleness — restored to the SAME
      stale 4, not "fixed" to something more correct, per that section's
      explicit "don't recompute, don't audit, don't fix" instruction). 7
      more already-v2-migrated cards (`adelbert-steiner`,
      `ambrosia-whiteheart`, `ashe-princess-of-dalmasca`,
      `auron-s-inspiration`, `battle-menu`, `cloud-midgar-mercenary`,
      `ultima-origin-of-oblivion`) had their `self-cast`/`self-enters`
      baseline facts flattened from the pool's universal `-1` convention to
      the script's `1`. One genuine own-goal in the fix pass itself: an
      OVER-broad first cut of the "restore self-cast/self-enters to -1"
      correction also flipped `crossroads-village`'s `enters-tapped`
      SOURCE fact and `cloud-midgar-mercenary`'s `entersBattlefield` SINK
      fact — both wrong to touch (the first is a still-v1-schema card
      whose real, HEAD-committed, non-drifted value has always been `1`,
      not part of the `-1` convention at all; the second is a SINK fact,
      and sink self-baseline facts use `1`, never `-1` — the `-1` sentinel
      is a SOURCE-only convention, "this cost/act has no measurable
      magnitude," not a general "self-referencing" rule) — caught by
      re-diffing against HEAD/siblings rather than assumed fixed, both
      reverted to their correct value a second time.
    - **What was deliberately left alone, and why**: every fact matching
      HEAD except its `value` (pure script recompute with no other drift)
      was reverted via a small script comparing current vs. `git show
      HEAD:<file>` fact-by-fact (excluding `value`) — safe wherever
      lengths/shape matched. Real numeric values that were UNCHANGED by
      the accidental run (confirmed via diff) were left exactly alone,
      including ones that look superficially suspicious (`lifegain:5` on
      `adelbert-steiner`/`battle-menu`, both real "gain 4 life"/Lifelink
      magnitudes correctly steep-bucketed to 5, not touched by any of
      this). Files confirmed to POST-DATE this whole incident via mtime
      (the concurrent session's own `coeurl`, `dragoon-s-lance`,
      `dwarven-castle-guard`, `delivery-moogle`, `fate-of-the-sun-cryst`,
      `cloudbound-moogle`, `from-father-to-son`,
      `crystal-fragments-summon-alexander`, `dion-bahamut-s-dominant-
      bahamut-warden-of-light`) were NOT touched at all by this session's
      recovery — verified their own `value`s already matched what the real
      script would produce for their own shapes (a mix of genuine `-1` and
      neutral `1`, internally consistent, not the tell-tale "everything
      flattened to a bucketed number" signature the actually-affected files
      showed).
    - **Standing lesson, reinforcing (not superseding) the precedent
      already recorded multiple times earlier in this file**: `compute-
      weights.mjs` has NO per-slug scoping flag at all (unlike
      `run-scenarios.mjs`'s real `--slug=`) — there is no way to run it
      "just for one card." Do not run it as part of an ordinary single-card
      migration task, ever, regardless of how tempting it is to "fill in
      real numbers instead of -1 placeholders" — leave `-1` (or, for a
      sink/self baseline, the established neutral `1`) and move on, exactly
      as `SYNERGY_DESIGN.md`'s own explicit ruling already says. If a
      pool-wide recompute is ever genuinely wanted, that is a deliberate,
      reviewed, standalone task on its own, ideally when no concurrent
      session is mid-migration on any pool card — never a side effect of
      finishing one card's fact authoring. Also: `run-scenarios.mjs`
      REQUIRES the literal `--slug=<slug>` flag form; a bare positional
      slug argument is silently ignored and triggers a full-pool run —
      double-check the exact flag syntax against a script's own header
      comment before invoking it, don't assume a bare argument is scoped.
  - **Open Forge-verification**: none needed — this was pure fact-model
    migration (annotation authoring, oracle-text/typeLine anchoring, one
    already-established token/broadcast-counter shape reused verbatim from
    prior cards), no `harness.ts`/`interfaces.ts`/rules-engine behavior
    touched.

- **2026-09-11 (latest+28) — Crystal Fragments // Summon: Alexander (fin/13)
  migrated to the unified Fact model** — a transforming Equipment/Saga DFC,
  continuing the fin/1-10 rollout. Real oracle text confirmed against
  `data/fin/fin_scryfall.json` (collector_number 13) for both faces,
  including the back face's real printed P/T (4/3), which was MISSING
  before this pass — added `pt:[4,3]` to `backFace` in `definition.ts`
  (would have silently defaulted to a fake 1/1 via `state.ts`'s own
  `addCard`, same real gap class `card.ts`'s own `pt` doc comment already
  names).
  - **Front face facts**: `self-cast` (`from:'Hand'`, typeLine-anchored),
    `self-enters` (`to:'Battlefield'`, typeLine-anchored, `subject`+
    `target`+`controller:'you'`, matching the LATER Ashe/Cloud/Ambrosia
    convention over the earlier, sparser Bahamut/dion-bahamut shape — see
    below), the real "Equipped creature gets +1/+1" as `event:'pump'` with
    a NEW `Constraints.equippedBySelf?: boolean` field (`synergy.ts`) — the
    exact REVERSE relation of the existing `attachedToSelf` (self is
    attached TO the candidate creature, i.e. `self.attachedToId ===
    candidate.id`, vs. `attachedToSelf`'s `candidate.attachedToId ===
    self.id`) — and the {5}{W}{W} exile-then-return transform modeled as
    TWO real, independently-evidenced zone facts reusing EXISTING
    vocabulary (`{to:'Exile',from:'Battlefield',subject:'self',
    controller:'you'}` then `{event:'entersBattlefield',to:'Battlefield',
    from:'Exile',subject:'self',target:'self',controller:'you'}`) rather
    than inventing a new `activateAbility` produce event — both already had
    real trace evidence (the scenario's own two `moveTo` log lines), no new
    vocabulary needed for this half at all.
  - **Back face facts**: chapter III ("Tap all creatures your opponents
    control") as `event:'tap', controller:'opp', target:{types:{has:
    ['Creature']}}, targeted:false` — real evidence via `harness.ts`'s
    existing `case 'tap'`, `controller:'opp'` chosen (not `'you'`) because
    that fn's own `sideOf` heuristic infers side from the TARGET's name
    (matches `Aerith Gainsborough`'s own `putCounter` convention: `controller`
    names whose objects are AFFECTED for this class of fn, not always the
    literal doer — checked before assuming `controller:'you'`+`recipient:
    'opp'`, which would have been `damage`'s convention, not `tap`'s, and
    would have HARD-FAILED forward verification). Chapters I/II's "Prevent
    all damage that would be dealt to creatures you control this turn" got
    a real fact (`event:'preventDamage'`, genuinely NEW vocabulary — grepped
    the pool, nobody else declares it) despite ZERO possible trace evidence
    (`state.ts`'s own header rules out replacement/prevention effects
    entirely, pool-wide, not just for this card) — same "real fact, real
    documented engine gap, scoped named exemption" treatment
    `isAuronsInspirationBroadcastPumpFact` already established, now mirrored
    by a new `isSummonAlexanderDamagePreventionFact` AND a new
    `isCrystalFragmentsEquippedPumpFact` (for the front face's own pump fact
    above — checked EVERY Equipment `definition.ts` in the pool:
    excalibur-ii/buster-sword/the-masamune/ultima-weapon/lion-heart/
    samurai-s-katana/thief-s-knife/ninja-s-blades all leave "Equipped
    creature gets +N/+N" as `staticAbilities` text only, confirming this is
    a real, consistent, POOL-WIDE engine gap — no continuous-effect/layer-7c
    pipeline for an Equipment's own static bonus reaching its equipped
    creature exists anywhere in this model — not a one-card oversight).
    Also added a real Saga self-sacrifice pair (`event:'sacrifice'` ACT +
    merged `event:'dies'` CONSEQUENCE, `from:'Battlefield',to:'Graveyard'`,
    same ACT-vs-CONSEQUENCE split summon-bahamut established) for the real
    "Sacrifice after III" (714.4/704.5x) rule — got REAL trace evidence by
    adding a `sequence:['chapterI','chapterII','chapterIII']` +
    `sacrificeSelfAfter:true` scenario, confirming harness.ts's LIGHTER
    `Scenario`/`runScenario` path (not just the heavy `engine-trace.ts`
    pilot summon-bahamut uses) already supports this real capability
    directly — did not need the heavy pilot for this half.
  - **Real gap found and NOT worked around**: Saga's own 714.2
    lore-counter-adding rule (ETB + post-draw-step) has NO fact — only the
    FULL `engine-trace.ts` pilot (`setupEnginePilot`/`pilotCast`/
    `pilotResolveTop`, what `summon-bahamut`'s own `scenarioA` uses) actually
    runs `engine.ts`'s real `advanceSaga`/`advanceSagasAfterDrawStep` logic;
    the lighter `harness.ts` `sequence` mechanism this card's own
    `scenarios.ts` uses does NOT run it. Migrating this card to the heavy
    pilot just for this one fact was judged out of proportion (documented in
    `progress.json`'s `knownGaps`, not fabricated) — a real, legitimate,
    named follow-up, not silently dropped.
  - **A `plainCast`-style `harness.ts` feature was drafted, then fully
    reverted, once real prior art was found**: initially built (and
    verified working) a new `Scenario.plainCast?: boolean` flag + 3
    `lifecycleBefore`/`lifecycleAfter`/`selfZone` call-site edits so a
    permanent with `activationCost` could still get a real, evidenced
    baseline cast/enters scenario — but `dion-bahamut-s-dominant-...`
    (already committed, a sibling migration from EARLIER the same day) and
    its own real `isActivationCostPermanentBaselineFact` exemption
    (`verify-synergy.mjs`, originally added for Coeurl/fin-12 — "the FIRST
    card in the migrated pool shaped this way") already solve EXACTLY this
    structural gap via a documented exemption, not a harness feature — the
    project had already made this call. Fully reverted all 5 `harness.ts`
    edits (confirmed via `git diff` showing zero `plainCast` remnants,
    distinct from OTHER unrelated concurrent-session changes already
    present in that file — `graveyardArtifactCount`, a `dig` type-check
    fix — which were correctly left untouched) and dropped the
    now-unneeded extra scenario. **Lesson for future DFC/activationCost
    migrations**: check `verify-synergy.mjs`'s existing
    `isActivationCostPermanentBaselineFact` FIRST before building new
    harness plumbing for this exact class of gap — it already covers any
    `subject:'self'`/`target:'self'` baseline fact on a card with
    `activationCost` set, zero extra code needed.
  - **`self-enters` shape inconsistency, noted not resolved**: this card's
    own `self-enters` includes `controller:'you'`+`subject:'self'`+
    `target:'self'` (the Ashe/Cloud/Ambrosia convention), while the
    directly-comparable sibling `dion-bahamut-s-dominant-...`'s own
    `self-enters` has neither `subject` nor `controller` (closer to the
    original bare Bahamut shape). Both pass verification; not reconciled
    here (would mean editing a sibling's already-committed file) — flagged
    as a real, small, pool-wide convention drift for a future consistency
    pass, not something this task's own scope covered.
  - **Real `find-synergies.mjs` diff (isolated before/after via a
    temp-swap of just this card's own `synergy.json`, not a stale-HEAD
    diff)**: +99 interaction lines, 0 lost, 0 collateral change to any
    other card (confirmed via a full-pool run both ways). 41 new "enters
    the battlefield" + 41 new "moves to battlefield (from exile)" lines
    against the same ~40 real unconstrained Battlefield-presence sinks (a
    real, accepted double-count — two independent real zone facts sharing
    the same `to:'Battlefield'` destination with no distinguishing
    constraint, same class already documented for summon-bahamut's own
    dies/enters double-count) + 17 new "dies" lines against real
    Graveyard-presence sinks. Zero new matches for the genuinely-new
    `pump`/`preventDamage`/`tap`/`sacrifice` vocabulary — expected, no sink
    anywhere in the pool wants any of these shapes yet; this migration
    makes them real/matchable for a future payoff card, same "promotion
    creates zero matches today" pattern `pump` itself went through
    earlier. `verify-synergy.mjs`: 0 hard failures, 0 soft notes (scoped
    AND full pool, 314 v2 cards checked). `vitest run functional-model`:
    238/238 (unchanged). `tsc --noEmit` (root tsconfig, the real one — a
    `-p functional-model` invocation is NOT a real project config and
    produces bogus `TS5097`/`allowImportingTsExtensions` noise, don't use
    it): 0 errors.
  - **Did NOT run `compute-weights.mjs`** (per this same day's own
    incident, flagged mid-task by the orchestrator: two sibling agents
    already had to do forensic repairs after an unscoped pool-wide run of
    that script flattened other cards' hand-set `-1`/`1` values — see the
    dedicated incident writeup earlier in this file). Every new fact on
    this card was left at the `-1` sentinel per `SYNERGY_DESIGN.md`'s own
    standing rule; confirmed via `git status` that no file outside
    `crystal-fragments-summon-alexander/*` (plus the three shared files
    intentionally touched: `synergy.ts`, `scripts/verify-synergy.mjs`,
    `scripts/annotation-coverage.mjs`) was modified by this session.
  - **Open Forge-verification**: none needed — pure fact-model migration
    (annotation authoring, oracle-text/typeLine anchoring, one new
    reverse-relation `Constraints` field mirroring an already-Forge-checked
    existing one, one new scenario using already-existing harness
    mechanics). No `interfaces.ts`/rules-engine behavior changed. The one
    open, NAMED gap (Saga lore-counter evidence needing the heavy
    engine-trace pilot) is a harness/tooling gap, not a Forge-citation
    question.

- **2026-09-11 (latest+29) — fin/14 (The Crystal's Chosen) replay bugs, two
  real fixes, both general (whole-pool), not scenario-local**:
  - **Bug 1 — generic numeric creature filler had no image.** Added
    `GENERIC_FILLER_CREATURE = 'Grizzly Bears'` next to `GENERIC_FILLER_LAND`
    (`harness.ts`) — same "one fixed real card, not a rotation" principle.
    Wired into BOTH `harness.ts`'s own `setupPlayer` (the REAL engine
    object's name — previously `${n}-creature-nontoken-${i}`/
    `${n}-creature-token-${i}`) and `app/lib/scenarioReplay.ts`'s
    `seedPlayerCards` mirror (unprefixed push, same treatment
    `GENERIC_FILLER_LAND` already gets) — checked BOTH needed the name
    change together: `scenarioReplay.ts`'s own header doc comment
    (`read:hasSubtype target="opp0-creature-token-1"`) proves real log
    entries DO reference this filler by its exact synthetic name, so a
    display-only rename would have desynced replay from trace. Confirmed via
    `app/components/ScenarioReplay.vue`'s existing `extraNames` mechanism —
    no `card`-domain file changes needed at all; a real unprefixed name
    already flows through that existing by-name art lookup for free.
  - **Real regression found and fixed from collapsing these names**:
    `verify-synergy.mjs` hard-FAILed `crystal-fragments-summon-alexander`
    (chapter III's "tap all creatures your opponents control" —
    `{event:'tap', controller:'opp'}`) because `sideOf`'s name-prefix guess
    (`opp0-...`) was its ONLY signal for a plain `tap` entry, and the
    now-unprefixed `GENERIC_FILLER_CREATURE` name broke that guess. Root
    fix: `harness.ts`'s `tap` logging action now logs a real `controller`
    field, same "real field beats name-guessing" pattern `moveTo`/`destroy`/
    `putCounter` already established (`sideOf` already prefers
    `entry.controller` when present, no verify-synergy.mjs change needed).
    Also added the matching `owner`-scoping param to `scenarioReplay.ts`'s
    `ensureForTap` (mirrors `ensureForZone`'s existing owner-scoping) and
    `destroy`/`ceasesToExist` cases (mirrors `putCounter`'s existing
    `ensureForZone` treatment) — all THREE needed hardening the instant two
    players' generic filler creatures could share one fungible name on the
    same battlefield, none of them needed it before (previously
    index-suffixed names were already unique). Checked the whole pool for
    any EXISTING scenario destroying/tapping 2+ generic filler creatures
    with distinguishable per-instance log entries before making this
    change — none exist today (all real `destroy`/`tap`-on-filler scenarios
    use `qty:1`) — so this was a proactive hardening, not a fix for an
    already-observed second failure, done because the fungibility is now
    deliberately introduced pool-wide.
  - **Full pool regenerated** (`run-scenarios.mjs`, no `--slug` — same class
    of pool-wide `trace.json` regen the original `GENERIC_FILLER_LAND`
    commit (33bfbaa) did for 61 files; this one touched ~145 `trace.json`
    files). Did NOT touch `compute-weights.mjs` or any `synergy.json` weight
    field — `run-scenarios.mjs` only ever writes raw trace logs, not the
    hand-authored `-1`/`1` weight sentinels that script's own incident was
    about. `verify-synergy.mjs`: 314 checked, 0 hard failures (was 1 before
    the `tap` controller fix). `vitest run functional-model`: 238/238.
    `npm run typecheck` (the real Nuxt one, not `vue-tsc -p .`): clean.
  - **Found a large pre-existing uncommitted working tree** (many other
    cards' `progress.json`/`synergy.json`/`annotations-authoring.json` from
    earlier same-day migration work, unrelated to this task) already dirty
    before this session touched anything — confirmed via `git status`
    scoped diff that my own edits are isolated to `harness.ts`,
    `app/lib/scenarioReplay.ts`, and `trace.json` pool-wide; did not touch
    or revert any of that other uncommitted state.
  - **Bug 2 — dynamically `createToken`-created tokens getting the wrong
    real-card image (ambiguous bare name).** Confirmed live: `/api/cards/
    by-names` for "Hero" resolves to `tmsh`'s unrelated Vigilance 3/2
    "Hero" (wrong), not any of the 16 real `tfin` vanilla Hero token
    printings — reproduced for both `the-crystal-s-chosen` (fin/14) and
    `dwarven-castle-guard` (fin/18, its own `createToken` trace entry:
    `{fn:'createToken',token:'Hero',...}`). `dragoon-s-lance` (fin/17) also
    creates a "Hero" token (`TOKENS.c_1_1_hero`), same bug, not yet
    separately re-confirmed live but same code path. **Genuinely OUT OF MY
    LANE** — the actual token-vs-real-card disambiguation fix belongs in
    `app/components/ScenarioReplay.vue` (`card` agent's own domain per
    `.claude/agents/card.md`'s explicit file list), specifically its
    `tokenNameSet`/`extraNames` split (currently only recognizes a token
    pre-declared in that scenario's own static `ps.tokens`, not one created
    live via a `createToken` trace entry). Design handed off, not
    implemented: cross-reference the final board snapshot's card names
    against a reverse `Object.values(TOKENS).map(t => t.name)` lookup
    (`functional-model/tokens.ts`, mine to read, not to change for this) in
    ADDITION to the existing `ps.tokens`-derived set, route any match
    through `/api/tokens/by-key` instead of `/api/cards/by-names`. **Real
    edge case found**: `TOKENS.w_1_1_cat` and `TOKENS.w_1_1_cat_lifelink`
    both have `.name === 'Cat'` — a reverse name->key lookup is NOT unique
    for that one name; whoever implements this needs to pick a
    tie-break (or key by `qty`/context) rather than silently taking
    whichever `Object.values` iteration order happens to win.
  - **`dion-bahamut-s-dominant-...` (fin/16, creates a "Knight" token) and
    `crystal-fragments-summon-alexander` checked too**: Knight already
    resolves correctly (`/api/cards/by-names` for "Knight" -> real `tfin`
    token, no other set collision today) — NOT currently hit by Bug 2, flag
    removed. `crystal-fragments-summon-alexander` does not call
    `createToken` anywhere in its `definition.ts` at all (it's the
    Equipment/Saga DFC from the same day's earlier migration, no token
    generation) — the task's own list of "likely affected" cards was wrong
    about this one; not applicable to Bug 2.
  - **Open Forge-verification**: none — both fixes are harness/replay
    tooling (a real Scryfall identity swapped in for a synthetic
    placeholder; a real `controller` field logged where a name-guess used
    to stand in), no `interfaces.ts`/rules-engine behavior changed.
- **2026-09-12 (latest+41) — Gaelicat (fin/22) migrated to the unified
  Fact/annotations model**, continuing the fin/1-20 rollout. Verified real
  oracle text/mana cost/P-T against `data/fin/fin_scryfall.json` (`{2}{W}`,
  Creature — Cat, 1/3, "Flying, vigilance / As long as you control two or
  more artifacts, this creature gets +2/+0."). Facts: baseline
  `self-cast`/`self-enters` (typeLine-anchored), a SOURCE `{event:'pump',
  target:'self'}` for the pump clause (oracle-anchored "gets +2/+0"), and a
  paired SINK for the CONDITION itself (`{to:'Battlefield',
  controller:'you', types:{has:['Artifact']}, amount:{min:2}, value:-1}`)
  — the first real pool usage of `Constraints.amount` on a sink (previously
  declared, never used; still NOT consulted by `satisfiesConstraints`,
  documentary/weighting-only). Flying/Vigilance are bare printed keywords
  with no grant/broadcast — correctly get NO facts, per the standing rule.
  **Checked adelbert-steiner's own synergy.json/definition.ts directly as
  precedent first**, per the task's own instruction — concluded Gaelicat's
  clause is NOT the same `ptFormula` shape (Steiner's is count-SCALING
  `addPerEquipmentControlled`; Gaelicat's is a fixed on/off THRESHOLD, a
  shape `ptFormula` has no variant for, confirmed by 2 independent existing
  pool precedents — scorpion-sentinel, gigantoad — that already made this
  same call for their own identically-shaped land-count buffs). Kept
  `staticAbilities` text unchanged; the `pump` fact is real but
  unexecutable, exempted from verify-synergy's forward evidence check via a
  new `isGaelicatArtifactThresholdPumpFact` (same class as Auron's
  Inspiration/Crystal Fragments/Dragoon's Lance's own named exemptions).
  **Real engine-piloted scenario** (converted off the old zero-evidence
  plain-Scenario style): 2 real named fin Artifacts (Phoenix Down, Elixir)
  on the battlefield, Gaelicat cast for real `{2}{W}}`, then two HONEST
  reads — real `loggingCard(...).isArtifact()` calls on each artifact (the
  condition is real, observable board state) and a real `effectivePT` read
  (same helper Steiner's scenario uses) that HONESTLY reports Gaelicat's
  UNMODIFIED printed 1/3 even with the threshold met — deliberately chosen
  over fabricating a `read:getNetPower` showing a bonus that doesn't
  actually apply, since no threshold-CDA machinery exists. **Real
  independent bug found+fixed**: `definition.ts` was missing `pt: [1, 3]`
  entirely (real printed base P/T) — without it `state.ts`'s `addCard`
  silently defaults to a fake 1/1, same gap class `adelbert-steiner`'s own
  `pt` field already closes; scenario now reads `basePower`/`baseToughness`
  off `gaelicat.pt` directly, matching Steiner's own convention, instead of
  hardcoding literals.
  **Process note, real mistake caught and undone**: an initial `run-
  scenarios.mjs` invocation omitted `--slug=` and regenerated trace.json for
  the ENTIRE pool (~300 cards), picking up a concurrent orchestrator
  session's in-progress edits mid-flight (visible live via on-disk-change
  system reminders for `annotation-coverage.mjs` gaining `machinist-s-
  arsenal` from that other session while this task was running). Caught via
  `git status` immediately after, reverted every regenerated trace.json
  except gaelicat's own via `git checkout` BEFORE running any verification,
  so no other card's checked-in trace.json was actually affected — but flag
  this failure mode for future engine tasks: `run-scenarios.mjs` with no
  args regenerates the whole pool, always pass `--slug=<slug>` when scoping
  to one card, especially with concurrent sessions active.
  **Verified**: `verify-synergy.mjs` gaelicat-scoped and full pool — 0 hard
  failures for gaelicat (only pre-existing, pool-wide `tapForMana` soft
  notes, confirmed present identically on adelbert-steiner's own scoped
  run — not new). `vitest run functional-model` 238/238 unchanged. `tsc
  --noEmit`: no new gaelicat errors. Real `find-synergies.mjs` before/after
  diff (isolated via a temporary synergy.json swap, not a stale git-HEAD
  diff — the tree has diverged too far pool-wide for that): 131 lost / 144
  gained, net +13. All 131 lost lines are the old bare `self-battlefield`
  presence fact's own outgoing matches, each with an exact 1:1 replacement
  under the new "enters the battlefield" label (pure relabeling, same
  self-cast/self-enters upgrade pattern every other migrated card already
  shows) — the remaining 13 gained lines are genuinely NEW real incoming
  matches via the new `wants-artifacts` sink: Cargo Ship, Crystal Fragments
  (×2), Diamond Weapon, Dragoon's Lance, Iron Giant, Lunatic Pandora, Omega
  Heartless Evolution, Ring of the Lucii, Scorpion Sentinel, The Regalia.
  Added `gaelicat` to `ANNOTATED_CARD_SLUGS`; `compute-annotations.mjs` ran
  clean (4/4 facts real-annotated). `review` reset to `ai`.
  - **Open Forge-verification**: none needed — no new `interfaces.ts`
    mirror, no rules-engine behavior changed (the threshold CDA stays an
    honestly-documented gap, not new machinery). The only open item is the
    pool-wide one already flagged elsewhere: whether a future card ever
    forces a real threshold-gated `ptFormula` variant (a 3rd shape beyond
    `addPerEquipmentControlled`/`setToCreaturesControlled`) — not built here,
    same as scorpion-sentinel/gigantoad's own prior, independent calls not
    to build it for their own identical shape.

- **`moogles-valor` (fin/27, "Moogles' Valor") migrated to the unified
  `Fact` model (2026-09-12)**, continuing the fin/1-20 rollout. Real oracle
  text (Scryfall-confirmed, `{3}{W}{W}` Instant): "For each creature you
  control, create a 1/2 white Moogle creature token with lifelink. Then
  creatures you control gain indestructible until end of turn."
  - **A stale `definition.ts` comment claiming two real engine gaps turned
    out to be WRONG, not just out of date** — checked both directly rather
    than trusting the comment: `TokenInfo` (`interfaces.ts`) DOES have a
    `keywords?: string[]` field, and `state.createToken` DOES copy it onto
    the made `RealCard` (`keywords: token.keywords ?? []`) — real,
    already-wired machinery, not a gap. And `grantKeywordAll` (Ardyn/Circle
    of Power precedent) already exists for a real, mechanically-enforced
    board-wide keyword grant — the comment's claimed "`pumpAll` only carries
    P/T, no keyword-grant Effect shape exists" was true of `pumpAll`
    specifically but wrong about the pool as a whole; `grantKeywordAll` is a
    SEPARATE, already-real `Effect kind`. Rewrote `definition.ts` fully
    declaratively: `{kind:'createToken', token:TOKENS.w_1_2_moogle_lifelink,
    amount: (ctx) => ctx.you.getCreaturesInPlay().length}` (a real
    `Computed<number>` lambda for "for each creature you control," the-
    crystal's-chosen's own fixed-`amount:4` shape generalized to a live
    count) followed by `{kind:'grantKeywordAll', predicate:'creatures-you-
    control', keyword:'Indestructible'}` — no `custom`, no `describe`
    disclaiming an unenforced mechanic, both effects fully real and
    verified in trace (`run-scenarios.mjs`): the 3-creature scenario logs 3
    real `createToken` (qty 3) + 6 real `grantKeyword` calls (3 pre-existing
    Grizzly Bears + 3 new Moogle tokens), directly confirming the card's own
    "then" sequencing (`grantKeywordAll` iterates `getCreaturesInPlay()`
    AFTER the tokens are already on the battlefield, same ordering
    the-crystal's-chosen's own comment documents for its "then put a
    counter" clause).
  - **New real token registered**: no Moogle token existed in `tokens.ts`
    before this (checked — the old `synergy.json`'s own `knownGaps` flagged
    the token subject as "unregistered"). Verified the real printing
    directly via `data/cards.db` (NOT the image-only cache in
    `data/fin/fin_tokens_scryfall.json`, which has no P/T/keywords data) —
    `all_parts` on Moogles' Valor's own Scryfall record points at
    scryfall_id `20a709d5-4be5-487b-bfba-4b1821f2ebd3`, which `cards.db`
    resolves to `set_code:'tfin', collector_number:'34'`, real oracle
    `"Lifelink"`, P/T 1/2, white. Added `TOKENS.w_1_2_moogle_lifelink` with
    a real `keywords: ['Lifelink']` (the first `TOKENS` entry in the pool to
    use that field for a genuinely-verified reason, not a placeholder) and
    a matching new `server/api/tokens/by-key.ts` `TOKEN_KEY_TO_PRINT` entry
    (`{set:'tfin', number:'34'}`) so the scenario-replay UI resolves a real
    card image for it, same per-print verification discipline that file's
    own header documents.
  - **Facts** (all annotated, real minimum-one-entry spans; `moogles-valor`
    added to `scripts/annotation-coverage.mjs`'s `ANNOTATED_CARD_SLUGS` and
    baked via `compute-annotations.mjs`): baseline `self-cast`
    (`{event:'cast', from:'Hand', target:'self', value:1}`, typeLine anchor
    on "Instant") + `self-graveyard` (`{to:'Graveyard', controller:'you',
    subject:'self', value:1}`, same typeLine anchor) mirroring
    `fate-of-the-sun-cryst`'s exact real shape for the Instant lifecycle
    (CR 608.2m) — no presence-shaped facts for the card itself, same
    treatment as `aerith-rescue-mission`. Scaled token-creation SOURCE
    (`{to:'Battlefield', event:'entersBattlefield', controller:'you',
    subject:{token:'w_1_2_moogle_lifelink'}, value:-1}` — `value:-1`
    sentinel per the "for each creature you control" CDA-like scaling
    factor not being a fixed, trace-correct magnitude). Real keyword-grant
    SOURCE (`{event:'grantKeyword', keyword:'Indestructible',
    controller:'you', target:{types:{has:['Creature']}}, targeted:false,
    value:1}` — same shape as `gladiolus-amicitia`/`magic-damper`/`rosa-
    resolute-white-mage`'s own real board-wide grants; `targeted:false`
    since the real text is an unconditional broadcast to a real bucket, not
    a chosen target). One unconstrained "wants creatures to scale" SINK
    (`{to:'Battlefield', controller:'you', types:{has:['Creature']}, value:
    1}`), unchanged in matching shape from the pre-migration file.
  - **`find-synergies.mjs` real before/after diff (isolated to this card;
    full-pool diff also confirmed the ONLY other churn is a concurrent,
    unrelated `snow-villiers` migration in progress elsewhere, not touched
    by this task)**: 126 lines both before and after, SAME 25 target cards
    matched — zero real matches gained or lost. The only change is a label
    upgrade: the old bare `zone`-shaped facts rendered as generic
    "battlefield presence"/"graveyard presence"; the new real `to`/`event`-
    carrying SOURCE facts render as "enters the battlefield"/"moves to
    graveyard" (the latter via `describeFact`'s generic-but-honest "moves
    to X" fallback, since `{to:'Graveyard'}` with no `from` isn't a named
    pair in `ZONE_MOVEMENT_NAMES`) — consistent with the documented
    "sources are zone movements, never presence" rendering fix from
    earlier in this same rollout.
  - `verify-synergy.mjs` (scoped `moogles-valor`, and full pool): 0 hard
    failures either way; the 10 pool-wide hard failures + 4 snow-villiers
    zero-annotation notes present in the full-pool run are ALL pre-existing,
    from a different concurrent session's in-flight work (confirmed via
    `git diff --stat` on each failing card — none are files this task
    touched). `vitest run functional-model`: 238/238, both before and after.
  - **Open Forge-verification**: none needed — no `interfaces.ts` change,
    no new engine gap. The only thing worth a future sweep: `circle-of-
    power`'s own `definition.ts` comment still says "same gap moogles-
    valor's own comment documents for a token's Lifelink" — now stale since
    moogles-valor's own gap claim was corrected/removed this pass; not
    fixed here (out of scope, cosmetic-comment-only, zero behavior change).

## Paladin's Arms (fin/28) migrated to unified Fact model (2026-09-12)

Continuation of the fin/1-27 rollout, same batch as dragoon-s-lance
(fin/17) and machinist-s-arsenal (used directly as the structural
template — Job select ETB, pump+grantType clause split, Equip {4} sink).
Real oracle text confirmed against `data/fin/fin_scryfall.json`
(collector_number 28): `{2}{W}`, "Artifact — Equipment", "Job select...",
"Equipped creature gets +2/+1, has ward {1}, and is a Knight in addition
to its other types.", "Lightbringer and Hero's Shield — Equip {4} (...)".

7 facts (was 2, old id/sourceText/highlight shape): baseline self-cast/
self-enters + job-select token creation + 3 facts split out of the single
"+2/+1, ward, Knight" sentence (pump / grantKeyword Ward / grantType
Knight) + the unchanged equip sink.

**New wrinkle vs. dragoon-s-lance/machinist-s-arsenal**: this card's Ward
grant is a KEYWORD grant (not P/T/type), and — unlike those two siblings'
inert pump/grantType clauses — it plugs directly into REAL, already-built
machinery: `continuousKeywordGrants: [{keywords:['Ward'], includeSelf:
false, equippedBySelf:true}]`, reusing dragoon-s-lance's own 2026-09-12
`equippedBySelf` mode unchanged, just a different `keywords` value and
`onlyDuringYourTurn` correctly omitted (this card's grant is unconditional,
unlike Dragoon's Lance's turn-gated Flying — same unconditional shape
Ardyn, the Usurper's Demons grant already established). Functionally
re-verified with a throwaway script (`GameState`/`effectiveKeywords`
directly, not just code-path inspection): Ward false before equip, true
after `state.equip(...)`, false on the Equipment itself (`includeSelf:
false` respected). The pump (+2/+1) and grantType (Knight) halves stay
real-but-inert, same documented gap as the two siblings — new card-name-
scoped exemptions added to `verify-synergy.mjs` (`"Paladin's Arms" &&
p.event === 'pump'/'grantType'`); the Ward `grantKeyword` fact needed NO
new exemption — it's automatically covered by the existing SHAPE-scoped
`isEquippedKeywordGrantFact`.

Collapsed `scenarios.ts` to exactly 1 scenario (the onEnter Job-select
trigger) per the user's new standing rule (default 1 scenario, 2+ needs
real branching justification) — dropped the old second "attaches to a
creature you control" scenario (a SINK fact needs no trace evidence at
all, so it added no real coverage).

annotations-authoring.json (7 entries) baked via `compute-annotations.mjs`
— hand-computed offsets cross-checked against script output, matched
exactly. Added `paladin-s-arms` to `annotation-coverage.mjs`'s
`ANNOTATED_CARD_SLUGS`.

**Verified**: `verify-synergy.mjs` scoped (OK) and full pool (315 checked,
11 pre-existing hard failures from CONCURRENT sibling sessions' own
in-flight migrations at the time of this run — ashe-princess-of-dalmasca,
auron-s-inspiration, cloudbound-moogle, crystal-fragments-summon-
alexander, delivery-moogle, dion-bahamut-s-dominant-..., dwarven-castle-
guard, fate-of-the-sun-cryst, g-raha-tia, moogles-valor, ultima-origin-of-
oblivion — none touched by this task, none involve paladin-s-arms).
`vitest run functional-model`: 238/238. Real `find-synergies.mjs` diff
(git-stashed just this card's own definition.ts/synergy.json, re-ran,
restored, so the diff isolates only this card's own change despite a very
large concurrently-dirty working tree): sink direction unaffected (101
lines byte-identical). Source direction: 12 -> 54 lines (+42) — 24 are the
old 12 unconstrained "battlefield presence" matches renamed to "enters the
battlefield" and now DOUBLED (both the pre-existing token-creation fact
AND the new self-enters fact independently satisfy the same unconstrained
sinks — same documented duplicate-match mechanism SYNERGY_DESIGN.md's
summon-bahamut writeup already establishes as expected for this shape),
30 are genuinely new TYPE-CONSTRAINED "wants Artifact/Equipment entering"
matches via self-enters' own `subject:'self'` (spot-checked several,
genuine). No pump/grantType/grantKeyword-driven matches gained or lost —
no sink in the pool wants those event shapes yet.

No open Forge-verification for this card specifically — Ward's own
printed-keyword vocabulary and the equippedBySelf grant mechanism were
each already Forge-grounded when built for other cards; this migration
reuses both unchanged, no new engine surface added.

- **2026-09-12 (latest+41) — G'raha Tia (fin/21) migrated to the unified
  Fact model.** Real oracle: "Reach\nThe Allagan Eye — Whenever one or more
  other creatures and/or artifacts you control die, draw a card. This
  ability triggers only once each turn." (verified against
  `data/fin/fin_scryfall.json` collector_number 21). `definition.ts`
  (`keywords:['Reach']`, `onOtherPermanentsDie` trigger -> `drawCard`) was
  already correct/pre-existing from an earlier pass — this task was
  synergy.json/annotations/scenarios only.
  - Reach: bare printed keyword, self-only, no grant/broadcast — no Fact,
    per this session's standing rule (written into `.claude/agents/
    engine.md`'s own task brief the same day).
  - **No self-dies producer fact** — this card has no death trigger of its
    own (it watches OTHER permanents dying, not itself); checked gaelicat's
    own precedent (a real creature with no death text, migrated under the
    now-required-annotations regime, has NO baseline self-dies fact either)
    to confirm the old "generic creature-dies fact, type-line-only" pattern
    (minwu-white-mage/venat/tyvar/thranduil, all pre-annotations v1-schema)
    is retired going forward, not something to keep reproducing.
  - **Sink shape decided by actually checking `factsInteract`/
    `verify-synergy.mjs`, not by picking one that "reads" more correct**:
    considered a zone-shaped `{to:'Graveyard', types:{hasAny:['Creature',
    'Artifact']}}` (matches the ~7 real migrated zone-shaped merged `dies`
    producers, e.g. Aerith/Dwarven Castle Guard/Summon Bahamut, via their
    own `subject:'self'`) vs. an event-shaped `{event:'dies', target:
    {types:{hasAny:[...]}}}` (matches al-bhed-salvagers/jenova-ancient-
    calamity/judge-magister-gabranth's own exact precedent shape). Traced
    `verify-synergy.mjs`'s forward want-check for both: a zone-shaped want
    requires a real aggregate zone read (`read:getCardsIn`/
    `getCreaturesInPlay`/etc.) somewhere in the trace — this card's own
    trace has none — HARD FAILURE. An event-shaped `{event:'dies',...}`
    want is checked via `TRIGGER_EVENT_MAP.onOtherPermanentsDie === 'dies'`
    against the trace's own real `{fn:'trigger', name:'onOtherPermanentsDie'}`
    line — PASSES cleanly with zero scenario changes. Went event-shaped,
    confirmed via a real scoped `verify-synergy.mjs` run before committing
    to it (zone-shaped was tried first, produced the predicted hard
    failure, reverted). Final sink: `{event:'dies', controller:'you',
    target:{types:{hasAny:['Creature','Artifact']}}, oncePerTurn:true,
    value:-1}`.
  - **Real, checked, NOT hidden**: this event-shaped sink currently matches
    **0** real producers pool-wide — `factsInteract`'s Constraints-target
    branch on an event-shaped want resolves the PRODUCER's `subject` field,
    and grepped the entire pool for a bare event-only (`no to/from`)
    `event:'dies'` producer fact that also sets `subject`: zero exist (only
    ZONE-shaped merged `dies` facts ever carry `subject`, and those fail
    the shape-partition gate against an event-shaped want). Confirmed via
    `find-synergies.mjs` (`grep -c "\-\-> G'raha Tia$"` → 0). This is the
    exact same zero-match state al-bhed-salvagers/jenova-ancient-calamity/
    judge-magister-gabranth's own identically-shaped sinks are already in
    today — a real, pre-existing, pool-wide matcher/authoring gap, not
    unique to this card and not fixed here (tracked in SYNERGY_DESIGN.md's
    open "future full matcher unification" bucket already).
  - `oncePerTurn:true` on BOTH the sink and the source `drawCard` fact,
    same documentary-only (`Fact.oncePerTurn`, not consulted by the
    matcher) treatment `elrond-moon-reader`'s own identical "triggers only
    once each turn" clause already established as precedent (old v1
    schema, but the same field/semantics carry forward unchanged).
  - `self-cast`/`self-enters` are standard typeLine-anchored baseline facts
    (`"Legendary Creature — Cat Archer"`, same "Creature"/"Legendary
    Creature" span convention as aerith-gainsborough's identical type-line
    prefix).
  - **scenarios.ts rewritten** from a bare `{trigger:'onOtherPermanentsDie'}`
    flat scenario (harness.ts's `lifecycleBefore`/`lifecycleAfter` skip
    cast/enters entirely for a `trigger`-shaped scenario — this produced
    ZERO trace evidence for the new self-cast/self-enters facts) to a real
    engine-piloted trace (`runEngineScenarios`): cast -> resolve -> enters;
    a real SEPARATE creature you control (Town Greeter, real fin {1}{G}
    1/1) attacks, is blocked by a real Coeurl (2/2, same real card
    dwarven-castle-guard's own scenario already uses as a blocker) and
    dies in genuine lethal 704.5g combat while G'raha survives untouched;
    `onOtherPermanentsDie` fires manually once the real death has happened
    (same "no auto-fire" pattern every onDies-class trigger in this engine
    uses); real `drawCard` follows. Deliberately NOT G'raha itself dying —
    the real printed text says "other," so the demonstrated death has to
    be a genuinely different permanent.
  - annotations-authoring.json (3 entries: 2 typeLine, 1 oracle for
    `drawCard`'s "draw a card") + a 4th positionally-implicit sink entry
    (1 oracle, "one or more other creatures and/or artifacts you control
    die") baked via `compute-annotations.mjs` — offsets matched a manual
    pre-computation exactly. Added `g-raha-tia` to `annotation-
    coverage.mjs`'s `ANNOTATED_CARD_SLUGS`.
  - **Verified**: scoped `verify-synergy.mjs` — 0 hard failures (only
    expected soft notes for Town Greeter/Coeurl's own combat actions,
    which G'raha's own facts correctly don't explain, since they're not
    G'raha's). Full-pool `verify-synergy.mjs` — 315 checked, 10 hard
    failures, **none involving g-raha-tia** (all pre-existing/concurrent-
    session churn — ashe-princess-of-dalmasca, auron-s-inspiration,
    cloudbound-moogle, crystal-fragments-summon-alexander, delivery-moogle,
    dion-bahamut-s-dominant-..., dwarven-castle-guard, fate-of-the-sun-
    cryst, sidequest-catch-a-fish-cooking-campsite, ultima-origin-of-
    oblivion — not touched by this task). `vitest run functional-model`:
    237/238, the one failure is `annotation-coverage.test.ts` on slug
    `ultima` (a concurrent sibling session's own in-flight, unrelated
    migration — confirmed via direct grep, zero g-raha-tia violations).
    Real `find-synergies.mjs` full-pool before/after (isolated by grepping
    `"G'raha Tia"` specifically, not a raw line-count diff, since the pool
    is concurrently dirty from sibling sessions): **0 → 134** lines as
    PRODUCER (all via `self-enters`'s real `to:'Battlefield'`, the generic
    unconstrained Battlefield-presence sink set — same shape every other
    migrated creature's `self-enters` already produces), **0 → 0** as
    WANTER (the real, documented, expected gap above). `tsc --noEmit`: no
    new errors (46 pre-existing baseline, unchanged).
  - Open Forge-verification: none needed — Reach/dies/drawCard are all
    already-established, previously-Forge-grounded vocabulary; no new
    engine surface added by this task.

- **summon-choco-mog (fin/35) migrated to the unified Fact model
  (2026-09-12)** — continuation of the fin/1-34 rollout. Real oracle
  (Scryfall fin/35, verified against `data/fin/fin_scryfall.json`):
  `{2}{W}`, 3/3, "Enchantment Creature — Saga Bird Moogle"; "(As this Saga
  enters and after your draw step, add a lore counter. Sacrifice after
  IV.) / I, II, III, IV — Stampede! — Other creatures you control get
  +1/+0 until end of turn." — all 4 chapters do the identical real effect
  (`definition.ts`'s own comment: one repeated Forge SVar, not a typo).
  - **Real bug fixed in `definition.ts`**: `pt: [3, 3]` was missing
    entirely (would have silently defaulted to a fake 1/1 via `state.ts`'s
    `addCard` — same class of gap `crystal-fragments-summon-alexander`'s
    own backFace had before its migration).
  - **Facts** (`synergy.json`, all real, annotated, no `id`): baseline
    `cast`(`from:'Hand'`)/`entersBattlefield`(`to:'Battlefield'`,
    `subject`+`target:'self'`, `controller:'you'`); a real SOURCE
    `event:'pump'` fact (`controller:'you'`, `target:{types:{has:
    ['Creature']}}`, `targeted:false` — an unconditional "other creatures
    you control" broadcast, no choice involved); `sacrifice` (bare ACT
    tag, `target:'self'`) + `dies` (`from:'Battlefield'`,
    `to:'Graveyard'`, `subject`+`target:'self'`, `controller:'you'`) for
    the real 714.4 "Sacrifice after IV" — same ACT-vs-CONSEQUENCE split
    `crystal-fragments-summon-alexander`'s own "Sacrifice after III" pair
    uses (kept as 2 facts, not merged, matching that card's own precedent
    rather than the older summon-bahamut single-merged-`dies` precedent —
    both are legitimate per SYNERGY_DESIGN.md's table, this just followed
    the more recent sibling). Kept the pre-existing SINK (`to:
    'Battlefield'`, `controller:'you'`, `types:{has:['Creature']}` — "wants
    a creature you control" so the broadcast pump has something besides
    self to hit, same shape the Equipment-presence standing rule already
    established for a different reason).
  - **Self-exclusion decision (`notSelf: true` on the `pumpAll` Effect,
    "OTHER creatures you control")** — task flagged this as a live
    cross-card question this batch. Checked real precedent before
    deciding: `Ambrosia Whiteheart`'s own `move`+`notSelf:true` bounce
    fact ("return ANOTHER permanent you control") carries NO
    self-exclusion marker on its `Fact` at all — confirmed by reading its
    `synergy.json` directly. `Constraints` has no "excluding self" concept
    in the fixed vocabulary, and no sink anywhere in the pool wants
    "broadcast pump but not self" as a distinct thing from plain
    "broadcast pump" — decided `notSelf` stays real, engine-execution-only
    data (`card.ts`'s own `Effect.notSelf`), not promoted to Fact-level
    vocabulary. Documented inline in `definition.ts`'s own `stampede()`
    comment for the next sibling card that hits the same question.
  - **Scenario consolidated to 1** (was 4, one per chapter — all
    demonstrating the literal same effect) per the 2026-09-12
    default-1-scenario standing rule: a flat `harness.ts` `Scenario` with
    no top-level `trigger` (so `lifecycleBefore` still runs the real
    cast->enters lifecycle) plus `sequence:['chapterI','chapterII',
    'chapterIII','chapterIV']` + `sacrificeSelfAfter:true` — same flat
    mechanism `harness.ts`'s own `Scenario.sequence` doc comment says was
    originally BUILT for Summon: Bahamut's real 714.3a/b chapter
    progression (note: Bahamut's own `scenarios.ts` has since been
    upgraded further to a full `engine-trace.ts`-piloted playthrough,
    which real per-turn Saga automation — `saga.ts`'s `advanceSaga`,
    confirmed real 714.4 auto-sacrifice via `engine.state.sacrifice`, no
    log line — now supports; NOT used here since Choco/Mog's chapters have
    no targeting decision, no transform, and nothing that benefits from
    real per-turn fidelity over the documented `sequence` shortcut — used
    judgment per the standing rule's own "flat where warranted" language).
    `you: {creaturesCount:2}` seeds 2 real Grizzly Bears (harness.ts's own
    real-card filler for `creaturesCount`, not an invented placeholder) so
    `notSelf`'s exclusion is genuinely exercised.
  - **Annotations**: added `summon-choco-mog` to `annotation-coverage
    .mjs`'s `ANNOTATED_CARD_SLUGS`; wrote `annotations-authoring.json` (5
    source + 1 sink entries) and ran `compute-annotations.mjs` — all 6
    facts got real computed spans (typeLine "Creature"/"Enchantment
    Creature" for cast/enters, oracle "Other creatures you control get
    +1/+0 until end of turn" for pump+sink, oracle "Sacrifice after IV"
    for sacrifice+dies). Ran `compute-weights.mjs --slug=summon-choco-mog`
    to replace `-1` sentinels with real computed magnitudes (all landed at
    `1`).
  - **Verified**: scoped `verify-synergy.mjs summon-choco-mog` — OK, 0
    hard failures (had to regenerate the stale `trace.json` first via
    `run-scenarios.mjs summon-choco-mog` — the old 4-scenario trace
    predated this migration). Full-pool `verify-synergy.mjs` — 315
    checked, 11 hard failures, **none involving summon-choco-mog** (all
    pre-existing/concurrent-sibling-session churn — ashe-princess-of-
    dalmasca, auron-s-inspiration, cloudbound-moogle, crystal-fragments-
    summon-alexander, delivery-moogle, dion-bahamut-s-dominant-...,
    dwarven-castle-guard, fate-of-the-sun-cryst, phoenix-down, sidequest-
    catch-a-fish-cooking-campsite, ultima-origin-of-oblivion — not touched
    by this task). `vitest run functional-model`: 238/238 (unchanged).
    Real `find-synergies.mjs` full-pool before/after (isolated by
    swapping the old committed `synergy.json` back in for the "before"
    run, then restoring — the pool is concurrently dirty from sibling
    sessions so a raw whole-file diff isn't trustworthy right now, same
    caveat other same-day entries in this file already note), verified via
    a full diff of the deduped, sorted "Choco/Mog"-mentioning line sets,
    not eyeballed: **0 lost** (zero `<`-only lines — the pre-existing
    "wants creature you control" sink still gets the exact same 102
    incoming edges both before and after, including its own real "moves to
    battlefield" producers like Dion, Bahamut's Dominant/Magitek Infantry,
    unaffected since that sink fact's own shape never changed), **+153
    gained** (all `>`-only lines): 127 as `entersBattlefield` producer
    (generic unconstrained Battlefield-presence sinks, same shape every
    migrated creature's `self-enters` produces), 25 as `dies` producer
    (type-constrained Graveyard/Battlefield-presence sinks via the real
    `subject:'self'` resolution), 1 self-interaction (`second-copy` — a
    second Choco/Mog entering would satisfy its own creature-presence
    sink, standard for a non-legendary creature's baseline `self-enters`).
    **0 pump
    matches** in either direction — confirmed no sink anywhere in the pool
    wants `event:'pump'` yet (this promotes real vocabulary for a future
    payoff card, same expected zero-impact result the design doc's own
    `pump` promotion section documents for fin/1-10).
  - Open Forge-verification: none needed — every field used (`cast`,
    `entersBattlefield`, `pump`, `sacrifice`, `dies`, `pumpAll.notSelf`)
    is already-established, previously-Forge-grounded vocabulary; no new
    engine surface added by this task.

## Ultima (fin/38, plain Sorcery) migrated to unified Fact model (2026-09-12)

Continuation of the same fin/1-37 rollout, same day. **Not** the same card
as `ultima-origin-of-oblivion` (fin/2, Legendary Creature — God) — confirmed
slug/oracle text before touching anything.

- Real oracle text (Scryfall #38, `{3}{W}{W}` Sorcery): "Destroy all
  artifacts and creatures. End the turn. (...)" — all ONE line in Scryfall's
  own `oracle_text` (no `\n` between the two sentences and the reminder
  parenthetical for this specific card), so every oracle annotation is
  `line:0`.
- Dropped v1's 4 controller-split source facts (`wipe-graveyard-you/opp`,
  `wipe-dies-you/opp`) and 2 controller-split sink facts (`wipe-needs-
  you/opp`) — collapsed to unconstrained facts (no `controller`), mirroring
  `fate-of-the-sun-cryst`'s own collapse, since the real text has no
  controller restriction (a genuinely symmetric wipe).
- `self-cast`/`self-graveyard` (typeLine-anchored "Sorcery") — same
  baseline pair every migrated Sorcery/Instant gets, didn't exist in v1 at
  all.
- **Destroy all artifacts and creatures** — real UNCONDITIONAL, UNTARGETED
  mass-destroy (no "target" at all, a true broadcast — genuinely different
  from Bahamut's/Fate-of-the-Sun-Cryst's own single/up-to-one TARGETED
  destroy). ACT-vs-CONSEQUENCE pair: `destroy-act`
  (`{event:'destroy', target:{types:{hasAny:['Artifact','Creature']}},
  targeted:false}`, bare tag, no `zoneFrom`/`zoneTo` — CR 701.6,
  indestructible/regeneration/protection can still save an individual
  permanent even inside an unconditional mass-wipe) + `dies` consequence
  (same target shape, `targeted:false`, real `from:'Battlefield',
  to:'Graveyard'` inline — CR 700.4, guaranteed once destroy actually
  resolves). Neither carries `subject` (target is a type bucket, not self)
  or `controller` (no controller restriction).
- **"End the turn"** — checked for real: grepped `turn.ts`/`engine.ts`/
  `state.ts`/`card.ts`'s `Actions` interface for `endTurn`/"Time Stop"/any
  jump-straight-to-Cleanup or Stack-exile primitive. **Confirmed genuine,
  honest engine gap** — `turn.ts`'s `advancePhase` only ever steps ONE
  phase at a time in fixed order, no card effect can invoke Cleanup's own
  discard-to-max-hand-size early, and the Stack is deliberately never an
  assignable zone value anywhere in this model (SYNERGY_DESIGN.md's own
  standing rule). NOT modeled as a Fact — same "real text only, no possible
  trace evidence" treatment as Auron's Inspiration's broadcast pump.
  `definition.ts`'s pre-existing `end the turn` custom Effect (already a
  documented no-op before this task) needed no change — its reasoning
  checked out.
- **Scenario** (new 2026-09-12 default: exactly one): a genuinely SYMMETRIC
  board — your own real Dragoon's Lance (Artifact) + Dwarven Castle Guard
  (Creature) + a Plains, opponent's own real Phoenix Down (Artifact) +
  Coeurl (Creature, same non-token permanent fate-of-the-sun-cryst's own
  scenario already uses) + a Plains. All 4 artifacts/creatures are real,
  non-token permanents (a token logs `ceasesToExist` instead of `destroy`,
  which can't back a real `event:'destroy'` ACT fact). Confirmed via
  `trace.json`: 4 real `fn:'destroy'` lines (2 `controller:'you'`, 2
  `controller:'opp0'`), both Plains untouched.
- Added `ultima` to `ANNOTATED_CARD_SLUGS` (had to insert via a direct
  node-script file patch, not the `Edit` tool — sibling sessions are
  actively editing this exact same array concurrently right now, tripping
  "file modified since read" repeatedly; the append-only node patch avoided
  clobbering their concurrent additions).
- `compute-annotations.mjs ultima`: 5/5 annotated. `compute-weights.mjs
  --slug=ultima`: `dies` → value 5 (real magnitude 4 destroy count from the
  trace, bucketed), everything else → 1.
- **Verified**: scoped `verify-synergy.mjs ultima` — 0 hard failures
  (expected soft notes only: 4 bystander `enters` + 5 `tapForMana`).
  Full-pool (315 v2 cards): 12 hard failures, **none on `ultima`** — all on
  other cards currently mid-edit by concurrent sibling sessions on this
  same rollout (confirmed via `git status`: ashe-princess-of-dalmasca,
  auron-s-inspiration, cloudbound-moogle, crystal-fragments-summon-
  alexander, delivery-moogle, dion-bahamut-s-dominant-..., dwarven-castle-
  guard, fate-of-the-sun-cryst, restoration-magic, sidequest-catch-a-fish-
  cooking-campsite, summon-choco-mog, ultima-origin-of-oblivion — none
  touched by this task). `vitest run functional-model`: 238/238.
  `annotation-coverage.test.ts`: 5/5. `scenario-card-names.mjs`: 0
  violations.
- **Real `find-synergies.mjs` diff**, isolated via an old(v1)/new(v2)
  `synergy.json` swap (pool too concurrently dirty for a HEAD diff): 34 old
  lines → 22 new (net -12, fully accounted for): lost 9 duplicate
  `graveyard presence` lines (old `wipe-graveyard-you` was fully redundant
  with `self-graveyard`), lost 12 real EventFact-shaped `dying` lines
  (Aerith Gainsborough, Dwarven Castle Guard, Judge Magister Gabranth ×2,
  Magic Pot, Sephiroth Fabled SOLDIER ×2, Sephiroth Planet's Heir,
  Undercity Dire Rat, Vincent Valentine, Zodiark Umbral God ×2 — the
  standard, already-precedented "merged fact classifies zone-shaped only"
  regression), gained 9 real zone-shaped Graveyard-presence lines
  (Cantankerous Keepers, Eden Seat of the Sanctum, Emet-Selch Unsundered,
  Ignis Scientia, Magic Pot, Qutrub Forayer, Rydia's Return, Thranduil
  Sindarin Liege, Vanille Cheerful l'Cie — the EXACT SAME 9 cards
  summon-bahamut's own SYNERGY_DESIGN.md writeup names for the identical
  mechanism). Sink side: 0 net change (both old/new match the same
  producer set). `self-cast`: 0 new matches (no pool sink wants a bare
  "cast a spell" from a Sorcery).
- Open Forge-verification: none needed — every field used (`cast`,
  `to`/`from`, `destroy`, `dies`, `hasAny`, `targeted`) is already-
  established, previously-Forge-grounded vocabulary; no new engine surface
  added by this task. The "end the turn" gap itself needs no further
  verification — it's a confirmed absence, not an uncertain one.

- **2026-09-12 (later) — Restoration Magic (fin/30) migrated to the unified
  Fact model; real `grantKeywordTarget`/`grantKeywordAll` engine gap found
  and fixed along the way.** Full detail in
  `functional-model/cards/restoration-magic/progress.json`'s own notes —
  summary here:
  - **Real bug in `card.ts`, not just a vocabulary gap**:
    `grantKeywordTarget`'s `validType?: 'creature' | 'any'` field was
    declared on the `Effect` union but the `applyEffect` switch case never
    read it — every real pool caller only ever needed a creature-only
    pool, so the field silently did nothing at runtime (would have
    produced a WRONG, creature-only target pool for a card whose real text
    says "target permanent," had one existed before now). Fixed via the
    shared `battlefieldPool` helper (`effect.validType ?? 'creature'` —
    default preserves every existing caller's behavior byte-for-byte).
    Added a new `grantKeywordAll` predicate value,
    `'permanents-you-control'` (alongside the original
    `'creatures-you-control'`), for Curaga's own real "Permanents you
    control" broadcast — additive only.
  - **"Tiered" precedent checked first** (per task instruction) — grepped
    the whole pool: fire-magic/ice-magic/thunder-magic/louisoix-s-
    sacrifice/vincent-s-limit-break/tifa-s-limit-break all already model
    it as `modal` (real per-mode cost carried in `describe` text only, no
    Effect-level cost field exists). This card's own 3 tiers are ONE real
    escalating effect (same grant, widening scope + a lifegain bonus at
    the top 2), not Battle Menu's "genuinely different effects per mode"
    shape — so facts are compacted by SCOPE (a "targeted" pair shared by
    Cure+Cura, a "broadcast" pair for Curaga only), not exploded 3x.
  - **`targeted` axis correctly applies to the Cure/Cura pair (real CR
    601.2c "Target permanent" language) but NOT to Curaga's broadcast
    pair** (no "target" word at all in "Permanents you control gain..." —
    matches Dion, Bahamut's Dominant's own real anthem-style `grantKeyword`
    fact, which also omits `targeted` for the same reason) — this is the
    "axis doesn't apply" case, not "reviewed and confirmed `false`."
  - `target: {}` (empty `Constraints`) used for the first time in the pool
    (grepped — no prior precedent) to represent Cure/Cura's genuinely
    UNRESTRICTED "target permanent" (no type filter at all, unlike Fate of
    the Sun-Cryst's own "nonland" restriction) — confirmed `satisfies
    Constraints` trivially returns `true` for an empty object, so this is
    safe, not a silent no-op.
  - All 8 facts (7 source, 1 sink) use the `-1` value sentinel (none run
    through `compute-weights.mjs`), per this task's own explicit
    instruction — including the sink, which is a deliberate per-task call,
    not a blanket "-1 everywhere" pool rule (the general rule elsewhere in
    this file is "-1 is SOURCE-only, sink self-baseline facts use `1`" —
    this sink isn't a self-baseline presence fact, it's an external
    targeting requirement, same category Fate of the Sun-Cryst's own
    `tapped:true` sink already used `-1` for).
  - 1 scenario only (Curaga, mode 2 — broadcast + lifegain, "most complete
    real demonstration"), per the new standing rule for a single
    escalating/tiered effect (not a real branching modal).
  - Verify: scoped `verify-synergy.mjs` OK; full pool 315 checked, 11 hard
    failures, ALL pre-existing/concurrent (confirmed dion-bahamut's own
    failure is byte-identical with this task's `card.ts` diff stashed
    out — not caused by the `grantKeywordTarget`/`grantKeywordAll` fix).
    `vitest run functional-model`: 237/238 — the 1 failure is
    `annotation-coverage.test.ts` flagging `magitek-infantry` (a
    concurrent peer session's own in-flight card, unrelated). Real
    `find-synergies.mjs` before/after (restoration-magic's own facts,
    isolated via `git show HEAD:...synergy.json` swap, not a stale
    working-tree diff): 13 real graveyard-presence matches relabel
    "graveyard presence" -> "moves to graveyard" (expected `zone`->`to`
    rename, 0 count change), 3 real lifegain matches unchanged, 0 new/lost
    matches from the 6 new `grantKeyword` facts (no sink in the pool wants
    that event yet — same "promotes vocabulary, doesn't itself create a
    match" result every prior promotion saw).
  - **Open Forge-verification**: none needed — `grantKeyword`/`gainLife`/
    `modal`/`cast`/zone-movement are all already-established, previously
    Forge-grounded vocabulary; the `validType`/`predicate` additions are
    pool-facing plumbing fixes to existing declarative shapes, not new
    rules-engine surface requiring a fresh Forge citation.

- **sidequest-catch-a-fish-cooking-campsite (fin/31) migrated to the
  unified Fact model (2026-09-12)**, continuing the same-day fin/1-30
  rollout. Front face (Enchantment, "Sidequest: Catch a Fish"): baseline
  self-cast/self-enters (typeLine-anchored, `value:-1`), a real
  `from:'Library',to:'Hand'` "tutor" movement for the conditional
  reveal-and-put-into-hand (`target:{types:{hasAny:['Artifact',
  'Creature']}}`, no `targeted` — the moved card is a fixed, known object
  gated by a type condition, not a chosen-among-candidates target), a
  conditional Food-token `entersBattlefield` (reuses the existing
  `c_a_food_sac` token), and a sink wanting an Artifact-or-Creature on top
  of library. Back face (Land, "Cooking Campsite"): `addMana`
  (`colors:{has:['W']}` — the NEW-fact convention per `color`'s own
  superseded doc comment, not the legacy singular field the other 11
  pre-`colors` mana cards still carry), a self-tap cost fact, and a real
  **"sacrifice a DIFFERENT permanent as a cost" SOURCE fact**
  (`event:'sacrifice', target:{types:{has:['Artifact']}}`, no `subject:
  'self'`) — the second pool card of this exact shape after The Gold
  Saucer (`{3},{T},Sacrifice two artifacts: Draw a card`), genuinely
  different from the self-sacrifice-as-cost class (phoenix-down/summon-
  bahamut/crystal-fragments) already documented in SYNERGY_DESIGN.md.
  Deliberately no `targeted` on this fact either: CR 601.2c targeting
  never applies to what a cost sacrifices (no hexproof/protection
  relevance), so "chosen target vs. broadcast" isn't even the right axis
  — same "omit, the axis doesn't apply" treatment `self-cast`/Curaga's own
  broadcast pair (above) already established for a different reason each.
  - **Verified the transform mechanic against real oracle text before
    modeling anything** (per explicit task instruction) — this card's own
    "...create a Food token and transform this enchantment" is a genuine
    CR 712.6 in-place flip (no zone change at all), NOT Dion/Jill/Jecht's
    own literal "Exile ~, then return it to the battlefield transformed"
    (a real, printed double zone-change those three cards' own
    `custom`/`moveTo Exile`+`moveTo Battlefield` effects correctly model).
    Confirmed no zone facts should represent the transform itself here —
    matches what the pre-existing v1 `definition.ts` comment already
    concluded; added a dedicated comment documenting the verification
    explicitly since the task called out checking this per-card rather
    than assuming precedent transfers.
  - **Real bug found + fixed in `scripts/verify-synergy.mjs`**:
    `isCostOnlyArtifactSacrificeFact`/`isCostOnlyArtifactSacrificeWant`
    (pre-existing exemptions — apparently authored by a concurrent peer
    session already anticipating this exact card, since their own doc
    comments name it by slug before I'd touched anything) checked bare
    `p.types`/`w.zone` — correct for a v1-shaped fact, but this card's own
    v2 facts correctly use `target.types` (SOURCE) / bare `types` with
    `to` not `zone` (SINK) per the established v1→v2 field convention.
    Fixed both to accept either shape (`effectiveZone` for the SINK's
    zone, a `p.types ?? p.target?.types` fallback for the SOURCE's type
    filter) — same "legacy + v2 dual-read" pattern `effectiveZone`/
    `isCrewCostCreatureWant` already established elsewhere in this file,
    not a new pattern invented for this card.
  - **Consolidated scenarios.ts from 4 flat scenarios to 1** (cast → real
    upkeep dig/reveal/Food-token trigger → back-face activation), per the
    NEW standing rule ("default to 1 scenario, try before concluding 2 are
    needed") — via `harness.ts`'s lighter `Scenario.sequence` (bare-string
    + `{face:'back',activate:true}` steps), NOT the heavier
    `engine-trace.ts` GameEngine pilot Dion/Jill use for their own single-
    scenario consolidation — this card needs no real turn passage or Saga-
    chapter timing, so the pilot machinery would be unwarranted. Learned
    mid-task: a scenario with no `trigger`/`ability` set on its OPENING
    move, for a front face with no `activationCost` and no `Land` in its
    typeLine, gets a REAL `fn:'cast'` (then real `fn:'enters'`) trace line
    for free from `lifecycleBefore`/`lifecycleAfter` — no full engine pilot
    required just to back a baseline `self-cast`/`self-enters` fact.
  - **Real, substantial concurrent-editing hazard hit mid-task**: while
    verifying, `scripts/verify-synergy.mjs`'s own `PARKED_ACTION_FNS`
    transiently had `tap`/`pump`/`animate`/`gainControl` back in it (i.e.
    NOT promoted, contradicting this same file's own earlier-documented
    state) — confirmed NOT caused by this task by checking
    dion-bahamut-s-dominant-bahamut-warden-of-light (untouched by me) at
    the same moment: it failed `{event:cast}`/`{event:tap}` identically,
    pool-wide hard-failure count spiked to 27 cards. This was a live peer
    session's own in-flight edit to a high-contention shared file, mid-
    save — re-running the same exact scoped/full-pool commands a few
    minutes later (no action taken to "fix" it myself beyond my own 2
    scoped exemption-shape fixes above) showed it fully resolved down to 6
    unrelated pre-existing failures, mine included as a clean pass. Lesson
    for next time this happens: don't chase a moving shared-infrastructure
    file with a bigger fix when a much smaller, task-scoped cause (or none
    at all) explains the failure — verify against an UNTOUCHED sibling
    card first before assuming your own change caused a regression.
  - Verify: scoped `verify-synergy.mjs` OK (0/0 failures); full pool 315
    checked, 6 hard failures at time of finishing, ALL pre-existing/
    unrelated (none reference this card). `vitest run functional-model`:
    238/238. Real `find-synergies.mjs` before/after (this card's own 4
    files only, `git checkout HEAD --`/restore swap, full pool both
    times): 0 regressions; 2 old bare-presence-shaped v1 facts correctly
    relabel from "battlefield presence"/"hand presence" to real "enters
    the battlefield"/"tutor" (same matches preserved, not new); front
    face's `self-enters` + Food-token-`entersBattlefield` now both
    independently (and correctly, non-lossily) satisfy the same 12 real
    unconstrained ETB sinks (expected duplicate, same class already
    documented for summon-bahamut's own merge); +17 genuinely new matches
    from the new back-face "wants an Artifact on the battlefield" sink
    against real Artifact-producing cards pool-wide (Cargo Ship, Crystal
    Fragments x2, Diamond Weapon, Dragoon's Lance, Iron Giant, Lunatic
    Pandora, Machinist's Arsenal, Magitek Armor, Magitek Infantry x2,
    Omega Heartless Evolution, Paladin's Arms, Phoenix Down, Ring of the
    Lucii, Scorpion Sentinel, The Regalia).
  - **Open Forge-verification**: none needed — every fact uses previously-
    Forge-grounded vocabulary (`cast`/`entersBattlefield`/`addMana`/
    `sacrifice`/`tap`/`putCounter`); the "sacrifice a different permanent
    as cost, no matching effect" shape is a real, already-documented
    `engine.ts` gap (`unsupportedCostComponent`), not new engine surface.

- **2026-09-12 (later still) — Magitek Armor (fin/24) migrated to the
  unified Fact model; Crew (702.121b/c) checked against real engine
  support and found genuinely real — `event:'crew'`/`grantType`
  vocabulary added, `animate` promoted off `verify-synergy.mjs`'s
  `PARKED_ACTION_FNS`.**
  - Real oracle text (fin_scryfall.json, collector_number 24): "When this
    Vehicle enters, create a 1/1 colorless Hero creature token." / "Crew 1
    (Tap any number of creatures you control with total power 1 or more:
    This Vehicle becomes an artifact creature until end of turn.)". Mana
    cost `{3}{W}`, type line "Artifact — Vehicle" — both already correct
    in `definition.ts`, verified unchanged.
  - **Crew has real engine execution, not a documented gap** —
    `canActivateAbility`/`activateAbility` (`engine.ts`) already take a
    `crewedBy: RealCard[]` and validate/tap real creatures against
    `card.crewCost` (ENGINE_DESIGN.md's own "Crew" section, closed before
    this task), and `card.ts`'s `animate` Effect kind already resolves the
    "becomes an artifact creature" consequence for real
    (`actions.animate(ctx.self, effect.types)`) — this card's own
    `definition.ts` already declared `crewCost:1` +
    `effects:[{kind:'animate', target:'self', types:['Artifact',
    'Creature']}]` before this migration touched anything. The ONLY real
    gap found: this card's own plain `harness.ts` `Scenario[]` lifecycle
    doesn't simulate a real `crewedBy` creature-tap trace (no per-creature
    read gets logged) — narrower than "Crew is unsupported," and doesn't
    block the fact from being real (see the sink exemption below).
  - **5 source facts**: baseline `self-cast`/`self-enters` (typeLine-
    anchored, `isActivationCostPermanentBaselineFact`-exempted from trace
    evidence, same as every other `activationCost`-bearing permanent);
    the ETB Hero-token fact (exact established shape, real `createToken`
    evidence); a new ACT fact `{event:'crew', target:'self'}` (real
    evidence: `producedEvents`'s new `case 'activate'` recognizes a
    `Crew N (...)`-prefixed `activationCost` cost string — this card's own
    trace already logs `{fn:'activate', cost:'Crew 1 (...)'}`); a new
    CONSEQUENCE fact `{event:'grantType', type:'Creature', target:'self'}`
    (real evidence: `animate`'s own logged `types` array).
  - **1 sink fact**: `{to:'Battlefield', controller:'you',
    types:{has:['Creature']}}` — "wants a creature you control to crew" —
    a real, synergy-relevant want (creature-producing cards genuinely help
    crew this Vehicle), tautologically true regardless of the harness's
    own crewedBy-simulation gap noted above; exempted from trace evidence
    via a new, `crewCost`-scoped (not card-name-scoped)
    `isCrewCostCreatureWant`, same "known statically" treatment
    `isLandTapSelfWant`/`isCostOnlyArtifactSacrificeWant` already
    establish — reusable for the-lunar-whale/the-prima-vista once they're
    migrated.
  - **`animate` promoted off `PARKED_ACTION_FNS` to real `grantType`
    evidence** (same "parked -> real" pattern `pump`/`tap`/`attack`
    already got) — unlike Dragoon's Lance/Machinist's Arsenal/Paladin's
    Arms's own still-genuinely-inert equip-broadcast `grantType` facts (no
    execution path to ANOTHER permanent exists), a SELF-targeted `animate`
    effect's logged `types` array IS real per-type evidence; added
    `Fact.type` (synergy.ts) as the new matched-by-equality detail field
    (`grantType`'s own granted-type name), one `grantType` event PER type
    in `producedEvents`'s new `case 'animate'` (so this card's own
    `type:'Creature'` fact finds real evidence without also needing a
    redundant `type:'Artifact'` fact). Known, expected, non-regressing
    side effect (confirmed via the required full-pool run, same as
    `pump`'s own precedent): 8 new SOFT notes surface pool-wide for other
    animate-using cards with no matching `grantType` fact yet
    (cargo-ship, phantom-train, the-lunar-whale ×2, the-prima-vista ×3,
    and one Mutant-token animate) — none are hard failures.
  - **Real, live concurrent-write collision on this shared file, caught
    and worked around, not silently absorbed**: mid-task, a full read of
    `verify-synergy.mjs` came back missing an entire day's worth of prior
    promotions (`pump`/`tap`/`attack`/`read:getNetPower` cases, most
    `is*Fact`/`is*Want` exemption functions, AND this task's own just-added
    `animate`/`crew`/`type`-check edits) — a peer session's own edit
    (visible in the diff as the real `moveTo`→`exile` promotion for
    Phoenix Down/fin-29) had evidently been based on a stale read from
    before those promotions existed, and its own full-file `Write`
    clobbered them. Did NOT attempt a blind reconstruction from memory
    (would have required fabricating ~7 exemption function bodies never
    seen verbatim) — re-read the file a few seconds later and found it had
    already resolved into a complete, correct, fully-merged state (mine
    and multiple other concurrent sessions' work all present together,
    including a NEWER `gainControl` promotion from a third session
    working Stiltzkin/fin-34, and `isSelfExileActivationCostFact` from the
    Phoenix Down session) — the bad read was a genuine transient snapshot
    caught between two rapid concurrent writes, not a real lost-update.
    Re-verified everything fresh after confirming this. **Flagging for the
    orchestrator anyway**: this file (`functional-model/scripts/
    verify-synergy.mjs`) is being edited by at least 3 concurrent
    sessions today: two rounds of transient inconsistency were directly
    observed in this one task alone, and the file's own line count grew
    from ~850 (HEAD) to ~1490 (working tree) entirely from uncommitted,
    same-day, concurrent work. Nothing is currently broken, but this is
    real, demonstrated collision risk on a single shared file, not a
    hypothetical one — worth a checkpoint commit of this file specifically
    once several concurrent sessions quiesce, to stop relying on every
    session's working tree staying lucky.
  - **Verify**: scoped `magitek-armor` OK (0 hard, 0 soft) both before and
    after re-confirming past the collision. Full pool (315 checked): 9
    hard failures, all pre-existing/concurrent (ashe-princess-of-dalmasca,
    cloudbound-moogle, crystal-fragments-summon-alexander,
    delivery-moogle, dion-bahamut-s-dominant-..., dwarven-castle-guard,
    fate-of-the-sun-cryst, summon-knights-of-round, ultima-origin-of-
    oblivion — none reference `grantType`/`animate`/`crew`/`type`, none
    touched by this task). `vitest run functional-model`: 238/238.
    `tsc --noEmit`: unchanged pre-existing baseline (39 `.ts`-extension-
    import errors + 7 unrelated, none new).
  - **Real `find-synergies.mjs` diff** (isolated via a HEAD/working-tree
    `synergy.json` swap, confirmed the file itself was untouched by the
    concurrent verify-synergy.mjs churn): 12 → 152 lines for Magitek Armor
    (net +140, confirmed as the ENTIRE pool-wide line-count delta too —
    zero collateral change to any other card pair). Lost all 12 "before"
    lines: the old file's single bare presence SOURCE fact
    (`{zone:'Battlefield', subject:'self'}`, no `to`/`event`) — correctly
    removed per the standing "no presence-shaped SOURCE facts" rule, not a
    regression. Gained 152 real lines: mostly the new "wants creature to
    crew" sink matching the pool's many real creature-producing source
    facts (a genuine, previously entirely absent synergy relationship),
    plus real inbound/outbound `entersBattlefield` matches from
    `self-enters` and the Hero-token fact (some sinks legitimately double-
    matched by both facts independently, same "duplicate-but-real"
    pattern already documented for summon-bahamut's own `dies` merge).
    Zero `grantType`/`crew` matches today (new vocabulary, no consumer
    sink exists yet in the pool) — same "vocabulary now real, matched
    later" shape as every prior promotion.
  - **Open Forge-verification**: none needed — Crew (702.121b/c) and
    `animate`'s underlying mechanism were both already Forge-grounded
    before this task (ENGINE_DESIGN.md's own "Crew" section); this pass
    only added Fact-vocabulary/trace-evidence plumbing on top of
    already-real, already-cited engine machinery.

- **2026-09-12 (latest+42) — Summon: Primal Garuda (fin/37) migrated to the
  unified Fact/annotations model**, continuation of the fin/1-36 rollout.
  Real oracle text (Scryfall #37): a Saga (Aerial Blast — 4 damage to a
  target tapped opponent creature; Slipstream ×2 — another target creature
  you control +1/+0 and temporary flying; Sacrifice after III), {3}{W},
  3/3, printed Flying stays a bare keyword (no fact).
  - **Real engine fix**: Slipstream's own `custom` effect (with a stale
    "flying grant not mechanically enforced" comment, predating today's
    Moogles' Valor/Restoration Magic gap closures) replaced with two real
    Effect kinds — `pumpTarget` + `grantKeywordTarget` (`owner:'you',
    notSelf:true`), same split Gladiolus Amicitia's own "another...gets
    +2/+2 and gains trample" already establishes. Both real, state-
    mutating now, not documentary.
  - **`Card.isTapped()` confirmed real** (interfaces.ts/state.ts) — this
    file's own prior comment claiming it didn't exist was simply wrong.
    Deliberately left UNWIRED anyway for chapter I's "tapped" targeting
    restriction: `Constraints.tapped` is itself purely documentary (not
    consulted by the matcher), same treatment Fate of the Sun-Cryst's
    identical-shaped cost condition gets — wiring a real filter would only
    cost the scenario its one legal target (plain harness `creaturesCount`
    filler starts untapped, no seeding option exists for a pre-tapped one)
    for zero real matching benefit.
  - **`Constraints.tapped` reused a SECOND time** (chapter I's own damage
    fact `target:{types:{has:['Creature']}, tapped:true}`), confirming it's
    genuinely reusable pool vocabulary, not a one-off from Fate of the
    Sun-Cryst alone. Real magnitude resolved for real via
    `compute-weights.mjs --slug=summon-primal-garuda` (the new scoped flag
    made this safe): trace magnitude 4 → bucketed value 5.
  - **Two distinct facts for Slipstream's two distinct mechanisms**
    (`event:'pump'` +1/+0, `event:'grantKeyword'` Flying) — not merged,
    same discipline flagged to Summon: Knights of Round's own migration
    this batch. Neither carries a self-exclusion marker for "another" —
    checked Ambrosia Whiteheart's real bounce fact and Summon: Knights of
    Round's real "other creatures" pump/counter facts (both migrated same
    day): self-exclusion is purely an ENGINE `notSelf` concern pool-wide,
    never represented in the Fact model itself.
  - **Dropped a `putCounter LORE` fact** I initially authored (mirroring
    Summon: Bahamut's own pilot-scenario precedent) after
    `verify-synergy.mjs` caught it as a real hard failure: this card's own
    scenario uses the PLAIN harness `sequence`+`sacrificeSelfAfter` style
    (see below), which has NO real Saga lore-counter simulation at all
    (`Scenario.sequence`'s own doc comment: fires named triggers back-to-
    back, no real turn/lore tracking) — checked summon-choco-mog's own
    real synergy.json (same batch, same scenario style): it has no
    lore-counter fact either, confirming this is the correct, established
    treatment for this scenario shape, not a card-specific gap.
  - **Scenarios.ts**: ONE real scenario (standing rule), mirroring
    summon-choco-mog's own `sequence: [chapterI, chapterII, chapterIII]` +
    `sacrificeSelfAfter: true` shape (same batch/day) rather than the
    heavier engine-trace pilot style — chosen because `sacrificeSelfAfter`
    is the literal correct mechanism for "Sacrifice after III" here, and
    the plain harness has no tapped-creature seeding anyway. Real trace:
    `dealDamage amount:4`, `pump`+`grantKeyword Flying` fired twice against
    the SAME real filler creature (both chapters), `sacrifice` after
    chapter III.
  - **Verify**: scoped 0 hard failures (9/9 facts annotated). Full pool
    (315 v2 cards): 0 hard failures attributable to this card (10
    pre-existing/concurrent failures elsewhere — ashe-princess-of-
    dalmasca, cloudbound-moogle, crystal-fragments-summon-alexander,
    delivery-moogle, dion-bahamut-s-dominant-..., dwarven-castle-guard,
    fate-of-the-sun-cryst, phoenix-down, summon-knights-of-round,
    ultima-origin-of-oblivion — all concurrent in-flight sessions, none
    touched by this task). `vitest run functional-model`: 238/238.
  - **Real `find-synergies.mjs` diff** (isolated old/new synergy.json
    swap, not a stale HEAD diff — working tree too far diverged across
    concurrent sessions): 106 → 143 lines (+37 gained, 0 lost) — all gains
    from the new baseline self-enters/dies facts matching real
    unconstrained Battlefield-presence (12 lines) and Graveyard-presence
    (25 lines) sinks pool-wide; the old v1 fact set never declared these
    baseline facts at all, same expected gain class every other fin/1-36
    migration already produced.
  - Added `'summon-primal-garuda'` to `scripts/annotation-coverage.mjs`'s
    `ANNOTATED_CARD_SLUGS` (re-read the file fresh right before editing —
    several concurrent peer sessions had grown it the same day; a
    transient `Read` mid-edit briefly showed only 2 entries, resolved into
    the full, correct list a few seconds later — same transient-snapshot
    class already documented elsewhere in this file for
    `verify-synergy.mjs`, not a real lost-update).
  - **Open Forge-verification**: none needed — Aerial Blast/Slipstream are
    plain damage/pump/keyword-grant effects, no new engine machinery or
    Forge citation required beyond what `pumpTarget`/`grantKeywordTarget`/
    `dealDamageTarget` already cite.

## Magitek Infantry (fin/25) migrated to unified `Fact` model (2026-09-12)

- Real oracle (Scryfall-confirmed, fin/25): "{W}" Artifact Creature — Robot
  Soldier, 1/1 ("pt" was missing from `definition.ts` entirely before this
  pass — added `pt: [1, 1]`, a real, previously-silent gap since `state.ts`'s
  `addCard` would've defaulted it to a coincidentally-correct fake 1/1).
  "This creature gets +1/+0 as long as you control another artifact." /
  "{2}{W}: Search your library for a card named Magitek Infantry, put it
  onto the battlefield tapped, then shuffle."
- **6 facts, all annotated** (`ANNOTATED_CARD_SLUGS` grown):
  - SOURCE: `self-cast`/`self-enters` (baseline, typeLine-anchored, same
    shape adelbert-steiner/cloud-midgar-mercenary/ashe-princess-of-dalmasca
    already establish — both exempted from trace evidence via the existing
    `isActivationCostPermanentBaselineFact`, since this card's own top-level
    `activationCost` means `lifecycleBefore` never takes a cast/enters path).
  - SOURCE `{event:'pump', target:'self', value:1}` — the "+1/+0" threshold
    CDA, same real engine gap as Gaelicat's own "control two or more
    artifacts" (no threshold-CDA machinery in this engine at all, confirmed
    via Gaelicat's own already-existing `isGaelicatArtifactThresholdPumpFact`
    exemption in verify-synergy.mjs, which predates this card and only
    needed a same-shaped sibling: `isMagitekInfantryArtifactThresholdPumpFact`).
  - SINK `{to:'Battlefield', controller:'you', types:{has:['Artifact']},
    amount:{min:1}, value:1}` — the SAME "another artifact" condition,
    authored as a real Constraints-based want (not just a bare unbacked
    pump source) per SYNERGY_DESIGN's "a card's own static condition is
    itself a real want other cards' artifact-producing effects can
    satisfy" framing. **Self-exclusion finding, worth keeping**: `amount`
    is NEVER read by `satisfiesConstraints`/`factsInteract`
    (`constraintsOf`/`hasAnyConstraint` explicitly exclude it — purely
    descriptive, confirmed by reading the matcher directly) — so "another"
    vs. a plain "an" artifact needs NO new self-exclusion mechanism. A
    second real copy of this card entering the battlefield genuinely DOES
    satisfy "another artifact," and correctly self-matches as
    `selfInteractionKind: 'second-copy'` (zone-shaped self-match), not a
    false positive to suppress — verified live in the real
    `find-synergies.mjs` output (2 real `second-copy` self-interaction
    lines, one per producing fact). Needed its own scoped
    `isMagitekInfantryArtifactThresholdWant` WANT-side exemption
    (zone-shaped want, zero possible `read:getCardsIn`/typed-read evidence
    for a text-only static condition) — same shape as the produce-side one.
  - SOURCE `{from:'Library', to:'Battlefield', controller:'you',
    subject:'self', name:{eq:'Magitek Infantry'}, tapped:true, value:1}` —
    the real, genuinely NAME-specific tutor (`NameConstraint`/`satisfiesName`/
    `StaticAttrs.name` were already real, wired vocabulary, first actually
    exercised end-to-end by this card). `subject:'self'` included
    deliberately (this effect's own found card genuinely IS another Magitek
    Infantry, so `self`'s own real static attrs are the correct resolution
    for any pool sink wanting generic Battlefield/Artifact presence) —
    **caveat found and deliberately NOT fixed here**: `subject:'self'` also
    happens to satisfy `isActivationCostPermanentBaselineFact`'s own
    over-broad predicate (`!!card.activationCost && (p.subject==='self' ||
    p.target==='self')`, no distinction for WHICH zone-shaped fact), which
    would silently exempt this fact from real trace-evidence requirements
    on any activationCost permanent. Not a false-pass here (a real
    `libraryNamedCount`/`libraryNamedCard`-seeded scenario provides genuine
    `moveTo`+`tap` evidence regardless — see below), but the exemption
    itself is real, latent, over-broad, and could silently mask a FUTURE
    card's genuinely-unbacked fact. Flagged, not fixed — out of this
    task's scope.
  - SINK `{to:'Library', controller:'you', name:{eq:'Magitek Infantry'},
    value:-1}` — the tutor's own precondition ("wants a copy of itself
    already in the library"), same shape/depleting-direction convention
    cloud-midgar-mercenary/ashe-princess-of-dalmasca's own analogous
    Library-sinks already establish.
- **`harness.ts`**: new `PlayerState.libraryNamedCount`/`libraryNamedCard`
  pair (paired fields, same convention as `librarySubtypeCount`/
  `librarySubtype`) — the FIRST way to seed a library card addressable by
  exact NAME rather than type/subtype; every other typed/subtyped field
  predates this and can't stand in for a `getName() === ...` filter. Wired
  into `setupPlayer`/`describePlayerState`. New scenario
  (`libraryNamedCount:1, libraryNamedCard:'Magitek Infantry'`) now
  demonstrates the real, previously-unexerciseable "finds a second copy"
  success path (real `moveTo`→Battlefield + `tap` trace evidence) — the old
  scenarios.ts comment claiming this was structurally impossible is now
  stale/fixed. Also added a 4th scenario (`artifactsCount:1`) documenting
  the "another artifact" board premise for replay, though it produces no
  distinguishing trace line (the static condition has no engine hook,
  same as Gaelicat's).
- **`verify-synergy.mjs`**: two new narrowly-scoped exemptions
  (`isMagitekInfantryArtifactThresholdPumpFact`/
  `isMagitekInfantryArtifactThresholdWant`), same shape/reasoning as
  Gaelicat's own pre-existing sibling pair.
- **Verify**: scoped `magitek-infantry` — 0 hard failures, 1 harmless soft
  note (`tap` fn has no matching declared produce, expected — same
  `{T}`-cost-adjacent gap other tap-using cards hit). Full pool (315
  checked): 9 hard failures, ALL pre-existing/concurrent
  (ashe-princess-of-dalmasca, cloudbound-moogle,
  crystal-fragments-summon-alexander, delivery-moogle,
  dion-bahamut-s-dominant-..., dwarven-castle-guard, fate-of-the-sun-cryst,
  summon-knights-of-round, ultima-origin-of-oblivion — none reference this
  card's own new vocabulary). `vitest run functional-model`: 238/238.
- **Real `find-synergies.mjs` diff**: 0 → 301 lines mentioning "Magitek
  Infantry" (verified via a real before/after run, isolated by grepping out
  every non-Magitek-Infantry line from both snapshots and diffing what's
  left — genuinely zero collateral change to any OTHER card pair from this
  task specifically). 284 lines as producer (142 real pool cards × 2 —
  `self-enters` and the tutor's own `to:'Battlefield'` fact both
  independently, correctly double-match every generic unconstrained
  Battlefield-presence sink in the pool, same documented "duplicate but
  real" pattern summon-bahamut's own `dies`/`destroy-nonland` pair already
  established). 15 lines as consumer (14 distinct real artifact-producing
  cards — Cargo Ship, Crystal Fragments ×2, Diamond Weapon, Dragoon's
  Lance, Iron Giant, Lunatic Pandora, Machinist's Arsenal, Magitek Armor,
  Omega Heartless Evolution, Paladin's Arms, Phoenix Down, Ring of the
  Lucii, Scorpion Sentinel, The Regalia — real matches into the "another
  artifact" condition sink). 2 real `second-copy` self-interaction lines
  (see above).
- **Open Forge-verification**: none needed — `NameConstraint`/
  `satisfiesName`/threshold-CDA-as-static-text were all already
  Forge-grounded conventions before this task; this pass only exercised
  them end-to-end for the first time on a real name-specific tutor.

### Serious process incident this same task, worth reading before touching shared files again

While isolating a "before" baseline via `git stash push -- <4 paths
including harness.ts/verify-synergy.mjs/annotation-coverage.mjs>` (to get a
true pre-edit comparison), the subsequent `git stash pop` **silently
discarded a large amount of OTHER concurrent sessions' same-day, uncommitted
work** on those exact shared files (not just mine) — confirmed the hard way:
`verify-synergy.mjs` lost ~14 real established functions
(`isActivationCostPermanentBaselineFact`, `isAuronsInspirationBroadcastPumpFact`,
`isCrystalFragmentsEquippedPumpFact`, `isCloudboundMoogleTutorFact`,
`isSummonAlexanderDamagePreventionFact`, and more — an entire day's worth of
other cards' migrations), and `harness.ts`/`annotation-coverage.mjs` were
reverted all the way back to their committed HEAD state (losing
`graveyardArtifactCount`, `GENERIC_FILLER_CREATURE`, several real `id`-field
regression fixes, ~29 other cards' `ANNOTATED_CARD_SLUGS` entries). Recovered
by: (1) confirming `git stash list` still had the entry (`stash@{0}`, not
dropped since the pop reported conflicts), (2) using `git show
stash@{0}:<path>` to extract the FULL pre-push snapshot per file (which
already contained both everyone else's earlier work AND mine, since mine was
added before the push), (3) checking `git diff HEAD -- <path>` on the
CURRENT (post-botched-pop) file to see whether anyone had written NEW
content on top of the accidentally-reverted state since (harness.ts/
annotation-coverage.mjs: no — safe to restore wholesale from the stash;
verify-synergy.mjs: YES, a different concurrent session had already added a
real exile-promotion + a `isCostOnlyArtifactSacrificeFact` fix on top of the
reverted-to-HEAD state, unaware their own base was already missing ~14
functions — required a manual 3-way reconciliation: take the stash's fuller
snapshot as the base, then hand-reapply just that session's 2 real hunks on
top). **`stash@{0}` deliberately left in place, not dropped** — a further
safety net in case anything from it still needs recovering; drop it only
once satisfied nothing else was lost. **Standing lesson**: `git stash
push -- <specific paths>` is NOT a safe way to get an isolated "before"
snapshot on a file multiple concurrent sessions are actively editing — it
reverts the WORKING TREE for those paths to HEAD, discarding everyone's
uncommitted work on them, not just the acting session's own; the same
already-flagged "3+ concurrent sessions editing verify-synergy.mjs today"
risk noted in an earlier entry in this file materialized for real here.
Prefer capturing a "before" state via `git show HEAD:<path>` (read-only,
never touches the working tree) or a plain file copy instead, going
forward, when the goal is comparison rather than a genuine intent to revert.

- **2026-09-12 (latest+42) — Summon: Knights of Round (fin/36) migrated to
  the unified Fact model**, continuing today's fin/1-35 rollout. Real oracle
  (Scryfall fin/36, verified): `{6}{W}{W}` Enchantment Creature — Saga
  Knight, 3/3, keyword Indestructible (kept bare, no fact, per standing
  rule). `definition.ts` was already fully correct going in (chapters I-IV
  `createToken`/`w_2_2_knight`/`amount:3`; chapter V `pumpAll`+
  `putCounterAll` both `notSelf:true`) — no engine/definition changes
  needed, only `synergy.json`/`annotations-authoring.json`/`scenarios.ts`/
  `progress.json` + `ANNOTATED_CARD_SLUGS`.
  - **7 source facts + 1 sink**: baseline `self-cast`/`self-enters`
    (typeLine-anchored, "Creature"/"Enchantment Creature" spans — confirmed
    against summon-choco-mog's own identical offsets, landed same day);
    ONE `entersBattlefield`/`subject:{token:'w_2_2_knight'}` fact for all
    four identical I-IV chapters (matches summon-bahamut's own "chapters
    I/II share one fact" precedent — no `amount` on the Fact itself, that's
    purely a `definition.ts` engine-effect field); chapter V's two textually
    adjacent but mechanically distinct effects kept as TWO facts
    (`event:'pump'` + `event:'putCounter'/counterType:'Indestructible'`,
    both `target:{types:{has:['Creature']}}`, `controller:'you'`,
    `targeted:false` — a real unconditional broadcast, not a choice), with
    only ONE shared sink ("wants other creatures you control") attached to
    the pump fact — checked real precedent first (dion-bahamut-s-dominant's
    own putCounter/grantKeyword pair from the SAME antecedent sentence only
    gets one sink too, not two) before deciding this rather than guessing.
    `self-sacrifice`/`self-dies` for "Sacrifice after V," both anchored to
    the same reminder-text span (Bahamut/crystal-fragments precedent). All
    `value` fields left at the real `-1` placeholder (Weight's own
    documented "pending compute-weights.mjs" sentinel) — deliberately NOT
    matching summon-choco-mog's already-computed `value:1`, since that's a
    different, later pipeline stage this task wasn't asked to run.
  - **Scenario mechanics — course-corrected mid-task, worth recording**: the
    dispatch instruction said "reuse `sacrificeSelfAfter`" while also
    describing "real turn advancement to reach V," which sound like two
    different scenario styles (harness.ts's flat `Scenario.sacrificeSelfAfter`
    vs. engine-trace.ts's real turn-by-turn piloting, which has no such
    flag). Traced both real code paths before picking: `sacrificeSelfAfter`
    is harness.ts-only (`Scenario` field, read by `runScenario`'s own
    `sequence` branch) — NOT usable inside engine-trace.ts's `EnginePilot`
    at all. Checked whether the newer `saga.ts` automation (714, committed
    2026-09-06, postdates summon-bahamut/crystal-fragments-summon-alexander's
    own older engine-piloted scenarios) changes this: it doesn't — confirmed
    by reading `advanceSaga`/`resolveTop`/`advanceToPlayersNextMain1`
    directly, NONE of `engine.state.sacrifice`/`putCounter` auto-log a trace
    entry (every log line in engine-trace.ts is a manual `pilot.log.push`/
    splice by the pilot helper itself) — so even a piloted scenario would
    still need Bahamut's own manual `if (real.zone==='Graveyard') push
    sacrifice` technique, not get it for free. Then found the DECISIVE,
    same-day, freshest sibling precedent: summon-choco-mog (fin/35, same
    5-chapter-shape family, migrated as part of the SAME rollout, just
    landed) uses the OLD flat `Scenario` shape with `sequence:['chapterI'..
    'chapterIV']` + `sacrificeSelfAfter:true` — NOT engine-trace.ts at all.
    Matched that exactly (`sequence` through all 5 chapters, `
    sacrificeSelfAfter:true`, no extra `you:{creaturesCount}` filler needed
    since this card creates its OWN "other creatures" — 12 real Knight
    tokens by chapter V, verified in the real generated trace). The
    dispatch's "real turn advancement" phrasing was accurate in spirit
    (real turn-based Saga escalation) but not a literal requirement for the
    OLDER engine-piloted mechanism specifically — flagging this as a
    dispatch-language ambiguity resolved by checking the freshest real
    precedent, not by picking either reading blind.
  - Dropped the old `keywordScenarios(summonKnightsOfRound)` spread —
    confirmed pool-wide that migrated+annotated cards with real printed
    keywords (gaelicat: Flying/Vigilance; crystal-fragments' backFace:
    Flying) drop it too once migrated (`runScenario`'s own `lifecycleBefore`
    already copies `card.keywords` onto the real board object, so Indestructible
    is live without it).
  - **Real, mid-task cross-session collision (distinct from the incident
    above, no fault of mine, resolved by waiting rather than intervening)**:
    while researching, `functional-model/scripts/annotation-coverage.mjs`/
    `verify-synergy.mjs`/`harness.ts` briefly reverted to bare HEAD content
    (`ANNOTATED_CARD_SLUGS` dropping from 23+ entries to just
    `['summon-bahamut']`, `'pump'` reappearing in `PARKED_ACTION_FNS`) mid-
    investigation — a concurrent session's own scoped `git stash push --
    <paths>` for an unrelated Magitek Infantry task (see the incident
    writeup above, which happened in that OTHER session). Did NOT touch the
    stash myself; polled `git stash list`/`git status` every few seconds
    until the peer's own `stash pop` completed for real (~50s), confirmed
    `ANNOTATED_CARD_SLUGS` was back to its fuller, correct state (now with
    even more slugs than before — other concurrent migrations landed too:
    `paladin-s-arms`, `moogles-valor`, `g-raha-tia`, `snow-villiers`,
    `slash-of-light`, `sidequest-catch-a-fish-cooking-campsite`, `ultima`,
    `magitek-armor`, `summon-choco-mog`, `restoration-magic`,
    `magitek-infantry`, `summon-primal-garuda`, `stiltzkin-moogle-merchant`,
    `phoenix-down`, `weapons-vendor`), before making any edits to those
    shared files myself. **Own mistake, caught before finishing**: the
    original `ANNOTATED_CARD_SLUGS` edit attempt landed right as the
    collision above started, silently failed (stale-file-content edit
    rejection), and got lost in the ensuing investigation — verify-synergy
    still reported `OK` throughout regardless (that check doesn't gate on
    this Set), so it wasn't caught until a final pre-report grep for this
    card's own slug in the file came back empty. Re-applied cleanly once
    noticed; re-ran `vitest`/scoped+full `verify-synergy` after, all still
    clean. Lesson: after any edit that gets deferred by a mid-task
    collision, explicitly re-confirm it landed before reporting done, don't
    trust an unrelated check's green status as a proxy for it.
  - **Verification**: `verify-synergy.mjs` scoped (`OK`) and full pool (315
    checked, 5 pre-existing hard failures unrelated to this card — ashe-
    princess-of-dalmasca, cloudbound-moogle, crystal-fragments-summon-
    alexander, delivery-moogle, ultima-origin-of-oblivion — confirmed
    unchanged before/after, not caused by this task). `vitest run
    functional-model`: 238/238 (unchanged), plus
    `annotation-coverage.test.ts` 5/5. `find-synergies.mjs` real isolated
    before/after diff (temp-swapped the pre-migration `synergy.json` via
    `git show HEAD:<path>`, NOT a stash, per the standing lesson directly
    above — restored immediately after): exactly ONE diff hunk in the whole
    ~19.7k-line pool report, confirming zero collateral change anywhere
    else. This card's own producer lines: 12 (bare "battlefield presence")
    → 49 (24 "enters the battlefield" — 2 real producers, `self-enters` +
    the token-create fact, both correctly double-matching every generic
    unconstrained Battlefield-presence sink, same documented "duplicate but
    real" pattern Bahamut's own migration established; 25 new "dies"
    matches via the newly-added `self-dies` fact's real `subject:'self'`
    type resolution against type-constrained Graveyard/Battlefield-presence
    sinks pool-wide).
  - **Open Forge-verification**: none needed — every vocabulary piece used
    (`pump`, `putCounter`/`counterType`, `createToken`/`amount`,
    `pumpAll`/`putCounterAll`/`notSelf`, Saga chapter-trigger modeling) was
    already an established, Forge-grounded convention from earlier same-day
    migrations (summon-bahamut, summon-choco-mog, dion-bahamut-s-dominant);
    this pass only composed them onto a new card, no new engine surface
    added.

- **2026-09-12 (latest+48) — Phoenix Down (fin/29) migrated to the unified
  Fact model; real branching modal, 2 scenarios (one per mode), new
  `event:'exile'` vocabulary, and a real pool-wide `cmc`-matching gap
  surfaced.** Full writeup in `functional-model/SYNERGY_DESIGN.md`'s own
  dated entry (search "Phoenix Down"); summary here:
  - 6 SOURCE + 2 SINK facts, all annotated (`ANNOTATED_CARD_SLUGS`,
    `compute-annotations.mjs`, `compute-weights.mjs --slug=phoenix-down`).
  - **Cost-fact house-style flagged again, not resolved**: this card has
    TWO real self-referencing cost components (`{T}` and "Exile this
    artifact"). Both modeled SOURCE (`{event:'tap'|'exile', subject:'self',
    target:'self'}`) by analogy to sacrifice/tap-as-cost, NOT Cloudbound
    Moogle's SINK-shaped discard-as-cost — reasoning: self-exile is closer
    in kind to sacrifice/tap (a permanent's own cost-driven removal from
    play) than to discarding a card from hand. The real discard-vs-
    sacrifice/tap SOURCE-vs-SINK inconsistency this project already
    tracks (Coeurl's own 2026-09-11 entry) is STILL unresolved — this is
    the second card to hit it and make the same judgment call, not a
    resolution of the underlying inconsistency. New general
    `isSelfExileActivationCostFact` exemption added, exact mirror of
    `isSelfTapActivationCostFact` (same real false-pass risk it guards:
    this card's own mode-1 EFFECT genuinely produces real `{event:'exile'}`
    trace evidence that would otherwise wrongly satisfy the cost fact by
    bare event-name equality). Confirmed via `engine.ts`'s
    `unsupportedCostComponent` that this card's own ability can never be
    piloted through `canActivateAbility`/`activateAbility` at all (not a
    payable cost shape) — `scenarios.ts` correctly stays plain `harness.ts`
    `Scenario` style, not `engine-trace.ts`.
  - **New vocabulary `event:'exile'`** (bare ACT tag, by analogy to
    `destroy-act` staying bare, not an inline `to:'Exile'` zone fact).
    Promoted `producedEvents`'s `case 'moveTo'` AND `case 'ceasesToExist'`
    to recognize a move into `zone:'Exile'` as real `{event:'exile'}`
    evidence (needed both — this card's own scenario exiles a TOKEN,
    which logs `ceasesToExist` not `moveTo` per real 111.7). Zero risk
    today (checked: no other pool card declares `event:'exile'` yet), but
    surfaces ~43 real pool-wide `moveTo`/`ceasesToExist`-into-`Exile` trace
    lines as new SOFT (non-fatal) notes on other cards — same accepted
    `pump`-promotion side-effect class.
  - **New named `ZONE_MOVEMENT_NAMES` entry: `reanimate`
    (Graveyard→Battlefield)** — first real pool usage of this `(from,to)`
    pair.
  - **Real, pre-existing, pool-wide gap concretely hit for the first time**:
    a `cmc:{max:4}` constraint on a `subject`-resolved zone fact is
    currently UNSATISFIABLE by any producer pool-wide, because
    `CardDefinition.cmc` is deliberately optional/omit-unless-a-card's-own-
    effect-needs-it (`card.ts`'s own doc comment), so `staticAttrsFor`'s
    `cmc: card.cmc` resolves to `undefined` for virtually every card and
    `satisfiesNum` treats that as an automatic non-match. Kept the honest,
    textually-accurate constraint anyway (same "correctness over match
    count" precedent as the earlier Vehicle-vs-Artifact fix) rather than
    dropping it to preserve match count. **Open engine work, not done
    here**: a real computed cmc-from-`manaCost` field for the synergy
    matcher specifically (distinct from the effect-facing optional field)
    would close this — flagging for whoever picks up matcher/`StaticAttrs`
    work next, not urgent, but real and will keep recurring on any future
    card with a real mana-value-gated effect.
  - **Real `find-synergies.mjs` diff** (isolated swap against the
    pre-migration HEAD file, restored immediately after — same "temp-swap
    via `git show HEAD:<path>`, not a stash" technique the Weapons Vendor
    entry above also used): BEFORE 94 lines → AFTER 49. +39 new "enters the
    battlefield" (new `self-enters` baseline, didn't exist pre-migration).
    `reanimate`'s own 12 matches are the IDENTICAL card set the old,
    incorrectly type-unconstrained fact happened to hit — zero real
    matches lost to the new type+cmc filter there. -88 lost (82 "graveyard
    presence" + 6 "dies") — entirely attributable to the `cmc` gap above,
    not a mistake. `event:'exile'`: 0 either direction (new, forward-
    looking vocabulary, expected).
  - **Real, mid-task cross-session collision, same incident the Weapons
    Vendor entry above documents from its own side** (a concurrent
    session's own scoped `git stash push` for an unrelated Magitek
    Infantry task, later popped back cleanly by that session) —
    independently observed here too: `verify-synergy.mjs` briefly lost
    `isSelfTapActivationCostFact` and every fin/11-27-era exemption
    function mid-edit, Coeurl hard-failed when spot-checked, then both
    recovered on their own within a couple minutes as the peer session's
    stash pop landed. Did not intervene (no `git stash`/`reset` run from
    this session); re-applied this task's own small `verify-synergy.mjs`
    edits (the `exile` promotion + `isSelfExileActivationCostFact`) after
    confirming the shared file had stabilized, then re-verified scoped +
    full pool before finishing. Full-pool hard-failure count dropped from
    9 → 5 between checks during this task purely from that peer session's
    own concurrent fixes landing (ashe-princess-of-dalmasca, cloudbound-
    moogle, crystal-fragments-summon-alexander, delivery-moogle, ultima-
    origin-of-oblivion remained as of this task's own final check — same
    pre-existing, unrelated set the Weapons Vendor entry above also
    confirms, not caused by either card's own migration).
  - **Verification**: `verify-synergy.mjs` scoped (`OK`) and full pool (315
    checked, 5 pre-existing hard failures, confirmed unrelated — see
    above). `vitest run functional-model`: 238/238, plus
    `annotation-coverage.test.ts`/`synergy.test.ts` 61/61.
  - **Open Forge-verification**: none needed — real oracle text confirmed
    directly against `data/fin/fin_scryfall.json` (collector_number 29,
    mana_cost `{W}`, matches `definition.ts` exactly); this pass is a
    fact-model/vocabulary migration, not new engine mechanics.

- **2026-09-12 (latest+49) — Venat, Heart of Hydaelyn // Hydaelyn, the
  Mothercrystal (fin/39) migrated to the unified Fact model; the FIRST real
  card to exercise `factsInteract`'s Constraints-shaped event `target`
  branch, plus a real engine gap fixed (self-tap-for-cost had NO achievable
  trace evidence at all for a card whose only tap is its own `{T}` cost).**
  Full writeup in `functional-model/cards/venat-heart-of-hydaelyn-hydaelyn-
  the-mothercrystal/progress.json`; summary here:
  - Was already PARTIALLY migrated (only the front `heros-sundering-target`
    sink, `{to:'Battlefield', types:{not:['Land']}}`, no controller — real,
    unconstrained-target precedent since cited by fate-of-the-sun-cryst's
    own migration today). Everything else (9 more source facts, the front
    cast-legendary sink, the back Blessing-of-Light sink) newly authored;
    the old file's `id`/`sourceText`/`highlight`/bare-`zone` shape fully
    replaced. 10 SOURCE + 3 SINK facts total, all annotated.
  - **New real vocabulary use, not new vocabulary**: front's "Whenever you
    cast a legendary spell, draw a card" is a SINK `{event:'cast',
    controller:'you', target:{types:{has:['Legendary']}}, oncePerTurn:true}`
    — deliberately the GENERIC `event:'cast'` + a `Constraints`-shaped
    `target`, not a bespoke per-variant event name the way the (still-v1,
    unmigrated) `onCastCreatureSpell`→`castCreatureSpell` precedent uses.
    `synergy.ts`'s own `Fact.event`/`factsInteract` doc comments already
    documented this exact `target: Constraints` branch as real, wired
    matcher code — "rare — none of today's cards need it" — until this
    card. New `TRIGGER_EVENT_MAP` entry: `onCastLegendarySpell: 'cast'`.
    Currently 0 real pool matches (no other card's own self-cast fact sets
    `subject`, which this branch needs to resolve a candidate's real
    types) — same "new vocabulary, no producer yet" status `onScry`/
    `onSurveil` had before `matoya-archon-elder`, not a bug.
  - **Real engine fix #1 — `engine-trace.ts`'s `pilotActivate` now logs a
    real `{fn:'tap', ...}` for a `{T}` COST payment.** `engine.ts`'s own
    `activateAbility` pays that cost via a bare `engine.state.tap(permanent)`
    call with genuinely NO log line of its own (`engine.ts` is log-agnostic
    by design, same as `turn.ts`) — confirmed by reading the real code, not
    assumed. Without this, a card whose ONLY tap is its own activation cost
    (Hero's Sundering, `{7}, {T}`, no other tap-shaped effect) has literally
    ZERO achievable trace evidence for a `{event:'tap', subject:'self',
    target:'self'}` fact, no matter how the scenario is written — unlike
    Coeurl's own self-tap-cost fact, which only ever passed by a real
    coincidence (its own ability effect separately, genuinely retargets
    itself due to `chooseTarget`'s pool-order limitation in its own
    scenario). `costRequiresTap`/`activationCostFor` exported from
    `engine.ts` (were private) to support this. Blast radius checked before
    landing: 3 other real pool cards call `pilotActivate` with a
    `{T}`-costed ability (Dion Bahamut's Dominant, Stiltzkin Moogle
    Merchant, Jill Shiva's Dominant) — none flip from passing to failing
    (Dion/Jill already show unrelated stale-trace notes; Stiltzkin's
    synergy.json is still v1-shaped, skipped by `verify-synergy.mjs`
    entirely) — a new unexplained `tap` soft note on those is the same
    accepted side-effect shape the `pump`/`tap` vocabulary promotions
    already established pool-wide, not a fresh regression class.
  - **Real engine fix #2 — Blessing of Light's own back-face effect now
    calls `actions.grantKeyword(target, 'Indestructible')` for real.** The
    machinery (`card.ts`'s own `grantKeywordTarget` Effect kind) already
    existed and was simply never wired up for this card (the old comment
    said "not mechanically enforced," which was true only because nothing
    called it) — needed the SAME chosen target as the counter and the
    conditional draw, which only a `custom` effect's own single
    `chooseTarget` call can guarantee, so this calls `actions.grantKeyword`
    directly rather than adding a separate declarative effect. "Until your
    next turn" (a duration distinct from "until end of turn") still isn't
    tracked — same accepted `state.grantKeyword`/`layers.ts` duration-
    agnostic simplification every other keyword grant in this pool already
    accepts.
  - **Both `custom` effects (Hero's Sundering, Blessing of Light) now
    thread `ctx.preferTarget` through their own `chooseTarget` calls**
    (previously bare `chooseTarget(pool)`, first-candidate-only) — same
    technique weapons-vendor's/summon-primal-garuda's own `custom` effects
    already use. Needed for real: Hero's Sundering's own pool (your own
    nonland permanents first, then opponents') would otherwise always
    self-target the scenario's other real legendary creature (Freya
    Crescent) ahead of the intended opponent target; Blessing of Light's
    own pool had no way to deterministically land on Freya (the only real
    creature satisfying the conditional draw's legendary check) at all.
  - **Deliberately NO baseline self-dies/self-graveyard fact** — matches
    `dion-bahamut-s-dominant-bahamut-warden-of-light`'s own real precedent
    exactly (a similarly-dense, already-migrated DFC with zero self-
    mortality fact either, for the same reason): this scenario is already
    a genuinely dense single continuous playthrough (cast → cast-trigger →
    transform → combat-trigger), and getting real Graveyard-zone trace
    evidence would need a full lethal-combat-death sequence (neither face
    has an `onDies`-named trigger to claim the `DEATH_TRIGGER_NAMES`
    exemption instead) — a real, measured, accepted cost (21 "graveyard
    presence" + 3 "dying" matches lost vs. the old v1 file's own facts),
    not an oversight.
  - **One scenario** (single continuous engine-piloted playthrough, per
    this task's own Dion/Bahamut-consolidation template, successfully
    holding for a front-trigger + front-activated-transform + back-trigger
    card): cast Venat → cast a real second legendary spell (Freya Crescent,
    the same real bystander card `aerith-gainsborough`'s own scenario
    already uses) while Venat is on the battlefield, manually firing
    `onCastLegendarySpell` right after (deliberately NOT off Venat's own
    cast — a permanent's own triggered ability can't trigger off its own
    casting, since the ability doesn't function until the permanent is
    already on the battlefield) → real turn passage clears summoning
    sickness → Hero's Sundering exiles the opponent's real Coeurl and
    transforms Venat into Hydaelyn → a real subsequent beginning of combat
    fires Blessing of Light on Freya Crescent (real counter, real
    Indestructible grant, real conditional draw since Freya is legendary).
    All 13 facts get real, direct trace evidence this way.
  - **Real authoring bug caught and fixed in this same pass, unrelated to
    the fact model itself**: a helper function in this card's own
    `scenarios.ts`, typed to return `TraceResult`, was actually returning
    `[TraceResult]` (an array) — then `runEngineScenarios` wrapped THAT in
    another array, silently producing a doubly-nested `TraceResult[][]` on
    disk (`vite-node` doesn't type-check at transpile time, so this didn't
    surface until `verify-synergy.mjs` crashed reading `t.log` off a list
    instead of an object rather than failing a real check). Fixed by
    making the helper return the bare `TraceResult` directly. Worth
    watching for on any future card copying this same helper-function-plus-
    `[fn()]`-wrapper shape from Dion/Aerith's own scenarios.ts, since
    neither of THEIR scenarios.ts happens to split the pilot script into a
    separate named helper function the way this one did — the bug is
    specific to that extra layer, not the underlying pilot API.
  - **Real, mid-task tooling mistake, self-inflicted, fully accounted for**:
    ran `scripts/run-scenarios.mjs` once without the `--slug=` flag,
    regenerating trace.json for the ENTIRE POOL (~319 files) instead of
    just this card — confirmed via file mtimes, not assumed. Investigated
    before deciding what to do about it rather than reverting blind: the
    shared engine files (`card.ts`, `engine.ts`, `harness.ts`, `state.ts`,
    `tokens.ts`) are ALREADY modified/uncommitted in this working tree from
    concurrent same-day sessions, so a full-pool trace.json regen mostly
    brought stale traces back in sync with current code rather than
    corrupting anything — spot-checked several previously-broken cards
    (Dion, Crystal Fragments, Ashe, G'raha Tia) and confirmed they went
    from real hard failures (stale traces not reflecting their own current
    `definition.ts`/`scenarios.ts`) to clean passes as a direct result.
    Net-positive, but NOT risk-free: did not attempt a blanket revert
    (every affected card's other files are themselves a moving target
    concurrently, so `git checkout --` on trace.json alone risked
    reintroducing staleness against an ALREADY-updated sibling
    `definition.ts` for whichever cards a peer session had mid-edit) — see
    the paladin-s-arms finding below, the one real regression this
    surfaced. Flagging the mistake itself, not just its consequence: use
    `--slug=<slug>` on every future `run-scenarios.mjs` invocation unless a
    genuine full-pool regen is actually intended.
  - **Real, NOT-this-card finding, surfaced only because of the full-pool
    check above**: `paladin-s-arms` currently hard-fails
    (`{zone:Battlefield}` sink, no read evidence) despite its own
    `progress.json` recording a clean pass the same day — its
    `scenarios.ts` still uses the old declarative `Scenario[]` trigger-only
    path (no aggregate battlefield read anywhere in its own trace), and its
    own notes explicitly (and, per this session's direct reading of the
    CURRENT `verify-synergy.mjs` code, incorrectly) claim "a SINK fact
    needs no trace evidence at all" — the actual zone-sink check does
    require an aggregate/typed read. Most likely explanation: that card's
    own author verified against an earlier, laxer version of
    `verify-synergy.mjs` (this file has grown substantially — 880 lines to
    1400+ — from concurrent same-day edits even DURING this task's own
    session) before this check existed or was this strict. Not fixed here
    (not this card, out of lane) — flagged for whichever session owns
    `paladin-s-arms` to re-verify against the current script.
  - **Verification**: `verify-synergy.mjs` scoped (0 hard failures, 12
    expected soft notes: `tapForMana` x11, `transform` x1) and full pool
    (315 checked, 5 skipped, 1 hard failure — `paladin-s-arms`, confirmed
    unrelated, see above). `vitest run functional-model`: 238/238. Real
    `find-synergies.mjs` diff (`git show HEAD:<path>` swap, not a stale
    on-disk diff): -159/+273 lines — losses fully explained by the no-
    self-dies-fact tradeoff above; gains are the same producer set now
    correctly labeled "enters the battlefield" (was "battlefield presence"
    under the old bare-zone shape) plus that same set duplicated again via
    the transform-return fact (same accepted two-producers-one-
    unconstrained-sink duplicate pattern SYNERGY_DESIGN.md's own
    summon-bahamut writeup documents), +1 new "moves to exile" match (The
    Darkness Crystal), and 2 new real self-interaction entries (CR 704.5j
    legend-rule self-match via the transform's own zone fact).
  - **Open Forge-verification**: none needed — real oracle text confirmed
    directly against `data/fin/fin_scryfall.json` (collector_number 39,
    both faces' mana cost/type line/P-T matching `definition.ts` exactly);
    this pass is a fact-model/vocabulary migration plus small, targeted
    engine-tracing fixes, not new engine mechanics.
