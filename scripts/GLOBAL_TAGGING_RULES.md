# Global card tagging rules

Rules for tagging any Magic: the Gathering card, from any real set across the
game's full history, against the curated global theme list
(`data/global_themes.json`). This file is set-agnostic by design — it's what
an agent updating tagging rules is expected to know: the full landscape of
real Magic mechanics, not just what one set introduced. A per-set review
agent instead gets a short, set-specific instructions doc (that set's own
idiosyncrasies, new-to-this-set mechanics not yet in this file, naming
quirks) plus a pointer back here for everything general.

This file started as a fork of the FIN custom set's `TAGGING_RULES.md` (a
Final Fantasy crossover fan set) — nearly everything in that document turned
out to already be generic, real-Magic-applicable content (Flying, Saga,
Equipment, Landfall, Devotion, Towns, Vehicles, ...); only its Job Select,
Hero, and Tiered Magic sections were FIN-original fictional mechanics, and
those were dropped here. FIN's own `TAGGING_RULES.md` keeps those three plus
its own pipeline notes (prefill script, review process) as a small overlay
on top of this file.

## Why prose instead of regex

A regex tagger doesn't scale across 30+ years of wildly different templating
conventions (old "interrupt" vs modern instant-speed abilities, pre-2000s
"summon" type lines vs modern "Creature — X", reminder text that's been
reworded release over release for the same keyword). Reading the card and
judging it against real rules text directly avoids the class of failure a
regex/mention-counter approach hits (self-matches, overlapping patterns,
reminder-text double-counting).

## Creature types

Creature subtypes (Human, Goblin, Vampire, Elemental, ...) get their THEME
auto-generated from the card's own type line — the theme exists whether or
not anyone's tagged it yet; check the app's derived type-theme list (or the
type line itself) for the exact id to use (e.g. "Goblin" -> `goblin`).

**Exception: a card's text names a creature type with no matching card in
the CURRENT set.** A payoff like "creatures named X, Y, or Z" or "if a Kraken
attacks" can reference a type this set never actually prints a creature of.
Since auto-generation only derives an id from a type line that actually
exists in THIS set's card data, that type has no theme id to tag with yet —
manually curate it into the theme list instead (same precedent as
Planeswalker/Battle/Copy/Tokens: a theme kept even with zero current
instances, ready for a set where that type gets real cards). This is the one
case creature-subtype ids get added to the curated theme list by hand
instead of purely auto-generating.

## Output shape

For each card, decide which curated themes below apply, and via which
relation type(s) (see next section). Write the result grouped by role, then
theme id, to weight — one entry per card, matching
`<set>_relations.json`:

```jsonc
{
  "name": "<exact Scryfall name, including \"//\" for DFCs>",
  "themes": {
    "produce": { "graveyard": 1 },
    "consume": { "graveyard": 2 }
  }
}
```

There's no "no theme" outcome to assign — `atypical` (see below) is generous
enough that a genuinely themeless card shouldn't come up in practice. If one
somehow does, still write an entry for it (`{ "themes": {} }` — empty themes,
but present) rather than leaving it out.

**Enrichment/review status is NOT part of this file at all (2026-08-31).** A
relations entry NEVER carries a `reviewed` (or `reviewed_at`) field — that
would mix in-development bookkeeping into data some sets (FIN, under
`data/fin/`) actually ship to end users via `public/fin`. Instead, every
card's status lives by NAME in one place, entirely outside `data/`:
`tagging/card-enrichment-status.json` — a flat object, not an array:

```jsonc
{
  "Pack Leader": { "enrichment": "ai", "review": "human" },
  "Some Vanilla Bear": { "enrichment": "script", "review": "none" }
}
```

Two independent axes, not one ladder:

- **`enrichment`** — how the THEME DATA itself was produced: `"none"` (no
  entry / nothing tagged yet), `"script"` (`strict_baseline.py`'s
  zero-judgment structural facts, or a mechanical-only prefill from
  `scripts/prefill-main-types.mjs`), `"ai"` (an agent or Codex actually read
  the card and made judgment calls), or `"human"` (a person hand-authored
  the tags directly — rare in practice, but a valid outcome).
- **`review`** — whether that data has since been independently checked:
  `"none"` (nobody's verified it), `"ai"` (a separate agent-driven
  strict-review pass confirmed it — see `HISTORICAL_SETS_PROCESS.md` step
  8), or `"human"` (confirmed by an actual person via the live review-relay
  loop — see `REVIEW_PROCESS.md`). There's no `"script"` review tier — a
  script can draft, but reviewing is inherently a judgment act.

A card only gets an entry in this file once it's past the default
(`enrichment: "none"`) — omit cards nobody's touched yet, same principle as
never writing a themeless-and-unreviewed relations entry. Never downgrade an
existing entry (don't overwrite `review: "human"` with `review: "ai"` just
because an unrelated script ran) — only add or upgrade. If you're unsure
which tier applies, take the leftmost (most conservative) one you're
actually confident in — false claims of a higher tier are worse than an
honest lower one.

