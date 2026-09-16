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

    // Same cost-reduction static as the front face (still real, structured
    // text — cost-reduction/replacement-effect machinery is a separate,
    // still-open gap). "Legendary creatures you control get +2/+2" is now
    // real, executable `continuousPTGrants` with a `subtype:'Legendary'`
    // broadcast (2026-09-16, static-ability audit) — same shared mechanism
    // elvish-archdruid's own "Other Elf creatures" anthem uses, `subtype`
    // here matching this codebase's own established "Legendary" pseudo-
    // subtype convention (`hasSubtype('Legendary')`, same as this card's
    // own front-face `onBeginCombat` trigger already checks). Crystallized
    // Serah is ITSELF a Legendary permanent (though not a Creature, so
    // real Forge never grants it its own bonus either) — `includeSelf:
    // false` is correct, and `state.ts`'s own `qualifiesForContinuousGrant`
    // was fixed this same pass to explicitly exclude the granting
    // permanent from its own subtype-broadcast branch (previously an
    // unexercised self-collision risk no other real subtype grant in this
    // pool happened to hit — see that function's own updated comment).
    // Doesn't ALSO require the recipient to be a Creature specifically
    // (only `subtype.includes('Legendary')`) — a real, narrow, accepted
    // simplification: no OTHER real non-Creature Legendary permanent
    // exists anywhere in this pool to expose the gap, same "no real
    // conflicting card exists yet" acceptance Ardyn's own Demon-subtype
    // grant already relies on.
    staticAbilities: [
      'The first legendary creature spell you cast each turn costs {2} less to cast.',
      'Legendary creatures you control get +2/+2.',
    ],
    continuousPTGrants: [{ power: 2, toughness: 2, includeSelf: false, subtype: 'Legendary' }],
  },
};
