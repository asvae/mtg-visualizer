import type { CardDefinition, Effect, EffectContext, Actions, AuthoredFact } from '../../card';
import type { Card } from '../../interfaces';
import { TOKENS } from '../../tokens.ts';

export const aerithRescueMission: CardDefinition = {
  name: 'Aerith Rescue Mission',
  manaCost: '{3}{W}',
  typeLine: 'Sorcery',

  // Real limitation, not just inert data: `AnnotationRef`/`toLineOffset`
  // (synergy.ts) hard-require a resolved span to sit within a SINGLE line,
  // but this card's real oracle text spreads its "Choose one —" modal across
  // 3 lines (one per mode). The "whole ability line, cause+effect together"
  // annotation convention has no single line to point at for a multi-mode
  // spell at this (top-level `effects`) granularity — the best honest
  // annotation here is the modal's own header line, not the full ability.
  // Per-mode detail is NOT lost, though: each `modes[]` entry below has its
  // own annotation too. Own annotation (as of the
  // PRD_AUTOMATED_AUTHORING.md "definition-level annotation" migration,
  // 2026-09-13): `definition-annotations.json`, keyed `"effects"` (bare —
  // one top-level `effects` array per face).
  effects: [
    {
      kind: 'modal',
      modes: [
        {
          // Own annotation: `definition-annotations.json`, keyed
          // `"effects[0].modes[0]"`.
          //
          // Mechanization pass (2026-09-14): this real `kind:'createToken'`
          // Effect's own resulting `entersBattlefield` SOURCE fact (this
          // card's own `synergy.json`) stays hand-authored, NOT covered by a
          // new recognizer — checked the whole pool first (34 real
          // `kind:'createToken'` occurrences). A general "token creation"
          // recognizer would need to re-derive the token's own printed
          // English descriptor (color word, P/T, subtype) from `tokens.ts`'s
          // `TOKENS` registry and verbatim-match it against this card's real
          // oracle text — a dedicated prototype already explored exactly
          // this (`recognizers/token-creation-from-forge-script.prototype
          // .ts`, reading Forge's own token scripts instead) and documented
          // real, confirmed fragility: printed word ORDER varies card to
          // card (`retrieve-the-esper`'s own "3/3 blue Robot Warrior
          // ARTIFACT creature token" vs. its own script's differently-
          // ordered `Types:` field), printed word PRESENCE varies too
          // (`ancient-adamantoise`'s own Treasure token never prints
          // "artifact" at all), and `tokens.ts`'s own registry has NO
          // explicit color field (only inferable from an id-prefix
          // convention, another guessing layer) — genuinely more fragile
          // than the single-verb "destroy"/"draw" templates this catalog's
          // other structural recognizers already safely generalize. Not
          // attempted here; a dedicated future pass, not this 7-card one.
          describe: 'Take the Elevator — create three 1/1 colorless Hero creature tokens',
          effects: [{ kind: 'createToken', token: TOKENS.c_1_1_hero, amount: 3 } satisfies Effect],
        },
        {
          // Own annotation: `definition-annotations.json`, keyed
          // `"effects[0].modes[1]"`.
          describe: 'Take 59 Flights of Stairs — tap up to three target creatures, put a stun counter on one of them',
          effects: [
            {
              // Tap-N-then-counter-ONE-of-those-N needs the same chosen
              // targets bound across two steps — no declarative shape here
              // supports referencing "one of the targets from the PREVIOUS
              // effect," so this stays one combined custom rather than a
              // `tapTarget` followed by a `putCounterTarget` that can't
              // actually see which cards the first one picked.
              kind: 'custom',
              describe: 'tap up to three target creatures, then put a stun counter on one of them',
              run: (ctx: EffectContext, actions: Actions) => {
                const pool = [...ctx.you.getCreaturesInPlay(), ...ctx.opponents.flatMap((p) => p.getCreaturesInPlay())];
                const tapped: Card[] = [];
                for (let i = 0; i < 3; i++) {
                  const remaining = pool.filter((c) => !tapped.includes(c));
                  if (remaining.length === 0) break;
                  const target = actions.chooseTarget(remaining);
                  tapped.push(target);
                  actions.tap(target);
                }
                if (tapped.length > 0) actions.putCounter(tapped[0]!, 'stun', 1);
              },
              // PROTOTYPE (PRD_AUTOMATED_AUTHORING.md, "3-tier waterfall"
              // trial, 2026-09-13, scoped to fin/1-10 only) — tier 3
              // (`Effect.authoredFact`). This `run` body combines a
              // multi-target tap with a follow-up counter in one closure
              // specifically because no declarative shape here can reference
              // "one of the targets the PREVIOUS step picked" (see the
              // comment above `run`) — genuinely opaque to both static reads
              // and the runtime probe (arity-2 `run`, mutates real state).
              // Matches this card's own real `synergy.json` byte-for-byte
              // (the `putCounter`/stun source fact, and the "wants creatures
              // present to tap" sink fact). Not wired into
              // `apply-recognizers.mjs`/`synergy.json` generation. Each
              // entry's own annotation: `definition-annotations.json`, keyed
              // `"effects[0].modes[1].effects[0].authoredFact[<i>]"`.
              //
              // Mechanization pass (2026-09-14): both facts stay
              // hand-authored, declined for a new recognizer — this whole
              // effect is a `kind:'custom'` closure (see the comment above
              // `run`), so there is no structured `putCounterTarget`/
              // `tapTarget` `Effect` object anywhere on this card for a
              // recognizer to read in the first place (the SAME reasoning
              // `putCounterTarget-effect-structural.ts`'s own module doc
              // comment already gives for declining a DIFFERENT card's
              // "put a counter on it" pronoun-carryover case — here the
              // pronoun problem is even more fundamental: there is no
              // separate Effect object to check a "preceding tapTarget"
              // structural signal against at all, since both the tap and
              // the counter placement live inside the SAME opaque closure).
              authoredFact: [
                {
                  // [0]
                  role: 'source',
                  event: 'putCounter',
                  counterType: 'stun',
                  target: { types: { has: ['Creature'] } },
                  targeted: true,
                  value: 1,
                },
                {
                  // [1]
                  role: 'sink',
                  to: 'Battlefield',
                  types: { has: ['Creature'] },
                  value: 1,
                },
              ] satisfies AuthoredFact[],
            } satisfies Effect,
          ],
        },
      ],
    } satisfies Effect,
  ],
};
