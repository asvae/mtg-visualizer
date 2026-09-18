<!-- Raw verbatim chunk of the old engine-agent notes.md (retired 2026-09-18 memory-hub migration). Grep-only archive, not read on spawn. Dates are approximate/best-effort, content is not strictly chronological within a chunk. -->

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

## you-re-not-alone (fin/44) migrated to unified Fact/annotations model (2026-09-12)

Continuation of the fin/1-40 rollout, same day. Real oracle text confirmed
against `data/fin/fin_scryfall.json` (collector_number 44): `{W}` Instant,
"Target creature gets +2/+2 until end of turn. If you control three or
more creatures, it gets +4/+4 until end of turn instead." `definition.ts`
was already correct pre-migration (`pumpTarget` with `Computed<number>`
power/toughness reading `ctx.you.getCreaturesInPlay().length >= 3`) — only
`synergy.json`/`scenarios.ts`/`progress.json` touched.

- **Not a branching modal** — one condition-gated pump amount (two
  magnitudes of the SAME effect), same class as Adelbert Steiner's own
  CDA pump. 1 fact-set, 1 scenario (trimmed from 2 per the 2026-09-12
  "default 1" rule), not a Phoenix-Down-style Choose-one/Tiered.
- 5 facts, all annotated (`ANNOTATED_CARD_SLUGS` grown): self-cast +
  self-graveyard (mirrors fate-of-the-sun-cryst's own Instant pair, no
  presence-only source), real `event:'pump'` SOURCE (targeted, oracle-
  anchored on "gets +2/+2"), `pump-target` SINK (wants a creature, no
  controller — matches Battle Menu's own shape), `three-plus-creatures`
  SINK (`amount:{min:3}`, same paired-sink convention gaelicat/
  magitek-infantry establish for a board-state count condition).
- **Did NOT add a `Fact.untilEndOfTurn` field.** The originating task
  brief claimed one was "added earlier today" — checked `synergy.ts` and
  a fresh re-read of `SYNERGY_DESIGN.md`: no such field exists anywhere,
  and the design doc explicitly, currently states `event:'pump'` is
  deliberately generic with "no attempt to encode amount/duration/
  permanence as sub-fields" (2026-09-11 entry, not superseded by anything
  later in the doc). Followed the actual current, documented convention
  instead (bare `event:'pump'`, no duration field) — same shape every
  other migrated pump fact already uses (Adelbert Steiner, Ambrosia
  Whiteheart, Battle Menu, Auron's Inspiration, Gaelicat). Flagged back
  to the orchestrator rather than silently either inventing the field or
  silently dropping the ask.
- `value`: authored `-1` on every fact, resolved via
  `compute-weights.mjs --slug=you-re-not-alone` → 1 (neutral floor; no
  `event:'pump'` magnitude case in that script yet, matches every other
  pool pump fact today) on 4 facts, 5 on `three-plus-creatures`
  (`amount.min:3` bucketed).
- **Verification**: `verify-synergy.mjs` scoped → OK, 0 hard failures.
  Full pool → 315 checked, 5 skipped, 1 hard failure (`white-auracite`,
  pre-existing/unrelated — briefly also saw a transient
  `isWhiteMagesStaffGrantedAbilityFact is not defined` crash on a
  concurrent run, which cleared on retry: a live race with another
  session mid-editing `white-mage-s-staff`/`ANNOTATED_CARD_SLUGS` in the
  same shared files, not a real bug in this card's own work). `vitest run
  functional-model`: 238/238. `find-synergies.mjs` isolated before/after
  (swap `git show HEAD:<path>` vs the new file, whole-pool run, filtered
  to this card's own lines): 227 → 227 (0 gained/lost) — the only change
  is a real label fix on the 13 real graveyard-presence matches
  (Cantankerous Keepers, Eden Seat of the Sanctum, Elixir, Emet-Selch
  Unsundered, Ignis Scientia, Magic Pot, Qutrub Forayer, Rydia's Return,
  Sorceress's Schemes, Summon: Esper Ramuh, The Emperor of Palamecia,
  Thranduil Sindarin Liege, Vanille Cheerful l'Cie): "moves to graveyard"
  now, not the old, incorrect "graveyard presence" — same
  presence-vs-movement bug class SYNERGY_DESIGN.md already documents
  fixing for Ambrosia Whiteheart/Cloud/Ashe, now also hit and fixed here
  once `self-graveyard` moved from a bare `zone` field to a real `to`
  field. No new `event:'cast'`/`event:'pump'` matches gained (confirmed:
  zero pool sinks want either today, unchanged from SYNERGY_DESIGN.md's
  prior finding).
- **Open Forge-verification**: none needed — real oracle text confirmed
  directly against Scryfall data; this is a fact-model/vocabulary
  migration only, no new engine mechanics touched.

## White Auracite (fin/41) migrated to unified Fact/annotations model (2026-09-12)

Continuation of the fin/1-40 rollout. Real oracle text confirmed against
`data/fin/fin_scryfall.json` (collector_number 41): "When this artifact
enters, exile target nonland permanent an opponent controls until this
artifact leaves the battlefield. / {T}: Add {W}.", manaCost `{2}{W}{W}`,
typeLine `Artifact` — `definition.ts` already matched exactly, no card-data
fix needed.

**4 SOURCE + 1 SINK, all annotated, added to `ANNOTATED_CARD_SLUGS`**:
- `self-cast`/`self-enters`: baseline, `typeLine` annotation (0-8,
  "Artifact"), same shape as sidequest-catch-a-fish's own baseline pair
  (`target:'self'`, no `subject`/`controller`).
- Exile SOURCE: zone-shaped `{to:'Exile', from:'Battlefield',
  controller:'opp', target:{types:{not:['Land']}}, targeted:true}` — direct
  analogy to venat-heart-of-hydaelyn's own identical-shape exile fact (no
  `event:'exile'` tag; a real EFFECT-driven exile is zone-shaped only, the
  bare `event:'exile'` ACT tag is reserved for a COST-driven exile per
  phoenix-down's precedent). `controller:'opp'` on a zone SOURCE fact here
  means "the moved object's own controller," resolved by
  `verify-synergy.mjs`'s `sideOf`/`sideOfName` off the real `moveTo` log
  line's own `controller` field — confirmed by re-running the scoped
  verify after wiring a real engine-piloted trace (see below).
- Mana SOURCE: `{event:'addMana', controller:'you', colors:{has:['W']},
  annotations:[oracle line1, "{W}"]}` — migrated off the legacy singular
  `color:'W'` field this card was one of the 11 real holdouts for
  (`synergy.ts`'s own `color` field doc comment). No SINK needed/added for
  it — exempted from scenario-evidence entirely by
  `verify-synergy.mjs`'s `isStaticOnlyLand`/`staticManaColorsFor` (a plain
  unconditional `"{T}: Add {W}."` static-text ability).
- SINK: `{to:'Battlefield', controller:'opp', types:{not:['Land']}}` — "needs
  an opponent's nonland permanent to target," same shape/reasoning as
  venat's own analogous front-face SINK (that one has no `controller`
  since Venat's own exile has no opponent restriction; this one does).

**Real engine gap confirmed, not modeled (documented, not invented
around)**: the "until this artifact leaves the battlefield" O-ring/
banishment return clause has no tracked linkage anywhere in this engine —
nothing remembers which specific object a given permanent exiled, and
nothing fires a "this leaves the battlefield" consequence to return it.
Checked the rest of the pool before accepting this as a gap: champions-
of-the-perfect, y-shtola-rhul, and zenos-yae-galvus-shinryu-transcendent-
rival all have the identical real "linked exile, returns on leaving"
mechanic and are equally unmodeled/documentary-text-only — a genuine,
pool-wide engine gap, not a one-card oversight. The exile fact's own
annotation is scoped to just "exile target nonland permanent an opponent
controls" (oracle line 0, chars 27-78), not the unmodeled "until this
artifact leaves the battlefield" clause.

**Definition.ts change, not just facts**: added `on: 'enter'` to the
`onEnter` trigger (real 603.6b auto-fire marker, matching weapons-vendor's/
cloud-midgar-mercenary's convention) and threaded `ctx.preferTarget`
through the `custom` effect's `chooseTarget` call. Neither changes the
card's real behavior — both were needed to make the card engine-pilotable
at all (see next paragraph); `chooseTarget`'s own fallback (`pool[0]`) was
already choosing correctly with only one opponent creature in the scenario,
so this is forward-hygiene (same technique venat's own Hero's Sundering
already established), not a bug fix.

**Scenario migrated from a flat `{trigger:'onEnter'}` harness shape to a
real `engine-trace.ts`-piloted playthrough** — the flat shape skips the
cast/enters lifecycle entirely (documented gap, g-raha-tia's own
scenarios.ts header), so the new baseline `self-cast`/`self-enters` facts
had zero real trace evidence under it (first `verify-synergy.mjs` scoped
run hard-failed both). Real FIN filler (Coeurl, {1}{W} 2/2 Cat Beast,
already-established pool-wide filler card) placed on the opponent's
battlefield before casting White Auracite for `{2}{W}{W}` real mana
payment; `pilotResolveTop` auto-fires the real ETB, exiling Coeurl for
real (`fn:'moveTo', zone:'Exile', controller:'opp0'`). Kept to exactly 1
scenario per the 2026-09-12 scenario-count rule — no genuine branching.
The mana ability itself still isn't scenario-exercisable (no
Effect/activationCost wiring for mana production anywhere in this model,
per this card's own pre-existing comment) — noted in the scenario's own
`result` string rather than silently omitted, and needs none per the
`isStaticOnlyLand` exemption above.

**Verification**: `verify-synergy.mjs` scoped: 0 hard failures (4 expected
`tapForMana` soft notes, same as every other engine-piloted cast scenario).
Full pool: 315 checked, 5 skipped, 0 hard failures. `vitest run
functional-model`: 238/238. `tsc --noEmit`: 0 errors. Real
`find-synergies.mjs` diff (`git show HEAD:<path>` swap against the
pre-migration v1 file, not a stale on-disk diff): **0 → 12 lines**, all 12
"White Auracite --[enters the battlefield]--> X" (Ambrosia Whiteheart,
Clash of the Eikons, Dion Bahamut's Dominant, Doppelgang, Formidable
Speaker, Omega Heartless Evolution, Restoration Magic, Sage's Nouliths,
Squall SeeD Mercenary, Stiltzkin Moogle Merchant, Summon: Bahamut, The
Wandering Minstrel) — entirely from the new baseline `self-enters` fact
(the pre-migration file had no baseline self-cast/self-enters facts at
all, same "genuinely 0 before" starting point every other fin/1-40
baseline migration has shown). The exile/mana/self-cast facts contribute 0
new matches — checked, no sink in the pool currently wants
`event:'addMana'` with a W-inclusive color set, an unconstrained/opponent-
nonland-`to:'Exile'` want, or an unconstrained `event:'cast'`/zone-shaped
`from:'Hand'` want that would satisfy self-cast's own zone shape — expected,
not a bug.

**Open Forge-verification**: none needed — real oracle text confirmed
directly against Scryfall; this pass is a fact-model/vocabulary migration
plus two small engine-tracing enablement changes (`on:'enter'`,
`preferTarget` threading), not new engine mechanics.

**Not resolved, flagged for whoever eventually tackles it**: the real
"exile ~ until this leaves the battlefield" linked-return archetype (this
card, champions-of-the-perfect, y-shtola-rhul, zenos-yae-galvus-shinryu-
transcendent-rival) has zero engine support pool-wide. Would need: (1) a
way for an `Effect`/`Actions` call to remember "the specific object THIS
permanent's own effect exiled" (no per-instance linked-state exists
anywhere in `card.ts`/`state.ts` today), and (2) a real "this leaves the
battlefield" trigger hook independent of any NAMED trigger a card
declares (today only named `triggers[]` entries fire, all manually via
`pilotFireTrigger`/scenario `trigger` field — there's no generic
"whenever `self` leaves play, run X" mechanism). Genuinely out of scope
for a facts-migration pass; a real engine feature, not a fact-authoring
gap.

## white-mage-s-staff (fin/42) migrated to unified Fact model (2026-09-12)

Same batch/template as dragoon-s-lance/machinist-s-arsenal/paladin-s-arms
(paladin-s-arms used as the structural template — most recently corrected,
has all 3 clause shapes + the real 1-scenario consolidation fix).
definition.ts needed no changes. 2 legacy facts -> 7 (6 source: cast,
enters, job-select token, pump, granted-ability-lifegain, grantType
Cleric; 1 sink: equip-3 creature-presence). Full reasoning/diff numbers in
`cards/white-mage-s-staff/progress.json`'s own notes — not duplicated
here in full, just the decisions:

- pump (+1/+1) and grantType (Cleric): same documented, genuinely inert
  gap as every sibling Equipment's identical clause shape (no layer-7c
  static-bonus/type-broadcast-to-another-permanent pipeline) — exempted
  via new card-name-scoped checks in verify-synergy.mjs, same pattern.
- **Genuinely new gap class, distinct from pump/grantType**: this card's
  own "...has 'Whenever this creature attacks, you gain 1 life,'..."
  GRANTS A WHOLE NEW TRIGGERED ABILITY (its own trigger condition + its
  own effect) to the equipped creature — not a static bonus/type. Checked
  the full `Effect` union (card.ts) and the whole pool (synergy.ts,
  ENGINE_GAPS.md): no vocabulary/pipeline anywhere grants a NEW triggered
  ability to another permanent (grantKeywordTarget/grantKeywordAll only
  ever grant a KEYWORD). Checked pre-migration sibling Equipment cards
  with an identical granted-ability shape (buster-sword, genji-glove,
  thief-s-knife, ninja-s-blades, astrologian-s-planisphere) for precedent:
  all of them model the granted ability's real CONSEQUENCE (when a real
  Effect kind exists for it, e.g. drawCard) as if it were the Equipment's
  OWN named trigger (`onEquippedDealsDamage`-style, an established
  simplification), but NONE of them have added a real v2 Fact for that
  consequence yet — no existing precedent either way for whether the
  consequence should be modeled executable or left inert once actually
  migrated. Per this task's explicit instruction, did NOT wire a new
  `onEquippedAttacks` trigger + `gainLife` effect into definition.ts even
  though it would be trivial and would reuse an established simplification
  — modeled the fact as a real, honest, deliberately-inert
  `{event:'lifegain', controller:'you', value:1}` (reusing already-
  promoted `lifegain` vocabulary, not inventing a new event name), new
  card-name-scoped `isWhiteMagesStaffGrantedAbilityFact` exemption in
  verify-synergy.mjs. **Open question flagged, not resolved**: should a
  FUTURE granted-triggered-ability migration with a real wired Effect kind
  go executable via the onEquippedX-as-self simplification, or stay
  inert-by-default the way this one did? No v2-migrated precedent exists
  yet to settle it.
- Collapsed scenarios.ts to paladin-s-arms's own corrected 1-scenario
  shape (`trigger:'onEnter'` + `sequence:[{activate:true}]`) — a bare
  `trigger:'onEnter'`-only scenario would skip the sink's required real
  `read:getCreaturesInPlay` evidence (this card's own `activationCost`
  means the no-trigger/no-ability auto-activate path can never coexist
  with real cast/enters evidence either way).
- All checks green: verify-synergy.mjs scoped (OK) + full pool (315
  checked, 0 hard failures). vitest 238/238. find-synergies.mjs isolated
  diff: incoming byte-identical (107/107, zone->to representational-only);
  outgoing 12 -> 59 (+47), fully accounted (12 renamed+doubled to 24 via
  self-enters' own independent unconstrained match, +32 genuinely new
  type-constrained Artifact/Equipment matches via self-enters, +3
  genuinely new via the new (inert) lifegain fact matching real
  lifegain-wanting sinks — Aerith Gainsborough, Excalibur II, Minwu White
  Mage).
- No Forge verification needed — oracle text/mana cost/type line
  confirmed directly against data/fin/fin_scryfall.json (collector_number
  42), pure fact-model migration onto already-correct mechanics.

## combat-tutorial (fin/48) migrated to unified Fact model (2026-09-12)

"Target player draws two cards. Put a +1/+1 counter on up to one target
creature you control." Simple 2-clause sorcery, no branching/modal —
confirmed via SYNERGY_DESIGN.md's own 2026-09-12 "scenario count defaults
to 1" rule that "up to one target" is NOT a Choose-one; collapsed the
pre-existing 2-scenario file (success + "no legal creature, no-op") down
to 1, since the dropped scenario was exactly the same-single-mode no-op
edge case the rule's own magitek-infantry example calls out. 5 facts:
- source self-cast (`{event:'cast', from:'Hand', target:'self'}`,
  typeLine-anchored "Sorcery").
- source self-graveyard (`{to:'Graveyard', controller:'you',
  subject:'self'}`, typeLine-anchored, no `from` — Stack is the
  deliberately-invisible origin, same treatment restoration-magic's own
  identical fact already got).
- source draw-target (`{event:'drawCard', targeted:true}`) — deliberately
  **no `controller`**, per explicit task instruction: real oracle text is
  "target player" (either player), and `controller` on a `drawCard` fact
  means WHO DRAWS (verified via verify-synergy.mjs's own `producedEvents`
  `case 'drawCard'`/`factsInteract`'s `ev.side` comparison — the "doer" and
  "recipient" are the same person for a draw, unlike `damage`'s separate
  `controller`/`recipient`), so omitting it correctly leaves the side
  unconstrained rather than misstating "target player" as you-only. Real
  trace evidence can only ever show `player:'you'` (drawCard's own Effect
  kind has no target-player parameter, card.ts — same class of gap
  stiltzkin-moogle-merchant's own "target opponent" comment already
  documents), which is fine: an omitted `controller` is satisfied by any
  real `side`, so this doesn't fail verify-synergy.mjs, it just can't
  additionally be verified against a hypothetical `player:'opp'` trace this
  engine can't produce. Documented inline in definition.ts.
- source counter-target (`{event:'putCounter', counterType:'+1/+1',
  controller:'you', target:{types:{has:['Creature']}}, targeted:true}`) —
  "up to one target creature you control." Checked house style for
  optional (0-or-1) targeting before writing this: **no separate
  optional/upToOne field exists or is warranted** — confirmed against the
  established summon-bahamut precedent (`destroy-nonland`, "Destroy up to
  one target nonland permanent" → plain `targeted:true`, nothing else) that
  0-or-1 is treated as inherent to real CR 601.2c targeting, not a distinct
  schema concept. (Checked phoenix-down/restoration-magic too per the
  task's own pointer, but neither actually has "up to one" oracle wording —
  bahamut's own fact is the real precedent here.)
- sink wants-creature-target (`{to:'Battlefield', controller:'you',
  types:{has:['Creature']}}`) — needs a legal creature to target for the
  counter half; carried over from the old model, migrated shape only.

annotations-authoring.json added, `compute-annotations.mjs
combat-tutorial` run (5/5 facts annotated), slug added to
`ANNOTATED_CARD_SLUGS` (annotation-coverage.mjs — noted this set is being
actively appended to by other concurrent sessions mid-task; re-read before
editing each time rather than clobbering). `compute-weights.mjs
--slug=combat-tutorial` run — every fact computed to the neutral floor
(value 1; none of these facts carry a numeric `amount` constraint of their
own). `run-scenarios.mjs --slug=combat-tutorial` regenerated trace.json
after the scenario collapse.

Verified: `verify-synergy.mjs combat-tutorial` — OK, 0 hard failures, both
before and after the scenario collapse. Full-pool `verify-synergy.mjs`
fluctuated between runs (2, then 5, hard failures, on a DIFFERENT set of
cards each time — cecil-dark-knight, stiltzkin-moogle-merchant,
the-wind-crystal, white-auracite, zack-fair, dreams-of-laguna) purely from
other concurrent sessions' in-flight edits landing on disk between my own
runs — combat-tutorial was never among them either time; not investigated
further, out of scope. `vitest run functional-model`: 238/238, unchanged.
`find-synergies.mjs` diff, isolated to "Combat Tutorial" lines only (full
unscoped diff is unusable right now — heavy unrelated noise from
concurrent sessions actively editing the shared pool, e.g. a large
Astrologian's Planisphere `battlefield presence` → `enters the
battlefield` rename mid-flight that has nothing to do with this card):
**net zero interactions gained/lost**, 123 matching lines before and after
byte-identical except a pure label rename on the 13 pre-existing
graveyard-presence matches (`graveyard presence` → `moves to graveyard`,
the expected fallout of `self-graveyard` now being a real `to:'Graveyard'`
SOURCE movement fact instead of a legacy bare `zone:'Graveyard'` presence
tag). The new draw-target/counter-target facts add real vocabulary but
create no new pool matches today (no sink wants `event:'drawCard'` yet;
`putCounter` still only matches its 2 pre-existing lines, Aerith
Gainsborough/Zack Fair, unchanged) — confirmed identical again after the
scenario-collapse trace regen, so the scenario change had zero matching
impact, as expected (matching reads synergy.json, not trace.json).

No Forge verification needed — oracle text/mana cost/type line confirmed
directly against data/fin/fin_scryfall.json (collector_number 48), pure
fact-model migration onto already-correct mechanics (drawCard/
putCounterTarget effects were already correct pre-migration, no
definition.ts logic changed).

**Unrelated, noticed but not touched**: `combat-tutorial/trace.json`'s own
`putCounter.id` numeric value drifted (440→437) between session start and
my first read, purely from some other concurrent session's own unscoped
pool-wide `run-scenarios.mjs`/harness re-run shifting the global
per-process instance-id counter — cosmetic, not asserted on anywhere,
superseded anyway by my own later `--slug=combat-tutorial` regen.

## The Wind Crystal (fin/43) migrated to unified Fact model (2026-09-12)

Oracle text confirmed against `data/fin/fin_scryfall.json` collector_number
43: mana cost `{2}{W}{W}` already correct in `definition.ts`, no change
needed there. 3 real clauses, none mutually exclusive (not modal — same
"always-on/available effects" shape as Restoration Magic, per the task
brief, not Phoenix Down's real Choose-one) — **1 scenario**, no branching
warranted:

- **"White spells you cast cost {1} less to cast."** — real, confirmed
  STILL-OPEN cost-reduction gap (ENGINE_GAPS.md gap #7): `canCastSpell`/
  `castSpell` have no discount hook at all, only the unrelated `alt`
  REPLACEMENT param. Added as a SECOND real example under gap #7 alongside
  fate-of-the-sun-cryst's own conditional case — this one's notable for
  being the plainest possible shape (flat, unconditional, color-gated),
  confirming the gap isn't narrowly about target-conditional reductions.
  No fact authored.
- **"If you would gain life, you gain twice that much life instead."** —
  real CR 614.2 replacement effect, and a genuinely NEW, DISTINCT gap, not
  a restatement of gap #8 (damage-prevention shields): checked
  `state.ts`'s `wrapPlayer().gainLife` — bare `real.life += amount`, zero
  interception point of any kind. Grepped the whole `functional-model/*.ts`
  tree for "replacement" — confirmed the only real hits are the two
  already-closed narrow per-object cases (STUN untap-replacement, FINALITY
  move-redirect) and gap #8's own damage discussion; nothing for lifegain.
  Added as new **gap #8b** in ENGINE_GAPS.md (same "narrow chokepoint hook,
  not full 614" shape gap #8 already establishes as the right eventual
  fix). No fact authored.
- **"{4}{W}{W}, {T}: Creatures you control gain flying and lifelink until
  end of turn."** — the one clause that's genuinely, mechanically real.
  `definition.ts`'s old comment ("no Effect kind grants a keyword
  anywhere in this model") was STALE — `grantKeywordAll` (predicate:
  'creatures-you-control') already exists and is real (Ardyn/Circle of
  Power/Moogles' Valor precedent), so replaced the no-op `custom` with two
  real `grantKeywordAll` calls, one per keyword (no Effect kind grants more
  than one keyword at once — confirmed via restoration-magic's own
  Cure/Cura/Curaga precedent, same "one call per keyword" convention).
  Verified for real: `run-scenarios.mjs` trace shows genuine `fn:
  'grantKeyword'` lines for both keywords against both of 2 real Grizzly
  Bears.

New engine vocabulary added this pass, both real, non-speculative:
- **`Fact.untilEndOfTurn?: boolean`** (synergy.ts) — documentary-only
  duration flag (same "only ever written `true`, never `false`" convention
  as `targeted`), distinguishing a temporary CR 611/702 grant from a
  permanent/always-on one (Ardyn's own `continuousKeywordGrants`-backed
  grant vs. this card's own real "until end of turn" text) — previously
  had NO way to say this in the data at all. Grepped the whole pool first:
  several existing `grantKeyword`/`pump` facts (Craterhoof Behemoth, Coral
  Sword, Restoration Magic's 3 modes, Summon Titan, Blitzball Shot,
  Squall/Seifer's combat tricks, Moogles' Valor, Circle of Power) are
  genuinely until-end-of-turn on their own real text but don't set this
  field yet — a real pool-wide authoring sweep, explicitly out of scope
  for this task (scoped to fin/43 only). **Observed live, mid-task, that a
  concurrent process/session was already retrofitting this exact field
  onto restoration-magic and moogles-valor's own synergy.json while this
  task was in flight** — not something I did, not reverted, just noted:
  confirms the field generalizes as expected and that the "out of scope"
  sweep I flagged is apparently already underway elsewhere.
- Two new ENGINE_GAPS.md entries: gap #7's second example (above) and new
  gap **#8b** (above) — both real, cited, non-duplicative of existing
  content.

Facts: 2 old fabricated/non-text-anchored placeholders (`self-graveyard`,
`self-dies` — "any nonland permanent that dies goes to its owner's
graveyard," no real printed basis) removed, replaced with 6 real annotated
facts (5 source: self-cast/self-enters baseline typeLine-anchored on
"Artifact" — same span for both, matching magitek-armor/weapons-vendor
precedent, not Bahamut's Creature-narrowing since this card is a
non-creature permanent; self-tap cost `{event:'tap', subject:'self',
target:'self'}` anchored on "{T}"; 2 grantKeyword facts, Flying/Lifelink,
each anchored on just that keyword word — narrow per-keyword annotation,
matching restoration-magic's own precedent, not the whole clause — both
`controller:'you', target:{types:{has:['Creature']}}, targeted:false,
untilEndOfTurn:true`; 1 sink: `{to:'Battlefield', controller:'you',
types:{has:['Creature']}}` anchored on "Creatures you control" — REQUIRED,
not optional: `grantKeywordAll`'s own real `getCreaturesInPlay()` read is a
genuine aggregate Battlefield read verify-synergy.mjs's reverse check
demands a matching declared want for; first pass left `sink: []` on the
auron-s-inspiration-precedent reasoning "broadcast works with zero
creatures" and that was WRONG here specifically because THIS card's grant
has real execution that actually performs the read (Auron's Inspiration
has zero trace evidence of any kind, genuinely different case) — caught by
running verify-synergy.mjs, not by inspection).

Added `the-wind-crystal` to `ANNOTATED_CARD_SLUGS`
(scripts/annotation-coverage.mjs). Kept the pre-existing
`...keywordScenarios(theWindCrystal)` scenario spread (auto-adds a
"Legend rule: a second copy enters" probe since this card is Legendary) —
produces one pre-existing, harmless, non-hard-failure soft note in
verify-synergy.mjs ("trace has legendRule ... with no matching declared
produce"), confirmed NOT specific to this migration by checking
minwu-white-mage (another annotated Legendary card with the same
keywordScenarios spread) shows the identical soft note.

Verified: `verify-synergy.mjs` scoped (0 hard failures, 1 pre-existing
soft note re: legendRule) + full pool (315 checked, 5 skipped, 1 hard
failure — `astrologian-s-planisphere`, pre-existing/unrelated, not
touched by this task, likely a concurrent-session artifact given the
`untilEndOfTurn` cross-editing observed above). `vitest run
functional-model`: 238/238, including
`annotation-coverage.test.ts`'s real pool-wide check. `find-synergies.mjs`
isolated diff (swapped only `the-wind-crystal/synergy.json` between
before/after runs, left every other file — including the concurrently-
changing ones — untouched in both runs): **-20 / +144, net +124 lines**,
fully accounted: the 20 lost lines are exactly the two removed
placeholder facts' own real matches (17 real type-constrained Graveyard
presence + 3 real `dies`-shaped EventFact matches); the 144 gained lines
are ALL real "battlefield presence"/"enters the battlefield"/"moves to
battlefield" edges from creature-producing cards into the new sink — the
direct, correct, expected consequence of authoring a real
Battlefield-creature-presence want that didn't exist on this card at all
before. No `grantKeyword`-shaped matches gained/lost (confirmed: no sink
in the pool wants `event:'grantKeyword'` yet, same as every other
grantKeyword producer in the pool).

No Forge verification still needed for this card — every mechanical claim
(grantKeywordAll's real execution, gainLife's lack of a replacement hook,
canCastSpell's lack of a discount hook) was checked directly against this
engine's own source, not against Forge behavior; the two documented gaps
are about THIS engine's own missing machinery, not a question of what real
Forge does (already well-established: `SVar:...ReduceCost`/`Mode$
ReplaceEffect`-style CR 118.9/614.2 mechanics respectively).

## Astrologian's Planisphere (fin/46) — unified Fact model migration (2026-09-12)

Dispatch's own paraphrase was wrong — double-checked against
`data/fin/fin_scryfall.json` #46 first, per its own instruction. "Job
select" is NOT a modal ETB choice ("choose Wizard or Time Mage" never
appears on the real card) — it's reminder text for the same deterministic
ETB mechanic every other Job-select Equipment in FIN has: "create a 1/1
colorless Hero creature token, then attach this to it." Confirmed by
grepping all 16 real "Job select" cards in the set (dragoon-s-lance,
paladin-s-arms, machinist-s-arsenal, white-mage-s-staff, black-mages-rod,
etc.) — identical reminder text on every one. Real oracle: type grant
("is a Wizard in addition to its other types") + a granted NEW triggered
ability ("has 'Whenever you cast a noncreature spell and whenever you draw
your third card each turn, put a +1/+1 counter on this creature.'") +
"Diana — Equip {2}" (a flavor name on a plain Equip ability, same shape as
Dragoon's Lance's "Gae Bolg — Equip {4}").

**Real mismodel found and fixed, not just a schema migration.** The
pre-existing (v1-schema) draft engine-modeled the granted counter ability
as two fabricated triggers on the EQUIPMENT itself
(`onEquippedCastsNoncreatureSpell`/`onEquippedDrawsThirdCardThisTurn`,
`putCounter target:'self'`) — that puts the counter on the Equipment
permanent, not the equipped creature the real text's "this creature"
means. Checked white-mage-s-staff's own sibling grant ("Whenever this
creature attacks, you gain 1 life") first, per the dispatch's rule 4:
already hit the identical gap and has an established, more recent, more
scrutinized precedent (`scripts/verify-synergy.mjs`'s own
`isWhiteMagesStaffGrantedAbilityFact` doc comment) — no `Effect` kind or
`Actions` member anywhere in this model grants a WHOLE NEW triggered
ability to another permanent (only `continuousKeywordGrants`'s
`equippedBySelf` mode, and that's keyword-only). Ninja's Blades'
`onEquippedDealsDamage` (an OLDER, unmigrated v1-schema card, `synergy.json`
`source: []` — checked, it declares zero facts despite having a real
engine trigger, so it's not actually exercised by anything today) looks
like a competing precedent for engine-modeling a granted trigger, but it
predates White Mage's Staff's own explicit, reasoned rejection of that
approach and isn't itself part of the migrated (v2/unified-Fact) pool — not
followed.

Removed the fabricated triggers/scenarios entirely (not just left as inert
dead code) and replaced with an honest, oracle-anchored SOURCE fact:
`{event:'putCounter', counterType:'+1/+1', target:{equippedBySelf:true},
value:-1}` (target `equippedBySelf`, not `'self'` — corrects the real
mismodel; `equippedBySelf` is real, established `Constraints` vocabulary,
same "usable in continuous-grant target mode" shape Dragoon's Lance's own
flying grant and this card's own `grantType` fact both already use). Added
a new exemption to `verify-synergy.mjs`, **generalized by SHAPE** rather
than by card name (`isEquipGrantedPutCounterFact`, matches any
`event:'putCounter'` fact targeting `{equippedBySelf:true}`) — this is the
SECOND real card (after White Mage's Staff) to hit this exact gap with
this exact target shape, same "generalize on the second real instance"
call `isEquippedKeywordGrantFact` already made for the analogous
keyword-grant case. Also added the by-name `grantType` exemption line for
this card (matching Dragoon's Lance/Machinist's Arsenal/Paladin's
Arms/White Mage's Staff's own identical, still name-scoped exemptions —
`grantType` itself wasn't generalized, only this card's `putCounter` gap).

Full fact list (5 source: self-cast, self-enters, Hero-token-ETB,
`grantType:'Wizard'`, the `putCounter` grant above; 1 sink: the standard
"Equipment wants a creature you control" fact every migrated Equipment in
the pool gets). Annotations verified against real character offsets
computed from the scryfall oracle text, not eyeballed. Did NOT run
`compute-weights.mjs` — left `-1` placeholders on every fact with no real
trace magnitude, same as every sibling Job-select Equipment
(dragoon-s-lance/machinist-s-arsenal/paladin-s-arms/white-mage-s-staff)
already has on disk today; the Hero-token-ETB fact's real trace-backed
value (1) was already correct pre-migration and left as-is.

Verified: `verify-synergy.mjs` scoped → 0 hard failures. Full pool → the
hard-failure set (cecil-dark-knight, stiltzkin-moogle-merchant,
the-wind-crystal, white-auracite, and a shifting few more —
cargo-ship/zack-fair/dragoon-s-wyvern appearing/disappearing across
consecutive runs) is pure concurrent-session flux, confirmed via
`git status` showing none of those files touched by this task.
`vitest run functional-model`: 238/238 both before and after. `find-
synergies.mjs` diff (scoped stash/pop of just this card's own 4 files,
`git stash push -- <4 paths>` / pop, isolating the diff from concurrent
edits elsewhere in the pool): **-12 / +46 real interaction lines** for
this card specifically — lost the old draft's 12 generic "battlefield
presence" matches (a side effect of the v1 schema's bare-zone-only shape),
replaced by 44 real "enters the battlefield" event-shaped matches
(superset of the same 12 cards plus many more that specifically want
`event:'entersBattlefield'`, unlocked by the new baseline self-cast/
self-enters facts rule 1 requires) plus 2 new "counters" matches (Aerith
Gainsborough, Zack Fair — real `putCounter`-shaped sinks, matched on fact
data alone regardless of the fact's own trace-evidence exemption). Sink
side (the Equipment-wants-a-creature fact) unchanged, 0 diff — its shape
didn't change across the migration.

No Forge verification still needed — every claim checked directly against
this engine's own `card.ts`/`state.ts` source (no `Effect`/`Actions`
member grants a new triggered ability to another permanent) and against
the real scryfall oracle text, not against Forge script vocabulary.

## Dreams of Laguna (fin/50) migrated to v2 Fact model (2026-09-12)

Real oracle text: "Surveil 1, then draw a card. / Flashback {3}{U} (You may
cast this card from your graveyard for its flashback cost. Then exile
it.)", Instant, {1}{U}. 6 source facts, sink stays empty (unchanged — no
real "wants" on this card): the same 4-fact Flashback baseline
from-father-to-son (fin/20, migrated earlier the same day) established —
self-cast (Hand, typeLine-anchored) + self-to-Graveyard (608.2m,
typeLine-anchored) + self-cast via Flashback (Graveyard, oracle-anchored to
the reminder text) + self-to-Exile (thenExile, oracle-anchored) — mirrored
exactly, including which exact reminder-text substrings get anchored
(verified byte-identical via a real `compute-annotations.mjs` regen against
hand-computed indices). Plus 2 new card-specific facts:
`{event:'surveil', controller:'you', value:1}` and `{event:'drawCard',
controller:'you', value:1}`, both oracle-anchored to their own real clause.

**Real surveil precedent check, then a real "parked -> real" promotion.**
Grepped the whole pool first per the dispatch's own instruction: `surveil`
was already real, matched vocabulary as a SINK want on one old v1-shaped
card (`matoya-archon-elder`'s own `{event:'surveil', controller:'you',
value:1}`), and a real, wired `kind:'surveil'` Effect existed on ~10 more
v1 cards with no fact at all yet — but `verify-synergy.mjs`'s own
`PARKED_ACTION_FNS` still had `surveil` parked (no `producedEvents` case),
even though the underlying machinery (`actions.surveil`, `state.ts`,
`harness.ts`'s own real `{fn:'surveil', player, qty}` log line) was fully
real and already wired. Pure Fact-vocabulary gap, not an engine gap — same
shape every earlier "parked -> real" promotion this project has already
done (`drawCard`/`addMana`/`pump`/`tap`/`animate`/`gainControl`, all
documented in SYNERGY_DESIGN.md). Promoted it: removed `'surveil'` from
`PARKED_ACTION_FNS`, added `producedEvents`'s own `case 'surveil'` (reads
the real trace line, same `entry.player`-based side derivation `drawCard`
already uses; `qty` deliberately not compared — no fact needs to
distinguish "surveil 1" from "surveil 2" for matching, same generic-
catch-all scope `pump`'s own promotion established), added `'surveil'` to
`explainableFns`. Checked the blast radius before committing to this:
every other real pool card with an existing `fn:'surveil'` trace line and
no declared fact (garland-knight-of-cornelia, esper-origins-summon-esper-
maduin, golbez-crystal-collector, namazu-trader, ultimecia-time-sorceress,
lunatic-pandora — all still v1/unmigrated) now surfaces a new, purely
additive SOFT note instead of staying silently parked — the same accepted,
documented, note-not-fail side effect every prior promotion already caused
pool-wide; 0 new hard failures anywhere.

**Scenarios: converted to a single engine-piloted playthrough**, per the
dispatch's own explicit instruction to mirror from-father-to-son's (fin/20)
own real consolidation precedent — cast from hand, resolve for real
(surveil + draw + real move to Graveyard), THEN cast the SAME real card
instance again from that graveyard via Flashback, resolve again (surveil +
draw + real exile), rather than 2 separate scenarios (the old plain
`harness.ts` `Scenario[]` pair this card had before). Real Islands for both
combined costs ({1}{U}+{3}{U}={4}{U}{U}, no land reuse needed between the
two payments); `libraryCount: 3` (one real draw during pilot setup + one
real draw per resolution — no named/typed library card needed, this card's
effect never searches for anything specific).

**Process note, not specific to this card**: an early mistake running
`run-scenarios.mjs`/`verify-synergy.mjs` with no slug filter (this repo's
`--slug=` convention isn't universal — some scripts want a bare positional
slug arg instead, `run-scenarios.mjs`/`verify-synergy.mjs` among them)
regenerated the WHOLE POOL's `trace.json` (188 files) — caught via `git
status` before it went anywhere, reverted every file except this card's own
via `git checkout --`, then re-ran correctly scoped
(`node ... run-scenarios.mjs --slug=dreams-of-laguna` IS correct for that
one script; plain positional slugs for the other two). Worth remembering:
check a script's own arg-parsing convention (`process.argv` handling)
before assuming `--slug=` works everywhere in this pool's script set.

**Confirmed real concurrent multi-session editing during this task** (same
phenomenon the Astrologian's Planisphere entry just above independently
hit) — full-pool `verify-synergy.mjs`/`vitest` numbers visibly moved
between consecutive identical invocations; `git status` mid-task showed
~40 other cards' files and `functional-model/scripts/verify-synergy.mjs`/
`annotation-coverage.mjs` themselves under active edit by another live
session (that session's own `isWhiteMagesStaffGrantedAbilityFact`/
`isEquipGrantedPutCounterFact`/`isSelfSacrificeActivationCostFact`/
Astrologian's Planisphere exemptions landed in the SAME file interleaved
with this task's own `case 'surveil'`/`PARKED_ACTION_FNS`/`explainableFns`
edits — confirmed no conflict, both sets of hunks are independent and
additive). Isolated this card's own real diff by `git stash push --` of
just its own `synergy.json` around the `find-synergies.mjs` run (holding
the rest of the concurrently-shifting pool constant across both runs)
rather than trusting a pool-wide before/after snapshot.

**`find-synergies.mjs` diff** (isolated via stash/pop of just this card's
own `synergy.json`): the pre-existing 13 real graveyard-presence matches
(Cantankerous Keepers, Eden Seat of the Sanctum, Elixir, Emet-Selch
Unsundered, Ignis Scientia, Magic Pot, Qutrub Forayer, Rydia's Return,
Sorceress's Schemes, Summon: Esper Ramuh, The Emperor of Palamecia,
Thranduil Sindarin Liege, Vanille Cheerful l'Cie) are unchanged in COUNT,
only their rendered label changes from "graveyard presence" to "moves to
graveyard" (expected — a SOURCE fact is a movement, not presence, same
rename from-father-to-son's own migration already went through, not a
regression). ONE genuinely NEW real match: `Dreams of Laguna
--[surveil]--> Matoya, Archon Elder` — the real surveil-fact promotion
above making a real, pre-existing want matchable for the first time.

Verified: `verify-synergy.mjs` scoped (`dreams-of-laguna`) → 0 hard
failures (only the same accepted `tapForMana` soft notes every
engine-piloted Flashback card gets). `vitest run functional-model`:
238/238. Added `'dreams-of-laguna'` to `scripts/annotation-coverage.mjs`'s
`ANNOTATED_CARD_SLUGS`.

No Forge verification still needed — Surveil/Flashback are both real,
well-established keyword mechanics already fully wired in this engine
(`interfaces.ts`'s own `surveil` declaration, `card.ts`'s
`alternateCosts`), and this card introduces no new engine machinery, only
new Fact-vocabulary (the `surveil` promotion above) backed by
already-existing, already-cited execution.

## Cargo Ship (fin/47) migrated to unified Fact model (2026-09-12)

Full migration: 5 source facts (self-cast, self-enters, restricted-mana
`addMana` colors:{has:['C']}, `crew`, `grantType:'Creature'`
untilEndOfTurn) + 1 sink (standard Vehicle "wants a creature you control
to crew" — same shape magitek-armor/the-lunar-whale/the-prima-vista
already have). Flying/Vigilance are bare printed keywords, get NO fact
(2026-09-12 standing rule; neither is the carved-out Lifelink exception —
not self-only-and-event-producing).

**Restricted mana ability, real precedent-setting case.** Checked the FIN
pool first: only 2 other real restricted-mana abilities exist (Freya
Crescent/fin-138 "spend only on Equipment", The Emperor of
Palamecia/fin-219 "spend only on noncreature spells") and NEITHER is
migrated/modeled at all — no prior precedent to follow. Modeled Cargo
Ship's own restricted ability as a REAL, executable named ability
(`CardDefinition.abilities`, not `staticAbilities` text) — `{name:'mana',
cost:'{T}', effects:[{kind:'addMana', color:'C', amount:1}]}` — piloted
for real via `scenario.ability:'mana'`, producing genuine `fn:'addMana'`
trace evidence, no static exemption needed (contrast The Gold Saucer's own
unrestricted `{T}: Add {C}.`, which has no Effect at all and relies on a
static exemption). The RESTRICTION itself stays unmodeled/undocumented-as-
a-fact — real, honest gap: no spendable mana pool exists anywhere in this
engine (interfaces.ts's `Player.addMana` doc comment), so nothing could
constrain what produced mana is later spent on. Confirmed `mana.ts`'s
`manaAbilityColorFromStaticText`/`manaAbilityColorsFromStaticText` both
already, deliberately exclude any "spend only"-restricted static-ability
text — correctly means this card is never auto-recognized as a payable
source for another spell's cost.

**New real ENGINE_GAPS.md finding (Lower priority #11, Crew N sub-entry),
NOT fixed this pass**: `engine.ts`'s `canActivateAbility`/`activateAbility`
branch on `card.crewCost !== undefined` UNCONDITIONALLY, before even
checking `abilityName` — so a Vehicle with BOTH `crewCost` AND a separate
named ability (`card.abilities`) would have ANY activation attempt,
including one explicitly naming the other ability, incorrectly routed
through the crew-cost legality/payment path if piloted through `engine.ts`'s
real engine. Cargo Ship is the first real pool card with this exact shape
(crew + a second independent ability) — the other 4 `crewCost` Vehicles
have no second ability to collide with. Does NOT affect this card's own
`harness.ts` flat-scenario trace (calls `resolveCard` directly, never
consults `crewCost`) — only matters for a hypothetical future
`runEngineScenarios`-piloted version of this or a similar card.

**New real synergy.ts matcher gap surfaced (pre-existing, not introduced
here, NOT fixed)**: `factsInteract`'s event-to-event branch never checks a
want's own `types` constraint at all (only `event`/`counterType`/`colors`/
`tapped`/`target` are compared — see synergy.ts's `factsInteract`,
~line 1486-1515). Ultima, Origin of Oblivion's own `addMana` sink declares
`types:{has:['Land']}` (its blight-counter effect only makes LANDS tap for
{C}), but this constraint is silently ignored — so Cargo Ship's Artifact-
sourced `addMana` fact matches it anyway (a real, incorrect
`find-synergies.mjs` line: "Cargo Ship --[mana production]--> Ultima,
Origin of Oblivion"). Would already misfire against any other real
addMana-C producer regardless of type — flagged for the parent
session/orchestrator, not fixed (a matcher change is pool-wide, out of
scope for a single-card migration task).

Verified: `verify-synergy.mjs` cargo-ship → OK, 0 hard failures (both
scoped and full-pool runs; full-pool's 4 hard failures — cecil-dark-
knight-cecil-redeemed-paladin, stiltzkin-moogle-merchant, white-auracite,
zack-fair — confirmed pre-existing/concurrent-session work via `git
status`, not touched by this task). `vitest run functional-model`:
238/238. `find-synergies.mjs` diff (before = old v1 bare-presence-shaped
SOURCE fact, a real violation of the "no presence in sources" rule,
correctly removed; after = this migration): before 35 lines (all
illegitimate "Cargo Ship --[battlefield presence]-->X"); after 145 lines
(108 real "X --[battlefield presence]--> Cargo Ship" via the new crew
sink matching every unconstrained creature-presence producer in the pool,
~35 real "enters the battlefield"/"moves to battlefield (from ...)"
matches via self-cast/self-enters, 1 "mana production" match against
Ultima — the matcher gap above). Net shape matches magitek-armor's own
12→152 precedent closely. Did not run `compute-weights.mjs` — left `-1`
placeholders on every fact, same convention most recently-migrated cards
use.

Open Forge-verification: none needed for this card — every claim checked
directly against this engine's own `card.ts`/`mana.ts`/`engine.ts` source
and the real Scryfall oracle text (`data/fin/fin_scryfall.json` #47), not
against Forge script vocabulary (no new Forge-cited interfaces.ts mirror

## Zack Fair (fin/45) migrated to the unified Fact model (2026-09-12)

Real oracle (Scryfall-verified, `data/fin/fin_scryfall.json` #45): "Zack
Fair enters with a +1/+1 counter on it. / {1}, Sacrifice Zack Fair: Target
creature you control gains indestructible until end of turn. Put Zack
Fair's counters on that creature and attach an Equipment that was attached
to Zack Fair to that creature." {W} Legendary Creature — Human Soldier,
0/1. Old synergy.json (id/sourceText/highlight schema, no baseline
self-cast/self-enters) had a real BUG worth flagging on its own: its
self-sacrifice was modeled as a `{zone:'Graveyard', controller:'you',
subject:'self'}` ZoneFact — a bare presence claim asserting a real,
guaranteed movement that (a) violates the "SOURCE zone facts must be a
real transition, not presence" rule this session's own design doc already
states, and (b) doesn't even actually happen: this engine never executes
Zack Fair's self-sacrifice at all (see the engine gap below). Removed
outright, replaced with a bare ACT tag, same shape summon-bahamut's own
`self-sacrifice` fact already uses.

**Real, general, pre-existing engine gap this migration surfaced (not
introduced, not fixed — documented and worked around)**: `engine.ts`'s own
`unsupportedCostComponent` only recognizes "Sacrifice another/a/two X" as
a payable cost component — a NAMED self-sacrifice ("Sacrifice Zack Fair")
is never recognized, so `canActivateAbility`/`activateAbility` always
reject this exact ability through the real engine. That same function's
doc comment already explains why this can't be fixed by modeling the
sacrifice as a real `{kind:'sacrifice'}` effect the way ahriman/
phantom-train/quina-qu-gourmet pay their own "Sacrifice another/a X"
costs: Zack Fair's own effect reads ITS OWN live counters/attached
Equipment, which only stays correct today because the sacrifice never
actually removes it from the battlefield first — genuinely sacrificing it
would need real 608.2h last-known-information tracking (a real, separate,
unbuilt gap) to keep this card correct. Added a new, GENERALIZED (not
per-card, matching the {T}/exile-this-artifact siblings' own precedent)
`isSelfSacrificeActivationCostFact` exemption to verify-synergy.mjs.

**Counter "transfer" — confirmed no counter-move primitive exists
anywhere in this engine** (`state.ts`'s own `putCounter` is purely
additive) — "Put Zack Fair's counters on that creature" is modeled as a
real read of Zack Fair's own live count (`ctx.self.getCounters`)
immediately followed by a real `putCounter` onto the target, the correct
mechanism actually available, not an approximation of a nonexistent one.
This is real, CR 121.3-correct behavior too: counters literally cease to
exist once their object leaves the battlefield, so "counters landing on
the target" was never a literal MOVE to begin with, even in real Magic.

**"Enters with a +1/+1 counter" — confirmed no distinct replacement-effect
mechanism exists** (checked `state.ts`'s `addCard`/`move` for an
"arrives pre-loaded with counters" hook — none exists; every other pool
card with this exact printed pattern, torgal-a-fine-hound/summon-fenrir
included, models it as a named trigger calling `putCounter`/
`putCounterTarget` too). Kept Zack Fair's own pre-existing modeling
(named `onEnter` trigger + `putCounter`), just added `on:'enter'` (real
603.6b auto-fire — was missing, same fix weapons-vendor's own migration
needed) so an engine-piloted `pilotResolveTop` fires it for real.

**Equipment re-attachment is REAL, executable code now — but deliberately
gets no new Fact.** `ctx.self.getEquippedBy()` + `actions.equip` genuinely
execute the conditional re-attachment (produces a real `fn:'equip'` trace
line). The card's own OLD comment claiming "no reverse attached-Equipment
lookup exists on the Card interface" was STALE — `state.ts`'s own
`attachedToId`-scan (`getEquippedBy`, `interfaces.ts` line ~110) was added
to this engine sometime after that comment was written and does expose
exactly this. Despite being real, this got NO synergy Fact: checked real
pool precedent FIRST (Weapons Vendor, Beatrix Loyal General, Raubahn Bull
of Ala Mhigo all call `actions.equip` for real via a `custom` effect and
NONE of them declares an `event:'equip'` produce fact — `equip` is still
in verify-synergy.mjs's own `PARKED_ACTION_FNS`, silently skipped by the
reverse "explain every action" check). Adding one fact here would break an
already-established, considered, same-day 3-card pool convention for a
4th card, not close a real gap — documented explicitly rather than
fabricated against precedent.

**`Fact.untilEndOfTurn`** (used on the new `grantKeyword` Indestructible
fact) is NOT new vocabulary added by this task — it already existed,
added earlier the same day (`the-wind-crystal`/fin-43, swept onto
moogles-valor/restoration-magic/etc.) — just the first time this specific
card applied it.

**Final 8 facts** (was 5, old schema): self-cast, self-enters (both new
baselines, typeLine-anchored), the ETB `putCounter` (unchanged shape, now
`on:'enter'`), self-sacrifice (bare ACT tag, replaces the old buggy
ZoneFact), `grantKeyword` Indestructible (`targeted:true,
untilEndOfTurn:true`), a real counter-transfer `putCounter` onto the
target. Sinks: `wants-own-counters` (X = counters already on self) and
ONE shared "creature you control on the battlefield" want — deliberately
NOT three separate sinks per consequence, since the real oracle text
targets ONE creature ONCE for all three effects, not three independent
choices (checked against Aerith's own "one trigger decomposes into
several independent wants" precedent and confirmed this card's own shape
is genuinely different — one atomic choice, not decomposable).

**Scenario**: consolidated the old 4 flat-harness scenarios (ETB,
sacrifice-with-target, "no other creature" edge case, duplicate-legendary
edge case) into ONE real engine-piloted playthrough (`engine-trace.ts`):
cast → real ETB auto-fires → real board-state filler (Grizzly Bears via
harness.ts's own shared `GENERIC_FILLER_CREATURE`, a real FIN Equipment —
Buster Sword, Zack's own iconic weapon in the source material — already
attached to Zack Fair via the same manual `state.equip` +
hand-pushed-`fn:'equip'`-log-line technique adelbert-steiner's own
scenario already established) → the sacrifice ability fires DIRECTLY via
`resolveCard` (bypassing `pilotActivate`/`canActivateAbility` — the real
cost is never legally payable through this engine at all, see the engine
gap above), demonstrating all 3 real consequences on the SAME real target
in one shared `custom` effect. Dropped both edge-case scenarios per this
session's "basic function only" rule.

Verified: `verify-synergy.mjs` zack-fair → 0 hard failures (1 pre-existing,
expected soft note: `tapForMana` — every engine-piloted card paying real
mana gets this, confirmed against weapons-vendor's own identical note).
Full pool → 315 checked, 3 hard failures (cecil-dark-knight-cecil-
redeemed-paladin, stiltzkin-moogle-merchant, white-auracite) — confirmed
pre-existing/concurrent-session work, NOT zack-fair, NOT touched by this
task. `vitest run functional-model`: 238/238 unchanged. `tsc --noEmit`
(functional-model/tsconfig.json): 46 pre-existing baseline errors,
unchanged, none touching zack-fair. `compute-annotations.mjs zack-fair`:
8/8 facts annotated. `compute-weights.mjs --slug=zack-fair`: resolved all
`-1` placeholders to real computed values (all `1` — every effect here is
single-instance magnitude, correctly bucketed).

**Real `find-synergies.mjs` diff** (full pool, before = old schema,
verified via `git show HEAD:...` swapped in temporarily then restored —
not a stale/guessed diff): **net +115 lines for Zack Fair, zero collateral
change anywhere else in the pool** (confirmed: every non-Zack-Fair diff
line count is 0). **Lost** (21 lines): every "Zack Fair --[graveyard
presence]--> X" match — correctly gone, since the old fact was a real bug
(see above), not a functional regression. **Gained** (115 lines): 114 real
"Zack Fair --[enters the battlefield]--> X" matches (the new baseline
`self-enters` fact matching every real Battlefield-presence sink pool-wide
for the first time — this card had NO baseline facts before) plus one new
self-interaction (`second-copy-legendary`, correctly newly detected now
that a real self-enters fact exists to trigger it). Same shape as
weapons-vendor's/Ultima's own baseline-fact-addition diffs earlier today —
not spurious, fully explained.

Open Forge-verification: none needed — every claim checked directly
against this engine's own `card.ts`/`state.ts`/`engine.ts`/`interfaces.ts`
source and the real Scryfall oracle text, not against Forge script
vocabulary (no new Forge-cited interfaces.ts mirror added this pass —
`getEquippedBy`/`equip`/`grantKeyword` all already existed with their own
real Forge citations).
was added this pass).

- **2026-09-12 — Eject (fin/52) migrated to the unified Fact model.**
  Instant, `{3}{U}`, "This spell can't be countered. / Return target
  nonland permanent to its owner's hand. / Draw a card." Baseline
  self-cast(Hand)/self-graveyard (no self-enters — Instant), real targeted
  bounce `{to:'Hand',from:'Battlefield',target:{types:{not:['Land']}},
  targeted:true}` (reuses the existing `{from:'Battlefield',to:'Hand',
  name:'bounce'}` `ZONE_MOVEMENT_NAMES` entry — no new vocabulary needed),
  real `{event:'drawCard',controller:'you'}`, and a matching sink
  `{to:'Battlefield',types:{not:['Land']}}` (no `controller` — the real
  text has no owner restriction, "target nonland permanent" full stop,
  matching the same unrestricted-target shape venat-heart-of-hydaelyn's/
  white-auracite's own `target:{types:{not:['Land']}}` exile facts already
  established as precedent for this exact "any player's nonland
  permanent" case).
  - **"This spell can't be countered" gets NO fact at all** — confirmed via
    the `fate-of-the-sun-cryst` precedent (a cost-reduction static-text
    rule already gets no fact, same `staticAbilities`-only treatment) and
    a full pool grep (zero existing facts anywhere reference countering).
    It's a bare CantHappen-style replacement rule (Forge:
    `R:Event$Counter | ValidCard$Card.Self | ValidSA$Spell |
    Layer$CantHappen`, already cited in this card's own `definition.ts`),
    not a resolvable effect and not a zone/event occurrence — nothing in
    the fixed constraint vocabulary or the pool's real sinks has anywhere
    to hang "can't be countered" on, so per the bare-printed-keyword/
    bare-static-ability rule it stays text-only.
  - Annotations: `annotations-authoring.json` added (new for this card),
    baked via `npx vite-node functional-model/scripts/
    compute-annotations.mjs eject` (5/5 facts annotated, verified offsets
    against `data/fin/fin_scryfall.json` #52's real oracle text: 3 lines,
    "Return target nonland permanent to its owner's hand." at line 1,
    "Draw a card." at line 2 — both source-bounce and sink annotate the
    SAME full clause on line 1, matching the white-auracite precedent
    where a source's `target` constraint and its mirroring sink both
    anchor to the identical oracle substring).
  - **Verify**: `verify-synergy.mjs eject` — OK, 0 hard failures.
    `verify-synergy.mjs` (full pool) — 0 hard failures (transient
    single-card flakes seen mid-session, both self-resolved on re-run —
    concurrent sibling sessions actively editing/regenerating other
    cards' trace.json files at the same time, not caused by this task;
    confirmed via `git status` which cards were mid-edit). `vitest run
    functional-model` — 238/238 (one transient failure seen once, also
    self-resolved on immediate re-run, same concurrent-write cause).
  - **`find-synergies.mjs` before/after, isolated via the safe `git show
    HEAD:<path> ` swap-in/swap-back technique (NOT `git stash` — tried
    `git stash push -- <pathspec>` first with a shell-quoting mistake that
    left the flags as extra pathspecs; it silently no-op'd on eject but
    the immediate `git stash pop` that followed popped an UNRELATED,
    pre-existing stash entry already on the stack — not created by this
    task — containing a concurrent sibling session's own WIP
    (magitek-infantry/harness.ts/verify-synergy.mjs/annotation-coverage.mjs
    changes). The pop correctly aborted with a conflict (that sibling had
    kept editing those same files after the stash was made) and the
    working tree was verified unchanged/undamaged before moving on — the
    stray stash entry is still sitting on the stack, untouched, not mine
    to drop. Flagged to the orchestrator; worth mentioning to whichever
    session owns it.** Real numbers: **before (old v1 flat-string
    `zone`/`controller` shape) — 13 lines, all outbound self-graveyard
    "graveyard presence" matches, 0 inbound. After (unified model) — 140
    lines: the same 13 self-graveyard targets (relabeled "moves to
    graveyard", identical card set, zero regression), +2 new outbound
    bounce matches (Nibelheim Aflame, The Water Crystal — real
    Battlefield→Hand-presence sinks), +125 new inbound matches (every
    real pool producer with an unconstrained/nonland-compatible
    Battlefield-presence produce now sees Eject's own removal as a real
    sink — expected and large precisely because "nonland permanent" is
    such a broad target class, not a bug).**
  - `progress.json` updated (`lastVerified: 2026-09-12`, migration notes).
  - No Forge verification outstanding — "can't be countered"'s Forge
    citation was already present in `definition.ts` from before this
    pass; the `bounce`/`target`-constraint conventions reused here were
    already established/cited precedent (venat, white-auracite), nothing
    new to verify against Forge for this card.

## Ether (fin/53) authored fresh in the unified Fact model (2026-09-12)

New card (no prior schema to migrate off of), {3}{U} Artifact. Oracle:
"{T}, Exile this artifact: Add {U}. When you next cast an instant or
sorcery spell this turn, copy that spell. You may choose new targets for
the copy."

5 SOURCE facts, 0 SINK: baseline `self-cast`/`self-enters` (typeLine-
anchored "Artifact"), plus the real mana ability split into 3 facts by
direct analogy to phoenix-down's/elixir's identical "{T}, Exile this
artifact: ..." cost shape — `self-tap-cost`/`self-exile-cost` (bare
`{event:'tap'|'exile', subject:'self', target:'self'}` ACT tags, no
zoneFrom/zoneTo, covered for free by the existing general
`isSelfTapActivationCostFact`/`isSelfExileActivationCostFact`
verify-synergy.mjs exemptions — no new exemption code needed) and the real
effect `{event:'addMana', controller:'you', colors:{has:['U']}}` (same
`colors` shape cargo-ship's own `{T}: Add {C}` fact uses). Cost is
genuinely unpilotable through `canActivateAbility`/`activateAbility`
(engine.ts's `unsupportedCostComponent` doesn't recognize "Exile this
artifact" as payable, same wall phoenix-down/elixir already hit) — plain
`harness.ts` Scenario (1, per current default-1 rule), not
`engine-trace.ts`; its own top-level `effects` run directly regardless of
cost, giving a real `fn:'addMana'` trace line.

**Delayed-trigger spell-copy half is a real, confirmed-fresh engine gap —
left entirely unmodeled (no Fact, no Effect, no `triggers` entry
invented).** Checked the actual surface, not assumed: (1) no event-keyed
("next time X happens") delayed trigger exists anywhere — `interfaces.ts`'s
only delayed-trigger primitive, `delayUntil(phase, run)`, is PHASE-keyed
(603.4/603.7, Elrond Moon-Reader's "next end step"), not event-keyed; (2)
no spell-copy `Effect` kind exists in `card.ts`'s union at all —
`copyPermanent` only copies a battlefield permanent (Clone-style), no
stack-object model exists to duplicate off of. Grepped the whole pool: zero
prior spell-copy cards — this is a new gap, not a rediscovered one. Both
primitives would be needed together for a future Reverberate-style card.

Registered `ether` in `scripts/annotation-coverage.mjs`'s
`ANNOTATED_CARD_SLUGS`. `compute-annotations.mjs ether` baked real
oracle-text offsets (`{T}` 0-3, `Exile this artifact` 5-24, `Add {U}`
26-33, oracle line 0 — single-paragraph oracle text, confirmed no `\n`).
`compute-weights.mjs --slug=ether` → all 5 facts landed at the neutral
floor (value 1) — expected, no fact has real trace-observed magnitude
(cost facts have no possible trace evidence at all; addMana's own
`maxAmount` lookup finds no logged amount since the ability was never
piloted through activation).

Verified: `verify-synergy.mjs ether` → 0 hard failures. Full pool (317
checked): 4 pre-existing hard failures, all unrelated
(cecil-dark-knight-cecil-redeemed-paladin, ice-flan,
stiltzkin-moogle-merchant, white-auracite — other concurrent sessions'
in-flight work per `git status` at task start, not touched). `npx vitest
run functional-model`: 238/238 (unchanged). `find-synergies.mjs`: brand-new
card, no before/after diff possible — 37 total lines, all via the
`self-enters` baseline fact ("enters the battlefield" matches against
every other real ETB-presence sink pool-wide, e.g. Summon: Bahamut,
Elixir, Ambrosia Whiteheart, Ultima). Zero matches for
`event:'addMana'/'tap'/'exile'` yet (no sink in the pool wants any of those
generically today — same "new, forward-looking vocabulary" pattern as
prior promotions).

Open Forge-verification: none needed this pass — oracle text confirmed
directly against `data/fin/fin_scryfall.json` (#53), and the fact-model
choices are all direct analogies to already-established, already-verified
precedent (phoenix-down/elixir's cost shape, cargo-ship's `colors` shape).
The two real gaps flagged above (event-keyed delayed trigger, spell-copy
Effect kind) are open ENGINE_GAPS-class items, not verification debt —
worth a future dedicated Forge cross-check (`DelayedTrigger`/`CopySpell`
Ability classes) if/when a real card actually forces building them, not
before.

## ice-magic (fin/56) migrated to unified Fact model (2026-09-12)

3 tiers (Blizzard {0} bounce, Blizzara {2} top/bottom-of-library,
Blizzaga {5}{U} shuffle-into-library) — 3 scenarios (one per tier, per
the corrected standing rule), but NOT 3 duplicated per-tier facts.
Checked Restoration Magic's own actual files (not just its prose) as the
named precedent and found RM keeps facts compacted by real distinctness
even though it went to 3 scenarios — its own progress.json says the
scenario-count correction explicitly does NOT reopen the fact-modeling
question. Ice Magic's own 3 tiers resolve to only 2 real distinct zone
moves given this model's vocabulary: Blizzard alone is Battlefield→Hand
(bounce); Blizzara/Blizzaga are BOTH Battlefield→Library (top/bottom
placement and shuffle are both untracked mechanical detail, same as
before this migration) — authoring 2 identical duplicate fact objects for
Blizzara/Blizzaga would be pure noise, so kept ONE shared to-library fact
covering both, anchored on Blizzara's (first) line. Flagging this because
the dispatched task text described RM's precedent as "per-tier
fact-splitting," which its own files contradict — worth correcting that
framing if it resurfaces on a future Tiered-spell task.

Real bug fixed: the pre-migration sink was wrongly `controller:'opp'`
(no such restriction in real oracle text or Forge's `ValidTgts$
Creature`) — fixed to unconstrained-by-controller, mirroring
fate-of-the-sun-cryst's own precedent. This alone drove +108 real
incoming matches in the find-synergies diff (any creature-producing card
now qualifies, not just opponent-side producers) — a real correctness
fix, not scope creep.

New (from,to) pair for the pool: Battlefield→Library — checked
`ZONE_MOVEMENT_NAMES`, no established one-word term exists (unlike
bounce/tutor/reanimate), left UNNAMED; `describeFact`'s generic fallback
renders "moves to Library (from Battlefield)" for it. `target:{types:
{has:['Creature']}}, targeted:true}` on both movement facts is
descriptive-only (confirmed via `factsInteract`'s zone branch: it never
reads a SOURCE zone fact's own `target`, only `subject`), same as
Phoenix Down's own reanimate fact.

Verified: `verify-synergy.mjs ice-magic` OK; full pool 316 checked, 4
pre-existing unrelated hard failures (cecil-dark-knight-..., ice-flan,
stiltzkin-moogle-merchant, white-auracite — concurrent sessions' in-flight
work per git status, not touched). `vitest run functional-model`:
238/238. `find-synergies.mjs` before/after (isolated via `git stash` of
just `ice-magic/synergy.json` against the current dirty tree): 0 real
lost matches (the naive raw-line diff first looked like -14 losses, but
those were label-text renames only — `zone`→`to` rename + the new
unnamed-pair fallback phrasing — re-verified by normalizing labels and
diffing by card-pair only); +4 real outgoing gains (Haste Magic,
Nibelheim Aflame, Resentful Revelation, The Water Crystal — real
Hand/Library-presence wants previously blocked by the old
`controller:'opp'` bug); +108 real incoming gains (the sink fix above).

No open Forge-verification needed — oracle text confirmed directly
against `data/fin/fin_scryfall.json` #56; definition.ts/scenarios.ts were
already correct and required no changes, this was a fact-model/
vocabulary migration only.

## Jill, Shiva's Dominant // Shiva, Warden of Ice (fin/58) migrated to unified Fact/annotations model (2026-09-12)

Transform DFC + Saga (Legendary Creature -> Legendary Enchantment
Creature — Saga). definition.ts/scenarios.ts already existed and were
already correct (built 2026-09-06, full engine-trace.ts pilot scenario,
real `Unblockable` keyword + `tapAll` Effect kind added at the time) —
this task was fact-model-only (synergy.json + new annotations-authoring
.json + progress.json + ANNOTATED_CARD_SLUGS registration), no engine or
definition.ts changes needed. Note: the task brief's claim that
"Kefka/Cecil-Dark-Knight" were "already migrated earlier today" turned
out to be wrong when checked — both are still v1-shaped (bare `zone`, no
`annotations`) as of this task; used dion-bahamut-s-dominant-bahamut-
warden-of-light and venat-heart-of-hydaelyn-hydaelyn-the-mothercrystal as
the real precedents instead (both genuinely migrated).

12 source + 3 sink facts. Front: self-cast/self-enters (typeLine-anchored,
no `subject` — same as Dion, neither had a subject-carrying sibling to
merge from); ETB bounce (SOURCE `{to:'Hand', from:'Battlefield',
target:{types:{not:['Land']}}, targeted:true}`, no `controller` — real
text has no owner/side restriction; 'up to one' -> plain `targeted:true`,
confirmed via combat-tutorial/fin-48 there's no separate optional-target
field); self-tap activation cost; exile-then-return transform pair (SOURCE
`to:'Exile'/from:'Battlefield'` + `to:'Battlefield'/from:'Exile'
event:'entersBattlefield'`), same two-fact shape as Dion/Venat. Back: a
real LORE-counter fact (`{event:'putCounter', counterType:'LORE',
target:'self'}`) — CONFIRMED via real trace evidence (3 real
`fn:'putCounter' counterType:'LORE'` lines, since this card's own full
engine-trace.ts pilot scenario genuinely runs through saga.ts's real
`advanceSaga`), unlike summon-primal-garuda's/summon-choco-mog's own
lighter `sequence`-harness Sagas which had to drop theirs for lack of
evidence — confirms the LORE fact is real, reusable vocabulary
(precedent: summon-bahamut) whenever the scenario style is the full
pilot, not a one-off; chapter I/II Mesmerize (`event:'grantKeyword',
keyword:'Unblockable'`) authored as TWO separate identical facts, one per
real chapter firing (same convention Dion's own repeated chapter I/II
facts use — sinks are NOT similarly duplicated, only sources, since a
sink is a want concept, not a repeated occurrence); chapter III mass-tap
(`{event:'tap', controller:'opp', target:{types:{has:['Land']}},
targeted:false}`) — direct vocabulary reuse of crystal-fragments-summon-
alexander's own real "tap all creatures your opponents control" fact,
`types` swapped Creature->Land, exact same shape, confirming it
generalizes; Cold Snap's own exile-then-return-front-face-up pair, same
shape as the front-face transform.

No baseline self-dies/self-graveyard fact, no back-face baseline
self-enters — per this task's explicit instruction (front-face-only
baseline on an already-dense continuous scenario), same as Dion's own
precedent.

Checks: `verify-synergy.mjs` scoped 0 hard failures (soft notes only:
tapForMana x8, drawCard x4 mechanical, transform x2). Full pool: 317
checked, 1 hard failure (magic-damper — pre-existing, unrelated,
concurrent-session gap, not touched by this task). `vitest run
functional-model`: 238/238 (a LATER full run showed 1 failure in
annotation-coverage.test.ts from `magic-damper`/`memories-returning` —
both concurrently added to `ANNOTATED_CARD_SLUGS` by other in-flight
sessions, mid-migration; confirmed jill-shiva-s-dominant is NOT in the
violation list — not caused by or related to this task). `value` resolved
for real via `compute-weights.mjs --slug` (all 15 facts land on the
neutral floor, 1 — no numeric-amount effect on this card to bucket).

Real find-synergies.mjs diff (isolated old-v1-file-vs-new-v2-file swap
against the live full pool): -138/+532. All 138 losses are the old v1
file's own presence-only `self-battlefield` SOURCE fact's matches
(correctly dropped per the 'no presence sources' rule — same precedent
as summon-bahamut's own `self-battlefield` deletion). Gains: 168
battlefield-presence + 71 entersBattlefield (new sinks catching real pool
producers), 283 'moves to battlefield (from exile)' (the two independent
self-transform-return facts each separately matching every unconstrained
Battlefield sink — same duplication pattern Venat's migration already
documents), 2 'bounce', 2 'moves to exile (from battlefield)', 2 'moves
to battlefield (from library)', 4 real 'self-interaction:
second-copy-legendary' (CR 704.5j).

No open Forge-verification needed — oracle text confirmed directly
against `data/fin/fin_scryfall.json` #58 (combined name "Jill, Shiva's
Dominant // Shiva, Warden of Ice"); compute-annotations.mjs's own
combined-name transform-DFC lookup (fixed on Dion's own migration
2026-09-11) resolved both faces correctly on the first run.

## Relm's Sketching (fin/67) migrated to unified Fact model (2026-09-12)

Real oracle text: "Create a token that's a copy of target artifact,
creature, or land." Sorcery, {2}{U}{U}. `definition.ts` already used the
real `custom` Effect (`chooseTarget` + the real `Card` getters
`isArtifact`/`isCreature`/`isLand`/`getNetPower`/`getNetToughness` +
`createToken`) — unchanged this pass, only `synergy.json` migrated.

**Real targeted clone-token creation — no exact pool precedent existed,
checked first.** Doppelgang (same `copyPermanent`-flavored effect,
X-targets/X-copies) is itself still v1-shaped (`zone`/`sourceText`, no
`annotations`) — not a usable v2 precedent. No pool card anywhere models
`copyPermanent` under v2. What IS precedented and reused directly:
- **Token creation shape** — `{to:'Battlefield', event:'entersBattlefield',
  controller:'you', ..., annotations}`, same fields aerith-rescue-mission's
  own fixed-token `c_1_1_hero` fact uses.
- **Targeted-with-type-constraint shape** — `target:{types:{hasAny:[...]}},
  targeted:true`, same fields summon-bahamut's own `destroy-nonland`
  (`target:{types:{not:['Land']}}, targeted:true`) uses for its own "up to
  one target nonland permanent."
- **Omitted `subject` for a genuinely dynamic-type token** — the created
  token's real characteristics (name/types/P/T) are copied from whatever
  gets targeted at resolution, never fixed at authoring time, so no
  `tokens/<slug>/definition.ts` can exist for it and no `{token:slug}`
  subject can be written. `resolveSubject`'s own doc comment explicitly
  covers exactly this case (its Gaius van Baelsar "each player sacrifices a
  creature" example — "what lands in the graveyard is whichever creature
  got sacrificed... resolving that to [a fixed subject] would wrongly let a
  type-constrained want match... even when the actual object's type is
  unknown") — omitting `subject` here is the correct, precedented reading,
  not a gap: this fact honestly matches only UNCONSTRAINED "battlefield
  presence" wants, never a type-constrained one, since the real type truly
  isn't known until a target is chosen.

**3 source facts** (cast Hand→self, typeLine-anchored; the token-creation
effect itself, oracle-anchored to the whole (only) sentence, carrying the
`target`/`targeted` pair above; self→Graveyard, typeLine-anchored — same
baseline order/shape established pool-wide) + **2 sink facts** (unchanged
concept from the old v1 file — "wants an artifact/creature/land on the
battlefield, either side" — migrated `zone`→`to`, added `annotations`
pointing at the same whole-sentence targeting clause, same "sink shares its
producing effect's own highlight" convention cargo-ship's crew sink already
established).

**Scenarios consolidated to 1** (dispatch's own instruction) — the old file
had 3 (creature/opponent-artifact/land), each demonstrating the effect
against a different target type but none more real than the others; kept
the creature case (`you: {creaturesCount:1, creaturePower:4}`, the
pool-standard generic count-based board filler, not an invented card — the
harness's own real "Grizzly Bears" stand-in every count-based scenario
pool-wide already uses). Real trace confirms the full mechanism: targets
the real creature, reads its `isArtifact`/`isCreature`/`isLand`/
`getNetPower`/`getNetToughness`, creates a token with the SAME
name/power/toughness, then the sorcery moves to the graveyard.

**Left `value:-1` placeholders on every fact** — did not run
`compute-weights.mjs`, same convention cargo-ship/dreams-of-laguna's own
recent migrations used.

**Process note — hit the exact footgun already documented in this file's
own Dreams of Laguna entry, in the opposite direction**: assumed
`run-scenarios.mjs` took a positional slug arg (like `compute-annotations.mjs`
does) — it does not; it always regenerates the WHOLE POOL's `trace.json`
with no filtering at all. Caught via `git status` before anything went
further, reverted all ~210 other cards' `trace.json` via `git diff
--name-only -- 'functional-model/cards/*/trace.json' | grep -v
relm-s-sketching | xargs git checkout --` (an earlier attempt piping a
pre-computed file list through `xargs` silently no-opped on an untracked
path mid-list — `git checkout --` with one bad pathspec in a batch can
abort the whole invocation depending on git version; rebuilding the list
live via `git diff --name-only` immediately before checkout, with no
untracked entries mixed in, is the reliable form). `find-synergies.mjs`
similarly has NO card-name filter at all (always whole-pool) — isolate by
`grep`ping the card's own name out of the full report, not by re-running
scoped.

**`find-synergies.mjs` diff**, isolated via `git stash push --` of just
this card's own `synergy.json` (heavy real concurrent multi-session
editing across ~40 other pool files confirmed via `git status` mid-task,
same phenomenon this file's own Dreams of Laguna/Cargo Ship entries already
hit — isolated the same way, by stashing only this card's file around the
before/after pair rather than trusting a raw pool-wide line-count diff):
**172 → 172, zero matches gained or lost.** Pure label upgrade on the
pre-existing matches — "battlefield presence" → "enters the battlefield"
(12 lines, the unconstrained producers this card's own token-creation fact
already matched as a bare presence fact) and "graveyard presence" → "moves
to graveyard" (13 lines, this card's own resolved-sorcery-to-graveyard
fact), same relabeling-only outcome the from-father-to-son/dreams-of-laguna
migrations already established for this exact kind of change. No NEW match
from the added `target`/`targeted` constraint data (expected — no sink in
the pool wants "a targeted token-creation event" specifically, same "this
promotes vocabulary for a future payoff card, not a match today" outcome
`event:'pump'`'s own promotion documented).

Verified: `verify-synergy.mjs relm-s-sketching` → OK, 0 hard failures.
Full-pool run: 317 v2 cards checked, 9 hard failures — all pre-existing/
concurrent-session (cargo-ship, cecil-dark-knight-cecil-redeemed-paladin,
dragoon-s-wyvern, ice-flan, il-mheg-pixie, stiltzkin-moogle-merchant,
the-wind-crystal, white-auracite, zack-fair — none touched by this task).
`vitest run functional-model`: 238/238. Added `'relm-s-sketching'` to
`scripts/annotation-coverage.mjs`'s `ANNOTATED_CARD_SLUGS`.

No Forge verification needed — `copyPermanent`/`createToken` are both
already-cited, already-wired engine primitives (`interfaces.ts`,
`state.ts`), and this migration introduces no new engine machinery, only
reused Fact vocabulary.

## `louisoix-s-sacrifice` (fin/59) migrated to the unified Fact model (2026-09-12)

Real oracle text: "As an additional cost to cast this spell, sacrifice a
legendary creature or pay {2}. / Counter target activated ability,
triggered ability, or noncreature spell." Instant, {U}. No engine work
needed — `counter` (log-only `CounterEffect`, `card.ts`/`interfaces.ts`)
was already real, wired vocabulary from when this card was first authored
(2026-09-06); this pass is a pure fact-model/vocabulary migration.

**Facts** (4 source, 1 sink): baseline `self-cast`/`self-graveyard`
(typeLine-anchored, no self-enters/self-dies — an Instant has neither).
**Sacrifice-as-additional-cost** modeled as ONE merged SOURCE fact (not a
bare ACT tag deferring elsewhere): `{event:'sacrifice', from:'Battlefield',
to:'Graveyard', controller:'you', target:{types:{has:['Legendary',
'Creature']}}, targeted:true}` — sacrificing ANOTHER creature you control
(not self) as a guaranteed, unpreventable cost with no separate consequence
fact already covering this exact movement on this card, so it gets
zoneFrom/zoneTo inline per the standing ACT-vs-CONSEQUENCE table
(SYNERGY_DESIGN.md) — same "guaranteed movement, inline is correct"
reasoning as `self-cast`'s own `from:'Hand'`, just for a non-self subject.
The "OR pay {2}" alternative cost is deliberately NOT a fact — mana
payment isn't normally factored, and it produces zero distinguishing
effect. **Counter effect**: `{event:'counter', target:{}, targeted:true}`
— `target:{}` (empty Constraints, genuinely unrestricted) mirrors
restoration-magic's own real "CR 601.2c-targeted but vocabulary can't
narrow the bucket further" pattern, since this model has no Constraints
concept for "kind of stack object" (spell vs. activated/triggered ability)
and no Stack/ability-object model at all. Confirmed via grep: this is the
ONLY card in the pool declaring `event:'counter'` in either role — a real,
documented gap (no counterspell-payoff card exists yet, and
activated/triggered-ability countering specifically has zero possible
engine representation).

**Real correctness fix, same pass**: the companion SINK fact (wants a
legendary creature present as cost fodder) was narrowed from the old
schema's untyped `{types:{has:['Creature']}}` to
`{types:{has:['Legendary','Creature']}}` — the old fact only checked for
ANY creature, not specifically a legendary one. Confirmed via
`find-synergies.mjs` this costs zero real matches (every producer that
satisfied the old untyped want in this pool is itself already a real
Legendary creature — the fin/1-40 migrated batch skews heavily toward
legendary commanders, so this narrowing happened to be free).

**Real "not mocked" fix, same pass** (the exact card SYNERGY_DESIGN.md's
2026-09-12 `PlayerState.creatureCards`/Phoenix Down entry flagged for
"revisit case-by-case if a future task touches one of these"): the old
scenario tagged the shared `GENERIC_FILLER_CREATURE` ("Grizzly Bears," not
actually legendary) with `creatureSubtypes:['Legendary']` — a real,
specific card mislabeled with a supertype it doesn't have. Replaced with
`creatureCards:[{name:'Stiltzkin, Moogle Merchant', subtypes:['Legendary',
'Moogle'], power:1, toughness:2}]` (data/fin/fin_scryfall.json: {W}
Legendary Creature — Moogle, 1/2). Note this engine's own
`hasSubtype('Legendary')` pragmatic-supertype-as-subtype convention
(documented on aerith-gainsborough's own definition.ts) is correct, settled
house style — the bug was the specific card identity, not the mechanism.

**Scenarios trimmed 2 → 1**, per the standing "basic function, not
unit-test coverage" rule: this card is NOT a real branching modal for
scenario-count purposes (unlike Phoenix Down's genuinely different two
modes) — sacrifice-vs-pay-{2} is a cost CHOICE, the spell's own effect
(counter) is singular either way, and mode 1 produces no distinguishing
trace line (mana payment unmodeled). `definition.ts` itself is UNCHANGED —
still a real `modal`/`ctx.mode` two-branch Effect, since the underlying
cost mechanism genuinely has two real payment paths; the scenario-count
call doesn't reopen the effect-modeling shape.

**Verification**: `verify-synergy.mjs` scoped OK; full pool 317 v2 cards
checked, 9 hard failures, all pre-existing/concurrent-session work
unrelated to this card (cargo-ship, cecil-dark-knight-cecil-redeemed-
paladin, dragoon-s-wyvern, ice-flan, il-mheg-pixie, stiltzkin-moogle-
merchant, the-wind-crystal, white-auracite, zack-fair). `vitest run
functional-model`: 238/238. `find-synergies.mjs` real isolated before/after
diff (git-stash swap of just this card's own synergy.json/scenarios.ts/
trace.json around a full-pool run both times, same isolation technique
`relm-s-sketching`'s own entry above established, since ~15+ other pool
files were mid-edit by concurrent sessions during this task): **byte-
identical** — the same ~90 inbound producer lines (battlefield-presence/
enters-the-battlefield legendary creatures) and Louisoix's Sacrifice's own
13 outbound "moves to graveyard"/13 "dies" matches (relabeled from the old
schema's "graveyard presence"/"dies" strings, same card set), zero gained
or lost. `event:'counter'`/`event:'sacrifice'`: 0 matches either direction
(expected — no sink in the pool wants either event yet).

Added `'louisoix-s-sacrifice'` to `scripts/annotation-coverage.mjs`'s
`ANNOTATED_CARD_SLUGS`.

**Open Forge-verification**: none needed — real oracle text confirmed
directly against `data/fin/fin_scryfall.json` (collector_number 59, mana
cost `{U}`, matches `definition.ts` exactly); no new engine mechanics
introduced, only reused Fact vocabulary and a real scenario-data bugfix.

## Matoya, Archon Elder (fin/62) migrated to unified Fact model (2026-09-12)

Real oracle: "Whenever you scry or surveil, draw a card. (Draw after you
scry or surveil.)" — {2}{U} Legendary Creature — Human Warlock, 1/4.
Definition.ts already had two separate triggers (`onScry`/`onSurveil`,
both `kind:'drawCard'`) matching Forge's own real two-triggered-ability
script (Mode$ Scry + Mode$ Surveil, both running the same TrigDraw) —
unchanged.

**Facts**: baseline self-cast(Hand)/self-enters (typeLine-anchored,
'Creature'/'Legendary Creature' substrings, same convention as
g-raha-tia/dwarven-castle-guard). Two SINK facts, one per trigger
(`{event:'scry',controller:'you'}` / `{event:'surveil',controller:'you'}`,
oracle-anchored on the respective word in "Whenever you scry or surveil"),
each paired with its own SOURCE drawCard fact — deliberately given
DIFFERENT annotations (one on "draw a card", one on the reminder text's
"Draw after you scry or surveil") specifically to avoid a `factIdentity`
collision (role+label+first-annotation) between two otherwise-identical
drawCard facts. No `oncePerTurn` on either pair — the real oracle text has
no once-per-turn cap, unlike G'raha Tia's Allagan Eye.

**Real, checked, asymmetric engine support — the reason this card needed a
new verify-synergy.mjs exemption**: `surveil` is fully wired
(`card.ts`'s own `kind:'surveil'` Effect, `actions.surveil`/`state.ts`,
already exercised by Dreams of Laguna/fin-50 and Il Mheg Pixie) but `scry`
has ZERO implementation anywhere in this engine — checked directly:
`interfaces.ts`'s own `declare function scry(player, qty): void` is a bare
Forge-signature-mirror doc entry (same shape as `surveil`'s own declare
right above it), never wired into `card.ts`'s real `Actions` type or
`state.ts` (no `Effect` kind, no `Actions.scry`, no `state.scry` call
anywhere in the pool — grepped both files directly, not assumed). This is
a genuine, real engine gap distinct from surveil, not a modeling oversight
— flagging it here in case a future card also wants real scry and this
needs to become a proper `ENGINE_GAPS.md` numbered entry (not added there
this pass, following the existing per-card-gap precedent — Auron's
Inspiration/Magitek Infantry's own gaps also live only in
verify-synergy.mjs + progress.json, not ENGINE_GAPS.md).

Added `isMatoyaScryBroadcastWant` to `scripts/verify-synergy.mjs`
(scoped narrowly: `w.event === 'scry' && card.name === 'Matoya, Archon
Elder'`), same "real fact, real documented wall, zero achievable evidence"
tolerance `isAuronsInspirationBroadcastPumpFact` already established for a
produce fact, extended here to a bare event-shaped SINK want. The
`onSurveil` sibling sink on this same card is NOT exempted — it gets real
evidence (see scenario below).

**Scenario (1, engine-piloted, replacing the old bare
`{trigger:'onScry'}`/`{trigger:'onSurveil'}` pair)**: cast Matoya -> real,
generic `actions.surveil(ctx.you, 1)` call (fully-wired real engine action,
not fabricated — deliberately NOT wrapped in another card's own cast, per
this session's "1 scenario, real basic function"/"no cross-card synergy
required in the scenario itself" instruction) -> `pilotFireTrigger(...,
'onSurveil')` -> real drawCard. Gotcha hit and fixed: `actions.surveil`
takes the logging-wrapped `ctx.you` (from `pilot.ctxFor`), NOT the raw
`pilot.you` `RealPlayer` — passing `pilot.you` threw `player.getName is
not a function` inside `loggingActions.surveil`.

**verify-synergy.mjs** (scoped): 0 hard failures, 2 soft notes — `tapForMana`
unrecognized (pre-existing, pool-wide mana-fact gap, not this card's
concern) and "trace has surveil with no matching declared produce"
(expected: the in-scenario surveil is generic/external, not Matoya's own
produce — Matoya is a pure SINK for it). Full pool: 317 v2 checked, 9 hard
failures, ALL pre-existing/concurrent-session (cargo-ship,
cecil-dark-knight-cecil-redeemed-paladin, dragoon-s-wyvern, ice-flan,
il-mheg-pixie, stiltzkin-moogle-merchant, the-wind-crystal, white-auracite,
zack-fair — none touched by this task; matoya-archon-elder itself is only
a soft "note", never a FAIL). `vitest run functional-model`: 238/238.
`annotation-coverage.test.ts` scoped to just `matoya-archon-elder` (via
`findMissingAnnotations` called directly): 0 violations — the one
pool-wide test failure seen mid-task (`the-prima-vista`) is a concurrent
session's own in-progress work, unrelated. Added `'matoya-archon-elder'`
to `annotation-coverage.mjs`'s `ANNOTATED_CARD_SLUGS` (a concurrent session
appended `'the-prima-vista'` to the same array around the same time — both
entries landed, non-conflicting).

**`find-synergies.mjs` diff** (grepped "matoya" out of the full-pool
report, isolating from ~40 other concurrently-edited pool files same as
prior entries in this file): real cross-card matches confirmed —
`Dreams of Laguna --[surveil]--> Matoya` and `Il Mheg Pixie
--[surveil]--> Matoya` (both real, pre-existing surveil producers).
Matoya's own self-enters also picked up the usual ~130 generic
Battlefield-presence sink matches every migrated creature's baseline ETB
fact gets pool-wide. Zero scry-side matches (expected — 0 real scry
producers anywhere in the pool).

`compute-annotations.mjs`/`compute-weights.mjs` both run scoped
(`matoya-archon-elder` only) — annotation offsets came back byte-identical
to hand-computed offsets; weights all resolved to `1` (no numeric
constraint on any fact, single-occurrence trace evidence on every source).

**Open Forge-verification note**: none needed for the surveil half (already
cited/wired). The scry gap above is real engine-gap territory, not a
citation question — no Forge lookup would change the conclusion (this
model simply hasn't built the action yet).

## Magic Damper (fin/61) migrated to unified Fact model (2026-09-12)

Oracle confirmed unchanged (`data/fin/fin_scryfall.json` #61): "Target
creature you control gets +1/+1 and gains hexproof until end of turn.
Untap it." Instant, {U}. `definition.ts` was already fully declarative
(`pumpTarget`/`grantKeywordTarget`/`untapTarget`, all `owner:'you'`) from
an earlier pass (its own comment cites this card by name as the reason
`untapTarget` exists at all) — no engine/`card.ts` change needed this
task, purely a synergy.json/scenarios.ts/annotations migration + one real
`verify-synergy.mjs` vocabulary promotion.

**Facts (5 source, 1 sink)**: baseline `self-cast`
`{event:'cast', from:'Hand', target:'self'}` + `self-graveyard`
`{to:'Graveyard', controller:'you', subject:'self'}` (both typeLine-
anchored on "Instant", mirroring restoration-magic's identical pair — an
Instant has no entersBattlefield/dies of its own). `pump`
`{event:'pump', controller:'you', target:{types:{has:['Creature']}},
targeted:true, untilEndOfTurn:true}` and `grantKeyword` Hexproof
`{event:'grantKeyword', keyword:'Hexproof', controller:'you',
target:{types:{has:['Creature']}}, targeted:true, untilEndOfTurn:true}`
both directly mirror Summon: Primal Garuda's own real "target creature you
control gets +1/+0 and gains flying until end of turn" precedent —
`controller:'you'` is how the top-level `Fact` expresses a printed "you
control" restriction on the TARGET, since `Constraints` itself has no
`controller` field (checked the pool for this exact co-occurrence pattern
first — combat-tutorial/phoenix-down/slash-of-light/summon-primal-garuda/
venat/white-auracite/zack-fair all already establish it). New real fact:
`{event:'untap', controller:'you', target:{types:{has:['Creature']}},
targeted:true}` — deliberately NO `untilEndOfTurn` (untapping is
instantaneous, not a duration effect). Sink unchanged in substance from
the pre-migration file, reshaped `zone`->`to`:
`{to:'Battlefield', controller:'you', types:{has:['Creature']}}`.

**`event:'untap'` promoted off `PARKED_ACTION_FNS`** — same "parked ->
real" treatment `pump`/`tap`/`animate`/`gainControl`/`surveil` each
already got. The ENGINE machinery (`card.ts`'s `untapTarget` Effect kind,
`state.untap`, `harness.ts`'s `loggingActions.untap`) was already fully
real/wired before this task (built specifically for this card in an
earlier pass) — this was purely a Fact-vocabulary gap, not an engine gap.
`verify-synergy.mjs` changes: `producedEvents`'s new `case 'untap':
return [{event:'untap', side: sideOf(entry, cardName)}]` (reuses `sideOf`'s
name-guessing fallback, same as `tap` before ITS OWN `controller` field
existed — `loggingActions.untap` logs no `controller` field at all, unlike
`tap`, which gained one earlier); removed `'untap'` from
`PARKED_ACTION_FNS`; added `'untap'` to `explainableFns`.
**Known, expected, pool-wide side effect, not a regression**: surfaced
~70 new SOFT notes pool-wide (mostly Untap-step land-untapping during
scenario setup, plus a handful of real card untap effects: Cecil Dark
Knight, Sage's Nouliths, Unexpected Request, Zidane Tantalus Thief) as
produced-but-unexplained — never a hard failure, same accepted class every
prior promotion caused.

**Scenarios.ts**: consolidated 2 -> 1 (dropped the old "no legal target,
nothing happens" no-op branch per the standing "default to one scenario"
rule — a defensive/no-op variant of the single real mode adds no
distinguishing evidence). Plain `harness.ts` `Scenario` style (not
engine-piloted) — `resolveCard` already runs an Instant's own top-level
`effects` through the real cast->resolve->graveyard lifecycle with no
`scenario.trigger`/`ability` needed, giving real `fn:'cast'`/`'pump'`/
`'grantKeyword'`/`'untap'`/`'move'`(->Graveyard) trace evidence in one
pass — no need for the heavier `engine-trace.ts` pilot style.

**Verification**: `verify-synergy.mjs` scoped: 0 hard failures, 0 soft
notes. Full pool (317 v2 cards): 0 hard failures attributable to this card
(10 hard failures present in a full-pool run — cargo-ship,
cecil-dark-knight-cecil-redeemed-paladin, dragoon-s-wyvern, ice-flan,
il-mheg-pixie, stiltzkin-moogle-merchant, the-lunar-whale,
the-wind-crystal, white-auracite, zack-fair — all confirmed via `git
status` to be concurrent, unrelated in-flight peer-session edits already
dirty/untracked before this task touched anything). `vitest run
functional-model`: 237/238 (the 1 failure, `the-lunar-whale`'s own
annotation-coverage violation, is a concurrent peer session's in-flight
card added to `ANNOTATED_CARD_SLUGS` before its `synergy.json` was fully
annotated — same accepted transient-failure class this file already
documents elsewhere, unrelated to magic-damper). Added `'magic-damper'` to
`annotation-coverage.mjs`'s `ANNOTATED_CARD_SLUGS`. `compute-weights.mjs
--slug=magic-damper` run: all 6 facts resolved `-1` -> real magnitude `1`.

**Real `find-synergies.mjs` diff** (isolated before/after via a git-stash
swap of just `synergy.json`+`scenarios.ts`, captured just before an
unrelated concurrent commit landed mid-task — see the stash-pop caution
note below): sink (creature-you-control-on-battlefield) unchanged at 125
matching producers, same set — only the rendered edge label changed
("battlefield presence"/"enters the battlefield" wording, pre-existing
`zone`->`to` rename convention, not a new match). Producer side: the new
`self-graveyard` baseline fact's 13 unconstrained-Graveyard-presence
matches (Cantankerous Keepers, Eden Seat of the Sanctum, Elixir,
Emet-Selch Unsundered, Ignis Scientia, Magic Pot, Qutrub Forayer, Rydia's
Return, Sorceress's Schemes, Summon: Esper Ramuh, The Emperor of
Palamecia, Thranduil Sindarin Liege, Vanille Cheerful l'Cie) are the SAME
13 cards before and after (relabeled "graveyard presence" -> "moves to
graveyard", zero count change — the pre-migration file already had an
equivalent bare `zone:'Graveyard'` fact). The new pump/grantKeyword/untap
facts and the new self-cast fact: 0 matches either direction (real,
documented zero-match new/reshaped vocabulary usage — no sink in the pool
wants `event:'pump'`/`'grantKeyword'`/`'untap'`/`'cast'` with a matching
shape yet), same "promotes vocabulary, doesn't itself create a match"
outcome every prior promotion in this pool has seen.

**Caution surfaced this task, worth flagging for future sessions**: a
plain pathspec-scoped `git stash push -- <2 files>` / `git stash pop`
round trip, done here purely to isolate a before/after `find-synergies.mjs`
diff, transiently reverted this card's own migrated files back to HEAD
content — 3 concurrent commits landed on `main` from other sessions
between the push and the pop (confirmed via `git log`), and the pop's
3-way merge silently resolved against the new HEAD in a way that dropped
my working-tree changes on those 2 files (no conflict markers, no error
message — just silently gone). Files were re-verified against my own
already-validated content and rewritten; no data was actually lost, but
this is a real, reproducible hazard specific to this actively-multi-
committing shared repo — **prefer a scratch-directory copy (or just
capturing before/after grep output without ever un-staging real working-
tree changes) over `git stash` for isolating a diff on a repo other
sessions are concurrently committing to.**

**Open Forge-verification**: none needed — real oracle text confirmed
directly against `data/fin/fin_scryfall.json` (#61, mana_cost `{U}`,
matches `definition.ts` exactly); this pass is a fact-model/vocabulary
migration on top of already-real, already-cited engine machinery, not new
engine mechanics.

## Retrieve the Esper (fin/68) migrated to unified Fact model (2026-09-12)

Real oracle text: "Create a 3/3 blue Robot Warrior artifact creature token.
Then if this spell was cast from a graveyard, put two +1/+1 counters on that
token. / Flashback {5}{U} (You may cast this card from your graveyard for
its flashback cost. Then exile it.)", Sorcery, {3}{U}. 6 source facts, sink
empty (unchanged, no real "wants"): the same 4-fact Flashback baseline
from-father-to-son (fin/20)/dreams-of-laguna (fin/50, both migrated the same
day) established — mirrored exactly, byte-identical annotation indices
(26/83, 85/98) to dreams-of-laguna's own Flashback-reminder-text pair. Plus
2 card-specific facts: token creation (`{event:'entersBattlefield',
to:'Battlefield', subject:{token:'u_3_3_robot_warrior'}}`) and the
conditional bonus counters (`{event:'putCounter', counterType:'+1/+1',
target:{name:{eq:'Robot Warrior'}}}`).

**memories-returning (fin/63) was NOT actually migrated** despite the
dispatch calling it a same-batch precedent — checked before starting
(no `annotations-authoring.json`, tiny 249-byte v1-shaped synergy.json) —
so dreams-of-laguna is the sole real precedent mirrored, not a choice
between two.

**Added `TOKENS.u_3_3_robot_warrior`** (tokens.ts) — real printed FIN token
(confirmed in `data/fin/fin_tokens_scryfall.json`, name "Robot Warrior"; no
P/T there, so 3/3 comes off this card's own oracle text). Also switched
`definition.ts`'s `createToken` call from an inline literal to
`TOKENS.u_3_3_robot_warrior`, so the fact's `subject:{token:...}` resolves
against something real — matches aerith-rescue-mission/battle-menu's own
already-migrated token-fact precedent (the only two real
`subject:{token:...}` usages in the pool before this).

**Conditional "if cast from a graveyard, +2 counters" — real "different
effect depending on cast origin" case, checked Phoenix Down first per the
dispatch's own suggestion and rejected it as the wrong precedent** (Phoenix
Down's Choose-one is player-chosen branching, not cast-origin-conditional —
a different shape entirely). The actual on-point precedent is
from-father-to-son's own already-migrated castFrom-conditional branch
("put it into your hand" vs "put it onto the battlefield instead") — its
house style: each branch gets its OWN separate fact, annotated to that
branch's own specific oracle clause, with **no explicit castFrom/mode field
anywhere in the schema** (confirmed: `Fact` has no `face`/`castFrom`/`mode`
field for this). Followed the same approach — the bonus counters got their
own separate `putCounter` fact (distinct from the token-creation fact,
which fires on both cast modes), annotated ONLY to "put two +1/+1 counters
on that token" (the condition clause itself, "Then if this spell was cast
from a graveyard,", is excluded from the highlight span, same exclusion
from-father-to-son's own conditional fact already uses) — conditionality is
documented in prose (this note / progress.json), not a new schema field,
since no second real card yet needs to WANT "only a cast-from-graveyard-
conditional effect" as an actual matchable thing.

Also gave this fact a real `target: {name:{eq:'Robot Warrior'}}` — NOT
`target:'self'` (which would wrongly mean "this card") and not left
unconstrained. This is the first SOURCE-side (target-filter) use of
`NameConstraint`; the only prior real pool usage was a SINK-side presence
want (rufus-shinra's own `{name:{eq:'Darkstar'}}`, wanting its own real
token by name). Confirmed via a real `find-synergies.mjs` diff that this
constraint is load-bearing, not decorative: the OLD unconstrained v1
putCounter fact false-matched Aerith Gainsborough's and Zack Fair's own
dies/lifegain-payoff `target:'self'` counter sinks (2 lines); the new,
correctly-scoped fact no longer does — a real correctness fix, not a
regression (this card's counters never land on Aerith or Zack Fair).

**Scenarios**: consolidated the old 2 standalone `harness.ts` scenarios
(hand-cast, separate graveyard-cast) into ONE engine-piloted
`runEngineScenarios()` playthrough, per the task's own explicit instruction
mirroring fin/20/50's precedent — cast hand, resolve (token, no counters),
cast again via Flashback from the same real graveyard instance, resolve
(second token + 2 counters). `libraryCount: 1` (just the pilot's own CR
103.8a setup draw — this card never draws/searches, unlike dreams-of-
laguna/from-father-to-son which both need library padding for their own
real effects).

Ran `compute-annotations.mjs retrieve-the-esper` (6/6 real, no manual
indices) and `compute-weights.mjs --slug=retrieve-the-esper` (real
magnitudes: 1 on every fact except putCounter, which gets 4 — magnitude 2
steeply bucketed, matching the OLD pre-migration v1 file's own `value:4` on
that same effect, an independent consistency check). Added
'retrieve-the-esper' to `annotation-coverage.mjs`'s `ANNOTATED_CARD_SLUGS`.

**Verified**: `verify-synergy.mjs` scoped -> 0 hard failures (only the
accepted `tapForMana` soft notes every engine-piloted Flashback card gets).
Full pool (317 v2 checked): 9 hard failures, none on retrieve-the-esper —
confirmed via `git status` all 9 (cargo-ship, cecil-dark-knight-cecil-
redeemed-paladin, dragoon-s-wyvern, ice-flan, il-mheg-pixie, stiltzkin-
moogle-merchant, the-wind-crystal, white-auracite, zack-fair) are under
active concurrent edit by other live sessions during this task (heavy
concurrent multi-session flux confirmed throughout — same phenomenon
several other same-day entries in this file already document).
`annotation-coverage.test.ts` also currently fails pool-wide, but isolated
to this card alone (`findMissingAnnotations` with `slugs:
['retrieve-the-esper']`) -> zero violations; the real failures are on
'the-prima-vista'/'the-lunar-whale', two other in-flight concurrent
migrations whose own allowlist entries appeared in `annotation-
coverage.mjs` during this same task, not added here. `vitest run
functional-model`: 238/238 unchanged. `find-synergies.mjs` diff (isolated
via a temp `git show HEAD:<path>` swap of just this card's own
synergy.json, restored immediately after): BEFORE 27 lines (12 v1
"battlefield presence" + 13 "graveyard presence" + 2 "counters" false
matches) -> AFTER 25 lines (same 12/13 relabeled "enters the
battlefield"/"moves to graveyard", expected renames; the 2 "counters"
matches correctly lost per the real target-scoping fix above). Net -2,
fully accounted for, a correctness fix not a loss.

No Forge verification needed — Flashback/token-creation/conditional-counter
mechanics are all already-real, already-cited engine machinery
(`card.ts`'s `alternateCosts`, `createToken`/`putCounter` actions); this
pass is a fact-model/vocabulary migration, not new engine mechanics.

## The Prima Vista (fin/64) migrated to unified Fact model (2026-09-12)

Real oracle text (`data/fin/fin_scryfall.json` #64) confirmed unchanged from
pre-existing `definition.ts`: `{4}{U}` Legendary Artifact — Vehicle, 5/3,
"Flying / Whenever you cast a noncreature spell, if at least four mana was
spent to cast it, ... becomes an artifact creature until end of turn. /
Crew 2 (...)". Crew's own real engine machinery (`crewCost`/`activationCost`
+ `animate` Effect) was already closed/Forge-grounded before this task
(magitek-armor/cargo-ship precedent) — reused verbatim, no engine changes.

**5 source facts**: baseline self-cast/self-enters (typeLine-anchored,
`isActivationCostPermanentBaselineFact`-exempted); TWO `grantType`
consequence facts (deliberately not collapsed to one — 2 real, textually
distinct clauses reach the identical "becomes an artifact creature" result,
and `annotations-authoring.json` only supports one highlight span per fact
index, so each clause gets its own real anchor and its own fact, same
"duplicate but real" pattern already established pool-wide); a `crew` ACT
fact. Both `grantType` facts get real trace evidence for free from the
existing `producedEvents` case `'animate'` (any real `fn:'animate'` line ->
one `grantType` event per type) regardless of which of the 2 real paths
(cast-trigger scenario vs. Crew scenario) produced it — neither needed a new
exemption.

**2 sink facts**: (1) NEW-to-this-card but not new vocabulary — reused
Venat, Heart of Hydaelyn's own generic `{event:'cast', target:{types:{...}}}`
Constraints-shaped pattern (not a bespoke per-variant event name) for
"wants you to cast a noncreature spell", narrowed with `types:{not:
['Creature']}` + an honest-but-currently-unsatisfiable `cmc:{min:4}` for "at
least four mana was spent". New `TRIGGER_EVENT_MAP` entry:
`onCastNoncreatureSpell4Mana: 'cast'`. (2) the standard Vehicle "wants a
creature to crew" sink, `isCrewCostCreatureWant`-exempted (fully structural/
`crewCost`-scoped, reused with zero changes).

**Confirmed real engine gap, deeper than the already-known `cmc` gap, NOT
closed**: "at least four mana was spent to cast it" has ZERO tracking
anywhere in this engine — grepped `functional-model/*.ts` for `manaSpent`/
`spentMana`/`totalManaSpent`/"mana spent": no hits at all. This is strictly
deeper than `CardDefinition.cmc`'s pool-wide opt-in-field gap (Phoenix Down,
same day): even a fully-populated `cmc` would only approximate "mana spent"
(mana VALUE), not the literal amount a player chose to pay, which CR
601.2h/706 lets exceed mana value via kicker/additional/alternative costs.
Kept the `cmc:{min:4}` constraint anyway per the "correctness over match
count" precedent (Phoenix Down). **Also independently confirmed** (not new,
re-surfaced): this sink is additionally blocked by the pre-existing
`isZoneFact` shape-gate every self-cast producer already hits — every real
`self-cast` fact pool-wide carries a real `from:'Hand'` (making it
zone-shaped), so an event-only `cast` sink like this one or Venat's own
`onCastLegendarySpell` can only ever match an event-shaped producer under
today's matcher. Verified via a real `find-synergies.mjs` run that Venat's
own identically-shaped sink already produces 0 real matches pool-wide today
— same expected 0-match state for this card's own sink, not a new bug.

**Verified**: scoped `the-prima-vista` — 0 hard failures, 1 pre-existing/
accepted soft note (Legend-rule keyword-scenario, same as every other
migrated Legendary card). Full pool (317 checked, 4 skipped): 9 hard
failures, all confirmed pre-existing/concurrent peer-session work via `git
status` (cargo-ship, cecil-dark-knight-cecil-redeemed-paladin, dragoon-s-
wyvern, ice-flan, il-mheg-pixie, stiltzkin-moogle-merchant, the-wind-crystal,
white-auracite, zack-fair) — none touch this card or its new vocabulary.
`vitest run functional-model`: 238/238. `tsc --noEmit`: unchanged baseline.
`find-synergies.mjs` diff (isolated via `git show HEAD` swap, zero collateral
change anywhere else): 20 -> 150 lines. Lost all 20 old lines (17 "graveyard
presence" + 3 "dying") — the old v1 file's bare self-graveyard/self-dies
facts had no basis in this card's own real text (a Vehicle with no death-
matters ability), correctly removed same as magitek-armor/cargo-ship's own
identical old-fact removal. Gained 150 (81 "battlefield presence" + 62
"enters the battlefield" + 5 "moves to battlefield (from exile)" + 1 "from
library" + 1 self-interaction), all via the new crew-creature sink matching
real creature producers pool-wide + self-enters's own outbound matches.
Zero `grantType`/`crew`/`cast` matches either direction — new vocabulary
(first two) / shape-gate-blocked (`cast`), same "vocabulary now real,
matched later" shape every prior promotion established. Scenarios left
unchanged (3, pre-existing: cast-trigger, Crew 2, keyword-scenario Legend
rule) — the Crew scenario alone already demonstrates the real, achievable
mechanism per the "default 1" rule; the cast-trigger scenario was kept
because it independently backs one of the two real `grantType` facts with
genuine trace evidence, not decorative. Files touched: `cards/the-prima-
vista/{synergy.json,progress.json}` + new `annotations-authoring.json`,
`scripts/verify-synergy.mjs` (new `TRIGGER_EVENT_MAP` entry),
`scripts/annotation-coverage.mjs` (`ANNOTATED_CARD_SLUGS` += the-prima-
vista). `definition.ts`/`scenarios.ts`/`trace.json` unchanged (already
correct pre-migration).

**Open Forge-verification**: none needed — Crew/`animate` were already
Forge-grounded before this task; this pass is fact-vocabulary/matcher-gap
documentation only, reusing already-cited engine machinery. The 2 gaps
above (mana-spent tracking, isZoneFact shape-gate) are matcher/engine
observations for a future session to pick up, not claims requiring a new
Forge citation.

## The Lunar Whale (fin/60) migrated to unified Fact model (2026-09-12)

Real oracle text (`data/fin/fin_scryfall.json` #60) confirmed: `{3}{U}`
Legendary Artifact — Vehicle, 3/5, "Flying / You may look at the top card of
your library any time. / As long as The Lunar Whale attacked this turn, you
may play the top card of your library. / Crew 1" — no reminder-text
parenthetical on this printing's Crew line (unlike Cargo Ship's), confirmed
directly off the real oracle_text string, not assumed.

Flying — bare printed keyword, no fact (standing rule). "Look at top card
any time" — no fact at all: pure information-only static permission,
nothing for a sink to consume, no state change, same "nothing real to
anchor to" reasoning Summon: Bahamut's deleted `self-battlefield` already
established.

Crew 1 — reused the EXACT real `crewCost`+`activationCost`+
`effects:[animate]` machinery Cargo Ship/Magitek Armor/The Prima Vista
already established (ENGINE_GAPS.md Crew N entry, CLOSED), zero engine
changes. `event:'crew'`/`event:'grantType'` SOURCE facts and the
creature-crew-cost sink all get real trace evidence or exemption for free
from EXISTING, already-structural machinery (`isActivationCostPermanentBaselineFact`,
`isCrewCostCreatureWant`, `producedEvents`'s `'activate'`/`'animate'`
cases) — none of these needed new code, confirming they generalize past
card name as designed.

**New real gap found + fact-modeled anyway**: "As long as The Lunar Whale
attacked this turn, you may play the top card of your library" is a real,
DOUBLE engine gap, both halves checked directly (not assumed):
1. No persistent "attacked this turn" condition exists anywhere on
   `RealCard`/`GameState`. `engine.ts`'s own `GameEngine.attackers` is the
   closest real thing — a fresh list set by `declareAttackers` each combat
   — but nothing ever reads it again later in the turn as a per-permanent
   condition, and it isn't scoped/cleared the way a real turn-long flag
   would need to be.
2. No Effect kind in `card.ts` lets a card "play" (CR 601/305's own
   umbrella term — casting OR a land drop, whichever the top card's own
   type turns out to be) a card straight off the library. `dig`
   (`DigEffect`, the closest existing shape, already real/wired for Ashe,
   Princess of Dalmasca's own attack-trigger tutor) only ever moves cards
   to hand or the library bottom — it never resolves one as a cast/land-
   drop. The Regalia (fin/58) hit an adjacent version of this same gap for
   its own attack-triggered dig-until effect (documented in its own
   `definition.ts` comment, pre-existing, unmigrated card).
Modeled as a real fact anyway (`event:'play'`, `from:'Library'`,
`controller:'you'`) — genuinely new vocabulary, checked no other pool card
declares `event:'play'`. `from:'Library'` is the one guaranteed part of the
act; `to` deliberately omitted — the real destination genuinely varies
(Battlefield direct for a land, the deliberately-invisible Stack for
anything cast), same double reasoning `self-enters`'s own omitted
`zoneFrom` already established (SYNERGY_DESIGN.md's Stack-invisibility
rule). Added `describeFact` branch (`'play'` -> `'play a card'`) and a new,
card-scoped `isLunarWhalePlayFromLibraryFact` exemption
(`scripts/verify-synergy.mjs`, same "real fact, real documented engine gap,
zero possible trace evidence" treatment `isAuronsInspirationBroadcastPumpFact`/
`isSummonAlexanderDamagePreventionFact` already established) since NEITHER
half of the gap can ever produce trace evidence, regardless of scenario
authoring effort. New `ENGINE_GAPS.md` entry #15 documents both halves in
full. Traveling Chocobo (fin/158, unmigrated) carries the textually
identical clause ("You may play lands and cast Bird spells from the top of
your library") and can reuse this same vocabulary/exemption once migrated
— flagged in both the exemption's own comment and `definition.ts`, not
preemptively generalized/renamed.

Removed the old v1 facts entirely: a presence-shaped `{zone:'Graveyard',
subject:'self'}` SOURCE + a bare `{event:'dies', target:'self'}` — both a
real violation of the standing "no presence in sources, only zone
movements" rule (same class as Summon: Bahamut's deleted
`self-battlefield`), neither had any real annotation basis (a Vehicle with
no death-matters ability of its own). Also removed
`CardDefinition.staticAbilities` entirely — checked it isn't consumed by
anything relevant to a v2-migrated card (only legacy `synergyTags()`/
`manaAbilityColorFromStaticText`, neither applicable here) — the two static
lines now live only as `definition.ts` comments, matching Cargo Ship's own
treatment of its bare-keyword lines.

**Scenario**: kept the single pre-existing scenario unchanged
(`{result:'becomes an artifact creature (crewed)', you:{creaturesCount:1}}`)
— already the minimal real-Crew-probe shape Cargo Ship/Magitek Armor
converged on, satisfies the task's own "1 default scenario" instruction.
Did NOT attempt a full engine-piloted crew-then-attack trace via
`engine-trace.ts` — traced why directly rather than assuming: `pilotActivate`
calls `activateAbility(pilot.engine, controller, permanent, card, ctx,
actions)` with NO `crewedBy` argument at all, and `activateAbility`'s own
`crewCost` branch does `for (const c of crewedBy!) engine.state.tap(c)` —
this THROWS on `undefined` today, so `pilotActivate` cannot legally
activate ANY `crewCost` card through the real full engine pilot right now,
not just this one. A `pilotCrew` helper (passing a real `crewedBy` list
through) is real, separate, cross-cutting `engine-trace.ts` work — flagged
as a new, previously-undocumented gap (added to `progress.json.knownGaps`,
not yet promoted to `ENGINE_GAPS.md` since it's about the TRACE HARNESS,
not `engine.ts` itself, which already closed Crew for real) — out of scope
for a single-card fact migration, same boundary Cargo Ship's own
crewedBy-simulation gap already draws.

**Verified**: scoped `the-lunar-whale` — 0 hard failures, 1 pre-existing/
accepted soft note (Legend-rule keyword-scenario `legendRule` trace with no
matching produce — same accepted note The Prima Vista's own real
synergy.json already produces for the identical reason: neither Legendary
Vehicle declares a self-dies fact for the auto-added legend-rule scenario).
Full pool (317 checked, 4 skipped): 9 hard failures (cargo-ship,
cecil-dark-knight-cecil-redeemed-paladin, dragoon-s-wyvern, ice-flan,
il-mheg-pixie, stiltzkin-moogle-merchant, the-wind-crystal, white-auracite,
zack-fair) — confirmed NOT caused by this task via `git status` (none
reference the-lunar-whale or this card's new `event:'play'` vocabulary;
`annotation-coverage.mjs` itself was being concurrently edited by a peer
session mid-task, confirmed by a file-changed-on-disk notice while adding
this card's own slug — merged cleanly, re-verified after). `npx vitest run
functional-model`: 238/238 (the pool-wide `annotation-coverage.test.ts`
failure seen separately, `ice-flan`-only, is the same pre-existing/
concurrent issue, not this card). `tsc --noEmit`: no new errors from this
card's changes (`synergy.ts`'s new `'play'` branch, `verify-synergy.mjs`'s
new exemption — both grepped post-change, zero `the-lunar-whale`/
`synergy.ts` hits). `find-synergies.mjs` diff (isolated: `git show HEAD`
swap for just this card's `synergy.json`, full pool-wide run, filtered to
"Lunar Whale" lines both ways, then restored + re-run to confirm the final
committed state — not a stale HEAD diff, working tree has diverged too far
across concurrent sessions for that to isolate cleanly): before 20 lines
(17 illegitimate "graveyard presence" + 3 "dying", all removed per the
dropped tautological v1 facts); after 150 lines (112 real "X --[battlefield
presence/enters the battlefield]--> Lunar Whale" via the new crew-cost
creature-want sink matching every unconstrained creature-presence/
entersBattlefield producer pool-wide, 38 real "Lunar Whale --[enters the
battlefield]-->X" via self-cast/self-enters). Zero matches yet for
`crew`/`grantType`/`play` (new vocabulary, no pool consumer exists today) —
same "vocabulary now real, matched later" shape every prior promotion
established. Net well-understood, same shape as Magitek Armor's 12->152 and
Cargo Ship's 35->145. Files touched: `cards/the-lunar-whale/
{definition.ts,synergy.json,progress.json,trace.json}` + new
`annotations-authoring.json`; `scripts/verify-synergy.mjs` (new
`isLunarWhalePlayFromLibraryFact` + wiring), `scripts/annotation-
coverage.mjs` (`ANNOTATED_CARD_SLUGS` += the-lunar-whale), `synergy.ts`
(new `describeFact` branch for `event:'play'`), `ENGINE_GAPS.md` (new gap
#15). `scenarios.ts` unchanged (already correct pre-migration).

**Open Forge-verification**: none needed for Crew/`animate` (already
Forge-grounded before this task, reused verbatim). The two new gap halves
above (no attacked-this-turn tracking, no play-from-library-top Effect
kind) are genuine, checked-directly ENGINE ABSENCES, not Forge-citation
questions — there's no real Forge mechanism to mirror-cite here beyond what
`ENGINE_GAPS.md`'s own new entry #15 already states (CR 601/305's real
"playing" definition is cited there). The new `pilotCrew`/`crewedBy`-in-
`engine-trace.ts` gap is a harness-completeness item for a future session,
not a Forge-verification question either.

## Ice Flan (fin/55) migrated to unified Fact model (2026-09-12)

Oracle: "When this creature enters, tap target artifact or creature an
opponent controls. Put a stun counter on it." / Islandcycling {2}
(discard-as-cost tutor for a basic Island). Real stun-counter engine
support already existed and is well-precedented (`state.ts`'s
`putCounter`/CR 122.1d untap-absorption, `state.test.ts`; 6 other pool
cards — Tonberry, Summon: Shiva, Ultros, Aerith Rescue Mission, Omega
Heartless Evolution — already source `counterType:'stun'`), so this was a
pure Fact-authoring task, no new engine work needed.

Facts: baseline `self-cast`(Hand)/`self-enters`(Battlefield), typeLine-
anchored ("Creature" — Elemental Ooze). The ETB ability split into its own
two real sentences, both `controller:'opp'`/`targeted:true`, and both
BROADENED from the engine's own narrower `definition.ts` modeling (which
only implements `validType:'creature'`, since no `tapTarget`/
`putCounterTarget` validType covers an "artifact or creature" disjunction)
to the full real oracle scope via `target:{types:{hasAny:
['Artifact','Creature']}}` — a Fact should describe what the CARD says,
not what the engine happens to execute; the narrower engine behavior is a
separately documented, pre-existing, unrelated gap (definition.ts's own
comment already flagged it, dated 2026-09-04). Same broadening applied to
the target-precondition sink (`to:'Battlefield'`, was legacy `zone`).

Islandcycling modeled as two facts mirroring Cloudbound Moogle's own
Plainscycling exactly, per the standing per-card-cycling-fact precedent
(SYNERGY_DESIGN.md, 2026-09-11): SINK `{event:'discard', target:'self'}`
(the discard-as-COST act) + SOURCE `{to:'Hand', from:'Library',
types:{has:['Island']}}` (the tutor, `tutor` `ZONE_MOVEMENT_NAMES` label
reused from Ashe/Cloud/Cloudbound Moogle). Zero possible trace evidence
for either half (Islandcycling lives only as `staticAbilities` text, never
a resolvable `Effect`) — two new verify-synergy.mjs exemptions,
`isIceFlanDiscardSelfWant`/`isIceFlanTutorFact`, same per-card-scoped shape
(not generalized into one shared TypeCycling exemption — noted as the
natural next step once a THIRD real cycling card needs it; malboro/
hill-gigas/balamb-t-rexaur/capital-city/cid-timeless-artificer remain
unmodeled). No separate scenario for Islandcycling — matches Cloudbound
Moogle precedent exactly (fundamentally unmodelable via any Effect, so
there is no "chain both modes into one scenario" shape to apply here,
unlike the fin/20/fin/50 flashback-consolidation precedent where BOTH
modes genuinely resolve through the engine).

Scenarios converted from top-level `trigger:'onEnter'` to no-top-level-
trigger + `sequence:['onEnter']` (the dwarven-castle-guard/cloudbound-
moogle consolidation, 2026-09-11) so the baseline self-cast/self-enters
facts get real `fn:'cast'`/`fn:'enters'` trace evidence via `selfZone`'s
real Stack->cast->resolve->enters lifecycle, instead of depending on
`isActivationCostPermanentBaselineFact` (which doesn't apply here — Ice
Flan has no `activationCost`). Re-ran `run-scenarios.mjs --slug=ice-flan`
after the scenario edit; `verify-synergy.mjs ice-flan` now passes clean
(no exemption needed for the baseline facts at all).

Verification: `verify-synergy.mjs` scoped (`OK`) and full pool (317
checked, 8 pre-existing failures — cargo-ship, cecil-dark-knight,
dragoon-s-wyvern, il-mheg-pixie, stiltzkin-moogle-merchant, the-wind-
crystal, white-auracite, zack-fair — all from OTHER concurrent sessions'
own in-flight migrations, confirmed by their own non-trace.json files
being simultaneously modified; none are this card). `vitest run
functional-model`: 238/238, unchanged. `find-synergies.mjs` before/after,
isolated via `git stash push -u -- functional-model/cards/ice-flan` (not a
stale-HEAD diff — this repo has many concurrent sessions' own uncommitted
work across ~40 other card directories right now, so a HEAD-based diff
would have been noisy; stashing just this card's own files scopes cleanly
without touching anyone else's in-progress edits): before 0 "Ice Flan"
lines at all (the old schema's `controller:'opp'`-scoped facts were
real but genuinely matched nothing pool-wide — not a bug, just narrow,
rare vocabulary); after 142 (140 "enters the battlefield" — the same
pool-wide unconstrained-battlefield-presence-sink pattern every other
newly-migrated baseline `self-enters` fact produces — + 2 real "tutor"
matches, Nibelheim Aflame and The Water Crystal, the identical 2 cards
Cloudbound Moogle's own Plains tutor already matches, confirming the new
Island tutor fact works). The tap/putCounter(stun)/target-precondition-
sink/discard-self facts still produce 0 matches both before and after —
real, documented, narrow-vocabulary gaps (no other pool card sources a
literal `discard` event or wants a `tap`/`putCounter:'stun'` producer
yet), not fabricated evidence.

**IMPORTANT process note for future sessions, learned the hard way this
task**: `run-scenarios.mjs` with NO `--slug=` filter regenerates the
ENTIRE pool's `trace.json` files in one process — and because this
engine's own object-id counter is a single incrementing counter shared
across a whole process run, every OTHER card's `trace.json` in the pool
picks up different (but usually semantically-identical) numeric `id`
values purely from being regenerated in the same run, showing up as a
large, noisy git diff across ~300 unrelated files. Always pass
`--slug=<card-slug>` (not a bare positional arg — the script only reads
`--slug=`, a bare arg is silently ignored and it falls back to running the
whole pool) when regenerating a single card's trace. This task accidentally
triggered a pool-wide regen once; recovered by identifying which of the
touched directories had ONLY a `trace.json` diff (safe to restore, no
concurrent work in progress there) vs. directories where OTHER files
(scenarios.ts/definition.ts/synergy.json) were ALSO modified (left
alone — those are real concurrent sessions' own in-flight migrations;
touching their `trace.json` further would either destroy or fight their
own work). No file outside `ice-flan/` and the two `scripts/*.mjs`
edits ended up modified by this task once cleanup finished — verified via
`git status --porcelain` scoped to just this card's own directory before
finishing.

**Open Forge-verification**: none needed — stun counters (CR 122.1d) and
Islandcycling (CR 702.29, a lands-matter cycling variant) are both
already-cited, already-precedented mechanics in this pool; nothing new to
verify against Forge for this card specifically.

## Qiqirn Merchant (fin/65) migrated to unified Fact model (2026-09-12)

Real oracle: "{1}, {T}: Draw a card, then discard a card." / "{7}, {T},
Sacrifice this creature: Draw three cards. This ability costs {1} less to
activate for each Town you control." First real `CardDefinition.abilities`
card in the pool (TWO independent named activated abilities, no top-level
`activationCost`) — see `SYNERGY_DESIGN.md`'s own new dated entry for the
full writeup; summary here.

**Fixed a real, general `engine-trace.ts` gap**: `pilotActivate` had no way
to pilot a NAMED ability at all — it always called `canActivateAbility`/
`activationCostFor` with no `abilityName`, which only ever reads
`card.activationCost` (undefined for a `card.abilities`-shaped card).
Added an optional `abilityName?: string` param (appended after the
existing `label?`, backward-compatible — all prior positional callers
unaffected), threaded to `canActivateAbility`/`activateAbility`/
`activationCostFor` (`engine.ts`, which already supported it). Verified
zero-diff impact on every prior caller by re-running the full suite (238/
238 unchanged) and full-pool `verify-synergy.mjs` (same 8 pre-existing,
unrelated failures from other concurrent sessions before and after).

**Migrated to `runEngineScenarios()`, ONE scenario** (per the "default 1,
chain independent abilities into one story" standing rule — this is NOT
branching/modal, just two small real abilities): real cast -> real turn
passage (clears summoning sickness) -> real `"cantrip"` activation (now
piloted for real via the fixed `pilotActivate`, INCLUDING a real `fn:'tap'`
line for its own `{T}` cost, thanks to the pre-existing Venat-motivated
tap-logging fix in `pilotActivate`) -> real `"bigDraw"` activation, fired
directly via `resolveCard(qiqirnMerchant, ctx, actions, undefined,
'bigDraw')` since its own "Sacrifice this creature" cost is a NAMED
self-sacrifice `unsupportedCostComponent` never accepts (same real,
general limitation Zack Fair's own "{1}, Sacrifice Zack Fair" hits —
mirrored that card's exact technique).

**7 real SOURCE facts, 0 SINK** (no board-state-consumption clause in the
real text): baseline `self-cast`(Hand)/`self-enters`; ONE shared
`{event:'tap', subject:'self', target:'self'}` self-tap-cost fact covering
BOTH abilities' own real `{T}` (same concept regardless of which ability
pays it — no need for two); `"cantrip"`'s own real `{event:'drawCard'}` +
`{event:'discard', controller:'you'}` (the discard is part of the
ability's own EFFECT, not a cost — modeled as a produced SOURCE fact,
deliberately NOT the same shape as Cloudbound Moogle's Plainscycling
discard-as-COST SINK — flagged the standing SOURCE-vs-SINK discard
inconsistency again rather than silently resolving it, same as Coeurl's
own entry already does for tap/sacrifice); `"bigDraw"`'s own real
`{event:'sacrifice', subject:'self', target:'self'}` cost-payment act
(mirrors Zack Fair, exempted via the already-generalized, shape-based
`isSelfSacrificeActivationCostFact` — zero code change needed) and its OWN
separately-anchored `{event:'drawCard'}` fact (same event name as
cantrip's, but anchored to its own distinct real oracle sentence —
verify-synergy's forward check is event-name-only so this is a deliberate,
accepted looseness, not a bug).

**New general `producedEvents` promotion in `verify-synergy.mjs`:
`case 'discard'`** (event-shaped sibling of the pre-existing zone-shaped
`producedZone` discard case, same "one action, two fact shapes" pattern
`sacrifice`/`destroy` already have) — needed for `"cantrip"`'s own discard
fact to have any possible forward evidence at all. **Verified zero
pool-wide side effects**: 18 other real pool cards have a genuine
`fn:'discard'` trace line (adventurer-s-airship, emet-selch-unsundered,
joshua-phoenix, locke-cole, malboro, formidable-speaker, kefka, hecteyes,
poison-the-waters, jecht, giott, nibelheim-aflame, rook-turret, sidequest-
card-collection, ninja-s-blades, rydia-summoner-of-mist, summon-g-f-ifrit,
plus qiqirn-merchant itself) — ran `verify-synergy.mjs` on all 18 with and
without this promotion (temporarily stripped the added case via a scratch
regex edit, restored after): byte-identical output both times, confirming
none of those 17 OTHER cards' own pass/fail/note status depends on this
new `eventOk` path (they're all already explained via `zoneOk`, the
pre-existing Graveyard-zone evidence). Safe, general, zero-risk promotion.

**Dropped the pre-migration file's own stray, unbacked `{zone:'Graveyard',
controller:'you', value:1}` source fact** rather than migrating it forward
— same situation as Zack Fair's own self-sacrifice (this model never
actually moves the permanent off the battlefield when the cost is merely
documentary, so there's no more real evidence for a graveyard-consequence
fact here than there was for Zack Fair's identical shape, which also has
none). Consulted precedent before dropping, not an arbitrary call.

**ENGINE_GAPS.md gap #7 extended** to explicitly cover ACTIVATED-ABILITY
cost reduction (not just spell-cast cost reduction) — Qiqirn Merchant's own
per-Town discount on `"bigDraw"` is the third real example, confirming the
missing-discount-hook gap applies to `activationCostFor` too, not just
`canCastSpell`.

**Verification**: `verify-synergy.mjs qiqirn-merchant` — 0 hard failures
(only pre-existing, unrelated generic `tapForMana`/`untap` soft notes every
engine-piloted turn-passage scenario produces, confirmed present on
Stiltzkin/Venat too). Full pool: 317 checked, 8 pre-existing hard failures
(cargo-ship, cecil-dark-knight, dragoon-s-wyvern, il-mheg-pixie, stiltzkin-
moogle-merchant, the-wind-crystal, white-auracite, zack-fair — all from
OTHER concurrent sessions' own in-flight work per `git status`, none this
card). `vitest run functional-model`: 238/238. `find-synergies.mjs`,
isolated via a before/after synergy.json swap (not a HEAD diff — too much
pool-wide concurrent noise right now, same reasoning `ice-flan`'s own
entry above already used): **9 lost** (the old stray Graveyard fact's own
9 real type-constrained matches — Cantankerous Keepers, Eden Seat of the
Sanctum, Emet-Selch Unsundered, Ignis Scientia, Magic Pot, Qutrub Forayer,
Rydia's Return, Thranduil Sindarin Liege, Vanille Cheerful l'Cie — a real,
accounted-for tradeoff, not a silent regression), **141 gained** (139 new
"enters the battlefield" matches via the new baseline `self-enters` fact,
which this card had none of before; 2 new real "discard" matches —
Cloudbound Moogle, Ice Flan — via the new discard-as-effect SOURCE fact
matching their own discard-as-cost SINK wants by bare event-name equality,
same loose-but-accepted matching this design already tolerates elsewhere).
The self-tap-cost/self-sacrifice-cost/both drawCard facts: 0 matches either
direction — real, documented, narrow/zero vocabulary gaps (no other pool
card wants an unconstrained `tap`/`sacrifice`/`drawCard` producer yet),
not fabricated.

**Known limitation, not fixed**: `compute-weights.mjs --slug=qiqirn-merchant`
gave BOTH `drawCard` facts the same `value` (1) despite one representing a
1-card draw and the other a 3-card draw — the script has no way to
distinguish two facts of the identical shape when reading magnitude off
the trace (no id/annotation-based linking). Consistent with the already-
accepted "`Fact.value` accuracy is a known, deliberately deprioritized
non-priority" standing note (2026-09-11) — not re-litigated, just flagged
as a fresh concrete instance of it.

**Open Forge-verification**: none needed — real oracle text confirmed
directly against `data/fin/fin_scryfall.json` (collector_number 65,
mana_cost `{2}{U}`, power/toughness `1`/`4`, type line "Creature — Beast
Citizen" — matches `definition.ts` exactly). This pass is a fact-model/
vocabulary migration plus one small, general `engine-trace.ts` plumbing
fix, not new engine mechanics — nothing further to verify against Forge.

## Rook Turret (fin/69) migrated to unified Fact model (2026-09-12)

"Flying / Whenever another artifact you control enters, you may draw a
card. If you do, discard a card." Bare printed Flying: no fact (standing
rule). 4 SOURCE facts: baseline self-cast/self-enters (typeLine-anchored,
"Creature"), real optional `{event:'drawCard', controller:'you'}` +
`{event:'discard', controller:'you'}` loot pair (the "if you do" gate is
documentary-only, same convention every other optional effect here uses).
1 SINK fact for the trigger condition: `{event:'entersBattlefield',
controller:'you', types:{has:['Artifact']}}` — matched to the REAL
existing pool precedent (loporrit-scout's `types:{has:['Creature']}`,
woodland-weavemaster's `types:{has:['Elf']}`), NOT the zone-shaped
`{to:'Battlefield', types:...}` shape the task brief suggested — checked
both precedents first rather than inventing a third shape for the
identical trigger pattern. Added `TRIGGER_EVENT_MAP['onArtifactEnters'] =
'entersBattlefield'` (verify-synergy.mjs) — left unmapped until now per
this doc's own "add when a card declares the want" rule; also the trigger
name on golbez-crystal-collector/tidus-blitzball-star (checked, pool-wide
grep) but the map only ever ADDS forward-evidence, confirmed 0 new
failures for either. Consolidated to 1 scenario: dropped the old top-level
`trigger: 'onArtifactEnters'` shortcut (zero cast/enters evidence — a real
hard failure on first verify-synergy.mjs run) for `sequence:
['onArtifactEnters']` after a real cast->resolve->enters lifecycle, same
dwarven-castle-guard/cloudbound-moogle consolidation. Dropped the
pre-migration file's own stray, unbacked `{zone:'Graveyard'}` source
fact — no real basis in this card's oracle text, same call already made
for Zack Fair/qiqirn-merchant's identical shape.

**Real, newly-surfaced (not caused by this migration) matcher gap**: an
event-shaped want's own bare `types` constraint (declared directly on the
fact, not wrapped in `target`) is NEVER read by `factsInteract`'s
event-to-event branch — only `target` (`'self'` or a `Constraints` object)
is consulted there; a bare `types` falls through to the branch's final
"bare event hook" `return true`, matching ANY producer of the same event
regardless of its own type. Confirmed via the real diff: this card's new
sink gets 13 false-positive matches from the pool's 13 unconstrained
`entersBattlefield` SOURCE facts (Baron Airship Kingdom, Crossroads
Village, Elrond Moon-Reader, Gohn Town of Ruin, Gongaga Reactor Town,
Guadosalam Farplane Gateway, Insomnia Crown City, Rabanastre Royal City,
Sharlayan Nation of Scholars, The Gold Saucer, Treno Dark City, Vector
Imperial Capital, Windurst Federation Center) — all LANDS. Verified this
ISN'T new: loporrit-scout's/woodland-weavemaster's own identically-shaped
`types`-only wants already match the same 13 lands today too. Same class
of pre-existing, already-accepted imprecision as the documented Cloud
Midgar Mercenary `entersBattlefield`-as-sink vacuous-match finding — left
as-is (a real fix touches `factsInteract`'s event branch for 3 cards at
once, out of scope for a single-card migration), flagged in full in
SYNERGY_DESIGN.md's own 2026-09-12 Rook Turret entry and this card's own
progress.json `knownGaps`, not silently tolerated.

**Verification**: `verify-synergy.mjs rook-turret` — 0 hard failures. Full
pool: 317 checked, 8 pre-existing hard failures (cargo-ship, cecil-dark-
knight-cecil-redeemed-paladin, dragoon-s-wyvern, il-mheg-pixie, stiltzkin-
moogle-merchant, the-wind-crystal, white-auracite, zack-fair — all other
concurrent sessions' in-flight work per `git status`, none touching this
card or the TRIGGER_EVENT_MAP/ANNOTATED_CARD_SLUGS additions). `vitest run
functional-model`: 238/238. `tsc --noEmit -p functional-model/tsconfig.json`:
47 pre-existing errors, unchanged. `find-synergies.mjs`, isolated via a
scoped `git stash push -u` A/B on exactly this card's own 4 files (not a
HEAD diff — pool too concurrently noisy today): **9 lost** (the dropped
stray Graveyard fact's own matches — Cantankerous Keepers, Eden Seat of
the Sanctum, Emet-Selch Unsundered, Ignis Scientia, Magic Pot, Qutrub
Forayer, Rydia's Return, Thranduil Sindarin Liege, Vanille Cheerful
l'Cie), **165 gained** (152 generic "enters the battlefield" matches via
the new baseline self-enters fact against the pool's unconstrained
Battlefield-presence sinks; 13 the false-positive matcher-gap matches
documented above).

**Open Forge-verification**: none needed — real oracle text confirmed
against `data/fin/fin_scryfall.json` (collector_number 69, `{3}{U}`,
"Artifact Creature — Construct" — matches definition.ts exactly); pure
fact-model/vocabulary migration, no new engine mechanics.

## Sage's Nouliths (fin/70) migrated to unified Fact model (2026-09-12)

Same Job-select-Equipment batch as dragoon-s-lance/machinist-s-arsenal/
paladin-s-arms/white-mage-s-staff/astrologian-s-planisphere — astrologian's
own migration used as the freshest structural precedent (Job-select ETB
shape, grantType exemption pattern). Real oracle (data/fin/fin_scryfall.json
#70): "Job select (...create a 1/1 colorless Hero creature token, then
attach this to it.) / Equipped creature gets +1/+0, has 'Whenever this
creature attacks, untap target attacking creature,' and is a Cleric in
addition to its other types. / Hagneia — Equip {3}." No Equip reminder text
on line 2 (matches astrologian's short "Diana — Equip {2}" form, not white-
mage-s-staff's longer reminder-text line). definition.ts needed only a
comment update, no logic change.

1 legacy fact -> 6 source + 2 sink. self-cast/self-enters baseline
(typeLine-anchored "Artifact"), Hero-token-ETB (oracle-anchored, byte-
identical 40-82 span every Job-select sibling shares — confirmed the
reminder text is verbatim across the whole family), pump (+1/+0) and
grantType (Cleric) — both the usual documented-inert equip-broadcast gap
(no layer-7c pipeline), exempted by name in verify-synergy.mjs matching the
5 existing sibling exemptions. Sink split into 2 facts (unlike every
sibling's single Equip-target want): `{to:'Battlefield', controller:'you',
types:{has:['Creature']}}` (Equip target) and `{to:'Battlefield',
controller:'opp', types:{has:['Creature']}, attacking:true}` (the untap
ability's own "target attacking creature" — an opponent's creature is only
ever wanted here, never for Equip). `attacking:true` used the same
documentary-only Constraints field Auron's Inspiration established (not
consulted by satisfiesConstraints, but honestly documents the real
restriction) — first real use of `attacking` on a SINK, not just a source
target; checked it's harmless there (matcher doesn't consult it either way).

**Real, concrete answer to an open question white-mage-s-staff's own
migration explicitly flagged** ("whether a FUTURE granted triggered ability
with a real, already-wired Effect kind should be modeled executable ... or
stay inert-by-default — no v2-migrated precedent exists yet to settle it"):
this card's own granted "whenever this creature attacks, untap target
attacking creature" is the SAME conceptual "grants a whole new triggered
ability to another permanent" gap white-mage-s-staff's lifegain grant and
astrologian-s-planisphere's putCounter grant both document — but UNLIKE
those two (where the task explicitly instructed leaving the simplification
trigger unwired, staying genuinely inert), this card's own `onEquippedAttacks`
trigger was ALREADY WIRED in `definition.ts` before today (same real-source
simplification buster-sword/thief-s-knife/ninja-s-blades/ultima-weapon
establish), and its pre-existing scenario/trace already showed a genuine
`fn:'untap'` line. So the resulting fact —
`{event:'untap', target:{types:{has:['Creature']}, attacking:true},
targeted:true}` (event:'untap' promoted off PARKED_ACTION_FNS the same day
by magic-damper/fin-61) — is REAL, EVIDENCED vocabulary: verify-synergy.mjs's
forward check finds the real trace line with **no exemption needed at all**,
unlike its pump/grantType siblings. Course-corrected the dispatch's own
framing here (it asked to treat this fact "documented as inert/gap same
class" as white-mage-s-staff's lifegain grant) after checking the real
wiring/trace first — the conceptual mismodel (source is nominally the
Equipment, not the equipped creature) is the same, but the EVIDENCE status
genuinely differs, and modeling it as an unnecessary inert exemption would
have been factually wrong given real trace evidence already exists.

Collapsed scenarios.ts 3 -> 1 (`trigger:'onEnter', you:{creaturesCount:1},
sequence:[{activate:true}, 'onEquippedAttacks']`) — extends paladin-s-arms's
own "chain into one continuous story" shape with a second sequence step (a
bare trigger-name string, same shorthand ice-flan/cloudbound-moogle/summon-
knights-of-round already use for chaining multiple named triggers). This
single chain gives real evidence for BOTH sink wants at once:
`onEquippedAttacks`'s own `chooseTarget` pool reads both `you.getCreatures
InPlay()` and every opponent's `getCreaturesInPlay()` (the latter logs a
real `count:0` read even with zero opponent creatures — confirmed
verify-synergy.mjs's sink-evidence check never consults `controller` on the
supporting read before relying on this).

Added `'sage-s-nouliths'` to `annotation-coverage.mjs`'s
`ANNOTATED_CARD_SLUGS`. **Noted, not fixed**: `astrologian-s-planisphere`
is itself still MISSING from that same list despite having real annotations
on disk already — likely an omission from its own migration session earlier
today; flagged for whoever next touches that card, not fixed here (out of
scope, and file is under active concurrent editing).

All 8 facts hand-annotated via python `str.find` against the real
`oracle_text` lines (no `annotations-authoring.json` — followed
astrologian-s-planisphere's own freshest precedent, which also has none,
rather than white-mage-s-staff's older convention of always adding one).

**Verified**: `verify-synergy.mjs` scoped → OK, 0 hard/soft. Full pool → 317
checked, 8 pre-existing hard failures all on OTHER cards (cargo-ship,
cecil-dark-knight, dragoon-s-wyvern, il-mheg-pixie, stiltzkin-moogle-
merchant, the-wind-crystal, white-auracite, zack-fair — confirmed via `git
status` as concurrent peer-session edits, none touched by this task).
`vitest run functional-model`: 238/238.

**`find-synergies.mjs` diff**: -131/+56, net **-75** — the only sibling in
this whole batch with a NET NEGATIVE diff, for a real, understood reason:
this is the only card whose OLD v1 sink was fully TYPE-UNCONSTRAINED (bare
`zone:'Battlefield'`, no `types` filter, matching literally any permanent),
