# Forge card-script -> JSON mapper (experiment)

**What this is**: a standalone, throwaway experiment that converts real
Forge MTG card-script `.txt` files (Forge's own line-based DSL) into JSON
that mirrors Forge's own on-disk representation as directly as possible -
literal property/param names, no invented vocabulary, nothing dropped.

**What this is not**: production code, wired into any build/pipeline, or
related to this repo's own `functional-model/card.ts` schema
(`CardDefinition`/`Effect`/`Trigger`). It was written deliberately without
looking at that schema at all - the point of the experiment is to see what
a Forge-faithful mapping looks like *before* any of this project's own
schema design choices get applied to it. It only reads from the local,
gitignored `tmp/mtg-forge/` Forge checkout (not itself part of this repo).

## Scope

Handles the full real Foundations (FDN) card pool: **517 distinct card
names** - every unique card script in this repo's own `data/cards.db` for
`set_code='fdn'` (771 total rows there, but that counts every reprint
across FDN's bonus/showcase sheets separately - e.g. Exemplar of Light
alone has 5 collector numbers for the identical card script; deduped by
name down to one entry per unique card). It is **not** a general
Forge-file parser - it only needs to (and does) correctly handle whatever
line shapes actually appear across those 517 files. Every prefix (`Name`,
`ManaCost`, `Types`, `PT`, `Loyalty`, `K`, `T`, `S`, `R`, `A`, `SVar`,
`AI`, `DeckHas`, `DeckHints`, `DeckNeeds`, `AlternateMode`, `Colors`,
`Oracle`, and the undocumented-but-real `#` full-line comment) and every
`Param$ Value` shape it relies on was verified against all 517 files
before/while the parser was written - see "Scaling to full FDN (517
cards)" below for exactly what that verification covered.

The parser fails loudly (`UnhandledShapeError`) rather than silently
skipping anything it doesn't recognize - an unhandled shape for this
517-card set is a bug, not something to shortcut around. Running it
against all 517 cards produces zero such errors, and a full corpus-wide
reconciliation (every source line accounted for exactly once in the JSON
output, for all 517 cards - not just a spot-checked sample) confirms
nothing was silently dropped.

The 517-card list is **not** a hand-typed table anymore (see
`resolve_fdn_cards()` in `forge_json_mapper.py`): the script queries
`data/cards.db` itself for the distinct FDN names at runtime, then
resolves each one against the real `cardsfolder/` directory tree by
enumeration - never by blindly trusting a derived filename slug, the same
"verify the file's own `Name:` line" discipline as every prior pass, just
automated instead of eyeballed one card at a time.

This started as a 20-card experiment (collector numbers 1-20), was scaled
to 100 (collector numbers 1-100) in a second pass, and then to the full
517-card FDN set in a third pass; see "Scaling to 100 cards" and "Scaling
to full FDN (517 cards)" below for what each pass did and didn't need to
change.

## Mapping rules

