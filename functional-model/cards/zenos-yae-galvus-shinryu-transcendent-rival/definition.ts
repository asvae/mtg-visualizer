import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';
import type { Card } from '../../interfaces';

export const zenosYaeGalvus: CardDefinition = {
  name: 'Zenos yae Galvus',
  manaCost: '{3}{B}{B}',
  typeLine: 'Legendary Creature — Human Noble Warrior',

  pt: [4, 4],

  triggers: [
    {
      name: 'onEnter',
      effects: [
        {
          // "My First Friend — choose a creature an opponent controls.
          // Until end of turn, creatures OTHER THAN CARDNAME AND THE CHOSEN
          // CREATURE get -2/-2" — a board-wide broadcast across BOTH
          // players' creatures excluding two specific cards (self + a
          // dynamically chosen one). `pumpAll`'s own predicate only covers
          // 'creatures-you-control' with a single `notSelf` exclusion — no
          // declarative shape here supports a two-player, two-exclusion
          // broadcast, so this genuinely executes the real mutation via
          // `custom` (not a no-op) the same way aerith-rescue-mission's own
          // "tap 3, counter one of them" custom does for an equally
          // uncombinable shape.
          kind: 'custom',
          describe: 'choose a creature an opponent controls; until end of turn, creatures other than Zenos and the chosen creature get -2/-2',
          run: (ctx: EffectContext, actions: Actions) => {
            const pool = ctx.opponents.flatMap((p) => p.getCreaturesInPlay());
            if (pool.length === 0) return;
            const chosen = actions.chooseTarget(pool);
            const all: Card[] = [...ctx.you.getCreaturesInPlay(), ...ctx.opponents.flatMap((p) => p.getCreaturesInPlay())];
            for (const creature of all) {
              if (creature.getId() === ctx.self.getId() || creature.getId() === chosen.getId()) continue;
              actions.pump(creature, -2, -2);
            }
          },
        } satisfies Effect,
      ],
    },
    {
      // "When the chosen creature leaves the battlefield, transform
      // CARDNAME" — WHICH creature was chosen isn't remembered across
      // separate trigger firings in this model (no persistent
      // "remembered object" state); a scenario firing this named trigger
      // already stands in for "the chosen creature is the one that left,"
      // same convention every other condition-gated trigger name in this
      // batch uses (see e.g. sidequest-hunt-the-mark's own onEndStep).
      name: 'onChosenCreatureLeaves',
      effects: [
        {
          kind: 'custom',
          describe: "transform Zenos yae Galvus (represented as exile-then-return, mirroring jecht-reluctant-guardian-braska-s-final-aeon's own convention)",
          run: (ctx: EffectContext, actions: Actions) => {
            actions.moveTo(ctx.self, 'Exile');
            actions.moveTo(ctx.self, 'Battlefield');
          },
        } satisfies Effect,
      ],
    },
  ],

  backFace: {
    name: 'Shinryu, Transcendent Rival',
    manaCost: '',
    typeLine: 'Legendary Creature — Dragon',

    pt: [8, 8],
    keywords: ['Flying'],

    triggers: [
      {
        // "As this creature transforms into NICKNAME, choose an opponent"
        // (a real transform-time replacement effect setting persistent
        // "chosen player" state) then "Burning Chains — when the chosen
        // player loses the game, you win the game." Two genuine gaps: no
        // EffectContext/CardDefinition field tracks a persistent "chosen
        // player" across a transform, and no Effect kind exists anywhere in
        // this model for "a player loses the game"/"you win the game" (the
        // same missing primitive summon-primal-odin's own Zantetsuken hits
        // — see this batch's final report). No-op custom purely so
        // synergyTags() still records the real text.
        name: 'onChosenPlayerLosesGame',
        effects: [
          {
            kind: 'custom',
            describe:
              'Burning Chains — when the chosen player loses the game, you win the game (no winGame/loseGame Effect kind exists, and "chosen player" from the transform-time replacement effect is not tracked as persistent state here)',
            run: () => {},
          } satisfies Effect,
        ],
      },
    ],
  },
};
