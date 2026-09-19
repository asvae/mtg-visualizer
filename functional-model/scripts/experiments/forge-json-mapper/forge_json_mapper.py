#!/usr/bin/env python3
"""
forge_json_mapper.py

Converts real Forge MTG card-script .txt files (Forge's own line-based DSL,
see tmp/mtg-forge/docs/Card-scripting-API/) into JSON that mirrors Forge's
own on-disk representation as directly as possible.

This is a *blank-slate* mapper. It does not import, reference, or borrow
vocabulary from this repo's own functional-model/card.ts schema (CardDefinition
/Effect/Trigger types) or any other in-repo card representation. It only reads
raw .txt files from the local (gitignored) tmp/mtg-forge/ Forge checkout.

Scope: parse_card_file() below is now verified against Forge's ENTIRE real
cardsfolder tree - all 33,798 .txt files under
tmp/mtg-forge/forge-gui/res/cardsfolder/ (every letter dir, plus rebalanced/
and upcoming/), not just Foundations (FDN). A full-corpus stress-test run
(see README.md's "Full-corpus stress test" and its follow-up "fix the
remainder" section) found and fixed every real shape needed to reach a clean
parse across that whole corpus (with one specific, deliberate, still-loudly-
documented exception - see README.md). It is still not guaranteed to handle
every conceivable Forge file that might be added in the future - an
unhandled shape still raises loudly rather than silently dropping data -
but "not a general parser" no longer describes it accurately.

resolve_fdn_cards() (and the rest of the "517-card list resolution" section
below) is one convenience/focused entry point on top of the general
parser: it scopes a run down to just Foundations' 517 distinct card names
(by querying this repo's own data/cards.db), for the FDN-specific work this
experiment started from. The core parser itself (parse_card_file, and
everything below "Line/face parsing") makes no FDN-specific assumptions at
all and is exercised directly against the full corpus - see
tmp/forge-json-mapper-full-run/ (gitignored, not part of this repo) for the
full-corpus driver used to verify that.
If a line shape doesn't match what this script expects, it raises loudly
instead of silently dropping data - that's intentional: an unhandled shape
is a bug to fix, not a line to skip.

Mapping rules (see README.md for more detail; the multi-face and duplicate-
name rules below were verified against Forge's own Java source under
tmp/mtg-forge/ - forge-core/src/main/java/forge/card/CardRules.java,
CardFace.java, and forge-core/src/main/java/forge/util/FileSection.java -
not guessed from the .txt shape alone):
  - Name / ManaCost / Types / PT / Loyalty / Oracle / DeckHas / DeckHints /
    DeckNeeds / AI / ... (any line whose prefix isn't K/T/S/R/A/SVar/Variant,
    and isn't a "#" comment line) -> top-level scalar JSON field, keyed by
    Forge's own literal prefix, value = the raw text after the prefix's
    colon, completely unmodified (no re-splitting, no escape interpretation
    - e.g. Oracle's literal "\n" stays as the two characters backslash+n,
    exactly as Forge stores it; AI:RemoveDeck:Random keeps its own embedded
    ":" since only the *first* colon on the line is the prefix delimiter).
  - K:<text> -> appended to a top-level "K" array of raw keyword strings,
    verbatim (e.g. "Ward:PayLife<7>", "A deck can have any number of cards
    named CARDNAME.", "etbCounter:P1P1:1:CheckSVar$ RaidTest:Raid - ...").
  - T:/S:/R:/A: lines -> appended to top-level "T"/"S"/"R"/"A" arrays. Each
    line is parsed by splitting on " | " into segments, then each segment is
    split on its FIRST "$" into a Key/Value pair (this uniformly captures
    Forge's "Mode$ Continuous", "Event$ DamageDone", and even the ability
    type marker itself for A: lines, e.g. "SP$ PumpAll" -> {"SP": "PumpAll"},
    since Forge's A: line format is literally the same Key$Value convention
    with <AB/SP/DB/ST> as the first key - this also uniformly covers
    planeswalker loyalty abilities, whose "Cost" value is just
    "AddCounter<N/LOYALTY>" / "SubCounter<N/LOYALTY>" text with no further
    splitting needed). A segment with no "$" at all becomes a key mapped to
    an empty string - verified against Forge's own real parser
    (FileSection.parseToMap: `result.put(v[0].trim(), v.length > 1 ?
    v[1].trim() : "")` - a $-less segment's whole text becomes the key, with
    "" as the value; this is Forge's genuine, always-applied behavior, not
    an error case it guards against). Every Param$Value pair from the source
    line becomes one key in the resulting JSON object, in source order.
  - SVar:<Name>:<Value> -> merged into a top-level "SVar" object keyed by
    <Name>. If <Value> contains at least one "$" it is parsed the same way
    as a T/S/R/A line (Forge SVars frequently hold a DB$/AB$ sub-ability, or
    a Count$ expression, in the exact same Key$Value|Key$Value shape). If it
    contains no "$" at all (e.g. "SVar:PlayMain1:TRUE") it is kept as a raw
    string, verbatim.
  - A line starting with "#" is a full-line developer comment (undocumented
    in Card-scripting-API.md/AbilityFactory.md but real - e.g. Exsanguinate
    and Mystical Teachings both have one; also, verified against
    CardRules.java's Reader.readCard(), the exact line Forge's own real
    parser skips as a no-op: `if (line.isEmpty() || line.charAt(0) == '#')
    continue;` - Forge's engine never sees this line at all, but this
    mapper's job is a lossless mirror of the file text, not a
    reimplementation of what Forge's engine uses, so it's still captured).
    Kept verbatim, including the "#" itself, in a top-level "#" array -
    reusing the literal marker character as the JSON key, the same way "K"
    mirrors "K:", rather than inventing a "comment"/"_comment" field name.
  - A repeated name/key (a second SVar:<Name> with a name already used on
    this face, or a second T:/S:/R:/A:-line segment repeating a Param$ key,
    or a second top-level scalar line repeating the same prefix) does NOT
    overwrite the earlier occurrence in this mapper's output, even though
    Forge's own real runtime *does* silently overwrite on a repeat (verified:
    CardFace.java's addSVar() does `this.variables.put(key, value)` into a
    plain TreeMap; FileSection.java's parseToMap() likewise does
    `result.put(v[0].trim(), ...)` into a plain TreeMap for a line's
    Key$Value segments - both are ordinary last-write-wins Java Maps).
    Instead, every occurrence is preserved, in source order, as a list under
    that one name/key. This is a deliberate divergence from Forge's actual
    name-resolution behavior: this mapper's job is a complete, lossless
    mirror of the literal script text, and dropping an earlier occurrence to
    match Forge's runtime overwrite would violate that - a repeated name is
    real, valid content Forge's own file format allows (e.g.
    false_floor.txt legitimately reuses the SVar name "ETBTapped" for two
    different replacement effects), not a malformed shape.
  - Multi-faced cards - verified against CardRules.java's Reader.parseLine()/
    readCard(), which processes a card script as a flat stream of lines
    while tracking a "current face" index (0 by default) that certain
    directive lines switch:
      - A line that is exactly "ALTERNATE" (no colon, no value) switches to
        face slot 1 - Forge's real transform/MDFC/split/adventure back face.
        All lines from that point on (until any further face-switching
        directive) belong to that face. Represented as a top-level
        "ALTERNATE" array holding that one face object (reusing Forge's own
        literal directive token as the JSON key, rather than inventing
        "backFace"/"faces"/etc.) - kept as an array for continuity with
        earlier passes of this experiment, even though in practice exactly
        one such face exists per card.
      - A line "SPECIALIZE:<COLOR>" (Bloomburrow's Specialize mechanic,
        <COLOR> being WHITE/BLUE/BLACK/RED/GREEN - the complete, exhaustive
        set of values seen across all 33,798 files) switches to one of 5
        further fixed face slots, one per color (e.g. Alora, Rogue
        Companion has 6 total faces: the base card plus one Specialize face
        per color). Represented as a top-level "SPECIALIZE" object keyed by
        the literal color name, in the order the colors first appear in the
        file, so the color identity of each face is preserved rather than
        discarded.
      - Blank lines carry no face-switching meaning at all (verified: Forge
        just skips them, exactly like "#" comments, per the readCard() line
        above) - unlike an earlier version of this mapper, which incorrectly
        required a blank/ALTERNATE/blank 3-line pattern and would raise on
        any other blank line. A blank line has no content of its own to
        preserve, so silently skipping it isn't a "nothing dropped"
        violation the way skipping a real Prefix:Value line would be.
      - None of Foundations' 517 real cards uses either ALTERNATE or
        SPECIALIZE (verified three independent ways for ALTERNATE - see
        README.md), so this logic is exercised directly against real non-FDN
        Forge files (both in this repo's own full-corpus stress test and,
        for ALTERNATE specifically, against 3 hand-picked examples - see
        README.md).
  - Variant:<Name>:<Rest> -> merged into a top-level "Variant" object keyed
    by <Name>, whose value is <Rest> parsed the same way any single line
    would be (recursively, via the same dispatch this whole list describes -
    verified against CardRules.java's own Variant handling, which
    literally recurses into `this.parseLine(variantLine, varFace)` on a
    fresh per-variant CardFace). Two real, unrelated Forge mechanics reuse
    this exact same generic line shape: Unfinity's cosmetic Attraction-deck
    "Lights" print variants (e.g. `Variant:A:Lights:2 6`, alongside a
    `# --- VARIANTS ---` comment header that falls into the "#" rule above)
    and cross-set "UniversesWithin" flavor-name/type/ability overrides (e.g.
    `Variant:UniversesWithin:FlavorName:Qoneus, Horizon Splicer`) - neither
    is specific to either mechanic, both just decompose through the same
    recursive rule.

Run: python3 forge_json_mapper.py
Output: one JSON file per card under ./output/<slug>.json
"""

