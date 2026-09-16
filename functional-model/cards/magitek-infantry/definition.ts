import type { CardDefinition, Effect } from '../../card';

export const magitekInfantry: CardDefinition = {
  name: 'Magitek Infantry',
  manaCost: '{W}',
  typeLine: 'Artifact Creature — Robot Soldier',

  // Real printed base P/T (data/fin/fin_scryfall.json, collector_number 25)
  // — without this, state.ts's own addCard silently defaults every creature
  // to a fake 1/1 (same real gap adelbert-steiner's own `pt` field closes;
  // happens to coincide with the real printed 1/1 here, but the field is
  // still the honest, explicit source of truth rather than an accidental
  // default).
  pt: [1, 1],

  // Real Forge `S:Mode$ Continuous | Affected$ Card.Self | AddPower$ 1 |
  // IsPresent$ Artifact.Other+YouCtrl` (`res/cardsfolder/m/magitek_infantry
  // .txt`) — a fixed +1/+0 bonus, fully on or fully off once you control
  // another real artifact (the `.Other+` excludes this permanent itself,
  // which IS an Artifact Creature), closed 2026-09-15 (fin/16-25 pass) via
  // `card.ts`'s new `ptFormula.kind:'thresholdBonus'` (same gap gaelicat's
  // own comment used to document, now real via `state.ts`'s `effectivePT`).
  ptFormula: { kind: 'thresholdBonus', power: 1, toughness: 0, condition: { type: 'Artifact', min: 1, excludeSelf: true } },

  // {2}{W}: Search your library for a card named Magitek Infantry, put it
  // onto the battlefield tapped, then shuffle — now a real declarative
  // `move` effect (closed 2026-09-15, fin/16-25 pass, `card.ts`'s new
  // `move.name:'self'`/`move.tapped` fields, real Forge `ChangeType$
  // Card.namedMagitek Infantry | Tapped$ True`), migrated off the old
  // `kind:'custom'` closure this effect used to need before those fields
  // existed. `shuffleAfter` is now a real `actions.shuffleLibrary` call
  // too (`move`'s own field), not just descriptive text.
  activationCost: '{2}{W}',
  effects: [
    {
      kind: 'move',
      owner: 'you',
      from: 'Library',
      to: 'Battlefield',
      qty: 1,
      name: 'self',
      tapped: true,
      shuffleAfter: true,
    } satisfies Effect,
  ],
};
