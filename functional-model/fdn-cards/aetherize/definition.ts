import type { CardDefinition, Effect } from '../../card';

export const aetherize: CardDefinition = {
  name: 'Aetherize',
  manaCost: '{3}{U}',
  typeLine: 'Instant',

  missingSchemaFunctionality: [
    {
      clause: "Return all attacking creatures to their owner's hand.",
      demand:
        'A batch-move construct that selects EVERY currently-attacking creature (regardless of controller) and returns each to its OWN owner\'s hand — `move`\'s `validType`/`subtype` fields have no "attacking" predicate at all, and its `owner: EffectOwner` names one fixed controller bucket to search from, not "each attacker goes back to whichever player owns it" when attackers can be owned by more than one player.',
    },
  ],

  effects: [
    {
      kind: 'custom',
      describe: 'Return all attacking creatures to their owner\'s hand (move effect does not support attacking-creatures predicate)',
      run: () => {},
    } satisfies Effect,
  ],
};
