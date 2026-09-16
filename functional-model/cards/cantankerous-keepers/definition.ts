import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const cantankerousKeepers: CardDefinition = {
  name: 'Cantankerous Keepers',
  manaCost: '{5}{G}',
  typeLine: 'Creature — Elf Soldier',
  pt: [4, 3],

  // Real "Affinity for Elves" — now real, executable
  // `costReduction.perControlled` (2026-09-16, static-ability audit
  // follow-up), same mechanism travel-the-overworld's own Affinity for
  // Towns already uses (ENGINE_GAPS.md gap #7).
  staticAbilities: ['Affinity for Elves (This spell costs {1} less to cast for each Elf you control.)'],
  costReduction: { perControlled: { amountPerMatch: 1, subtype: 'Elf' } },

  triggers: [
    {
      name: 'onEnter',
      on: 'enter',
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