from __future__ import annotations

import json
import re
import sqlite3
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
# functional-model/scripts/experiments/forge-json-mapper/ -> repo root is 4 parents up
REPO_ROOT = SCRIPT_DIR.parents[3]
CARDSFOLDER = REPO_ROOT / "tmp" / "mtg-forge" / "forge-gui" / "res" / "cardsfolder"
OUTPUT_DIR = SCRIPT_DIR / "output"
CARDS_DB = REPO_ROOT / "data" / "cards.db"
FDN_SET_CODE = "fdn"

# Prefixes that get uniform Key$Value | Key$Value ... structured parsing.
ABILITY_LINE_PREFIXES = {"T", "S", "R", "A"}


class UnhandledShapeError(RuntimeError):
    """Raised when a line's shape doesn't match this parser's (verified
    against Forge's own Java source and stress-tested against all 33,798
    real cardsfolder files) assumptions. Intentionally fatal - see module
    docstring: an unhandled shape is a bug to fix, not a line to skip."""


class ResolutionError(RuntimeError):
    """Raised when an FDN card name from data/cards.db can't be matched to a
    real, verified file under tmp/mtg-forge/forge-gui/res/cardsfolder/."""


# --------------------------------------------------------------------------
# 517-card list resolution: query data/cards.db for the distinct FDN names,
# then resolve each one against the real cardsfolder directory tree. This
# replaces a hand-typed (name, path) list, which stopped being practical
# once the target set grew from 100 cards to all 517 - see README.md
# "Scaling to full FDN (517 cards)".
# --------------------------------------------------------------------------


