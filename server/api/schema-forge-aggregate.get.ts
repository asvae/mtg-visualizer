// GET /api/schema-forge-aggregate — serves the Forge-corpus schema-vocabulary
// aggregate report for the `/app/engine/schema-forge` reference page. Thin
// wrapper around `server/utils/forgeSchemaAggregate.ts` — see that file's
// header for why this is dev-only/gitignored/optional (local-only tooling
// output, not a committed pipeline artifact). Read-only, recomputed fresh
// from disk on every request, same convention as `/api/card-schema`.
import { loadForgeSchemaAggregate } from '../utils/forgeSchemaAggregate';
import type { ForgeSchemaAggregateResult } from '../utils/forgeSchemaAggregate';

export type { ForgeSchemaAggregateResult };

export default defineEventHandler((): ForgeSchemaAggregateResult => {
  return loadForgeSchemaAggregate(process.cwd());
});
