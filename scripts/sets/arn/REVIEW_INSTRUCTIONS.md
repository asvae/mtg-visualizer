# Arabian Nights (`arn`) — set-specific review instructions

Read `/mnt/c/Users/Asva/Projects/mtg-visualizer/scripts/GLOBAL_TAGGING_RULES.md`
in full first — that's the real rulebook (every theme, role, weight
convention). This doc is ONLY what's specific to this set.

## The set

92 raw printings, 77 unique non-basic-land card names (some commons have two
numbered art variants counted as separate printings — same card design, tag
each unique NAME once). Card data:
`data/arn/arn_scryfall.json`. Write your tags to
`data/arn/arn_relations.json` — same shape as GLOBAL_TAGGING_RULES.md's
"Output shape" section. Leave `reviewed` false/absent on your first pass.

This was Magic's first expansion set (December 1993) — entirely new cards,
no reprints from Limited Edition Alpha/Beta, so there's no "already known
from an earlier set" shortcut to apply here (that logic matters for later
sets, not this one).

## Known quirks worth knowing going in (verify against actual oracle text,
## don't just trust this list — it's a heads-up, not a substitute for reading)

- **Shahrazad** starts a subgame with the cards currently in players'
  libraries — a completely unique effect (this card is actually banned in
  every constructed format today). No existing theme fits; log it as a
  standoff rather than forcing a tag.
- **Cyclone** — check its actual oracle text before assuming anything about
  the modern `Cycling` keyword; the name is coincidental if unrelated.
- Several cards here are strong candidates for the newer global themes added
  during the Alpha pass — Color Change, Land Type Change, Anthem,
  Firebreathing, Ante, Other Counters, Landwalk, Cost Increase/Reduction,
  Commandeer (a "gain control while untapped"-style effect existed in this
  era) — check those theme definitions carefully, this set has real
  candidates for several of them.
- A few cards here have unusual sacrifice-for-value or "the OTHER card
  matters" shapes (e.g. a creature that dies and creates something else, an
  artifact/effect that protects other permanents from being targeted). If
  nothing in the current theme list fits cleanly, don't force it — tag your
  best guess and log a standoff, same convention as Alpha's.

## Standoffs

Log anything genuinely uncertain in `scripts/sets/arn/STANDOFFS.md` (create
it if it doesn't exist yet) — same format as
`scripts/sets/lea/STANDOFFS.md` (read that file for the exact format/tone to
match). Tag your best guess in the data either way; never leave a card
untagged just because you logged a standoff for one specific ability on it.
