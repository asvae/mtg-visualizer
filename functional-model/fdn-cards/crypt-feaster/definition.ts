import type { CardDefinition, Effect } from '../../card';

export const cryptFeaster: CardDefinition = {
  name: 'Crypt Feaster',
  manaCost: '{3}{B}',
  typeLine: 'Creature — Zombie',
  pt: [3, 4],

  keywords: ['Menace'],

  // Real Forge: `Mode$ Attacks | ValidCard$ Card.Self` — a real self-attack
  // auto-fire trigger, `on: 'attacks'`. The Threshold condition itself (7+
  // cards in graveyard) is now a real `Trigger.condition`
  // (`BoardStateCondition.kind:'graveyardCountAtLeast'`, 2026-09-18 schema-
  // completeness pass) — declaratively real but NOT itself engine-enforced
  // yet (`resolveCard` has no live `GameState` to check it against, Ward
  // pattern — see `engine-support-registry.ts`'s own
  // `board-state-condition-not-enforced` entry), so the pump still applies
  // every attack in practice, same as before this field existed; the real
  // gate is now at least structurally declared instead of silently
  // approximated as always-on.
  triggers: [
    {
      name: 'onAttack',
      on: 'attacks',
      condition: { kind: 'graveyardCountAtLeast', min: 7 },
      effects: [
        {
          kind: 'pumpSelf',
          power: 2,
          toughness: 0,
          untilEndOfTurn: true,
        } satisfies Effect,
      ],
    },
  ],
};
