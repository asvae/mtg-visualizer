// Bakes `Fact.annotations` (synergy.ts's `AnnotationRef[]`) into a card's
// own `cards/<slug>/synergy.json`, computed ONCE here from that card's own
// `cards/<slug>/annotations-authoring.json` (`sourceText`/`highlight`/
// `anchor` per fact, positionally aligned with `synergy.json`'s own
// `source`/`sink` arrays — see synergy.ts's `FactAnnotationAuthoring`/
// `AnnotationAuthoringFile` doc comments for the exact shape and why this
// authoring data lives in a SEPARATE, never-served file rather than on the
// `Fact` object itself, 2026-09-11) against the card's REAL oracle text/type
// line — see synergy.ts's `computeFactAnnotations`/`AnnotationRef` doc
// comments for the matching logic and on-disk indexing convention this
// reuses/produces. This is the generation step `.claude/contracts/
// card-schema.md`'s engine↔card boundary refers to: the served
// `annotatedCard.faces[].oracleText` is now a plain, unprocessed string
// (card-agent-owned, `server/api/card/[set]/[number].ts`) — nothing
// recomputes annotations live anymore, per the user's own framing ("card
// text won't ever change, so we can attach to it specifically").
//
// Real oracle text comes from the checked-in `data/<set>/<set>_scryfall.json`
// files (NOT `dist/`, a generated build copy) — the same real-card-data
// source `scenario-card-names.mjs` already reads from, excluding
// `*_tokens_scryfall.json` (a different Scryfall card space). Real type line
// text comes straight off the already-imported `CardDefinition`
// (`card.typeLine`/`card.backFace.typeLine`) — this project's own "static
// `CardDefinition` fields mirror real Scryfall data verbatim" convention
// already guarantees it's the real printed type line, no second data load
// needed. A card's own `Fact.face` ('front'/'back'/omitted) selects which
// face's text a fact is matched against, mirroring `card_faces?.length ?
// card_faces : [card]` — the same face-ordering convention `server/api/card/
// [set]/[number].ts` already uses when building its own `FaceInput[]`.
//
// Usage: npx vite-node functional-model/scripts/compute-annotations.mjs <slug> [<slug> ...]
//        npx vite-node functional-model/scripts/compute-annotations.mjs         (whole pool)
//
// Scoped to summon-bahamut only as of 2026-09-11 (explicit user instruction,
// not a technical limit of this script) — running it against the rest of the
// pool is a separate, later decision; this script itself is written to
// generalize to that when it happens. A card with no `annotations-authoring
// .json` at all is silently skipped (nothing to compute), same as a card
// with no synergy.json.

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { computeFactAnnotations } from '../synergy.ts';

const cardsDir = new URL('../cards/', import.meta.url);
const dataDir = new URL('../../data/', import.meta.url);

/**
 * name -> { front: oracleText, back?: oracleText } for every real card
 * across every `data/<set>/<set>_scryfall.json` (front = `card_faces[0]` for
 * a multi-faced card, else the card's own top-level `oracle_text`; back =
 * `card_faces[1]`, when present). Keyed by the COMBINED name (Scryfall's own
 * `name` field, e.g. "Front // Back") since that's what a card's own
 * `definition.ts.name` carries — matches this project's own settled "card
 * identity key is Scryfall name" convention.
 */
async function loadOracleTextByName() {
  const byName = new Map();
  const setDirs = await readdir(dataDir, { withFileTypes: true }).catch(() => []);
  for (const dirent of setDirs) {
    if (!dirent.isDirectory()) continue;
    const setDir = new URL(`${dirent.name}/`, dataDir);
    const files = await readdir(setDir, { withFileTypes: true }).catch(() => []);
    for (const file of files) {
      if (!file.isFile()) continue;
      if (!file.name.endsWith('_scryfall.json') || file.name.endsWith('_tokens_scryfall.json')) continue;
      const raw = await readFile(new URL(file.name, setDir), 'utf8').catch(() => null);
      if (!raw) continue;
      let cards;
      try {
        cards = JSON.parse(raw);
      } catch {
        continue;
      }
      if (!Array.isArray(cards)) continue;
      for (const card of cards) {
        if (typeof card?.name !== 'string') continue;
        if (Array.isArray(card.card_faces) && card.card_faces.length > 0) {
          byName.set(card.name, {
            front: card.card_faces[0]?.oracle_text,
            back: card.card_faces[1]?.oracle_text,
          });
        } else if (typeof card.oracle_text === 'string') {
          byName.set(card.name, { front: card.oracle_text });
        }
      }
    }
  }
  return byName;
}

