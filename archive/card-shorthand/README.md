# Card shorthand notation — archived

This effort is paused, not deleted. It's moved here because the files
weren't referenced by any live app code anymore — nothing here is wired
into the running site.

## What it was

A house notation for writing homebrew MTG card text compactly: a small
glossary of bracket tokens (e.g. `[Heal]`) that each unpack to a fixed
chunk of real rules text, defined in `CARD_SHORTHAND.md`. It was
explicitly *not* a general parser or an attempt to compress every possible
card wording — if a card's effect didn't match an existing token, the
convention was to just write it out in plain English rather than invent a
new abbreviation for a one-off.

`data/card_shorthands.json` held the shorthand text for 306 of FIN's 312
cards (6 basic lands excluded); `data/card_shorthand_status.json` tracked
per-card review status (`ai` vs `human`-reviewed). `app/lib/shorthand.ts`
was the parser that unpacked shorthand tokens back into full text;
`MtgIcon.vue`/`MtgIcon.stories.ts` was a bracket-icon renderer for it.

## History

Six commits (`56fd3ff` → `a364d1b`):

1. Introduced the notation and a card detail page to render it.
2. Tried self-hosting Scryfall's own mana symbols in place of a
   third-party icon font (the [Mana font](https://github.com/andrewgioia/mana)).
3. A full draft pass writing shorthand for all 312 FIN cards.
4. Two human-review passes over FIN #1–100, which progressively **retired**
   several tokens once they turned out not to actually compress anything:
   `[optional]`/`[you may]` (identical length to the real wording),
   `Your <noun>` (ditto), and — the biggest one — every icon borrowed from
   the Mana font or similar (landfall, trample, vigilance, +1/+1 counter,
   power, tap, crew, a Keyrune "target" symbol). The rule that emerged:
   real MTG keywords and stats are always plain, undecorated English —
   never bracketed, since there's no icon a bracket could ever resolve to.

## Status: abandoned mid-review

Human review had reached card **#100 of 312** when work stopped (see the
now-superseded `NEXT_STEPS.md` for the last checkpoint). The live card
detail page and its API (`app/pages/app/card/[set]/[number].vue`,
`server/api/card/[set]/[number].ts`) no longer reference shorthand at
all — that wiring was removed separately, ahead of this archival, as part
of unrelated in-progress work on those same files. `app/lib/shorthand.ts`
had already become dead code (unimported anywhere) by the time this was
archived.

`ManaSymbol.vue`, `app/lib/manaSegments.ts`, and
`data/mana_symbols/manifest.json` are **not** part of this archive — they
render literal `{X}`-style mana symbols and are still live, shared
infrastructure used by the Forge-model card rendering pipeline
(`ForgeCardScript.vue`, `forgeScript.ts`, the card page).

## If picking this back up

- `CARD_SHORTHAND.md` is the full rulebook as it stood at retirement —
  read its own "Rules" section for the current (post-retirement) token
  set before writing any new shorthand.
- Review was linear (#1 → #312); resume at #101 rather than re-reviewing
  #1–100.
- Re-wire `app/lib/shorthand.ts` into whatever replaces the old card
  detail page's rendering path if this comes back.
