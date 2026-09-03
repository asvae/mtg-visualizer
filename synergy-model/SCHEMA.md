# MTG Card Synergy Model

A schema for decomposing Magic cards into directed relations with shared game objects, so that synergy between cards is computed rather than hand-annotated. Power level is deliberately out of scope; this models what connects to what, not whether the connection is good.

---

## 1. Core idea

Cards do not connect to cards. Each card decomposes into nodes pointing at things — a Treasure token, a card in a graveyard, a "spell was cast" event. Whether two cards synergize is a query: does one card's node produce what another card's node wants?

Reasons this beats card-to-card edges:

- **Edge count.** Card-to-card is O(n²). Card-to-thing is O(n × things) — roughly 600 nodes for a 280-card set instead of 39,000 pairs.
- **The join is the answer.** "How supported is this lane" is a count on one node. With card-to-card edges you'd have to recover that by clustering.
- **Metadata lives on the thing.** Whether a resource is rivalrous (a token can be sacrificed once) or broadcast (one draw trigger feeds every listener) is a property of the thing, not of any card touching it.
- **The same physical fact is often two relations.** A Treasure entering the battlefield is both a stock (sits there until sacrificed) and an event (it entered). These are separate nodes because different consumers care about different halves.

---

## 2. Node schema

A card is a flat map of nodes (pure facts, no sequencing) plus a separate `flow` graph describing how they depend on each other. They're kept apart deliberately: matching/lane-analysis (§4) only ever needs the flat facts, while sequencing only matters for round-trip reconstruction (`EXAM_PROCESS.md`) — mixing the two made both harder to reason about.

```
{
  "name": "...",
  "nodes": { "<id>": { role, owner, from, to, thing, "trigger-type"?, flags? }, ... },
  "flow": {
    "roots": [ <id or combine-group>, ... ],
    "steps": { "<id>": [ <id or combine-group>, ... ], ... }
  }
}
```

Ids (`node:cast`, `node:onEnter`, ...) are per-card, free-text, opaque — they exist only to be pointed at from `flow`, and are never read as English by any consumer. There is no `step`/`ability` addressing scheme any more: an earlier draft of this schema keyed every line by a hand-maintained `<ability>.<step>[<letter>]` coordinate, with an `if:A.S` flag for anything that depended on another line resolving. That coordinate turned out to be load-bearing in a way a flag shouldn't carry — getting an ability boundary wrong silently mis-stated whether an effect was guaranteed or interruptible, and there was no way to tell from the data alone. Causation is now the `flow` graph's own shape (§2 The flow graph, below) — nesting *is* the dependency, not a reference to look up.

### role (closed list — this is the schema)

| class | role | direction | example |
|---|---|---|---|
| drain | `enters` | unit arrives on bf | make a token; the card's own body |
| drain | `cast` | unit arrives on stack | a spell (any type) being cast |
| drain | `source` | out | mill, surveil (anonymous stock, no chosen identity) |
| drain | `tap` | in, temporary | convoke, improvise, crew |
| drain | `becomes` | relabel | "becomes an artifact creature", gain control |
| drain | `move` | relocate | a thing's own journey from one zone straight to another, real destination always stated — sacrifice/discard (`move me bf gy creature`, `move me hand gy any qty:1`), exile-from-library (`move me lib exile any qty:3`), reanimation (`move me gy bf creature`), a resolved spell's resting zone (`move me stack gy self`), returning target creatures from gy to hand (`move me gy hand creature qty:0..2 target`), a tutor/search (`move me -- hand land target cond:subtype_swamp`) |
| event | `emit` | out | draws a card, loses life, a lore counter added |
| event | `trigger` | in, stack | a triggered ability itself becoming a stack object (603.3b) — carries a `trigger-type` naming the event (see below) |
| event | `amplify` | pipe | "triggers an additional time", copy |
| event | `suppress` | pipe | Torpor Orb, "can't be countered" |
| gauge | `sensor` | read, threshold | metalcraft, "seven or more lands" |
| gauge | `scaler` | read, continuous | "+1/+1 for each artifact" |
| property | `modifier` | rule over a tag | anthem, "artifact spells cost {1} less" |
| property | `tagger` | adds a tag | changeling, "is a Wizard in addition" |

`bearer` (a Cat, for a cat anthem) is not a node — it is derived from the card's `tags`.

Roles are (class × direction) pairs, so the list is closed. New things appear every set; new roles should not.

