/**
 * Real, repeatable authoring step: compile each `fdn-1-50-cases.ts` `blue`
 * card's real Forge JSON and OVERWRITE its `fdn-cards/<dirSlug>/
 * definition.ts` with the compiler's own output (`write-fdn-definition.ts`'s
 * `renderDefinitionFile`) — this is the missing "write it to disk" half of
 * this compiler's own promotion into a real FDN authoring-pipeline step.
 *
 * Deliberately does NOT touch `pipeline-status.json`/`justification.json` —
 * those are separate, already-real pipeline concerns (`gate-and-write-
 * status.mjs`, hand-authored coverage-justification) this script has no
 * business writing to. `functional-model/pipeline-status.ts`'s own
 * `effectivePipelineStatus` fingerprint check (computed at READ time off
 * `definition.ts`'s real current content) is what naturally surfaces a
 * `re-review` for any card this script updates that was previously
 * confirmed `green` — no separate "reset review status" write path exists
 * or is needed here.
 *
 * Usage:
 *   npx vite-node functional-model/scripts/forge-json-compiler/author-fdn-definitions.ts <dirSlug> [<dirSlug> ...]
 *   npx vite-node functional-model/scripts/forge-json-compiler/author-fdn-definitions.ts --all-blue
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileForgeCard, type ForgeJsonCard } from './compile-forge-card';
import { loadTokenScripts } from './load-token-scripts';
import { CASES, TOKEN_SCRIPT_IDS } from './fdn-1-50-cases';
import { renderDefinitionFile } from './write-fdn-definition';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..', '..');
const MAPPER_OUTPUT_DIR = join(ROOT, 'functional-model', 'scripts', 'experiments', 'forge-json-mapper', 'output');
const FDN_CARDS_DIR = join(ROOT, 'functional-model', 'fdn-cards');

function resolveCases(argv: string[]) {
  if (argv.length === 1 && argv[0] === '--all-blue') return CASES.filter((c) => c.status === 'blue');
  const bySlug = new Map(CASES.map((c) => [c.dirSlug, c]));
  return argv.map((slug) => {
    const c = bySlug.get(slug);
    if (!c) throw new Error(`no fdn-1-50-cases.ts entry for dirSlug "${slug}"`);
    if (c.status !== 'blue') throw new Error(`"${slug}" is status:'${c.status}', not 'blue' — refusing to author a non-compiling card`);
    return c;
  });
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0) {
    console.error('Usage: npx vite-node functional-model/scripts/forge-json-compiler/author-fdn-definitions.ts <dirSlug> [<dirSlug> ...]\n   or: npx vite-node functional-model/scripts/forge-json-compiler/author-fdn-definitions.ts --all-blue');
    process.exit(1);
  }
  const cases = resolveCases(argv);
  const tokenScripts = loadTokenScripts(TOKEN_SCRIPT_IDS);

  for (const c of cases) {
    const forgeJsonPath = join(MAPPER_OUTPUT_DIR, `${c.slug}.json`);
    if (!existsSync(forgeJsonPath)) throw new Error(`missing ${forgeJsonPath} (forge-json-mapper output not generated on this machine)`);
    const forgeJson = JSON.parse(readFileSync(forgeJsonPath, 'utf8')) as ForgeJsonCard;
    const compiled = compileForgeCard(forgeJson, tokenScripts);
    const source = renderDefinitionFile(compiled, c.exportName);
    const outPath = join(FDN_CARDS_DIR, c.dirSlug, 'definition.ts');
    if (!existsSync(outPath)) throw new Error(`refusing to author a definition.ts that doesn't already exist: ${outPath}`);
    writeFileSync(outPath, source);
    console.log(`wrote ${outPath}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
