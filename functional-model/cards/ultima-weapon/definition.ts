import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

// Real script (ultima_weapon.txt): "Whenever equipped creature attacks,
// destroy target creature an opponent controls" — the granted "equipped
// creature attacks" trigger is modeled as if it were Ultima Weapon's OWN
// trigger, same real source simplification sage-s-nouliths' own
// `onEquippedAttacks` trigger already establishes (the real attacker is
// whichever creature is equipped, not this permanent).
export const ultimaWeapon: CardDefinition = {
  name: 'Ultima Weapon',
  manaCost: '{7}',
  typeLine: 'Legendary Artifact — Equipment',

  // Real, mechanical `continuousPTGrants` (2026-09-16, static-ability audit
  // follow-up — same already-real query-time machinery buster-sword's own
  // identical shape already uses).
  staticAbilities: ['Equipped creature gets +7/+7.'],

  continuousPTGrants: [{ power: 7, toughness: 7, includeSelf: false, equippedBySelf: true }],

  triggers: [
    {
      name: 'onEquippedAttacks',
      // Real, executable auto-fire via `on: 'equippedAttacks'` (closed
      // 2026-09-16, card.ts's own `Trigger.on` doc comment) — previously
      // this trigger fired only via a manual `sequence`/`trigger` name in
      // the old `harness.ts`-style `scenarios.ts` (not migrated to a real
      // engine-piloted trace in this same pass — see that file's own note
      // on why this card's own real trace evidence is deferred).
      on: 'equippedAttacks',
      effects: [{ kind: 'destroy', validType: 'creature', owner: 'opponents', qty: 1 } satisfies Effect],
    },
  ],

  activationCost: 'Equip {7}',
  effects: [
    {
      kind: 'custom',
      describe: 'attach to target creature you control',
      run: (ctx: EffectContext, actions: Actions) => {
        const target = actions.chooseTarget(ctx.you.getCreaturesInPlay());
        if (target) actions.equip(ctx.self, target);
      },
    } satisfies Effect,
  ],
};
