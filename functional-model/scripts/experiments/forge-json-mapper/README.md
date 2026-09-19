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

The core parser (`parse_card_file()` and everything under "Line/face
parsing" in `forge_json_mapper.py`) is verified against **Forge's entire
real cardsfolder tree - all 33,798 `.txt` files** under
`tmp/mtg-forge/forge-gui/res/cardsfolder/` (every letter directory, plus
`rebalanced/` and `upcoming/`), not just Foundations. A full-corpus
stress-test run (see "Full-corpus stress test and fixing the remainder"
below) found and fixed every real shape needed to reach a clean parse
across the whole corpus - **33,798/33,798, zero exceptions needed**. This
grew out of an FDN-scoped experiment (see the "Scaling to..." sections
below for that history) and started out explicitly *not* a general parser;
at this point that framing is no longer accurate, even though the intent
was always narrow (see "What this is not" above) and it's still not
guaranteed to handle some future Forge file shape that doesn't exist yet
in this checkout - an unhandled shape still raises loudly
(`UnhandledShapeError`) rather than silently dropping data.

`resolve_fdn_cards()` (and the rest of the "517-card list resolution"
section of the script) is a separate, FDN-specific convenience mode built
on top of the general parser: it queries this repo's own `data/cards.db`
for Foundations' **517 distinct card names** (`set_code='fdn'` - 771 total
rows there, but that counts every reprint across FDN's bonus/showcase
sheets separately, e.g. Exemplar of Light alone has 5 collector numbers
for the identical card script; deduped by name down to one entry per
unique card), then resolves each name against the real `cardsfolder/`
tree by enumeration - never by blindly trusting a derived filename slug,
same "verify the file's own `Name:` line" discipline throughout. Running
`python3 forge_json_mapper.py` (no arguments) uses this FDN-scoped mode,
writing to `./output/`.

This started as a 20-card experiment (collector numbers 1-20), scaled to
100 (collector numbers 1-100), then to the full 517-card FDN set, and then
(this pass) to Forge's entire real cardsfolder tree; see "Scaling to 100
cards", "Scaling to full FDN (517 cards)", and "Full-corpus stress test
and fixing the remainder" below for what each pass did and didn't need to
change.

## Mapping rules

The multi-face and duplicate-name rules below were verified against
Forge's own Java source under `tmp/mtg-forge/` - specifically
`forge-core/src/main/java/forge/card/CardRules.java` and `CardFace.java`,
and `forge-core/src/main/java/forge/util/FileSection.java` - not guessed
from the `.txt` shape alone. See "Full-corpus stress test and fixing the
remainder" below for how and why that mattered.

- Any top-level line whose prefix isn't `K`/`T`/`S`/`R`/`A`/`SVar`/`Variant`
  (`Name`, `ManaCost`, `Types`, `PT`, `Oracle`, `DeckHas`, `DeckHints`,
  `DeckNeeds`, `AI`, `Loyalty`, `AlternateMode`, ...) becomes a scalar JSON
  field keyed by Forge's own literal prefix, value = the raw text after
  the prefix's colon, completely unmodified - no re-splitting `Types` on
  spaces, no interpreting `Oracle`'s literal `\n` escape sequences (kept as
  the two characters `\` + `n`, exactly as Forge stores them), no touching
  embedded `|` characters (e.g. `DeckHas:Ability$LifeGain|Token|Food` stays
  one raw string).
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
  "ability type" field invented. A segment with **no `$` at all** becomes a
  key mapped to `""` (empty string) - verified against Forge's own real
  parser (`FileSection.parseToMap`: `result.put(v[0].trim(), v.length > 1 ?
  v[1].trim() : "")` - a `$`-less segment's whole text becomes the map key,
  paired with `""`; this is Forge's genuine, always-applied behavior, not
  a guard against an error case) - see "Full-corpus stress test" below for
  the two real cards (Volatile Rift, Criminal Past) that needed this.
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
  below; also verified against `CardRules.java`'s own real parser, which
  skips these lines outright: `if (line.isEmpty() || line.charAt(0) == '#')
  continue;` - Forge's engine never even sees this line, but this mapper's
  job is a lossless mirror of the file text, not a reimplementation of
  what Forge's engine uses). Kept verbatim, `#` included, in a top-level
  `"#"` array - reusing the literal marker character as the JSON key, the
  same way `"K"` mirrors `K:`, rather than inventing a
  `"comment"`/`"_comment"` field name.
