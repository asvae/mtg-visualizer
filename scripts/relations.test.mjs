// Schema sanity check for every <set>_relations.json — the hand/agent-authored
// source of truth for every card's theme relations (see scripts/TAGGING_RULES.md).
// There's no algorithm generating this data to regression-test against anymore
// (that's the whole point of removing the regex tagger), so this just catches
// structural mistakes — a typo'd theme id, an invalid role, a weight out of
// range, a card name that doesn't exist in this set, a duplicate entry.
//
// Review/enrichment status is NOT part of this data anymore (2026-08-31) — it
// lives entirely in tagging/card-enrichment-status.json, decoupled from the
// relations data itself so review-process bookkeeping never ships to users
// alongside data/'s actually-served files. See GLOBAL_TAGGING_RULES.md's
// "Output shape" section.

import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const VALID_ROLES = new Set(['produce', 'consume', 'atypical', 'grant', 'magnifier']);

// Every set — FIN (the live-review set) and every historical set from the
// oldest-to-newest sweep alike — shares one global curated theme list.
const THEMES_FILE = 'data/global_themes.json';
// FIN is the only set whose data is actually served to users (data/fin/, via
// public/fin) — every historical set lives under tagging/sets/<code>/, entirely
// outside data/. Add a new set code + its base dir here as its own pass finishes.
const SETS = [
  { code: 'fin', dir: 'data/fin' },
  { code: 'lea', dir: 'tagging/sets/lea' },
  { code: 'leb', dir: 'tagging/sets/leb' },
  { code: '2ed', dir: 'tagging/sets/2ed' },
  { code: 'arn', dir: 'tagging/sets/arn' },
];

// Same derivation as app/lib/buildGraph.ts — kept in sync by hand since this test
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

for (const { code: SET_CODE, dir } of SETS) {
describe(`${dir}/${SET_CODE}_relations.json`, () => {
  it('is well-formed', async () => {
    const themes = JSON.parse(await readFile(THEMES_FILE, 'utf8'));
    const tags = JSON.parse(await readFile(`${dir}/${SET_CODE}_relations.json`, 'utf8'));
    const allRaw = JSON.parse(await readFile(`${dir}/${SET_CODE}_scryfall.json`, 'utf8'));
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

    expect(Array.isArray(tags), `${dir}/${SET_CODE}_relations.json must contain a JSON array`).toBe(true);

    const seen = new Set();
    for (const entry of tags) {
      expect(seen.has(entry.name), `duplicate entry for "${entry.name}"`).toBe(false);
      seen.add(entry.name);
      expect(rawNames.has(entry.name), `"${entry.name}" not found in ${dir}/${SET_CODE}_scryfall.json`).toBe(true);
      expect('reviewed' in entry, `"${entry.name}": "reviewed" no longer belongs on a relations entry — see tagging/card-enrichment-status.json`).toBe(false);

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

describe('tagging/card-enrichment-status.json', () => {
  const VALID_ENRICHMENT = new Set(['script', 'ai', 'human']);
  const VALID_REVIEW = new Set(['ai', 'human']);

  it('is well-formed', async () => {
    const status = JSON.parse(await readFile('tagging/card-enrichment-status.json', 'utf8'));
    for (const [name, entry] of Object.entries(status)) {
      expect(VALID_ENRICHMENT.has(entry.enrichment), `"${name}": invalid enrichment "${entry.enrichment}"`).toBe(true);
      expect(
        entry.review === 'none' || VALID_REVIEW.has(entry.review),
        `"${name}": invalid review "${entry.review}"`,
      ).toBe(true);
      // A card can't be more reviewed than enriched: reviewing implies something
      // was drafted for it to check in the first place.
      if (entry.review !== 'none') {
        expect(entry.enrichment !== 'none', `"${name}": has review "${entry.review}" but no enrichment`).toBe(true);
      }
    }
  });
});