def get_fdn_card_names() -> list[str]:
    if not CARDS_DB.is_file():
        print(f"ERROR: cards.db not found at {CARDS_DB}", file=sys.stderr)
        raise SystemExit(1)
    con = sqlite3.connect(str(CARDS_DB))
    try:
        cur = con.cursor()
        cur.execute(
            "SELECT DISTINCT json_extract(raw_json, '$.name') FROM cards "
            "WHERE set_code = ?",
            (FDN_SET_CODE,),
        )
        names = sorted(row[0] for row in cur.fetchall() if row[0])
    finally:
        con.close()
    return names


def slugify(name: str) -> str:
    """Forge's own filename convention, per Card-scripting-API.md's
    "Conventions" section: "filename: all lowercase, skip special
    characters, underscore for spaces". Observed real filenames (e.g.
    sun_blessed_healer.txt for "Sun-Blessed Healer", high_society_hunter.txt
    for "High-Society Hunter") confirm hyphens are treated the same as
    spaces, not stripped outright. A literal "/" in a card's own name is
    the same underscore-separator case, not a stripped special character —
    verified against two real cardsfolder files whose names contain a
    slash: "SP//dr, Piloted by Peni" -> sp_dr_piloted_by_peni.txt (a
    doubled "//" still collapses to one underscore, same as any other
    repeated separator run) and "Summon: Choco/Mog" -> summon_choco_mog.txt
    (found while resolving FIN's own card pool, which the FDN-only 517-name
    corpus this convention was first verified against never exercised)."""
    s = name.lower()
    s = re.sub(r"[^a-z0-9 \-/]", "", s)
    s = re.sub(r"[ \-/]+", "_", s)
    return s.strip("_")


