// Writes functional-model/recognizers/review-status.json's own
// human-reviewed override — exact same shape/pattern as
// server/api/keywords/review-status.ts, but for the recognizer catalog
// (functional-model/recognizers/) instead of the keyword/mechanic registry.
// A recognizer id's presence here (mapped to `true`) upgrades its
// `ai_reviewed` GET /api/recognizers status to `human_reviewed` at read
// time; absence means "not yet human-reviewed" (there is no on-disk value
// for `ai_reviewed` — that's just "no override present," same convention as
// keywords' own override file).
//
// Dev-only, same reasoning as server/api/keywords/review-status.ts: writes
// into the repo's own functional-model/ source tree, no real audit trail,
// and a real serverless deployment's filesystem isn't the repo checkout
// anyway.
//
// POST /api/recognizers/review-status, body { key: string, reviewed: boolean }
// -> { key: string, reviewStatus: 'ai_reviewed' | 'human_reviewed' }
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { RECOGNIZER_IDS } from '../recognizer-source/[rule].get';

const STORE_PATH = join(process.cwd(), 'functional-model/recognizers/review-status.json');

function loadOverrides(): Record<string, true> {
  if (!existsSync(STORE_PATH)) return {};
  try {
    return JSON.parse(readFileSync(STORE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

export default defineEventHandler(async (event) => {
  if (process.env.NODE_ENV === 'production') {
    setResponseStatus(event, 403);
    return { error: 'review-status is dev-only' };
  }

  const body = await readBody(event).catch(() => null);
  const key: string | undefined = body?.key;
  const reviewed: boolean | undefined = body?.reviewed;
  if (!key || typeof reviewed !== 'boolean') {
    setResponseStatus(event, 400);
    return { error: 'missing/invalid "key" (string) or "reviewed" (boolean) in request body' };
  }

  if (!RECOGNIZER_IDS.includes(key as (typeof RECOGNIZER_IDS)[number])) {
    setResponseStatus(event, 404);
    return { error: `no recognizer for id "${key}"` };
  }

  const overrides = loadOverrides();
  if (reviewed) overrides[key] = true;
  else delete overrides[key];

  mkdirSync(dirname(STORE_PATH), { recursive: true });
  writeFileSync(STORE_PATH, JSON.stringify(overrides, null, 2) + '\n', 'utf8');

  return { key, reviewStatus: reviewed ? 'human_reviewed' : 'ai_reviewed' };
});
