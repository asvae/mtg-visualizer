// Prints every real `functional-model/fdn-cards/<slug>/definition.ts`'s own
// exported `CardDefinition` as one JSON array to stdout — spawned under
// `vite-node` by `server/api/card/[set]/[number].ts`'s own FDN branch (see
// that route's own `loadFdnDefinitionPool` doc comment), the same
// "recompute fresh per request, dev-only" posture `run-one-card.mjs`/
// `compute-one-card-status.mjs` already establish for the exact same class
// of problem: a plain Nitro/Node `import()` of an arbitrary `definition.ts`
// fails on ANY value-level (non-type-only) extensionless relative import
// inside it — real, confirmed on `day-of-judgment/definition.ts`'s own
// `import { anyPlayer, destroyEach } from '../../combinator'` (every other
// current fdn-cards file only ever imports `CardDefinition`/`Effect` as
// TYPES, which get erased entirely, so this was invisible until a card
// needing a real value import existed) — `vite-node`'s own resolver
// tolerates the missing extension where plain Node ESM resolution doesn't,
// same gap `validate-card-definition.mjs`'s own header documents for why
// ITS dynamic import also has to run this way.
//
// A `CardDefinition` is plain, JSON-serializable data (confirmed directly:
// even a `kind:'program'` effect's own combinator-DSL `program` field is a
// plain nested object tree, no functions) — printing the whole array as one
// JSON blob, rather than one object per line or a subprocess per card, is
// the deliberately simplest form, since the real cost here is vite-node's
// own subprocess-startup overhead (~10 real files today), not per-card
// marshalling.
//
// Usage: npx vite-node functional-model/scripts/list-fdn-definitions.mjs
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fdnCardsDir = join(__dirname, '..', 'fdn-cards');

let slugs = [];
try {
  slugs = readdirSync(fdnCardsDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
} catch {
  // No functional-model/fdn-cards/ directory at all — degrade to an empty
  // pool rather than error, same tolerance every other consumer of this
  // axis already has for "nothing has entered the pipeline yet."
}

const definitions = [];
for (const slug of slugs) {
  try {
    const cardModule = await import(`../fdn-cards/${slug}/definition.ts`);
    const definition = Object.values(cardModule)[0];
    if (definition?.name) definitions.push(definition);
  } catch {
    // definition.ts failed to import — skip rather than fail the whole
    // pool, same tolerance loadFunctionalModelPool/loadCardDefinitionDev
    // already establish for this exact class of failure.
  }
}

process.stdout.write(JSON.stringify(definitions));
