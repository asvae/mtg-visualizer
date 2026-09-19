import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CardDefinition } from '../../card';
import { CountersSink } from './families/counters';
import { compileForgeCard, type ForgeJsonCard } from '../../scripts/experiments/forge-json-compiler/compile-forge-card';

/** Compiles a real card's verbatim Forge JSON (`functional-model/scripts/
 * experiments/forge-json-mapper`'s own output) into a real `CardDefinition`
 * via `functional-model/scripts/experiments/forge-json-compiler`'s
 * deterministic compiler. No hand-authored mock `CardDefinition`s in this
 * file below (Test2 is the one deliberate exception — see its own header) —
 * every case exercises real compiled data, run through the real
 * `CountersSink`. */
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
// counter on a card other than itself. Embedded verbatim (not `loadCompiled`
// - this card isn't part of the committed FDN-scoped mapper output) rather
// than depending on the separate, gitignored full-corpus experiment output.
const tigraFelineFury = compileForgeCard({
  Name: 'Tigra, Feline Fury',
  ManaCost: '1 G',
  Types: 'Legendary Creature Cat Human Hero',
  PT: '2/1',
  K: ['Flash', 'Trample'],
  T: [
    {
      Mode: 'LifeGained',
      ValidPlayer: 'You',
      TriggerZones: 'Battlefield',
      Execute: 'TrigPutCounter',
      TriggerDescription: 'Whenever you gain life, put a +1/+1 counter on NICKNAME.',
    },
  ],
  SVar: {
    TrigPutCounter: { DB: 'PutCounter', Defined: 'Self', CounterType: 'P1P1', CounterNum: '1' },
  },
  DeckHas: 'Ability$Counters',
  DeckHints: 'Ability$LifeGain',
  Oracle: 'Flash\\nTrample\\nWhenever you gain life, put a +1/+1 counter on Tigra.',
});

