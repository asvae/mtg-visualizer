import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';
import { TOKENS } from '../../tokens.ts';

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
      kind: 'custom',
      describe: "exile Dion, then return it to the battlefield transformed under its owner's control (activate only as a sorcery)",
      run: (ctx: EffectContext, actions: Actions) => {
        actions.moveTo(ctx.self, 'Exile');
        actions.moveTo(ctx.self, 'Battlefield');
      },
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
            // notSelf exclusion either.
            kind: 'custom',
            describe: 'Wings of Light — put a +1/+1 counter on each other creature you control',
            run: (ctx: EffectContext, actions: Actions) => {
              for (const creature of ctx.you.getCreaturesInPlay().filter((c) => c.getId() !== ctx.self.getId())) actions.putCounter(creature, '+1/+1', 1);
            },
          } satisfies Effect,
          {
            // "Those creatures gain flying until end of turn" — the SAME
            // "each other creature you control" pool as the counters above,
            // now real and executable via `grantKeywordAll` (card.ts,
            // added 2026-09-09 — genuinely wasn't available when the
            // comment this replaces was first written). `notSelf: true`
            // matches the counters effect's own `.filter` exclusion.
            // Duration ("until end of turn") isn't tracked — same
            // documented `layers.ts`/`state.grantKeyword` simplification
            // every other keyword grant in this pool already accepts (the
            // grant persists for the rest of the scenario, not just until
            // end of turn).
            kind: 'grantKeywordAll',
            predicate: 'creatures-you-control',
            keyword: 'Flying',
            notSelf: true,
          } satisfies Effect,
        ],
      },
      {
        name: 'chapterII',
        effects: [
          {
            kind: 'custom',
            describe: 'Wings of Light — put a +1/+1 counter on each other creature you control',
            run: (ctx: EffectContext, actions: Actions) => {
              for (const creature of ctx.you.getCreaturesInPlay().filter((c) => c.getId() !== ctx.self.getId())) actions.putCounter(creature, '+1/+1', 1);
            },
          } satisfies Effect,
          {
            kind: 'grantKeywordAll',
            predicate: 'creatures-you-control',
            keyword: 'Flying',
            notSelf: true,
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
            // flag real Forge sets.
            kind: 'custom',
            describe: 'Gigaflare — exile Bahamut, then return it to the battlefield (front face up)',
            run: (ctx: EffectContext, actions: Actions) => {
              actions.moveTo(ctx.self, 'Exile');
              actions.moveTo(ctx.self, 'Battlefield');
            },
          } satisfies Effect,
        ],
      },
    ],
  },
};
