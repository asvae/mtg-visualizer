import type { CardDefinition, Effect } from '../../card';
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
      //
      // This trigger's own EFFECT ("...put a +1/+1 counter on Aerith
      // Gainsborough") used to sit as a plain, un-provenanced `synergy.json`
      // fact (no `Effect`-shape signal existed to derive it from, since
      // `kind:'putCounterTarget'` — the only structural putCounter
      // recognizer that existed at the time — only ever covers a CHOSEN
      // target, never this effect's always-`target:'self'` shape).
      // MECHANIZED 2026-09-14 (fact-parity pass): `recognizers/
      // putCounterSelf-effect-structural.ts`, a new STRUCTURAL recognizer
      // reading the always-self `kind:'putCounter'` Effect directly
      // (checked against all 19 real occurrences pool-wide, 15 matched, 4
      // genuinely declined — see that recognizer's own module doc comment).
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
          //   - The ONE remaining entry (former `[4]`, this ability's own
          //     MAGNITUDE, X, reading counters already on self) was
          //     genuinely tier-3 as of 2026-09-13 — proving a SPECIFIC
          //     runtime number causally determines `putCounter`'s own
          //     `amount` argument needs real numeric-value PROVENANCE
          //     tracking tier 2's probe family can't do (JS primitives carry
          //     no object identity a `WeakMap`-based tracker can hang a path
          //     off). That reasoning is entirely about TIER 2 (execution-
          //     trace probing), though, and does NOT apply to a TIER-1
          //     literal-clause match — MECHANIZED 2026-09-14:
          //     `recognizers/putCounterMagnitude-clause-structural.ts`
          //     matches the literal English template "where X is the number
          //     of <counterType> counters on <self>" verbatim (same
          //     "build-then-verify against real printed text, never execute
          //     anything" shape `lifegain-trigger-structural.ts` already
          //     uses), sidestepping the tier-2 provenance problem entirely by
          //     reading prose instead of runtime data flow. Checked
          //     pool-wide: this exact `AuthoredFact` shape (`role:'sink',
          //     event:'putCounter', counterType, target:'self'`) has exactly
          //     ONE real occurrence in the whole pool (this card's own,
          //     removed here) — see that recognizer's own module doc comment
          //     for the full whole-pool review.
        } satisfies Effect,
      ],
    },
  ],
};
