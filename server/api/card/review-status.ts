// Writes cards/<slug>/progress.json's own `review`/`scenariosReview`/
// `interactionsReview` fields — three SEPARATE axes: `review` is the
// synergy.json FACTS review (the original, pre-existing field — 'ai' vs
// 'human'), `scenariosReview`/`interactionsReview` are "has a human actually
// looked at [the Scenarios tab's own replay content / this card's own
// Interactions list] and confirmed it's correct" ('draft' vs 'reviewed').
// The card page shows each via an orange "Draft" pill (server/api/card/
// [set]/[number].ts's own fields of the same name) plus a button here to
// flip it. One endpoint, `field` says which axis — kept to this exact
// allow-list so the request body can't write an arbitrary progress.json key.
//
// Dev-only — this writes to the repo's own functional-model/ source tree,
// not a database; there's no real "reviewed by whom, when" audit trail, and
// in a real production deployment this would either silently no-op (a
// serverless function's filesystem isn't the repo checkout) or, worse on a
// host where it DOES have a writable filesystem, let any visitor flip any
// card's review status. Refused outright outside dev, same
// `NODE_ENV === 'production'` check this same route family already uses
// (server/api/card/[set]/[number].ts's own `loadJsonFresh`).
//
// POST /api/card/review-status, body { name: string, field: 'review' | 'scenariosReview' | 'interactionsReview', reviewed: boolean, set?: string, number?: string, reviewCaveat?: string }
//
// `set`/`number` are only used for the `review` axis (FACTS review — see
// below) — the calling UI is always the card page at that exact
// /app/card/:set/:number route, so it already has both to hand
// (route.params) rather than this route needing its own by-name search
// across every set.
//
// `reviewCaveat` (2026-09-17, "Confirm (Uncertain)" UI action) — ONLY
// meaningful when `field === 'review'` and `reviewed === true`; ignored
// entirely for the other two axes and for `reviewed === false` (Unconfirm
// leaves a card's `reviewCaveat` untouched, same "un-reviewing doesn't erase
// evidence of prior review" reasoning the pre-existing `oracleTextSnapshot`
// field below already follows). See `functional-model/card-status.ts`'s own
// `uncertain`-bucket header for what this field MEANS (a human-authored,
// free-text note for "facts are as complete as they can be, but here's one
// specific known conceptual modeling gap") — this route only handles
// REACHING that state via a real request, not the classification itself.
//
// - Non-empty (after trim): written to `progress.json.reviewCaveat`
//   (`review` is still set to `'human'`, unchanged — an "uncertain confirm"
//   IS a real review pass, just with a caveat attached, never a weaker kind
//   of confirm).
// - Omitted/empty on a PLAIN confirm click (the pre-existing button, body
//   simply has no `reviewCaveat` key at all): if this card previously had a
//   `reviewCaveat` set, it is CLEARED — a plain "yes, this is clean" confirm
//   supersedes a stale caveat claim (the caveat was about a PRIOR review
//   pass; a fresh clean one says nothing like it remains). Confirmed this
//   can't create some other inconsistency: `functional-model/card-status.ts`'s
//   own `classifyCardStatus` and `scripts/check-verified-regressions.mjs`
//   both only ever READ `reviewCaveat` (never write it, never diff it into
//   the verified-snapshot regression check below) — clearing it here has no
//   knock-on effect on either.

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { DatabaseSync } from 'node:sqlite';
import { slugify } from '../../../app/lib/buildGraph';
import { cardStatusBaseline } from '../../../functional-model/card-status';
import type { CardStatusEntry } from '../../../functional-model/card-status';

