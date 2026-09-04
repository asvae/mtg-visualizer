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
      // NOTE: neither `pumpTarget` nor `grantKeywordTarget` has a `notSelf`
      // field (unlike `pumpAll`/`move`/`sacrifice`, which do) — the real
      // "ANOTHER target creature" restriction isn't a hard filter here.
      // Demonstrated correctly anyway because `setupPlayer` adds every
      // scenario creature BEFORE `self` is pushed onto the battlefield
      // (harness.ts), so `self` is never `pool[0]` as long as at least one
      // other creature you control exists — real but ORDER-dependent, not
      // mechanically enforced; with zero other creatures the model would
      // incorrectly let this target `self`.
      name: 'chapterIII',
      effects: [
        {
          kind: 'pumpTarget',
          owner: 'you',
          power: (ctx: EffectContext) => ctx.you.getLandsInPlay().length,
          toughness: (ctx: EffectContext) => ctx.you.getLandsInPlay().length,
        } satisfies Effect,
        { kind: 'grantKeywordTarget', keyword: 'Trample', validType: 'creature', owner: 'you' } satisfies Effect,
      ],
    },
  ],
};
