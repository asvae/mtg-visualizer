import type { CardDefinition } from '../../card';

export const highFaeTrickster: CardDefinition = {
  name: 'High Fae Trickster',
  manaCost: '{3}{U}',
  typeLine: 'Creature — Faerie Wizard',
  pt: [4, 2],

  keywords: ['Flash', 'Flying'],

  missingSchemaFunctionality: [
    {
      clause: 'You may cast spells as though they had flash.',
      demand:
        'No primitive exists to grant a caster-side casting-TIMING permission (real Forge: `S:Mode$ CastWithFlash | ValidCard$ Card | ValidSA$ Spell | Caster$ You`) — every existing keyword/continuous-grant mechanism broadcasts onto PERMANENTS on the battlefield (P/T, type, or a printed keyword), never onto the controller\'s own general casting rights over cards still in hand. Needs a new static-ability shape (e.g. a `castingPermissionGrants` field) that widens WHEN a controller may cast any spell, not WHAT a permanent has.',
    },
  ],
};
