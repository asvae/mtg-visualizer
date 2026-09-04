import type { CardDefinition, Effect } from '../../card';
import { TOKENS } from '../../tokens.ts';

export const dwarvenCastleGuard: CardDefinition = {
  name: 'Dwarven Castle Guard',
  manaCost: '{1}{W}',
  typeLine: 'Creature — Dwarf Soldier',

  // SVar:SacMe:2 in the real script is a Forge AI hint (how eagerly the AI
  // trades this away), not printed rules text — not modeled, same as every
  // other AI-only SVar this app's own translator already ignores.
  triggers: [
    {
      name: 'onDies',
      effects: [{ kind: 'createToken', token: TOKENS.c_1_1_hero, amount: 1 } satisfies Effect],
    },
  ],
};
