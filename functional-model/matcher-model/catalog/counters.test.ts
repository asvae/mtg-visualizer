import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CardDefinition } from '../../card';
import { CountersMatcher } from './families/counters';
import { compileForgeCard, type ForgeJsonCard } from '../../scripts/forge-json-compiler/compile-forge-card';

/** Compiles a real card's verbatim Forge JSON (`functional-model/scripts/
 * experiments/forge-json-mapper`'s own output) into a real `CardDefinition`
 * via `functional-model/scripts/forge-json-compiler`'s
 * deterministic compiler. No hand-authored mock `CardDefinition`s in this
 * file below — every case exercises real compiled data, run through the
 * real `CountersMatcher`. */
function loadCompiled(forgeFile: string): CardDefinition {
  const path = resolve(__dirname, '../../scripts/experiments/forge-json-mapper/output', forgeFile);
  const forgeJson = JSON.parse(readFileSync(path, 'utf8')) as ForgeJsonCard;
  return compileForgeCard(forgeJson);
}

// Compiled once, reused by every case below (not re-parsed/re-compiled per
// test).
//
// Fleeting Flight (Instant): "Put a +1/+1 counter on target creature. ..." —
// a real CHOSEN-target producer, structurally able to reach any creature,
// including a different card.
const fleetingFlight = loadCompiled('fleeting_flight.json');
// Exemplar of Light (Creature): "Whenever you gain life, put a +1/+1
// counter on this creature. Whenever you put one or more +1/+1 counters on
// this creature, draw a card." — a real SELF-only producer (its only
// counter-granting effect targets itself) plus a real consumer trigger.
const exemplarOfLight = loadCompiled('exemplar_of_light.json');
// Tigra, Feline Fury (Creature, not an FDN card - found via a full-corpus
// search for a real, DIFFERENT card sharing Exemplar of Light's exact
// self-only-producer shape): "Whenever you gain life, put a +1/+1 counter
// on Tigra." No targeting, no other counter-granting effect anywhere on the
// card - a genuine real-world case of a producer that can never place a
// counter on a card other than itself. `tigra_feline_fury.json` generated
// via the mapper's own `--card` mode (`forge_json_mapper.py --card "Tigra,
// Feline Fury"`) rather than the default FDN-scoped corpus run - this card
// isn't part of the committed 517-card FDN pool, so it's the one file in
// `output/` sourced that way.
const tigraFelineFury = loadCompiled('tigra_feline_fury.json');

describe('CountersMatcher', () => {
  it('a real chosen-target producer satisfies another card\'s counters sink', () => {
    const [matcher] = CountersMatcher(exemplarOfLight);
    const result = matcher(fleetingFlight);
    expect(result).toBe(true);
  });

  it('a self-only producer does not satisfy a DIFFERENT card\'s counters sink', () => {
    // Regression test for the real bug this fix closes, using a real card
    // (Tigra, Feline Fury) whose only counter-granting effect targets
    // `'self'` — it can never land a counter on a DIFFERENT card, so it must
    // not satisfy Exemplar of Light's sink even though both share the same
    // counterType.
    const [matcher] = CountersMatcher(exemplarOfLight);
    const result = matcher(tigraFelineFury);
    expect(result).toBe(false);
  });

  it('Exemplar of Light still satisfies its own counters sink via its own self-targeted trigger', () => {
    // The real, load-bearing self-loop the fix above must not break: a card
    // genuinely IS its own producer when the self-targeted effect belongs
    // to the same card the sink is being checked against.
    const [matcher] = CountersMatcher(exemplarOfLight);
    const result = matcher(exemplarOfLight);
    expect(result).toBe(true);
  });
});
