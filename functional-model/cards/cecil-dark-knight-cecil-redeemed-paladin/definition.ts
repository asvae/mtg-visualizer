import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

// A transforming DFC, real preexisting card (not FIN-original) reprinted
// into this set. Real Forge mechanism is `DB$ SetState | Mode$ Transform` —
// a genuine in-place flip, not a zone change — but this model tracks no
// "which face is currently showing" state at all (same gap jecht-
// reluctant-guardian-braska-s-final-aeon's own front-face comment
// documents), so the flip is approximated the SAME way jecht/dion already
// do: exile self, then return it to the battlefield (a real, observable
// zone-change pair standing in for "transform"), even though Cecil's own
// real implementation doesn't actually change zones. Flagged as the same
// already-accepted simplification those two cards use, not a new gap.
export const cecilDarkKnight: CardDefinition = {
  name: 'Cecil, Dark Knight',
  manaCost: '{B}',
  typeLine: 'Legendary Creature — Human Knight',

  pt: [2, 3],
  keywords: ['Deathtouch'],

  triggers: [
    {
      name: 'onDealsDamage',
      effects: [
        {
          kind: 'custom',
          describe:
            'Darkness — whenever Cecil deals damage, you lose that much life. Then if your life total is less than or equal to half your starting life total, untap Cecil and transform it',
          run: (ctx: EffectContext, actions: Actions) => {
            // Fixed once at trigger time (real `TriggerCount$DamageAmount`)
            // — same `triggerInput` convention kain-traitorous-dragoon's
            // own custom effect uses for "how much damage."
            const damageDealt = (ctx.triggerInput?.damageAmount as number) ?? 0;
            ctx.you.loseLife(damageDealt);
            // "Half your STARTING life total" — this model has no separate
            // starting-life field distinct from current life (RealPlayer's
            // own `life` is the only tracked value); 20 (this harness's own
            // real default starting life, see harness.ts's own
            // PLAYER_STATE_DEFAULTS) stands in, same approximation
            // scenario setup already treats as the baseline.
            const startingLife = 20;
            if (ctx.you.getLife() <= startingLife / 2) {
              actions.untap(ctx.self);
              actions.moveTo(ctx.self, 'Exile');
              actions.moveTo(ctx.self, 'Battlefield');
            }
          },
        } satisfies Effect,
      ],
    },
  ],

  backFace: {
    name: 'Cecil, Redeemed Paladin',
    manaCost: '',
    typeLine: 'Legendary Creature — Human Knight',

    pt: [4, 4],
    keywords: ['Lifelink'],

    triggers: [
      {
        name: 'onAttacks',
        effects: [
          {
            // "Other attacking creatures gain indestructible until end of
            // turn" — a pure keyword grant with no other component at all;
            // `pumpAll` (the real Forge `DB$ PumpAll | KW$ Indestructible`
            // this maps to) has no keyword-grant field (only power/
            // toughness deltas) — same recurring gap moogles-valor/
            // restoration-magic/dion-bahamut/ardyn-the-usurper's own
            // comments already document. `custom` with a no-op `run`
            // (nothing here is executable at all — not even a partial
            // mutation, unlike those other cards' own mixed effects) is
            // the honest shape; `describe` is what actually carries the
            // real text into `synergyTags()`.
            kind: 'custom',
            describe: 'Protect — other attacking creatures gain indestructible until end of turn (no keyword-grant Effect shape exists yet — not mechanically enforced)',
            run: () => {},
          } satisfies Effect,
        ],
      },
    ],
  },
};
