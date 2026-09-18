// Populates/updates `data/fdn/fdn_scryfall.json` — the durable, CHECKED-IN
// ground-truth source `functional-model/scripts/verify-coverage-justification.mjs`
// verifies every real `justification.json` span against. Mirrors FIN's own
// real, checked-in `data/fin/fin_scryfall.json` precedent exactly (same
// plain-array-of-raw-Scryfall-card-objects shape, same "real printed data,
// tracked in git, never live-recomputed at verification time" reasoning) —
// see `.claude/contracts/card-schema.md`'s "FDN coverage-justification"
// section for the full "why a checked-in file, not the gitignored
// `.fdn-scratch/` cache or the gitignored `data/cards.db`" writeup.
//
// Deliberately reads from the ALREADY-SYNCED local `data/cards.db` only —
// ZERO live Scryfall calls here. `scripts/sync-card-db.mjs`'s own header
// already explains why this project moved OFF ad hoc per-set static JSON
// snapshots fetched via many small live calls (a real 429 lockout, from
// cumulative per-card lookups during the historical-sets bulk-tagging
// sweep) — this script does NOT reopen that problem: it's a narrow,
// incremental EXTRACT of a small, slowly-growing subset (only the FDN cards
// that have actually entered the authoring pipeline, currently ~100, not
// FDN's whole ~271-card set) FROM the already-bulk-synced local DB, not a
// second live-fetch pathway. `data/cards.db` itself must already exist
// locally (`node scripts/sync-card-db.mjs`, gitignored, ~600MB) — this
// script throws a clear, actionable error if it's missing rather than
// silently falling back to a live per-card fetch.
//
// Usage: npx vite-node functional-model/scripts/sync-fdn-oracle-text.mjs [<slug> ...]
//   (no args = every current functional-model/fdn-cards/<slug>/ with a real
//   definition.ts — the same "whole pool when no argv" convention
//   compute-annotations.mjs already uses)

import { existsSync, readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const FDN_CARDS_DIR = join(ROOT, 'functional-model', 'fdn-cards');
const DB_PATH = join(ROOT, 'data', 'cards.db');
const OUT_PATH = join(ROOT, 'data', 'fdn', 'fdn_scryfall.json');

function resolveSlugs(argv) {
  if (argv.length > 0) return argv;
  let entries;
  try {
    entries = readdirSync(FDN_CARDS_DIR, { withFileTypes: true }).filter((e) => e.isDirectory());
  } catch {
    return [];
  }
  return entries.map((e) => e.name).filter((slug) => existsSync(join(FDN_CARDS_DIR, slug, 'definition.ts')));
}

/** A card's own `definition.ts.name` for a DFC is only the FRONT face's own
 * printed name (this pool's own established convention — see
 * `compute-annotations.mjs`'s identical comment) — the real Scryfall
 * `name`/`cards.db` lookup key for a DFC is the COMBINED "Front // Back"
 * string. Read defensively (transpile-only dynamic import, same reality
 * `validate-card-definition.mjs`'s own header already documents) rather
 * than importing `CardDefinition` as a type. */
async function realCardName(slug) {
  const mod = await import(new URL(`../fdn-cards/${slug}/definition.ts`, import.meta.url).href);
  const def = Object.values(mod).find((v) => v && typeof v === 'object' && typeof v.name === 'string');
  if (!def) return null;
  return def.backFace?.name ? `${def.name} // ${def.backFace.name}` : def.name;
}

async function main() {
  if (!existsSync(DB_PATH)) {
    console.error(`${DB_PATH} does not exist — run \`node scripts/sync-card-db.mjs\` first (see this file's own header).`);
    process.exit(1);
  }

  const slugs = resolveSlugs(process.argv.slice(2));
  if (slugs.length === 0) {
    console.error('No FDN card slugs resolved (empty fdn-cards/ pool, or bad slug list) — nothing to do.');
    process.exit(1);
  }

  const db = new DatabaseSync(DB_PATH, { readOnly: true });
  const stmt = db.prepare("SELECT raw_json FROM cards WHERE name = ? AND set_code = 'fdn' ORDER BY is_normal DESC, released_at DESC LIMIT 1");

  // Merge into whatever's already checked in — this is an incremental,
  // as-a-card-enters-the-pipeline extract (same discipline
  // `annotatedNonFactSpans`/`knownGaps` already follow pool-wide), not a
  // destructive full-pool rebuild every run.
  let existing = [];
  if (existsSync(OUT_PATH)) {
    try {
      existing = JSON.parse(readFileSync(OUT_PATH, 'utf8'));
    } catch {
      existing = [];
    }
  }
  const byName = new Map(existing.map((c) => [c.name, c]));

  let found = 0;
  let missing = 0;
  for (const slug of slugs) {
    let name;
    try {
      name = await realCardName(slug);
    } catch (err) {
      console.log(`skip ${slug}: definition.ts failed to import (${err instanceof Error ? err.message : String(err)})`);
      continue;
    }
    if (!name) {
      console.log(`skip ${slug}: no real CardDefinition-shaped export found`);
      continue;
    }
    const row = stmt.get(name);
    if (!row) {
      console.log(`MISSING ${slug}: no real "${name}" row in data/cards.db (set_code='fdn') — is cards.db stale? re-run node scripts/sync-card-db.mjs`);
      missing++;
      continue;
    }
    byName.set(name, JSON.parse(row.raw_json));
    found++;
  }

  const out = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(out, null, 2) + '\n', 'utf8');
  console.log(`\nWrote ${OUT_PATH}: ${out.length} real card(s) total (${found} resolved this run, ${missing} missing from data/cards.db).`);
  if (missing > 0) process.exit(1);
}

main();
