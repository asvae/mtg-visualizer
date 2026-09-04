import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

// A transforming DFC (front: Enchantment, back: Legendary Artifact —
// Equipment) — same `backFace` shape as
// jecht-reluctant-guardian-braska-s-final-aeon (see that card's own header
// comment for why a second, independent CardDefinition is the right shape
// here rather than new schema machinery).
export const sidequestPlayBlitzball: CardDefinition = {
  name: 'Sidequest: Play Blitzball',
  manaCost: '{2}{R}',
  typeLine: 'Enchantment',

  triggers: [
    {
      name: 'onBeginCombat',
      effects: [{ kind: 'pumpTarget', power: 2, toughness: 0, owner: 'you' } satisfies Effect],
    },
    {
      // Real condition (`CheckSVar$ X | SVarCompare$ GE6`, X = max combat
      // damage dealt this turn) has no observable equivalent anywhere in
      // this engine (no "combat damage dealt this turn" tracker exists —
      // state.ts's own header rules out state-based/turn-aggregate
      // tracking generally) — documentary only, same convention `optional`
      // fields elsewhere already carry: this trigger's effects always run
      // when tested, standing in for "condition assumed met." The
      // transform itself has no action either (no mechanism anywhere to
      // swap a live object's own face/characteristics) — only the real,
      // reachable half (attaching to a chosen creature, via the real
      // `equip` action `white-mage-s-staff`'s own Equip ability already
      // uses) is actually executed.
      name: 'onEndCombat',
      effects: [
        {
          kind: 'custom',
          describe:
            'if a player was dealt 6 or more combat damage this turn, transform this enchantment into World Champion, Celestial Weapon, then attach it to a creature you control (the transform itself and the turn-damage condition have no equivalent in this engine — approximated as: attach to a chosen creature you control)',
          run: (ctx: EffectContext, actions: Actions) => {
            const target = actions.chooseTarget(ctx.you.getCreaturesInPlay());
            if (target) actions.equip(ctx.self, target);
          },
        } satisfies Effect,
      ],
    },
  ],

  backFace: {
    name: 'World Champion, Celestial Weapon',
    manaCost: '',
    typeLine: 'Legendary Artifact — Equipment',

    // Real `S:Mode$ Continuous | Affected$ Creature.EquippedBy | AddPower$ 2
    // | AddKeyword$ Double Strike` — grants a stat/keyword bonus to
    // WHATEVER this is attached to, not to itself — no `ptFormula`/
    // `keywords` shape here covers "the equipped creature gets X" (both
    // only ever apply to `self`), so this stays freeform static text, same
    // as white-mage-s-staff's own equivalent equipment bonus.
    staticAbilities: ['Double Overdrive — Equipped creature gets +2/+0 and has double strike.'],

    // Equip {3} — same declarative-gap shape (no `equip` Effect kind
    // exists) white-mage-s-staff/warrior-s-sword's own Equip ability uses:
    // `custom` calling the real `actions.equip`.
    activationCost: '{3}',
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
  },
};
