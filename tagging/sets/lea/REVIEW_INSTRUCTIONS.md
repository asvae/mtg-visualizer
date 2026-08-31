# Limited Edition Alpha (`lea`) — set-specific review instructions

Read `/mnt/c/Users/Asva/Projects/mtg-visualizer/scripts/GLOBAL_TAGGING_RULES.md`
in full first — that's the real rulebook (every theme, role, weight
convention). This doc is ONLY what's specific to this set: naming traps and
things you don't need to double-check.

## The set

295 cards, Magic's first-ever set (1993). Card data:
`data/lea/lea_scryfall.json`. Write your tags to
`data/lea/lea_relations.json` — same shape as documented in
GLOBAL_TAGGING_RULES.md's "Output shape" section. Leave `reviewed` false or
absent on your first pass; a separate strict review pass sets it to `true`.

Scryfall's `oracle_text`/`type_line` here reflect CURRENT Oracle rules
templating (post-errata), not the original 1993 printed wording — so you
will NOT see "Summon Dragon," "Interrupt," "Enchant World," or any other
retired templating; it's already normalized to modern
"Creature — Dragon" / "Instant" / etc. Don't special-case for old wording,
just read the text as given.

## Naming trap: "Ward" Auras grant Protection, not the modern Ward keyword

Alpha has a cycle of Auras literally named "Black Ward," "Blue Ward," "Green
Ward," etc. (also Redwood Treefolk-adjacent effects). Their card NAME says
"Ward" but their actual effect is **Protection from [color]** — a completely
different, much older keyword than the 2020s-era `ward` (a mana-tax on
targeting). Tag these `protection` (grant), never `ward`. Check the actual
oracle text's keyword, not the card name.

## Confirmed absent from this set — don't go looking

Legendary supertype, Poison counters, the `ward` keyword (the real one),
Saga, Landfall, Equipment, Vehicles, Towns, Job-Select-shaped mechanics, and
anything else introduced by a later set. Alpha predates all of these. If
your read of a card seems to suggest one of these anyway, re-read the card —
you're almost certainly misreading something else (e.g. the "Ward" naming
trap above).

## Standoffs

If you hit a genuinely unique effect with no clean home in any theme (this
set already surfaced one: Word of Command's "you control that player during
this spell's resolution," logged in `scripts/sets/lea/STANDOFFS.md`) — tag
your best guess (`atypical` on the closest-related theme, or leave it
untagged if truly nothing fits) and add it to that file rather than
inventing a new theme unprompted for a one-off. New themes get decided at
the global-rules level, not per-card.
