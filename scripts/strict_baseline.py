#!/usr/bin/env python3
"""Strict, 100%-deterministic baseline tagger.

No prose regex, no wildcards. Only exact-match structured fields Scryfall
already normalizes for us: the `keywords` array (exact keyword ability
strings, distinct from prose that merely grants a keyword to something
else), the `type_line` (exact word-boundary matches for supertypes/types/
subtypes), and `layout` (exact enum values for DFC-shaped cards).

This intentionally covers ONLY the self-identity "card itself IS/HAS this"
baseline (always weight 2, except Saga which is always weight 1 per the
global rules) -- never a grant/consume relation (those require reading
prose to know WHO benefits), never a weight-3 "more than one" bump (needs
prose to know if the card also creates additional instances). Anything
beyond this baseline is left for an agent's read-and-judge pass.

A card additionally gets marked fully `reviewed: 'script'` (plus a
`reviewed_at` timestamp) by this script alone -- no agent needed -- if,
after removing every keyword-ability line/segment and all parenthetical
reminder text, its oracle_text has nothing left. That is the "no more
themes to explore" case: a vanilla or keyword-only card. `reviewed` is an
escalating ladder -- false -> 'script' -> 'agent' -> 'human' -- see
GLOBAL_TAGGING_RULES.md's "Output shape" section.

Usage:
  python3 scripts/strict_baseline.py <path-to-oracle-or-set-cards.json[.gz]> <output.json>
"""
import sys
import json
import gzip
import re
from datetime import datetime, timezone

KEYWORD_TO_THEME = {
    'flying': 'flying',
    'vigilance': 'vigilance',
    'trample': 'trample',
    'menace': 'menace',
    'haste': 'haste',
    'deathtouch': 'deathtouch',
    'reach': 'reach',
    'indestructible': 'indestructible',
    'hexproof': 'hexproof',
    'first strike': 'first-strike',
    'flash': 'flash',
    'defender': 'defender',
    'banding': 'banding',
    'protection': 'protection',
    'ward': 'ward',
    'regenerate': 'regeneration',
}

# Flashback gets two theme tags, not a 1:1 mapping — handled specially.
# Cycling has a non-default weight/role shape — handled specially, not in
# the "vanilla shortcut" emptiness check as a plain keyword line.

TYPE_WORD_TO_THEME = {
    'Artifact': 'artifacts',
    'Creature': 'creature',
    'Enchantment': 'enchantment',
    'Instant': 'instant',
    'Sorcery': 'sorcery',
    'Planeswalker': 'planeswalker',
    'Battle': 'battle',
    'Land': 'land',
}

SUBTYPE_WORD_TO_THEME = {
    'Aura': 'aura',
    'Equipment': 'equipment',
    'Vehicle': 'vehicles',
    'Saga': 'saga',
    'Town': 'towns',
    'Dragon': 'dragon',
}

DFC_LAYOUTS = {'transform', 'modal_dfc', 'meld'}


JOINER_WORDS = {'and/or', 'and', 'or', 'of', 'the', 'a', 'an'}


def slugify(word):
    return re.sub(r'^-+|-+$', '', re.sub(r'[^a-z0-9]+', '-', word.lower()))


def load_cards(path):
    opener = gzip.open if path.endswith('.gz') else open
    cards = []
    with opener(path, 'rt', encoding='utf-8') as f:
        if path.endswith('.jsonl') or path.endswith('.jsonl.gz'):
            for line in f:
                line = line.strip()
                if line:
                    cards.append(json.loads(line))
        else:
            cards.extend(json.load(f))
    return cards


