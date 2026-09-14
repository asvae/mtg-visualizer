// GET /api/recognizer-source/:rule — raw TypeScript source of exactly one
// `functional-model/recognizers/<rule>.ts` file, for the Facts tab's
// parser-provenance popover (`Fact.provenance.rule`,
// `.claude/contracts/card-schema.md`'s "Parser-derived facts" section). Same
// explicit-allowlist shape as `server/api/docs/[slug].get.ts` — never an
// arbitrary filesystem path off the request itself, even though the request
// param and the file's basename happen to be the same string today (that
// convention could change; the allowlist, not string equality, is what
// actually gates this).
//
// Read-only file serving for display purposes only — this route (and the
// `card` agent generally) does not author or modify recognizer behavior; see
// `functional-model/PRD_AUTOMATED_AUTHORING.md` and the `engine` agent for
// that.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { RecognizerId } from '../../../functional-model/recognizers/types';

// Mirrors `RecognizerId` (functional-model/recognizers/types.ts) as a real
// runtime array — a TS union can't be enumerated at runtime, so this list is
// kept by hand, same as `DOC_REGISTRY` is. Widen this alongside that type
// when a new recognizer is added; a rule id missing from here 404s even if
// the underlying file exists, by design (no accidental filename-guessing
// fallback).
//
// `'destroy-effect-structural'` added 2026-09-13 (`engine` agent,
// recognizer-wiring dedup/retag follow-up) — `RecognizerId` itself already
// included it from that recognizer's own earlier wiring pass, but this
// hand-kept mirror was missed at the time, so every `destroy`-fact
// provenance popover 404'd on `GET /api/recognizer-source/destroy-effect-
// structural` ("Could not load recognizer source") until this line caught
// up — found via this same pass's live-browser verification, not a design
// change.
//
// `'drawCard-effect-structural'` added same day, same pass, by the SAME
// `engine` agent that just fixed the miss above — added THIS TIME
// alongside the recognizer's own wiring pass, not as a follow-up fix, so
// this file doesn't repeat the exact same 404 for a 4th recognizer.
//
// `'saga-lore-and-sacrifice-structural'` (5th recognizer) added the same
// way, same pass as its own wiring — no repeat of the original miss.
// Exported (2026-09-13, `ui` agent, recognizer-coverage page pass) so
// `server/api/recognizers/index.get.ts`/`review-status.ts` can import this
// exact array instead of hand-typing a second copy that could drift — this
// route stays the one canonical place the id list is hand-kept.
//
// `'dies-trigger-structural'`/`'lifegain-trigger-structural'`/
// `'dealDamage-effect-structural'`/`'putCounter-broadcast-structural'`
// (6th-9th recognizers) added 2026-09-13, `engine` agent, same pass as their
// own real wiring into `apply-recognizers.mjs` — added THIS TIME alongside
// the wiring pass itself, per this file's own standing note above not to
// repeat the original allowlist-miss bug.
//
// `'attacks-trigger-structural'` (10th recognizer, wired 2026-09-14) was
// ACTUALLY MISSED here despite the standing note above — caught and fixed
// 2026-09-14 by the SAME `engine` agent pass that added the 2 recognizers
// below, not alongside its own original wiring. Confirms this file's own
// "recurring miss" risk is real, not hypothetical — re-check this list
// every time `recognizers/types.ts`'s `RecognizerId` union grows, don't
// assume a prior pass already caught it.
//
// `'putCounterTarget-effect-structural'`/`'addMana-effect-structural'`
// (11th-12th recognizers) added 2026-09-14, same pass as their own wiring.
//
// `'putCounterSelf-effect-structural'`/`'putCounterMagnitude-clause-
// structural'` (13th-14th recognizers) added 2026-09-14, same pass as their
// own wiring — Aerith Gainsborough's own last 2 remaining unprovenanced
// facts.
//
// `'permanent-enters-battlefield-normally'` REMOVED (2026-09-14, `engine`
// agent) — the recognizer itself was retired the same day
// (`functional-model/synergy.ts`'s `isNormalPermanent` doc comment has the
// full reasoning): its whole job is now synthesized at match time, never
// stored as a `Fact.provenance.rule` value, so `RecognizerId` itself no
// longer has this member and this mirror can't compile with it either.
// `engine` removed this one line directly (same "small, mechanical,
// blocking, card-owned file" precedent the `destroy-effect-structural`
// miss above already established) rather than leave `nuxt typecheck` red;
// no other change to this route.
//
// `'instant-sorcery-resolves-to-graveyard'` REMOVED (2026-09-14, same day,
// `engine` agent, third instance of this exact pattern) — this recognizer
// was ALSO retired the same day (`functional-model/synergy.ts`'s
// `isNormalInstantOrSorcery` doc comment has the full reasoning): same
// "synthesized at match time, `RecognizerId` no longer has this member"
// situation as the removal immediately above, same direct fix for the
// same reason (this array's own declared `RecognizerId[]` type would
// otherwise fail to compile).
// `'landfall-trigger-structural'`/`'flashback-alternateCost-structural'`/
// `'gainLife-effect-structural'`/`'ptFormula-scalingPump-structural'`/
// `'digReveal-effect-structural'`/`'triggerDoubling-selfAndAttachedEquipment-
// structural'` (15th-20th recognizers) added 2026-09-14, same pass as their
// own wiring — the fin/3-10 mechanization pass.
export const RECOGNIZER_IDS: RecognizerId[] = [
  'destroy-effect-structural',
  'drawCard-effect-structural',
  'saga-lore-and-sacrifice-structural',
  'dies-trigger-structural',
  'lifegain-trigger-structural',
  'dealDamage-effect-structural',
  'putCounter-broadcast-structural',
  'attacks-trigger-structural',
  'putCounterTarget-effect-structural',
  'addMana-effect-structural',
  'putCounterSelf-effect-structural',
  'putCounterMagnitude-clause-structural',
  'landfall-trigger-structural',
  'flashback-alternateCost-structural',
  'gainLife-effect-structural',
  'ptFormula-scalingPump-structural',
  'digReveal-effect-structural',
  'triggerDoubling-selfAndAttachedEquipment-structural',
];

export default defineEventHandler((event) => {
  const rule = getRouterParam(event, 'rule');
  if (!rule || !RECOGNIZER_IDS.includes(rule as RecognizerId)) {
    throw createError({ statusCode: 404, statusMessage: 'Unknown recognizer' });
  }
  const filePath = join(process.cwd(), 'functional-model', 'recognizers', `${rule}.ts`);
  if (!existsSync(filePath)) {
    throw createError({ statusCode: 404, statusMessage: 'Recognizer file missing on disk' });
  }
  const content = readFileSync(filePath, 'utf8');
  return { rule, content };
});
