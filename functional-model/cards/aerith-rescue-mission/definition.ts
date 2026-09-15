import type { CardDefinition, Effect } from '../../card';
import { TOKENS } from '../../tokens.ts';
import { anyPlayer, applyToBound, bound, putCounter, selectUpTo, tap } from '../../combinator';

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
              // targets referenced across two steps — MIGRATED (2026-09-15,
              // per standing project policy that new/migrated custom-effect
              // logic uses the combinator DSL, not a raw closure) off a
              // `kind:'custom'` closure onto `combinator.ts`'s own
              // `SelectUpTo`/`BoundSet`/`ApplyToBound` vocabulary (added
              // this same pass specifically for this real "reference one of
              // a PREVIOUS step's own selected targets" shape — see that
              // file's own header). `selectUpTo` picks up to 3 distinct
              // creatures (ANY player's — `anyPlayer`, since the real text
              // has no owner restriction at all, unlike every prior migrated
              // closure's own `you`/`opponents`-scoped need) and binds them
              // as `'tapped'`; `then` taps EACH bound item (`bound('tapped')`
              // as the `Each` input), then applies a stun counter to index 0
              // of that same binding ("one of them" — this engine has no
              // player-decision system, so, same as every other
              // `optional`/pool-pick convention here, deterministically the
              // FIRST one actually picked, matching the closure this
              // replaces byte-for-byte).
              //
              // Now genuinely STRUCTURALLY readable (unlike the retired
              // opaque closure): `recognizers/selectUpTo-effect-structural.ts`
              // reads this exact `SelectUpTo{max, then:[each(bound,tap),
              // applyToBound(0,putCounter)]}` shape directly and derives
              // both the `putCounter`/stun SOURCE fact and the "wants
              // creatures present to tap" SINK fact — no more tier-3
              // `authoredFact`/`definition-annotations.json` entries needed
              // for either (the recognizer computes its own annotations, the
              // same "byproduct of matching" every other recognizer already
              // gets).
              kind: 'program',
              describe: 'tap up to three target creatures, then put a stun counter on one of them',
              program: selectUpTo(anyPlayer.creaturesInPlay(), 3, 'tapped', [
                { kind: 'each', input: bound('tapped'), action: tap() },
                applyToBound('tapped', 0, putCounter('stun', 1)),
              ]),
            } satisfies Effect,
          ],
        },
      ],
    } satisfies Effect,
  ],
};
