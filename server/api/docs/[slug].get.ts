// GET /api/docs/:slug — raw markdown content for exactly one doc off the
// `DOC_REGISTRY` allow-list (never an arbitrary filesystem path off the
// request itself). Read fresh off disk every request (same "no restart
// needed to see an edit" dev convention as server/api/keywords/index.get.ts's
// own `loadFinScryfall`/`loadReviewOverrides`) — reasonable here since this
// route is dev-only anyway.
//
// Dev-only — see index.get.ts's own header for why both this route and the
// calling page each carry their own gate.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { DOC_REGISTRY } from './_registry';

export default defineEventHandler((event) => {
  if (process.env.NODE_ENV === 'production') {
    throw createError({ statusCode: 404, statusMessage: 'Not found' });
  }
  const slug = getRouterParam(event, 'slug');
  const entry = DOC_REGISTRY.find((d) => d.slug === slug);
  if (!entry) {
    throw createError({ statusCode: 404, statusMessage: 'Unknown doc' });
  }
  const filePath = join(process.cwd(), entry.relPath);
  if (!existsSync(filePath)) {
    throw createError({ statusCode: 404, statusMessage: 'Doc file missing on disk' });
  }
  const content = readFileSync(filePath, 'utf8');
  return { slug: entry.slug, title: entry.title, group: entry.group, content };
});
