// Recomputes ease/strength on every cards/<slug>/synergy.json fact — see
// synergy.ts's `Weight` doc comment for what each means. Two passes:
//  1. `ease` (produces AND wants): real match count via the SAME matcher
//     synergy.ts uses at runtime (`matchCountForFact`), bucketed+inverted
//     across the whole pool's distribution — not a string-key frequency
//     guess.
//  2. `strength` (produces only): real magnitude read off trace.json log
//     entries, steeply bucketed (1 -> 1, 2 -> 4, 3+ -> 5) per the user's own
//     calibration ("2 cards for one mana is not even close to 1 card").
//
// Usage: npx vite-node functional-model/scripts/compute-weights.mjs
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const { matchCountForFact } = await import('../synergy.ts');
const { TOKENS: TOKEN_INFO } = await import('../tokens.ts');

// synergy.ts's TokenLike wants {name, typeLine, pt?, cmc?} — tokens.ts's own
// TokenInfo (Forge's real shape) instead carries {types: string[], basePower,
// baseToughness}. Same adaptation `resolveSubject`'s callers already need;
// done here once rather than duplicating per card.
const TOKENS = Object.fromEntries(
  Object.entries(TOKEN_INFO).map(([id, t]) => [
    id,
    { name: t.name, typeLine: t.types.join(' '), pt: [t.basePower, t.baseToughness] },
  ]),
);

const cardsDir = new URL('../cards/', import.meta.url);
const cardsDirPath = join(process.cwd(), 'functional-model/cards');
const slugs = readdirSync(cardsDirPath, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);

function isV2Shaped(synergy) {
  const all = [...(synergy.produces ?? []), ...(synergy.wants ?? [])];
  return all.length > 0 && all.every((f) => typeof f === 'object' && f !== null && ('zone' in f || 'event' in f));
}

// --- Load the pool: entries[i] = { slug, raw, poolCard, trace } -----------
const entries = [];
for (const slug of slugs) {
  let raw;
  try {
    raw = JSON.parse(readFileSync(join(cardsDirPath, slug, 'synergy.json'), 'utf8'));
  } catch {
    continue;
  }
  if (!isV2Shaped(raw)) continue;
  const produces = (raw.produces ?? []).map((f) => ({ ...f, role: 'produces' }));
  const wants = (raw.wants ?? []).map((f) => ({ ...f, role: 'wants' }));
  let card;
  try {
    const mod = await import(new URL(`${slug}/definition.ts`, cardsDir).href);
    card = Object.values(mod)[0];
  } catch {
    continue;
  }
  if (!card?.name) continue;
  let trace = [];
  try {
    trace = JSON.parse(readFileSync(join(cardsDirPath, slug, 'trace.json'), 'utf8'));
  } catch {
    // no trace.json — strength falls back to neutral below
  }
  entries.push({ slug, raw, poolCard: { name: card.name, card, produces, wants }, trace });
}
const pool = entries.map((e) => e.poolCard);
console.log(`pool: ${pool.length} cards`);

// --- Pass 1: raw match counts for every fact ------------------------------
const items = []; // { entry, fact, role }
for (const entry of entries) {
  for (const role of ['produces', 'wants']) {
    for (const fact of entry.poolCard[role]) {
      const count = matchCountForFact(fact, entry.poolCard, role, pool, TOKENS);
      items.push({ entry, fact, role, count });
    }
  }
}

// Bucket the nonzero counts' distribution into quintiles, inverted (more
// givers = lower ease). A count of 0 (no giver found at all — doesn't
// render as an edge either way) still gets the "rare" end, 5.
const nonZero = items.map((c) => c.count).filter((n) => n > 0).sort((a, b) => a - b);
function quantile(arr, q) {
  const idx = Math.floor((arr.length - 1) * q);
  return arr[idx];
}
const thresholds = [0.2, 0.4, 0.6, 0.8].map((q) => quantile(nonZero, q));
function easeFor(count) {
  if (count === 0) return 5;
  if (count <= thresholds[0]) return 5;
  if (count <= thresholds[1]) return 4;
  if (count <= thresholds[2]) return 3;
  if (count <= thresholds[3]) return 2;
  return 1;
}
console.log('nonzero count thresholds (p20/p40/p60/p80):', thresholds);
for (const it of items) it.ease = easeFor(it.count);

// --- Pass 2: strength for produce facts, from trace.json magnitude -------
function maxAmount(log, fn, key) {
  let max = 0;
  for (const e of log) if (e.fn === fn && typeof e[key] === 'number') max = Math.max(max, e[key]);
  return max;
}
function countOf(log, fn) {
  return log.filter((e) => e.fn === fn).length;
}
function strengthFromMagnitude(mag) {
  if (mag >= 3) return 5;
  if (mag >= 2) return 4;
  return 1;
}
function computeMagnitude(fact, log) {
  if ('zone' in fact) {
    if (fact.subject && typeof fact.subject === 'object' && 'token' in fact.subject) {
      return Math.max(1, maxAmount(log, 'createToken', 'qty'));
    }
    return 1; // self/no-subject zone produce — one object, no inherent count
  }
  const event = fact.event;
  if (event === 'putCounter') return Math.max(1, maxAmount(log, 'putCounter', 'amount'));
  if (event === 'damage') return Math.max(1, maxAmount(log, 'dealDamage', 'amount'));
  if (event === 'lifegain') return Math.max(1, maxAmount(log, 'gainLife', 'amount'));
  if (event === 'lifeloss') return Math.max(1, maxAmount(log, 'loseLife', 'amount'));
  if (event === 'dies') return Math.max(1, countOf(log, 'destroy'), countOf(log, 'sacrifice'));
  return 1; // grantKeyword, e.g. — no magnitude concept
}

for (const it of items) {
  if (it.role !== 'produces') continue;
  const allLogs = it.entry.trace.flatMap((s) => s.log ?? []);
  const mag = computeMagnitude(it.fact, allLogs);
  it.strength = strengthFromMagnitude(mag);
}

// --- Write back ------------------------------------------------------------
// Re-derive each entry's produces/wants arrays in original order, stripping
// role (implicit per array) and the old weight/typeWeight/themeWeight keys,
// attaching the new ease/strength.
const byEntry = new Map();
for (const it of items) {
  if (!byEntry.has(it.entry)) byEntry.set(it.entry, { produces: [], wants: [] });
  const { role: _role, weight: _w, typeWeight: _tw, themeWeight: _thw, ...rest } = it.fact;
  const out = { ...rest, ease: it.ease };
  if (it.role === 'produces') out.strength = it.strength;
  byEntry.get(it.entry)[it.role].push(out);
}

let written = 0;
for (const entry of entries) {
  const { produces, wants } = byEntry.get(entry);
  const outPath = join(cardsDirPath, entry.slug, 'synergy.json');
  writeFileSync(outPath, JSON.stringify({ produces, wants }, null, 2) + '\n', 'utf8');
  written++;
}
console.log(`wrote ${written} synergy.json files`);
