// CLI entry point for `validate-card-definition.mjs`'s own
// `validateCardDefinition` — a separate file, not a self-guarded bottom
// block in that module, because `vite-node`'s own CLI wrapper doesn't
// preserve the real target-file path in `process.argv` at all (see that
// file's own header, "Reusable, not just a CLI," for the full reasoning —
// confirmed empirically, not assumed). This file is never imported by
// anything else, so it needs no entry-point guard itself; it just resolves
// argv, calls the real function, and prints/exits.
//
// Usage: npx vite-node functional-model/scripts/validate-card-definition-cli.mjs <slug>
//   npx vite-node functional-model/scripts/validate-card-definition-cli.mjs summon-bahamut
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateCardDefinition } from './validate-card-definition.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

const slug = process.argv[2];
if (!slug) {
  console.error('Usage: npx vite-node functional-model/scripts/validate-card-definition-cli.mjs <slug>');
  process.exit(1);
}

// 2026-09-18, later same day: FDN candidates live under
// `functional-model/fdn-cards/<slug>/`, not `functional-model/cards/`
// (FIN's own now reference-only pool, see `functional-model/cards/
// README.md`) — this CLI is FDN-pipeline-only, so it resolves here.
const definitionPath = join(ROOT, 'functional-model', 'fdn-cards', slug, 'definition.ts');
const result = await validateCardDefinition(definitionPath, ROOT);
console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
