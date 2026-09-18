import type { CardDefinition, Effect } from '../../card';

export const makeYourMove: CardDefinition = {
  name: 'Make Your Move',
  manaCost: '{2}{W}',
  typeLine: 'Instant',

  effects: [
    {
      // "Destroy target artifact, enchantment, or creature with power 4 or
      // greater." — the target restriction is a three-way disjunction:
      // (artifact) OR (enchantment) OR (creature AND power >= 4). The
      // current `destroy` Effect schema can express only:
      // - validType:'creature' + minPower:4 → creatures with power >= 4 only
      // - validType:'permanent' + nonLand:true → all non-land permanents
      // (too broad, would also destroy creatures with power < 4)
      // There is no field or combination of fields to express the full
      // disjunctive target restriction faithfully. No-op custom purely so
      // synergyTags() still records the real text.
      kind: 'custom',
      describe:
        'destroy target artifact, enchantment, or creature with power 4 or greater (no Effect kind exists for disjunctive type-and-power-based target restrictions)',
      run: () => {},
    } satisfies Effect,
  ],
};
