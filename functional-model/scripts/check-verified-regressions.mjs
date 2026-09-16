// Regression guard for human-reviewed cards' own confirmed facts +
// annotatedNonFactSpans — see `.claude/contracts/card-schema.md`'s own
// "Verified-snapshot regression guard" section and
// `server/api/card/review-status.ts`'s own snapshot-capture comment (the
// moment a human flips a card's FACTS review ai->human, that route writes
// `cards/<slug>/verified-snapshot.json` off that card's THEN-current
// `synergy.json`, plus its `progress.json`'s own `annotatedNonFactSpans` if
// present). This script is the other half: real, physical structural
// diffing (deep equality, order-sensitive on the facts arrays — never an
// AI/semantic "looks the same" judgment) of every already-captured snapshot
// against that same card's CURRENT `synergy.json`/`progress.json`, so a
// later recognizer/definition/annotation change can never silently corrupt
// a card a human already confirmed as correct.
//
// Usage: node functional-model/scripts/check-verified-regressions.mjs
// (plain `node` — no TS/recognizer imports here, unlike most of this
// directory's other scripts, so no vite-node/tsx needed). Also wired as an
// automatic step at the end of `apply-recognizers.mjs`'s own run (full
// pool, regardless of what slugs that script itself was scoped to — this
// diffing is nearly free compared to real engine execution).
//
// A mismatch on a card whose `progress.json` `review` is STILL `'human'` is
// the "review resets on change" project rule's own physical backstop: this
// script AUTO-RESETS that field to `'regression'` right here (not just a
// report, and NOT to plain `'ai'` — see `card-status.ts`'s own header for
// the full `re-review`-bucket rationale) — any code path that changed a
// reviewed card's facts without remembering to flip the flag by hand gets
// caught and corrected automatically, not left to human judgment.
// `'regression'` is a THIRD, distinguishable `review` value from `'ai'`/
// `'human'` (2026-09-17): a card that regresses from a real, deliberate
// human confirmation must never silently look identical (bucket-wise) to a
// card nobody has ever reviewed at all. This is the ONLY code path in this
// whole pool that ever writes `'regression'` — no other script/route
// invents this value; a fresh human confirm (`server/api/card/review-
// status.ts`'s `field:'review', reviewed:true`) always transitions a
// `'regression'` card back to plain `'human'`, same as confirming a plain
// `'ai'` card.
//
// Exit code 1 if ANY snapshot mismatched (gate-able in CI / a manual
// pre-commit-style run), 0 if every snapshot still matches its card's
// current state. Pure diff primitives below (`deepEqual`/`diffFactList`/
// `diffSnapshot`) are unit-tested directly — see
// `functional-model/check-verified-regressions.test.ts`.

import { readFile, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const cardsDirUrl = new URL('../cards/', import.meta.url);

// ---- pure diff primitives ----

// Recursive structural equality — array order matters, object key order
// doesn't (a `synergy.json`/`progress.json` field object re-serialized with
// the same keys in a different order must never itself read as a
// regression).
export function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  const aKeys = Object.keys(a).sort();
  const bKeys = Object.keys(b).sort();
  if (aKeys.length !== bKeys.length) return false;
  for (let i = 0; i < aKeys.length; i++) {
    if (aKeys[i] !== bKeys[i]) return false;
    if (!deepEqual(a[aKeys[i]], b[bKeys[i]])) return false;
  }
  return true;
}

// Order-sensitive, index-aligned diff of two arrays of plain JSON facts/
// spans — "Facts stay text-ordered" (project convention) means a
// reordering IS a real regression, never noise, so this deliberately never
// tries to detect a reorder as a no-op via some by-identity re-matching;
// each index is compared straight across, a mismatched index is reported
// as 'changed' (or 'added'/'removed' past either array's own length).
export function diffFactList(oldList, newList) {
  const changes = [];
  const maxLen = Math.max(oldList.length, newList.length);
  for (let i = 0; i < maxLen; i++) {
    const oldItem = oldList[i];
    const newItem = newList[i];
    if (oldItem === undefined) changes.push({ index: i, kind: 'added', new: newItem });
    else if (newItem === undefined) changes.push({ index: i, kind: 'removed', old: oldItem });
    else if (!deepEqual(oldItem, newItem)) changes.push({ index: i, kind: 'changed', old: oldItem, new: newItem });
  }
  return changes;
}

