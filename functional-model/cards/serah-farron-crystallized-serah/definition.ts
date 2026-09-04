import type { CardDefinition, Effect } from '../../card';

// Real script (serah_farron_crystallized_serah.txt): a transforming DFC —
// `SetState | Mode$ Transform`, a genuine in-place flip. Same approximation
// cecil-dark-knight-cecil-redeemed-paladin/clive-ifrit-s-dominant already
// establish for this exact real mechanism (this model tracks no "which face
// is showing" state): exile self, then return it to the battlefield,
// standing in for the transform.
export const serahFarron: CardDefinition = {
  name: 'Serah Farron',
  manaCost: '{1}{G}{W}',
  typeLine: 'Legendary Creature — Human Citizen',

  pt: [2, 2],

  // "The first legendary creature spell you cast each turn costs {2} less
  // to cast." Real `Mode$ ReduceCost` — cost-reduction is an explicitly
  // deferred gap (no cost-reduction/replacement-effect machinery anywhere
  // in this model), so this stays real, structured text rather than a
  // fabricated Effect.
  staticAbilities: ['The first legendary creature spell you cast each turn costs {2} less to cast.'],

  triggers: [
    {
      // "At the beginning of combat on your turn, if you control two or
      // more other legendary creatures, you may transform Serah Farron."
      // Real `IsPresent$ Creature.Other+Legendary+YouCtrl | PresentCompare$ GE2`
      // — a real board-state count-threshold gate no declarative Effect
      // field expresses (not a `Computed` single field either, since the
      // WHOLE transform is conditional on it) — `custom`, checking the real
      // legendary-creature count the same `hasSubtype('Legendary')`
      // approximation aerith-gainsborough's own trigger already uses.
      name: 'onBeginCombat',
      effects: [
        {
          kind: 'custom',
          describe: 'if you control two or more other legendary creatures, you may transform Serah Farron',
          run: (ctx, actions) => {
            const otherLegendaries = ctx.you.getCreaturesInPlay().filter((c) => c.hasSubtype('Legendary') && c.getId() !== ctx.self.getId());
            if (otherLegendaries.length < 2) return;
            actions.moveTo(ctx.self, 'Exile');
            actions.moveTo(ctx.self, 'Battlefield');
          },
        } satisfies Effect,
      ],
    },
  ],

  backFace: {
    name: 'Crystallized Serah',
    manaCost: '',
    typeLine: 'Legendary Artifact',

    // Same cost-reduction static as the front face, plus a real permanent
    // anthem — "Legendary creatures you control get +2/+2" is a CONTINUOUS
    // static buff to OTHER permanents (no duration, not a resolvable
    // "until end of turn" spell effect), which is exactly what
    // `staticAbilities` (not `pumpAll`, that models a one-time RESOLVING
    // pump) is for.
    staticAbilities: [
      'The first legendary creature spell you cast each turn costs {2} less to cast.',
      'Legendary creatures you control get +2/+2.',
    ],
  },
};
