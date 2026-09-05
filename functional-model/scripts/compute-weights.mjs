// Recomputes `value` on every cards/<slug>/synergy.json fact — see
// synergy.ts's `Weight` doc comment for what it means. One pass, both roles:
//  - `source`: real magnitude read off trace.json log entries, steeply
//    bucketed (1 -> 1, 2 -> 4, 3+ -> 5) per the user's own calibration ("2
//    cards for one mana is not even close to 1 card").
//  - `sink`: the fact's own declared `amount` constraint (a static
//    requirement, not a trace-observed action — e.g. "wants 3+ creatures"
//    reads its magnitude straight off `amount.min`/`amount.eq`), same
//    bucketing. A sink with no numeric constraint has no magnitude concept
//    and gets the neutral floor, 1 — same as a source with no measurable
//    magnitude, not left unset (see `factTotal`'s own doc comment on why
//    every processed fact gets an explicit value rather than staying absent).
//
// Previously computed a second `ease` (rarity) dimension too — dropped in
// favor of `value` alone on both sides; edge weight is now the two
// sides' `value` multiplied directly (see server/api/graph-links.ts's
// `combinedWeight`), not `ease * value` combined per side.
//
// Usage: npx vite-node functional-model/scripts/compute-weights.mjs
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const cardsDir = new URL('../cards/', import.meta.url);
const cardsDirPath = join(process.cwd(), 'functional-model/cards');
const slugs = readdirSync(cardsDirPath, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);

function isV2Shaped(synergy) {
  const all = [...(synergy.source ?? []), ...(synergy.sink ?? [])];
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
  const source = (raw.source ?? []).map((f) => ({ ...f, role: 'source' }));
  const sink = (raw.sink ?? []).map((f) => ({ ...f, role: 'sink' }));
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
    // no trace.json — value falls back to neutral below
  }
  entries.push({ slug, raw, poolCard: { name: card.name, card, source, sink }, trace });
}
const pool = entries.map((e) => e.poolCard);
console.log(`pool: ${pool.length} cards`);

// --- value: real magnitude, source from trace.json / sink from the
// fact's own static `amount` constraint -------------------------------------
function maxAmount(log, fn, key) {
  let max = 0;
  for (const e of log) if (e.fn === fn && typeof e[key] === 'number') max = Math.max(max, e[key]);
  return max;
}
function countOf(log, fn) {
  return log.filter((e) => e.fn === fn).length;
}
function valueFromMagnitude(mag) {
  if (mag >= 3) return 5;
  if (mag >= 2) return 4;
  return 1;
}
function sourceMagnitude(fact, log) {
  if ('zone' in fact) {
    if (fact.subject && typeof fact.subject === 'object' && 'token' in fact.subject) {
      return Math.max(1, maxAmount(log, 'createToken', 'qty'));
    }
    return 1; // self/no-subject zone source — one object, no inherent count
  }
  const event = fact.event;
  if (event === 'putCounter') return Math.max(1, maxAmount(log, 'putCounter', 'amount'));
  if (event === 'damage') return Math.max(1, maxAmount(log, 'dealDamage', 'amount'));
  if (event === 'lifegain') return Math.max(1, maxAmount(log, 'gainLife', 'amount'));
  if (event === 'lifeloss') return Math.max(1, maxAmount(log, 'loseLife', 'amount'));
  if (event === 'dies') return Math.max(1, countOf(log, 'destroy'), countOf(log, 'sacrifice'));
  return 1; // grantKeyword, e.g. — no magnitude concept
}
// A sink's own declared amount is a static requirement, not something a
// trace observes — "wants 3+ creatures" carries its magnitude on the fact
// itself (amount.min/eq). No numeric constraint = no magnitude concept,
// same neutral floor as a source with none.
function sinkMagnitude(fact) {
  const amount = fact.amount;
  if (typeof amount?.min === 'number') return amount.min;
  if (typeof amount?.eq === 'number') return amount.eq;
  return 1;
}

const items = []; // { entry, fact, role, value }
for (const entry of entries) {
  const allLogs = entry.trace.flatMap((s) => s.log ?? []);
  for (const fact of entry.poolCard.source) {
    items.push({ entry, fact, role: 'source', value: valueFromMagnitude(sourceMagnitude(fact, allLogs)) });
  }
  for (const fact of entry.poolCard.sink) {
    items.push({ entry, fact, role: 'sink', value: valueFromMagnitude(sinkMagnitude(fact)) });
  }
}

// --- Write back ------------------------------------------------------------
// Re-derive each entry's source/sink arrays in original order, stripping
// role (implicit per array) and the old weight/typeWeight/themeWeight/ease
// keys, attaching the new value.
const byEntry = new Map();
for (const it of items) {
  if (!byEntry.has(it.entry)) byEntry.set(it.entry, { source: [], sink: [] });
  const { role: _role, weight: _w, typeWeight: _tw, themeWeight: _thw, ease: _ease, ...rest } = it.fact;
  byEntry.get(it.entry)[it.role].push({ ...rest, value: it.value });
}

let written = 0;
for (const entry of entries) {
  const { source, sink } = byEntry.get(entry);
  const outPath = join(cardsDirPath, entry.slug, 'synergy.json');
  writeFileSync(outPath, JSON.stringify({ source, sink }, null, 2) + '\n', 'utf8');
  written++;
}
console.log(`wrote ${written} synergy.json files`);