def strict_baseline_for_card(card):
    """Returns (themes_dict, fully_resolved_bool, reason_if_skipped)."""
    faces = card.get('card_faces') or [card]
    full_type_line = card.get('type_line', '')
    if 'Basic' in full_type_line:
        return None, False, 'basic land, skip entirely'

    produce = {}

    # --- type line: supertypes/types (word-boundary, exact) ---
    if re.search(r'\bLegendary\b', full_type_line):
        produce['legendary'] = 2
    for word, theme in TYPE_WORD_TO_THEME.items():
        if re.search(rf'\b{word}\b', full_type_line):
            produce[theme] = 2

    # --- subtypes (after the em dash on each face) ---
    creature_subtypes = set()
    for f in faces:
        tl = f.get('type_line', full_type_line)
        if '—' not in tl:
            continue
        main, sub = tl.split('—', 1)
        sub_words = sub.strip().split()
        if re.search(r'\bCreature\b', main):
            for w in sub_words:
                if w.lower() in JOINER_WORDS:
                    continue
                creature_subtypes.add(w)
        for w in sub_words:
            if w in SUBTYPE_WORD_TO_THEME:
                theme = SUBTYPE_WORD_TO_THEME[w]
                produce[theme] = 1 if theme == 'saga' else 2

    for w in creature_subtypes:
        slug = slugify(w)
        if slug:
            produce.setdefault(slug, 2)

    # --- layout (structural DFC fact) ---
    if card.get('layout') in DFC_LAYOUTS:
        produce['double-faced'] = 2

    # --- keywords array (exact match only) ---
    card_keywords = set()
    for f in faces:
        for kw in (f.get('keywords') or card.get('keywords') or []):
            card_keywords.add(kw)
    for kw in card_keywords:
        low = kw.lower()
        if low in KEYWORD_TO_THEME:
            produce[KEYWORD_TO_THEME[low]] = 2
        elif low == 'flashback':
            produce['flashback'] = 2
            produce['cast-from-graveyard'] = 2
        elif low == 'cycling':
            produce['graveyard'] = max(produce.get('graveyard', 0), 1)
            produce['discard'] = max(produce.get('discard', 0), 1)

    # --- "nothing else to explore" emptiness check ---
    full_text = '\n'.join(f.get('oracle_text', '') for f in faces)
    stripped = re.sub(r'\([^)]*\)', '', full_text)  # drop reminder text
    segments = re.split(r'[\n,.]', stripped)
    known_lower = {k for k in card_keywords}
    leftover = []
    for seg in segments:
        seg = seg.strip()
        if not seg:
            continue
        # A bare keyword line/segment (possibly multiple comma-joined
        # keywords already split above) matches case-insensitively.
        if any(seg.lower() == k.lower() for k in known_lower):
            continue
        leftover.append(seg)

    fully_resolved = len(leftover) == 0
    return produce, fully_resolved, ('; '.join(leftover) if leftover else None)


def main():
    if len(sys.argv) not in (3, 4):
        print(__doc__)
        sys.exit(1)
    in_path, out_path = sys.argv[1], sys.argv[2]
    set_types = set(sys.argv[3].split(',')) if len(sys.argv) == 4 else None
    cards = load_cards(in_path)

    results = []
    run_timestamp = datetime.now(timezone.utc).isoformat()
    stats = {'total': 0, 'skipped_set_type': 0, 'skipped_basic': 0, 'fully_resolved': 0, 'partial': 0}
    for card in cards:
        if set_types is not None and card.get('set_type') not in set_types:
            stats['skipped_set_type'] += 1
            continue
        stats['total'] += 1
        produce, resolved, _leftover = strict_baseline_for_card(card)
        if produce is None:
            stats['skipped_basic'] += 1
            continue
        entry = {'name': card['name'], 'themes': {}}
        if produce:
            entry['themes']['produce'] = produce
        if resolved:
            entry['reviewed'] = 'script'
            entry['reviewed_at'] = run_timestamp
            stats['fully_resolved'] += 1
        else:
            entry['reviewed'] = False
            stats['partial'] += 1
        results.append(entry)

    json.dump(results, open(out_path, 'w'), indent=2)
    with open(out_path, 'a') as f:
        f.write('\n')
    print(json.dumps(stats, indent=2))


if __name__ == '__main__':
    main()
