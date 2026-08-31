You're tagging Magic: the Gathering cards from Arabian Nights (1993, Magic's
first expansion set) for a card-visualizer data pipeline, in this repo.

## Step 1: read the rules

Read these two files IN FULL before tagging anything:
1. `scripts/GLOBAL_TAGGING_RULES.md` — the real rulebook: every curated
   theme, role (produce/consume/grant/magnifier/atypical), and weight
   convention.
2. `scripts/sets/arn/REVIEW_INSTRUCTIONS.md` — this set's specific notes and
   known quirks.

Card data is at `data/arn/arn_scryfall.json` — a JSON array, one object per
printing, with `name`, `type_line`, `oracle_text`, `keywords`, `mana_cost`,
`colors`, etc. Some cards appear twice (two art variants of the same
design) — tag each unique NAME once.

## Step 2: your card list — all 77 unique non-basic cards in this set

Abu Ja'far, Aladdin, Aladdin's Lamp, Aladdin's Ring, Ali Baba, Ali from Cairo, Army of Allah, Bazaar of Baghdad, Bird Maiden, Bottle of Suleiman, Brass Man, Camel, City in a Bottle, City of Brass, Cuombajj Witches, Cyclone, Dancing Scimitar, Dandân, Desert, Desert Nomads, Desert Twister, Diamond Valley, Drop of Honey, Ebony Horse, El-Hajjâj, Elephant Graveyard, Erg Raiders, Erhnam Djinn, Eye for an Eye, Fishliver Oil, Flying Carpet, Flying Men, Ghazbán Ogre, Giant Tortoise, Guardian Beast, Hasran Ogress, Hurr Jackal, Ifh-Bíff Efreet, Island Fish Jasconius, Island of Wak-Wak, Jandor's Ring, Jandor's Saddlebags, Jeweled Bird, Jihad, Junún Efreet, Juzám Djinn, Khabál Ghoul, King Suleiman, Kird Ape, Library of Alexandria, Magnetic Mountain, Merchant Ship, Metamorphosis, Mijae Djinn, Moorish Cavalry, Nafs Asp, Oasis, Old Man of the Sea, Oubliette, Piety, Pyramids, Repentant Blacksmith, Ring of Ma'rûf, Rukh Egg, Sandals of Abdallah, Sandstorm, Serendib Djinn, Serendib Efreet, Shahrazad, Sindbad, Singing Tree, Sorceress Queen, Stone-Throwing Devils, Unstable Mutation, War Elephant, Wyluli Wolf, Ydwen Efreet

## Step 3: judge each card

Read the oracle text and type line yourself and decide which curated themes
apply, via which role(s), and what weight (1-3, per GLOBAL_TAGGING_RULES.md
— including the self-identity 3-tier scale for the themes it lists). There
is NO prefill mechanism for this set — tag EVERY applicable theme yourself
from scratch, including basic self-identity (Creature, Artifact, Land,
Enchantment, Instant, Sorcery, Legendary if applicable) and every
creature-subtype (derive the id yourself: lowercase, hyphenate multi-word).

If a card's mechanic doesn't fit ANY curated theme, tag `atypical` on the
closest-related theme rather than forcing a bad fit, or leave it fully
untagged if nothing is even close — and log it to
`scripts/sets/arn/STANDOFFS.md` (create the file if it doesn't exist; match
the format/tone of `scripts/sets/lea/STANDOFFS.md`). Don't invent new theme
ids yourself — flag a possible new theme in a note instead so a human can
decide.

## Step 4: output

Write a JSON array to `data/arn/arn_relations.json` — one object per card,
ALL 77 cards, in this format:
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
    "reviewed": false,
    "note": "<optional: only for a genuine judgment call, ambiguity, or possible new theme — otherwise omit this key entirely>"
  },
  ...
]
```
Omit any role key with no entries for that card. Omit `note` when there's
nothing notable — most cards should NOT have a note. Every card MUST have
`"reviewed": false` (a separate strict review pass sets it to `true` later —
don't set it yourself).

Do not modify GLOBAL_TAGGING_RULES.md, data/global_themes.json, or any file
outside `data/arn/` and `scripts/sets/arn/STANDOFFS.md`. When done, report:
how many cards you tagged, and how many you logged as standoffs.