// Confirm-eligibility gate (2026-09-18) — "confirm/reject only meaningful at
// blue/re-review" (see `.claude/contracts/engine-status-schema.md`/
// `sink-derivation-status-schema.md`'s own identical rule for their axes):
// a FACTS "Confirm"/"Confirm (Uncertain)" click on this card is semantically
// meaningless unless the card's CURRENT (pre-write) fact-authoring
// completeness has actually reached the shared `blue` baseline (this axis's
// own `functional-model/card-status.ts` `cardStatusBaseline` fold — `blue`
// covers `green`/`verified`/`uncertain`/`re-review`, all of which require
// the underlying 8-bucket classifier to have reached full, provenance-clean,
// fully-text-covered completeness at least once; `gray`/`purple` never do).
// Reuses the exact same live single-card classification
// `server/api/card/[set]/[number].ts`'s own `computeCardStatusLive` already
// spawns for its per-request `cardStatus` badge (`functional-model/scripts/
// compute-one-card-status.mjs` under vite-node — see that route's own
// comment for why this needs a subprocess rather than an in-process import).
// There is no separate "reject" verdict on this axis (FIN's own review model
// only has Confirm/Unconfirm/"Confirm (Uncertain)", no distinct rejection
// action) — only the CONFIRM path (`reviewed === true`) is gated; Unconfirm
// (`reviewed === false`) always succeeds unconditionally, same as clearing a
// review on the other two axes.
const execFileAsync = promisify(execFile);
async function computeCurrentCardStatusBaseline(slug: string, number: string): Promise<'gray' | 'purple' | 'blue' | null> {
  try {
    const { stdout } = await execFileAsync(join(process.cwd(), 'node_modules/.bin/vite-node'), [
      join(process.cwd(), 'functional-model/scripts/compute-one-card-status.mjs'),
      slug,
      number,
    ]);
    const entry = JSON.parse(stdout) as CardStatusEntry;
    return cardStatusBaseline(entry.status);
  } catch {
    return null;
  }
}

// Snapshotting real oracle text at the moment a human confirms the FACTS
// review (`field === 'review'`, `reviewed === true`) — baked
// `Fact.annotations` (see .claude/contracts/card-schema.md's "Fact-to-oracle-
// text pointers" section) point at line/char offsets into a card's real
// Scryfall oracle text, computed once, offline. Nothing re-validates those
// offsets live anymore, so if Scryfall's own text for this printing is ever
// corrected after a human reviewed it (errata, a re-scrape fixing a typo),
// the baked offsets could silently drift. This snapshot is the baseline a
// later (not-yet-built) staleness check can diff the live text against.
//
// Same local-DB-first, then live-Scryfall lookup convention
// server/api/card/[set]/[number].ts's own lookupCardBySetNumber already
// uses — a small, deliberate duplicate here (this route only needs the
// read-only single-card case, not that route's token/interaction/relations
// machinery) rather than importing an unexported helper out of that file.
const CARDS_DB_PATH = join(process.cwd(), 'data', 'cards.db');
const cardsDb = existsSync(CARDS_DB_PATH) ? new DatabaseSync(CARDS_DB_PATH, { readOnly: true }) : null;
const dbBySetNumberStmt = cardsDb?.prepare('SELECT raw_json FROM cards WHERE set_code = ? AND collector_number = ?') ?? null;

interface OracleScryfallCard {
  oracle_text?: string;
  card_faces?: { oracle_text?: string }[];
}

async function lookupOracleCard(set: string, number: string): Promise<OracleScryfallCard | null> {
  if (dbBySetNumberStmt) {
    const row = dbBySetNumberStmt.get(set, number) as { raw_json: string } | undefined;
    if (row) return JSON.parse(row.raw_json);
  }
  try {
    const res = await fetch(`https://api.scryfall.com/cards/${encodeURIComponent(set)}/${encodeURIComponent(number)}`, {
      headers: { 'User-Agent': 'mtg-visualizer/0.1', Accept: 'application/json' },
    });
    if (!res.ok) return null;
    return (await res.json()) as OracleScryfallCard;
  } catch {
    return null;
  }
}

// Matches Fact.face's own 'front'|'back' vocabulary
// (functional-model/synergy.ts) — a single-faced card's snapshot is a bare
// string, a DFC's is this shape. Only ever written, never read back by this
// route (the staleness-diff itself is a separate, not-yet-built feature).
type OracleTextSnapshot = string | { front: string; back?: string };

function oracleTextSnapshotFor(card: OracleScryfallCard): OracleTextSnapshot | null {
  if (card.card_faces && card.card_faces.length > 0) {
    const front = card.card_faces[0]?.oracle_text;
    if (!front) return null;
    const back = card.card_faces[1]?.oracle_text;
    return back ? { front, back } : { front };
  }
  return card.oracle_text ?? null;
}

// Each field's own two on-disk values — `review` predates the other two and
// kept its original 'ai'/'human' vocabulary rather than being migrated to
// 'draft'/'reviewed' just for consistency.
const REVIEW_FIELD_VALUES: Record<string, [unreviewed: string, reviewed: string]> = {
  review: ['ai', 'human'],
  scenariosReview: ['draft', 'reviewed'],
  interactionsReview: ['draft', 'reviewed'],
};