- **A repeated name/key never overwrites the earlier occurrence** - a
  second `SVar:<Name>` reusing a name already used on the same face, a
  second `Param$` key repeated within one `T:`/`S:`/`R:`/`A:` line, or a
  second top-level scalar line repeating the same prefix all get preserved
  as a list of every occurrence, in source order, rather than the later one
  silently replacing the earlier one. This is a deliberate divergence from
  Forge's own actual runtime behavior, which **does** silently overwrite on
  a repeat (verified: `CardFace.addSVar()` does `this.variables.put(key,
  value)` into a plain `TreeMap`; `FileSection.parseToMap()` likewise does
  `result.put(v[0].trim(), ...)` into a plain `TreeMap` for a line's
  `Key$Value` segments - both ordinary last-write-wins Java `Map`s) - but
  this mapper's job is a complete, lossless mirror of the literal script
  text, and dropping an earlier occurrence to match Forge's runtime
  overwrite would violate that. A repeated name is real, valid content
  Forge's file format allows (e.g. `false_floor.txt` legitimately reuses
  the SVar name `ETBTapped` for two different replacement effects), not a
  malformed shape.
- **Multi-faced cards** - verified against `CardRules.java`'s
  `Reader.parseLine()`/`readCard()`, which processes a card script as a
  flat stream of lines while tracking a "current face" index (starting at
  0) that certain directive lines switch:
  - A line that is exactly `ALTERNATE` (no colon, no value) switches to
    face slot 1 - Forge's real transform/MDFC/split/adventure back face.
    Represented as a top-level `"ALTERNATE"` array holding that one face
    object (reusing Forge's own literal directive token as the JSON key
    rather than inventing `"backFace"`/`"faces"`/etc.) - kept as an array
    for continuity with earlier passes of this experiment, even though in
    practice exactly one such face exists per card.
  - A line `SPECIALIZE:<COLOR>` (Bloomburrow's Specialize mechanic,
    `<COLOR>` being `WHITE`/`BLUE`/`BLACK`/`RED`/`GREEN` - confirmed
    exhaustive by checking every real `SPECIALIZE:` line's value across
    all 33,798 files) switches to one of 5 further fixed face slots, one
    per color (e.g. Alora, Rogue Companion has 6 total faces: the base
    card plus one Specialize face per color). Represented as a top-level
    `"SPECIALIZE"` object keyed by the literal color name, in the order
    the colors first appear in the file, so each face's color identity is
    preserved rather than discarded.
  - Blank lines carry no face-switching meaning at all and have no content
    of their own to preserve, so they're silently skipped - verified
    against Forge's own real parser, which does the same
    (`readCard()`: `if (line.isEmpty() || ...) continue;`). An earlier
    version of this mapper incorrectly required a very specific
    blank/`ALTERNATE`/blank 3-line pattern and raised on any other blank
    line - that assumption held for every one of FDN's 517 cards (zero of
    which use `ALTERNATE` at all) but broke on ~19% of the wider corpus's
    failures (see "Full-corpus stress test" below).
  - None of Foundations' 517 real cards uses either `ALTERNATE` or
    `SPECIALIZE` (verified three independent ways for `ALTERNATE` - see
    "Scaling to full FDN" below), so this logic is exercised directly
    against real non-FDN Forge files, both via the full-corpus stress test
    and (for `ALTERNATE` specifically, before that stress test existed) 3
    hand-picked external examples - see "Scaling to full FDN" below.
- `Variant:<Name>:<Rest>` lines merge into a top-level `"Variant"` object
  keyed by `<Name>`, whose value is `<Rest>` parsed the same way any single
  line would be - recursively, through this exact same list of rules
  (verified against `CardRules.java`'s own Variant handling, which
  literally recurses into `this.parseLine(variantLine, varFace)` on a
  fresh per-variant face object). Two real, unrelated Forge mechanics reuse
  this identical line shape: Unfinity's cosmetic Attraction-deck "Lights"
  print variants (e.g. `Variant:A:Lights:2 6`, alongside a
  `# --- VARIANTS ---` comment header that falls into the `#` rule above)
  and cross-set "UniversesWithin" flavor-name/type/ability overrides (e.g.
  `Variant:UniversesWithin:FlavorName:Qoneus, Horizon Splicer`) - neither
  gets special-cased, both just decompose through the same recursive rule.

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
  (`split_face_blocks()` + `parse_face_lines()` in `forge_json_mapper.py`
  at the time - since superseded by `parse_card_file()`'s own line-by-line
  face routing, see "Full-corpus stress test" below; see the `ALTERNATE`
  mapping rule above for the current shape) - and since FDN itself can't
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

