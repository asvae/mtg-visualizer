You're tagging Magic: the Gathering cards from Antiquities (1994, Magic's
second expansion set) for a card-visualizer data pipeline, in this repo.

## Step 1: read the rules

Read these two files IN FULL before tagging anything:
1. `scripts/GLOBAL_TAGGING_RULES.md` — the real rulebook: every curated
   theme, role (produce/consume/grant/magnifier/atypical), and weight
   convention.
2. `tagging/sets/atq/REVIEW_INSTRUCTIONS.md` — this set's specific notes and
   known quirks. Read this one carefully — it flags several real traps
   (counter-type mix-ups, a "grant" that's actually "produce", two newly
   curated creature-type theme ids you can't derive yourself) that were
   already found by a full read-through of this set's cards.

Card data is at `tagging/sets/atq/atq_scryfall.json` — a JSON array, one object per
printing, with `name`, `type_line`, `oracle_text`, `keywords`, `mana_cost`,
`colors`, etc. Every entry is already deduplicated by name (one row per
unique card design).

## Step 2: your card list — all 85 unique non-basic cards in this set

Amulet of Kroog, Argivian Archaeologist, Argivian Blacksmith, Argothian Pixies, Argothian Treefolk, Armageddon Clock, Artifact Blast, Artifact Possession, Artifact Ward, Ashnod's Altar, Ashnod's Battle Gear, Ashnod's Transmogrant, Atog, Battering Ram, Bronze Tablet, Candelabra of Tawnos, Circle of Protection: Artifacts, Citanul Druid, Clay Statue, Clockwork Avian, Colossus of Sardia, Coral Helm, Crumble, Cursed Rack, Damping Field, Detonate, Drafna's Restoration, Dragon Engine, Dwarven Weaponsmith, Energy Flux, Feldon's Cane, Gaea's Avenger, Gate to Phyrexia, Goblin Artisans, Golgothian Sylex, Grapeshot Catapult, Haunting Wind, Hurkyl's Recall, Ivory Tower, Jalum Tome, Martyrs of Korlis, Mightstone, Millstone, Mishra's Factory, Mishra's War Machine, Mishra's Workshop, Obelisk of Undoing, Onulet, Orcish Mechanics, Ornithopter, Phyrexian Gremlins, Power Artifact, Powerleech, Priest of Yawgmoth, Primal Clay, Rakalite, Reconstruction, Reverse Polarity, Rocket Launcher, Sage of Lat-Nam, Shapeshifter, Shatterstorm, Staff of Zegon, Strip Mine, Su-Chi, Tablet of Epityr, Tawnos's Coffin, Tawnos's Wand, Tawnos's Weaponry, Tetravus, The Rack, Titania's Song, Transmute Artifact, Triskelion, Urza's Avenger, Urza's Chalice, Urza's Mine, Urza's Miter, Urza's Power Plant, Urza's Tower, Wall of Spears, Weakstone, Xenic Poltergeist, Yawgmoth Demon, Yotian Soldier

## Step 3: judge each card

Read the oracle text and type line yourself and decide which curated themes
apply, via which role(s), and what weight (1-3, per GLOBAL_TAGGING_RULES.md
— including the self-identity 3-tier scale for the themes it lists). There
is NO prefill mechanism for this set — tag EVERY applicable theme yourself
from scratch, including basic self-identity (Creature, Artifact, Land,
Enchantment, Instant, Sorcery, Legendary if applicable) and every
creature-subtype (derive the id yourself: lowercase, hyphenate multi-word —
except `assembly-worker` and `tetravite`, which are pre-curated per
REVIEW_INSTRUCTIONS.md; use those ids directly for Mishra's Factory and
Tetravus respectively rather than trying to derive them, since neither type
appears on any card's actual `type_line` in this set's data).

If a card's mechanic doesn't fit ANY curated theme, tag `atypical` on the
closest-related theme rather than forcing a bad fit, or leave it fully
untagged if nothing is even close — and log it to
`tagging/sets/atq/STANDOFFS.md` (create the file if it doesn't exist; match
the format/tone of `scripts/sets/lea/STANDOFFS.md`). REVIEW_INSTRUCTIONS.md
already names several cards expected to need a standoff (Goblin Artisans'
coin flip, Mishra's Factory's man-land clause, Titania's Song, Cursed Rack,
The Rack, and the Urzatron land cycle if it feels wrong to you) — use those
as a starting point, not an exhaustive list; log anything else genuinely
uncertain the same way. Don't invent new theme ids yourself — flag a
possible new theme in a note instead so a human can decide.

## Step 4: output

Write a JSON array to `tagging/sets/atq/atq_relations.json` — one object per card,
ALL 85 cards, in this format:
```json
[
  {
    "name": "<exact card name>",
    "themes": {
      "produce": { "<theme-id>": 1|2|3, ... },
      "consume": { "<theme-id>": 1|2|3, ... },
      "grant": { "<theme-id>": 1|2|3, ... },
      "magnifier": { "<theme-id>": 1|2|3, ... },
      "atypical": { "<theme-id>": 1|2|3, ... }
    },
    "note": "<optional: only for a genuine judgment call, ambiguity, or possible new theme — otherwise omit this key entirely>"
  },
  ...
]
```
Omit any role key with no entries for that card. Omit `note` when there's
nothing notable — most cards should NOT have a note. Never write a
`reviewed` field — that doesn't belong on a relations entry at all (see
`GLOBAL_TAGGING_RULES.md`'s "Output shape" section); review status is
tracked separately, by a human, in `tagging/card-enrichment-status.json`
after your draft is checked.

Do not modify GLOBAL_TAGGING_RULES.md, data/global_themes.json, or any file
outside `tagging/sets/atq/` and `tagging/sets/atq/STANDOFFS.md`. When done, report:
how many cards you tagged, and how many you logged as standoffs.