def resolve_card_file(name: str) -> Path:
    """Resolve one FDN card name to a real file, WITHOUT blindly trusting
    the derived slug: the candidate's own first line must literally read
    "Name:<name>" before it's accepted."""
    slug = slugify(name)
    if not slug:
        raise ResolutionError(f"{name!r}: slugified to an empty string")

    letter_dir = CARDSFOLDER / slug[0]
    if not letter_dir.is_dir():
        raise ResolutionError(
            f"{name!r}: no cardsfolder subdirectory {slug[0]!r} (from slug {slug!r})"
        )

    expected_first_line = f"Name:{name}"

    def first_line_matches(path: Path) -> bool:
        try:
            first_line = path.read_text(encoding="utf-8").split("\n", 1)[0]
        except (UnicodeDecodeError, OSError):
            return False
        return first_line == expected_first_line

    exact = letter_dir / f"{slug}.txt"
    if exact.is_file() and first_line_matches(exact):
        return exact

    # Multi-faced cards can have BOTH face names concatenated into the
    # filename (Forge's real convention for transform/MDFC cards - e.g.
    # arlinn_the_packs_hope_arlinn_the_moons_fury.txt), so also try a
    # prefix search within the same letter directory. Still never trusted
    # blindly: only accepted if the candidate's own first line is exactly
    # "Name:<name>".
    for candidate in sorted(letter_dir.glob(f"{slug}_*.txt")):
        if first_line_matches(candidate):
            return candidate

    raise ResolutionError(
        f"{name!r}: no file in {letter_dir} matches slug {slug!r} "
        f"(tried exact match and '{slug}_*' prefix search, both requiring "
        f"a verified 'Name:{name}' first line)"
    )


def resolve_fdn_cards() -> list[tuple[str, str]]:
    """Returns [(name, path-relative-to-CARDSFOLDER), ...] for every
    distinct FDN card name, sorted by name. Fails loudly (not partially) if
    any name can't be resolved - see ResolutionError."""
    names = get_fdn_card_names()
    resolved: list[tuple[str, str]] = []
    errors: list[str] = []
    for name in names:
        try:
            path = resolve_card_file(name)
        except ResolutionError as e:
            errors.append(str(e))
            continue
        resolved.append((name, str(path.relative_to(CARDSFOLDER))))

    if errors:
        print(
            f"ERROR: failed to resolve {len(errors)} of {len(names)} FDN "
            f"card name(s) to a verified file:",
            file=sys.stderr,
        )
        for e in errors:
            print(f"  {e}", file=sys.stderr)
        raise SystemExit(1)

    return resolved


