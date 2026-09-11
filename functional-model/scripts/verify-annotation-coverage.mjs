// CLI wrapper around `annotation-coverage.mjs`'s `findMissingAnnotations` —
// see that file's own header for scope/rationale. This is the manual,
// human-readable report; `functional-model/annotation-coverage.test.ts` is
// the version wired into `npm run test`, and `verify-synergy.mjs` also
// contributes this same check to its own combined exit code — same
// three-place-enforcement shape `scenario-card-names.mjs` already
// established, so this can't bitrot into a one-off script nobody runs again.
//
// Usage: node functional-model/scripts/verify-annotation-coverage.mjs
// (plain Node — no TS import needed.) Nonzero exit iff any opted-in card has
// a fact with zero annotations.

import { findMissingAnnotations } from './annotation-coverage.mjs';

const cardsDir = new URL('../cards/', import.meta.url);

const violations = await findMissingAnnotations({ cardsDir });

if (violations.length === 0) {
  console.log('OK — every fact on every annotations-model card (see ANNOTATED_CARD_SLUGS) has at least one real annotation.');
  process.exit(0);
}

console.log(`${violations.length} fact(s) with zero annotations found:\n`);
for (const v of violations) {
  console.log(`  ✗ ${v.slug} [${v.role}][${v.index}] — ${v.description}`);
}
console.log(
  `\n${violations.length} violation(s) — either author a real \`sourceText\`/\`highlight\` entry for this fact in cards/<slug>/annotations-authoring.json (\`anchor: 'typeLine'\` if the oracle text body genuinely has nothing to point at) and re-run scripts/compute-annotations.mjs, or remove/fold the fact if it has no real textual basis at all (see synergy.ts's \`Fact.annotations\`/\`FactAnnotationAuthoring\` doc comments).`,
);
process.exit(1);
