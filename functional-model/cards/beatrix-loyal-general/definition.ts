import type { CardDefinition, Effect } from '../../card';
import { equipTo, selectUpTo, you } from '../../combinator';

// Real script (beatrix_loyal_general.txt).
export const beatrixLoyalGeneral: CardDefinition = {
  name: 'Beatrix, Loyal General',
  manaCost: '{4}{W}{W}',
  typeLine: 'Legendary Creature — Human Soldier',

  pt: [4, 4],
  keywords: ['Vigilance'],

  triggers: [
    {
      // "you may attach any number of Equipment you control to target
      // creature you control" — real `DB$ Attach | Object$ Valid
      // Equipment.YouCtrl` with no `Amount$` (an UNBOUNDED batch, not one
      // chosen Equipment), so this needs `custom`: `equip`'s own
      // declarative shape (see card.ts's `Effect` union) has no batch
      // variant, only the single attach-to-a-chosen-target step every
      // other Equipment's own activationCost uses via `actions.equip`
      // directly (coral-sword/buster-sword, e.g.) — composing that SAME
      // real action across every Equipment on the battlefield is not a new
      // capability, just this effect's own real "any number" plurality.
      // "you may" is documentary only (no legal-but-declined engine exists
      // — see card.ts's own doc comment on `move`/`sacrifice`'s own
      // `optional` field for the same convention): the attach always
      // happens when a legal target/Equipment exists.
      name: 'onBeginCombat',
      effects: [
        {
          // Migrated 2026-09-16 off a `kind:'custom'` closure onto the
          // combinator DSL: `selectUpTo(..., 1, 'target', ...)` picks the
          // one target creature (same `actions.chooseTarget` pool-
          // exhaustion loop the original closure used), then a nested
          // `Each` over the real Equipment pool (`cardType:'artifact'` +
          // `subtype:'Equipment'`, the same Equipment-⊂-Artifact narrowing
          // the original closure's own `isArtifact() &&
          // hasSubtype('Equipment')` used) applies `equipTo('target', 0)` —
          // the SAME real batch-attach-onto-one-bound-target shape this
          // action was built for. Same real behavior, now
          // recognizer-readable data instead of an opaque closure.
          kind: 'program',
          describe: 'you may attach any number of Equipment you control to target creature you control',
          program: selectUpTo(you.creaturesInPlay(), 1, 'target', [you.permanentsInPlay().filter('cardType', 'artifact').filter('subtype', 'Equipment').each(equipTo('target', 0))]),
        } satisfies Effect,
      ],
    },
  ],
};
