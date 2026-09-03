# Card reconstruction task

You are given the structural decomposition of ONE Magic: the Gathering
card's rules text into typed edges, per the schema below, plus the
registries those edges reference. Your job: reconstruct the card, formatted
similarly to how a real card is displayed — EXCEPT its name, which is
unknown by design and must not be invented or stood in for with a
placeholder title.

Output format, in order:
1. **Mana cost** — using mana symbol notation exactly as given (`{2}{B}`,
   not "two generic and one black"), read off the self registry entry (below)
   that the card's `cast` line(s) resolve to: `manaCost` for a cast line
   whose `zone_from` is `hand`, or `altCost[<zone_from>]` for a cast line
   from anywhere else (an alternate cost — flashback, escape, casting from
   the graveyard, etc.). If the card has more than one named self (e.g. two
   faces) and/or more than one `cast` line, show each cost against the
   casting mode/face it belongs to.
2. **Type line** — the self registry entry's type line. Leave out anything
   neither the registry nor the edges determine (supertype, rarity) rather
   than guessing.
3. **Rules text** — the reconstructed oracle-style text, one line/paragraph
   per ability (ability boundaries are the leading digit before the dot in
   `step`, e.g. all of `1.x` is one ability).

Then two labeled lists: "Assumptions" (a guess you made anyway, and why)
and "Could not derive" (anything the edges genuinely don't determine, left
unfilled rather than guessed) — include both only if non-empty, but don't
skip listing something in "Could not derive" just because leaving it out
would look cleaner.

Rules:
- No internet access, no tools — reason only from the material below.
- If you think you recognize the specific printed card, ignore that
  instinct. Derive the wording only from the edges given, not from outside
  knowledge of what this card "actually" says.
- This is a single attempt — there is no follow-up round, so do your best
  reasoning up front rather than leaving placeholders.
- Be strict. Do not guess or invent plausible-sounding specifics (numbers,
  named tokens, flavor, keyword names) that aren't actually derivable from
  the edges and registries given. Where the edges genuinely underdetermine
  something, don't paper over it with an invented value.

---

## Schema (SCHEMA.md)

# MTG Card Synergy Model

A schema for decomposing Magic cards into directed relations with shared game objects, so that synergy between cards is computed rather than hand-annotated. Power level is deliberately out of scope; this models what connects to what, not whether the connection is good.

---

## 1. Core idea

Cards do not connect to cards. Each card decomposes into edges pointing at things — a Treasure token, a card in a graveyard, a "spell was cast" event. Whether two cards synergize is a query: does one card's edge produce what another card's edge wants?

Reasons this beats card-to-card edges:

- **Edge count.** Card-to-card is O(n²). Card-to-thing is O(n × things) — roughly 600 edges for a 280-card set instead of 39,000 pairs.
- **The join is the answer.** "How supported is this lane" is a count on one node. With card-to-card edges you'd have to recover that by clustering.
- **Metadata lives on the thing.** Whether a resource is rivalrous (a token can be sacrificed once) or broadcast (one draw trigger feeds every listener) is a property of the thing, not of any card touching it.
- **The same physical fact is often two relations.** A Treasure entering the battlefield is both a stock (sits there until sacrificed) and an event (it entered). These are separate edges because different consumers care about different halves.

---

## 2. Edge schema

Every card is a list of edges. One edge per line:

```
<ability>.<step>[<letter>]  <role>  <owner>  <zone_from>  <zone_to>  <thing>  [flags]
```

### ability.step

