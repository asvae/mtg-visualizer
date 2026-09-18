import type { CardDefinition, Effect } from '../../card';
import { applyToBound, putCounter, selectUpTo, you } from '../../combinator';

// Real Forge (zimone_paradox_sculptor.txt): `T:Mode$ Phase | Phase$
// BeginCombat | ... | SVar:TrigPutCounter:DB$ PutCounter | ValidTgts$
// Creature.YouCtrl | TargetMin$ 0 | TargetMax$ 2 | CounterNum$ 1` — "put a
// +1/+1 counter on each of up to two target creatures you control," the
// same real `selectUpTo`/`applyToBound` shape `felidar-savior`'s own ETB
// already establishes, just fired at the beginning of combat instead (bare
// name-only trigger — no `Trigger.on` value exists for "beginning of combat
// on your turn"). The activated ability's own real "double the number of
// EACH KIND of counter on up to two target creatures and/or artifacts" is a
// genuinely different shape: it needs to read a CHOSEN TARGET's own live
// counter count (not `ctx.self`'s), for an unbounded set of counter TYPES —
// no `ValueRef` reads a bound target's own counters (`selfCounters` only
// ever reads `ctx.self`), and no primitive enumerates "every counter type
// currently on an object."
export const zimoneParadoxSculptor: CardDefinition = {
  name: 'Zimone, Paradox Sculptor',
  manaCost: '{2}{G}{U}',
  typeLine: 'Legendary Creature — Human Wizard',
  pt: [1, 4],

  triggers: [
    {
      name: 'onBeginCombat',
      effects: [
        {
          kind: 'program',
          describe: 'put a +1/+1 counter on each of up to two target creatures you control',
          program: selectUpTo(you.creaturesInPlay(), 2, 'target', [
            applyToBound('target', 0, putCounter('+1/+1', 1)),
            applyToBound('target', 1, putCounter('+1/+1', 1)),
          ]),
        } satisfies Effect,
      ],
    },
  ],

  missingSchemaFunctionality: [
    {
      clause: 'Double the number of each kind of counter on up to two target creatures and/or artifacts you control.',
      demand:
        'No `ValueRef` reads a previously-BOUND target\'s own live counter count (only `selfCounters`, scoped to `ctx.self`), and no primitive enumerates "every counter type currently on an object" to double each independently.',
    },
  ],
};