# --------------------------------------------------------------------------
# Line/face parsing
# --------------------------------------------------------------------------

# Bloomburrow's Specialize mechanic: a "SPECIALIZE:<COLOR>" directive line
# switches the "current face" to a fixed slot per color. Order and the set
# of colors verified against CardRules.java's own if/else chain, and
# confirmed exhaustive by grepping every "^SPECIALIZE:" line's value across
# all 33,798 real cardsfolder files (only ever these 5, spelled exactly
# this way).
SPECIALIZE_COLORS = ("WHITE", "BLUE", "BLACK", "RED", "GREEN")


def _put_preserving_duplicates(mapping: dict, key: str, value: object) -> None:
    """Assign mapping[key] = value, but if key is already present, keep BOTH
    the earlier and the new value (as a list, in source order) rather than
    overwriting. See the module docstring's "A repeated name/key ..." rule:
    Forge's own real runtime genuinely does overwrite silently on a repeat
    (plain Java Maps in CardFace.addSVar/FileSection.parseToMap), but this
    mapper mirrors the literal script text losslessly rather than
    replicating that runtime resolution, so an earlier occurrence is never
    dropped."""
    if key in mapping:
        existing = mapping[key]
        if isinstance(existing, list):
            existing.append(value)
        else:
            mapping[key] = [existing, value]
    else:
        mapping[key] = value


def parse_keyvalue_line(rest: str, *, context: str) -> dict:
    """Parse a T:/S:/R:/A: line body (or an SVar body that itself holds an
    ability/count expression) into an ordered dict of Param -> Value pairs,
    splitting on ' | ' then on the first '$' in each segment. A segment with
    no '$' becomes a key mapped to "" - this is Forge's own real, always-
    applied behavior (verified against FileSection.parseToMap: a $-less
    segment's whole text becomes the map key, with "" as the value), not an
    error case - e.g. volatile_rift.txt's "TriggeredCardLKICopy" segment
    (almost certainly meant to be "Defined$ TriggeredCardLKICopy", missing
    its "Defined$" - every other real use of "TriggeredCardLKICopy" across
    the whole corpus is as a Defined$ value - but Forge's parser doesn't
    error on the typo, so this mapper doesn't either)."""
    segments = [seg.strip() for seg in rest.split(" | ")]
    result: dict[str, object] = {}
    for seg in segments:
        key, sep, value = seg.partition("$")
        key = key.strip()
        value = value.strip() if sep else ""
        _put_preserving_duplicates(result, key, value)
    return result


def parse_svar_value(name: str, value: str) -> object:
    if "$" in value:
        return parse_keyvalue_line(value, context=f"SVar:{name}")
    return value


