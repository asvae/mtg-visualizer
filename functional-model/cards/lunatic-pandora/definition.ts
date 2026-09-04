import type { CardDefinition, Effect } from '../../card';

// Real script (lunatic_pandora.txt): Legendary Artifact with two
// independent activated abilities — the real `CardDefinition.abilities`
// shape (qiqirn-merchant's own precedent), not a single activationCost.
export const lunaticPandora: CardDefinition = {
  name: 'Lunatic Pandora',
  manaCost: '{1}',
  typeLine: 'Legendary Artifact',

  abilities: [
    {
      name: 'surveil',
      cost: '{2}, {T}',
      effects: [{ kind: 'surveil', qty: 1 } satisfies Effect],
    },
    {
      // Sacrificing itself is part of the COST (real Forge `Sac<1/CARDNAME>`),
      // same "cost, not effect" convention qiqirn-merchant's own bigDraw
      // ability uses. `ValidTgts$ Permanent.nonLand` maps directly onto
      // `destroy`'s own `nonLand` flag — no approximation needed here.
      name: 'destroyNonland',
      cost: '{6}, {T}, Sacrifice Lunatic Pandora',
      effects: [{ kind: 'destroy', validType: 'permanent', nonLand: true, qty: 1 } satisfies Effect],
    },
  ],
};
