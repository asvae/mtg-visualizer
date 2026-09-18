import type { CardDefinition, Effect } from '../../card';

// Real Forge (searslicer_goblin.txt): `T:Mode$ Phase | Phase$ End of Turn |
// ValidPlayer$ You | CheckSVar$ RaidTest | ... | SVar:RaidTest:
// Count$AttackersDeclared` — the real, now-modelable Raid template
// (`Trigger.on:'endStep'` + `condition:{kind:'attackedThisTurn'}`,
// 2026-09-18 schema-completeness pass).
export const searslicerGoblin: CardDefinition = {
  name: 'Searslicer Goblin',
  manaCost: '{1}{R}',
  typeLine: 'Creature — Goblin Warrior',
  pt: [2, 1],

  triggers: [
    {
      name: 'onEndStepRaid',
      on: 'endStep',
      condition: { kind: 'attackedThisTurn' },
      effects: [
        {
          kind: 'createToken',
          token: { name: 'Goblin', manaCost: '0', types: ['Creature', 'Goblin'], basePower: 1, baseToughness: 1 },
          amount: 1,
        } satisfies Effect,
      ],
    },
  ],
};
