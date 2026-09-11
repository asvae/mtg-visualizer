import type { CardDefinition, Effect } from '../../card';

export const coeurl: CardDefinition = {
  name: 'Coeurl',
  manaCost: '{1}{W}',
  typeLine: 'Creature — Cat Beast',
  // Real printed base P/T (data/fin/fin_scryfall.json) — without this,
  // state.ts's own addCard silently defaults to a fake 1/1 (matches the
  // real value here, but only by coincidence — see adelbert-steiner's own
  // definition.ts comment for why it's still required).
  pt: [2, 2],
  activationCost: '{1}{W}, {T}',

  // Real script: `ValidTgts$ Creature.nonEnchantment` — no controller
  // restriction ("target nonenchantment creature," not "target creature an
  // opponent controls"), confirmed against tmp/mtg-forge's own
  // coeurl.txt — so no `owner` field belongs here; see scenarios.ts's own
  // comment for why the self-targeting seen in its scenarios isn't a bug.
  effects: [{ kind: 'tapTarget', validType: 'creature', excludeEnchantment: true } satisfies Effect],
};