def apply_line(target: dict, line: str, lineno: int, path: Path) -> None:
    """Apply one already-blank/face-directive-filtered line's content to
    `target` (either the top-level card dict for whichever face is
    "current", or a nested per-Variant-name dict - see the Variant rule
    below, which calls back into this same function recursively, mirroring
    CardRules.java's own Variant handling literally recursing into
    parseLine())."""
    if line.startswith("#"):
        # Undocumented but real: a full-line developer comment (e.g.
        # Exsanguinate's "# AFLifeLost will be set by LoseLife", Mystical
        # Teachings' "# TODO: ...", or an Attraction card's
        # "# --- VARIANTS ---" header). Forge's own real parser skips these
        # entirely (readCard(): `if (line.isEmpty() || line.charAt(0) ==
        # '#') continue;`) but this mapper still captures them verbatim,
        # "#" included, in a top-level "#" array - the literal marker
        # character as the JSON key, mirroring how "K" mirrors "K:".
        target.setdefault("#", []).append(line)  # type: ignore[union-attr]
        return

    prefix, sep, rest = line.partition(":")
    if not sep:
        raise UnhandledShapeError(
            f"{path}:{lineno}: line has no top-level 'Prefix:' delimiter "
            f"and isn't a recognized bare directive: {line!r}"
        )

    if prefix == "K":
        target.setdefault("K", []).append(rest)  # type: ignore[union-attr]

    elif prefix in ABILITY_LINE_PREFIXES:
        parsed = parse_keyvalue_line(rest, context=f"{path}:{lineno} ({prefix}:)")
        target.setdefault(prefix, []).append(parsed)  # type: ignore[union-attr]

    elif prefix == "SVar":
        name, sep2, value = rest.partition(":")
        if not sep2:
            raise UnhandledShapeError(
                f"{path}:{lineno}: SVar line missing 'Name:Value' shape: {line!r}"
            )
        svar_map = target.setdefault("SVar", {})
        _put_preserving_duplicates(svar_map, name, parse_svar_value(name, value))  # type: ignore[arg-type]

    elif prefix == "Variant":
        # Forge's own generic "functional variant" mechanism (verified
        # against CardRules.java: `getOrCreateFunctionalVariant(variantName)`
        # + a literal recursive `this.parseLine(variantLine, varFace)` call).
        # Two unrelated real mechanics reuse this same line shape: Unfinity's
        # cosmetic Attraction "Lights" print variants
        # (Variant:A:Lights:2 6) and cross-set "UniversesWithin" flavor
        # overrides (Variant:UniversesWithin:FlavorName:...) - neither is
        # special-cased here, both just recurse through this same dispatch.
        variant_name, sep2, variant_line = rest.partition(":")
        if not sep2:
            raise UnhandledShapeError(
                f"{path}:{lineno}: Variant line missing its own "
                f"'Name:Line' shape: {line!r}"
            )
        variant_map = target.setdefault("Variant", {})
        variant_face = variant_map.setdefault(variant_name, {})  # type: ignore[union-attr]
        apply_line(variant_face, variant_line, lineno, path)

    else:
        # Generic top-level scalar (Name, ManaCost, Types, PT, Loyalty,
        # Oracle, DeckHas, DeckHints, DeckNeeds, AI, AlternateMode,
        # Colors, ...). Keep the raw text completely verbatim - no
        # re-splitting, no escape processing, no touching any further
        # ":" in the value (e.g. AI:RemoveDeck:Random keeps its own
        # embedded colon).
        _put_preserving_duplicates(target, prefix, rest)


