// Scans every `cards/<slug>/scenarios.ts` for a literal, string-authored
// permanent NAME passed to `PlayerState.addCard(...)` (state.ts) and
// confirms it names a REAL Scryfall card — not an invented placeholder —
// per the project's own "scenario replay: real not mocked" rule
// (CLAUDE.md/agent memory: fix real bugs / use real cards for board
// filler, never a generic/fabricated stand-in).
//
// Scope, deliberately narrow:
//   - Only `addCard(...)`'s own literal `name: '...'`/`name: "..."` field is
//     checked. A `name: someCard.name` PROPERTY ACCESS (referencing an
//     imported `CardDefinition`, e.g. `name: summonBahamut.name`) is not a
//     literal — skipped, since that card's own name is already whatever its
//     own (separately reviewed) `definition.ts` says, not authored fresh
//     here.
//   - A `PlayerState.tokens` catalog key (`tokens: ['c_a_treasure_sac']`,
//     `functional-model/tokens.ts`'s own `TOKENS` map) is NOT in scope —
//     tokens are legitimately synthetic by design (Treasure/Hero/Cat/etc,
//     modeled off Scryfall's own TOKEN data, not a set-legal card), never
//     board-filler pretending to be a real nontoken permanent. This script
//     never even looks at `tokens:` arrays — it only ever reads literal
//     `addCard(...)` object-literal text, and no scenario in the pool
//     constructs a token via a literal `addCard(..., {name: 'X', ...})`
//     call today (grep-confirmed 2026-09-11 — `TOKENS.` never appears in any
//     `cards/*/scenarios.ts`).
//   - Basic lands (Plains/Island/Swamp/Mountain/Forest/Wastes) are always
//     accepted even if a particular set's own Scryfall data file happens
//     not to carry that exact basic — they're real, universally-reprinted
//     cards by definition, not a set-specific check concern.
//
// Usage: node functional-model/scripts/verify-scenario-card-names.mjs
// (this file is the shared logic; that one is the CLI wrapper + the
// vitest test both import from here — see each file's own header.)

import { readdir, readFile } from 'node:fs/promises';

const BASIC_LAND_NAMES = new Set(['Plains', 'Island', 'Swamp', 'Mountain', 'Forest', 'Wastes']);

/**
 * Every real Scryfall card name across every checked-in `data/<set>/*.json`
 * card-data file (NOT the `dist/` build copy, which is generated FROM
 * `data/`, not an independent source) — `data/<set>/<set>_scryfall.json`
 * today (only `fin/` exists as of this writing; written to generalize to
 * whatever sets the historical-sets tagging sweep adds later, per this
 * script's own "across all set files under data" scope). Deliberately
 * excludes `*_tokens_scryfall.json` (Scryfall's own TOKEN print data, a
 * different card space from what this check validates — see this file's
 * own header on why `tokens:` catalog entries are out of scope) so a
 * fabricated nontoken-permanent name can't accidentally validate just
 * because a same-named TOKEN happens to exist.
 *
 * A double-faced card's own `card_faces` are also indexed by EACH face's
 * own name (not just the combined "Front // Back" `name` field) — a
 * scenario naming just one face of a real MDFC (unlikely today, but not
 * disallowed) should still resolve.
 */
export async function loadRealCardNameSet(dataDir) {
  const names = new Set(BASIC_LAND_NAMES);
  const setDirs = await readdir(dataDir, { withFileTypes: true }).catch(() => []);
  for (const dirent of setDirs) {
    if (!dirent.isDirectory()) continue;
    const setDir = new URL(`${dirent.name}/`, dataDir);
    const files = await readdir(setDir, { withFileTypes: true }).catch(() => []);
    for (const file of files) {
      if (!file.isFile()) continue;
      if (!file.name.endsWith('_scryfall.json') || file.name.endsWith('_tokens_scryfall.json')) continue;
      const raw = await readFile(new URL(file.name, setDir), 'utf8').catch(() => null);
      if (!raw) continue;
      let cards;
      try {
        cards = JSON.parse(raw);
      } catch {
        continue;
      }
      if (!Array.isArray(cards)) continue;
      for (const card of cards) {
        if (typeof card?.name === 'string') names.add(card.name);
        if (Array.isArray(card?.card_faces)) {
          for (const face of card.card_faces) {
            if (typeof face?.name === 'string') names.add(face.name);
          }
        }
      }
    }
  }
  return names;
}

/**
 * Extracts every literal `name: '...'`/`name: "..."` string authored
 * directly inside a `addCard(...)` call's own object-literal argument,
 * from raw `scenarios.ts` TEXT (no TS compile/import needed — this is a
 * plain lexical scan, matching `verify-synergy.mjs`'s own "small stable
 * duplicate rather than widen the engine import" trade for plain-.mjs
 * tooling). Brace-balanced (not a naive `[^}]*` regex) so a future
 * `addCard` call whose opts object nests another `{...}`-shaped field
 * (e.g. `ptFormula: {kind: ...}`, a real `RealCard` field per state.ts)
 * doesn't truncate the scan early. Returns `{name, index}` pairs (byte
 * offset of the match, for line-number reporting) — NOT deduped, since a
 * fabricated name authored twice in one file is still two separate things
 * worth reporting.
 */
export function findAddCardNameLiterals(text) {
  const results = [];
  const callRe = /\baddCard\s*\(/g;
  let m;
  while ((m = callRe.exec(text))) {
    const braceStart = text.indexOf('{', m.index);
    if (braceStart === -1) continue;
    let depth = 0;
    let end = -1;
    for (let i = braceStart; i < text.length; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}') {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end === -1) continue; // unbalanced — shouldn't happen in valid TS, skip defensively
    const objText = text.slice(braceStart, end + 1);
    const nameMatch = /\bname\s*:\s*(['"])((?:(?!\1).)*)\1/.exec(objText);
    if (nameMatch) results.push({ name: nameMatch[2], index: braceStart + nameMatch.index });
    callRe.lastIndex = end; // resume scanning after this call's own object, not inside it
  }
  return results;
}

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

/**
 * The full check: every `cards/<slug>/scenarios.ts` in the pool, every
 * literal `addCard(...)` name it authors, cross-checked against
 * `loadRealCardNameSet`. Returns a flat violation list (empty = pool is
 * clean) — never throws/exits itself, so both the CLI wrapper and the
 * vitest test can decide how to report/fail.
 */
export async function findFabricatedScenarioCardNames({ cardsDir, dataDir }) {
  const realNames = await loadRealCardNameSet(dataDir);
  const violations = [];
  const entries = await readdir(cardsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const scenariosUrl = new URL(`${entry.name}/scenarios.ts`, cardsDir);
    const text = await readFile(scenariosUrl, 'utf8').catch(() => null);
    if (text === null) continue; // no scenarios.ts for this card yet
    for (const { name, index } of findAddCardNameLiterals(text)) {
      if (!realNames.has(name)) {
        violations.push({ slug: entry.name, name, line: lineOf(text, index), file: `cards/${entry.name}/scenarios.ts` });
      }
    }
  }
  violations.sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : a.line - b.line));
  return violations;
}
