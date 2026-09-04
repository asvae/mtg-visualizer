import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  {
    // state.ts's own createToken fix (real subtypes derived from
    // TokenInfo.types) means the just-created Wizard token now genuinely
    // hasSubtype('Wizard') too — both the pre-existing nontoken Wizard AND
    // the freshly-made token get pumped +1/+0 and gain Lifelink, not just
    // the pre-existing one (the old, now-corrected behavior).
    result:
      'draws 2 cards, loses 2 life, creates a 0/1 black Wizard token, then pumps BOTH the pre-existing nontoken Wizard and the freshly-created token +1/+0 and grants both Lifelink',
    castFrom: 'hand',
    you: { creaturesCount: 1, creatureSubtypes: ['Wizard'] },
  },
  {
    result: 'draws 2 cards, loses 2 life, creates the token, then pumps that same freshly-created token +1/+0 and grants it Lifelink (the only Wizard on the battlefield)',
    castFrom: 'hand',
  },
];
