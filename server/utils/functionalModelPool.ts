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

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Fact, PoolCard } from '../../functional-model/synergy';
import { fmBundle } from './fmBundle';

function isV2Shaped(synergy: { source?: unknown[]; sink?: unknown[] }): boolean {
  const all = [...(synergy.source ?? []), ...(synergy.sink ?? [])];
  // A SOURCE `ZoneFact` may now carry `to`/`from` instead of (or alongside)
  // `zone` (2026-09-11 rework, functional-model/synergy.ts's `ZoneFact`) —
  // this is a local duplicate of the same widening `engine` made to every
  // other `isV2Shaped` copy in scripts/{verify-synergy,find-synergies,
  // compute-weights}.mjs; this one lives here (not those scripts) since it
  // gates the live card-page API route, and was missed by that pass. Without
  // it, summon-bahamut's own two converted facts (no `zone`/`event` key at
  // all) fail `.every()` and the WHOLE card falls back to "not yet migrated"
  // — confirmed live via the Facts tab.
  return (
    all.length > 0 &&
    all.every((f) => typeof f === 'object' && f !== null && ('zone' in f || 'event' in f || 'to' in f || 'from' in f))
  );
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
// Dev-only: none of this (readdirSync over functional-model/cards/, a
// dynamic import() of an arbitrary slug's definition.ts) survives a
// production Netlify Function bundle — confirmed in prod as ENOENT scandir
// '/var/task/functional-model'. loadFunctionalModelPool below branches to
// fmBundle.ts's statically-imported, build-time-generated snapshot in
// production instead (see scripts/build-fm-bundle.mjs).
// Cheap stat-only signature (no JSON.parse, no dynamic import) covering
// every card folder's synergy.json + definition.ts mtimes, plus the slug
// list itself (so an added/removed folder changes the signature even if
// mtimes alone happened to coincide). Comparing this against the last build
// is what lets a rebuild get skipped entirely on the common case (nobody's
// touched functional-model/cards/ since the last request) — see the
// dynamic-import cost this guards against in loadFunctionalModelPool below.
function poolSignature(cardsDir: string, slugs: string[]): string {
  const parts: string[] = [`n:${slugs.length}`];
  for (const slug of slugs) {
    for (const file of ['synergy.json', 'definition.ts'] as const) {
      try {
        parts.push(`${slug}/${file}:${statSync(join(cardsDir, slug, file)).mtimeMs}`);
      } catch {
        parts.push(`${slug}/${file}:x`);
      }
    }
  }
  return parts.join('|');
}
let poolCache: { signature: string; pool: PoolCard[] } | null = null;

export async function loadFunctionalModelPool(): Promise<PoolCard[]> {
  // Production: build the pool from fmBundle.ts's statically-imported,
  // build-time-generated snapshot (scripts/build-fm-bundle.mjs) instead of
  // scanning/importing functional-model/cards/ off disk — see this
  // function's own header comment above for why that never survives a
  // Netlify Function bundle. `poolFacts` carries just the CardDefinition
  // fields (name/manaCost/typeLine/cmc/pt) the matcher (synergy.ts's
  // staticAttrsFor/resolveSubject) ever actually reads off `PoolCard.card`.
  if (process.env.NODE_ENV === 'production') {
    return Object.values(fmBundle)
      .filter((entry): entry is typeof entry & { synergy: NonNullable<typeof entry.synergy> } => entry.synergy !== null)
      .map((entry) => ({ name: entry.name, card: entry.poolFacts, source: entry.synergy.source, sink: entry.synergy.sink }));
  }

  const cardsDir = join(process.cwd(), 'functional-model/cards');
  let slugs: string[];
  try {
    slugs = readdirSync(cardsDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
  const signature = poolSignature(cardsDir, slugs);
  if (poolCache && poolCache.signature === signature) return poolCache.pool;

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
  poolCache = { signature, pool };
  return pool;
}
