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
            // turn" — a pure keyword grant with no other component at all.
            // MIGRATED (2026-09-16, engine-core): `grantKeywordAll` used to
            // have no `'attacking-creatures'` predicate (only
            // `'creatures-you-control'`/`'permanents-you-control'`) —
            // genuinely distinct from the "no keyword-grant field at ALL"
            // gap moogles-valor/restoration-magic/dion-bahamut/
            // ardyn-the-usurper's own comments document (that gap is long
            // closed; this was a narrower missing predicate VALUE). Now a
            // real, mechanically-enforced declarative effect — `pumpAll`'s
            // own identical `'attacking-creatures'` predicate (Auron's
            // Inspiration) already established the real symmetric (both
            // players) broadcast this reuses.
            kind: 'grantKeywordAll',
            predicate: 'attacking-creatures',
            keyword: 'Indestructible',
            notSelf: true,
            untilEndOfTurn: true,
          } satisfies Effect,
        ],
      },
    ],
  },
};
