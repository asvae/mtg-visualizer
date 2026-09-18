// GET /api/forge-script?name=<card name> — the card page's "Forge Script"
// tab (`CardDetailTabs.vue`), see `server/utils/forgeScript.ts`'s own header
// for the full dev-only/GPL-safety reasoning and filename-resolution
// algorithm; this route is a thin HTTP wrapper around that module, no logic
// of its own. `name` is a query param, not a dynamic route segment — a real
// card name can contain `/` (MDFC/split cards, e.g. "Kefka, Court Mage //
// Kefka, Ruler of Ruin"), which a `[name].get.ts`-style path segment can't
// carry safely.
//
// Always 200s with a discriminated `available`/`found` body (see
// `ForgeScriptResult`) rather than 404ing on a no-match — "no Forge script
// found for this card" is an expected, common, non-error outcome (not every
// FDN/FIN card is a 1:1 real Magic card in this local checkout, or the
// checkout could be stale), same posture `sink-catalog`/`engine-status`
// degrade-to-empty routes already use elsewhere in this codebase.
import { loadForgeScript, type ForgeScriptResult } from '../../utils/forgeScript';

export default defineEventHandler((event): ForgeScriptResult => {
  const query = getQuery(event);
  const name = typeof query.name === 'string' ? query.name : '';
  if (!name.trim()) throw createError({ statusCode: 400, statusMessage: 'Missing name query param' });
  return loadForgeScript(name);
});
