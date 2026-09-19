// GET /api/forge-json-compiler?name=<card name> — the card page's "Forge
// Compiler" tab (`CardDetailTabs.vue`), see `server/utils/forgeJsonCompiler.ts`'s
// own header for the full design/dev-only posture; this route is a thin HTTP
// wrapper around that module, no logic of its own. `name` is a query param,
// not a dynamic route segment, same reasoning `GET /api/forge-script` already
// documents (a real card name can contain `/`).
//
// Always 200s with a discriminated `available`/`supported` body (see
// `ForgeJsonCompilerResult`) rather than 404ing/500ing on a no-match or a
// thrown compile — "this card isn't the one the narrow compiler experiment
// supports" (or a genuine `UnsupportedForgeShape` gap) is expected,
// reportable information for this tab, not a route failure.
import { loadForgeJsonCompilerResult, type ForgeJsonCompilerResult } from '../../utils/forgeJsonCompiler';

export default defineEventHandler(async (event): Promise<ForgeJsonCompilerResult> => {
  const query = getQuery(event);
  const name = typeof query.name === 'string' ? query.name : '';
  if (!name.trim()) throw createError({ statusCode: 400, statusMessage: 'Missing name query param' });
  return loadForgeJsonCompilerResult(name);
});
