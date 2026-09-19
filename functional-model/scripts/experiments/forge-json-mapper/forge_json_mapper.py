#!/usr/bin/env python3
"""
forge_json_mapper.py

Standalone experiment: converts real Forge MTG card-script .txt files (Forge's
own line-based DSL, see tmp/mtg-forge/docs/Card-scripting-API/) into JSON that
mirrors Forge's own on-disk representation as directly as possible.

This is a *blank-slate* mapper. It does not import, reference, or borrow
vocabulary from this repo's own functional-model/card.ts schema (CardDefinition
/Effect/Trigger types) or any other in-repo card representation. It only reads
raw .txt files from the local (gitignored) tmp/mtg-forge/ Forge checkout.

Scope: this parser is deliberately NOT a general Forge-file parser. It only
needs to correctly and losslessly handle the specific line shapes that appear
across the full Foundations (FDN) card pool - the 517 distinct card names in
this repo's own data/cards.db for set_code='fdn' (771 rows there, but that
includes duplicate reprints across FDN's bonus/showcase sheets - e.g.
Exemplar of Light alone has 5 collector numbers for the identical card
script; deduped by name to one entry per unique card). Every prefix and
every param$value shape it relies on was verified by hand against real FDN
.txt files before/while writing this script (see README.md for the
verification notes, including the "Scaling to 100 cards" and "Scaling to
full FDN (517 cards)" sections documenting exactly what widening the sample
did and didn't need to change here).
If a line shape doesn't match what this script expects, it raises loudly
instead of silently dropping data - that's intentional: for this experiment,
an unhandled shape is a bug to fix, not a line to skip.

The 517-card list itself is NOT hand-typed (that stopped being practical
past the first 100). Instead this script queries data/cards.db for the
distinct FDN names at runtime, then resolves each one to a real file under
tmp/mtg-forge/forge-gui/res/cardsfolder/ by enumerating that directory
(never by blindly trusting a derived filename slug) - see
resolve_fdn_cards() below.

Mapping rules (see README.md for more detail):
  - Name / ManaCost / Types / PT / Loyalty / Oracle / DeckHas / DeckHints /
    DeckNeeds / AI / ... (any line whose prefix isn't K/T/S/R/A/SVar, and
    isn't a "#" comment line) -> top-level scalar JSON field, keyed by
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
    splitting needed). Every Param$Value pair from the source line becomes
    one key in the resulting JSON object, in source order.
  - SVar:<Name>:<Value> -> merged into a top-level "SVar" object keyed by
    <Name>. If <Value> contains at least one "$" it is parsed the same way
    as a T/S/R/A line (Forge SVars frequently hold a DB$/AB$ sub-ability, or
    a Count$ expression, in the exact same Key$Value|Key$Value shape). If it
    contains no "$" at all (e.g. "SVar:PlayMain1:TRUE") it is kept as a raw
    string, verbatim.
  - A line starting with "#" is a full-line developer comment (undocumented
    in Card-scripting-API.md/AbilityFactory.md but real - e.g. Exsanguinate
    and Mystical Teachings both have one). Kept verbatim, including the "#"
    itself, in a top-level "#" array - reusing the literal marker character
    as the JSON key, the same way "K" mirrors "K:", rather than inventing a
    "comment"/"_comment" field name.
  - Multi-faced cards (transform/MDFC - per Card-scripting-API.md: "If a
    card has two faces, use AlternateMode:{CardStateName} in the front face
    and separate both by a new line with the text ALTERNATE"): the file is
    split on the literal 3-line separator (blank line, "ALTERNATE", blank
    line) into face blocks. The FIRST block is parsed into the top-level
    card object exactly as a single-faced card would be (so single-faced
    cards - the vast majority - are completely unaffected: no "ALTERNATE"
    key appears on them at all). Each subsequent block is parsed the same
    way and appended to a top-level "ALTERNATE" array, reusing Forge's own
    literal separator token as the JSON key rather than inventing
    "backFace"/"faces"/etc. None of the 517 real FDN cards actually has an
    ALTERNATE block (verified three independent ways - see README.md - FDN
    turns out to have zero transform/MDFC/split/adventure cards), so this
    path is implemented and tested against real non-FDN Forge examples
    (Arlinn, the Pack's Hope // Arlinn, the Moon's Fury;
    Delver of Secrets // Insectile Aberration; Emeria's Call // Emeria,
    Shattered Skyclave) but not exercised by this script's actual output.

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
    """Raised when a line's shape doesn't match this parser's (hand-verified)
    assumptions for the full 517-card FDN set. Intentionally fatal - see
    module docstring: an unhandled shape is a bug to fix, not a line to
    skip."""


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
    spaces, not stripped outright."""
    s = name.lower()
    s = re.sub(r"[^a-z0-9 \-]", "", s)
    s = re.sub(r"[ \-]+", "_", s)
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


def parse_keyvalue_line(rest: str, *, context: str) -> dict:
    """Parse a T:/S:/R:/A: line body (or an SVar body that itself holds an
    ability/count expression) into an ordered dict of Param -> Value pairs,
    splitting on ' | ' then on the first '$' in each segment."""
    segments = [seg.strip() for seg in rest.split(" | ")]
    result: dict[str, object] = {}
    for seg in segments:
        if "$" not in seg:
            raise UnhandledShapeError(
                f"{context}: segment has no '$' key/value delimiter: {seg!r}"
            )
        key, _, value = seg.partition("$")
        key = key.strip()
        value = value.strip()
        if key in result:
            # Guard against silently losing a repeated key within one line.
            # Not observed across the 517 cards, but fail-safe rather than
            # fail-silent.
            existing = result[key]
            if isinstance(existing, list):
                existing.append(value)
            else:
                result[key] = [existing, value]
        else:
            result[key] = value
    return result