// snapshot: { capturedAt, facts: { source, sink }, annotatedNonFactSpans? }
// current:  { facts: { source, sink }, annotatedNonFactSpans? }
export function diffSnapshot(snapshot, current) {
  const source = diffFactList(snapshot.facts?.source ?? [], current.facts?.source ?? []);
  const sink = diffFactList(snapshot.facts?.sink ?? [], current.facts?.sink ?? []);
  const annotatedNonFactSpans = diffFactList(snapshot.annotatedNonFactSpans ?? [], current.annotatedNonFactSpans ?? []);
  return {
    source,
    sink,
    annotatedNonFactSpans,
    matches: source.length === 0 && sink.length === 0 && annotatedNonFactSpans.length === 0,
  };
}

function formatFactChange(change) {
  const label = change.kind === 'added' ? 'ADDED' : change.kind === 'removed' ? 'REMOVED' : 'CHANGED';
  const lines = [`    [${change.index}] ${label}`];
  if ('old' in change) lines.push(`      old: ${JSON.stringify(change.old)}`);
  if ('new' in change) lines.push(`      new: ${JSON.stringify(change.new)}`);
  return lines.join('\n');
}

// ---- fs orchestration ----

async function loadJson(url) {
  try {
    return JSON.parse(await readFile(url, 'utf8'));
  } catch {
    return null;
  }
}

export async function checkAllVerifiedSnapshots({ log = console.log, warn = console.error } = {}) {
  const entries = await readdir(cardsDirUrl, { withFileTypes: true });
  const slugs = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  let checked = 0;
  const mismatchedSlugs = [];
  const resetSlugs = [];

  for (const slug of slugs) {
    const snapshot = await loadJson(new URL(`${slug}/verified-snapshot.json`, cardsDirUrl));
    if (!snapshot) continue; // no verified-snapshot.json for this card — nothing to guard yet
    checked++;

    const synergy = (await loadJson(new URL(`${slug}/synergy.json`, cardsDirUrl))) ?? {};
    const progressUrl = new URL(`${slug}/progress.json`, cardsDirUrl);
    const progress = (await loadJson(progressUrl)) ?? {};

    const current = {
      facts: { source: synergy.source ?? [], sink: synergy.sink ?? [] },
      annotatedNonFactSpans: progress.annotatedNonFactSpans,
    };
    const diff = diffSnapshot(snapshot, current);
    if (diff.matches) continue;

    mismatchedSlugs.push(slug);
    const stillHuman = progress.review === 'human';
    warn(
      `\n${stillHuman ? '*** SEVERE ***' : 'MISMATCH'} ${slug} — verified-snapshot.json no longer matches current synergy.json` +
        (stillHuman ? " (progress.json still says review:'human' on now-different content)" : ''),
    );
    if (diff.source.length > 0) {
      warn('  source facts:');
      for (const c of diff.source) warn(formatFactChange(c));
    }
    if (diff.sink.length > 0) {
      warn('  sink facts:');
      for (const c of diff.sink) warn(formatFactChange(c));
    }
    if (diff.annotatedNonFactSpans.length > 0) {
      warn('  annotatedNonFactSpans:');
      for (const c of diff.annotatedNonFactSpans) warn(formatFactChange(c));
    }

    if (stillHuman) {
      progress.review = 'regression';
      await writeFile(progressUrl, `${JSON.stringify(progress, null, 2)}\n`, 'utf8');
      resetSlugs.push(slug);
      warn(`  -> auto-reset ${slug}'s progress.json review: 'human' -> 'regression' (was confirmed, now drifted — needs another look)`);
    }
  }

  log(`\nChecked ${checked} verified-snapshot(s): ${mismatchedSlugs.length} mismatch(es), ${resetSlugs.length} card(s) auto-reset to review:'regression'.`);
  if (mismatchedSlugs.length === 0) {
    log("All verified snapshots still match their card's current facts.");
  } else {
    log(`Mismatched: ${mismatchedSlugs.join(', ')}`);
    if (resetSlugs.length > 0) log(`Auto-reset (were still review:'human'): ${resetSlugs.join(', ')}`);
  }

  return { checked, mismatchedSlugs, resetSlugs };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const { mismatchedSlugs } = await checkAllVerifiedSnapshots();
  if (mismatchedSlugs.length > 0) process.exitCode = 1;
}