- Any top-level line whose prefix isn't `K`/`T`/`S`/`R`/`A`/`SVar`
  (`Name`, `ManaCost`, `Types`, `PT`, `Oracle`, `DeckHas`, `DeckHints`,
  `DeckNeeds`) becomes a scalar JSON field keyed by Forge's own literal
  prefix, value = the raw text after the prefix's colon, completely
  unmodified - no re-splitting `Types` on spaces, no interpreting `Oracle`'s
  literal `\n` escape sequences (kept as the two characters `\` + `n`,
  exactly as Forge stores them), no touching embedded `|` characters (e.g.
  `DeckHas:Ability$LifeGain|Token|Food` stays one raw string).
- `K:<text>` lines append to a top-level `"K"` array of raw keyword
  strings, verbatim - including odd ones like `Ward:PayLife<7>` and the
  full-sentence plaintext keyword on Hare Apparent
  (`"A deck can have any number of cards named CARDNAME."`).
- `T:`/`S:`/`R:`/`A:` lines append to top-level `"T"`/`"S"`/`"R"`/`"A"`
  arrays (order preserved, so multi-trigger/multi-replacement cards like
  Exemplar of Light and Herald of Eternal Dawn get a 2-element array).
  Each line is parsed by splitting on `" | "` into segments, then each
  segment on its *first* `$` into a `Key`/`Value` pair. This uniformly
  captures both `Mode$ Continuous`/`Event$ DamageDone`-style params *and*
  the ability-type marker itself on `A:` lines - Forge's own
  `A:<AB/SP/DB/ST>$ {AFSubclass}` syntax is the same `Key$Value` shape, so
  e.g. `A:SP$ Destroy | ValidTgts$ Creature | ...` becomes
  `{"SP": "Destroy", "ValidTgts": "Creature", ...}` with no extra
  "ability type" field invented.
- `SVar:<Name>:<Value>` lines merge into a top-level `"SVar"` object keyed
  by `<Name>`. If `<Value>` contains at least one `$` it's parsed the same
  Key$Value way as a T/S/R/A line (Forge SVars very often hold a `DB$`/`AB$`
  sub-ability or a `Count$` expression in exactly that shape - e.g.
  `SVar:X:Count$Kicked.0.1` -> `{"X": {"Count": "Kicked.0.1"}}`). If it has
  no `$` at all (e.g. `SVar:PlayMain1:TRUE`, `SVar:BuffedBy:Creature`) it's
  kept as a plain raw string.
- A line starting with `#` is a full-line developer comment - real but
  undocumented in either `Card-scripting-API.md` or `AbilityFactory.md`
  (found on Exsanguinate and Mystical Teachings, see "Scaling to full FDN"
  below). Kept verbatim, `#` included, in a top-level `"#"` array - reusing
  the literal marker character as the JSON key, the same way `"K"` mirrors
  `K:`, rather than inventing a `"comment"`/`"_comment"` field name.
- Multi-faced cards (transform/MDFC, per `Card-scripting-API.md`: "If a
  card has two faces, use `AlternateMode:{CardStateName}` in the front
  face and separate both by a new line with the text `ALTERNATE`"): the
  file is split on the literal 3-line separator (blank line, `ALTERNATE`,
  blank line) into face blocks. The first block becomes the top-level card
  object exactly as for a single-faced card (so single-faced cards - all
  517 real FDN cards, as it turns out - are completely unaffected, no
  `"ALTERNATE"` key appears on them at all). Each subsequent block is
  parsed the same way and appended to a top-level `"ALTERNATE"` array -
  again reusing Forge's own literal separator token as the JSON key rather
  than inventing `"backFace"`/`"faces"`/etc.

## Special-casing / oddball shapes actually found (cards 1-20)

Being honest about what needed attention while building the original
20-card version (none of these needed a special-case branch in the end -
the uniform rules above handle all of them - but they're worth flagging
as the "hard" cases):

- **`K:Ward:PayLife<7>`** (Sire of Seven Deaths) - a keyword line with its
  own embedded `:` and `<...>` cost syntax. Handled fine since `K:` lines
  are kept as one raw string with no further splitting.
- **`K:A deck can have any number of cards named CARDNAME.`** (Hare
  Apparent) - a "plaintext keyword" (per Forge's docs, these are
  hardcoded strings, not real rules keywords) that reads as a full English
  sentence rather than a short token. Handled identically to any other `K:`
  line since it's just a raw string either way.
- **`DeckHas:Ability$LifeGain|Token|Food`** (Cat Collector) and
  **`DeckHas:Ability$LifeGain|Counters`** (Felidar Savior) - bare `|` not
  surrounded by spaces. Confirmed these are scalar `DeckHas`/`DeckHints`/
  `DeckNeeds` fields (not `T:`/`S:`/`R:`/`A:`/`SVar:` ability lines), so
  they're kept as one raw string rather than being run through the
  `" | "`-delimited ability-line parser, which correctly avoids
  misinterpreting that `|` as a param separator.
- **Non-ability `SVar` values** (`SVar:PlayMain1:TRUE`,
  `SVar:BuffedBy:Creature`) - these don't hold a `DB$`/`AB$`/`Count$`
  expression at all, just a bare string. The mapper's SVar rule checks for
  the presence of `$` before deciding whether to structure-parse or keep
  raw, so these fall through to the raw-string case correctly.
- **Multi-line ability chains via `SubAbility$`** (e.g. Celestial Armor's
  `TrigAttach` SVar chains into `SubAbility$ DBPump`, which is itself
  another `SVar`) are *not* resolved/inlined by this mapper - each `SVar`
  stays its own independent entry in the `"SVar"` map, exactly as Forge's
  file stores it, and the chain reference (`"SubAbility": "DBPump"`) is
  just a plain string value pointing at another `SVar` key. Resolving that
  reference graph is exactly the kind of interpretation this blank-slate
  experiment is meant to avoid doing.

Nothing in these 20 files required abandoning or complicating the uniform
`Key$Value | Key$Value` splitting rule - every `T:`/`S:`/`R:`/`A:` segment
and every `$`-bearing `SVar:` value across all 20 cards fit it exactly.

## Scaling to 100 cards (collector numbers 21-100)

Before touching the parser, the wider sample was checked by hand for two
specific things the docs call out as different from a plain
creature/instant/sorcery: multi-faced cards (Forge's `ALTERNATE` block
convention) and planeswalker loyalty abilities.

- **DFC/split/adventure cards**: none of the 100 target cards has an
  `ALTERNATE` line (`grep -l '^ALTERNATE' <file>` across all 100 came back
  empty) - all 100 are single-faced. The parser was still hardened for
  this rather than left to assume it: a bare `ALTERNATE` line now raises a
  dedicated `UnhandledShapeError` naming the multi-face case explicitly
  (previously it would've hit the generic "no `Prefix:` delimiter" error,
  which is also correctly fatal, just less self-documenting). Second-face
  parsing itself is *not* implemented - if a card needing it ever gets
  added to this experiment, that's new work, not a silent misparse.
- **Planeswalkers** (Kaito, Cunning Infiltrator and Chandra, Flameshaper -
  Kiora and Kellan are creatures despite the name pattern, not
  planeswalkers): per `Card-scripting-API.md`, `Loyalty:<N>` is just
  another top-level scalar property (falls through to the same generic
  "unknown prefix -> raw scalar field" rule, no code change needed), and
  per `AbilityFactory.md` there's no separate loyalty-ability line syntax
  - loyalty abilities are ordinary `A:AB$ ...` lines using
  `Cost$ AddCounter<N/LOYALTY>` (plus abilities) or
  `Cost$ SubCounter<N/LOYALTY>` (minus/ultimate abilities) as their cost,
  plus a `Planeswalker$ True` flag param. Both fit the existing uniform
  `Key$Value | Key$Value` parsing exactly (the `<N/LOYALTY>` stays inside
  the `Cost` value untouched, since nothing splits on `<`/`>`), so Kaito's
  and Chandra's 3-ability arrays parsed correctly with zero parser changes
  - only the `CARDS` list needed the new entries.

Two more oddball shapes turned up in the wider sample, also handled by
the existing rules with no code changes:

- **`AI:RemoveDeck:Random`** (Twinflame Tyrant) - a new top-level prefix
  not seen in cards 1-20, documented in `Card-scripting-API.md`'s `AI`
  property row. Falls through to the generic scalar-field rule; since
  that rule only splits on the *first* `:`, the value keeps its own
  embedded `:` intact (`"AI": "RemoveDeck:Random"`).
- **`K:etbCounter:P1P1:1:CheckSVar$ RaidTest:Raid — ...`** (Goblin
  Boarders) and **`K:etbCounter:REVIVAL:8:ValidCard$ ...:This creature
  enters with eight revival counters...`** (Nine-Lives Familiar) - a
  keyword with several colon-separated sub-fields *and* an embedded `$`
  inside one of them, plus a trailing description. Handled identically to
  any other `K:` line (kept as one raw string, no further splitting) -
  the complexity is real but doesn't require the mapper to do anything
  since `K:` never gets decomposed.
- **`SVar:X:Spawner>TriggeredCard$CardCounters.REVIVAL/Minus.1`**
  (Nine-Lives Familiar) - this is the one shape worth flagging as
  genuinely hard to generalize *if* this parser ever grew beyond these
  100 cards. It's a single unbroken token with no spaces/pipes, so the
  existing "has a `$`, so split on first `$`" SVar rule produces
  `{"Spawner>TriggeredCard": "CardCounters.REVIVAL/Minus.1"}` - the text
  before the `$` isn't a normal param name, it's some kind of
  context-selector chain (`Card-scripting-API.md` gestures at this under
  an unfinished "Context switching" doc stub for the `Count$` mini-
  language, without ever spelling out the grammar). The output is still a
  faithful, lossless, literal split on Forge's own `$` convention - just
  flagging that "the bit before the first `$` is always a clean param
  name" holds for every other SVar in all 100 cards but isn't a hard
  guarantee of Forge's format in general.

Nothing across the full 100 cards required abandoning or complicating the
uniform `Key$Value | Key$Value` splitting rule, and no line in any of the
100 files triggered `UnhandledShapeError`.

## Scaling to full FDN (517 cards)

At 517 cards, hand-authoring a `(name, path)` tuple list one entry at a
time (as the old `CARDS` list did for the first 100) stops being
practical. This pass replaced it with `resolve_fdn_cards()`:
`get_fdn_card_names()` runs the literal query
`SELECT DISTINCT json_extract(raw_json,'$.name') FROM cards WHERE
set_code='fdn'` against `data/cards.db` (confirmed: 771 rows, 517 distinct
names - matches the FDN reprint-sheet duplication called out above
exactly), then `resolve_card_file()` resolves each name against the real
`cardsfolder/` tree: `slugify()` derives a candidate slug using Forge's
documented filename convention, `<letter>/<slug>.txt` is tried first, and
if that doesn't exist (or its `Name:` line doesn't match) a `<slug>_*.txt`
prefix search runs within the same letter directory instead (needed for
multi-faced cards, whose filenames concatenate both faces' slugs - see
below). Every single one of the 517 names resolved this way, **and every
resolution still requires the candidate file's own first line to read
exactly `Name:<name>`** before it's accepted - the "no blind-trust slug
matching" discipline explicitly doesn't relax just because it's automated
now, it's actually exercised harder (517 verified lookups instead of 100
eyeballed ones).