**`trigger` replaces what used to be three separate roles** (`listen`, and named carve-outs `on-enter`/`deals-damage`). Every triggered ability — "when," "whenever," "at" — is `role: "trigger"` plus a `trigger-type` field naming the event: `"enter"`, `"attack"`, `"deals-damage"`, `"saga-chapter"`, and so on, open vocabulary the same way `thing` is. Always `to: "stack"` (603.3b: a triggered ability is itself put on the stack as an object the next time a player would receive priority, the same stack-object shape as a cast spell — this is what makes it a real interruption point: cards that read "counter target triggered ability," Stifle and its relatives, target exactly this object). `thing` on a trigger node means "whose occurrence": `self`/`self:front`/`self:back` (see below) for this card's own, or a coarse type (`creature`, `artifact`) with a `not:self` flag for another's. A `combat` flag on a `deals-damage` trigger marks combat damage specifically, as opposed to a general damage trigger.

### owner

Whose side of the table the zone is on.

| value | meaning |
|---|---|
| `me` | your side |
| `opp` | their side(s), symmetric — every opponent, not one chosen opponent |
| `any` | one side, not necessarily chosen by targeting — could be "whichever player was dealt damage," determined by the event itself rather than picked |
| `all` | both sides at once (symmetric) |

`all` is what separates Wrath of God from a targeted kill spell — it eats your tokens too. `opp` bare (no `target` flag) is the same idea one column over: "each opponent discards a card" is symmetric across however many opponents there are, the same way `me` never needs to say "each of yours" — it's `any` + `target` that marks a *chosen* one opponent, not `opp` alone. `any` without `target` is the other non-obvious case: Kain's "that player gains control" is `owner: "any"`, not `opp`, because in multiplayer the damaged player could be an ally, not necessarily an opponent — it's determined by who got hit, not chosen by anyone.

### from / to (zones)

`bf` · `gy` · `hand` · `exile` · `lib` · `stack` · `--` (not applicable)

