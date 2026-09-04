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
- No icons from the [Mana font](https://github.com/andrewgioia/mana) or any
  other third-party recreation — every keyword-ability/counter/stat icon
  tried that way (landfall, trample, vigilance, +1/+1 counter, power, tap,
  crew, a borrowed Keyrune symbol for "target", ...) has been reverted. Real
  MTG keywords and stats are always plain, undecorated English — never
  bracketed, since there's no icon a bracket could ever resolve to. See Icon
  syntax below for what *is* still an icon (Scryfall's own official symbols).
- Technical rules analysis only — exclude lore/flavor. A card's own named
  sub-ability (e.g. a Saga chapter's "Mega Flare" or an activated ability's
  flavor name) isn't kept; describe the effect, not what the card calls it.
- A static ability describing the card itself drops the subject *and* the
  verb when it's a bare `+N/+M` stat line: "+1/+1 for each Equipment you
  control," not "This creature gets..." or even "Gets +1/+1...". Same for
  any other verb whose subject is this permanent and has been dropped
  (right after a trigger header, a Saga chapter number, or at the very
  start of the card's text) — use the imperative/base form, not
  third-person "-s": "Burn each opponent for...", "Gain \"Whenever...\"",
  not "Burns"/"Gains". This is purely about whether a subject is actually
  present, not position: once a real subject shows up ("it", "this token",
  "target creature you control", "each other Bird you control", ...) the
  verb takes its normal third-person "-s" again — "it \[burns\]", "this
  token \[burns\]", not "it \[burn\]". A bare `+N/+M` line only drops the
  subject/verb when the earlier sentence's subject still obviously applies —
  a later "instead" clause replacing a previously-named target's bonus needs
  its pronoun back: "Target creature gets +2/+2 for this turn. If you
  control three or more creatures, it gets +4/+4 instead." (not "...,
  +4/+4 instead.").
- No `N+` notation ("power 4+") — spell out "N or greater" ("power 4 or
  greater") in the text itself.
- No `[optional]`/`[you may]` token — write plain, unbracketed "you may" (or
  "You may" at a clause start), same retirement reasoning as `Your <noun>`
  above: it's already exactly the real MTG wording, not a compression, so it
  was never a candidate for a bracket in the first place.
- `Enchant <type>` gets no trailing period — it's a type-line-style ability
  word in real templating, not a full sentence.
- A conditional stat pump leads with the `+N/+M`, condition trails: "+2/+0
  while you control two or more artifacts," not "While you control two or
  more artifacts, gets +2/+0." — same "no verb before +N/+M" rule as above,
  just also reordered so the pump is the first thing read.
- "Cast via flashback" ≠ "cast from graveyard" — flashback is one way to
  cast from graveyard, not the only one, so a condition checking *how the
  spell got cast* uses the real wording: "If cast from graveyard,..."
  (matches actual WotC templating), never "if cast via flashback."
- A Saga's keyword abilities (e.g. `[Flying]`) go on their own line at the
  *top* of the Saga section, before the chapter lines — not trailing after
  the last chapter.
- Every trigger header uses an em dash ("—"), never a colon — matches real
  templating's own "Landfall — Whenever..." style. `[Enter] —`, `[Attacks] —`,
  `[Dies] —`, `[Heal] —`, `[Landfall] —`, Saga chapter numbers, and a
  modal's `Choose one —` are all the same one convention, not several
  different ones. `Flashback {cost}.` (bare keyword, no compression to it)
  is neither a trigger nor a cost:effect activated ability, so it doesn't
  get a dash and isn't bracketed either.

## Icon syntax

There are two completely different bracket-like things in
`data/card_shorthands.json`, and it's important not to conflate them:

**1. Real MTG keywords/stats are always plain English, never bracketed.**
`vigilance`, `trample`, `flying`, `tapped`, `crew`, `power`, a `+1/+1
counter`, `Flashback {cost}`, ... — every one of these was tried as a
bracketed icon at some point (`app/components/MtgIcon.vue`'s `ICON_DEFS`,
sourced from the third-party [Mana font](https://github.com/andrewgioia/mana))
and reverted. `ICON_DEFS` is now intentionally empty — there is no icon a
bracket could resolve to for any real keyword, so don't bracket them. Just
write the word. (Existing card text from before this decision may still have
stray brackets around these words from when icons were being tried — they
render fine as-is, since `MtgIcon.vue`'s fallback strips brackets for any
unrecognized name regardless, but there's no need to go find and fix them.
New cards should just skip the brackets entirely for these.)

**2. Bracket words/phrases remain for genuine *compression* tokens** — a
short bracket word standing in for a much longer real phrase, e.g. `[Enter]`
for "When this creature enters," `[tutor]` for "search your library for a
\<type\> card, reveal it, put it into your hand, then shuffle," `[Reanimate]`
for "return target creature card from your graveyard to the battlefield."
These are listed in the Tokens table below. The bracket here marks "this is
a defined glossary shortcut, look up its exact meaning" — genuinely useful
regardless of whether it happens to render as an icon. None of them
currently render as icons either (no icon exists for "this creature enters"
as a concept), but unlike case 1 they're not decorative attempts at an icon
in the first place — they're pure text compression, so they stay bracketed.
`app/lib/shorthand.ts`'s `parseShorthand` renders every bracket word/phrase
(case-insensitive) as an `<MtgIcon :name="..." />` (`app/components/MtgIcon.vue`)
which — since `ICON_DEFS` is empty — always falls through to its plain-text
fallback, brackets stripped, for both categories above. Multi-word phrases
are fine (`[you may]`, `[the bottom]`) — the placeholder syntax matches any
run of non-bracket characters, not just a single word. Don't invent a
shorthand word that isn't what you'd actually write in plain English.

**Mana/cost symbols — `{X}`, not `[x]`.** A literal mana or cost symbol
straight out of real oracle text — `{T}`, `{C}`, `{2}`, `{W}`, ... — is a
third, separate thing again: it's written exactly as Scryfall would print
it, curly braces (not square brackets), and `parseShorthand` renders it via
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
manifest yet. This is the *only* icon system still in active use — write
the ability text exactly as printed and it just works, no curation needed.

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
| `[bounce] <target>` | "return <target> to its owner's hand" |
| `[Reanimate] <target> tapped` | "return target creature card from your graveyard to the battlefield tapped" — a specific, already-targeted graveyard card, not a search (distinct from `[tutor]`/`[dig]`); real MTG community term for this exact effect |
| `+N/+M` | a stat pump — carries no implied duration (see Duration below) |
| `for this turn` | equivalent to official "until end of turn" wording — marks a temporary effect |
| `burns <target> for <amount>` | "deals <amount> damage to <target>" — noncombat damage only, not a combat-damage description |
| `[Stun] <target>` / `stuns <target>` | "tap target, then put a stun counter on it" when the oracle text taps as part of the same effect (the overwhelmingly common case), otherwise "puts a stun counter on <target>" alone — a stun counter's only rules effect is the untap-prevention static ability, so either reading is unambiguous once you check whether the oracle text also taps |
| `[Blink] <target>` | "exile target permanent, then return it to the battlefield under its owner's control" — real MTG community term for this exact effect |
| `another <noun>` | excludes the source permanent itself |
| `<noun> you control` | used everywhere a card refers to permanents/spells you control — a static/anthem effect's subject ("Creatures you control get +1/+1," "Wizards you control gain \[flying\]"), a trigger's condition ("Whenever another creature you control dies," "Whenever a Human you control attacks"), a count ("for each artifact you control," "damage equal to the number of creatures you control"), a target restriction ("target creature you control"), or a cost-reduction subject ("Blue spells you cast cost {1} less"). Never `Your <noun>` — matches real WotC templating, which uses "you control"/"you cast" universally in all these spots, including the anthem-subject case. (An earlier version of this rule kept `Your <noun>` for the anthem-subject case specifically, reasoning it was real MTG idiom there; that was a misread of actual templating and was reverted — WotC's own card text is "Creatures you control get +1/+1," not "Your creatures get +1/+1." Before that, an even earlier single universal `your <noun>` token — and later `each your <noun>` — covering everything was tried and reverted for reading badly in non-subject spots ("each your Cleric," "on your another target creature") before the subject/non-subject split was tried and also abandoned.) |
| `[Donate] <target> to <target>` | "target opponent gains control of <target>" — the real MTG community term (whole deck archetype named after it), avoids reusing the official "Gift" keyword (a different, real mechanic) |
| `[tutor] and/or [dig] <type>` | "search your library and/or graveyard for a \<type\> card, reveal it, put it into your hand" — `[dig]` alone means graveyard only, never needs a shuffle; combine with `[tutor]` for "library and/or graveyard" and add "shuffle if you [tutored]" since only the library side needs one |
| `[Dig] N <type(s)>` | also covers "return up to N target \<type\> cards from your graveyard to your hand" — a targeted return, not a search, but plays out the same at the table, so it isn't worth a separate token from the search sense above |
| `X = <thing>` | "where X is the number of <thing>" |
| `Copy <thing> to <target>` | "put the same number of <thing> onto <target> as are on this permanent" |
| `Sacrifice:` (a cost) | "Sacrifice this creature:" — the sacrificed permanent is this card itself by default in a cost; state a different object explicitly when it isn't ("Sacrifice a creature:") |
| `Spend only on <Type> or <type-specific> abilities.` | "Spend this mana only to cast a \<Type\> spell or activate an ability of a \<Type\> source." Spells-or-abilities is the more common real case for a permanent-type mana restriction (checked against the full Scryfall pool: 19 vs. 9 over spells-only for artifact/Equipment), but not by enough of a margin to justify a silent implied-scope shortcut — so both halves stay explicit rather than compressing to a bare "Spend only on \<Type\>." that would have to be memorized as secretly covering abilities too. Use "Spend only on \<Type\> spells." for the genuinely spells-only case (e.g. Mishra's Workshop). |
| `Put <this card's counters> and attach <Equipment> to <target>` | combines a counter-copy and an Equipment-reattach into one sentence when a card does both at once, sharing one trailing "to it" — "Put this creature's counters and attach Equipment to it." instead of two separate "Copy...counters...then attach...Equipment" sentences. Keeps "attach" (not "put") for the Equipment half — Equipment is attached, not put onto a creature. |
| `[Draw]` (optionally followed by a number) | "draw a card" — the count is omitted when it's exactly one; state it only for two or more, e.g. `[Draw] 2` |
| `[Sorcery speed only]` | "Activate only as a sorcery" — a real reworded compression (not just the bare keyword), so it stays bracketed even with no icon |
| `doesn't untap normally (during its controller's untap step)` | "doesn't untap during its controller's untap step" — the parenthetical stays since a permanent can also fail to untap for other reasons (e.g. a stun counter), so "normally" alone would be ambiguous |
| `enemy <noun>` | "\<noun\> an opponent controls" |
| `Job select` | the set's own named mechanic — kept verbatim, not bracketed (same reasoning as `Flashback`/`Tiered`: zero compression, it's already the exact real templating), its reminder text dropped like any other |
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
[Enter] — ramp a tapped land.
[Landfall] — another target creature gets +2/+2 and trample for this turn.
```

Summon: Bahamut (`fin`, #1), a Saga:

```
Flying
I, II — Destroy up to one target nonland permanent.
III — [Draw] 2.
IV — Burn each opponent for the total mana value of other permanents you control.
```

Aerith Rescue Mission (`fin`, #5), a modal sorcery:

```
Choose one —
• Create three 1/1 colorless Hero creature tokens.
• Tap up to three target creatures. [Stuns] one of them.
```
