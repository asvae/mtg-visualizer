// Enforces a real hard invariant (2026-09-11, explicit user ask): every fact
// on a card that has opted into the `Fact.annotations` model must carry at
// least one real, computed `annotations` entry — "no annotation if undefined
// should be a thing" is no longer allowed to be true by mere convention, it
// has to be a checked rule. Direct follow-up to the same-day `Fact.id`
// removal and the `annotations`-becomes-required schema change in
// `synergy.ts` — see that file's own `Fact.annotations`/`AnnotationRef` doc
// comments for the full rationale (including WHY a fact with truly nothing
// real to anchor to should be removed/folded rather than force-annotated).
//
// Scope, deliberately narrow — mirrors `scenario-card-names.mjs`'s own
// "small stable duplicate, grow only when forced" shape:
//   - `ANNOTATED_CARD_SLUGS` is a small, explicit allowlist of cards that
//     have actually been run through `scripts/compute-annotations.mjs` and
//     are expected to carry real annotations on EVERY fact — today just
//     `summon-bahamut` (fin/1). The other ~300 pool cards have not opted
//     into this model yet (their `synergy.json` facts have no `annotations`
//     field at all) and are NOT held to this check — failing all of them for
//     a field that was never required for them would be exactly the kind of
//     "fail every unmigrated card" mistake the task that added this check
//     explicitly warned against.
//   - Grow this set only when a real card is actually run through
//     `compute-annotations.mjs` and its own synergy.json is meant to fully
//     comply going forward — not speculatively.
//
// Usage: node functional-model/scripts/verify-annotation-coverage.mjs
// (this file is the shared logic; that one is the CLI wrapper +
// `functional-model/annotation-coverage.test.ts` is the version wired into
// `npm run test`, same three-file shape `scenario-card-names.mjs` already
// established.)

import { readFile } from 'node:fs/promises';

export const ANNOTATED_CARD_SLUGS = new Set([
  'summon-bahamut',
  'ultima-origin-of-oblivion',
  'adelbert-steiner',
  'aerith-rescue-mission',
  'aerith-gainsborough',
  'battle-menu',
  'cloud-midgar-mercenary',
  'ambrosia-whiteheart',
  'ashe-princess-of-dalmasca',
  'auron-s-inspiration',
  'the-crystal-s-chosen',
  'coeurl',
  'cloudbound-moogle',
  'from-father-to-son',
  'dwarven-castle-guard',
  'delivery-moogle',
  'fate-of-the-sun-cryst',
  'dragoon-s-lance',
  'dion-bahamut-s-dominant-bahamut-warden-of-light',
  'crystal-fragments-summon-alexander',
  'gaelicat',
  'machinist-s-arsenal',
  'minwu-white-mage',
  'paladin-s-arms',
  'moogles-valor',
  'g-raha-tia',
  'snow-villiers',
  'slash-of-light',
  'sidequest-catch-a-fish-cooking-campsite',
  'ultima',
  'magitek-armor',
  'summon-choco-mog',
  'restoration-magic',
  'magitek-infantry',
  'summon-primal-garuda',
  'stiltzkin-moogle-merchant',
  'phoenix-down',
  'weapons-vendor',
  'summon-knights-of-round',
  'venat-heart-of-hydaelyn-hydaelyn-the-mothercrystal',
]);

/**
 * Pure — no file I/O — so a test can hand it a synthetic, in-memory
 * `synergy`-shaped object (a fabricated zero-annotation fact) and confirm
 * the check actually has teeth, not just that it passes against the real,
 * already-fixed pool. Checks BOTH `source` and `sink` arrays; a fact
 * "missing annotations" means either the field is absent entirely (a fact
 * predating this card's own annotations pass, or one whose `sourceText`/
 * `highlight` never matched, silently tolerated) or present but empty (`[]`)
 * — both are equally violations of the "minimum one real entry" invariant.
 */
export function findMissingAnnotationsInSynergy(slug, synergy) {
  const violations = [];
  for (const role of ['source', 'sink']) {
    const facts = synergy?.[role] ?? [];
    facts.forEach((fact, index) => {
      if (!Array.isArray(fact?.annotations) || fact.annotations.length === 0) {
        violations.push({
          slug,
          role,
          index,
          // Best-effort human-readable label for the report — whichever of
          // these semantic fields the fact happens to declare. `sourceText`/
          // `highlight` are NOT served on a real `Fact` anymore (moved to
          // `annotations-authoring.json`, 2026-09-11 — see synergy.ts's
          // `FactAnnotationAuthoring` doc comment), so they're not part of
          // this fallback chain; kept generic (`event`/`zone`/`to`/`from`)
          // rather than importing `describeFact` from synergy.ts, since this
          // script stays plain-JS/no-TS-import on purpose (see this file's
          // own header).
          description: fact?.event ?? fact?.zone ?? fact?.to ?? fact?.from ?? '(no description)',
        });
      }
    });
  }
  return violations;
}

/**
 * The full check: every slug in `ANNOTATED_CARD_SLUGS` (or `slugs`, when the
 * caller wants to scope it further, e.g. to a `--slug=` filter), its real
 * on-disk `synergy.json`, run through `findMissingAnnotationsInSynergy`.
 * Returns a flat violation list (empty = every opted-in card is fully
 * annotated) — never throws/exits itself, so both the CLI wrapper and the
 * vitest test can decide how to report/fail. A slug with no synergy.json at
 * all yet is silently skipped here (nothing to check yet) rather than
 * reported as a violation — the same "skip, don't fail" treatment
 * `verify-synergy.mjs`'s own missing-file case gets.
 */
export async function findMissingAnnotations({ cardsDir, slugs = ANNOTATED_CARD_SLUGS }) {
  const violations = [];
  for (const slug of slugs) {
    const raw = await readFile(new URL(`${slug}/synergy.json`, cardsDir), 'utf8').catch(() => null);
    if (raw === null) continue;
    let synergy;
    try {
      synergy = JSON.parse(raw);
    } catch {
      continue;
    }
    violations.push(...findMissingAnnotationsInSynergy(slug, synergy));
  }
  return violations;
}
