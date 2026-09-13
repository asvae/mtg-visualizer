// Plain JS, not `.ts` — same convention `scripts/annotation-coverage.mjs`/
// `scripts/scenario-card-names.mjs` already established for anything that
// touches `node:fs` directly: this project's `functional-model/tsconfig.json`
// has no real precedent for a `.ts` file importing a node builtin (checked
// before assuming — every existing node:fs touch point in this directory is
// a `.mjs`), so real filesystem access for test fixtures lives here instead,
// imported by `recognizers.test.ts` the same way `annotation-coverage.test.ts`
// imports its own `.mjs` (accepting the same harmless TS7016 "implicitly any"
// quirk that convention already documents).
//
// Loads real card text straight from `data/fin/fin_scryfall.json` — the same
// real, checked-in Scryfall source `scripts/compute-annotations.mjs`'s own
// `loadOracleTextByName` reads from — keyed by Scryfall's own `name` field
// (the combined "Front // Back" string for a two-faced card, same identity
// convention that script's own header documents).
import { readFileSync } from 'node:fs';

export function loadFinCards() {
  const raw = readFileSync(new URL('../../data/fin/fin_scryfall.json', import.meta.url), 'utf8');
  const cards = JSON.parse(raw);
  const byName = new Map();
  for (const card of cards) {
    if (typeof card?.name !== 'string') continue;
    if (Array.isArray(card.card_faces) && card.card_faces.length > 0) {
      byName.set(card.name, {
        name: card.name,
        front: { typeLine: card.card_faces[0].type_line ?? '', oracleText: card.card_faces[0].oracle_text ?? '' },
        back: card.card_faces[1] ? { typeLine: card.card_faces[1].type_line ?? '', oracleText: card.card_faces[1].oracle_text ?? '' } : undefined,
      });
    } else {
      byName.set(card.name, { name: card.name, front: { typeLine: card.type_line ?? '', oracleText: card.oracle_text ?? '' } });
    }
  }
  return byName;
}
