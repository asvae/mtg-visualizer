import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const summonGfCerberus: CardDefinition = {
  name: 'Summon: G.F. Cerberus',
  manaCost: '{2}{R}{R}',
  typeLine: 'Enchantment Creature — Saga Dog',

  pt: [3, 3],

  triggers: [
    { name: 'chapterI', effects: [{ kind: 'surveil', qty: 1 } satisfies Effect] },
    {
      // Real `DB$ DelayedTrigger | Mode$ SpellCast ... Execute$
      // EffTrigCopy1` / `DB$ CopySpellAbility` — a real delayed trigger
      // that copies a FUTURE, not-yet-cast instant/sorcery spell. No
      // mechanism anywhere in this engine represents copying a spell at
      // all (no stack, no spell-copy action), so this is a genuine no-op
      // `custom`, same shape summon-brynhildr's own Gestalt Mode chapters
      // use.
      name: 'chapterII',
      effects: [
        {
          kind: 'custom',
          describe: 'Double — when you next cast an instant or sorcery spell this turn, copy it, you may choose new targets for the copy (no spell-copy mechanism exists in this engine)',
          run: (_ctx: EffectContext, _actions: Actions) => {},
        } satisfies Effect,
      ],
    },
    {
      name: 'chapterIII',
      effects: [
        {
          kind: 'custom',
          describe: 'Triple — when you next cast an instant or sorcery spell this turn, copy it twice, you may choose new targets for the copies (no spell-copy mechanism exists in this engine)',
          run: (_ctx: EffectContext, _actions: Actions) => {},
        } satisfies Effect,
      ],
    },
  ],
};
