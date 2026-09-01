// Parses card_shorthands.json's placeholder syntaxes into plain-text, icon,
// and mana-symbol segments, so the page can render real components instead
// of raw HTML:
//   - `[icon words]` — our own curated bracket words (see CARD_SHORTHAND.md),
//     rendered via MtgIcon.vue. Any run of non-bracket characters is valid
//     (multi-word phrases included, e.g. `[you may]`) — MtgIcon.vue's
//     ICON_DEFS just won't have an entry for most of them yet, so they
//     render as their own plain text, same as any other pending-icon word.
//   - `{X}` — a literal mana/cost symbol straight out of real oracle text
//     (e.g. "{T}: Add {C}."), rendered via ManaSymbol.vue. No curation
//     needed per symbol — write the ability text exactly as Scryfall would,
//     braces included, and it renders as the actual glyph automatically.
// Every trigger header (a line's leading "... — ", e.g. "[Enter] — ",
// "I, II — ") gets `italic: true` so the page can set it off from the effect
// text that follows.
export type ShorthandSegment = ({ text: string } | { icon: string } | { mana: string }) & { italic?: boolean };

function tokenize(source: string, italic: boolean): ShorthandSegment[] {
  const parts = source.split(/\[([^[\]]+)\]|\{([^{}]+)\}/);
  const segments: ShorthandSegment[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (!parts[i]) continue;
    const mod = i % 3;
    if (mod === 1) segments.push({ icon: parts[i]!, italic });
    else if (mod === 2) segments.push({ mana: parts[i]!, italic });
    else segments.push({ text: parts[i]!, italic });
  }
  return segments;
}

export function parseShorthand(source: string): ShorthandSegment[] {
  const lines = source.split('\n');
  const segments: ShorthandSegment[] = [];
  lines.forEach((line, i) => {
    // A line's *own* trigger header must come before any quoted granted-ability
    // text — otherwise an em dash inside the quotes (e.g. `has "Attacks —
    // you gain 1 life,"`) gets mistaken for this line's header and italicizes
    // everything up to it.
    const quoteIndex = line.indexOf('"');
    const rawDashIndex = line.indexOf(' — ');
    const dashIndex = rawDashIndex !== -1 && (quoteIndex === -1 || rawDashIndex < quoteIndex) ? rawDashIndex : -1;
    if (dashIndex === -1) {
      segments.push(...tokenize(line, false));
    } else {
      const headerEnd = dashIndex + ' — '.length;
      segments.push(...tokenize(line.slice(0, headerEnd), true));
      segments.push(...tokenize(line.slice(headerEnd), false));
    }
    if (i < lines.length - 1) segments.push({ text: '\n' });
  });
  return segments;
}
