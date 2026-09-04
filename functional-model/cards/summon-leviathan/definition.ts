import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

const TRIBAL_SUBTYPES = ['Kraken', 'Leviathan', 'Merfolk', 'Octopus', 'Serpent'];

export const summonLeviathan: CardDefinition = {
  name: 'Summon: Leviathan',
  manaCost: '{4}{U}{U}',
  typeLine: 'Enchantment Creature — Saga Leviathan',

  pt: [6, 6],
  keywords: ['Ward'],

  // A Saga's own lore-counter/chapter mechanism (714.3a/b) modeled as
  // named `triggers` (chapterI/II/III) — same simplification jecht-
  // reluctant-guardian-braska-s-final-aeon's own backFace comment
  // documents.
  triggers: [
    {
      name: 'chapterI',
      effects: [
        {
          // "Return EACH creature that ISN'T a Kraken/Leviathan/Merfolk/
          // Octopus/Serpent" — an exclude-by-subtype-list batch bounce.
          // `move`'s own declarative `validType` is only
          // 'creature'|'artifact'|'any', no subtype filter at all, so no
          // combination of its fields expresses "all creatures EXCEPT
          // these five subtypes" — `custom`, filtering the real
          // battlefield pool via `hasSubtype` (already exposed on every
          // wrapped Card) then calling the real `moveTo` action per match,
          // same subtype-filtering shape aerith-gainsborough's own onDies
          // effect already uses.
          kind: 'custom',
          describe: "return each creature that isn't a Kraken, Leviathan, Merfolk, Octopus, or Serpent to its owner's hand",
          run: (ctx: EffectContext, actions: Actions) => {
            const all = [...ctx.you.getCreaturesInPlay(), ...ctx.opponents.flatMap((p) => p.getCreaturesInPlay())];
            for (const creature of all) {
              if (!TRIBAL_SUBTYPES.some((st) => creature.hasSubtype(st))) actions.moveTo(creature, 'Hand');
            }
          },
        } satisfies Effect,
      ],
    },
    {
      // "Until end of turn, whenever a Kraken/Leviathan/Merfolk/Octopus/
      // Serpent attacks, draw a card" — GRANTS a new, temporary delayed
      // triggered ability; no mechanism anywhere in this model creates a
      // triggered ability at runtime (`triggers` is a fixed, named list on
      // `CardDefinition` itself). No-op `custom`, same treatment crystal-
      // fragments-summon-alexander's own damage-prevention chapters give a
      // different ungranted-delayed-trigger mechanic.
      name: 'chapterII',
      effects: [
        {
          kind: 'custom',
          describe: 'until end of turn, whenever a Kraken, Leviathan, Merfolk, Octopus, or Serpent attacks, draw a card',
          run: () => {},
        } satisfies Effect,
      ],
    },
    {
      name: 'chapterIII',
      effects: [
        {
          kind: 'custom',
          describe: 'until end of turn, whenever a Kraken, Leviathan, Merfolk, Octopus, or Serpent attacks, draw a card',
          run: () => {},
        } satisfies Effect,
      ],
    },
  ],
};
