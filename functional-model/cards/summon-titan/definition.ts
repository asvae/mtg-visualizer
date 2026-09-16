import type { CardDefinition, Effect, EffectContext } from '../../card';

// Real script (summon_titan.txt): a 3-chapter Saga with Reach/Trample as
// real base K: lines (in addition to what chapter III grants to another
// creature).
export const summonTitan: CardDefinition = {
  name: 'Summon: Titan',
  manaCost: '{3}{G}{G}',
  typeLine: 'Enchantment Creature — Saga Giant',

  pt: [7, 7],
  keywords: ['Reach', 'Trample'],

  triggers: [
    {
      // "Mill five cards." Real `DB$ Mill` — no separate `mill` Effect kind
      // exists (interfaces.ts's own `declare function mill` is never wired
      // into card.ts's Actions/Effect union), so the same `move`
      // (Library->Graveyard, unchosen) shape shinra-reinforcements' own
      // mill effect already uses.
      name: 'chapterI',
      effects: [{ kind: 'move', owner: 'you', from: 'Library', to: 'Graveyard', qty: 5 } satisfies Effect],
    },
    {
      // "Return all land cards from your graveyard to the battlefield
      // tapped." An UNCHOSEN "ALL" batch — `qty` computed live off the real
      // current graveyard land count (same `Computed`-qty pattern
      // the-final-days' own graveyard-count-driven token amount already
      // uses), so every matching land actually moves rather than a fixed
      // guess. "Tapped" isn't tracked (`move`'s declarative shape has no
      // tapped param, unlike `createToken`'s own `tapped?` field) — same
      // documentary-only gap chapter I of summon-fenrir already flags for
      // "enters tapped." NOTE: no `PlayerState` field seeds a land-typed
      // graveyard card either (only `graveyardCreatureCount` exists), so no
      // scenario below can exercise a nonzero return — same "real code,
      // untestable" situation summon-fenrir's own chapterI is in.
      name: 'chapterII',
      effects: [
        {
          kind: 'move',
          owner: 'you',
          from: 'Graveyard',
          to: 'Battlefield',
          validType: 'land',
          qty: (ctx: EffectContext) => ctx.you.getCardsIn('Graveyard').filter((c) => c.isLand()).length,
        } satisfies Effect,
      ],
    },
    {
      // "Until end of turn, another target creature you control gains
      // trample and gets +X/+X, where X is the number of lands you
      // control." Split into `pumpTarget` + `grantKeywordTarget` (same
      // "one printed ability, two declarative effects" shape haste-magic's
      // own comment documents) — `chooseTarget`'s deterministic
      // first-candidate pick lands both on the SAME creature since nothing
      // mutates the pool in between. X read live off `getLandsInPlay()`.
      // `notSelf: true` (2026-09-16 fix, fin/26-50 pass) — BOTH `pumpTarget`
      // and `grantKeywordTarget` DO have a real `notSelf` field (`card.ts`);
      // this file's own former comment predated both fields' addition and
      // was stale (same class of stale-comment bug fixed elsewhere this
      // session) — the real "ANOTHER target creature" restriction is now a
      // genuine, mechanically-enforced filter, not an accident of
      // `setupPlayer`'s own scenario-ordering (harness.ts).
      name: 'chapterIII',
      effects: [
        {
          kind: 'pumpTarget',
          owner: 'you',
          notSelf: true,
          power: (ctx: EffectContext) => ctx.you.getLandsInPlay().length,
          toughness: (ctx: EffectContext) => ctx.you.getLandsInPlay().length,
          // Real fix (2026-09-15): "Until end of turn, ... gains trample and
          // gets +X/+X" — this pump was silently PERMANENT-within-scenario
          // before (same missing-field bug this pass fixed pool-wide).
          untilEndOfTurn: true,
        } satisfies Effect,
        // recognizer-exception: grantKeywordTarget-effect-structural — the
        // real printed text is "Until end of turn, another target creature
        // you control gains trample AND GETS +X/+X" — "until end of turn"
        // is a SENTENCE-INITIAL prefix here (not the trailing "... gains
        // trample until end of turn" suffix shape this recognizer's own
        // confirmed template covers), and the keyword comes BEFORE the pump
        // clause, not after — a genuinely different real sentence order
        // with no other confirmed pool precedent yet; a confirmed mismatch
        // (real card-text variant), not a bug.
        { kind: 'grantKeywordTarget', keyword: 'Trample', validType: 'creature', owner: 'you', notSelf: true, untilEndOfTurn: true } satisfies Effect,
      ],
    },
  ],
};
