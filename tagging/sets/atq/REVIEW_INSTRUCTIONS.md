# Antiquities (`atq`) — set-specific review instructions

Read `/mnt/c/Users/Asva/Projects/mtg-visualizer/scripts/GLOBAL_TAGGING_RULES.md`
in full first — that's the real rulebook (every theme, role, weight
convention). This doc is ONLY what's specific to this set.

## The set

102 raw printings, 85 unique non-basic-land card names (a handful of art
variants collapse to one design, same convention as every other set). Card
data: `tagging/sets/atq/atq_scryfall.json`. Write your tags to
`tagging/sets/atq/atq_relations.json` — same shape as GLOBAL_TAGGING_RULES.md's
"Output shape" section. Never write a `reviewed` field on an entry — review
status lives separately, in `tagging/card-enrichment-status.json`.

Antiquities (March 1994) was Magic's second expansion and its first
artifact-themed set (the Brothers' War storyline) — entirely new cards, no
reprints from any earlier-processed set (verified: 0 of the 85 names appear
in the finalized global pool already), so there's no reprint shortcut here.

## Known quirks worth knowing going in (verified against this set's real
## oracle text already — this list is trustworthy, not a heads-up-only guess)

- **This is THE artifact set.** The curated `artifacts` theme (produce/
  consume) and `sacrifice` theme cover the vast majority of cards here —
  "sacrifice an artifact: ..." payoffs recur on well over a dozen cards
  (Atog, Ashnod's Altar, Dwarven Weaponsmith, Orcish Mechanics, Priest of
  Yawgmoth, Sage of Lat-Nam, Transmute Artifact, and more). Tag these
  normally (consume: artifacts, produce: sacrifice / whatever the payoff
  is) — nothing new needed, just don't undercount how many cards this
  touches.
- **`assembly-worker` and `tetravite` are now pre-curated theme ids** (added
  to `data/global_themes.json` during this set's research pass, same
  precedent as `kraken`/`serpent`) — Mishra's Factory turns itself into an
  Assembly-Worker creature via its own ability, and Tetravus creates
  Tetravite tokens; neither type is ever the printed `type_line` of an
  actual card in this set's data, so the normal auto-derivation can't reach
  them. Use these ids directly, don't try to derive them yourself.
- **+1/+1 vs. non-+1/+1 counters — check the actual counter type before
  picking a theme.** `counters` is scoped to +1/+1 counters ONLY;
  everything else goes under `other-counters`. This set has both: Tetravus
  and Triskelion use real +1/+1 counters (`counters`), but Clockwork Avian
  uses **+1/+0** counters and Armageddon Clock uses **doom** counters —
  both of those are `other-counters`, not `counters`. Easy to get wrong on
  a skim.
- **A recurring "damage from/prevented from artifacts" sub-pattern** — Amulet
  of Kroog, Argivian Blacksmith, Argothian Pixies, Argothian Treefolk,
  Artifact Ward, Circle of Protection: Artifacts, Martyrs of Korlis, Rakalite
  all prevent damage generically or specifically from artifact sources; a
  second cluster (Artifact Possession, Haunting Wind, Powerleech, Tablet of
  Epityr, Urza's Chalice, Urza's Miter) triggers off an artifact being
  tapped/activated/dying to deal damage or gain life. Both clusters fit
  existing themes cleanly (`damage-prevention`, `face-damage`, `lifegain`,
  consumed off `artifacts`) — no new theme needed, just don't miss the
  `artifacts` consume edge on the triggering condition.
- **Banding** is a real keyword ability on Battering Ram and Mishra's War
  Machine — tag `banding` normally. Urza's Avenger grants itself a *choice*
  of banding/flying/first strike/trample for the turn — this reads like
  "grant" wording but the effect targets ITSELF, so per the grant test in
  GLOBAL_TAGGING_RULES.md (is the source structurally excluded from
  benefiting from its own ability?) this is `produce`, not `grant`, on
  whichever keyword(s) you tag.
- **The Urza's Mine / Urza's Power-Plant / Urza's Tower cycle** ("the
  Urzatron") each add bonus colorless mana only while you control the other
  two. Tag straightforwardly as `produce: land` + `produce: mana`
  (conditional bonus mana is still just mana production) — the
  "checks what other lands you control" shape doesn't have a dedicated
  theme and three cards isn't enough to justify inventing one. If it feels
  wrong, log a standoff rather than forcing it.
- **Golgothian Sylex** sacrifices every nontoken permanent *originally
  printed in Antiquities* — a set-scoped mass-sacrifice, similar in spirit
  to Arabian Nights' City in a Bottle naming-scope trap, but here the
  sacrifice role itself is unambiguous. Tag `sacrifice` / partial
  `board-wipe` normally; no atypical tag needed for the scope condition
  itself, though a short note on the unusual naming-scope wouldn't hurt.
- **Goblin Artisans**'s coin flip has no curated theme (a real recurring
  Magic mechanic in later sets, but this is the only instance seen so far
  in this sweep) — tag whatever else applies normally and log the coin-flip
  clause itself as a standoff.
- **Mishra's Factory** is Magic's original "man-land" (a land that becomes
  a creature via its own ability, not a printed Creature type). No curated
  theme exists for this pattern yet (it recurs constantly in real Magic's
  later history — Mutavault, the Conclave cycle, etc. — but this is the
  first instance chronologically in this sweep, so it's still a one-off for
  now). Tag `land` self-identity normally, and log the "becomes a creature"
  clause as a standoff with a note that this deserves a `man-land`-style
  global theme once it recurs in a later set.
- **Titania's Song** turns every noncreature artifact (anyone's, not just
  yours) into an artifact creature with P/T equal to mana value — a
  type-changing effect on OTHER permanents. No curated theme cleanly
  covers "turns artifacts into creatures" the way `land-type-change` covers
  lands; log as a standoff (best guess: `atypical` on `land-type-change` as
  the closest existing type-change theme, or `grant`+`creature` if that
  reads cleaner to you).
- **Cursed Rack** (opponent's max hand size becomes 4) and **The Rack**
  (damages the chosen opponent based on how far under 3 cards their hand
  is) are both hand-size-based punisher effects with no dedicated curated
  theme. Tag whatever else applies and log each as a standoff.

## Standoffs

Log anything genuinely uncertain in `tagging/sets/atq/STANDOFFS.md` (create
it if it doesn't exist yet) — same format as `scripts/sets/lea/STANDOFFS.md`
(read that file for the exact format/tone to match). Tag your best guess in
the data either way; never leave a card untagged just because you logged a
standoff for one specific ability on it.
