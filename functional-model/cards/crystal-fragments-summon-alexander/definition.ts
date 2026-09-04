import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

// A transforming DFC Equipment // Saga — same shape as jecht-reluctant-
// guardian-braska-s-final-aeon's own front/back split: `backFace` is a
// second independent CardDefinition, the Saga's chapter abilities become
// that face's own `triggers` named chapterI/II/III (same 714.3a/b
// turn-based-action-modeled-as-trigger simplification documented there).
//
// Crystal Fragments prints TWO activated abilities (plain Equip {1}, and
// the {5}{W}{W} sorcery-speed transform) but CardDefinition only has one
// `activationCost`/`effects` slot for a permanent's own activated ability —
// same one-slot constraint ninja-s-blades/definition.ts already lives with for
// a single Equip ability. The transform is the one worth modeling as real
// effects (it's what actually moves the object toward `backFace`); plain
// Equip {1} is left as static text, same treatment Ninja's Blades gives its
// own Job-select mechanic.
export const crystalFragmentsSummonAlexander: CardDefinition = {
  name: 'Crystal Fragments',
  manaCost: '{W}',
  typeLine: 'Artifact — Equipment',

  staticAbilities: ['Equipped creature gets +1/+1.', 'Equip {1}'],

  activationCost: '{5}{W}{W}',
  effects: [
    {
      kind: 'custom',
      describe: "exile this Equipment, then return it to the battlefield transformed under its owner's control (activate only as a sorcery)",
      run: (ctx: EffectContext, actions: Actions) => {
        actions.moveTo(ctx.self, 'Exile');
        actions.moveTo(ctx.self, 'Battlefield');
      },
    } satisfies Effect,
  ],

  backFace: {
    name: 'Summon: Alexander',
    manaCost: '',
    typeLine: 'Enchantment Creature — Saga Construct',
    keywords: ['Flying'],
    triggers: [
      {
        name: 'chapterI',
        effects: [
          {
            kind: 'custom',
            // A whole-turn damage-prevention shield — no prevention/
            // replacement-effect machinery exists anywhere in this model
            // (state.ts's own header explicitly rules out replacement
            // effects), so this stays a no-op `run` with the real text
            // carried only in `describe` for synergyTags() — same honest
            // treatment Namazu Trader's own "if you do" gate gets.
            describe: 'prevent all damage that would be dealt to creatures you control this turn',
            run: () => {},
          } satisfies Effect,
        ],
      },
      {
        name: 'chapterII',
        effects: [
          {
            kind: 'custom',
            describe: 'prevent all damage that would be dealt to creatures you control this turn',
            run: () => {},
          } satisfies Effect,
        ],
      },
      {
        name: 'chapterIII',
        effects: [
          {
            kind: 'custom',
            describe: 'tap all creatures your opponents control',
            run: (ctx: EffectContext, actions: Actions) => {
              for (const creature of ctx.opponents.flatMap((p) => p.getCreaturesInPlay())) actions.tap(creature);
            },
          } satisfies Effect,
        ],
      },
    ],
  },
};
