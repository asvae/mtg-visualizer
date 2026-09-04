import type { CardDefinition, Effect } from '../../card';

export const sahagin: CardDefinition = {
  name: 'Sahagin',
  manaCost: '{1}{U}',
  typeLine: 'Creature — Merfolk Warrior',

  pt: [1, 3],

  // "If at least four mana was spent to cast it" (real `ValidSA$
  // Spell.ManaSpent GE4`) is the trigger's own INTERVENING-IF condition —
  // this model has no mana-spent tracking anywhere, so (same convention
  // every other conditional trigger here uses — see Namazu Trader's own
  // "if you do" gate) the trigger firing at all already stands in for the
  // condition having been met.
  triggers: [
    {
      name: 'onNoncreatureSpellCast',
      effects: [
        { kind: 'putCounter', target: 'self', counterType: '+1/+1', amount: 1 } satisfies Effect,
        {
          // "and it can't be blocked this turn" — no unblockable-grant
          // action/Effect kind exists anywhere in this model (real Forge's
          // own `DB$ Effect | StaticAbilities$ Unblockable`, a temporary
          // granted static ability — the same category of thing
          // crystal-fragments-summon-alexander's own damage-prevention
          // chapter already documents as unmodelable). A no-op `custom`
          // with the real text carried only in `describe`.
          kind: 'custom',
          describe: "can't be blocked this turn",
          run: () => {},
        } satisfies Effect,
      ],
    },
  ],
};
