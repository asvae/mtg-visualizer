// Per-card overrides for the regex tagger — for cases regex can't or shouldn't be
// made to handle generically. Applied AFTER all THEMES regex rules in tag-cards.mjs,
// so these always win over whatever the regex produced (or didn't produce).
//
// Shape: { card: 'Exact Card Name', theme: 'theme-id', role, weight?, modifiers? }
//   - role: 'produce' | 'consume' — forces/adds this edge. To assert a card both
//     produces AND consumes a theme, add two exception entries (one of each role).
//   - role: null — suppresses this theme entirely for this card (fixes a false
//     positive the regex shouldn't have caught).
//   - weight defaults to 3 if omitted (a manual assertion implies high confidence).
//   - modifiers defaults to [] if omitted.
//
// Card is matched by Scryfall's exact `name` field (including "//" for DFCs).
export const EXCEPTIONS = [];