Before writing any new parsing logic, the two things the docs flag as
different from a plain creature/instant/sorcery got checked for real
against the full 517, not assumed:

- **Multi-faced cards (transform/MDFC/split/adventure).** Checked three
  independent ways: (1) `layout` in every FDN row's own Scryfall
  `raw_json` is `'normal'` for all 771 rows, no other layout value
  appears; (2) grepping all 517 resolved `.txt` files for a `\nALTERNATE\n`
  block found zero; (3) `card_faces` is absent/empty on every one of the
  771 raw_json rows. **FDN genuinely has zero multi-faced cards** among
  these 517 - not an assumption, a verified fact about this specific set.
  Per the task's own instruction to actually implement this rather than
  leave it a guess, second-face parsing IS implemented for real this pass
  (`split_face_blocks()` + `parse_face_lines()` in `forge_json_mapper.py`,
  see the `ALTERNATE` mapping rule above) - and since FDN itself can't
  exercise it, it was proven correct against three real *external* Forge
  DFC/MDFC files instead (not part of FDN, not part of this experiment's
  output, just a correctness check): `Arlinn, the Pack's Hope // Arlinn,
  the Moon's Fury` (transform planeswalker, loyalty abilities on both
  faces), `Delver of Secrets // Insectile Aberration` (transform creature),
  and `Emeria's Call // Emeria, Shattered Skyclave` (modal DFC, sorcery
  front / land back). All three parsed with every field from both faces
  present and correctly nested under `"ALTERNATE"`, spot-checked
  field-by-field against their real `.txt` source (see the parser's own
  quick self-test - not part of the committed output, run ad hoc against
  `tmp/mtg-forge/.../a/arlinn_the_packs_hope_arlinn_the_moons_fury.txt`
  etc. - during development of this pass).
