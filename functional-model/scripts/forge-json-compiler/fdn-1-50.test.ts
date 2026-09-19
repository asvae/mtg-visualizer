/**
 * Regression guard for the `forge-json-compiler` FDN authoring-pipeline
 * tool's FDN 1-50 coverage push (2026-09-19) — Foundations' first 50 real
 * cards by Scryfall collector number (`data/fdn/fdn_scryfall.json`), the same
 * corpus this project's own live `functional-model/fdn-cards/` authoring
 * pipeline covers (every one of these 50 has a real, already-hand-authored
 * `fdn-cards/<slug>/definition.ts` to cross-check against).
 *
 * Reads real Forge JSON straight off `forge-json-mapper`'s own committed-
 * to-disk-but-gitignored `output/<slug>.json` (the full FDN 517-card
 * corpus — regenerate via `python3
 * functional-model/scripts/experiments/forge-json-mapper/forge_json_mapper.py`
 * if `output/` is empty) and real token-script bodies straight off the
 * local `tmp/mtg-forge/` checkout (`load-token-scripts.ts`) — same
 * "requires a local Forge checkout" dependency `run-experiment.ts` already
 * has, not a new one.
 *
 * The per-card case table itself (status meanings included) now lives in
 * the sibling `fdn-1-50-cases.ts` — extracted there (2026-09-19, same day)
 * so `server/utils/forgeJsonCompiler.ts`'s card-page allowlist can import
 * the identical table without pulling `vitest` into a server-runtime
 * import graph. See that file's own doc comment for the 2-state gray/blue
 * scheme (2026-09-19, later still, user correction — whether a compiled
 * card structurally matches the separately-authored `fdn-cards/` pipeline
 * file is NOT a scored dimension; `structuralDiff` below is kept as
 * genuinely useful DIAGNOSTIC output only, never gated on).
 *
 * A future compiler change that flips ANY of the statuses in that table
 * (breaks a `blue` back to `gray`, or vice versa) must update it — that
 * update IS the regression signal this test exists to force.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileForgeCard, type ForgeJsonCard, type ForgeTokenScript } from './compile-forge-card';
import { loadTokenScripts } from './load-token-scripts';
import { structuralDiff } from './diff';
import { CASES, TOKEN_SCRIPT_IDS, type CompileStatus } from './fdn-1-50-cases';
import type { CardDefinition } from '../../card';

const OUTPUT_DIR = resolve(import.meta.dirname, '../experiments/forge-json-mapper/output');

const outputAvailable = existsSync(OUTPUT_DIR);
const tokenScripts: Record<string, ForgeTokenScript> = outputAvailable ? loadTokenScripts(TOKEN_SCRIPT_IDS) : {};

describe.skipIf(!outputAvailable)('forge-json-compiler: FDN 1-50 coverage', () => {
  it(`sanity: exactly 50 cases declared`, () => {
    expect(CASES.length).toBe(50);
  });

  it('coverage summary matches the expected 2-state breakdown (25 blue / 25 gray)', () => {
    const counts: Record<CompileStatus, number> = { gray: 0, blue: 0 };
    for (const c of CASES) counts[c.status]++;
    expect(counts).toEqual({ gray: 25, blue: 25 });
  });

  for (const c of CASES) {
    it(`fin/${c.cn} ${c.name} — status: ${c.status}`, async () => {
      const forgeJson = JSON.parse(readFileSync(resolve(OUTPUT_DIR, `${c.slug}.json`), 'utf8')) as ForgeJsonCard;

      if (c.status === 'gray') {
        expect(() => compileForgeCard(forgeJson, tokenScripts)).toThrow();
        return;
      }

      // blue — the only real assertion is "compiles into a schema-valid
      // CardDefinition at all" (throwing here IS the regression signal).
      // `structuralDiff` against the real hand-authored `fdn-cards/`
      // reference is still computed below as genuinely useful DIAGNOSTIC
      // output (this exact machinery already caught one real compiler bug
      // — Uncharted Voyage's silently-dropped `AlternativeDecider$` — see
      // this file's own header) but is deliberately NEVER asserted on: a
      // real, understood divergence from that separately-authored pipeline
      // file (a different `Trigger` shape, a different-but-equally-valid
      // schema choice for the same Forge ability, ...) is not this
      // tool's concern per the user's own explicit correction.
      const compiled = compileForgeCard(forgeJson, tokenScripts);
      const mod = (await import(`../../fdn-cards/${c.dirSlug}/definition.ts`)) as Record<string, CardDefinition>;
      const authored = mod[c.exportName];
      expect(authored, `expected fdn-cards/${c.dirSlug}/definition.ts to export ${c.exportName}`).toBeDefined();
      structuralDiff(compiled, authored);
    });
  }
});
