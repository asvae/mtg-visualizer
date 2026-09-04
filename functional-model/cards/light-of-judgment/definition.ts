import type { CardDefinition, Effect } from '../../card';

export const lightOfJudgment: CardDefinition = {
  name: 'Light of Judgment',
  manaCost: '{4}{R}',
  typeLine: 'Instant',

  effects: [
    // "Light of Judgment deals 6 damage to target creature" — real
    // ValidTgts$ Creature has no owner restriction (any player's creature).
    { kind: 'dealDamageTarget', amount: 6 } satisfies Effect,
    // "Destroy up to one Equipment attached to that creature" — genuinely
    // NOT modelable: no member of the `Card` interface (interfaces.ts) or
    // `wrapCard` (state.ts) exposes reading what a permanent is attached
    // to. `equip()` sets `RealCard.attachedToId` internally, but nothing
    // reads it back out through the typed `Card` surface any effect (even
    // `custom`) can see — there is no `getAttachedTo()`/`isAttachedTo()`
    // anywhere. Real text kept as documentation only, same "described but
    // not executed" treatment other genuinely-unbuildable clauses in this
    // batch get (see summon-leviathan's own chapterII/III no-op for the
    // precedent this follows).
    {
      kind: 'custom',
      describe: 'destroy up to one Equipment attached to that creature (not mechanically enforced — no attachment-query getter exists anywhere in this model)',
      run: () => {},
    } satisfies Effect,
  ],
};
