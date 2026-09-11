// Real card images for functional-model/tokens.ts's hand-maintained TOKENS
// registry — that file's own header says it was transcribed from a
// POOL_TOKEN_REGISTRY in server/api/card/[set]/[number].ts, but that registry
// no longer exists (that route now resolves a card's OWN tokens per-request
// via its `all_parts`, keyed by Scryfall UUID — real card identity, not these
// Forge/TokenScript-style ids). These ids have no live source at all, so this
// route hand-maps each one to a specific real printing (verified against
// data/cards.db below) and resolves that printing's image the same
// DB-first/live-fallback way every other card route here does.
//
// GET /api/tokens/by-key?keys=w_1_1_cat,c_a_treasure_sac,...
// -> { tokens: [{ key, name, image }] } (a key with no mapping or no
// resolvable image is simply omitted — the scenario-replay UI already shows
// a placeholder chip for that case).

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { TOKENS } from '../../../functional-model/tokens';

// Each entry verified directly against data/cards.db (`SELECT ... WHERE
// set_code = ? AND collector_number = ?`) to actually match the TOKENS
// entry's own color/power/toughness/ability text — not just "a" printing of
// that name. Most of TOKENS' keys are BLB's own token sheet (set:tblb) and
// match it exactly (Rabbit, Fish, Otter, Wall, Sword, Squirrel, Bat,
// Cragflame, Rat); the two Cat variants have no tblb printing at all (BLB's
// own sheet never got a Cat token despite tokens.ts's header claiming BLB
// provenance), so those two fall back to Foundations' plain/lifelink Cat
// prints instead. Hero/Knight/Horror are FIN's own sheet (set:tfin, matching
// tokens.ts's later comments); Elf has no BLB/FIN printing at all (ad hoc,
// per tokens.ts's own comment) so it uses a plain green 1/1 Elf token.
const TOKEN_KEY_TO_PRINT: Record<keyof typeof TOKENS, { set: string; number: string }> = {
  w_1_1_cat: { set: 'tfdn', number: '1' },
  w_1_1_cat_lifelink: { set: 'tfdn', number: '27' },
  w_1_1_rabbit: { set: 'tblb', number: '3' },
  c_a_food_sac: { set: 'tfin', number: '22' },
  c_a_treasure_sac: { set: 'tfin', number: '23' },
  u_1_1_fish: { set: 'tblb', number: '7' },
  ur_1_1_otter_prowess: { set: 'tblb', number: '25' },
  w_0_4_wall_defender: { set: 'tblb', number: '4' },
  sword: { set: 'tblb', number: '28' },
  g_1_1_squirrel: { set: 'tblb', number: '23' },
  b_1_1_bat_flying: { set: 'tblb', number: '10' },
  cragflame: { set: 'tblb', number: '26' },
  b_1_1_rat_relentless: { set: 'tblb', number: '13' },
  b_2_2_horror: { set: 'tfin', number: '13' },
  c_1_1_hero: { set: 'tfin', number: '2' },
  w_2_2_knight: { set: 'tfin', number: '10' },
  g_1_1_elf: { set: 'thob', number: '8' },
  // Verified against data/cards.db: scryfall_id 20a709d5-4be5-487b-bfba-
  // 4b1821f2ebd3 = set_code 'tfin', collector_number '34' ("Moogle", 1/2
  // white Moogle creature token, Lifelink) — matches tokens.ts's own
  // w_1_2_moogle_lifelink entry exactly.
  w_1_2_moogle_lifelink: { set: 'tfin', number: '34' },
};

const DB_PATH = join(process.cwd(), 'data', 'cards.db');
const db = existsSync(DB_PATH) ? new DatabaseSync(DB_PATH, { readOnly: true }) : null;
const dbBySetNumberStmt = db?.prepare('SELECT raw_json FROM cards WHERE set_code = ? AND collector_number = ?') ?? null;

interface MinimalScryfallCard {
  name: string;
  image_uris?: { normal?: string };
  card_faces?: { image_uris?: { normal?: string } }[];
}

// Same 110ms-apart pacing as server/api/card/[set]/[number].ts's own
// scryfallFetch — only exercised in prod (no local data/cards.db); this
// route resolves at most 17 fixed printings, and every result is cached
// forever below, so a live process pays this cost once, ever.
let lastScryfallStart = 0;
const SCRYFALL_MIN_INTERVAL_MS = 110;
async function scryfallFetch(url: string): Promise<Response> {
  const now = Date.now();
  const scheduled = Math.max(now, lastScryfallStart + SCRYFALL_MIN_INTERVAL_MS);
  lastScryfallStart = scheduled;
  const wait = scheduled - now;
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  return fetch(url, { headers: { 'User-Agent': 'mtg-visualizer/0.1', Accept: 'application/json' } });
}

// TOKEN_KEY_TO_PRINT is a fixed table of specific printings that never
// change — cache forever per process instead of re-querying/re-fetching on
// every replay load.
const resolvedCache = new Map<string, { name: string; image: string | null } | null>();

async function resolvePrint(set: string, number: string): Promise<MinimalScryfallCard | null> {
  if (dbBySetNumberStmt) {
    const row = dbBySetNumberStmt.get(set, number) as { raw_json: string } | undefined;
    if (row) return JSON.parse(row.raw_json);
  }
  const res = await scryfallFetch(`https://api.scryfall.com/cards/${encodeURIComponent(set)}/${encodeURIComponent(number)}`);
  if (!res.ok) return null;
  return res.json();
}

async function resolveTokenKey(key: string): Promise<{ name: string; image: string | null } | null> {
  if (resolvedCache.has(key)) return resolvedCache.get(key) ?? null;
  const print = TOKEN_KEY_TO_PRINT[key as keyof typeof TOKENS];
  if (!print) {
    resolvedCache.set(key, null);
    return null;
  }
  const card = await resolvePrint(print.set, print.number);
  const result = card ? { name: card.name, image: card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal ?? null } : null;
  resolvedCache.set(key, result);
  return result;
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const rawKeys = query.keys;
  const keys = (typeof rawKeys === 'string' ? rawKeys.split(',') : []).map((k) => k.trim()).filter(Boolean);
  if (keys.length === 0) {
    setResponseStatus(event, 400);
    return { error: 'missing "keys" (comma-separated) query param' };
  }

  const uniqueKeys = [...new Set(keys)];
  const results = await Promise.all(uniqueKeys.map(async (key) => ({ key, resolved: await resolveTokenKey(key) })));

  return {
    tokens: results.filter((r) => r.resolved).map((r) => ({ key: r.key, name: r.resolved!.name, image: r.resolved!.image })),
  };
});
