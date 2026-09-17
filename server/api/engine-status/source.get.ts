// GET /api/engine-status/source?path=<repo-root-relative path> — serves the
// REAL content of one file cited as evidence by `GET /api/engine-status`
// (a `*.test.ts` citation resolved via that route's own `testFileRefs`), so
// a human reviewer can actually read the test code behind a `blue`/`purple`
// baseline instead of trusting `ENGINE_GAPS.md`'s own prose alone. A
// separate, fetch-on-demand route (rather than inlining full content into
// the main list) specifically because several real gap entries cite the
// SAME large file (`engine.test.ts`, ~115KB, cited by 5 of the 11 real
// `blue` entries as of this writing) — inlining would mean repeating that
// content once per citing entry for no benefit.
//
// Read-only, hard-scoped to `functional-model/` — see
// `functional-model/source-files.ts`'s own header for the real path-escape
// guard this route relies on (never assume `path` is well-formed; it's
// caller-supplied query input).
import { readFunctionalModelFile, type SourceFileResult } from '../../../functional-model/source-files';

export default defineEventHandler((event): SourceFileResult => {
  const query = getQuery(event);
  const path = typeof query.path === 'string' ? query.path : typeof query.file === 'string' ? query.file : '';
  if (!path) {
    throw createError({ statusCode: 400, statusMessage: 'query param "path" (repo-root-relative, e.g. "functional-model/engine.test.ts") is required' });
  }
  return readFunctionalModelFile(process.cwd(), path);
});
