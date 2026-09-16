import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const ardynTheUsurper: CardDefinition = {
  name: 'Ardyn, the Usurper',
  manaCost: '{5}{B}{B}{B}',
  typeLine: 'Legendary Creature — Elder Human Noble',

  pt: [4, 4],

  // "Demons you control have menace, lifelink, and haste" — real,
  // QUERY-TIME continuous keyword grant (ENGINE_GAPS.md gap #14, closed
  // 2026-09-12): real oracle text checked fresh, genuinely UNCONDITIONAL
  // (no "during your turn"/other timing restriction, unlike Dion, Bahamut's
  // Dominant's own Dragonfire Dive) — `includeSelf: false` (Ardyn himself
  // isn't a Demon — "Elder Human Noble"), `subtype: 'Demon'`, no
  // `onlyDuringYourTurn`. `state.ts`'s own `effectiveKeywords` makes this
  // functionally real, not just a label: a Demon's granted Haste really
  // exempts summoning sickness (`engine.ts`'s own `canAttack`/
  // `canActivateAbility`), and granted Lifelink really triggers
  // `state.dealDamage`'s own life-gain path.
  continuousKeywordGrants: [{ keywords: ['Menace', 'Lifelink', 'Haste'], includeSelf: false, subtype: 'Demon' }],

  triggers: [
    {
      name: 'onBeginCombat',
      effects: [
        {
          // "exile up to one target creature card from A graveyard [any
          // player's]. If you exiled a card this way, create a token
          // that's a copy of that card, except it's a 5/5 black Demon." —
          // `createToken`'s own `TokenInfo` is fixed, static data (no
          // "copy whatever was just chosen" shape), so the token has to be
          // built from the real chosen card's own `getName()` at
          // resolution time — genuinely dynamic, `custom` is the honest
          // shape (same "read a real object, build a TokenInfo from it"
          // pattern this repo has no cleaner declarative alternative for).
          // Color isn't tracked on a token/RealCard anywhere in this model
          // (no color field exists) — "black" stays in `describe` only.
          //
          // NOTE (2026-09-16, engine-core, coordinator-routed fin/76-100
          // re-triage — documented, not built): real Forge (`ardyn_the_
          // usurper.txt`) implements this as a genuine `DB$ CopyPermanent |
          // Defined$ Remembered | SetPower$5 | SetToughness$5 | SetColor$
          // Black | SetCreatureTypes$Demon` — a real "copy the exiled
          // card's OWN copiable values (601.2h: name, other types,
          // abilities, etc.), then override P/T/color/creature-type" effect.
          // This closure only ever copies the exiled card's NAME onto a
          // fresh, blank token — none of its own keywords/abilities/other
          // printed characteristics carry over (e.g. if the exiled creature
          // had Flying or an ETB trigger, the token here would have
          // neither). A real `state.copyPermanent(source, controller)`
          // primitive already exists (state.ts) and DOES copy keywords/
          // types/subtypes/base P&T from a real battlefield `RealCard` —
          // but (1) it takes a `Card`, whose read-only interface has no
          // `getKeywords()` (only `hasKeyword(single)`), so there's no way
          // to enumerate a chosen card's own full keyword set from a
          // `custom` effect to feed into `TokenInfo.keywords` even if this
          // effect tried; and (2) Forge's own real "except" overrides
          // (power/toughness/color/creature-type) have no post-copy mutator
          // on the `Card` interface either. A real fix needs BOTH a general
          // "copy with overrides" capability (no existing recognizer/
          // vocabulary covers a copy-effect at ALL — `token-creation-
          // structural.ts` only recognizes fixed `TOKENS`-registry creates,
          // never a copy) and a `getKeywords()`-style read. Checked: this is
          // the ONLY real card in the pool needing a copy-with-overrides
          // token — not worth the structural addition for a singleton;
          // documented as a real, deliberate narrowing (same category as
          // "a basic land card" narrowed to "a land card" elsewhere in this
          // pool), not silently absent. See ENGINE_GAPS.md's own dated entry
          // for the full write-up.
          kind: 'custom',
          describe: "exile up to one target creature card from a graveyard; if exiled, create a token copy of it, except it's a 5/5 black Demon",
          run: (ctx: EffectContext, actions: Actions) => {
            const pool = [...ctx.you.getCardsIn('Graveyard'), ...ctx.opponents.flatMap((p) => p.getCardsIn('Graveyard'))].filter((c) => c.isCreature());
            if (pool.length === 0) return;
            const target = actions.chooseTarget(pool);
            actions.moveTo(target, 'Exile');
            actions.createToken(ctx.you, { name: target.getName(), manaCost: '0', types: ['Creature', 'Demon'], basePower: 5, baseToughness: 5 }, 1);
          },
        } satisfies Effect,
      ],
    },
  ],
};