## Full-corpus stress test and fixing the remainder (33,798 files)

A purely diagnostic "let's see if it fails" run pointed the parser (via a
throwaway driver, not committed) at every `.txt` file under
`tmp/mtg-forge/forge-gui/res/cardsfolder/` - all 33,798 files across every
letter directory plus `rebalanced/` and `upcoming/`, i.e. Forge's entire
real card pool, not just FDN. Result: **33,741/33,798 (99.83%) parsed
clean** on the first try, with the 57 failures falling into exactly 5
distinct, fully root-caused categories - a remarkably small remainder
given the parser had only ever been checked against 517 modern cards.
This section covers what fixing all 5 for real (in this committed script,
not the throwaway driver) actually took - in each case, verifying the true
rule against Forge's own Java source before implementing anything, per
this whole experiment's standing "match Forge's real mechanism, don't
guess" principle.

- **13 files - repeated `SVar` name on one face** (e.g. `false_floor.txt`
  reuses the SVar name `ETBTapped` for two independent `R:` replacement
  effects with different bodies; `geyadrone_dihada.txt` reuses
  `DBPutCounter` across two `A:` abilities). The initial diagnostic run's
  own report speculated this might mean Forge scopes `SVar` names
  per-ability-chain rather than flatly per card. That speculation was
  wrong, and checking the real source before implementing anything (per
  this fix's own explicit instruction) caught it: `CardFace.java`'s
  `addSVar()` is `this.variables.put(key, value)` into one plain
  `TreeMap` per face - a flat map, and a plain `Map.put()` silently
  overwrites on a repeat. So Forge's *real* rule is simpler and less
  forgiving than the speculation: the second occurrence just clobbers the
  first at runtime, full stop. Given that, the faithful choice for a
  mapper whose entire point is a lossless mirror of the literal text (not
  a re-implementation of Forge's runtime resolution) is to preserve every
  occurrence rather than replicate the overwrite - seeing `ETBTapped`
  twice in the file is real information a flat "last one wins" JSON object
  would erase. Implemented generally: a repeated name now becomes a list
  of every occurrence, in source order (see the "A repeated name/key..."
  mapping rule above) - and, since `FileSection.parseToMap()` (used for
  every `T:`/`S:`/`R:`/`A:` line's own `Key$Value` segments) has the exact
  same flat-`Map`-with-overwrite shape, the identical list-preserving rule
  was applied there too for consistency, not just for the `SVar` case that
  happened to surface it.
- **19 files - Bloomburrow "Specialize" cards** (e.g. Alora, Rogue
  Companion, which has 6 total faces - a base card plus one full card face
  per color). Reading `CardRules.java`'s `Reader.parseLine()` directly
  (rather than inferring a rule from the `.txt` shape) showed these use a
  second, independent face-switching directive alongside `ALTERNATE`:
  `SPECIALIZE:<COLOR>` jumps to one of 5 fixed face slots (one per color).
  This meant replacing the old `split_face_blocks()`/`parse_face_lines()`
  blank/`ALTERNATE`/blank-block-splitting approach entirely with
  `parse_card_file()`'s current line-by-line "current face" routing (which
  also directly fixed the blank-line assumption called out in the
  `ALTERNATE` mapping rule above) - with each color's face kept under its
  own literal color-name key in a top-level `"SPECIALIZE"` object, so
  the color identity isn't discarded.
- **23 files - Unfinity "Attraction" `# --- VARIANTS ---` blocks** (e.g.
  `bounce_chamber.txt`'s `Variant:A:Lights:2 6` /
  `Variant:B:Lights:3 6` / ... lines, physically-real "which lights are lit
  on this print" data, cosmetic but real). `CardRules.java`'s own `Variant`
  handling turned out to be more structured than a flat list of raw
  strings: it recurses (`this.parseLine(variantLine, varFace)`) into a
  fresh per-variant-name face object. Checking every real `Variant:` line
  across the full corpus (not just the 23 failing files) confirmed this
  recursion is exercised for far more than just `Lights` - `A`,
  `FlavorName`, `K`, `Oracle`, `PT`, `SVar`, `T`, and `Types` all appear as
  the nested key on one Variant line or another (the `FlavorName` ones are
  an unrelated mechanic, "UniversesWithin" cross-set flavor renames, that
  happens to reuse the identical `Variant:` line shape). So this was
  implemented as the real recursive structure Forge uses (a top-level
  `"Variant"` object keyed by variant name, each value parsed via the same
  line-dispatch function called recursively) rather than the flatter
  "array of raw strings, same as `K`" shape that seemed like the obvious
  choice before checking the source.
- **1 file - `volatile_rift.txt`'s bare `TriggeredCardLKICopy` token**
  sitting in an otherwise normal `Key$Value | Key$Value` list with no `$`
  of its own. Checking Forge's real segment-parsing code
  (`FileSection.parseToMap()`) before deciding how to represent this
  turned up something worth being honest about: this is almost certainly
  a genuine authoring typo (missing `Defined$` - every *other* real use of
  `TriggeredCardLKICopy` anywhere in Forge's source is as a `Defined$`
  value), not a legitimate "presence-only boolean flag" convention as it
  first looked. But Forge's own parser doesn't error on it or treat it
  specially - `parseToMap()` unconditionally does
  `result.put(v[0].trim(), v.length > 1 ? v[1].trim() : "")`, so a `$`-less
  segment's whole text just becomes a map key paired with `""`. That's a
  real, general, always-applied rule, not a guard clause - so it's
  implemented generally (see the `T:`/`S:`/`R:`/`A:` mapping rule above:
  `{"TriggeredCardLKICopy": ""}`), not as a one-off exception for this
  file.
- **1 file - `criminal_past.txt`'s trailing free-text segment** in an
  `SVar` value (`SVar:PowerGrave:Mode$ Continuous | Affected$ Card.Self |
  AddPower$ X | This creature gets +X/+0, where X is the number of
  creature cards in your graveyard.` - the last segment has no `Description$`
  key, unlike every other static-ability description in this corpus).
  Given the instruction to actually check whether this is a one-off typo
  or a real recurring shape before deciding how to handle it: it turned out
  to be the *exact same* general rule as `volatile_rift.txt` above, not a
  separate case needing its own exception - `parseToMap()` treats this
  $-less trailing segment identically (the whole sentence becomes an odd
  but well-defined map key mapped to `""`). So this needed **no special
  case and no documented exception at all** - it's just another instance
  of the one general fix. (It's very likely still a genuine human
  authoring mistake relative to *intent* - whoever wrote this file almost
  certainly meant to type `Description$` - but that's a data-quality note
  about this one upstream Forge file, not a parsing shape this mapper
  needs to treat specially; Forge's own engine tolerates it exactly the
  same way this mapper now does.)

**Verification**: re-ran the (now-fixed) parser against the full 33,798-file
corpus - **33,798/33,798, zero failures, zero exceptions needed** (not even
a documented one for `criminal_past.txt` - see above). Re-ran against
FDN's own 517 cards - still 517/517, and confirmed no output-shape
regression (none of the 517 exercises `ALTERNATE`/`SPECIALIZE`/`Variant`,
and grepping the regenerated output for empty-string values found only the
8 pre-existing vanilla creatures' empty `Oracle` fields, not a new
side-effect of the `$`-less-segment rule). Spot-checked all 5 fixed
categories' representative files (plus one more `Variant` example,
`the_spot_living_portal.txt`, to confirm the "UniversesWithin" case)
field-by-field against their real `.txt` source.

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

Last run (FDN-scoped mode): all 517/517 distinct FDN cards parsed
successfully, zero `UnhandledShapeError`s, and a full corpus-wide
source-line/JSON-item reconciliation confirmed zero mismatches across all
517.

Last run (full-corpus mode, via the separate `tmp/forge-json-mapper-full-run/`
driver - gitignored, not part of this repo, but reusing this script's own
`parse_card_file()` unmodified): all 33,798/33,798 real Forge cardsfolder
files parsed successfully, zero `UnhandledShapeError`s.
