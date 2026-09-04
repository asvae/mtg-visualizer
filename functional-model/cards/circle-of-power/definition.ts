import type { CardDefinition, Effect } from '../../card';

export const circleOfPower: CardDefinition = {
  name: 'Circle of Power',
  manaCost: '{3}{B}',
  typeLine: 'Sorcery',

  effects: [
    { kind: 'drawCard', amount: 2 } satisfies Effect,
    { kind: 'loseLife', owner: 'you', amount: 2 } satisfies Effect,
    // Real `TokenScript$ b_0_1_wizard_snipe` — not in this repo's shared
    // `tokens.ts` registry (BLB-scoped, plus a couple ad hoc FIN entries;
    // this exact 0/1 black Wizard-with-granted-ability token isn't among
    // them), so built inline, same as moogles-valor's own ad hoc Moogle
    // token. The token's own granted ability ("whenever you cast a
    // noncreature spell, this token deals 1 damage to each opponent") has
    // no field on `TokenInfo` to carry it (no keywords/abilities field at
    // all — same gap moogles-valor's own comment documents for a token's
    // Lifelink) — real text only, via this same token also being made by
    // cornered-by-black-mages (that card's own comment doesn't repeat this
    // one).
    { kind: 'createToken', token: { name: 'Wizard', manaCost: '0', types: ['Creature', 'Wizard'], basePower: 0, baseToughness: 1 }, amount: 1 } satisfies Effect,
    // "Wizards you control get +1/+0 and gain lifelink until end of turn"
    // (`SVar:DBPumpAll:DB$ PumpAll | ValidCards$ Wizard.YouCtrl | NumAtt$ +1
    // | KW$ Lifelink`) — both real gaps this used to need `custom` for are
    // now closed: `pumpAll` has its own `subtype` filter (mirrors
    // `putCounterAll`'s), and `grantKeywordAll` exists for the real,
    // mechanically-enforced Lifelink grant. The Wizard token THIS SAME
    // resolution just created (above) IS picked up by both — `state.ts`'s
    // own `GameState.createToken()` now derives a made token's real
    // subtypes from `TokenInfo.types` (today's fix; a token whose `types`
    // includes `'Wizard'` really does `hasSubtype('Wizard')`), confirmed via
    // this card's own scenarios below.
    { kind: 'pumpAll', predicate: 'creatures-you-control', power: 1, toughness: 0, subtype: 'Wizard' } satisfies Effect,
    { kind: 'grantKeywordAll', predicate: 'creatures-you-control', keyword: 'Lifelink', subtype: 'Wizard' } satisfies Effect,
  ],
};