- `ability` — which paragraph of rules text. `0` is the type line (the card's own body). Line breaks separate abilities; each resolves independently.
- `step` — order within the paragraph.
- `letter` (optional) — when a step has several lines that are genuinely mutually exclusive alternatives (a disjunctive predicate like "creature or artifact," or a full branch like a replacement effect), and something later needs to reference *one specific* alternative, letter them (`0.0a`, `0.0b`, ...) and reference the exact one (`if:0.0b`). Leave the letter off when nothing downstream cares which alternative fired — a bare step reference already means "this step happened, via any alternative" (this is the common case: a permanent's "sacrifice a creature or artifact," step `2.1`, is never referenced by letter because its follow-up doesn't care which). Letters are opt-in, added only where the ambiguity would actually bite.

Everything *inside one ability* resolves fully once it starts, in step order — state-based checks (dying at 0 life etc.) happen only after, and nothing external interrupts between one step and the next. This is a real guarantee, not just a convention: it's why a spell's `cast` (§2 role) is always its own separate ability from whatever effect follows, never a leading step of it — a cast spell sits on the stack and can be countered before it ever resolves, which is exactly the kind of external interruption that can't happen between two steps of an already-resolving ability. So: within one ability, step-adjacency alone implies "this happens, in order, uninterrupted." Between two abilities — including a `cast` and its own effect — nothing is implied by adjacency; a real dependency needs an explicit `if:`/`cond:` (§2 flags).

Triggered abilities ("when / whenever / at") open with a `listen` edge at step 0. Activated abilities open with their cost (a `sink` or `tap`) at step 0. Static abilities have no step 0.

### role (closed list — this is the schema)

| class | role | direction | example |
|---|---|---|---|
| drain | `enters` | unit arrives on bf | make a token; the card's own body |
| drain | `cast` | unit arrives on stack | a spell (any type) being cast |
| drain | `source` | out | mill, surveil (anonymous stock, no chosen identity) |
| drain | `sink` | in, destructive | sacrifice, exile from graveyard, discard |
| drain | `tap` | in, temporary | convoke, improvise, crew |
| drain | `becomes` | relabel | "becomes an artifact creature", gain control |
| drain | `move` | relocate | a specific, identified object's (or objects', if each is individually chosen — `target`) own journey from one zone straight to another — reanimation (`move me gy bf creature`), a resolved spell's resting zone (`move me stack gy self`), returning target creatures from gy to hand (`move me gy hand creature qty:0..2 target`), a tutor/search (`move me -- hand land target cond:subtype_swamp`) |
| event | `emit` | out | draws a card, deals damage, loses life |
| event | `listen` | in | "whenever you draw your second card" |
| event | `amplify` | pipe | "triggers an additional time", copy |
| event | `suppress` | pipe | a suppress effect, "can't be countered" |
| gauge | `sensor` | read, threshold | metalcraft, "seven or more lands" |
| gauge | `scaler` | read, continuous | "+1/+1 for each artifact" |
| property | `modifier` | rule over a tag | anthem, "artifact spells cost {1} less" |
| property | `tagger` | adds a tag | changeling, "is a Wizard in addition" |

`bearer` (a Cat, for a cat anthem) is not an edge — it is derived from the card's `tags`.

Roles are (class × direction) pairs, so the list is closed. New things appear every set; new roles should not.

### owner

Whose side of the table the zone is on.

| value | meaning |
|---|---|
| `me` | your side |
| `opp` | their side |
| `any` | one side, chosen (targeting) |
| `all` | both sides at once (symmetric) |

`all` is what separates a board wipe from a targeted kill spell — it eats your tokens too.

### zone_from / zone_to

`bf` · `gy` · `hand` · `exile` · `lib` · `stack` · `--` (not applicable)

Two columns, not one. Most roles only ever populate one side, leaving the other `--`: `enters`/`becomes` care about destination (`zone_to`) — a new object has no meaningful "from". `sink`/`scaler`/`sensor` care about origin (`zone_from`) — they're removing or reading, not arriving anywhere. `cast` is the one role that genuinely uses both, every time: `zone_from` is wherever it's cast from (hand by default, or an alternate cost's zone), `zone_to` is always `stack`.

Not every zone departure earns a `sink` edge. `sink` is for a removal that's a **distinct, chosen action with its own significance** — something you could sensibly ask about on its own ("did you sacrifice a creature," "how many cards did you discard"). A departure that's just the mechanical consequence of some other action already being modeled doesn't get one: drawing a card has no accompanying `sink me lib -- card` (the library depletion is inherent to what `draw` means), and casting from graveyard has no accompanying sink either (inherent to `cast`'s own `zone_from: gy`). A landcycling-style card keeps its `sink me hand -- self` because that discard is a separate, chosen payment enabling a different effect (searching for a land) — not incidental to it.

