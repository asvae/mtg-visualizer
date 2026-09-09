// Writes functional-model/keywords/review-status.json's own human-reviewed
// override — parallel workflow to server/api/card/review-status.ts (same
// dev-only 403 guard, same shape of endpoint), but for the keyword/mechanic
// coverage suite (functional-model/keywords/registry.ts) instead of a
// single card's progress.json.
//
// 2026-09-09 (engine handoff landed): registry.ts's own `KeywordEntry.status`
// is now the shared 3-way `ReviewStatus` vocabulary directly
// ('not_implemented' | 'ai_reviewed' | 'human_reviewed', app/types.ts) — no
// separate `reviewStatus` field/merge needed anymore (see index.get.ts's own
// updated header). This override file stays as the ONE thing registry.ts
// itself can't hold (a human's own confirmation can't live in generated/
// hand-authored source without a human editing it) — a key's presence here
// (mapped to `true`) upgrades an `ai_reviewed` registry entry to
// `human_reviewed` at read time; absence means "trust the registry's own
// static status as-is." There is deliberately no on-disk value for
// "ai_reviewed" — that's just "no override present."
//
// Dev-only, same reasoning as server/api/card/review-status.ts: writes into
// the repo's own functional-model/ source tree, no real audit trail, and a
// real serverless deployment's filesystem isn't the repo checkout anyway.
//
// POST /api/keywords/review-status, body { key: string, reviewed: boolean }
// -> { key: string, reviewStatus: 'ai_reviewed' | 'human_reviewed' }

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { KEYWORD_REGISTRY } from '../../../functional-model/keywords/registry';

const STORE_PATH = join(process.cwd(), 'functional-model/keywords/review-status.json');

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

  const entry = KEYWORD_REGISTRY.find((e) => e.key === key);
  if (!entry) {
    setResponseStatus(event, 404);
    return { error: `no keyword registry entry for key "${key}"` };
  }
  // A `not_implemented` entry (nothing implemented — see registry.ts's own
  // doc comment) has no scenario/trace for a human to confirm at all; the
  // confirm control shouldn't even render for one (ReviewStatusBadge.vue's
  // own `'not_implemented'` status hides itself entirely), but guard here
  // too rather than trusting the client.
  if (entry.status === 'not_implemented') {
    setResponseStatus(event, 400);
    return { error: `"${key}" is not implemented — nothing to mark reviewed` };
  }

  const overrides = loadOverrides();
  if (reviewed) overrides[key] = true;
  else delete overrides[key];

  mkdirSync(dirname(STORE_PATH), { recursive: true });
  writeFileSync(STORE_PATH, JSON.stringify(overrides, null, 2) + '\n', 'utf8');

  return { key, reviewStatus: reviewed ? 'human_reviewed' : 'ai_reviewed' };
});