**A name's status can legitimately outrun what `data/global_relations.json`
itself shows for that name.** FIN is real, currently-printed Magic — some of
its card names may already have `review: "human"` status here (via
`data/fin/fin_relations.json`) while `global_relations.json`'s own entry for
that same name is still just the historical sweep's untouched structural
baseline, because FIN hasn't been chronologically merged into the sweep yet
(see `HISTORICAL_SETS_PROCESS.md`'s "How this relates to FIN" section). When
in doubt about which payload is authoritative for a given name, check
`data/fin/fin_relations.json` first.

## Relation types (role)

- **produce** — the card generates/creates more of the theme's resource, or
  structurally IS an instance of it (e.g. the card itself is a Vehicle).
- **consume** — the card reads, reacts to, or scales off the theme's resource
  that's already present. Usually phrased as "for each X you control,"
  "whenever an X enters," "X you control get/have," or similar.
- **grant** — the card extends an ability/bonus to ANOTHER permanent rather
  than having or using it itself. An Equipment's bonus only exists once
  attached to a creature — the Equipment itself isn't "producing" anything,
  it's granting. Likewise a card that gives every other permanent you control
  a mana ability isn't itself a mana source. The test: is the SOURCE
  structurally excluded from ever benefiting from its own ability? That
  happens three ways — (1) explicit "other" wording ("other permanents you
  control have..."), (2) a type/qualifier restriction the source itself
  doesn't meet ("Demons you control have menace" granted by a non-Demon
  creature), or (3) it's Equipment/Aura's own bonus, which only ever exists
  once attached to something else. Any of those three → `grant`. If NONE
  apply — a blanket static ability with no "other," no excluding type
  restriction, on a card that could in principle also satisfy its own
  condition (e.g. "Equipped creatures you control have haste" granted by a
  creature that itself isn't an Equipment but COULD become equipped by
  something else) — that's `produce` instead, a Lord-style effect rather
  than a one-way grant. A single-target one-shot spell/ability effect
  ("target creature gains haste until end of turn") is also `grant` — it's
  extending to one other specific permanent by construction, same as the
  general rule described above.
- **magnifier** — the card doubles or amplifies an effect that's already
  happening (e.g. "you gain twice that much life," "put an additional +1/+1
  counter on it"). Independent of produce/consume — a card can be a
  magnifier and also produce/consume the same theme.
- **atypical** — the card clearly relates to or mentions the theme, but
  doesn't cleanly produce/consume/grant/magnify it. A legitimate "worth a
  second look" signal, not a failure to classify — don't stretch a card into
  produce/consume just to avoid using it.

A condition on an ability ("if you control...", "as long as...") isn't its own
role — tag whatever produce/consume/grant/magnifier the ability's core effect
is, regardless of the condition gating it.

A DFC's two faces (or a split/flip/adventure/meld card's two halves) are one
card — read all of it together before deciding; a relation established by
either half counts for the whole card.

## Weight (1-3): how central this relation is to the card

General scale, for anything not covered by a more specific rule below:
- **1** — a light/incidental touch: mentions or lightly interacts with the
  theme without being the card's main point.
- **2** — a genuine, clear relationship that isn't the card's sole purpose.
- **3** — the card's defining identity or central purpose for that theme.

As a rule of thumb within the general scale: a repeated trigger ("whenever...",
"at the beginning of...") or scaling language ("for each...", "equal to the
number of...") pushes a light (1) relationship up to at least 2 — the card
is reading/generating that resource repeatedly, not just once.

**Self-identity themes** (a card can genuinely just BE the thing, not merely
interact with it) — Artifacts, Creature, Dragon, Enchantment, Land, Towns,
Vehicles, Flying (via the Flying keyword), Lifegain (via the Lifelink
keyword) — use this three-tier scale instead of the general one:
- 1 = produces a *temporary* instance (creates a token, tutors one into hand/
  battlefield) — not the card's own permanent identity. (Crew's "becomes a
  creature" is its own documented exception under Creature below, also 1.)
- 2 = the card itself permanently IS one — self-identity, the default weight
  for this case.
- 3 = more than one (creates/grants multiple instances, or is one itself AND
  also creates more).

**Saga** is the one self-identity-shaped exception: being a Saga at all is
weight **1** (a light contribution — most Sagas only supply their own single
lore-counter mechanic, nothing reads "how many Sagas you control"). Genuine
Saga-count payoff language, if it shows up, scores via the general
incremental scale instead.

**Grant edges** default to weight **3** — extending an ability to every other
permanent you control (an Equipment's bonus, a card that grants everything a
mana ability) is the card's whole function, not a light mention worth scaling
up incrementally.

## Themes

Each theme: what genuinely counts as produce, what counts as consume, and any
other special notes accumulated from review. If a theme has no entry for a
role below, that role generally doesn't apply to it (e.g. Removal has no
consume side — nothing found so far reads back "how much removal you've
done").

- **Saga** (`saga`) — self-identity: the card's type line includes Saga
  (weight 1, see above). produce: puts/adds a lore counter. consume: genuine
  "Saga you control" / "Saga cards/spells you..." / Saga-triggered payoff
  language — reading its OWN lore counter each turn is just how the mechanic
  works structurally, not consumption of an external resource, so don't tag
  consume purely for that.
- **Graveyard** (`graveyard`) — produce: mills, discards a card, puts
  something into a graveyard. A death trigger alone is not a Graveyard
  relation: it reacts to dying but doesn't use the graveyard as a resource.
  Cycling (any variant — plain Cycling, Islandcycling/Forestcycling/etc.,
  Typecycling) counts: the card discards ITSELF as the cost, which is both a
  Discard produce and a Graveyard produce (weight 1 each — it's the cost,
  not the point of the ability; the actual payoff, e.g. Draw or Land/Towns
  search, is whatever the card's text says cycling does).
  consume: reads cards from a graveyard, "graveyard you control," or "cards
  in [a] graveyard."
- **+1/+1 Counters** (`counters`) — produce: puts one or more +1/+1 counters
  on something. consume: reads counters already present ("+1/+1 counters on
  it," "for each +1/+1 counter," removes counters, or proliferate).
- **Artifacts** (`artifacts`) — self-identity: the card's type line includes
  Artifact (weight 2). produce: creates an artifact (token), or a permanent
  becomes an artifact temporarily (weight 1, see self-identity scale).
  consume: "for each artifact you control," "artifacts you control," "whenever
  an artifact enters," or "artifact spell."
- **Sacrifice** (`sacrifice`) — produce: an ability that lets you sacrifice
  something as an optional cost to get value ("you may sacrifice ... :",
  "sacrifice ... : add/create/draw/deal/gain/search"), or "sacrifice after"
  (a Saga-style forced sacrifice that's the card's own payoff). consume: an
  additional cost that REQUIRES sacrificing something to cast/activate, or
  "sacrifice a/an/another/target/this [permanent]" (an edict-style forced
  sacrifice the card causes for another player also matches this consume
  wording literally, even though it "causes" the event — tag it consume,
  matching the phrase, not produce).
- **Exile** (`exile`) — produce: exiles the top of a library, a target, "you
  may exile," or exiles a card from somewhere. consume: reads cards you've
  exiled, an "exile zone," playing from among exiled cards, or casting from
  exile.
- **Equipment** (`equipment`) — self-identity: the card's type line includes
  Equipment — role is **produce**, weight 2. Its individual bonuses can also
  grant their applicable themes to the equipped creature.
  consume: genuine equipment-count payoff — "for each Equipment you control,"
  "Equipment you control get/have/has," "another Equipment." The boilerplate
  every Equipment card uses to describe its OWN bonus ("equipped creature
  gets/has...") does **not** count as consume — that's just how the card
  describes its own attached effect, not a payoff for equipment count/synergy.
- **Unblockable** (`unblockable`) — produce: grants a creature (itself or
  another) the inability to be blocked, temporarily ("target creature can't
  be blocked this turn," weight 2) or `grant` if it's an ONGOING ability of
  an Equipment/aura (persists across re-equips/re-attaching, weight 2-3,
  same convention as Flying). Distinct from Menace (needing two-or-more
  blockers, not zero).
- **Aura** (`aura`) — the Enchantment-side counterpart to Equipment. self-
  identity: the card's type line includes Aura — role is **produce**, weight
  2 (in addition to Enchantment's own self-identity produce — both apply,
  same as a card being both Artifact and Equipment). Its own attached bonus
  can grant applicable themes to the enchanted permanent, same convention as
  Equipment. consume: genuine Aura-count payoff ("for each Aura you
  control," "another Aura") — the boilerplate describing its own attached
  effect ("enchanted creature gets/has...") doesn't count, same as
  Equipment's non-boilerplate rule.
- **Discard** (`discard`) — produce: makes a player/opponent discard, discards
  a card at random, or a "draw ..., then discard a card" looting/rummaging
  effect (you're generating the discard yourself here, same as making an
  opponent discard). consume: "whenever you discard," "if you've discarded,"
  or "discard a card:" as an activation cost tied to a payoff.
- **Draw** (`draw`) — produce: draws one or more cards, OR a reveal-and-
  select effect that nets cards from library to hand without the literal
  word "draw" (e.g. a Fact-or-Fiction-style "reveal the top five, put some
  into your hand") — functionally the same "cards enter your hand from your
  library" outcome, tag it. consume: "whenever you draw," "for each card
  you've drawn," or "if you've drawn."
- **Flying** (`flying`) — self-identity: the card has the Flying keyword
  itself (weight 2, see self-identity scale). produce: grants flying to
  another creature ONE TIME (weight 1) — e.g. an auto-attach ETB bonus — or
  grants/has flying on more than one creature (weight 3). A *temporary*
  ("until end of turn") grant stays weight 1 even if it can repeat (e.g.
  across multiple Saga chapters) — the self-identity "3 = more than one"
  bump is for permanently having/creating more than one flyer, not for a
  repeatable one-shot buff. grant: when the grant is an ONGOING ability of an
  Equipment/aura (persists across re-equips, not a one-shot ETB effect) —
  weight 2, same produce+grant duality as the other keyword themes below.
  consume: "creatures with flying," "flying creatures you control," or
  blocking restricted to flying creatures.
- **Deathtouch** (`deathtouch`) — self-identity: the card has the Deathtouch
  keyword itself (weight 2). grant: gives deathtouch to another creature;
  consume: genuine payoff language reading creatures with deathtouch. Keep
  this theme even when a particular set has few internal payoffs because it
  remains meaningful across sets and on cards that grant or rely on it.
- **Flash** (`flash`) — self-identity: the card has the Flash keyword itself
  (produce, weight 2). grant: lets another card or class of spells be cast as
  though it had flash. consume: genuine payoff language that reads spells or
  permanents cast at instant speed or outside their controller's own turn.
- **Vigilance** (`vigilance`) / **Ward** (`ward`) / **Reach** (`reach`) /
  **Menace** (`menace`) / **Haste** (`haste`) / **Trample** (`trample`) /
  **Indestructible** (`indestructible`) / **Hexproof** (`hexproof`) /
  **First Strike** (`first-strike`) — self-identity: the card has the named
  keyword itself (produce, weight 2). grant: gives that keyword to another
  permanent — weight 1 for a temporary ("until end of turn") one-shot grant,
  weight 2 for an ongoing grant (an Equipment/aura ability that applies "as
  long as equipped/enchanted," persisting across re-attach). consume: genuine
  payoff language that reads permanents with the named keyword. These remain
  useful across sets even when a given set has few internal payoffs.
  Hexproof is distinct from Ward (a tax/penalty on targeting) — Hexproof
  prevents targeting outright. Vigilance specifically also gets **Attack
  produce, weight 1**: it doesn't tap to attack, so it can attack freely/
  repeatedly without giving up blocking — a light Attack-theme touch on any
  card that has Vigilance.
- **Face Damage** (`face-damage`) — produce: deals damage (a fixed amount, X,
  "that much," or damage equal to some value) directly to an opponent or each
  opponent. No consume side.
- **Damage Redirection** (`damage-redirection`) — produce: changes where
  damage that would be dealt goes, including redirecting damage from a player
  or other permanents onto this permanent. This is distinct from Face Damage,
  which deals damage to an opponent, and from preventing damage entirely.
- **Dragon** (`dragon`) — self-identity: type line includes Dragon (weight 2).
  produce: creates a Dragon (token, weight 1). consume: "Dragons you control,"
  "another Dragon," a Dragon-entering trigger, or "Dragon spells."
- **Enchantment** (`enchantment`) — self-identity: type line includes
  Enchantment (weight 2). produce: creates an enchantment (token/aura,
  weight 1), or a permanent becomes an enchantment temporarily (weight 1).
  consume: "Enchantments you control," "another Enchantment," an Enchantment-
  entering trigger, or "Enchantment spells."
- **Creature** (`creature`) — self-identity: type line includes Creature
  (weight 2). produce: creates a creature token. consume: "creatures you
  control," "another creature," a creature entering/dying trigger, or
  "creature spells." Crew is its own exception (like Saga): a Vehicle's
  "becomes an artifact creature" is BOTH produce (weight 1) and consume
  (weight 1) — produce for the temporary creature status, consume because
  Crew's own reminder text ("Tap any number of creatures you control...") is
  a genuine cost that reads your board of creatures. Weight 1 rather than the
  general self-identity 2, since it's conditional/transient (only while
  crewed, only if you have creatures to tap) rather than a definite
  token/search.
- **Lifegain** (`lifegain`) — self-identity: the card has the Lifelink
  keyword itself (weight 2, see self-identity scale — 1 = grants lifelink to
  another creature temporarily, 3 = grants/has lifelink on more than one).
  Plain "gain N life"/"gain life equal to..." is a separate produce signal
  that scores on the general incremental scale, not the self-identity one.
  consume: "whenever you gain life," or "life you've gained this [turn/etc]."
- **Instant** (`instant`) / **Sorcery** (`sorcery`) / **Planeswalker**
  (`planeswalker`) / **Battle** (`battle`) — self-identity: the card's own
  type line IS that type (weight 2, see self-identity scale) — same
  treatment as Artifacts/Creature/Enchantment/Legendary. consume: genuine
  payoff language reading "whenever you cast an instant/sorcery/etc. spell,"
  cost reduction for that spell type, or similar. A payoff phrased generically
  as "whenever you cast a noncreature spell" should tag EVERY applicable
  noncreature-spell-type theme as consume (Instant, Sorcery, Artifacts,
  Enchantment, Planeswalker, Battle), not a single catch-all "noncreature
  spells" theme — that dilutes signal by lumping "cares about instants/
  sorceries specifically" together with "cares about any noncreature spell
  at all." Keep Planeswalker/Battle even in an era/set with none printed yet
  — same reasoning as Tokens: cheap to keep for cross-set consistency.
- **Landfall** (`landfall`) — self-identity: the card literally has the
  Landfall mechanic — role is **consume** (it reacts to a land entering, it
  doesn't produce lands itself). consume (general): "whenever a land ...
  enters." produce: the card itself causes an EXTRA land to enter the
  battlefield outside the normal once-per-turn land drop (puts a land from
  hand/library onto the battlefield, plays an additional land) — this feeds
  every other permanent's Landfall ability, same shape as Ramp under Land
  but tagged separately since it's specifically about triggering Landfall,
  not about the land itself. A land entering via the normal single land-drop
  for the turn doesn't count (nothing extra is happening); this is for
  genuinely additional land drops.
- **Flashback** (`flashback`) — self-identity: the card literally has
  Flashback (produce, weight 2).
- **Cast from Graveyard** (`cast-from-graveyard`) — produce: the card ITSELF
  can be cast from a graveyard (Flashback, Aftermath, Disturb, Unearth, Escape
  and similar) — it's generating that cast-from-graveyard event for itself,
  not reading an external resource. consume: the card lets ANOTHER card be
  cast from a graveyard — that's genuinely reading/using an external object.
- **Combat Trick** (`combat-trick`) — produce: an instant-speed temporary
  boost or protective effect that improves creatures during combat. This is
  the established Magic term for effects such as an instant giving attacking
  creatures +2/+0 until end of turn.
- **Additional Combat** (`additional-combat`) — produce: creates an additional
  combat phase. Keep distinct from effects that create an entire extra turn.
- **Treasure** (`treasure`) — produce: creates a Treasure. consume:
  sacrifices a Treasure, or "Treasure you control."
- **Food** (`food`) — produce: creates a Food token. consume: sacrifices a
  Food, or "Food you control."
- **Mill** (`mill`) — produce: mills a card/N cards/X/target, or puts the top
  of a library into a graveyard. consume: "cards milled," or a mill-triggered
  ability.
- **Transform** (`transform`) — self-identity: the card's ability text
  mentions transforming — role **produce** only (transforming is triggered by
  an external condition — combat, an activated ability, a spell — and just
  becomes a new form; it doesn't read/consume anything the way a Saga reads
  its own lore counter). This is the ABILITY/mechanic, distinct from...
- **Double-Faced Cards** (`double-faced`) — purely structural: the card is
  physically two-faced (Scryfall layout `transform`, `modal_dfc`, or
  `meld`), independent of what its ability text says. Role **produce** only,
  no text to scan — being a DFC alone doesn't read/consume anything. (A
  transform trigger with no DFC, or a DFC — modal, meld — that never
  mentions "transform," is why this is a separate theme from Transform
  above.)
- **Towns** (`towns`) — self-identity: type line includes Town (weight 2).
  produce: searches a library for a Town card, or "Town cards with different
  names" (weight 1 for the search/tutor case). consume: "Affinity for Towns,"
  "Towns you control," or "control two/three/four/five or more Towns."
- **Vehicles** (`vehicles`) — self-identity: type line includes Vehicle
  (weight 2). produce: searches a library for a Vehicle card (weight 1).
  consume: "Vehicles you control," or "crewed by."
- **Land** (`land`) — self-identity: the card's type line includes Land
  (weight 2, see self-identity scale) — the card itself IS a land (basic
  lands typically aren't worth tagging at all — no card text to judge — so
  this only really applies to a nonbasic land card: one with an ETB-tapped
  clause, a tap ability, a triggered ability, etc.). Also covers ramp/
  land-count, merged in rather than a separate theme: produce — searches a
  library for a (basic) land card, or lets you play an additional land
  (weight 1 for the search/tutor case, same self-identity scale as Towns/
  Vehicles). consume — "seven or more lands," "number of lands you control,"
  or "for each land you control." Nothing to do with Landfall (that's
  reacting to ANOTHER land entering) — a card can independently be a land,
  fetch/ramp lands, and/or care about landfall; tag whichever actually apply.
- **Legendary** (`legendary`) — self-identity: the card's supertype line
  includes Legendary (weight 2, see self-identity scale). produce: creates a
  legendary token/permanent (weight 1, temporary-instance case). consume:
  "legendary creatures/permanents you control," controlling two or more
  legendary permanents, or "legendary [creature] spells you cast."
- **Mana** (`mana`) — grant vs. produce distinction matters here: a card that
  itself has "{T}: Add ... mana of any color/type" **produces** mana. A card
  that reads "Other permanents you control have {T}: Add ... mana..." isn't
  itself a mana source — it's **granting** that ability to everything else,
  same distinction as Equipment. Don't tag both produce AND grant for the
  same granting line — if it's granting the ability to others, that's grant
  only, not also produce.
  When the mana is restricted to a specific category ("spend this mana only
  to cast an artifact spell," "...an Equipment spell or activate an equip
  ability," "...a noncreature spell"), ALSO tag that category's own theme as
  **consume, weight 1** — the ability cares about/reacts to that resource
  category, even though it's not a literal count-based payoff. Don't tag it
  `atypical` instead; this is a genuine, if narrow, consume relationship.
- **Removal** (`removal`) — produce only: it's a broad, practical category —
  destroys a target, exiles a target, deals damage to a target/any target/
  each opponent, counters a spell, gives -X/-X until end of turn, bounces a
  permanent to its owner's hand, or TUCKS a permanent (puts it on top/bottom
  of its owner's library, or shuffles it into the library). Any of these
  taking an opponent's creature off the battlefield/out of the game counts,
  even a "weak"/temporary one (a tuck a fast deck can outrace is still
  Removal, just lower weight, per the general 1-3 scale — don't downgrade it
  to `atypical` just because it's not permanent or not one of the handful of
  verbs explicitly listed). Scoped to effects that hit an OPPONENT's stuff
  (or any target, which usually means theirs) — bouncing/sacrificing YOUR
  OWN permanent for value (a blink/rebuy ETB effect) is a completely
  different archetype and doesn't count, even though the mechanical verb
  ("bounce"/"tuck") is the same. A SYMMETRIC mass-destruction effect (each
  player sacrifices/loses creatures, not just an opponent) is different from
  that self-blink exclusion and still counts as Removal — a board wipe
  devastates whoever has the bigger board (usually the opponent), it isn't
  a deliberate self-serving value engine. No consume side found so far —
  removal is something a card DOES, not a resource read back. If a genuine
  payoff shows up during review (e.g. "whenever a creature an opponent
  controls dies"), that's real signal worth adding a consume rule for then,
  not something to invent speculatively now.
- **Board Wipe** (`board-wipe`) — produce only: destroys, exiles, sacrifices,
  or otherwise removes MULTIPLE creatures/permanents at once (three or
  more, "all," "each," or a symmetric/proportional mass effect) — tag
  ALONGSIDE Removal, not instead of it; this is the "how many at once"
  dimension, Removal is "did something get removed at all." A partial/soft
  wipe (sacrifice half, rounded down, opponent's choice of which) is
  genuine but narrower than a total "destroy all creatures" — weight scales
  with how complete/unconditional the wipe is (weight 1 for partial/
  choice-based, up to 3 for an unconditional full wipe).
- **Devotion** (`devotion`) — consume only: an effect scales off your
  devotion to a color (counting colored mana symbols in the mana costs of
  permanents you control). No produce side — devotion is a passive count
  read back, not a deliberately generated effect.
- **Bounce** (`bounce`) — produce: returns a permanent on the
  battlefield to its owner's hand. This includes returning your own permanent
  for reuse as well as bouncing an opponent's permanent; the latter can also
  be Removal, while self-bounce is not Removal. Returning a card from a
  graveyard to hand is Graveyard consumption, not Bounce.
- **Tokens** (`token`) — produce only: creates one or more tokens of ANY
  type (creature, artifact, treasure, etc.) — this is a cross-cutting axis
  on top of the type-specific themes (a creature token counts for both
  Creature and Tokens).
- **Copy** (`copy`) — produce: copies a spell, ability, card, permanent, or
  creates a token that's a copy. consume: reads or changes an existing copy
  specifically. Copying is weight 3 when it is the card's defining repeated
  engine, even if the resulting object is modified from the original.
- **Lockdown** (`lockdown`) — produce only: taps down an opponent's
  permanent(s), puts a stun counter on something, or otherwise keeps a
  permanent from untapping/being useful (a static "doesn't untap during
  its controller's untap step" replacement effect achieves the same
  practical lockout as an active tap-down, even though the verb differs —
  tag it Lockdown too, don't withhold just because nothing is actively
  "tapping" anything on resolution).
- **Tutor** (`tutor`) — produce only: searches your library (or looks at the
  top N cards) for a specific card or card type and puts it into hand or onto
  the battlefield. Also covers Scry/Surveil (weight 1) — looking at the top
  card(s) is a lighter form of the same "influence what you draw next"
  library-selection axis, even without fetching anything to hand/
  battlefield. Keep this tag ALONGSIDE the dedicated Scry/Surveil tags below
  (and Graveyard, for Surveil's put-into-graveyard option) — Tutor represents
  the light cross-cutting "you got to look at/pick from your library" angle,
  Scry/Surveil represent the mechanic itself; a card doing one of these gets
  all of the applicable tags, not just one. A cross-cutting axis like Tokens,
  on top of whatever type-specific theme also applies — tutoring a land also
  gets Land produce, tutoring a Town also gets Towns produce, etc.
- **Scry** (`scry`) — produce: the card itself has Scry N (look at the top N
  cards of your library, put any number on the bottom, the rest back on top
  in any order). consume: genuine payoff language reading "whenever you
  scry." Distinct from Surveil (Scry can only reorder/bottom, never puts
  cards in the graveyard) — a card with "whenever you scry or surveil" gets
  BOTH as consume.
- **Surveil** (`surveil`) — produce: the card itself has Surveil N (look at
  the top N cards, put any number into the graveyard, the rest back on top
  in any order). consume: genuine payoff language reading "whenever you
  surveil." Keep Tutor (weight 1) and Graveyard (weight 1, for the
  put-into-graveyard option) tagged alongside this on the same card — see
  Tutor's note above.
- **Attack** (`attack`) — role is **consume** (it reacts to a creature
  attacking, same shape as Landfall reacting to a land entering; it doesn't
  produce attacks). Covers BOTH: a "whenever ~ attacks" trigger on itself,
  AND a trigger reacting to ANOTHER qualifying creature attacking (e.g.
  "whenever a Dragon attacks," "whenever a creature you control attacks") —
  don't restrict to self-only. General scale for weight — the repeat-trigger
  bump usually applies (weight 2+) for an unconditional/broad trigger; a
  narrower one (gated to specific creature types, or only active for a
  limited window like a Saga chapter) can stay at 1.
- **ETB** (`etb`) — consume: reacts to a permanent entering the battlefield,
  same shape as Landfall/Attack. Covers BOTH: an UNCONDITIONAL "when this
  enters" trigger on itself (fixed weight **2**), AND "whenever another
  [creature/artifact/permanent] you control enters" (general scale,
  typically 2, since it's inherently a repeatable trigger). produce: the
  card CAUSES a permanent (itself or another) to enter the battlefield
  outside a normal cast — a blink, reanimation, or "return it to the
  battlefield" effect — which feeds every other permanent's own ETB
  triggers, same shape as Landfall's produce side. The one carve-out: a
  trigger reacting SPECIFICALLY to a land entering is Landfall's exclusive
  domain, not also ETB (don't double-tag land-entering triggers under both)
  — ETB covers non-land permanents entering. Still excludes a trigger gated
  behind an actual condition (e.g. "if you control three or more creatures")
  — that's a different, conditional relationship, not a bare ETB reaction.
- **Mana Denial** (`mana-denial`) — produce: disables, disrupts, or weakens an
  opponent's land/mana source without literally destroying/exiling/bouncing
  it (that would be Removal instead) — e.g. stripping a land's types and
  abilities down to a bare colorless source. Usually a light/weak effect
  (weight 1) rather than the card's defining purpose.
- **Damage Prevention** (`damage-prevention`) — produce: prevents damage that
  would be dealt (to you, a creature, or a permanent) from happening at all —
  distinct from Damage Redirection, which lets the damage still happen just
  to a different target.
- **Tap** (`tap`) — consume: reads whether a permanent IS tapped as a
  condition (a targeting restriction, a cost reduction, etc.) — distinct from
  Lockdown, which is about CAUSING something to tap, not reading its state.
- **Untap** (`untap`) — produce: untaps a permanent (yours or otherwise) as
  an effect — the opposite of Lockdown. Follow the equip-bonus grant/produce
  duality (see `grant` above) when it's a granted ability.
- **Life Loss** (`life-loss`) — produce: a player (self or an opponent) loses
  life directly as a stated effect — "you lose that much life," "loses life
  equal to X" — as opposed to being dealt damage (that's Face Damage/Removal
  territory) or an ongoing Lifelink/lifegain effect (that's Lifegain).
  consume: genuine payoff language reading "whenever a player/opponent loses
  life." Weight per the general scale; a repeated trigger (an attack/upkeep/
  combat-damage clause) usually earns at least 2, a narrow one-time or
  heavily-conditional instance stays 1.
- **Alternate Win Condition** (`alt-win`) — produce only: a card creates a
  way to win (or make an opponent lose) the game that isn't reducing life to
  0 through normal damage — "that player loses the game," "you win the
  game." Rare and always the card's defining purpose when present — weight
  3.
- **Extra Turns** (`extra-turns`) — produce only: takes an additional turn,
  or an additional phase/step within the current turn (e.g. "there is an
  additional end step after this step," "take an extra turn after this
  one"). Weight per the general scale — a heavily gated/conditional instance
  (only the first end step of the turn, an expensive one-time transform)
  stays low (1-2); an unconditional recurring extra-turn engine would be 3.
- **Forced Block** (`forced-block`) — produce (or grant, when it's an
  Equipment/aura extending the effect to the equipped/enchanted creature —
  same convention as Equipment's other bonuses): forces a creature to be
  blocked this turn if able, or otherwise restricts how a creature can be
  blocked (distinct from Menace, which is about needing two-or-more
  blockers, and distinct from an evasion effect making YOUR creature harder
  to block). Weight 2 typical: a one-shot ETB-triggered instance and an
  ongoing "as long as attacking" Equipment grant are both a genuine, if
  narrow, effect.
- **Commandeer** (`commandeer`) — produce only: causes a permanent to change
  controller, in EITHER direction — taking an opponent's permanent (a
  "Threaten"/Control Magic effect) or giving your own permanent away (a
  cost/drawback the card's effect is built around). Named to avoid "control,"
  which already means something else in Magic (the Control archetype/
  strategy). Distinct from Removal (removes a permanent from the game/hand
  entirely) and Bounce (returns to a hand, doesn't change ownership/control).
  Weight per the general scale — this is usually the card's defining purpose,
  so 3 unless it's clearly a minor side effect.
- **Cost Reduction** (`cost-reduction`) — produce only: makes spells cost
  less to cast (a flat amount, for a specific color/type, or conditionally).
  Weight 1 when scoped to a subset of spells (e.g. "White spells you cast
  cost {1} less") — genuine but narrow. General scale otherwise.
- **Kraken** (`kraken`) / **Serpent** (`serpent`) / **Assembly-Worker**
  (`assembly-worker`) / **Tetravite** (`tetravite`) — precedent examples of
  the creature-types exception above: pre-curated so a card that NAMES the
  type (without the current set printing one on an actual card face) still
  has a valid theme id. Assembly-Worker and Tetravite came from Antiquities
  (`atq`) — Mishra's Factory's activated ability turns itself into an
  Assembly-Worker creature, and Tetravus creates Tetravite tokens, but
  neither type is ever the printed `type_line` of any real card in that
  set's own data (tokens aren't part of the extracted card list).
- **Regeneration** (`regeneration`) — produce: the card itself can be
  regenerated by its OWN activated ability ("{G}: Regenerate this
  creature") — the ability lives on the permanent that benefits. `grant`:
  an Aura/Equipment/spell extends a regeneration ability to ANOTHER
  creature (an Aura's own attached ability granting "{G}: Regenerate
  enchanted creature" is `grant`, same test as the other keyword themes —
  the Aura itself can't be regenerated, only what it's attached to). No
  self-identity scale (it's an ability a card HAS, not a type it IS) and no
  consume side found so far — general 1-3 scale, typically 2 for produce,
  3 for a grant that's the card's whole function (matching the Grant-edges-
  default-3 convention).
- **Banding** (`banding`) — self-identity: the card has the Banding keyword
  itself (produce, weight 2). grant: gives banding to another creature (an
  Equipment/effect that grants it). Real, historic keyword — deprecated in
  new card design but still legal and printed on old cards; keep even in an
  era with few payoffs, same reasoning as Deathtouch/Ward elsewhere.
- **Protection** (`protection`) — self-identity: the card has Protection
  from a color/quality itself (produce, weight 2). grant: gives protection
  to another permanent — historically very common via Auras (a "Ward" Aura
  cycle, pre-dating and unrelated to the modern `ward` keyword — see the
  naming-trap note under set-specific instructions when a set's own card
  names collide with a different modern keyword). consume: genuine payoff
  language reading creatures with protection.
- **Defender** (`defender`) — self-identity: the card has the Defender
  keyword itself (produce, weight 2) — "this creature can't attack." A rare
  card that lets a Defender attack anyway is an `atypical` case on this
  theme, not a role of its own.
- **Forced Attack** (`forced-attack`) — produce: the card (or a creature it
  affects) must attack each combat if able — "this creature attacks each
  combat if able." `grant` when it's extended to another creature (an
  Equipment/Aura/effect), same convention as other keyword-shaped themes.
- **Anthem** (`anthem`) — produce: a static effect that boosts (or shrinks)
  power/toughness for a GROUP of creatures at once — all creatures, all of
  a color, all of a type, "creatures you control" — as opposed to a single
  targeted pump (that's Combat Trick) or a permanent per-creature +1/+1
  counter (that's Counters). Applies whether the boost is friendly-only or
  fully symmetric ("Bad Moon" boosts every black creature in play, not just
  the caster's). Weight per general scale; an unconditional board-wide
  anthem is usually 3.
- **Firebreathing** (`firebreathing`) — produce: a repeatable ACTIVATED
  ability that pumps power and/or toughness for a cost ("{R}: This creature
  gets +1/+0"), named after the original card Firebreathing that first did
  this. Distinct from Anthem (static, no activation) and Combat Trick
  (instant-speed, not an ability the permanent itself has).
- **Color Change** (`color-change`) — produce: changes what color(s) a spell
  or permanent is, or rewrites which color word a rule/ability on it refers
  to (Alpha's "-lace" cycle, and effects like Sleight of Mind that swap a
  color reference). Used both for mana-fixing/protection-dodging and for
  denial (disabling something that cares about the original color).
- **Ante** (`ante`) — produce only: the card's own cost/effect involves
  antusing cards (each player puts a card at risk, winner takes it) — a
  real, historic mechanic restricted to Magic's earliest sets and long
  discontinued in new card design for legal reasons (not legal in
  tournament play), but still real oracle text on old cards.
- **Other Counters** (`other-counters`) — produce: puts one or more counters
  of a type OTHER than +1/+1 on something (mire counters, vitality
  counters, charge counters, etc. — the dedicated `counters` theme is
  scoped to +1/+1 counters specifically). consume: reads a non-+1/+1
  counter count already present. A card that uses several distinct
  non-+1/+1 counter types across history all share this one theme — don't
  invent a new theme per counter-type name unless a SPECIFIC counter type
  recurs enough to deserve its own dedicated theme (matching how +1/+1
  counters already got their own split-out theme for exactly that reason).
- **Landwalk** (`landwalk`) — self-identity: the card has a landwalk ability
  itself (Swampwalk, Islandwalk, Mountainwalk, Forestwalk, Plainswalk, or a
  nonbasic-land-type walk) — produce, weight 2. `grant`: gives a landwalk
  ability to another creature. Distinct from Unblockable (landwalk depends
  on the DEFENDING player's board, not a blanket "can't be blocked"), and
  from Menace/Fear-style restricted-blocking (those restrict WHICH
  creatures can block, landwalk can make blocking flatly impossible when
  its condition is met).
- **Cost Increase** (`cost-increase`) — produce only: makes a spell or
  ability cost MORE to cast/activate — a tax effect, the inverse of Cost
  Reduction. Weight per general scale; scoped-to-opponents-only taxes are
  usually more central to the card's design than a blanket tax on everyone.
- **Land Type Change** (`land-type-change`) — produce: changes what
  basic-land-type(s) a land has (retypes a land to a Forest, adds a type
  without removing the original, strips existing types) — distinct from
  Land's own ramp/search definition (this doesn't fetch or count lands, it
  rewrites what type an EXISTING land already has). Used both for
  mana-fixing (turning a land into a color you need) and denial (removing
  a land's usefulness to whoever controls it).
- **Golem** (`golem`) — precedent example of the creature-types exception
  (see "Creature types" above): pre-curated for cards whose ability text
  temporarily turns something into a Golem without a matching type line in
  the current set.

## Process (per card)

1. Read the card's full oracle text (both faces if it's a DFC/split/
   adventure/meld card), type line, rarity, and keywords.
2. Check structural facts first — type line (Artifact/Creature/Enchantment/
   Land/Town/Vehicle/Saga), keywords (Flying/Lifelink), layout (transform).
   These often directly answer a theme's self-identity question before you
   even read the ability text closely. **No exceptions on structural
   self-identity tags** — every applicable structural type on the card's own
   type line must be checked and tagged, even on a card whose name/theme
   makes it "obviously" something else. Read the FULL type line before
   finishing a card, not just the ability text.
3. Read every ability line and check it against the theme list above — decide
   produce/consume/grant/magnifier per theme that applies. A single line can
   trigger more than one theme, and more than one role.
4. If a card relates to a specific theme but doesn't cleanly produce/consume/
   grant/magnify it, tag `atypical` for THAT theme rather than forcing a weak
   produce/consume guess. If it doesn't relate to any curated theme at all
   (should be rare), write an empty entry — see "Output shape" above.
5. Weight each relation per the conventions above.
6. When uncertain between forcing a produce/consume guess and tagging
   atypical, prefer atypical — it's a legitimate "worth a second look" signal
   for a strict reviewer pass, not a failure state. If genuinely uncertain
   about a JUDGMENT CALL (not just produce/consume/atypical, but whether the
   rule itself is right), still tag it your best guess per the rules as they
   stand, but log it to that set's standoffs doc for later discussion — see
   the set review process doc.
7. Write the result to that set's `<set>_relations.json` (historical sets:
   `tagging/sets/<code>/<code>_relations.json`; FIN: `data/fin/fin_relations.json`).
   Don't write a `reviewed` field on the entry at all — a fresh draft simply
   has no `tagging/card-enrichment-status.json` entry yet for that name (or
   one with `review: "none"`). Once a strict reviewer pass checks every entry
   in the set against this document with no outstanding issues, set
   `review: "ai"` for each of those names in
   `tagging/card-enrichment-status.json` (`enrichment: "ai"` too, if not
   already set from the drafting step).

## When a set introduces something new

If a card's mechanic genuinely doesn't fit ANY theme above (a new keyword
mechanic this file hasn't seen before, not just a new flavor of an existing
one) — that's the signal to ADD a new theme here, not to force-fit it or
invent a set-scoped one-off. Update this file (new theme entry, updated
`data/global_themes.json`), note what set/card surfaced it, and only then
tag the card properly. A mechanic that's clearly set-specific FLAVOR on an
existing pattern (a new keyword name for something that's mechanically
identical to gaining/losing an existing theme's resource) doesn't need a new
theme — reuse the existing one and note the keyword-name mapping in that
set's own review instructions doc, so future sets recognize it too.
