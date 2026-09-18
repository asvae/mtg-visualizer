import type { CardDefinition, Effect } from '../../card';

export const drakeHatcher: CardDefinition = {
  name: 'Drake Hatcher',
  manaCost: '{1}{U}',
  typeLine: 'Creature — Human Wizard',
  pt: [1, 3],

  // Real K:Vigilance, K:Prowess. "Prowess" is not in this model's
  // controlled `Keyword` vocabulary (card.ts's own `Keyword` union has no
  // 'Prowess' entry — same real gap queen-brahne's own definition.ts
  // already documents: no "whenever you cast a noncreature spell" auto-
  // fire hook exists anywhere in this engine for ANY card), so it stays
  // real printed text instead of a fabricated union member.
  keywords: ['Vigilance'],
  // Migrated from `staticAbilities` to `missingSchemaFunctionality`
  // (2026-09-18, FDN schema-tightness redesign).
  missingSchemaFunctionality: [
    {
      clause: 'Prowess (Whenever you cast a noncreature spell, this creature gets +1/+1 until end of turn.)',
      demand: "A real `Prowess` `Keyword` union member PLUS the matching auto-fire hook — no \"whenever you cast a noncreature spell\" trigger precondition exists anywhere in this engine for ANY card (same real gap Elementalist Adept's own identical Prowess line also names).",
    },
  ],

  // Real Forge: `Mode$ DamageDone | ValidSource$ Card.Self |
  // ValidTarget$ Player | CombatDamage$ True` — "Whenever this creature
  // deals combat damage to a player, put that many incubation counters on
  // it." No `on` value exists for a combat-damage-to-player event; kept as
  // a name-only trigger. `X` ("that many") is a real per-trigger fixed
  // fact supplied via `EffectContext.triggerInput`, same convention
  // bloodthirsty-conqueror's own "that much life" already uses.
  triggers: [
    {
      name: 'onCombatDamageToPlayer',
      effects: [
        {
          kind: 'putCounter',
          target: 'self',
          counterType: 'incubation',
          amount: (ctx) => (ctx.triggerInput?.damageAmount as number) ?? 0,
        } satisfies Effect,
      ],
    },
  ],

  // Real Forge: `A:AB$ Token | Cost$ SubCounter<3/INCUBATION>` — a
  // counter-removal cost, not mana/tap. `activationCost` is a plain,
  // freeform string (not mechanically parsed/enforced beyond mana/{T} —
  // same "not every free-text constraint is mechanically enforced"
  // convention gogo-master-of-mimicry's own `{X}{X}, {T}` cost and
  // `crewCost`'s own doc comment already establish), so this is real,
  // documented text rather than a fabricated mana/tap cost.
  activationCost: 'Remove three incubation counters from this creature',
  effects: [
    {
      kind: 'createToken',
      token: {
        name: 'Drake',
        manaCost: '0',
        types: ['Creature', 'Drake'],
        basePower: 2,
        baseToughness: 2,
        keywords: ['Flying'],
      },
      amount: 1,
    } satisfies Effect,
  ],
};
