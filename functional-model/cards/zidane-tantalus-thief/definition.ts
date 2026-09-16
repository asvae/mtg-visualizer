import type { CardDefinition, Effect } from '../../card';
import { TOKENS } from '../../tokens.ts';
import { selectUpTo, applyToBound, gainControl, untap, grantKeyword, opponents } from '../../combinator';

export const zidaneTantalusThief: CardDefinition = {
  name: 'Zidane, Tantalus Thief',
  manaCost: '{3}{R}{W}',
  typeLine: 'Legendary Creature — Human Mutant Scout',

  pt: [3, 3],

  triggers: [
    {
      // "When Zidane enters, gain control of target creature an opponent
      // controls until end of turn. Untap that creature. It gains lifelink
      // and haste until end of turn." Migrated (2026-09-16, coordinator-
      // routed pilot-triage escalation) off a raw `custom` closure onto
      // `kind:'program'`'s own `SelectUpTo`/`ApplyToBound` combinator —
      // `EachAction`'s `'gainControl'`/`'untap'`/`'grantKeyword'` variants
      // (built specifically for this real card, see that union's own doc
      // comment) chain all four actions onto the SAME picked target.
      // "Until end of turn" stays the same permanent-within-scenario
      // simplification `grantKeyword`'s/`gainControl`'s own doc comments
      // already document — neither `grantKeyword` call here sets
      // `untilEndOfTurn`, matching this card's own pre-migration behavior
      // exactly (not a behavior change, just a representation change).
      name: 'onEnter',
      on: 'enter',
      effects: [
        {
          kind: 'program',
          describe: 'gain control of target creature an opponent controls until end of turn; untap it; it gains lifelink and haste until end of turn',
          program: selectUpTo(opponents.creaturesInPlay(), 1, 'target', [
            applyToBound('target', 0, gainControl('you')),
            applyToBound('target', 0, untap()),
            applyToBound('target', 0, grantKeyword('Lifelink')),
            applyToBound('target', 0, grantKeyword('Haste')),
          ]),
        } satisfies Effect,
      ],
    },
    {
      name: 'onOpponentGainsControlFromYou',
      effects: [{ kind: 'createToken', token: TOKENS.c_a_treasure_sac, amount: 1 } satisfies Effect],
    },
  ],
};
