// Small original line-icon set for MTG keyword abilities — see KeywordIcon.vue
// (the component that renders these) for why these are hand-drawn rather
// than pulled from an existing source: Keyrune/mana (andrewgioia) only cover
// set/mana symbols, not ability keywords; Scryfall's own symbol API
// (ManaSymbol.vue's real source) has no keyword-icon equivalent; and
// Wizards' own Arena client icons (or fan mirrors of them) are proprietary
// UI assets outside what Wizards' Fan Content Policy licenses for reuse in a
// separate tool — unlike card images (Scryfall's own sanctioned API). These
// are simple, generic pictograms instead (a shield, a lightning bolt, an
// eye, ...), not a copy of any specific product's glyph.
//
// Keyed by the exact PascalCase strings functional-model card definitions
// already use for `keywords`/`grantKeyword` (see functional-model/card.ts,
// harness.ts) — same casing, no normalization needed at the call site.
// A plain module (not part of KeywordIcon.vue itself) so a non-Vue consumer
// (app/lib/scenarioReplay.ts's own callers) can check "is this one we have
// an icon for" without importing a component.
export const KEYWORD_ICON_PATHS: Record<string, string> = {
  Flying: '<path d="M4 16l8-8 8 8"/><path d="M4 20h16"/>',
  Reach: '<path d="M12 20V6"/><path d="M7 11l5-5 5 5"/><path d="M8 20h8"/>',
  Trample: '<path d="M12 3v13"/><path d="M7 12l5 5 5-5"/><path d="M4 20h16"/>',
  Vigilance: '<path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="2.5"/>',
  Deathtouch: '<path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z"/><path d="M9 14h6"/>',
  Lifelink: '<path d="M12 20s-7-4.5-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.5-9 9-9 9z"/><path d="M12 8v4"/><path d="M10 10h4"/>',
  FirstStrike: '<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z"/>',
  DoubleStrike: '<path d="M11 2 4 12h5l-1 7 8-10h-5l1-7z" opacity="0.5"/><path d="M15 4 8 14h5l-1 7 8-10h-5l1-7z"/>',
  Haste: '<path d="M13 3 5 13h5l-1 8 9-11h-5l1-7z"/><path d="M3 6h3"/><path d="M2 10h3"/>',
  Menace:
    '<path d="M6 4l5 2v5c0 3.5-2.2 5.7-5 7-2.8-1.3-5-3.5-5-7V6l5-2z" transform="translate(1,1)" opacity="0.5"/><path d="M13 4l5 2v5c0 3.5-2.2 5.7-5 7-2.8-1.3-5-3.5-5-7V6l5-2z"/>',
  Unblockable: '<path d="M3 12h13"/><path d="M12 7l6 5-6 5"/><path d="M7 5v4"/><path d="M7 15v4"/>',
  Ward: '<path d="M12 2l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5l8-3z"/><circle cx="12" cy="11" r="1.6"/>',
  Hexproof:
    '<path d="M12 2l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5l8-3z"/><path d="M12 8l1.2 2.1 2.1 1.2-2.1 1.2L12 14.8l-1.2-2.3-2.1-1.2 2.1-1.2z"/>',
  Indestructible: '<path d="M12 2l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5l8-3z"/><path d="M9 12l2 2 4-4"/>',
  Defender: '<path d="M12 2l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5l8-3z"/>',
  Flash: '<circle cx="12" cy="12" r="9"/><path d="M13 7l-5 6h4l-1 4 5-6h-4l1-4z"/>',
  Convoke: '<circle cx="12" cy="12" r="2"/><circle cx="12" cy="4" r="1.6"/><circle cx="19" cy="16" r="1.6"/><circle cx="5" cy="16" r="1.6"/>',
};

/** Every keyword this icon set actually covers — filter a card's real keyword list down to this before rendering a badge row, so an icon-less keyword (e.g. "Legendary", or a real ability this set hasn't gotten to yet) doesn't leave a visibly empty badge. */
export const KEYWORD_ICON_NAMES = new Set(Object.keys(KEYWORD_ICON_PATHS));
