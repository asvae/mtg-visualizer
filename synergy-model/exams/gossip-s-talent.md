# Card reconstruction task

You are given the structural decomposition of ONE Magic: the Gathering
card's rules text into a graph of typed nodes (per the schema below), plus
the registries those nodes reference. Your job: reconstruct the card,
formatted similarly to how a real card is displayed — EXCEPT its name,
which is unknown by design and must not be invented or stood in for with a
placeholder title.

Output format, in order:
1. **Mana cost** — using mana symbol notation exactly as given (`{2}{B}`,
   not "two generic and one black"), read off the self registry entry
   (below) that the card's `cast` node(s) resolve to: `manaCost` for a cast
   node whose `from` is `hand`, or `altCost[<from>]` for a cast node from
   anywhere else (an alternate cost — flashback, escape, casting from the
   graveyard, etc.). If the card has more than one named self (e.g. two
   faces) and/or more than one `cast` node, show each cost against the
   casting mode/face it belongs to.
2. **Type line** — the self registry entry's type line. Leave out anything
   neither the registry nor the nodes determine (supertype, rarity) rather
   than guessing.
3. **Rules text** — the reconstructed oracle-style text. Group nodes into
   printed abilities by following `flow` from each root: a root plus
   everything reachable from it via guaranteed (non-stack) steps forms one
   ability's own trigger/arrival condition; what follows a `to: "stack"`
   node (a real interruption point) is that ability's printed effect, one
   paragraph. Two faces of a double-faced card are two separate cards' worth
   of text — present them separately, in face order.

Then two labeled lists: "Assumptions" (a guess you made anyway, and why)
and "Could not derive" (anything the nodes genuinely don't determine, left
unfilled rather than guessed) — include both only if non-empty, but don't
skip listing something in "Could not derive" just because leaving it out
would look cleaner.

Rules:
- No internet access, no tools — reason only from the material below.
- If you think you recognize the specific printed card, ignore that
  instinct. Derive the wording only from the nodes given, not from outside
  knowledge of what this card "actually" says.
- This is a single attempt — there is no follow-up round, so do your best
  reasoning up front rather than leaving placeholders.
- Be strict. Do not guess or invent plausible-sounding specifics (numbers,
  named tokens, flavor, keyword names) that aren't actually derivable from
  the nodes and registries given. Where the nodes genuinely underdetermine
  something, don't paper over it with an invented value.

---

## Schema

A card is a flat map of nodes (pure edge facts, no sequencing) plus a
separate `flow` graph describing how they depend on each other:

```
{
  "nodes": { "<id>": { role, owner, from, to, thing, "trigger-type"?, flags? }, ... },
  "flow": {
    "roots": [ <id or combine-group>, ... ],
    "steps": { "<id>": [ <id or combine-group>, ... ], ... }
  }
}
```

**Nodes** carry the actual facts:
- `role` (closed list): `enters` (arrives on the battlefield), `cast` (arrives
  on the stack, any spell type), `source` (anonymous stock becomes available —
  mill, surveil), `tap` (a cost — convoke/crew-style), `becomes` (identity/type
  change, or a real "exile then return" zone change — never a bare relabel if
  a real zone change is printed), `move` (a real zone-to-zone journey of a
  specific/anonymous object — sacrifice, discard, search, reanimation, a
  resolved spell's own resting zone), `emit` (an event with no lasting stock —
  draws a card, loses life, a lore counter added), `trigger` (a triggered
  ability itself becoming a stack object per rule 603.3b — carries a
  `trigger-type` naming the event: `"enter"`, `"attack"`, `"deals-damage"`,
  `"saga-chapter"`, etc.; always `to: "stack"`), `amplify`/`suppress` (pipes
  over another edge — "triggers again", "can't be countered"), `sensor`/
  `scaler` (a threshold read / a continuous read of game state), `modifier`/
  `tagger` (a static rule over a tag, or adding a tag).
