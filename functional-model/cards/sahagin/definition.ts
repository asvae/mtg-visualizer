import type { CardDefinition, Effect } from '../../card';

export const sahagin: CardDefinition = {
  name: 'Sahagin',
  manaCost: '{1}{U}',
  typeLine: 'Creature — Merfolk Warrior',

  pt: [1, 3],

  triggers: [
    {
      // Real: `T:Mode$ SpellCast | ValidCard$ Card.nonCreature |
      // ValidActivatingPlayer$ You | ... | ValidSA$ Spell.ManaSpent GE4 |
      // Execute$ TrigPutCounter | TriggerDescription$ Whenever you cast a
      // noncreature spell, if at least four mana was spent to cast it, put
      // a +1/+1 counter on this creature and it can't be blocked this
      // turn.` (`tmp/mtg-forge/forge-gui/res/cardsfolder/s/sahagin.txt`).
      // Named `onCastNoncreatureSpell4Mana` — the SAME name/convention
      // The Prima Vista's own identical-shaped trigger already established
      // (fin/64, `ValidSA$ Spell.ManaSpent GE4`, `TRIGGER_EVENT_MAP` already
      // maps it to `'cast'`) rather than inventing a differently-worded
      // name for the same real condition. "If at least four mana was spent"
      // is documentary only (this model has no mana-spent tracking
      // anywhere — checked, same real, still-open gap The Prima Vista's own
      // progress.json documents in full) — a scenario firing this named
      // trigger already stands in for the condition having been met, same
      // convention every other conditional trigger name in this pool uses.
      name: 'onCastNoncreatureSpell4Mana',
      effects: [
        { kind: 'putCounter', target: 'self', counterType: '+1/+1', amount: 1 } satisfies Effect,
        // "and it can't be blocked this turn" — real `grantKeywordSelf`
        // mutation (state.ts's `grantKeyword`: pushes 'Unblockable' onto
        // the real card's own `keywords`, genuinely checked by
        // `engine.ts`'s `canBlock`/`declareBlockers`), `untilEndOfTurn`
        // real 514.2 Cleanup expiry — no longer the no-op `custom` this
        // card used before `'Unblockable'`/`grantKeywordSelf` existed.
        { kind: 'grantKeywordSelf', keyword: 'Unblockable', untilEndOfTurn: true } satisfies Effect,
      ],
    },
  ],
};
