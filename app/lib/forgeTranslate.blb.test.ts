import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseForgeScript } from './forgeScript';
import { translateForgeCard } from './forgeTranslate';

// Regression coverage for every BLB card the round-trip examiner
// (synergy-model/EXAM_PROCESS.md, driven by make-exam-forge.mjs) has
// confirmed reconstructs to a full match against real oracle text —
// tracked in synergy-model/exams/blb-success.json, updated as the examiner
// loop (synergy-model/exams/blb-progress.json) processes more cards. A
// snapshot here means "the parser's output for this card is exam-verified
// correct as of the snapshot" — any future forgeScript.ts/forgeTranslate.ts
// change that shifts one of these snapshots is a real regression against a
// card someone already checked by hand, not a false positive to update away.
function appSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const successCards: string[] = JSON.parse(readFileSync(join(process.cwd(), 'synergy-model/exams/blb-success.json'), 'utf8'));

describe('BLB examiner-verified cards (forge -> parse -> synergy snapshot)', () => {
  for (const name of successCards) {
    it(name, () => {
      const raw = readFileSync(join(process.cwd(), `forge-model/data/${appSlug(name)}.txt`), 'utf8');
      const translated = translateForgeCard(parseForgeScript(raw));
      expect({
        name: translated.name,
        nodes: translated.nodes,
        flow: translated.flow,
        unmapped: translated.unmapped,
      }).toMatchSnapshot();
    });
  }
});