def parse_svar_value(name: str, value: str) -> object:
    if "$" in value:
        return parse_keyvalue_line(value, context=f"SVar:{name}")
    return value


def split_face_blocks(lines: list[str]) -> list[list[tuple[int, str]]]:
    """Split a card file's lines into face blocks on Forge's documented
    multi-face separator (Card-scripting-API.md: "separate both by a new
    line with the text ALTERNATE") - i.e. a blank line, then a line that is
    exactly "ALTERNATE", then another blank line. Returns a list of blocks,
    each a list of (1-indexed original line number, line text) pairs, so
    error messages from downstream parsing still point at the real line in
    the source file. A single-faced card (the overwhelming majority) simply
    yields one block containing every line."""
    indexed = list(enumerate(lines, start=1))
    blocks: list[list[tuple[int, str]]] = []
    current: list[tuple[int, str]] = []
    i = 0
    n = len(indexed)
    while i < n:
        lineno, line = indexed[i]
        if (
            line == ""
            and i + 2 < n
            and indexed[i + 1][1] == "ALTERNATE"
            and indexed[i + 2][1] == ""
        ):
            blocks.append(current)
            current = []
            i += 3
            continue
        current.append((lineno, line))
        i += 1
    blocks.append(current)
    return blocks


def parse_face_lines(block: list[tuple[int, str]], path: Path) -> dict:
    """Parse one face's worth of lines (see split_face_blocks) into a card/
    face JSON object. Used both for single-faced cards' one-and-only block
    and for each block of a multi-faced card."""
    card: dict[str, object] = {}

    for lineno, line in block:
        if line == "":
            raise UnhandledShapeError(
                f"{path}:{lineno}: unexpected blank line outside a "
                f"well-formed blank/ALTERNATE/blank face separator"
            )
        if line == "ALTERNATE":
            raise UnhandledShapeError(
                f"{path}:{lineno}: stray 'ALTERNATE' line not part of a "
                f"well-formed blank/ALTERNATE/blank separator (missing a "
                f"surrounding blank line?)"
            )
        if line.startswith("#"):
            # Undocumented but real: a full-line developer comment (e.g.
            # Exsanguinate's "# AFLifeLost will be set by LoseLife",
            # Mystical Teachings' "# TODO: ..."). Kept verbatim, "#"
            # included, under a top-level "#" array - the literal marker
            # character as the JSON key, mirroring how "K" mirrors "K:".
            card.setdefault("#", []).append(line)  # type: ignore[union-attr]
            continue

        prefix, sep, rest = line.partition(":")
        if not sep:
            raise UnhandledShapeError(
                f"{path}:{lineno}: line has no top-level 'Prefix:' delimiter: {line!r}"
            )

        if prefix == "K":
            card.setdefault("K", []).append(rest)  # type: ignore[union-attr]

        elif prefix in ABILITY_LINE_PREFIXES:
            parsed = parse_keyvalue_line(rest, context=f"{path}:{lineno} ({prefix}:)")
            card.setdefault(prefix, []).append(parsed)  # type: ignore[union-attr]

        elif prefix == "SVar":
            name, sep2, value = rest.partition(":")
            if not sep2:
                raise UnhandledShapeError(
                    f"{path}:{lineno}: SVar line missing 'Name:Value' shape: {line!r}"
                )
            svar_map = card.setdefault("SVar", {})
            if name in svar_map:  # type: ignore[operator]
                raise UnhandledShapeError(
                    f"{path}:{lineno}: duplicate SVar name {name!r} within "
                    f"one face - none of the 517 target cards should hit this"
                )
            svar_map[name] = parse_svar_value(name, value)  # type: ignore[index]

        else:
            # Generic top-level scalar (Name, ManaCost, Types, PT, Loyalty,
            # Oracle, DeckHas, DeckHints, DeckNeeds, AI, AlternateMode,
            # Colors, ...). Keep the raw text completely verbatim - no
            # re-splitting, no escape processing, no touching any further
            # ":" in the value (e.g. AI:RemoveDeck:Random keeps its own
            # embedded colon).
            if prefix in card:
                existing = card[prefix]
                if isinstance(existing, list):
                    existing.append(rest)
                else:
                    card[prefix] = [existing, rest]
            else:
                card[prefix] = rest

    return card


def parse_card_file(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    lines = text.split("\n")
    # Drop a single trailing empty string produced by a final newline; do not
    # touch any other line's content.
    if lines and lines[-1] == "":
        lines = lines[:-1]

    blocks = split_face_blocks(lines)
    primary_block, *alternate_blocks = blocks

    card = parse_face_lines(primary_block, path)
    if alternate_blocks:
        # Reuse Forge's own literal separator token as the JSON key, rather
        # than inventing "backFace"/"faces"/etc. Each entry is a full face
        # object in the same shape as the top-level card (its own Name,
        # ManaCost, Types, K, T, S, R, A, SVar, ...).
        card["ALTERNATE"] = [parse_face_lines(b, path) for b in alternate_blocks]

    return card


def slug_for(relative_path: str) -> str:
    return Path(relative_path).stem


def main() -> int:
    if not CARDSFOLDER.is_dir():
        print(f"ERROR: Forge cardsfolder not found at {CARDSFOLDER}", file=sys.stderr)
        print(
            "This script expects a local checkout at tmp/mtg-forge/ (gitignored, "
            "not part of the repo itself).",
            file=sys.stderr,
        )
        return 1

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