- `owner`: `me`, `opp` (every opponent, symmetric), `any` (one side, not
  necessarily chosen by targeting — could be "whichever player was dealt
  damage"), `all` (both sides at once).
- `from`/`to` (zones): `bf`, `gy`, `hand`, `exile`, `lib`, `stack`, `--` (not
  applicable). `cast`/`trigger` nodes are always `to: "stack"` — that's what
  makes them real interruption points (603.3b: can be countered/Stifled
  before resolving).
- `thing`: a registry key (see Registries below), or one of three reserved
  words: `self` (this card's own body — or `self:front`/`self:back` for a
  double-faced card, disambiguating which face's data a lookup resolves to),
  a coarse type-line word (`creature`, `artifact`, `land`, etc. — never a
  specific subtype, which lives in `cond:` instead), or `any` (an
  unspecified card — mill, discard, search all move cards that could be
  anything).
- `flags` (free-text, space-separated, sparse): `may` (optional), `copy` (a
  spell copy, no graveyard afterlife), `not:self` ("another"), `target`
  (chosen via targeting, not "each"/automatic), `combat` (on a
  deals-damage trigger: combat damage specifically), `cost:{...}` (mana
  cost for anything other than a plain hand-cast — an activated ability, an
  alternate-cost cast), `qty:N` / `qty:0..N` (a fixed or ranged count —
  when this flag is ABSENT entirely, the count is exactly 1, not unlimited
  or unspecified),
  `lifetime:turn` (temporary), `tapped` (arrives tapped), `cond:...`
  (free-text game-state precondition, or a payload for `modifier`/`tagger`/
  `becomes` stating what actually changes — e.g. `cond:equipped;delta=+1/+1`,
  or `cond:state=tapped`/`cond:state=untapped` on a `modifier` node — this is
  the EFFECT itself ("this becomes tapped/untapped"), not a precondition the
  target must already satisfy before being eligible).
  Two binding forms: `<name>:=<label>` on the node where a value is first
  fixed (a scaler's own measured count, or a trigger's own variable info —
  "that player," "that many," locked in at the moment it triggers, not
  re-evaluated later) declares a name for it; `<field>=<label>` on any node
  downstream (`qty=<label>`, `player=<label>`) binds that field to the
  named value. `:=` always declares, bare `=` always references.

**`flow`** describes dependency — the graph's own shape, not a flag pointing
at a coordinate:
- `roots`: ids (or combine-groups) with nothing pointing at them — they fire
  on their own, ungated by anything else on the card. A permanent's bare
  `enters` is always a root even when the card also has a `cast` node — a
  permanent can enter without being cast (reanimation, etc.).
- `steps[id]`: what follows `id`. Whether that's a *guaranteed* continuation
  or a *contingent* one is derived from `id`'s own `to` field: if
  `to: "stack"`, whatever follows only happens if `id` actually resolves
  (wasn't countered/Stifled) — a real interruption point. Otherwise it's
  automatic (nothing gets priority in the gap — e.g. a bare arrival and its
  own unconditioned trigger being placed on the stack are related this way,
  per 603.3b: no player gets priority between an event and its trigger
  reaching the stack).
- A step can be a plain id, or a **combine group**:
  `{ "combine": "any" | <number>, "of": [ <id>, ... ] }`. `"any"` means one
  occurrence satisfiable by any of the listed predicates (a disjunctive
  predicate on a single action — "sacrifice a creature or artifact" is one
  sacrifice, flexible about what qualifies, not a choice between effects). A
  number N means a genuine modal choice ("choose one —" is N=1): exactly N
  of the listed branches are picked, and only the picked branch(es)' own
  continuations happen.
- The same id can appear as a target from more than one place — that's a
  real fact (e.g. a shared follow-up effect reachable from either branch of
  an `any` group), not a bug to resolve into one path.

**Registries** (below): `labels` maps a shared `thing` (a token template, a
named object multiple cards could reference) to its label set (and, for a
token, its printed `stats`/`subtype`) — never a card's own identity, which is
always `thing: self` instead. `actions` expands a named keyword action (e.g.
`surveil-N`) into the edges it's shorthand for.

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
    "food": {
      "labels": [
        "artifact",
        "token"
      ],
      "subtype": "Food"
    },
    "bat-1": {
      "labels": [
        "creature",
        "token",
        "black"
      ],
      "stats": "1/1",
      "subtype": "Bat"
    },
    "rat-1": {
      "labels": [
        "creature",
        "token",
        "black"
      ],
      "stats": "1/1",
      "subtype": "Rat"
    },
    "snail-1": {
      "labels": [
        "creature",
        "token",
        "black"
      ],
      "stats": "1/1",
      "subtype": "Snail"
    },
    "squirrel-1": {
      "labels": [
        "creature",
        "token",
        "green"
      ],
      "stats": "1/1",
      "subtype": "Squirrel"
    },
    "fish-1": {
      "labels": [
        "creature",
        "token",
        "blue"
      ],
      "stats": "1/1",
      "subtype": "Fish"
    },
    "otter-1": {
      "labels": [
        "creature",
        "token",
        "blue",
        "red"
      ],
      "stats": "1/1",
      "subtype": "Otter"
    },
    "wall-1": {
      "labels": [
        "creature",
        "token",
        "white"
      ],
      "stats": "0/4",
      "subtype": "Wall"
    },
    "cat-1": {
      "labels": [
        "creature",
        "token",
        "white"
      ],
      "stats": "1/1",
      "subtype": "Cat"
    },
    "rabbit-1": {
      "labels": [
        "creature",
        "token",
        "white"
      ],
      "stats": "1/1",
      "subtype": "Rabbit"
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
        "thing": "any",
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
        "thing": "any",
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
        "thing": "any",
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

Every `thing: self`/`self:front`/`self:back` on this card's nodes resolves
to one of these entries (the same registry lookup a real consumer would do —
simulated here since you have no Scryfall access).

```json
{
  "self": {
    "manaCost": "{1}{U}",
    "typeLine": "Enchantment — Class"
  }
}
```

---

## Target card's nodes and flow

Rarity is deliberately withheld.

```json
{
  "nodes": {
    "A": {
      "role": "cast",
      "owner": "me",
      "from": "hand",
      "to": "stack",
      "thing": "self"
    },
    "B": {
      "role": "enters",
      "owner": "me",
      "from": "--",
      "to": "bf",
      "thing": "self"
    },
    "C": {
      "role": "trigger",
      "trigger-type": "enter",
      "owner": "me",
      "from": "--",
      "to": "stack",
      "thing": "creature"
    },
    "D": {
      "role": "source",
      "owner": "me",
      "from": "gy",
      "to": "--",
      "thing": "surveil-1"
    },
    "E": {
      "role": "becomes",
      "owner": "me",
      "from": "--",
      "to": "--",
      "thing": "self",
      "flags": "cost:{1}{U} cond:class_level=2"
    },
    "F": {
      "role": "trigger",
      "trigger-type": "attackersdeclared",
      "owner": "me",
      "from": "--",
      "to": "stack",
      "thing": "self"
    },
    "G": {
      "role": "becomes",
      "owner": "me",
      "from": "--",
      "to": "--",
      "thing": "self",
      "flags": "cost:{3}{U} cond:class_level=3"
    },
    "H": {
      "role": "trigger",
      "trigger-type": "deals-damage",
      "owner": "me",
      "from": "--",
      "to": "stack",
      "thing": "self",
      "flags": "combat"
    },
    "I": {
      "role": "move",
      "owner": "me",
      "from": "bf",
      "to": "exile",
      "thing": "any",
      "flags": "may"
    },
    "J": {
      "role": "enters",
      "owner": "me",
      "from": "--",
      "to": "bf",
      "thing": "self"
    }
  },
  "flow": {
    "roots": [
      "A",
      "B",
      "C",
      "E",
      "G"
    ],
    "steps": {
      "A": [
        "B"
      ],
      "C": [
        "D"
      ],
      "E": [
        "F"
      ],
      "G": [
        "H"
      ],
      "H": [
        "I"
      ],
      "I": [
        "J"
      ]
    }
  }
}
```
