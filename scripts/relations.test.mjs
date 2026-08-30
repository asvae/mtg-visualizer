// Schema sanity check for data/<set>/<set>_relations.json — the hand/agent-authored
// source of truth for every card's theme relations (see scripts/TAGGING_RULES.md).
// There's no algorithm generating this data to regression-test against anymore
// (that's the whole point of removing the regex tagger), so this just catches
// structural mistakes — a typo'd theme id, an invalid role, a weight out of
// range, a card name that doesn't exist in this set, a duplicate entry.

import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const VALID_ROLES = new Set(['produce', 'consume', 'atypical', 'grant', 'magnifier']);
const SET_CODE = 'fin';

// Same derivation as src/lib/buildGraph.ts — kept in sync by hand since this test
// and the browser module run in different runtimes (plain Node here, no build step).
function creatureSubtypes(card) {
  const faces = card.card_faces?.length ? card.card_faces : [card];
  const subtypes = new Set();
  for (const f of faces) {
    const [main, sub] = (f.type_line || '').split('—').map((s) => s.trim());
    if (!sub || !/\bCreature\b/.test(main || '')) continue;
    for (const word of sub.split(/\s+/)) if (word) subtypes.add(word);
  }
  return [...subtypes];
}
function slugify(word) {
  return word.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

describe(`data/${SET_CODE}/${SET_CODE}_relations.json`, () => {
  it('is well-formed', async () => {
    const themes = JSON.parse(await readFile('data/themes.json', 'utf8'));
    const tags = JSON.parse(await readFile(`data/${SET_CODE}/${SET_CODE}_relations.json`, 'utf8'));
    const allRaw = JSON.parse(await readFile(`data/${SET_CODE}/${SET_CODE}_scryfall.json`, 'utf8'));
    // Same exclusions as buildGraph.ts (basic lands, digital-only Alchemy rebalances) —
    // a relations entry for one of these would never be read by the visualizer at all,
    // so it should fail loudly here instead of silently passing as "a valid name".
    const raw = allRaw.filter((c) => !(c.type_line || '').includes('Basic') && !c.digital);
    const rawNames = new Set(raw.map((c) => c.name));

    // Auto-generated creature-type ids are valid relation targets too (their THEME
    // is auto-derived, only the edge is a manual tagging call) — see buildGraph.ts.
    const curatedThemeIds = new Set(themes.map((t) => t.id));
    const typeThemeIds = new Set();
    for (const c of raw) {
      for (const word of creatureSubtypes(c)) {
        const slug = slugify(word);
        if (slug && !curatedThemeIds.has(slug)) typeThemeIds.add(slug);
      }
    }
    const themeIds = new Set([...curatedThemeIds, ...typeThemeIds, 'not-processed']);

    expect(Array.isArray(tags), `data/${SET_CODE}/${SET_CODE}_relations.json must contain a JSON array`).toBe(true);

    const seen = new Set();
    for (const entry of tags) {
      expect(seen.has(entry.name), `duplicate entry for "${entry.name}"`).toBe(false);
      seen.add(entry.name);
      expect(rawNames.has(entry.name), `"${entry.name}" not found in data/${SET_CODE}/${SET_CODE}_scryfall.json`).toBe(true);

      // `reviewed` marks a human-confirmed entry, as opposed to a mechanical
      // prefill-only one (scripts/prefill-main-types.mjs) — optional (an entry
      // without it just hasn't been through the review loop yet), but must be a
      // real boolean when present.
      if ('reviewed' in entry) {
        expect(typeof entry.reviewed, `"${entry.name}": "reviewed" must be a boolean`).toBe('boolean');
      }

      for (const [role, byTheme] of Object.entries(entry.themes ?? {})) {
        expect(VALID_ROLES.has(role), `"${entry.name}": invalid role "${role}"`).toBe(true);
        for (const [theme, weight] of Object.entries(byTheme)) {
          expect(themeIds.has(theme), `"${entry.name}": unknown theme id "${theme}"`).toBe(true);
          expect(weight, `"${entry.name}"/"${theme}": weight must be 1-3`).toBeGreaterThanOrEqual(1);
          expect(weight, `"${entry.name}"/"${theme}": weight must be 1-3`).toBeLessThanOrEqual(3);
        }
      }
    }
  });
});
