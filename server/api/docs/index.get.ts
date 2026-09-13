// GET /api/docs — list metadata (slug/title/group) for every doc the
// dev-only `/docs` page's sidebar can link to; content itself is fetched
// per-doc from `[slug].get.ts` so this list stays cheap regardless of how
// large an individual doc file is.
//
// Dev-only: refuses outright in a production runtime, same
// `NODE_ENV === 'production'` convention server/api/card/review-status.ts
// and server/api/card/[set]/[number].ts already use — the calling page
// gates itself via `import.meta.dev` too (app/pages/docs/[[slug]].vue), but
// this route is reachable independent of which page asks, so it carries
// its own refusal rather than trusting the client-side gate alone.
import { DOC_REGISTRY } from './_registry';

export default defineEventHandler(() => {
  if (process.env.NODE_ENV === 'production') {
    throw createError({ statusCode: 404, statusMessage: 'Not found' });
  }
  return DOC_REGISTRY.map(({ slug, title, group }) => ({ slug, title, group }));
});
