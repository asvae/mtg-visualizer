import type { Scenario } from '../../harness';
import { summonEsperRamuh } from './definition';

export const scenarios: Scenario[] = [
  {
    // PlayerState has no field to seed a noncreature/nonland graveyard
    // card (only `graveyardCreatureCount`, always type Creature) — X reads
    // live off the real graveyard (`ctx.you.getCardsIn('Graveyard')`), so
    // it's genuinely wired correctly, but this harness can only exercise
    // the X=0 case (empty graveyard).
    result: 'deals 0 damage to target creature an opponent controls (no noncreature, nonland cards in your graveyard — this harness has no field to seed one)',
    trigger: 'chapterI',
    opponents: [{ creaturesCount: 1 }],
  },
  { result: 'Wizards you control get +1/+0 until end of turn', trigger: 'chapterII', you: { creaturesCount: 2, creatureSubtypes: ['Wizard'] } },
  { result: 'no other Wizards present, no other creature is pumped', trigger: 'chapterII', you: { creaturesCount: 2 } },
  { result: 'Wizards you control get +1/+0 until end of turn', trigger: 'chapterIII', you: { creaturesCount: 1, creatureSubtypes: ['Wizard'] } },
];
