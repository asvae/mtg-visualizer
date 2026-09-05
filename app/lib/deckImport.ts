// Parses a pasted decklist of unknown origin — MTGO/MTGA/Moxfield/Archidekt/
// TappedOut/MTGGoldfish all export the same basic `<qty> <name>` shape (set
// code/collector number optional, parenthetical), and Forge's own real .dck
// format (forge-gui/res/quest/precons/*.dck) uses a pipe-delimited variant of
// the same idea inside [main]/[sideboard] bracket sections. One permissive
// line-by-line grammar covers all of them — this app keys cards by Scryfall
// name (see buildGraph.ts), so a trailing set/collector suffix is discarded,
// never used to disambiguate a printing.

export interface ParsedDeckCard {
  name: string;
  qty: number;
}

// Recognized section headers, case-insensitive, both the plain-text form
// ("Sideboard", "Commander") and Forge's own bracketed form ("[sideboard]").
// Only "main"-ish sections feed the returned list; sideboard/maybeboard are
// tracked and skipped rather than silently merged into the main deck.
const MAIN_SECTIONS = new Set(['deck', 'main', 'mainboard', 'maindeck', 'commander', 'companion']);
const SIDE_SECTIONS = new Set(['sideboard', 'maybeboard', 'considering']);

function sectionFor(headerWord: string): 'main' | 'side' | null {
  const w = headerWord.toLowerCase();
  if (MAIN_SECTIONS.has(w)) return 'main';
  if (SIDE_SECTIONS.has(w)) return 'side';
  return null;
}

// Matches a bracketed Forge section header: `[main]`, `[Sideboard]`, etc —
// Forge's own [metadata]/[shop] sections aren't decklist content and fall
// through to `sectionFor` returning null, same as any other unrecognized
// bracket, so lines under them just get skipped like any other non-matching line.
const BRACKET_HEADER = /^\[([a-z]+)\]$/i;

// Matches a bare, unbracketed section header line — the whole line is just
// one of the known section words, nothing else (so "Deck" on its own line
// switches section; "Deck: Aggro Burn" or an actual card named "Commander's
// Sphere" does not, since qty prefix parsing below would've already claimed
// the latter if it had a leading number).
const BARE_HEADER = /^([a-z]+)\s*:?$/i;

// The actual card line grammar: `<qty>[x] <name>[<suffix>]`.
// - qty: one or more digits, optional trailing "x" (case-insensitive), then
//   whitespace — `4 `, `4x `, `4X ` all match.
// - name: everything up to an optional trailing suffix (kept intact,
//   including commas/apostrophes/etc — "Jecht, Reluctant Guardian" is one
//   name, not two fields).
// - suffix (discarded, never required): either `(SET) NUM` (MTGO/MTGA/
//   Moxfield/Archidekt/TappedOut/MTGGoldfish) or `|SET|NUM` / `|SET` (Forge's
//   own .dck main-section lines) at the very end of the line.
const CARD_LINE = /^(\d+)\s*[xX]?\s+(.+?)(?:\s*\([A-Za-z0-9]+\)\s*[A-Za-z0-9-]*|\s*\|[A-Za-z0-9]+(?:\|[A-Za-z0-9-]*)?)?\s*$/;

export function parseDecklist(text: string): ParsedDeckCard[] {
  // name -> running total, not a plain array push — decklists routinely
  // split the same card across multiple lines by printing (Forge's own
  // .dck format does this for basics: `4 Island|TMP|1` / `4 Island|TMP|2` /
  // `3 Island|TMP|3`, all one card, this app doesn't care which printing).
  // Insertion order preserved via the Map so output order still roughly
  // matches input order, first-seen line wins position.
  const byName = new Map<string, number>();
  let section: 'main' | 'side' = 'main';

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue; // blank lines never carry section meaning by themselves
    if (line.startsWith('#') || line.startsWith('//')) continue; // comment

    const bracket = BRACKET_HEADER.exec(line);
    if (bracket) {
      const s = sectionFor(bracket[1]!);
      if (s) section = s;
      // An unrecognized bracket ([metadata], [shop], ...) isn't a decklist
      // section at all — leave `section` as whatever it already was, and
      // let CARD_LINE below simply fail to match any key=value lines under it.
      continue;
    }

    const bare = BARE_HEADER.exec(line);
    if (bare) {
      const s = sectionFor(bare[1]!);
      if (s) {
        section = s;
        continue;
      }
    }

    const m = CARD_LINE.exec(line);
    if (!m) continue; // stray text, a deck title, a "Key=Value" metadata line — skip, not an error
    if (section !== 'main') continue; // recognized but sideboard/maybeboard — skip

    const qty = parseInt(m[1]!, 10);
    const name = m[2]!.trim();
    if (!name || qty <= 0) continue;
    byName.set(name, (byName.get(name) ?? 0) + qty);
  }

  return [...byName].map(([name, qty]) => ({ name, qty }));
}