function isV2Shaped(synergy) {
  const all = [...(synergy.source ?? []), ...(synergy.sink ?? [])];
  return all.length > 0 && all.every((f) => typeof f === 'object' && f !== null && ('zone' in f || 'to' in f || 'from' in f || 'event' in f));
}

async function main() {
  const requested = process.argv.slice(2);
  const allSlugs = (await readdir(cardsDir, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name);
  const slugs = requested.length > 0 ? requested : allSlugs;
  const oracleByName = await loadOracleTextByName();

  let written = 0;
  let annotated = 0;
  let skippedNoOracle = 0;
  let skippedNoAuthoring = 0;
  for (const slug of slugs) {
    const synergyUrl = new URL(`${slug}/synergy.json`, cardsDir);
    let raw;
    try {
      raw = JSON.parse(await readFile(synergyUrl, 'utf8'));
    } catch {
      continue;
    }
    if (!isV2Shaped(raw)) continue;

    const authoringUrl = new URL(`${slug}/annotations-authoring.json`, cardsDir);
    let authoring;
    try {
      authoring = JSON.parse(await readFile(authoringUrl, 'utf8'));
    } catch {
      skippedNoAuthoring++;
      continue; // no annotations-authoring.json for this card yet — nothing to compute
    }

    let card;
    try {
      const mod = await import(new URL(`${slug}/definition.ts`, cardsDir).href);
      card = Object.values(mod)[0];
    } catch {
      continue;
    }
    if (!card?.name) continue;
    // A transforming/two-faced `CardDefinition.name` is only the FRONT
    // face's own printed name (every real DFC definition.ts in this pool —
    // Jill/Shiva, Jecht/Braska, Clive/Ifrit, Dion/Bahamut — sets `name` to
    // just its own face and `backFace.name` separately, never a combined
    // string), but `loadOracleTextByName` keys its map by Scryfall's own
    // top-level `name` field, which for a two-faced card IS the combined
    // "Front // Back" string (`card_faces[0].name + ' // ' + card_faces[1]
    // .name`, Scryfall's own convention) — a real, previously-unhit lookup
    // gap surfaced by this card being the first two-faced card run through
    // this script. Reconstruct the same combined key when `backFace` is
    // present rather than changing what `definition.ts.name` means
    // pool-wide.
    const lookupName = card.backFace?.name ? `${card.name} // ${card.backFace.name}` : card.name;
    const oracle = oracleByName.get(lookupName);
    if (!oracle) {
      skippedNoOracle++;
      console.log(`skip ${slug}: no real oracle text found for "${lookupName}" in data/*/*_scryfall.json`);
      continue;
    }

    const annotateArray = (arr, authoringArr) =>
      (arr ?? []).map((fact, index) => {
        const face = fact.face ?? 'front';
        const oracleText = face === 'back' ? oracle.back : oracle.front;
        const typeLine = face === 'back' ? card.backFace?.typeLine : card.typeLine;
        const entry = (authoringArr ?? [])[index] ?? null;
        const annotations = computeFactAnnotations({ oracle: oracleText, typeLine }, entry);
        if (!annotations) return fact;
        annotated++;
        return { ...fact, annotations };
      });

    const out = { source: annotateArray(raw.source, authoring.source), sink: annotateArray(raw.sink, authoring.sink) };
    await writeFile(synergyUrl, JSON.stringify(out, null, 2) + '\n', 'utf8');
    written++;
    console.log(`${slug}: annotated`);
  }
  console.log(
    `wrote ${written} synergy.json files, ${annotated} facts annotated, ${skippedNoOracle} card(s) skipped (no real oracle text found), ${skippedNoAuthoring} card(s) skipped (no annotations-authoring.json yet).`,
  );
}

main();
