// Schema sanity check for data/<set>/<set>_relations.json — the hand/agent-authored
// source of truth for every card's theme relations (see scripts/TAGGING_RULES.md).
// There's no algorithm generating this data to regression-test against anymore
// (that's the whole point of removing the regex tagger), so this just catches
// structural mistakes — a typo'd theme id, an invalid role, a weight out of
// range, a card name that doesn't exist in this set, a duplicate entry.

import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const VALID_ROLES = new Set(['produce', 'consume', 'atypical', 'grant', 'magnifier']);
// Escalating provenance ladder: false (untouched) -> 'script' (strict_baseline.py,
// zero judgment) -> 'agent' (an agent-driven strict-review pass, no live human) ->
// 'human' (confirmed via the live review-relay loop). See GLOBAL_TAGGING_RULES.md.
const VALID_REVIEWED = new Set(['script', 'agent', 'human']);

// Every set — FIN (the live-review set) and every historical set from the
// oldest-to-newest sweep alike — shares one global curated theme list.
const THEMES_FILE = 'data/global_themes.json';
// Add a new set code here as its own pass finishes.
const SETS = ['fin', 'lea', 'leb', 'arn'];

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

for (const SET_CODE of SETS) {
describe(`data/${SET_CODE}/${SET_CODE}_relations.json`, () => {
  it('is well-formed', async () => {
    const themes = JSON.parse(await readFile(THEMES_FILE, 'utf8'));
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

      // `reviewed` is an escalating provenance ladder — false/absent (not yet
      // reviewed, e.g. a mechanical prefill-only entry from
      // scripts/prefill-main-types.mjs), 'script' (strict_baseline.py resolved it
      // with zero judgment), 'agent' (an agent-driven strict-review pass, no live
      // human), or 'human' (confirmed via the live review-relay loop). Optional —
      // an entry without it just hasn't been through the review loop yet.
      if ('reviewed' in entry) {
        const r = entry.reviewed;
        expect(
          r === false || VALID_REVIEWED.has(r),
          `"${entry.name}": "reviewed" must be false, 'script', 'agent', or 'human', got ${JSON.stringify(r)}`,
        ).toBe(true);
        if (r !== false) {
          expect(typeof entry.reviewed_at, `"${entry.name}": "reviewed_at" must be set when "reviewed" is ${JSON.stringify(r)}`).toBe('string');
        }
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
}
