// Splits literal `{X}` mana/cost symbols (real oracle text notation, and
// synergy-model's `flags`) out of a string so each `{X}` chunk can go through
// ManaSymbol.vue while everything else stays plain text. Shared across the
// card page's own mana rendering.
export type ManaTextSegment = { text: string } | { mana: string };

export function parseManaSegments(text: string): ManaTextSegment[] {
  return text.split(/\{([^{}]+)\}/).map((part, i): ManaTextSegment => (i % 2 === 1 ? { mana: part } : { text: part }));
}