Reanimation is `sink me gy -- creature` + `enters me -- bf creature` — two edges, kept separate because a consumer might care about just the removal (graveyard hate) or just the arrival (a flicker payoff) independently. When a removal and arrival really are one inseparable movement of the same *specific, identified* object (or objects, each individually chosen — flagged `target`), `move` (with both columns) is more precise: `move me gy bf creature`, or a graveyard payoff's "return up to two target creature cards" (`move me gy hand creature qty:0..2 target`), or a tutor/search that finds one specific card (`move me -- hand land target cond:subtype_swamp`) — the `target` flag is exactly what marks an object as chosen/identified rather than anonymous, so it's the signal for `move` over `source`. `source` is reserved for possibly-anonymous, possibly-multiple stock becoming available with no identity chosen (mill's `any-card qty:N`, where you don't know or care which cards) rather than one traced object's own journey. Mill is `source me -- gy any-card` — no meaningful "from" there either, "the library" is implicit to what mill means.

### thing

A name, always looked up in a registry (§3), never expanded inline — with two reserved exceptions, `self` and the coarse type-line words (`creature`, `artifact`, `enchantment`, `land`, `planeswalker`, `battle`, `instant`, `sorcery`), which are never written as the card's own name/slug either way. Never write the card's own name or a slug of it as a `thing` — see §3's Labels note for why.

`self` is not a type — it's the fact that the thing in question is a **real printed card**, not a token. That distinction has a concrete downstream consequence: a token that leaves the battlefield ceases to exist, but a real card becomes graveyard stock (§3 Derivations formalizes this). On a permanent's `0.0` line, `self` sits alongside its coarse type word(s), both true simultaneously, sharing the step — `0.0 enters me -- bf self` + `0.0 enters me -- bf creature`, an artifact creature adding a third `0.0 enters me -- bf artifact` line — it's what lets a graveyard payoff's "creature **cards** in your graveyard" tell a card apart from a token that already stopped existing. Later in a card's own text (a flashback sink, its own transform), `self` alone is what's needed — the ability cares about *this specific card*, not "any card of this type," and no type word belongs there.

`self` is a registry-backed thing exactly like `treasure` or `hero-token` — it just resolves against Scryfall (keyed by the card's own name) instead of `registries.json`. A real consumer resolves it the same way it resolves any other registry lookup: no join it can't do, nothing special or unreachable about it. The reason `creature` still gets written as its own explicit line, rather than leaving it to that resolution, isn't that consumers in general can't perform the join — it's specifically for `synergy-model/EXAM_PROCESS.md`'s round-trip examiner, which is deliberately handicapped (no tools, no Scryfall, nothing but the edges) so it tests whether the edges *themselves* carry enough to reconstruct the card. For that one consumer the join genuinely isn't available; for a real matching system it's redundant-but-harmless, not load-bearing.

`cast`'s `thing` is `self`, not a coarse type word — a spell has no other coarse-type-carrying edge the way a permanent has its `0.0 enters ... creature` line to fall back on, so the type line has to come from the same place everything else about the real card comes from: the self-registry lookup (§3), not a duplicated word on the edge itself. Spell copies are the one case where `self` is wrong (marked with a `copy` flag instead, below) — no graveyard afterlife, same distinction a token vs. a real permanent has on the battlefield.

### flags (sparse tail)

| flag | meaning |
|---|---|
| `may` | this line is optional (the player chooses whether to do it). Absent means `must` — or not-applicable, for roles where optionality never made sense in the first place (`cast`, `scaler`, `sensor` are typically bare reads/declarations rather than discretionary actions — though nothing is barred from carrying `may`; a real card can make even a read optional, e.g. "you may count the creature cards in your graveyard") |
| `copy` | on a `cast` line: this is a spell copy, not the real card — no graveyard afterlife (§3 Derivations), same distinction a token vs. a real permanent has on the battlefield |
| `self` | on a `listen`/event edge: scoped to this card's own occurrence of the event ("whenever **this creature** attacks," not any creature) — not to be confused with `thing: self` (§2 thing, above), a different column entirely covering a different case |
| `not:self` | "another" |
| `target` | the object is chosen via targeting at cast/activation time, not "each"/"all" or automatic — independent of `owner`: a spell can target something on your **own** side (`owner: me`) just as easily as an opponent's, so `owner: any` alone doesn't capture this. Matters downstream: hexproof/shroud/protection and "can't be the target of spells or abilities" effects only interact with edges carrying this flag |
| `cost:` | mana cost (mana symbol notation, e.g. `{2}{B}`), written on every `cast` line and on any other opening-cost edge that has one — an activated ability's cost step, an alternate-cost payment (equip, cycling). Not just derivable from Scryfall for the card's own default cost; an activated ability's own cost is printed nowhere else in these edges at all, so it's the only place it can come from. Stated explicitly everywhere it applies rather than left implicit — cheap, and anything consuming the edges (a round-trip reconstruction, a reader) shouldn't have to separately join Scryfall data just to know what something costs |
| `qty:N` | fixed units per resolution (default 1) |
| `qty:0..N` | a range — a selection/target count that can be zero up to N |
| `qty:=<step>` | the quantity equals whatever a referenced `scaler`/`sensor` step measured — a *value* reference, distinct from `if:A.S` below (an *occurrence* reference) |
| `if:A.S` | gated on step A.S having actually happened ("if you do"). For one specific lettered alternative, reference it exactly (`if:0.0b`) — see §2 ability.step |
| `lifetime` | for `enters`: `0` (immediately removed), `turn`, or `∞` (default) |
| `tapped` | on `enters`: the object arrives already tapped ("create two tapped ... tokens") |
| `modal` | this lettered alternative is one of several mutually exclusive top-level modes ("choose one —") — exactly one is picked before anything resolves, and only that one's effects happen. Distinct from plain unlettered step-sharing, which stays reserved for a disjunctive predicate on a *single* action (a permanent's "sacrifice a creature or artifact" — one sacrifice, flexible about what satisfies it, not a choice between separate effects). Always letter `modal` lines even when nothing downstream needs to reference one individually — the letter plus the flag together is what tells a reader "these are exclusive modes," not just "these happen to share a step" |
| `cond:` | free-text game-state precondition (`mana_spent>=4`, `equipped`), or a captured-value check like `origin=gy` — checking which of several lettered `cast`/`enters` alternatives actually applies. Where `if:` only works for a same-card reference to one of its own steps, `cond:origin=` also covers a third-party card with no step of its own to point at (a listener watching "spells cast from a graveyard" generally) |

