import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const cantankerousKeepers: CardDefinition = {
  name: 'Cantankerous Keepers',
  manaCost: '{5}{G}',
  typeLine: 'Creature — Elf Soldier',
  pt: [4, 3],

  // Real "Affinity for Elves" (costs {1} less per Elf you control) has no
  // cost-reduction engine anywhere in this model (casting cost is never
  // tracked as a paid resource — same "no mana engine" gap
  // elvish-archdruid's own mana ability hits) — documentary only.
  staticAbilities: ['Affinity for Elves (This spell costs {1} less to cast for each Elf you control.)'],

  triggers: [
    {
      name: 'onEnter',
      effects: [
        { kind: 'move', owner: 'you', from: 'Library', to: 'Graveyard', qty: 4, target: false } satisfies Effect,
        {
          // Same "no declarative shape reads the just-milled batch"
          // situation Silvan Rally's own custom effect documents — reused
          // here for "ALL Elf cards" (unbounded) instead of "up to two
          // lands." Same over-read caveat under a real, non-empty
          // graveyard applies.
          kind: 'custom',
          describe: 'put all Elf cards from among the four milled cards into hand',
          run: (ctx: EffectContext, actions: Actions) => {
            const elves = ctx.you.getCardsIn('Graveyard').filter((c) => c.hasSubtype('Elf'));
            for (const elf of elves) actions.moveTo(elf, 'Hand');
          },
        } satisfies Effect,
      ],
    },
  ],
};
