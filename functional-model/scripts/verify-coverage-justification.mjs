// The real fs/CLI orchestration around `coverage-justification.ts`'s own
// pure `validateCoverageJustification` — mirrors `validate-card-
// definition.mjs`'s own "reusable, not just a CLI" split (see that file's
// own header for the full rationale, including why the reusable export and
// the CLI entry point must live in TWO separate files under `vite-node`).
// `verifyCoverageJustificationForSlug` below is the real, importable entry
// point `validate-card-definition.mjs`'s own gate (Part 1.5) calls; the
// sibling `verify-coverage-justification-cli.mjs` is the standalone CLI.
//
// ## Where the real ground-truth oracle text comes from
//
// `data/fdn/fdn_scryfall.json` — a durable, CHECKED-IN subset extract of
// real Scryfall card data for every FDN card that has actually entered the
// authoring pipeline (see `sync-fdn-oracle-text.mjs`'s own header for how
// it's populated/kept current, and why it's a checked-in file rather than
// the gitignored `.fdn-scratch/<slug>/scryfall.json` per-card cache several
// earlier gap-closing passes used ad hoc, or the gitignored, 600MB
// `data/cards.db` bulk sync those scratch caches themselves were pulled
// from). Mirrors FIN's own real `data/fin/fin_scryfall.json` precedent
// exactly — same shape (a plain array of raw Scryfall card objects), same
// "real printed data, tracked in git, never live-recomputed at
// verification/gate time" posture. A card with no entry there yet is a
// real, actionable, loud failure here (never silently skipped) — see
// `resolveJustificationTexts`'s own doc comment below.
//
// `type_line` comes straight off the already-imported `CardDefinition`
// itself (`card.typeLine`/`card.backFace.typeLine`) — same "this project's
// own 'static CardDefinition fields mirror real Scryfall data verbatim'
// convention already guarantees it's the real printed type line, no second
// data source needed" reasoning `compute-annotations.mjs`'s own header
// already establishes for the identical FIN-side case.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { validateCoverageJustification } from '../coverage-justification.ts';

/** name -> {front, back?} real oracle_text off the checked-in
 * `data/fdn/fdn_scryfall.json` — a DFC's own top-level Scryfall `name` is
 * the combined "Front // Back" string (same convention `compute-
 * annotations.mjs`'s own `loadOracleTextByName` already documents), so this
 * keys by that combined name directly, matching what `realCardName` in
 * `sync-fdn-oracle-text.mjs` writes. */
function loadFdnOracleTextByName(root) {
  const path = join(root, 'data', 'fdn', 'fdn_scryfall.json');
  const byName = new Map();
  if (!existsSync(path)) return byName;
  let cards;
  try {
    cards = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return byName;
  }
  if (!Array.isArray(cards)) return byName;
  for (const card of cards) {
    if (typeof card?.name !== 'string') continue;
    if (Array.isArray(card.card_faces) && card.card_faces.length > 0) {
      byName.set(card.name, { front: card.card_faces[0]?.oracle_text, back: card.card_faces[1]?.oracle_text });
    } else if (typeof card.oracle_text === 'string') {
      byName.set(card.name, { front: card.oracle_text });
    }
  }
  return byName;
}

/**
 * Resolves the real `JustificationTexts` shape `validateCoverageJustification`
 * needs for `definition` — `oracle_text` from the checked-in
 * `data/fdn/fdn_scryfall.json` (see this file's own header for why), plus
 * `type_line` straight off `definition.typeLine`/`.backFace.typeLine`.
 * `oracle_text` legitimately comes back `undefined` for a face when the
 * real card isn't found in `fdn_scryfall.json` at all yet — the pure
 * validator itself is what turns that into a real, loud, per-entry failure
 * (only if a real entry actually CLAIMS that (face, textLocation) — a card
 * with zero `oracle_text` entries on some face it doesn't need would never
 * hit this at all), not this resolver.
 */
export function resolveJustificationTexts(root, definition) {
  const oracleByName = loadFdnOracleTextByName(root);
  const lookupName = definition.backFace?.name ? `${definition.name} // ${definition.backFace.name}` : definition.name;
  const oracle = oracleByName.get(lookupName);
  const texts = {
    front: { oracle_text: oracle?.front, type_line: definition.typeLine },
  };
  if (definition.backFace) {
    texts.back = { oracle_text: oracle?.back, type_line: definition.backFace.typeLine };
  }
  return texts;
}

/**
 * The real, full check for one card — `definitionPath` may be absolute or
 * `root`-relative (same path-agnostic convention `validate-card-
 * definition.mjs`'s own `validateCardDefinition` already follows, so a test
 * can point this at an arbitrary throwaway fixture directory). Looks for a
 * sibling `justification.json` next to `definitionPath` itself (NOT
 * hardcoded to `fdn-cards/<slug>/` — same reasoning). Returns
 * `{ok, reasons}` — never throws (mirrors `validateCoverageJustification`'s
 * own "never throws" contract; every input here is either a real,
 * already-imported plain object or a real, already-`existsSync`-checked
 * file read).
 */
export async function verifyCoverageJustificationForPath(definition, definitionPath, root = process.cwd()) {
  // `resolve(root, definitionPath)` is a no-op when `definitionPath` is
  // already absolute (node:path's own documented behavior) — correctly
  // handles both the common absolute case (validate-card-definition.mjs's
  // own caller) and a root-relative one (a test fixture) uniformly.
  const absDefinitionPath = resolve(root, definitionPath);
  const justificationPath = join(dirname(absDefinitionPath), 'justification.json');

  let entries = null;
  if (existsSync(justificationPath)) {
    try {
      entries = JSON.parse(readFileSync(justificationPath, 'utf8'));
    } catch (err) {
      return { ok: false, reasons: [`justification.json at ${justificationPath} failed to parse: ${err instanceof Error ? err.message : String(err)}`] };
    }
  }

  const texts = resolveJustificationTexts(root, definition);
  return validateCoverageJustification(definition, entries, texts);
}

/** Convenience wrapper for the common `functional-model/fdn-cards/<slug>/`
 * case (dynamic-imports `definition.ts` itself) — the real CLI's own entry
 * point. */
export async function verifyCoverageJustificationForSlug(slug, root = process.cwd()) {
  const definitionPath = join(root, 'functional-model', 'fdn-cards', slug, 'definition.ts');
  if (!existsSync(definitionPath)) {
    return { ok: false, reasons: [`no file at ${definitionPath}`] };
  }
  const mod = await import(new URL(`file://${definitionPath}`).href);
  const definition = Object.values(mod).find((v) => v && typeof v === 'object' && typeof v.name === 'string');
  if (!definition) {
    return { ok: false, reasons: [`no CardDefinition-shaped export found in ${definitionPath}`] };
  }
  return verifyCoverageJustificationForPath(definition, definitionPath, root);
}
