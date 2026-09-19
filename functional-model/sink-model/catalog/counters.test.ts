import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CardDefinition, Effect } from '../../card';
import { exemplarOfLight } from '../../fdn-cards/exemplar-of-light/definition';
import { CountersSink } from './families/counters';
import { compileForgeCard, type ForgeJsonCard } from '../../scripts/experiments/forge-json-compiler/compile-forge-card';

// shape taken from Fleeting Flight (FDN #13, Instant): "Put a +1/+1 counter
// on target creature."
const source: CardDefinition = {
  name: '',
  manaCost: '',
  typeLine: '',
  effects: [
    {
      kind: 'putCounterTarget',
      validType: 'creature',
      counterType: '+1/+1',
      amount: 1,
    } satisfies Effect,
  ],
};

// shape taken from Exemplar of Light (FDN #11): "Whenever you gain life, put
// a +1/+1 counter on this creature. Whenever you put one or more +1/+1
// counters on this creature, draw a card."
const sink: CardDefinition = {
  name: '',
  manaCost: '',
  typeLine: 'Creature',
  triggers: [
    {
      name: 'onCounterAdded',
      on: 'counterAdded',
      counterAddedMatch: { counterType: '+1/+1' },
      activationLimit: 1,
      effects: [
        {
          kind: 'drawCard',
          amount: 1,
        } satisfies Effect,
      ],
    },
  ],
};

// a card that ONLY puts a +1/+1 counter on itself - unlike Fleeting Flight
// above, it has no ability that can ever put a counter on a DIFFERENT card.
const selfOnlyProducer: CardDefinition = {
  name: 'Self-Only Counter Bot',
  manaCost: '',
  typeLine: 'Creature',
  effects: [
    {
      kind: 'putCounter',
      target: 'self',
      counterType: '+1/+1',
      amount: 1,
    } satisfies Effect,
  ],
};

describe('CountersSink', () => {
  it('Test1', () => {
    const [sinkInstance] = CountersSink(sink);
    const result = sinkInstance(source);
    expect(result).toBe(true);
  });

  it('a self-only producer does not satisfy a different card\'s counters sink', () => {
    // regression test: `target: 'self'` can only ever land a counter on the
    // card that owns the effect, so a self-only producer must never satisfy
    // any OTHER card's counters sink, even when counterType/controller match.
    const [sinkInstance] = CountersSink(sink);
    const result = sinkInstance(selfOnlyProducer);
    expect(result).toBe(false);
  });

  it('Exemplar of Light still satisfies its own counters sink via its own self-targeted trigger', () => {
    // the real, load-bearing self-loop the fix above must not break: a card
    // genuinely IS its own producer when the self-targeted effect belongs to
    // the same card the sink is being checked against.
    const [sinkInstance] = CountersSink(exemplarOfLight);
    const result = sinkInstance(exemplarOfLight);
    expect(result).toBe(true);
  });

  // Test2 - experiment: same question (does Exemplar of Light's
  // counter-added trigger recognize Fleeting Flight's counter-producing
  // ability?), but against raw Forge JSON (functional-model/scripts/
  // experiments/forge-json-mapper's real, verbatim output for FDN #13/#11)
  // instead of our own CardDefinition schema. No shared sink-model code is
  // used here on purpose - every bit of Forge-DSL interpretation needed to
  // answer the question is written inline, right here, so the comparison
  // against Test1 is honest about what raw-Forge-JSON matching actually
  // costs without a semantic schema layer in between.
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

  // Test3 - same question again, but against CardDefinitions produced by
  // functional-model/scripts/experiments/forge-json-compiler's deterministic
  // Forge-JSON -> CardDefinition compiler (a separate, uncommitted
  // experiment), run through the REAL CountersSink - not a diff against the
  // hand-authored definitions, an actual integration check that compiled
  // output is usable by production matching code, not just JSON that
  // happens to look right.
  it('Test3 - compiled from forge json', () => {
    const loadCompiled = (forgeFile: string): CardDefinition => {
      const path = resolve(
        __dirname,
        '../../scripts/experiments/forge-json-mapper/output',
        forgeFile,
      );
      const forgeJson = JSON.parse(readFileSync(path, 'utf8')) as ForgeJsonCard;
      return compileForgeCard(forgeJson);
    };

    const compiledSource = loadCompiled('fleeting_flight.json');
    const compiledSink = loadCompiled('exemplar_of_light.json');

    const [sinkInstance] = CountersSink(compiledSink);
    const result = sinkInstance(compiledSource);
    expect(result).toBe(true);
  });
});