def parse_card_file(path: Path) -> dict:
    """Parse one Forge card-script file into JSON, faithfully replicating
    CardRules.java's Reader.readCard()/parseLine() line-by-line dispatch:
    blank lines are skipped (no face-switch, no content - Forge just
    ignores them outright), a bare "ALTERNATE" line switches to face slot 1,
    a "SPECIALIZE:<COLOR>" line switches to one of 5 further fixed slots,
    and every other line is applied (via apply_line) to whichever face is
    currently active. Verified against all 33,798 real cardsfolder files,
    not just Foundations - see module docstring and README.md."""
    text = path.read_text(encoding="utf-8")
    lines = text.split("\n")
    # Drop a single trailing empty string produced by a final newline; do not
    # touch any other line's content.
    if lines and lines[-1] == "":
        lines = lines[:-1]

    faces: dict[int, dict] = {}
    face_order: list[int] = []
    cur_face = 0

    def get_face(idx: int) -> dict:
        if idx not in faces:
            faces[idx] = {}
            face_order.append(idx)
        return faces[idx]

    for lineno, line in enumerate(lines, start=1):
        if line == "":
            continue  # Forge: line.isEmpty() -> skipped, no effect at all
        if line == "ALTERNATE":
            cur_face = 1
            continue
        if line.startswith("SPECIALIZE:"):
            _, _, color = line.partition(":")
            if color not in SPECIALIZE_COLORS:
                raise UnhandledShapeError(
                    f"{path}:{lineno}: unrecognized SPECIALIZE color "
                    f"{color!r} (expected one of {SPECIALIZE_COLORS})"
                )
            cur_face = 2 + SPECIALIZE_COLORS.index(color)
            continue
        apply_line(get_face(cur_face), line, lineno, path)

    card = get_face(0)

    if 1 in faces:
        # Reuse Forge's own literal directive token as the JSON key, rather
        # than inventing "backFace"/"faces"/etc. Kept as an array (of
        # exactly one face in practice) for continuity with earlier passes
        # of this experiment.
        card["ALTERNATE"] = [faces[1]]

    specialize_colors_seen = [
        SPECIALIZE_COLORS[idx - 2] for idx in face_order if idx >= 2
    ]
    if specialize_colors_seen:
        # Keyed by the literal color name (in first-appearance order) so the
        # color identity of each face is preserved, not discarded.
        card["SPECIALIZE"] = {
            color: faces[2 + SPECIALIZE_COLORS.index(color)]
            for color in specialize_colors_seen
        }

    return card


def slug_for(relative_path: str) -> str:
    return Path(relative_path).stem


def run_single_card(name: str) -> int:
    """`--card <name>` mode: resolve and parse exactly one card by name,
    anywhere in the Forge checkout (not limited to FDN), and print its JSON
    to stdout. Reuses `resolve_card_file`/`parse_card_file` directly - both
    were already fully general (a real card name -> a verified file -> a
    parsed dict), only `resolve_fdn_cards`'s own `data/cards.db` query is
    FDN-specific. Does NOT write into `OUTPUT_DIR` - that directory's own
    real scope is exactly the 517 FDN cards `resolve_fdn_cards` resolves;
    an arbitrary single card printed here has no business in it."""
    path = resolve_card_file(name)
    card = parse_card_file(path)
    print(json.dumps(card, indent=2, ensure_ascii=False))
    return 0


def main() -> int:
    if not CARDSFOLDER.is_dir():
        print(f"ERROR: Forge cardsfolder not found at {CARDSFOLDER}", file=sys.stderr)
        print(
            "This script expects a local checkout at tmp/mtg-forge/ (gitignored, "
            "not part of the repo itself).",
            file=sys.stderr,
        )
        return 1

    if len(sys.argv) > 1 and sys.argv[1] == "--card":
        if len(sys.argv) < 3:
            print("ERROR: --card requires a card name argument", file=sys.stderr)
            return 1
        return run_single_card(sys.argv[2])

    cards = resolve_fdn_cards()
    print(f"Resolved {len(cards)} distinct FDN card name(s) from {CARDS_DB.name}.\n")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    ok = 0
    for name, rel_path in cards:
        path = CARDSFOLDER / rel_path

        # resolve_fdn_cards() already verified the Name: line once during
        # resolution, but re-verify here too - this loop is the one that
        # actually parses and writes output, and it shouldn't depend on
        # trusting an earlier pass silently.
        first_line = path.read_text(encoding="utf-8").split("\n", 1)[0]
        expected = f"Name:{name}"
        if first_line != expected:
            print(
                f"ERROR: {path} first line {first_line!r} != expected {expected!r}",
                file=sys.stderr,
            )
            return 1

        card = parse_card_file(path)

        out_path = OUTPUT_DIR / f"{slug_for(rel_path)}.json"
        out_path.write_text(
            json.dumps(card, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
        )
        print(f"OK  {name!r:40s} -> {out_path.relative_to(REPO_ROOT)}")
        ok += 1

    print(f"\nParsed {ok}/{len(cards)} cards with nothing silently dropped.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