- **Planeswalkers.** Already handled correctly as of the 100-card pass
  (see above) - the wider 517-card sample added more of them (e.g. Vivien
  Reid, a 3-ability loyalty planeswalker with an emblem-granting ultimate)
  and all parsed correctly with zero further changes.

One genuinely new, previously-undocumented line shape turned up in the
full sample, found on exactly 2 of the 517 cards:

- **Full-line `#` comments.** `Exsanguinate` has
  `# AFLifeLost will be set by LoseLife` and `Mystical Teachings` has
  `# TODO: The AI will currently search for the most expensive valid card
  in the library. ...` - developer notes left in the actual card script,
  never mentioned in `Card-scripting-API.md` or `AbilityFactory.md`.
  Confirmed (grepped all 517 files) that `#` never appears anywhere else
  in any of these files except as the very first character of a line - no
  trailing/inline comments mixed with real `Prefix:Value` content, so
  there's no ambiguity to resolve. This needed a real, new code path (the
  only actual parser-logic addition driven by real FDN content in this
  pass, as opposed to the `ALTERNATE` support which FDN itself doesn't
  exercise): a line starting with `#` is recognized before the normal
  `Prefix:Value` dispatch and appended verbatim to a top-level `"#"` array
  (see the mapping rule above).

No other new top-level prefixes, no new `Key$Value` shapes inside any
`T:`/`S:`/`R:`/`A:`/ability-shaped-`SVar:` line, and no bare/misplaced `|`
characters turned up anywhere across the full 517 beyond what the 100-card
pass had already found (more `DeckHas`/`DeckHints`/`DeckNeeds` fields with
bare `|`, e.g. `Type$Instant|Sorcery` - same pattern, still just kept as
one raw scalar string, never run through the ability-line splitter).

