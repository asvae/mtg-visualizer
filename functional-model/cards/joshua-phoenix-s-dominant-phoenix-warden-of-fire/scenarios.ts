import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { joshuaPhoenixsDominant } from './definition';

export const scenarios: Scenario[] = [
  { result: 'discards 2 cards, then draws 2 cards', trigger: 'onEnter', you: { handCount: 2, libraryCount: 2 } },
  { result: "exiles Joshua and returns it transformed into Phoenix, Warden of Fire" },
  { result: 'Rising Flames: deals 2 damage to each opponent', face: 'back', trigger: 'chapterI', opponents: [{}] },
  { result: 'Rising Flames: deals 2 damage to each opponent', face: 'back', trigger: 'chapterII', opponents: [{}] },
  {
    result: "Flames of Rebirth: returns creature cards from your graveyard to the battlefield, then exiles Phoenix and returns it front face up (total mana value cap not tracked, see definition.ts)",
    face: 'back',
    trigger: 'chapterIII',
    you: { graveyardCreatureCount: 2 },
  },
  // Lifelink lives only on the back face (Phoenix, Warden of Fire) —
  // `keywordScenarios` only reads the FRONT CardDefinition's own
  // `keywords`/typeLine, so the back face's own Lifelink probe is written
  // by hand here, same convention vincent-valentine-galian-beast's own
  // scenarios.ts already establishes for its own back-face-only Lifelink.
  { result: 'Lifelink: deals 3 combat damage to an opponent', face: 'back', dealsCombatDamage: { amount: 3 } },
  ...keywordScenarios(joshuaPhoenixsDominant),
];
