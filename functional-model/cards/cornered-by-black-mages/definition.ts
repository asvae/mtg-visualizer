import type { CardDefinition, Effect } from '../../card';

export const corneredByBlackMages: CardDefinition = {
  name: 'Cornered by Black Mages',
  manaCost: '{1}{B}{B}',
  typeLine: 'Sorcery',

  effects: [
    // "Target opponent sacrifices a creature of their choice" — `owner:
    // 'opponents'` hits every opponent, the same established simplification
    // this batch's other "target opponent" effects use (no single-chosen-
    // opponent Effect shape exists — see al-bhed-salvagers' own comment).
    { kind: 'sacrifice', owner: 'opponents', validType: 'creature' } satisfies Effect,
    // Real `TokenScript$ b_0_1_wizard_snipe` — same ad hoc inline token
    // circle-of-power's own effect builds (that card's own comment covers
    // the granted-ability gap this token also has).
    { kind: 'createToken', token: { name: 'Wizard', manaCost: '0', types: ['Creature', 'Wizard'], basePower: 0, baseToughness: 1 }, amount: 1 } satisfies Effect,
  ],
};