`if:` is not derivable from sequence. "You may sacrifice a creature. Draw a card." and "You may sacrifice a creature. If you do, draw a card." have identical order and different meaning.

`cond:` holds game-state facts that can never live in a registry (attacking, equipped, was dealt damage). Pushing them into the registry produces things like `attacking-equipped-hero-token` and the taxonomy collapses.

`modifier`, `tagger`, and `becomes` all need a payload `cond:` doesn't otherwise carry: which stat delta, which tag, which new type. None of these roles' other columns say WHAT changes, only WHO it changes for — `thing: creature, cond: equipped` alone can't distinguish +1/+1 from +2/+2, or Ninja from Knight, and `thing: self` on a `becomes` line doesn't say what the permanent becomes. Until this gets a cleaner home, write the value into `cond:` alongside the precondition, semicolon-joined: `cond:equipped;delta=+1/+1` (`modifier`), `cond:equipped;tag=Ninja` (`tagger`), `cond:type=artifact-creature` (`becomes`, a type change) — a DFC transform is the same idea with `type=transformed` instead, since "what it becomes" there is "its own other face," not a printable type string. `becomes ... self ... cond:attach` is the same pattern again for Equipment/Aura-style attaching: the permanent's own state changes (now attached to something), `thing` stays `self` (never the target's type — attaching doesn't turn the equipment INTO a creature), and the actual target is chosen via the `target` flag, not encoded in `thing`. This is a real, previously-made mistake worth naming: an equip-cost edge originally used `thing: creature` to mean "attaches to a creature," which round-trip-tested as "this permanent becomes a creature" — wrong mechanic, because `thing` on `becomes` always means what THIS object's own identity changes to, never a description of the target. Surfaced by `synergy-model/EXAM_PROCESS.md` testing; revisit if it turns out `cond:` is carrying too much.

---

## 3. Registries

Three lookup tables, resolved on demand at query time. Cards store only what their text literally says.

### Labels — what a thing is