describe('CountersSink', () => {
  it('Test1 - a real chosen-target producer satisfies another card\'s counters sink', () => {
    const [sinkInstance] = CountersSink(exemplarOfLight);
    const result = sinkInstance(fleetingFlight);
    expect(result).toBe(true);
  });

  it('a self-only producer does not satisfy a DIFFERENT card\'s counters sink', () => {
    // Regression test for the real bug this fix closes, using a real card
    // (Tigra, Feline Fury) whose only counter-granting effect targets
    // `'self'` — it can never land a counter on a DIFFERENT card, so it must
    // not satisfy Exemplar of Light's sink even though both share the same
    // counterType.
    const [sinkInstance] = CountersSink(exemplarOfLight);
    const result = sinkInstance(tigraFelineFury);
    expect(result).toBe(false);
  });

  it('Exemplar of Light still satisfies its own counters sink via its own self-targeted trigger', () => {
    // The real, load-bearing self-loop the fix above must not break: a card
    // genuinely IS its own producer when the self-targeted effect belongs
    // to the same card the sink is being checked against.
    const [sinkInstance] = CountersSink(exemplarOfLight);
    const result = sinkInstance(exemplarOfLight);
    expect(result).toBe(true);
  });

  // Test2 - experiment: same question (does Exemplar of Light's
  // counter-added trigger recognize Fleeting Flight's counter-producing
  // ability?), but against raw Forge JSON (functional-model/scripts/
  // experiments/forge-json-mapper's real, verbatim output for Fleeting
  // Flight/Exemplar of Light) instead of our own CardDefinition schema. No
  // shared sink-model code is used here on purpose - every bit of Forge-DSL
  // interpretation needed to answer the question is written inline, right
  // here, so the comparison against Test1 is honest about what raw-Forge-
  // JSON matching actually costs without a semantic schema layer in
  // between. Deliberately hand-authored (not `loadCompiled`) for this
  // reason - unlike every other case in this file, this one is NOT
  // matching via our own schema at all.
  it('Test2 - forge json', () => {
    // verbatim copy of functional-model/scripts/experiments/
    // forge-json-mapper/output/fleeting_flight.json
    const forgeSource = {
      Name: 'Fleeting Flight',
      ManaCost: 'W',
      Types: 'Instant',
      A: [
        {
          SP: 'PutCounter',
          ValidTgts: 'Creature',
          CounterType: 'P1P1',
          CounterNum: '1',
          SubAbility: 'DBPump',
          SpellDescription:
            'Put a +1/+1 counter on target creature. It gains flying until end of turn. Prevent all combat damage that would be dealt to it this turn.',
        },
      ],
      SVar: {
        DBPump: {
          DB: 'Pump',
          Defined: 'Targeted',
          KW: 'Flying & Prevent all combat damage that would be dealt to CARDNAME.',
        },
      },
      DeckHas: 'Ability$Counters',
      Oracle:
        'Put a +1/+1 counter on target creature. It gains flying until end of turn. Prevent all combat damage that would be dealt to it this turn.',
    };

    // verbatim copy of functional-model/scripts/experiments/
    // forge-json-mapper/output/exemplar_of_light.json
    const forgeSink = {
      Name: 'Exemplar of Light',
      ManaCost: '2 W W',
      Types: 'Creature Angel',
      PT: '3/3',
      K: ['Flying'],
      T: [
        {
          Mode: 'LifeGained',
          ValidPlayer: 'You',
          TriggerZones: 'Battlefield',
          Execute: 'TrigPutCounter',
          TriggerDescription: 'Whenever you gain life, put a +1/+1 counter on this creature.',
        },
        {
          Mode: 'CounterAddedOnce',
          CounterType: 'P1P1',
          ValidSource: 'You',
          ValidCard: 'Card.Self',
          TriggerZones: 'Battlefield',
          ActivationLimit: '1',
          Execute: 'TrigDraw',
          TriggerDescription:
            'Whenever you put one or more +1/+1 counters on this creature, draw a card. This ability triggers only once each turn.',
        },
      ],
      SVar: {
        TrigPutCounter: {
          DB: 'PutCounter',
          Defined: 'Self',
          CounterType: 'P1P1',
          CounterNum: '1',
        },
        TrigDraw: { DB: 'Draw' },
      },
      DeckHas: 'Ability$Counters',
      DeckHints: 'Ability$LifeGain',
      Oracle:
        'Flying\\nWhenever you gain life, put a +1/+1 counter on this creature.\\nWhenever you put one or more +1/+1 counters on this creature, draw a card. This ability triggers only once each turn.',
    };

    // --- everything below is ad hoc, one-off Forge-DSL interpretation,
    // written by hand for this test only - this is exactly the "turn text
    // into meaning" work CountersSink already does once, generically, for
    // any card in our own schema. Here it has to be redone from scratch
    // against Forge's raw ability-line vocabulary (Mode$/Execute$/DB$/SP$
    // literal strings, SVar indirection) to answer the same single
    // question. ---

    // Find sink's "put +1/+1 counter(s) on self" consumer trigger: Forge
    // represents this as a T: line with Mode$ CounterAddedOnce (or
    // CounterAdded) and a CounterType$ param - there is no structural
    // "counterAddedMatch" field, just this raw param bag.
    const consumerTrigger = forgeSink.T.find(
      (t) => t.Mode === 'CounterAddedOnce' || (t.Mode as string) === 'CounterAdded',
    );
    const consumerCounterType = consumerTrigger?.CounterType;

    // Find source's counter-producing ability: an A: line whose SP$/AB$/DB$
    // value is "PutCounter", with its own CounterType$ param.
    const producerAbility = forgeSource.A.find((a) => a.SP === 'PutCounter' || (a as Record<string, unknown>).DB === 'PutCounter');
    const producerCounterType = producerAbility?.CounterType;

    const result = consumerCounterType !== undefined && consumerCounterType === producerCounterType;

    expect(result).toBe(true);
  });

  // Test3 - same question again, but against the module-scope `compileForgeCard`
  // output above, run through the REAL CountersSink - not a diff against a
  // hand-authored definition, an actual integration check that compiled
  // output is usable by production matching code, not just JSON that
  // happens to look right.
  it('Test3 - compiled from forge json', () => {
    const [sinkInstance] = CountersSink(exemplarOfLight);
    const result = sinkInstance(fleetingFlight);
    expect(result).toBe(true);
  });
});
