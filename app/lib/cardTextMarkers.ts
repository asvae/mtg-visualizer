// Structural markers `cardText` (server/api/card/[set]/[number].ts) embeds
// inline — `annotateCardText`'s own `[phrase](N)` markup only ever wraps a
// fact's own highlighted substring, so these can safely ride alongside it in
// the same blob. FunctionalModelText.vue decodes them into real elements
// (a divider, a color-indicator swatch) instead of leaving literal
// synthetic text sitting in the rendered card. Neither token is real prose
// — no Magic card's own oracle/flavor text will ever contain either — and
// neither reaches the DOM as text.

/** Between a DFC's two per-face blocks — rendered as a real divider element, not a literal "------" run of dashes. */
export const DFC_FACE_BREAK = '@@DFC_FACE_BREAK@@';

/** Real Scryfall "Color Indicator: ..." line (a back face with no mana cost of its own, Shiva, Warden of Ice's own real card the reference case) — `codes` a real color-letter list (`['U']`, `['W','U']`, ...). Rendered as real circular swatches (Scryfall's own `.color-indicator` styling), not a text label. */
export function colorIndicatorMarker(codes: string[]): string {
  return `@@COLOR_INDICATOR:${codes.join(',')}@@`;
}

/** Matches a `colorIndicatorMarker`'s own output — capture group 1 is the comma-joined color-letter list (possibly empty, a genuinely colorless indicator). */
export const COLOR_INDICATOR_MARKER = /@@COLOR_INDICATOR:([WUBRG]*(?:,[WUBRG])*)@@/g;
