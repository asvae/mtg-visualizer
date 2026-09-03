// Splits literal `{X}` mana/cost symbols (real oracle text notation, and now
// both synergy-model's `flags` and forge-model's ManaCost) out of a string so
// each `{X}` chunk can go through ManaSymbol.vue while everything else stays
// plain text. Shared by the card page and ForgeCardScript.vue.
export type ManaTextSegment = { text: string } | { mana: string };

export function parseManaSegments(text: string): ManaTextSegment[] {
  return text.split(/\{([^{}]+)\}/).map((part, i): ManaTextSegment => (i % 2 === 1 ? { mana: part } : { text: part }));
}
