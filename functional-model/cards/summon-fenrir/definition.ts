import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

// Real script (summon_fenrir.txt): a 3-chapter Saga.
export const summonFenrir: CardDefinition = {
  name: 'Summon: Fenrir',
  manaCost: '{2}{G}',
  typeLine: 'Enchantment Creature — Saga Wolf',

  pt: [3, 2],

  triggers: [
    {
      // "Crescent Fang — Search your library for a basic land card, put it
      // onto the battlefield tapped, then shuffle." `move`'s own
      // declarative `validType` is type-only ('land' matches ANY land, no
      // Basic-supertype filter) — same gap call-the-mountain-chocobo's own
      // Mountain-subtype search already documents for `move` — so this is
      // `custom`, filtering the real library by `isLand()` (the closest
      // available predicate; the Basic restriction itself isn't
      // representable). NOTE: no `PlayerState` field seeds a land-typed
      // library card at all (every generic library filler `setupPlayer`
      // makes has `types: []`), so — same "real code, untestable" gap
      // call-the-mountain-chocobo/delivery-moogle already flag — no
      // scenario below can exercise the found-a-land branch, only the
      // none-found branch. "Enters tapped"/"then shuffle" have no
      // observable consequence in this model (moveTo has no tapped param;
      // shuffle order is never read).
      name: 'chapterI',
      effects: [
        {
          kind: 'custom',
          describe: 'search your library for a basic land card, put it onto the battlefield tapped, then shuffle',
          run: (ctx: EffectContext, actions: Actions) => {
            const pool = ctx.you.getCardsIn('Library').filter((c) => c.isLand());
            if (pool.length === 0) return;
            const found = actions.chooseTarget(pool);
            actions.moveTo(found, 'Battlefield');
          },
        } satisfies Effect,
      ],
    },
    {
      // "Heavenward Howl — When you next cast a creature spell this turn,
      // that creature enters with an additional +1/+1 counter on it." A
      // GRANTED, temporary delayed triggered ability — no mechanism
      // anywhere in this model creates a new triggered ability at runtime
      // (`triggers` is a fixed, named list on `CardDefinition` itself).
      // No-op `custom`, same treatment summon-leviathan's own chapterII/III
      // give this identical shape of mechanic.
      name: 'chapterII',
      effects: [
        {
          kind: 'custom',
          describe: 'when you next cast a creature spell this turn, that creature enters with an additional +1/+1 counter on it',
          run: () => {},
        } satisfies Effect,
      ],
    },
    {
      // "Ecliptic Growl — Draw a card if you control the creature with the
      // greatest power or tied for the greatest power." Real
      // `ConditionPresent$ Creature.YouCtrl | ConditionCompare$ GE1` (you
      // must control at least one creature) AND `YourFerocity GE
      // OppsFerocity` (your greatest power >= the greatest power among
      // creatures you don't control) — both real, live board-state
      // comparisons, exactly `Computed`'s own reference case (card.ts's own
      // doc comment cites Beza's "if an opponent has more life than you"
      // for this same shape).
      name: 'chapterIII',
      effects: [
        {
          kind: 'drawCard',
          amount: (ctx: EffectContext) => {
            const yourCreatures = ctx.you.getCreaturesInPlay();
            if (yourCreatures.length === 0) return 0;
            const yourMax = Math.max(...yourCreatures.map((c) => c.getNetPower()));
            const oppCreatures = ctx.opponents.flatMap((o) => o.getCreaturesInPlay());
            const oppMax = oppCreatures.length ? Math.max(...oppCreatures.map((c) => c.getNetPower())) : 0;
            return yourMax >= oppMax ? 1 : 0;
          },
        } satisfies Effect,
      ],
    },
  ],
};