Two columns, not one. Most roles only ever populate one side, leaving the other `--`: `enters`/`becomes` care about destination (`to`) — a new object has no meaningful "from". `scaler`/`sensor` care about origin (`from`) — they're reading, not arriving anywhere. `cast` is one role that genuinely uses both, every time: `from` is wherever it's cast from (hand by default, or an alternate cost's zone), `to` is always `stack`. `trigger` nodes always carry `to: "stack"` too and leave `from: "--"` (603.3b — the triggered ability itself is a stack object; it has a destination but no zone of origin, same asymmetry `enters` has). `move` genuinely uses both whenever a real origin and destination both apply — most removals do (sacrifice/discard land in `gy`, exile-effects land in `exile`).

Not every zone departure earns its own node. A departure that's just the mechanical consequence of some other action already being modeled doesn't get one: drawing a card has no accompanying `move me lib gy card` (the library depletion is inherent to what `draw` means), and casting from graveyard has no accompanying node either (inherent to `cast`'s own `from: gy`). A landcycling-style card's discard is different — a separate, chosen payment enabling a different effect (searching for a land) — not incidental to it, so it earns its own node.

Always state the real MTG-rules destination in `to`, even for removals — sacrifice and discard both land in `gy`, so `move me bf gy creature` (sacrifice) and `move me hand gy any qty:1` (discard) look the same shape as any other move. This holds even when the thing being removed *might* be a token that will actually cease to exist instead of reaching the graveyard (§3 Derivations) — that fact already lives entirely in the `thing`'s own registry status (is it token-backed or not), so it isn't re-encoded a second time by picking a different role or leaving `to` blank. A modal card with "sacrifice a token creature / sacrifice a nontoken creature / sacrifice an enchantment" writes `move ... bf gy creature ... cond:token` for every branch alike — the `cond:` is where token-vs-not already lives; `to` doesn't need to hedge on top of it.

Reanimation is `move me gy bf creature` — one node for the whole removal-and-arrival, since it's one inseparable movement of the same *specific, identified* object (or objects, each individually chosen — flagged `target`): Fight On!'s "return up to two target creature cards" (`move me gy hand creature qty:0..2 target`), or a tutor/search that finds one specific card (`move me -- hand land target cond:subtype_swamp`) — the `target` flag is exactly what marks an object as chosen/identified rather than anonymous, so it's the signal for `move` over `source`. `source` is reserved for possibly-anonymous, possibly-multiple stock becoming available with no identity chosen (mill's `any qty:N`, where you don't know or care which cards) rather than one traced object's own journey. Mill is `source me -- gy any` — no meaningful "from" there either, "the library" is implicit to what mill means.

**Sacrifice is its own action, separate from "dies."** Rule 701.16 (sacrifice) and rule 700.4 ("dies" — any creature moving battlefield→graveyard, regardless of cause) are two different facts. Aristocrats-style payoffs ("whenever you sacrifice a creature") key off the action specifically, not the destination — a Wrath effect or a state-based 0-toughness death also lands in `gy` but was never sacrificed. Tag a `move` that's specifically the sacrifice action with `cond:sacrifice` (Gaius's three modal sac branches all carry it) so it's distinguishable from a `move` caused some other way. The general "dies" fact has no derivation or node of its own yet — nothing so far has needed to query it — see §8.

### thing

A name, always looked up in a registry (§3), never expanded inline — with three reserved exceptions: `self` (or `self:front`/`self:back`, see below), the coarse type-line words (`creature`, `artifact`, `enchantment`, `land`, `planeswalker`, `battle`, `instant`, `sorcery` — never a specific subtype, which lives in `cond:` instead), and `any` (a card, unspecified beyond that — mill, discard, library search all move cards that could be anything, so there's no narrower type word to write). None of these are ever written as the card's own name/slug either way. Never write the card's own name or a slug of it as a `thing` — see §3's Labels note for why.

`self` is not a type — it's the fact that the thing in question is a **real printed card**, not a token. That distinction has a concrete downstream consequence: a token that leaves the battlefield ceases to exist, but a real card becomes graveyard stock (§3 Derivations formalizes this). It's what lets Fight On!'s "creature **cards** in your graveyard" tell a card apart from a token that already stopped existing.

`self` is a registry-backed thing exactly like `treasure` or `hero-token` — it just resolves against Scryfall (keyed by the card's own name) instead of `registries.json` (§3), giving mana cost, full type line, and power/toughness the same way any other registry lookup does. A real consumer resolves it the same way it resolves any other registry lookup: no join it can't do, nothing special or unreachable about it. `synergy-model/EXAM_PROCESS.md`'s round-trip examiner — deliberately handicapped, no tools, no Scryfall — gets this same data simulated for it in its exam packet (a `name-1`/`name-2`-keyed self registry, obfuscated so it never sees the card's own name), rather than that join being unavailable to it.

**`self:front` / `self:back`** — for a double-faced or transforming card, a bare `self` is ambiguous: the two faces can have entirely different mana costs, type lines, and power/toughness (Jecht, Reluctant Guardian is a {3}{B} 4/3 Human Warrior; Braska's Final Aeon is a 7/7 Saga Nightmare with no mana cost of its own). `self:front`/`self:back` disambiguate which face's data a registry join resolves to. A single-faced card just uses bare `self` — there's nothing to disambiguate. This is purely about *which data a lookup returns*, not a claim about causation: `cast`/`enters` (always `self:front` — you cast and initially arrive as the front face) and a later `becomes`/`move`-into-`enters` sequence that results in the back face showing (`self:back`) are still linked, or not, exactly per the `flow` rules below, same as any other pair of nodes.

Because that join already supplies the full type line, a permanent's `enters` node and a spell's `cast` node both write `self` alone — never a second, duplicated coarse type-line word alongside it. An artifact creature's `enters` node doesn't get a companion `enters ... artifact` node any more than a spell's `cast` node gets a companion `cast ... instant` node; both types are already inside what `self` resolves to. Spell copies are the one case where `self` is wrong on a `cast` node (marked with a `copy` flag instead, below) — no graveyard afterlife, same distinction a token vs. a real permanent has on the battlefield.

### flags (sparse tail)

| flag | meaning |
|---|---|
| `may` | this node is optional (the player chooses whether to do it). Absent means `must` — or not-applicable, for roles where optionality never made sense in the first place (`cast`, `scaler`, `sensor` are typically bare reads/declarations rather than discretionary actions — though nothing is barred from carrying `may`; a real card can make even a read optional, e.g. "you may count the creature cards in your graveyard") |
| `copy` | on a `cast` node: this is a spell copy, not the real card — no graveyard afterlife (§3 Derivations), same distinction a token vs. a real permanent has on the battlefield |
| `self` | on a `trigger` node: scoped to this card's own occurrence of the event ("whenever **this creature** attacks," not any creature) — not to be confused with `thing: self` (above), a different column entirely covering a different case |
| `not:self` | "another" |
| `combat` | on a `deals-damage` trigger: this is combat damage specifically, not damage from any source |
| `target` | the object is chosen via targeting at cast/activation time, not "each"/"all" or automatic — independent of `owner`: a spell can target something on your **own** side (`owner: me`) just as easily as an opponent's, so `owner: any` alone doesn't capture this. Matters downstream: hexproof/shroud/protection and "can't be the target of spells or abilities" effects only interact with nodes carrying this flag |
| `cost:` | mana cost (mana symbol notation, e.g. `{2}{B}`), written on any opening-cost node whose cost isn't already implied elsewhere — an activated ability's cost node, an equip/cycling payment, an alternate-cost cast (`from` other than `hand`: flashback, escape, casting from the graveyard). **Not** written on a `cast` node whose `from` is `hand` — that's the card's ordinary printed mana cost, which is exactly what `thing: self`'s registry join already resolves to (§2 thing), so restating it would just be duplicated data. Everywhere else, `cost:` is the only place the number can come from — stated explicitly there rather than left implicit |
| `qty:N` | fixed units per resolution (default 1) |
| `qty:0..N` | a range — a selection/target count that can be zero up to N |
| `lifetime` | for `enters`: `0` (immediately removed), `turn`, or `∞` (default) |
| `tapped` | on `enters`: the object arrives already tapped ("create two tapped ... tokens") |
| `cond:` | free-text game-state precondition (`mana_spent>=4`, `equipped`), a captured-value check like `origin=gy`, or a payload for `modifier`/`tagger`/`becomes` stating what actually changes (below) |

**Two binding forms — `:=` declares, bare `=` references.** A value is often fixed at one specific point and read again later: a `scaler`'s own measured count, or a triggered ability's own variable info ("that player," "that many") — the latter locked in at the moment the trigger fires (603.3b/603.4), never re-evaluated when it resolves. `<name>:=<label>` on the node where that value is first fixed *declares* a name for it; `<field>=<label>` on any downstream node *binds* that field to the named value. `:=` always sits on the producer, bare `=` always sits on the consumer — never the reverse, and there's no third form. Two worked examples, both real data:

- Kain's `onDealsDamage` (a `trigger`) fixes two things at the moment it triggers — who was hit and how much damage — and names them: `flags: "combat player:=damagedPlayer damage:=damageDealt"`. Downstream, `controlChange` reads the player back (`flags: "player=damagedPlayer"`), and `draw`/`treasure`/`lifeLoss` each read the damage amount back (`flags: "qty=damageDealt"`, or `"qty=damageDealt tapped"` where another flag rides along).
- The Final Days' `gyCreatureCount` (a `scaler` reading creature cards in your graveyard) names its own count: `flags: "count:=gyCreatureCount"`. Downstream, `tokensFlashback` reads it back as its own quantity: `flags: "qty=gyCreatureCount tapped"`.

An earlier draft of this had the direction reversed — `qty:=<name>` on the *consumer*, with a separate top-level `as` field naming the value on the producer. That's retired; the single `:=`-declares/`=`-references convention above replaced it everywhere.

("If you do"/"choose one" gating is structural now — the `flow` graph's nesting and `combine` groups, below — not a flag. "You may sacrifice a creature. Draw a card." and "You may sacrifice a creature. If you do, draw a card." differ only in whether the draw node is nested under the optional sacrifice node or is its own independent sibling in `flow`.)

`cond:` holds game-state facts that can never live in a registry (attacking, equipped, was dealt damage). Pushing them into the registry produces things like `attacking-equipped-hero-token` and the taxonomy collapses.

`modifier`, `tagger`, and `becomes` all need a payload `cond:` doesn't otherwise carry: which stat delta, which tag, which new type. None of these roles' other columns say WHAT changes, only WHO it changes for — `thing: creature, cond: equipped` alone can't distinguish +1/+1 from +2/+2, or Ninja from Knight, and `thing: self` on a `becomes` node doesn't say what the permanent becomes. Until this gets a cleaner home, write the value into `cond:` alongside the precondition, semicolon-joined: `cond:equipped;delta=+1/+1` (`modifier`), `cond:equipped;tag=Ninja` (`tagger`), `cond:type=artifact-creature` (`becomes`, a type change) — a DFC transform is the same idea with `type=transformed` instead, since "what it becomes" there is "its own other face," not a printable type string. `becomes ... self ... cond:attach` is the same pattern again for Equipment/Aura-style attaching: the permanent's own state changes (now attached to something), `thing` stays `self` (never the target's type — attaching doesn't turn the equipment INTO a creature), and the actual target is chosen via the `target` flag, not encoded in `thing`. This is a real, previously-made mistake worth naming: an equip-cost node originally used `thing: creature` to mean "attaches to a creature," which round-trip-tested as "this permanent becomes a creature" — wrong mechanic, because `thing` on `becomes` always means what THIS object's own identity changes to, never a description of the target. Surfaced by `synergy-model/EXAM_PROCESS.md` testing; revisit if it turns out `cond:` is carrying too much.

A menace- or flying-style keyword is a `modifier` whose `cond:` states the actual rules mechanic, not the keyword's name: `cond:blocked;min_blockers=2` (menace, 702.111b) or `cond:your_turn;blocked_by=flying_or_reach` (flying, 702.9b, plus a Jump-style "only during your turn" condition). Writing `flags: "grant=menace"` just restates the keyword — it isn't wrong exactly, but it gives a consumer nothing to reason about mechanically that the bare word "menace" didn't already say, and the keyword's own English name is exactly the kind of thing a `thing`/`cond:` value is supposed to replace with the actual mechanical fact.

### The flow graph

`flow` replaces `if:A.S`/ability-numbering entirely:

```
{
  "roots": [ <id or combine-group>, ... ],
  "steps": { "<id>": [ <id or combine-group>, ... ], ... }
}
```

**`roots`** — ids (or combine-groups, rare) with nothing pointing at them anywhere in `steps`. They fire on their own, ungated by anything else on the card.

A permanent's bare `enters` is **always** a root, even when the card also has a `cast` node and even though `cast` also links to it — a permanent can genuinely enter without being cast at all (reanimation, a cheat-into-play effect, some other card's return-to-battlefield effect). Nesting `enters` exclusively under `cast` would assert a false fact: that this card's own cast is the *only* way it enters. So `cast`'s own `flow.steps` entry still names `enters` as what follows it (`"node:cast": ["node:enters"]`) — that's the common, expected case, a real and useful fact — while `enters` is *also*, separately, listed in `roots`. This isn't a contradiction: a DAG can have more than one legitimate way to reach the same node. Namazu Trader's `surveil` node is reached from both `sacCreature` and `sacArtifact` for exactly the same reason — two real paths to the same fact, not a bug to dedupe.

**`steps[id]`** — what follows `id`. Whether that's a *guaranteed* continuation or a *contingent* one is derived from `id`'s own `to` field, never stored as a separate flag:

- `to: "stack"` — whatever follows only happens if `id` actually resolves. This is a real interruption point: the object can be countered, Stifled, or (for a triggered ability specifically) its source can be removed before it resolves, in which case the triggered ability still exists independently and still tries to resolve, but a clause like "that player gains control of it" can fail to do anything if "it" is no longer on the battlefield. That's exactly what real oracle text's "if they/you do" wording is describing, and it's not a separate concept needing a separate flag — the *entire chain* nested under a `to: "stack"` node is contingent on it, not just its immediate child. (Kain's `onDealsDamage` → `controlChange` → `draw`/`treasure`/`lifeLoss` is one continuous contingent chain hanging off one stack node — the fact that `controlChange` itself isn't `to: "stack"` doesn't matter; what matters is that its *ancestor* is.)
- Anything else — automatic, no interruption window. A bare `enters` and its own unconditioned trigger becoming a stack object are related this way: no player ever gets priority in that gap (603.3b), so there's nothing to interrupt between them, even though the trigger itself (once on the stack) is very much interruptible.

**Combine groups** — a step can be a plain id, or `{ "combine": "any" | <N>, "of": [ <id>, ... ] }`:

- `"any"` — one occurrence satisfiable by any of the listed alternatives. Namazu's "sacrifice a creature or artifact" is one sacrifice, flexible about what qualifies — not a choice between two different effects. A `then`/next step placed after the group (a sibling key on the same `flow.steps` position) applies once, regardless of which branch actually matched.
- a number `N` — a genuine modal choice. "Choose one —" is `combine: 1`; a real "choose two —" would be `combine: 2`. Exactly `N` of the listed branches are picked, and only the picked branch(es)' own continuations happen — Gaius's three-mode ETB (`combine: 1`) is the current example.

The same id can appear as a target from more than one place in `steps` — that's a real fact worth keeping (see `surveil` above), not something to collapse into one path.

No `if:A.S`, no `modal` flag, no lettered alternatives (`0.0a`/`0.0b`) survive from the old format — all retired, fully superseded by the graph's own shape.

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

Scryfall supplies this for free: every token a card creates appears in `all_parts` with its own `type_line`; for nontoken permanents the card's own `type_line` is the label set. This registry only ever holds **shared** templates — tokens and other named things multiple cards refer to. A card's own identity (Namazu Trader is `creature, Fish, Citizen`) is never hand-authored here — it's `thing: self` on that card's own nodes, and its labels are just its `type_line`, already sitting in the Scryfall data (`*_scryfall.json`) with nothing to duplicate. This also means a card's nodes never contain its own name in any form — see `synergy-model/EXAM_PROCESS.md` for why that matters.

### Actions — what a keyword does

```
surveil-N  → source me --   gy any qty:0..N
             emit   me --   -- library-look
mill-N     → source me --   gy any qty:N
loot       → emit   me --   -- draw
             source me --   gy any qty:1
scry-N     → emit   me --   -- library-look
```

"Up to" is encoded once, inside `surveil`, rather than remembered per card.

### Derivations — what a node implies

```
enters X, to=bf                     → emit etb X
enters X, to=bf, lifetime > 0       → source bf X
enters X, to=bf, lifetime < ∞       → emit leaves-bf X
enters self, to=bf, lifetime < ∞    → source gy self   (a real card; a token instead just ceases to exist)
cast X                               → emit me -- cast   (carries X's coarse type as matchable context, same as `emit etb X` carries `treasure`'s labels)
```

The split between `enters` and `source` exists because they can disagree. "Create a Treasure, then sacrifice it" entered (Rook Turret triggers) but was never available (Ahriman cannot eat it). Tokens that leave do emit a leaves/dies event but do not become graveyard stock — they cease to exist; a real card (an `enters ... self` node) does, automatically, without needing its own node for it — this is exactly why Fight On!'s "creature cards in your graveyard" and a real permanent's own `enters me -- bf self` node have to agree: only cards carrying that `self` node are ever available there to return.

Battlefield stock that arrives without an ETB — hence uses `becomes`, not `enters`:

- control change ("gain control of target creature")
- type change ("becomes an artifact creature", "is a Wizard in addition")
- animation for a turn
- untapping (restores availability for tap costs)
- phasing in (legacy; the one physical arrival that skips ETB)

A spell has no `enters` of its own — it isn't a permanent — but `cast` (§2 role) covers the same ground: the card arriving as an active object, just `to: "stack"` instead of `bf`. It is a genuinely separate node from whatever effect follows it, gated by the `flow` rule above (a cast spell can be countered before it resolves; nothing "inside" an already-resolving stack object can be interrupted the same way). Unless something else intervenes (exiled instead — some alternate-cast mechanics say so explicitly, or a spell copy that ceases to exist, `flags: copy`), a resolved instant or sorcery becomes graveyard stock the instant it finishes, the same way a real permanent does when it leaves the battlefield. Write this out explicitly as a `move` node (`from: stack, to: gy`) — this specific card's own resolution, not anonymous stock the way `source` produces it — even on a card with only one way to be cast; it's the default outcome for nearly every instant/sorcery, but "nearly every card has one and it's derivable" was exactly the reasoning that left it off Fight On! and produced a badly wrong round-trip reconstruction (the removal half of its return-to-hand effect read as unrelated exile, with nothing anchoring the spell's own fate); explicit beats implicit once something downstream (a reconstruction, a query, a reader) actually has to use the fact rather than assume it. Once a card has multiple `cast` alternatives whose resting zones differ (a normal hand-cast landing in the graveyard, an alternate-cast path landing in exile instead — The Final Days' flashback), each gets its own `move` node the same way, as a sibling of that specific `cast` root, not the other. Delve, and anything else that wants "instant or sorcery cards in your graveyard," reads the explicit nodes directly rather than re-deriving them.

Turn-based actions (not triggered abilities, don't use the stack) get the same explicit treatment when something downstream needs to distinguish them from a real trigger — a Saga's lore counters are the current example: "as this Saga enters" and "after your draw step" are both confirmed (714.3a/b) to be turn-based actions, not triggered abilities, so neither carries `to: "stack"` on its own `emit` node — only the chapter ability the lore counter *causes*, once a threshold is crossed, is a real trigger.

---

## 4. Matching

A source matches a consuming node (a `move`/`tap` that needs the thing, a `trigger` for the event it emits) when the labels of the produced thing satisfy that node's predicate, and owner/zone agree.

```
(Namazu Trader)  enters me -- bf treasure
  → derivation: emit etb treasure
  → registry:   treasure = artifact, token

(Rook Turret)    trigger-type:enter, thing:artifact, owner:me, flags:"not:self"
  → matches
```

Predicate language stays tiny: required labels, `any_of` for disjunction (usually just split into two nodes), `not` for "nontoken" / "another", numeric comparisons for power/mana-value conditions. Needing more usually means the card is doing two things and wants two nodes.

Owner matters in matching: `move opp bf gy creature` is removal, not a sac outlet, and must not count against your token supply. Hecteyes filling the opponent's graveyard does not feed your Fight On!.

---

## 5. Deliberately excluded

Anything that is a judgment rather than text:

- intent / incidental / primary — whether Namazu's own body "counts" as sac fodder depends on the deck. Query-time decision.
- origin (type-line vs rules-text) — not needed; decomposition is one-directional.
- win rates, power, tier — a different concern entirely.

The data layer records what is printed. Everything else is a question asked of it.

---

## 6. Worked example — Namazu Trader

{3}{B} Creature — Fish Citizen 3/4, common

> When this creature enters, you lose 1 life and create a Treasure token.
> Whenever this creature attacks, you may sacrifice another creature or artifact. If you do, surveil 2.

```json
{
  "nodes": {
    "node:cast":        { "role": "cast",    "owner": "me", "from": "hand", "to": "stack", "thing": "self" },
    "node:enters":      { "role": "enters",  "owner": "me", "from": "--",   "to": "bf",    "thing": "self" },
    "node:onEnter":     { "role": "trigger", "trigger-type": "enter",  "owner": "me", "from": "--", "to": "stack", "thing": "self" },
    "node:lifeLoss":    { "role": "emit",    "owner": "me", "from": "--",   "to": "--",    "thing": "life-loss", "flags": "qty:1" },
    "node:treasure":    { "role": "enters",  "owner": "me", "from": "--",   "to": "bf",    "thing": "treasure" },
    "node:onAttack":    { "role": "trigger", "trigger-type": "attack", "owner": "me", "from": "--", "to": "stack", "thing": "self" },
    "node:sacCreature": { "role": "move",    "owner": "me", "from": "bf",   "to": "gy",    "thing": "creature", "flags": "may not:self" },
    "node:sacArtifact": { "role": "move",    "owner": "me", "from": "bf",   "to": "gy",    "thing": "artifact", "flags": "may not:self" },
    "node:surveil":     { "role": "source",  "owner": "me", "from": "gy",   "to": "--",    "thing": "surveil-2" }
  },
  "flow": {
    "roots": ["node:cast", "node:enters", "node:onAttack"],
    "steps": {
      "node:cast":        ["node:enters"],
      "node:enters":      ["node:onEnter"],
      "node:onEnter":     ["node:lifeLoss", "node:treasure"],
      "node:onAttack":    [{ "combine": "any", "of": ["node:sacCreature", "node:sacArtifact"] }],
      "node:sacCreature": ["node:surveil"],
      "node:sacArtifact": ["node:surveil"]
    }
  }
}
```

### Reasoning, piece by piece

- **`node:cast`** — Casting it. `self`, not a coarse type word — the mana cost and full type line both come from the same registry join `self` always resolves through (§2 thing), not a duplicated word on the node. A root (nothing causes casting), and it also names `enters` as what follows it — the common-case link, not a claim that casting is the *only* way this permanent enters.
- **`node:enters`** — The bare arrival: the permanent itself lands on `bf`. Also, separately, its own root in `flow.roots` — it could arrive some other way (reanimation, etc.) with nothing on this card's own graph needing to say so.
- **`node:onEnter`** — "When this creature enters" — the triggered ability itself, put on the stack (603.3b), `to: "stack"`. Follows `enters` as a guaranteed continuation: nothing can respond in the gap between a permanent arriving and its own unconditioned trigger being placed on the stack (603.3b — no player gets priority in between). Self-scoped and no other sensible `thing`, so `trigger-type: "enter"` rather than a generic named event. Its coarse type (creature, ...) isn't written a second time either, for the same reason as `node:cast` — Ahriman's "sacrifice another creature" matches Namazu Trader through that same join, no duplicated word needed.
- **`node:lifeLoss`** — "you lose 1 life," contingent on `onEnter` actually resolving (a real interruption point — Stifle and its relatives target exactly this kind of stack object). An event, not a stock; nothing in the pool listens for it, but recording it is free and reconstructing it later is not.
- **`node:treasure`** — "create a Treasure token," sibling of `lifeLoss` under the same trigger (both are the trigger's effect, happening together once it resolves). The derivation rules produce `emit etb treasure` and `source bf treasure` from it; both are needed (Rook Turret wants the event, Ahriman wants the stock) but neither is stored. `treasure` is expanded by the label registry to `artifact, token`.
- **`node:onAttack`** — Triggers on attacking; `trigger-type: "attack"`, `to: "stack"`. A root — nothing on this card causes it, it just fires on its own whenever the creature attacks, independent of whether the ETB trigger ever resolved. This is why extra-combat cards ("additional combat phase") and untap-an-attacker effects are visible as synergies: they emit a second `attacks` event that this node hears.
- **`node:sacCreature` / `node:sacArtifact`** — "you may sacrifice another creature or artifact," contingent on `onAttack` resolving. `move ... bf gy`, the real destination sacrifice always has — whether the thing sacrificed actually reaches the graveyard or (being a token) ceases to exist instead is a fact about that thing's own registry status, not something this node hedges on (§2 from/to). "You may" → `may`. "Another" → `not:self`. The disjunction becomes a `combine: "any"` group (not a real choice between two effects, one flexible action), so each substrate's demand count stays honest. Its own Treasure satisfies the second branch — the card is a closed loop by itself (make Treasure, attack, eat Treasure), which is worth knowing when judging it as a signpost.
- **`node:surveil`** — "If you do, surveil 2." Reached from *both* branches of the `combine` group — real, not a bug (see §2 The flow graph): either sacrifice satisfies it, and it should render under each to show that. `surveil-2` is an action-registry entry that expands to up to two graveyard cards plus a library look. The graveyard filling is only as reliable as your fodder supply — a dependency the group's own `may` flags alone would have hidden if `surveil` were instead a bare, unconditional sibling.

Nine nodes. Every one traces to a span of printed text. Nothing on the card that is not on the card.

### Other decomposition notes from the same pool

- **Cornered by Black Mages** — one common with four distinct relations: casts as a noncreature spell (derived, no node needed), `move opp bf gy creature` (edict), enters a Wizard token, and the token itself listens for casts. That density is why it reads as a signpost.
- **Rook Turret** — its bare `enters me -- bf self` node is all it needs, same as any permanent; its own artifact-ness comes from that same self-registry join, not a second node. Its payoff is a `trigger` node, `trigger-type: "enter"`, `thing: "artifact"`, `flags: "not:self"`. It reads an event and destroys nothing, so under produce/consume it looked like an artifact consumer when it is actually indifferent to a board already full of artifacts.
- **Qutrub Forayer** — `move any gy exile any qty:2`: "a single graveyard" is either player's, chosen; the destination (exile) is always deterministic here, unlike sacrifice. A regex tagger classed this as a graveyard consumer; the owner column shows it is graveyard hate half the time.
- **Retrieve the Esper** — flashback's own resolution is `move me stack exile self`, same shape as any alternate-cost cast landing somewhere other than the graveyard (§2 role, `cast`). Filtering `self` nodes out of lane-support counts is what exposes that UB's graveyard "lane" at common is mostly cards paying themselves back, with almost no payoff for a graveyard someone else filled.

---

## 7. Queries this enables

- **Lane support on a thing**: producers (excluding `self`) × consumers, restricted to a rarity band. Zero on either side at common = not a draftable lane.
- **Contention**: any rivalrous thing where consumers outnumber sources across the colors that share it (Hero tokens serve WU count, RW equipment, WB sacrifice simultaneously).
- **Bridges**: cards with nodes touching three or more things — where one currency becomes another.
- **Traps**: a thing whose consumers are all rare while producers are all common, or the reverse.
- **Timing fit**: a `lifetime:turn` unit only feeds consumers whose ability window is the same turn; async payoffs (sac later) don't count it.
- **Self-sufficiency**: cards whose consumers are satisfied by their own sources (Namazu Trader) — weak signposts, since they don't need the deck.

---

## 8. Open questions

- **Conjunctive conditions.** "If you control an artifact and a creature with power 4 or greater" is one relation over two things. Current best guess: two nodes plus a `requires:[a,b]` group. Untested.
- **Named references.** Cards that name another card ("search for a card named X"). Rare; keep as a separate direct-node list rather than distort the schema.
- **`amplify` / `suppress`.** They act on the pipe, not either end. Kept first-class because doublers change lane math; could arguably fold into `modifier`.
- **Trigger target vs effect target.** Black Mage's Rod triggers off your casts and damages the opponent. One `owner` column can't express both ends of that. Options: accept the imprecision, or split into two nodes (a self-scoped trigger and a separate `emit opp` node) — the second is probably right and consistent with the rest of the model.
- **Registry provenance.** Labels and actions can be auto-generated from Scryfall type lines and keyword definitions; derivations are hand-written rules. Whether the action registry can be generated from the Comprehensive Rules keyword-action glossary is worth trying.
- **Does a triggered ability's own recipient category need to be stated directly?** Kain's `onDealsDamage` names the damaged entity `player:=damagedPlayer` — the binding's own name implies "a player" (as opposed to, say, a planeswalker), but nothing on the trigger node itself directly states that combat damage specifically has to reach a player for it to fire. Surfaced by the round-trip exam on Jecht (the reconstruction dropped "to a player" from the trigger condition). Leaning toward stating the recipient category directly on the trigger rather than relying on a downstream binding name to imply it, but not decided.
- **A real state-based action that isn't a triggered ability.** A Saga's "sacrifice once lore counters reach the final chapter number, once its own chapter ability has left the stack" (714.4) is confirmed non-stack, not a trigger. Currently modeled as a plain sibling of the final chapter's own effect under that chapter's trigger — causally correct (both are contingent on the same trigger resolving), but it gives a reconstruction agent nothing to recognize as the card's own printed "(...Sacrifice after III.)" reminder clause; confirmed missing in Jecht's round-trip exam. A `sensor`-role node (reads a threshold, no `to: "stack"`) was proposed but not added. Open.
- **Reveal/shuffle and similar search-adjacent facts.** No first-class flag yet — added ad hoc as semicolon-joined tokens inside an existing `cond:` value for one card (Malboro's swampcycling: `cond:subtype_swamp;reveal;shuffle`) after a round-trip exam caught the gap. Whether these deserve their own flag name, separate from `cond:`, is open.
- **Activated abilities and the stack.** Once an activated ability's cost is paid, the ability itself becomes a stack object (602), same shape as a triggered ability. Does it deserve its own `to: "stack"` node between the cost and its effect, the way a `trigger` node sits between an event and its effect? Currently, activated-ability cards (Phantom Train's sacrifice cost, Ninja's Blades' equip) go straight from the cost node to the effect with no such node in between. Explicitly raised, explicitly unresolved.
- **Sibling-to-sibling bindings.** `:=`/`=` (§2 flags) only handles a value known to some ancestor in the same branch of `flow`. There's no mechanism yet for one sibling to read a value another sibling (not an ancestor) declared.

**Resolved this pass:**
- **Modal choice vs. disjunctive predicate** — now the `combine` field on a `flow` step (§2 The flow graph): `combine: "any"` for a flexible predicate on one action, a number `N` for a genuine "choose N" modal. Retested on the cards that surfaced this (Namazu Trader's sac-or-artifact, Gaius's three-mode ETB).