```
treasure        → artifact, token
hero-token      → creature, token, colorless, 1/1
robot-warrior   → artifact, creature, token
```

Flat label sets, not a tree. Robot Warrior is both artifact and creature; a hierarchy gives it two parents and breaks. If `permanent` needs to be a label, write it on every type that has it.

A creature token also carries its printed `stats` (power/toughness) and `subtype` (its actual creature type — Horror, Hero, Soldier, whatever's printed) alongside its label set — both are printed fact like everything else here, not the power-level judgment §5 excludes. Neither is optional cosmetics: a token's registry key must stay an opaque identifier (`horror-1`, not `horror-token`) so it doesn't leak information through its own name the way a card's name is never leaked (§3 note below) — which means `subtype` has nowhere else to live once the key can't be read as English. Dropping the descriptive key name without adding this field is a real regression, confirmed by round-trip testing: it silently lost the creature type from the reconstruction. Non-token permanents don't need either field: their own stats and subtypes are already sitting in the Scryfall data next to their `type_line`, same "supplied for free" reasoning as labels below — these fields exist only because token templates are the one thing in this registry that's hand-curated rather than read off a real printing.

Scryfall supplies this for free: every token a card creates appears in `all_parts` with its own `type_line`; for nontoken permanents the card's own `type_line` is the label set. This registry only ever holds **shared** templates — tokens and other named things multiple cards refer to. A card's own identity (a permanent is `creature, Fish, Citizen`) is never hand-authored here — it's `thing: self` on that card's own edges, and its labels are just its `type_line`, already sitting in the Scryfall data (`*_scryfall.json`) with nothing to duplicate. This also means a card's edges never contain its own name in any form — see `synergy-model/EXAM_PROCESS.md` for why that matters.

### Actions — what a keyword does

```
surveil-N  → source me --   gy any-card qty:0..N
             emit   me --   -- library-look
mill-N     → source me --   gy any-card qty:N
loot       → emit   me --   -- draw
             source me --   gy any-card qty:1
scry-N     → emit   me --   -- library-look
```

"Up to" is encoded once, inside `surveil`, rather than remembered per card.

### Derivations — what an edge implies

```
enters X, zone_to=bf                     → emit etb X
enters X, zone_to=bf, lifetime > 0       → source bf X
enters X, zone_to=bf, lifetime < ∞       → emit leaves-bf X
enters self, zone_to=bf, lifetime < ∞    → source gy self   (a real card; a token instead just ceases to exist)
cast X                                    → emit me -- cast   (carries X's coarse type as matchable context, same as `emit etb X` carries `treasure`'s labels)
```

The split between `enters` and `source` exists because they can disagree. "Create a Treasure, then sacrifice it" entered (another permanent triggers) but was never available (a sacrifice outlet cannot eat it). Tokens that leave do emit a leaves/dies event but do not become graveyard stock — they cease to exist; a real card (an `enters ... self` line) does, automatically, without needing its own edge for it — this is exactly why a graveyard payoff's "creature cards in your graveyard" and a real permanent's `0.0 enters me -- bf self` line have to agree: only cards carrying that `self` line are ever available there to return.

Battlefield stock that arrives without an ETB — hence uses `becomes`, not `enters`:

- control change ("gain control of target creature")
- type change ("becomes an artifact creature", "is a Wizard in addition")
- animation for a turn
- untapping (restores availability for tap costs)
- phasing in (legacy; the one physical arrival that skips ETB)

A spell has no `enters` of its own — it isn't a permanent — but `cast`
(§2 role) covers the same ground: the card arriving as an active object,
just in `zone_to: stack` instead of `bf`. It is a genuinely separate
ability from whatever effect follows it, not a leading step of one — see
§2 ability.step for why (a cast spell can be countered before it resolves;
a step within an already-resolving ability cannot be interrupted the same
way). Unless something else intervenes (exiled instead — some alternate-
cast mechanics say so explicitly, or a spell copy that ceases to exist,
`flags: copy`), a resolved instant or sorcery becomes graveyard stock the
instant it finishes, the same way a real permanent does when it leaves the
battlefield. Write this out explicitly as a `move` edge (`zone_from:
stack, zone_to: gy`) — this specific card's own resolution, not anonymous
stock the way `source` produces it — even on a card with only one way to
be cast; it's the default outcome for nearly every instant/sorcery, but
"nearly every card has one and it's derivable" was exactly the reasoning
that left it off a graveyard payoff and produced a badly wrong round-trip
reconstruction (the sink half of its return-to-hand effect read as
unrelated exile, with nothing anchoring the spell's own fate); explicit
beats implicit once something downstream (a reconstruction, a query, a
reader) actually has to use the fact rather than assume it. Once a card has
multiple `cast` alternatives whose resting zones differ (a normal hand-cast
landing in the graveyard, an alternate-cast path landing in exile instead),
each gets its own `move` line the same way. Delve, and anything else that
wants "instant or sorcery
cards in your graveyard," reads the explicit edges directly rather than
re-deriving them.

---

## 4. Matching

A source matches a sink when the labels of the produced thing satisfy the sink's predicate, and owner/zone agree.

```
(a permanent)  enters me -- bf treasure
  → derivation: emit etb treasure
  → registry:   treasure = artifact, token

(another permanent)    listen me -- -- etb not:self cond:artifact
  → matches
```

Predicate language stays tiny: required labels, `any_of` for disjunction (usually just split into two edges), `not` for "nontoken" / "another", numeric comparisons for power/mana-value conditions. Needing more usually means the card is doing two things and wants two edges.

Owner matters in matching: `sink opp bf -- creature` is removal, not a sac outlet, and must not count against your token supply. a mill effect filling the opponent's graveyard does not feed your a graveyard payoff.

---

## 5. Deliberately excluded

Anything that is a judgment rather than text:

- intent / incidental / primary — whether its own body "counts" as sac fodder depends on the deck. Query-time decision.
- origin (type-line vs rules-text) — not needed; decomposition is one-directional.
- win rates, power, tier — a different concern entirely.

The data layer records what is printed. Everything else is a question asked of it.

---


## 7. Queries this enables

- **Lane support on a thing**: producers (excluding `self`) × consumers, restricted to a rarity band. Zero on either side at common = not a draftable lane.
- **Contention**: any rivalrous thing where sinks outnumber sources across the colors that share it (Hero tokens serve WU count, RW equipment, WB sacrifice simultaneously).
- **Bridges**: cards with edges to three or more things — where one currency becomes another.
- **Traps**: a thing whose consumers are all rare while producers are all common, or the reverse.
- **Timing fit**: a `lifetime:turn` unit only feeds sinks whose ability window is the same turn; async payoffs (sac later) don't count it.
- **Self-sufficiency**: cards whose sinks are satisfied by their own sources (a permanent) — weak signposts, since they don't need the deck.

---

## 8. Open questions

- **Conjunctive conditions.** "If you control an artifact and a creature with power 4 or greater" is one relation over two things. Current best guess: two edges plus a `requires:[a,b]` group. Untested.
- **Named references.** Cards that name another card ("search for a card named X"). Rare; keep as a separate direct-edge list rather than distort the schema.
- **`amplify` / `suppress`.** They act on the pipe, not either end. Kept first-class because doublers change lane math; could arguably fold into `modifier`.
- **Trigger target vs effect target.** a damage trigger listens for your casts and damages the opponent. One `owner` column can't express both ends of that. Options: accept the imprecision, or split into two edges (a `listen me` and an `emit opp`) — the second is probably right and consistent with the rest of the model.
- **Registry provenance.** Labels and actions can be auto-generated from Scryfall type lines and keyword definitions; derivations are hand-written rules. Whether the action registry can be generated from the Comprehensive Rules keyword-action glossary is worth trying.

**Resolved: modal choice vs. disjunctive predicate.** Was open here; now the `modal` flag (§2 flags) — lettered alternatives distinguish an exclusive "choose one —" from plain unlettered step-sharing (a disjunctive predicate on one action, unaffected). Round-trip retested on the card that surfaced this.


---

## Registries (registries.json)

```json
{
  "_comment": "Two of the three registries from SCHEMA.md \u00a73 (labels, actions). Derivations are fixed logic (enters\u2192emit etb, etc.), not data \u2014 they live in SCHEMA.md \u00a73 and, once code reads this, in the matching logic itself, not here. Seeded from SCHEMA.md's own worked examples; grows as review surfaces new things/keywords, same way TAGGING_RULES.md grows during theme review. `labels` holds ONLY shared templates (tokens, named things multiple cards reference) \u2014 never a printed card's own identity. A card's own body is `thing: self` on its own edges, labeled by its Scryfall type_line directly; it never gets an entry here. Action edges use zone_from/zone_to (not a single zone) and drop `opt` entirely (must is the default; only write `flags: 'may'` when a step is genuinely optional) \u2014 same shape SCHEMA.md's own worked example uses.",
  "labels": {
    "treasure": {
      "labels": [
        "artifact",
        "token"
      ]
    },
    "hero-token": {
      "labels": [
        "creature",
        "token",
        "colorless"
      ],
      "stats": "1/1",
      "subtype": "Hero"
    },
    "robot-warrior": {
      "labels": [
        "artifact",
        "creature",
        "token"
      ]
    },
    "horror-1": {
      "labels": [
        "creature",
        "token",
        "black"
      ],
      "stats": "2/2",
      "subtype": "Horror"
    }
  },
  "actions": {
    "surveil-N": [
      {
        "role": "source",
        "owner": "me",
        "zoneFrom": "--",
        "zoneTo": "gy",
        "thing": "any-card",
        "flags": "qty:0..N"
      },
      {
        "role": "emit",
        "owner": "me",
        "zoneFrom": "--",
        "zoneTo": "--",
        "thing": "library-look",
        "flags": ""
      }
    ],
    "mill-N": [
      {
        "role": "source",
        "owner": "me",
        "zoneFrom": "--",
        "zoneTo": "gy",
        "thing": "any-card",
        "flags": "qty:N"
      }
    ],
    "loot": [
      {
        "role": "emit",
        "owner": "me",
        "zoneFrom": "--",
        "zoneTo": "--",
        "thing": "draw",
        "flags": ""
      },
      {
        "role": "source",
        "owner": "me",
        "zoneFrom": "--",
        "zoneTo": "gy",
        "thing": "any-card",
        "flags": "qty:1"
      }
    ],
    "scry-N": [
      {
        "role": "emit",
        "owner": "me",
        "zoneFrom": "--",
        "zoneTo": "--",
        "thing": "library-look",
        "flags": ""
      }
    ],
    "job-select": [
      {
        "role": "listen",
        "owner": "me",
        "zoneFrom": "--",
        "zoneTo": "--",
        "thing": "etb",
        "flags": "self"
      },
      {
        "role": "enters",
        "owner": "me",
        "zoneFrom": "--",
        "zoneTo": "bf",
        "thing": "hero-token",
        "flags": ""
      },
      {
        "role": "becomes",
        "owner": "me",
        "zoneFrom": "--",
        "zoneTo": "--",
        "thing": "self",
        "flags": "cond:attach"
      }
    ]
  }
}
```

---

## Self registry

Every `thing: self` on this card's edges resolves to one of these entries
(this is the same registry lookup `self` uses in any real consumer — see
SCHEMA.md §2 `thing` — simulated here since you have no Scryfall access).
The key names (`name-1`, ...) are placeholders; a card with two faces (front
// back) gets one entry per face, in face order.

```json
{
  "name-1": {
    "manaCost": "{2}{B}",
    "typeLine": "Artifact — Equipment"
  }
}
```

---

## Target card's edges

Rarity is deliberately withheld. Columns: `step  role  owner  zone_from
zone_to  thing  [flags]`.

```
0.0    cast      me   hand   stack  self                   
0.0    enters    me   --     bf     self                   
0.0    enters    me   --     bf     artifact               
0.1    enters    me   --     bf     job-select             
1.0    modifier  me   --     bf     creature               cond:equipped;delta=+1/+1
1.1    tagger    me   --     bf     creature               cond:equipped;tag=Ninja
2.0    listen    me   --     --     combat-damage          cond:equipped
2.1    emit      me   --     --     draw                   qty:1 if:2.0
2.2    sink      me   hand   --     any-card               qty:1 if:2.0
2.3    emit      opp  --     --     life-loss              qty:X if:2.0 cond:X=discarded_card_mv
3.0    becomes   me   --     --     self                   cost:{2} target cond:attach
```
