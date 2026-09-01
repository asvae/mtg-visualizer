# Card Shorthand Conventions

House notation for writing homebrew card text compactly. This is a glossary of
tokens and what each one unpacks to — not a general-purpose parser or an
attempt to reduce every possible card wording to a fixed set of pieces. If a
card's effect doesn't match an existing token, just write it out in plain
English; don't force a new abbreviation onto it.

## Rules

- No truncation of words (e.g. "oth" for "another") — full words only.
- Readability over maximum compression.
- A token means the same thing on every card that uses it. If a future card
  needs a variant behavior, that's a new token, not a reused one with
  different meaning.
- Icons (from the [Mana font](https://github.com/andrewgioia/mana)) are used
  only where a real icon exists for the concept. No icon exists for generic
  actions like search/tutor, or for "target" — those stay plain text, not a
  bracket word, even when a stand-in glyph could technically be borrowed
  from an unrelated font (tried once for "target", reverted — not worth the
  visual mismatch).
- Technical rules analysis only — exclude lore/flavor. A card's own named
  sub-ability (e.g. a Saga chapter's "Mega Flare" or an activated ability's
  flavor name) isn't kept; describe the effect, not what the card calls it.
- A static ability describing the card itself drops the subject: "Gets +1/+1
  for each Equipment you control," not "This creature gets...".
- Every trigger header uses an em dash ("—"), never a colon — matches real
  templating's own "Landfall — Whenever..." style. `[Enter] —`, `[Attacks] —`,
  `[Dies] —`, `[Heal] —`, `[Landfall] —`, Saga chapter numbers, and a
  modal's `Choose one —` are all the same one convention, not several
  different ones. `[Flashback]` is neither a trigger nor a cost:effect
  activated ability, so it doesn't get a dash — just `[Flashback] {cost}.`

## Icon syntax

In `data/card_shorthands.json`, an icon is written as a plain `[word]`
placeholder (e.g. `[trample]`, `[Landfall]`, `[tapped]`) — not raw HTML, and
`word` is exactly the real English word that belongs at that spot in the
sentence, real casing included ("Landfall" at a sentence start, "tapped" as
an adjective). This is deliberate: icons are a display choice, not a
different notation — turning them off in the future should be a plain
`[word]` -> `word` bracket-strip with no other rewrite needed, so the text
must already read correctly with the brackets removed. Don't invent a
shorthand word that isn't what you'd actually write in plain English.

The frontend (`app/lib/shorthand.ts`'s `parseShorthand`) splits the string on
these placeholders and renders each one as an `<MtgIcon :name="..." />`
component (`app/components/MtgIcon.vue`), which owns the actual icon font
class(es), hover tooltip, and baseline alignment for that icon. Matching is
case-insensitive, and `MtgIcon.vue`'s `ICON_DEFS` lists every word variant
that maps to a given icon (e.g. both "tap" and "tapped" -> the tap icon) —
add a variant there rather than inventing a new bracket word when a card
needs a different grammatical form of the same concept. A word with no entry
in `ICON_DEFS` — a typo, or a real accepted token just pending a glyph (e.g.
`[Draw]`) — renders as its own plain text, brackets stripped: the whole
point of the bracket word being real English is that this fallback always
reads fine either way. Use a pending-icon word anyway rather than waiting
for the icon to exist; adding it later needs no change to
`data/card_shorthands.json`.

So: bracket a word or phrase whenever it's one of this glossary's defined
tokens — whether or not it currently has an icon — and leave everything else
as plain, undecorated English. The brackets mark "this is a tracked token,"
not "this currently has a picture." Multi-word phrases are fine (`[you
may]`, `[the bottom]`) — the placeholder syntax matches any run of
non-bracket characters, not just a single word.

A stand-in icon borrowed from an unrelated glyph has been tried twice
(Keyrune's Ixalan symbol for "target", mana-font's "d" for a modal's
"Choose one —") and reverted both times — the visual mismatch wasn't worth
it. Both now stay plain, undecorated text, never bracketed. Default to plain
text over a stand-in icon; only add one when it actually resembles the
concept.

**Exception — icon-led markers.** The bracket-strips-to-plain-English
guarantee above is for a word sitting where it would naturally go in the
sentence (`a [tapped] land` -> `a tapped land`). A modal/targeted effect can
instead lead with one or more icons as at-a-glance action markers ahead of
the object — accepted deliberately even though the bracket-stripped text
won't always come out grammatical in that case; if icons are ever turned off
project-wide, a line using this exception would need a manual rewrite, not a
plain strip. Not currently used by any card (the one prior example reverted
to plain grammatical order), but still available for a future one that
needs it.

**Mana/cost symbols — `{X}`, not `[x]`.** A literal mana or cost symbol
straight out of real oracle text — `{T}`, `{C}`, `{2}`, `{W}`, ... — is
written exactly as Scryfall would print it, curly braces included, and
`app/lib/shorthand.ts`'s `parseShorthand` renders it via
`app/components/ManaSymbol.vue` the same way scryfall.com renders its own
card text: an `<abbr>` with the literal `{X}` as its (visually hidden but
accessible) content, `title` set to Scryfall's own English description, and
the actual glyph painted via a background-image — a base64-encoded SVG data
URI baked directly into `data/mana_symbols/manifest.json` (one HTTP request
up front for the whole manifest, zero per-icon requests after, same as
Scryfall's own inlined card-symbol CSS). Fetched via
`npm run fetch:mana-symbols` from
[Scryfall's `/symbology` endpoint](https://scryfall.com/docs/api/card-symbols)
— see `scripts/fetch-mana-symbols.mjs`. Covers every symbol Scryfall
recognizes (mana costs, `{T}`/`{Q}`, `{E}`, hybrid/phyrexian, snow, `{X}`,
...); re-run the fetch script if a new one shows up that isn't in the
manifest yet. Unlike `ICON_DEFS`'s curated word list, this needs no entry
anywhere — write the ability text exactly as printed and it just works.
Bracket icons stay for our own compressed English words (`[trample]`,
`[Landfall]`); curly braces
are for symbols that already exist verbatim in the card's real text.

## Tokens

| Token | Unpacks to |
|---|---|
| `[Enter] —` | "When this creature enters," |
| `[Attacks] —` | "Whenever this creature attacks," |
| `[Dies] —` | "When this creature dies," |
| `[Heal] —` | "Whenever you gain life," |
| `Any [heal] —` | "Whenever a player gains life," (no "you" — any player, not specifically you) |
| `Enemy [heal] —` | "Whenever an opponent gains life," — same `Any`/`Enemy` qualifier pattern as the phase triggers above |
| `[Landfall] —` | "Landfall — Whenever a land you control enters," |
| `ramp` | "search your library for a land card, put it onto the battlefield, then shuffle" — tapped/untapped is *not* implied, state it separately |
| `[tutor] <type>` | "search your library for a \<type\> card, reveal it, put it into your hand, then shuffle" — hand, not battlefield; see `ramp` for the land-to-battlefield case |
| `[optional]` (or `[you may]`) | "you may" |
| `[bounce] <target>` | "return <target> to its owner's hand" |
| `[Reanimate] <target> tapped` | "return target creature card from your graveyard to the battlefield tapped" — a specific, already-targeted graveyard card, not a search (distinct from `[tutor]`/`[dig]`); real MTG community term for this exact effect |
| `[tapped]` (or `[tap]` as a noun/verb) | "tapped" / "tap" |
| `[trample]` | "trample" |
| `[flash]` | "flash" |
| `[lifelink]` | "lifelink" |
| `[Flashback]` | "Flashback" — followed directly by the cost, no dash (it's neither a trigger nor a cost:effect activated ability), e.g. `[Flashback] {2}{W}{W}.` |
| `[counter]` (or `[counters]`, plural) | "+1/+1 counter(s)" — the generic case; state the amount in plain text around it (e.g. "a +1/+1 [counter]", "X +1/+1 [counters]"), don't try to bracket the amount itself |
| `[stun]` (or `[stuns]` as a verb) | "stun counter" / "puts a stun counter on" |
| `[power]` | "power" |
| `N+` | "N or greater" |
| `+N/+M` | a stat pump — carries no implied duration (see Duration below) |
| `for this turn` | equivalent to official "until end of turn" wording — marks a temporary effect |
| `burns <target> for <amount>` | "deals <amount> damage to <target>" — noncombat damage only, not a combat-damage description |
| `stuns <target>` | "puts a stun counter on <target>" — a stun counter's only rules effect is the untap-prevention static ability, so this is unambiguous |
| `another <noun>` | excludes the source permanent itself |
| `your <noun>` | "<noun> you control" — not "you own"; spell out "control" explicitly on the rare card where the ownership/control distinction actually matters |
| `each your <noun>` | "each <noun> you control" (this reverses an earlier call to always spell out "each of your \<noun\>s" — the shorter form is the current standard) |
| `[Donate] <target> to <target>` | "target opponent gains control of <target>" — the real MTG community term (whole deck archetype named after it), avoids reusing the official "Gift" keyword (a different, real mechanic) |

Use `your <noun>` by default — don't spell out "\<noun\> you control" just because that's how the real oracle text phrases it. The one place "you control" stays spelled out is a *targeted* selection already qualified by "another"/"other" (e.g. "another permanent you control", "another target creature you control") — that's an established exception, not an oversight; a plain plural/non-targeted "other \<noun\>s you control" still becomes `your other <noun>s`.
| `[tutor] and/or [dig] <type>` | "search your library and/or graveyard for a \<type\> card, reveal it, put it into your hand" — `[dig]` alone means graveyard only, never needs a shuffle; combine with `[tutor]` for "library and/or graveyard" and add "shuffle if you [tutored]" since only the library side needs one |
| `X = <thing>` | "where X is the number of <thing>" |
| `Copy <thing> to <target>` | "put the same number of <thing> onto <target> as are on this permanent" |
| `[Draw]` (optionally followed by a number) | "draw a card" — the count is omitted when it's exactly one; state it only for two or more, e.g. `[Draw] 2`. No icon yet, so this currently just renders as the plain word "draw" |
| `[vigilance]` / `[indestructible]` / `[ward]` / `[hexproof]` / `[crew]` / `[reach]` | the keyword itself |
| `[Sorcery speed only]` | "Activate only as a sorcery" — Mana font's actual Sorcery card-type pip, a real semantic fit (unlike the borrowed-icon experiments that got reverted) |
| `enemy <noun>` | "\<noun\> an opponent controls" |
| `[Job select]` | the set's own named mechanic (not flavor) — kept verbatim (bracketed like any tracked token, no icon yet), its reminder text dropped like any other |
| `Wielder` | "Equipped creature" |
| `is a <type>` (no qualifier) | "is a \<type\> in addition to its other types" — additive is the default, no "additionally" needed |
| `loses other types` | states explicitly when a type change actually replaces the permanent's other types, the non-default case |
| `End the turn` | Ultima's own named keyword action — kept verbatim, its reminder text dropped |
| `[Upkeep] —` | "At the beginning of your upkeep," |
| `[Draw step] —` | "At the beginning of your draw step," — never shortened further to `[Draw]`; that word is already the draw-a-card action token and the two would collide |
| `[End step] —` | "At the beginning of your end step," |
| `[Combat] —` | "At the beginning of combat" (on your turn) — this one covers *only* that specific trigger point, not declare attackers/blockers, end of combat, or any other combat sub-step; those stay spelled out in full |
| `Any [upkeep\|draw step\|end step\|combat] —` | "At the beginning of each \<phase\>" (every player's, not just yours) |
| `Enemy [upkeep\|draw step\|end step\|combat] —` | "At the beginning of an opponent's \<phase\>" — same "enemy" qualifier as `enemy <noun>`, itself never bracketed |

Saga chapter lines (`I —`, `II —`, `III —`) use the same em dash as every
other trigger header (see Rules above) — a chapter number is just another
kind of trigger marker. The universal Saga reminder text ("As this Saga
enters... add a lore counter...") is dropped entirely, same reasoning as
dropping ETB's own boilerplate: it's identical on every Saga card, not
specific to this one.

**Modal DFCs / transforming cards.** `data/card_shorthands.json` is keyed by
the card's full Scryfall name, which for one of these is already the
combined `Front // Back` — so each face gets its own header line (the face's
own name, plain text, no brackets — it's an identifier, not a token), an em
dash, then that face's shorthand body, with a blank line between faces:

```
Front Name —
...front face body...

Back Name (Saga) —
...back face body...
```

A face's type (e.g. `(Saga)`, `(Land)`) is noted in the header only when it
isn't obvious/already covered by the body's own tokens.

## Duration

Comprehensive Rules 611.2c: a one-shot effect with no stated duration is
**permanent** by default, not "until end of turn." (Real cards confirm this —
e.g. Lead-Belly Chimera's activated ability grants trample with reminder text
"This effect lasts indefinitely.") So `for this turn` must be stated explicitly
whenever an effect is meant to be temporary; omitting it means permanent, not
implied end-of-turn.

## Status tracking

`data/card_shorthand_status.json` — flat object keyed by card name (same key
as `data/card_shorthands.json`), same two-axis shape as the main tagging
pipeline's `tagging/card-enrichment-status.json`:

```json
{
  "Card Name": {
    "shorthand": "ai" | "human",
    "review": "ai" | "human"
  }
}
```

`shorthand` is who wrote the card's shorthand text; `review` is who last
verified it reads correctly and matches the tokens above. A card with a
`data/card_shorthands.json` entry should always have a matching entry here.

## Examples

Gladiolus Amicitia (homebrew), as stored in `data/card_shorthands.json`:

```
[Enter] — ramp a [tapped] land.
[Landfall] — another target creature gets +2/+2 and [trample] for this turn.
```

Summon: Bahamut (`fin`, #1), a Saga:

```
I, II — Destroy up to one target nonland permanent.
III — [Draw] 2.
IV — Burns each opponent for the total mana value of your other permanents.
[Flying]
```

Aerith Rescue Mission (`fin`, #5), a modal sorcery:

```
Choose one —
• Create three 1/1 colorless Hero creature tokens.
• [Tap] up to three target creatures. [Stuns] one of them.
```