export default defineEventHandler(async (event) => {
  if (process.env.NODE_ENV === 'production') {
    setResponseStatus(event, 403);
    return { error: 'review-status is dev-only' };
  }

  const body = await readBody(event).catch(() => null);
  const name: string | undefined = body?.name;
  const field: string | undefined = body?.field;
  const reviewed: boolean | undefined = body?.reviewed;
  if (!name || !field || !(field in REVIEW_FIELD_VALUES) || typeof reviewed !== 'boolean') {
    setResponseStatus(event, 400);
    return { error: `missing/invalid "name" (string), "field" (one of ${Object.keys(REVIEW_FIELD_VALUES).join(', ')}), or "reviewed" (boolean) in request body` };
  }

  const slug = slugify(name);
  const dir = join(process.cwd(), 'functional-model/cards', slug);
  if (!existsSync(dir)) {
    setResponseStatus(event, 404);
    return { error: `no functional-model card directory for "${name}" (slug "${slug}")` };
  }

  // Confirm-eligibility gate — see this file's own header comment on
  // `computeCurrentCardStatusBaseline` for the full rationale. Only the
  // `field === 'review'`, `reviewed === true` path (Confirm / "Confirm
  // (Uncertain)") is gated; Unconfirm and the other two review axes
  // (`scenariosReview`/`interactionsReview`, unrelated to this shared
  // gray/purple/blue/yellow/green axis) are never gated.
  if (field === 'review' && reviewed === true) {
    const numberForGate: string = typeof body?.number === 'string' ? body.number : '';
    const currentBaseline = await computeCurrentCardStatusBaseline(slug, numberForGate);
    if (currentBaseline === null || currentBaseline === 'gray' || currentBaseline === 'purple') {
      setResponseStatus(event, 400);
      return {
        error:
          `"${name}" is currently ${currentBaseline ?? 'unknown (status could not be computed)'}, not blue (or a stale, ` +
          `drifted re-review) — confirming this card's facts review is only meaningful once its fact-authoring has ` +
          `actually reached the fully-covered baseline`,
      };
    }
  }

  const progressPath = join(dir, 'progress.json');

  // Merge onto whatever's already there (enrichment/review/notes/knownGaps/
  // ...) rather than replacing the file — this endpoint owns exactly the
  // one field named by `field`, same "additive, don't clobber a
  // hand-authored file" discipline the rest of this session's
  // functional-model edits have followed.
  let progress: Record<string, unknown> = {};
  if (existsSync(progressPath)) {
    try {
      progress = JSON.parse(readFileSync(progressPath, 'utf8'));
    } catch {
      // malformed progress.json — overwritten below with just this field,
      // same as a missing one; better than refusing to record the review.
    }
  }
  const [unreviewedValue, reviewedValue] = REVIEW_FIELD_VALUES[field]!;
  const previousFieldValue = progress[field];
  progress[field] = reviewed ? reviewedValue : unreviewedValue;

  // `reviewCaveat` — only the `review` axis has one; see this file's own
  // header comment above for the full plain-confirm-clears-it /
  // uncertain-confirm-writes-it contract. `caveatChanged` feeds the
  // widened snapshot condition immediately below: a caveat being added,
  // edited, or cleared is just as much a deliberate "I looked at this card
  // RIGHT NOW" moment as a fresh ai/regression -> human transition is, even
  // when `review` itself was already `'human'` going in (e.g. an
  // "Uncertain confirm" click on an already-verified card, or a plain
  // confirm click that clears an old caveat off an already-uncertain one)
  // — so it must re-baseline the verified-snapshot the exact same way.
  let caveatChanged = false;
  if (field === 'review' && reviewed) {
    const previousCaveat = typeof progress.reviewCaveat === 'string' ? progress.reviewCaveat : undefined;
    const rawCaveat: unknown = body?.reviewCaveat;
    const trimmedCaveat = typeof rawCaveat === 'string' ? rawCaveat.trim() : undefined;
    const nextCaveat = trimmedCaveat && trimmedCaveat.length > 0 ? trimmedCaveat : undefined;
    if (nextCaveat) {
      progress.reviewCaveat = nextCaveat;
    } else if ('reviewCaveat' in progress) {
      delete progress.reviewCaveat;
    }
    caveatChanged = (previousCaveat ?? '') !== (nextCaveat ?? '');
  }
  // `reviewed === false` (Unconfirm): `reviewCaveat` deliberately left
  // untouched, same "un-reviewing doesn't erase evidence of prior review"
  // reasoning as `oracleTextSnapshot` below.

  // Verified-snapshot regression guard (`.claude/contracts/card-schema.md`'s
  // own "Verified snapshot regression guard" section,
  // `functional-model/scripts/check-verified-regressions.mjs` is the other
  // half) — the moment a human confirms this card's FACTS review, freeze
  // this card's current `synergy.json` facts (+ its `progress.json`'s own
  // `annotatedNonFactSpans`, if any) into `cards/<slug>/
  // verified-snapshot.json`. A later recognizer/definition/annotation change
  // that silently drifts a reviewed card's facts away from this frozen
  // baseline gets caught (and the stale 'human' flag auto-reset) by that
  // script, not by hoping someone remembers to re-review by hand.
  //
  // Widened condition (2026-09-17, "Confirm (Uncertain)" UI action) — not
  // JUST a real 'ai'/'regression' -> 'human' transition anymore
  // (`previousFieldValue !== 'human'`), but ALSO any request where this
  // card's `reviewCaveat` itself changed (`caveatChanged`, above) even when
  // `review` was already `'human'` going in. Both are the same underlying
  // event: a human deliberately re-affirming (or downgrading the confidence
  // of) this exact review right now — an "Uncertain confirm" click on an
  // already-verified card, or a plain confirm that clears a stale caveat off
  // an already-uncertain one, is exactly the moment to freshen the baseline,
  // not a no-op re-POST of an unchanged value (which still correctly skips
  // the snapshot, same as before this widening).
  if (field === 'review' && reviewed && (previousFieldValue !== 'human' || caveatChanged)) {
    const synergyPath = join(dir, 'synergy.json');
    if (existsSync(synergyPath)) {
      try {
        const synergy = JSON.parse(readFileSync(synergyPath, 'utf8'));
        const verifiedSnapshot: Record<string, unknown> = {
          capturedAt: new Date().toISOString(),
          facts: { source: synergy.source ?? [], sink: synergy.sink ?? [] },
        };
        if (Array.isArray(progress.annotatedNonFactSpans)) {
          verifiedSnapshot.annotatedNonFactSpans = progress.annotatedNonFactSpans;
        }
        writeFileSync(join(dir, 'verified-snapshot.json'), JSON.stringify(verifiedSnapshot, null, 2) + '\n', 'utf8');
      } catch {
        // malformed synergy.json — skip the snapshot rather than fail the
        // whole review-status write; this card just won't be covered by the
        // regression guard until its synergy.json is valid and it's
        // re-reviewed.
      }
    }
  }

  // Snapshot on every confirm (not just the first), so re-reviewing after a
  // fix re-baselines the staleness check too. Un-reviewing (`reviewed ===
  // false`) deliberately leaves a prior snapshot in place untouched — there's
  // no clear reason a flip back to 'ai' should erase evidence of what was
  // last actually reviewed.
  if (field === 'review' && reviewed) {
    const set: string | undefined = body?.set;
    const number: string | undefined = body?.number;
    if (set && number) {
      const oracleCard = await lookupOracleCard(set, number);
      const snapshot = oracleCard ? oracleTextSnapshotFor(oracleCard) : null;
      if (snapshot) {
        progress.oracleTextSnapshot = snapshot;
        progress.reviewedAt = new Date().toISOString().slice(0, 10);
      }
    }
  }

  mkdirSync(dir, { recursive: true });
  writeFileSync(progressPath, JSON.stringify(progress, null, 2) + '\n', 'utf8');

  // Echo the current `reviewCaveat` back alongside `review` (only that axis
  // has one) — lets the caller reconcile its own local state (e.g. pre-fill
  // the "Confirm (Uncertain)" prompt on a later click) without a second
  // round trip. `null`, not `undefined`, when absent (JSON-safe, and matches
  // this route family's existing "explicit null over undefined" convention
  // for optional fields elsewhere in this codebase).
  const responseBody: Record<string, unknown> = { [field]: progress[field] };
  if (field === 'review') {
    responseBody.reviewCaveat = typeof progress.reviewCaveat === 'string' ? progress.reviewCaveat : null;
  }
  return responseBody;
});
