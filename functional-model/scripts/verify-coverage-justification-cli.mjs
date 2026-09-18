// Standalone CLI for `verify-coverage-justification.mjs`'s own
// `verifyCoverageJustificationForSlug` — separate file, not a self-guarded
// bottom block, for the exact same `vite-node`-argv reason
// `validate-card-definition.mjs`'s own header documents for its own CLI
// split (`process.argv[1]` under `vite-node` is `vite-node`'s own bin path,
// never the target script, so the usual `import.meta.url ===
// file://${process.argv[1]}` guard is structurally impossible here).
//
// Usage: npx vite-node functional-model/scripts/verify-coverage-justification-cli.mjs <slug> [<slug> ...]

import { verifyCoverageJustificationForSlug } from './verify-coverage-justification.mjs';

async function main() {
  const slugs = process.argv.slice(2);
  if (slugs.length === 0) {
    console.error('Usage: npx vite-node functional-model/scripts/verify-coverage-justification-cli.mjs <slug> [<slug> ...]');
    process.exit(1);
  }

  let failed = 0;
  for (const slug of slugs) {
    const result = await verifyCoverageJustificationForSlug(slug);
    if (result.ok) {
      console.log(`${slug}: OK`);
    } else {
      failed++;
      console.log(`${slug}: FAILED`);
      for (const reason of result.reasons) console.log(`  - ${reason}`);
    }
  }
  process.exit(failed > 0 ? 1 : 0);
}

main();
