import type { CardDefinition, Effect } from '../../card';
import { TOKENS } from '../../tokens.ts';
import { putCounter, sequence, you } from '../../combinator';

// A transforming DFC Legendary Creature // Saga — same shape as jecht-
// reluctant-guardian-braska-s-final-aeon (front-face damage trigger reused
// here as the {4}{W}{W}, {T} exile-then-return activated ability instead;
// backFace's own Saga chapters become named triggers, same 714.3a/b
// simplification documented there).
export const dionBahamutsDominant: CardDefinition = {
  name: "Dion, Bahamut's Dominant",
  manaCost: '{3}{W}',
  typeLine: 'Legendary Creature — Human Noble Knight',
  pt: [3, 3],

  // "Dragonfire Dive — During your turn, Dion and other Knights you
  // control have flying" — real, QUERY-TIME continuous keyword grant
  // (ENGINE_GAPS.md gap #14, closed 2026-09-12): `state.ts`'s own
  // `effectiveKeywords` re-evaluates this live off `state.activePlayerId`
  // every time Dion's (or a Knight's) keywords are read, so it genuinely
  // turns on/off as turns pass in a real engine-piloted playthrough —
  // `includeSelf: true` (Dion himself), `subtype: 'Knight'` (every OTHER
  // Knight you control), `onlyDuringYourTurn: true`.
  continuousKeywordGrants: [{ keywords: ['Flying'], includeSelf: true, subtype: 'Knight', onlyDuringYourTurn: true }],

  triggers: [
    {
      name: 'onEnter',
      // Real 603.6b "enters the battlefield" trigger — `on: 'enter'` wires
      // this to `engine.ts`'s own real auto-fire on `resolveTop` (same
      // convention Jill, Shiva's Dominant/Cloud, Midgar Mercenary's own
      // onEnter both use), needed for the real engine-piloted scenario
      // below (2026-09-11 consolidation) to demonstrate this token ETB for
      // real rather than a scenario naming the trigger explicitly.
      on: 'enter',
      effects: [{ kind: 'createToken', token: TOKENS.w_2_2_knight, amount: 1 } satisfies Effect],
    },
  ],

  activationCost: '{4}{W}{W}, {T}',
  effects: [
    {
      // MIGRATED (2026-09-14) off a `kind:'custom'` closure onto the real
      // `combinator.ts` AST — a plain `Sequence` of two fixed, self-targeted
      // `moveSelf` steps, same shape crystal-fragments-summon-alexander's
      // own front-face transform (and this card's own chapter III below)
      // both use.
      //
      // Authored via `combinator.ts`'s own fluent builder layer (2026-09-14
      // follow-up — SAME AST as before, just not a raw nested object
      // literal).
      kind: 'program',
      describe: "exile Dion, then return it to the battlefield transformed under its owner's control (activate only as a sorcery)",
      program: sequence('Exile', 'Battlefield'),
    } satisfies Effect,
  ],

  backFace: {
    name: 'Bahamut, Warden of Light',
    manaCost: '',
    typeLine: 'Legendary Enchantment Creature — Saga Dragon',
    pt: [5, 5],
    keywords: ['Flying'],
    triggers: [
      {
        name: 'chapterI',
        effects: [
          {
            // "Put a +1/+1 counter on each OTHER creature you control"
            // (StrictlyOther) is a board-wide broadcast excluding self —
            // `putCounter` is self-only, `putCounterTarget` is a CHOSEN
            // pool, and `pumpAll` (the closest board-wide shape) has no
            // notSelf exclusion either. MIGRATED (2026-09-14) off a
            // `kind:'custom'` closure onto the real `combinator.ts` AST — a
            // `Filter`-narrowed (`excludeSelf`) `Each` over
            // `creaturesInPlay(you)`.
            kind: 'program',
            describe: 'Wings of Light — put a +1/+1 counter on each other creature you control',
            program: you.creaturesInPlay().filter('excludeSelf').each(putCounter('+1/+1', 1)),
          } satisfies Effect,
          {
            // "Those creatures gain flying until end of turn" — the SAME
            // "each other creature you control" pool as the counters above,
            // now real and executable via `grantKeywordAll` (card.ts,
            // added 2026-09-09 — genuinely wasn't available when the
            // comment this replaces was first written). `notSelf: true`
            // matches the counters effect's own `.filter` exclusion.
            // `untilEndOfTurn: true` (real 514.2 Cleanup removal, added
            // 2026-09-12 same pass as this bug's own root-cause fix — see
            // state.ts's own `grantKeyword`/`clearUntilEndOfTurnKeywordGrants`
            // doc comments): a REAL regression was found and fixed here —
            // without this flag, the grant is permanent-within-scenario
            // (this pool's own long-standing accepted default for every
            // OTHER "until end of turn" grantKeyword* use), which used to
            // be harmless (no card's own scenario ever crossed enough real
            // turns for it to matter) until THIS card's real multi-turn
            // engine-piloted scenario made it visibly wrong — the Knight
            // token kept showing Flying in the replay UI through the
            // opponent's own subsequent turns, forever, once this chapter
            // fired. Confirmed live: the icon now correctly disappears at
            // the very next real Cleanup step.
            kind: 'grantKeywordAll',
            predicate: 'creatures-you-control',
            keyword: 'Flying',
            notSelf: true,
            untilEndOfTurn: true,
          } satisfies Effect,
        ],
      },
      {
        name: 'chapterII',
        effects: [
          {
            // Same MIGRATED shape as chapter I above (2026-09-14) — a
            // `Filter`-narrowed (`excludeSelf`) `Each` over
            // `creaturesInPlay(you)`.
            kind: 'program',
            describe: 'Wings of Light — put a +1/+1 counter on each other creature you control',
            program: you.creaturesInPlay().filter('excludeSelf').each(putCounter('+1/+1', 1)),
          } satisfies Effect,
          {
            // Same `untilEndOfTurn: true` fix as chapter I above.
            kind: 'grantKeywordAll',
            predicate: 'creatures-you-control',
            keyword: 'Flying',
            notSelf: true,
            untilEndOfTurn: true,
          } satisfies Effect,
        ],
      },
      {
        name: 'chapterIII',
        effects: [
          // Real script (dion_bahamuts_dominant_bahamut_warden_of_light.txt,
          // ALTERNATE face): `SVar:DBGigaflare:DB$ Destroy | ValidTgts$
          // Permanent` — no controller restriction ("destroy target
          // permanent," not "target permanent an opponent controls"), so no
          // `owner` field belongs here (an `owner: 'opponents'` restriction
          // would misrepresent the real, unrestricted card). See
          // scenarios.ts's own comment on the resulting self-destroy.
          { kind: 'destroy', validType: 'permanent', qty: 1 } satisfies Effect,
          {
            // "Exile Bahamut, then return it to the battlefield (front face
            // up)" — same exile/return simplification the front face's own
            // transform ability uses (this model has no notion of "which
            // face is showing" as tracked state beyond `backFace` being a
            // second static CardDefinition), just without the `Transformed$`
            // flag real Forge sets. MIGRATED (2026-09-14) off a
            // `kind:'custom'` closure onto the real `combinator.ts` AST —
            // the same 2-step `Sequence` shape used by the front face's own
            // transform ability above.
            kind: 'program',
            describe: 'Gigaflare — exile Bahamut, then return it to the battlefield (front face up)',
            program: sequence('Exile', 'Battlefield'),
          } satisfies Effect,
        ],
      },
    ],
  },
};
