// GET /api/card-schema — serves the real card-authoring schema type
// declarations for the `/app/engine/schema` reference page (reachable from
// EngineConsoleTabs.vue's "…" overflow, alongside Keywords). Thin wrapper
// around `functional-model/card-schema-source.ts`'s own extractor — see
// that file's header for how/why this slices real source out of `card.ts`
// (plus `TokenInfo` from `interfaces.ts`) rather than hand-copying a
// parallel description. Read-only, recomputed fresh from disk on every
// request (same "no caching" dev convention every other `/app/engine/*`
// evidence route already follows) — an edit to `card.ts` shows up on the
// next reload with no server restart needed.
import { loadCardDefinitionSchema } from '../../functional-model/card-schema-source';
import type { CardSchemaTypeEntry } from '../../functional-model/card-schema-source';

export type { CardSchemaTypeEntry };

export default defineEventHandler((): CardSchemaTypeEntry[] => {
  return loadCardDefinitionSchema(process.cwd());
});
