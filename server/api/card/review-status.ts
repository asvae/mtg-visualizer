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
// POST /api/card/review-status, body { name: string, field: 'review' | 'scenariosReview' | 'interactionsReview', reviewed: boolean, set?: string, number?: string }
//
// `set`/`number` are only used for the `review` axis (FACTS review — see
// below) — the calling UI is always the card page at that exact
// /app/card/:set/:number route, so it already has both to hand
// (route.params) rather than this route needing its own by-name search
// across every set.

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { slugify } from '../../../app/lib/buildGraph';

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
  progress[field] = reviewed ? reviewedValue : unreviewedValue;

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

  return { [field]: progress[field] };
});
