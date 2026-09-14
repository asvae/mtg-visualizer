import type { CardDefinition, Effect, AuthoredFact } from '../../card';
import { branch, compare, putCounter, selfCounters, you } from '../../combinator';

export const aerithGainsborough: CardDefinition = {
  name: 'Aerith Gainsborough',
  manaCost: '{2}{W}',
  typeLine: 'Legendary Creature — Human Cleric',

  keywords: ['Lifelink'],

  triggers: [
    {
      // Whole trigger line, cause+effect together. Own annotation (as of the
      // PRD_AUTOMATED_AUTHORING.md "definition-level annotation" migration,
      // 2026-09-13): `definition-annotations.json`, keyed `"triggers[0]"`.
      //
      // This trigger's own firing PRECONDITION ("Whenever you gain life...")
      // used to be a hand-authored tier-3 `CardDefinition.authoredFacts`
      // entry (no single owning `Effect` to co-locate it on — this trigger's
      // own effect is a plain, declarative `putCounter`, not `custom`).
      // MECHANIZED 2026-09-13 (PRD_AUTOMATED_AUTHORING.md's tier-3-
      // elimination pass): `recognizers/lifegain-trigger-structural.ts`, a
      // new TEXT recognizer matching the literal "Whenever you gain life"
      // clause, checked against all 3 real pool cards using it
      // (`excalibur-ii`, `minwu-white-mage`, this card) — the authored
      // duplicate is removed here.
      name: 'onLifeGained',
      effects: [{ kind: 'putCounter', target: 'self', counterType: '+1/+1', amount: 1 } satisfies Effect],
    },
    {
      // Own annotation: `definition-annotations.json`, keyed `"triggers[1]"`.
      //
      // This trigger's own firing PRECONDITION ("When Aerith Gainsborough
      // dies...") and its SOURCE-side CR 700.4 consequence used to be 2 of
      // this effect's own 5 hand-authored tier-3 `authoredFact` entries.
      // MECHANIZED 2026-09-13: `recognizers/dies-trigger-structural.ts`, a
      // new TEXT recognizer matching "When/Whenever <self> dies" (checked
      // against all 8 real `onDies`-shaped triggers in the pool, including
      // one real, deliberate decline — `al-bhed-salvagers`'s own BROADER
      // "this creature or another creature or artifact you control dies").
      name: 'onDies',
      effects: [
        {
          // MIGRATED (2026-09-14) off a `kind:'custom'` closure onto the
          // real `combinator.ts` AST — a genuine `Branch` (the "if X<=0,
          // don't bother" early return, `then: []`), whose `else` is a
          // `Filter`-narrowed `Each` (creatures you control, filtered to
          // `subtype:'Legendary'` — same "hasSubtype('Legendary') is a
          // pragmatic approximation of Forge's own SUPERTYPE check" caveat
          // the old closure's own comment already carried), putting X
          // counters (a `selfCounters` leaf read, the SAME live value the
          // `Branch`'s own condition reads) on each one. No `Bind`/`Choose`
          // needed — every read is either a fixed constant or a live read
          // off `ctx.self`, never a cross-step object reference.
          //
          // Authored via `combinator.ts`'s own fluent builder layer
          // (2026-09-14 follow-up — SAME AST as before, just not a raw
          // nested object literal): `branch`/`compare`/`selfCounters`/
          // `putCounter`/`you` are all builder functions, not new node kinds.
          kind: 'program',
          describe:
            'put X +1/+1 counters on each legendary creature you control, where X is the number of +1/+1 counters on this (real getCounters(), not a fixed/guessed value)',
          program: branch(compare(selfCounters('+1/+1'), '<=', 0), [], [
            you.creaturesInPlay().filter('subtype', 'Legendary').each(putCounter('+1/+1', selfCounters('+1/+1'))),
          ]),
          // PROTOTYPE (PRD_AUTOMATED_AUTHORING.md, "3-tier waterfall" trial,
          // 2026-09-13, scoped to fin/1-10 only) — tier 3 (`Effect.authoredFact`,
          // see its own doc comment). This `run` body used to need 5 hand-
          // authored facts in total; 4 are now MECHANIZED (2026-09-13,
          // tier-3-elimination pass — see `PRD_AUTOMATED_AUTHORING.md`'s own
          // write-up):
          //   - The SOURCE `putCounter` broadcast (this file's own former
          //     `authoredFact[0]`) and its paired "wants a legendary creature
          //     present" sink (former `[1]`) are now derived by
          //     `recognizers/runtime-action-probe.prototype.ts`'s new
          //     `probeBroadcastPutCounter` (tier 2 — extends the read-only
          //     runtime-dependency probe to also instrument `actions`,
          //     observing which fixture candidates a broadcast
          //     `actions.putCounter` call actually touches) plus the
          //     existing `mirroredPresenceSinks` post-processing step for
          //     the sink half — verified to derive the identical fact via
          //     `scripts/prototype-verify-action-probe-fin1-5.mjs`.
          //   - The trigger's own firing precondition (former `[2]`) and its
          //     SOURCE-side consequence (former `[3]`) are now derived by
          //     `recognizers/dies-trigger-structural.ts` (tier 1 — see the
          //     `onDies` trigger's own comment above).
          // The ONE remaining entry (this ability's own MAGNITUDE, X,
          // reading counters already on self) genuinely STAYS tier-3 — see
          // its own comment below for why neither tier 1 nor tier 2 can
          // safely derive it.
          authoredFact: [
            {
              // This ability's own MAGNITUDE (X) reads counters already on
              // self (`ctx.self.getCounters('+1/+1')`) — the same real
              // "scales with a dependency" shape tier 2's runtime probe
              // targets for a `Computed<T>` closure, but genuinely different
              // from the broadcast-target classification the SAME probe now
              // covers above: proving this SPECIFIC number (not just an
              // early-return gate) causally determines `putCounter`'s own
              // `amount` argument would need real numeric-value PROVENANCE
              // tracking across intervening statements (`const x = ...; ...;
              // actions.putCounter(creature, '+1/+1', x)`) — JS primitives
              // carry no object identity a `WeakMap`-based tracker (this
              // probe family's own mechanism, see `runtime-action-probe
              // .prototype.ts`'s own header) can hang a path off; a plain
              // "this closure happens to also read self's own counters
              // somewhere" correlation would be a materially WEAKER, false-
              // positive-prone signal than every other fact this pass
              // mechanized. Genuinely stays tier-3 (2026-09-13 verdict, not
              // re-attempted since — see `PRD_AUTOMATED_AUTHORING.md`'s own
              // write-up for the full reasoning). Own annotation:
              // `definition-annotations.json`, keyed
              // `"triggers[1].effects[0].authoredFact[0]"`.
              role: 'sink',
              event: 'putCounter',
              counterType: '+1/+1',
              target: 'self',
              value: 1,
            },
          ] satisfies AuthoredFact[],
        } satisfies Effect,
      ],
    },
  ],
};