**Verification for this pass**: ran the script for real against all 517
resolved cards (517/517 succeeded, zero `UnhandledShapeError`s); spot-
checked ~10 outputs field-by-field against their real `.txt` source
(including both `#`-comment cards, a basic land, an artifact with two
activated abilities, and a 3-ability planeswalker); and additionally ran a
full corpus-wide reconciliation - for every one of the 517 cards, counted
every source line and every JSON-captured item (each scalar field = 1
line, each `K`/`T`/`S`/`R`/`A`/`SVar`/`#` array or map entry = 1 line) and
confirmed the two counts match exactly for all 517, with zero mismatches -
i.e. proved line-for-line completeness across the whole set, not just the
spot-checked sample.

## Running it

```
python3 functional-model/scripts/experiments/forge-json-mapper/forge_json_mapper.py
```

Requires a local checkout at `tmp/mtg-forge/` (gitignored, not part of
this repo - see the main task/README for how that gets populated) and
this repo's own `data/cards.db` (used only to look up the distinct FDN
card names - read-only, nothing is written back to it). Resolves and
verifies each card's own `Name:` line matches the expected name before
parsing it (rather than trusting the derived filename slug blindly), then
writes one JSON file per card to `./output/<slug>.json`.

Last run: all 517/517 distinct FDN cards parsed successfully, zero
`UnhandledShapeError`s, and a full corpus-wide source-line/JSON-item
reconciliation confirmed zero mismatches across all 517.
