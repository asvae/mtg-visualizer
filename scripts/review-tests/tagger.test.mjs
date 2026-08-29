// Regression tests for the tagging pipeline (lib/tagger.mjs's tagCard) — one JSON
// fixture per set (fin.json, ...), each entry a reviewed card's expected edges.
// Add an entry here as soon as a card's tagging is confirmed correct during review
// (see scripts/review-card.mjs), so a THEMES/EXCEPTIONS change that silently
// changes that card's tagging later fails a test instead of only showing up as an
// unread diff in data/<set>_graph.json.
//
// Fixture shape (per set file, array of): { card: "<exact Scryfall name>", edges: [
//   { theme, role, weight, modifiers } ] } — no card id (real ids are random UUIDs
// pulled from data/<set>_cards.json at test time, not something to hand-write).

import { readdir, readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { tagCard } from '../lib/tagger.mjs';

const fixturesDir = new URL('.', import.meta.url);
const fixtureFiles = (await readdir(fixturesDir)).filter((f) => f.endsWith('.json'));

for (const file of fixtureFiles) {
  const setCode = file.replace(/\.json$/, '');
  const fixtures = JSON.parse(await readFile(new URL(file, fixturesDir), 'utf8'));
  const raw = JSON.parse(await readFile(`data/${setCode}_cards.json`, 'utf8'));
  const rawByName = new Map(raw.map((c) => [c.name, c]));

  describe(`tagCard (${setCode})`, () => {
    for (const fixture of fixtures) {
      it(fixture.card, () => {
        const card = rawByName.get(fixture.card);
        expect(card, `"${fixture.card}" not found in data/${setCode}_cards.json`).toBeTruthy();

        const actual = tagCard(card).map(({ theme, role, weight, modifiers }) => ({ theme, role, weight, modifiers }));
        const sortKey = (e) => `${e.theme}|${e.role}`;
        actual.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
        const expected = [...fixture.edges].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));

        expect(actual).toEqual(expected);
      });
    }
  });
}
