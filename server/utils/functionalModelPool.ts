// Shared functional-model/cards/ pool loader — used by both the card detail
// route (server/api/card/[set]/[number].ts, per-card Interactions panel) and
// the whole-graph route (server/api/graph-links.ts). Extracted from the
// former so both stay in sync on the same tricky import behavior instead of
// two copies drifting apart.
//
// v2 (SYNERGY_DESIGN.md) AI-authored attribute-bag facts, role reattached per
// array (see functional-model/scripts/find-synergies.mjs's own `SynergyFile`
// -> `Fact[]` convention) — `null` when synergy.json is missing, unparseable,
// or still the retired v1 (string-key) shape.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Fact, PoolCard } from '../../functional-model/synergy';

function isV2Shaped(synergy: { source?: unknown[]; sink?: unknown[] }): boolean {
  const all = [...(synergy.source ?? []), ...(synergy.sink ?? [])];
  return all.length > 0 && all.every((f) => typeof f === 'object' && f !== null && ('zone' in f || 'event' in f));
}

export function loadCardSynergy(slug: string): { source: Fact[]; sink: Fact[] } | null {
  try {
    const raw = JSON.parse(readFileSync(join(process.cwd(), `functional-model/cards/${slug}/synergy.json`), 'utf8'));
    if (!isV2Shaped(raw)) return null;
    return {
      source: (raw.source ?? []).map((f: Omit<Fact, 'role'>) => ({ ...f, role: 'source' }) as Fact),
      sink: (raw.sink ?? []).map((f: Omit<Fact, 'role'>) => ({ ...f, role: 'sink' }) as Fact),
    };
  } catch {
    return null;
  }
}

// functional-model/cards/<slug>/ — every card with a v2-shaped, AI-authored
// synergy.json, loaded as PoolCard[] for functional-model/synergy.ts's own
// matcher (findInteractionsForCard). This is the one place that imports an
// arbitrary functional-model TS module rather than reading JSON/text —
// synergy.ts's matcher needs the real CardDefinition (via
// staticAttrsFor/resolveSubject) to resolve a produce's `subject: "self"`
// static attributes (types/cmc/power/toughness), and synergy.ts itself has
// zero runtime dependency on card.ts/harness.ts (see synergy.ts's own
// header), so this stays cheap. Same import pattern
// functional-model/scripts/find-synergies.mjs already uses for the same job
// — see that script if this diverges. Imported by an ABSOLUTE file:// URL
// (pathToFileURL(join(process.cwd(), ...))), not a relative specifier: Nitro
// bundles every server route into one .nuxt/dev/index.mjs, so a relative
// specifier here resolves against THAT bundle's directory at runtime, not
// this source file's — confirmed the hard way, every import silently
// resolved outside the project entirely and the whole pool came back empty.
// Not verified to survive a production `nuxt build` (the raw
// functional-model/ source tree may not ship in a production bundle at
// all); this project currently only runs via `npm run dev`, so that's
// untested, not fixed.
export async function loadFunctionalModelPool(): Promise<PoolCard[]> {
  const cardsDir = join(process.cwd(), 'functional-model/cards');
  let slugs: string[];
  try {
    slugs = readdirSync(cardsDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
  const pool: PoolCard[] = [];
  for (const slug of slugs) {
    const synergy = loadCardSynergy(slug);
    if (!synergy) continue; // no synergy.json, unparseable, or still v1-shaped — not yet migrated
    try {
      const definitionUrl = pathToFileURL(join(cardsDir, slug, 'definition.ts')).href;
      const cardModule = (await import(definitionUrl)) as Record<string, unknown>;
      const card = Object.values(cardModule)[0] as PoolCard['card'];
      if (!card?.name) continue;
      pool.push({ name: card.name, card, source: synergy.source, sink: synergy.sink });
    } catch {
      // definition.ts failed to import — skip rather than error the whole
      // route. Currently hits every card whose definition.ts does `import ... from
      // '../../tokens'` (no extension): functional-model/tokens.ts AND
      // functional-model/tokens/ (a README-only scaffold dir, see
      // SYNERGY_DESIGN.md's "Tokens" section) both exist, and plain Node
      // ESM resolution here (unlike vite-node, which prefers the file)
      // throws "Directory import ... is not supported" on that ambiguity.
      // Real, known limitation — not this route's to fix; see whichever
      // job owns functional-model/tokens.ts vs tokens/.
    }
  }
  return pool;
}
