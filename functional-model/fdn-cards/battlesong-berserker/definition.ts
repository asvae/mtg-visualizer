import type { CardDefinition, Effect } from '../../card';

export const battlesongBerserker: CardDefinition = {
  name: 'Battlesong Berserker',
  manaCost: '{3}{R}',
  typeLine: 'Creature — Human Berserker',
  pt: [3, 4],

  // Real Forge (battlesong_berserker.txt): `Mode$ AttackersDeclared |
  // AttackingPlayer$ You` — "Whenever YOU attack" (fires once per combat
  // when the controller declares any attacker(s)), genuinely broader than
  // `Trigger.on: 'attacks'` (which only ever fires for THIS card's own
  // self-attack, `ValidCard$ Card.Self`). No auto-fire `on` value covers
  // "whenever you attack" — kept as a name-only trigger, same "manually
  // invoked by a scenario" convention every other not-yet-auto-fired
  // trigger in this pool already uses (Namazu Trader's own onAttack, e.g.).
  triggers: [
    {
      name: 'onAttack',
      effects: [
        {
          kind: 'pumpTarget',
          power: 1,
          toughness: 0,
          owner: 'you',
          untilEndOfTurn: true,
        } satisfies Effect,
        {
          kind: 'grantKeywordTarget',
          keyword: 'Menace',
          owner: 'you',
          untilEndOfTurn: true,
        } satisfies Effect,
      ],
    },
  ],
};
