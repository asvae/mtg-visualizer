# engine agent notes

Scoped working memory for the `engine` specialist. Update before finishing
any task: decisions made, open questions, current state worth resuming
from. This is what makes a fresh respawn cheap — don't rely on transcript
resume alone (session transcripts are swept after ~30 days).

## Decisions

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
