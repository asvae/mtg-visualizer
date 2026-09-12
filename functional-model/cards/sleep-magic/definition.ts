import type { CardDefinition, Effect } from '../../card';

export const sleepMagic: CardDefinition = {
  name: 'Sleep Magic',
  manaCost: '{U}',
  typeLine: 'Enchantment — Aura',

  // "Enchant creature" — no real "legal enchant target" restriction
  // enforcement exists anywhere in this model (an Aura's own cast has no
  // gate distinct from a bare `chooseTarget` pool pick) — same acknowledged
  // limitation `stuck-in-summoner-s-sanctum`'s own definition documents (fin's
  // other real Aura); kept as free text, not modeled.
  staticAbilities: ['Enchant creature'],

  // "Enchanted creature doesn't untap during its controller's untap step" —
  // real CR 614.2 continuous replacement (Forge: `R:Event$ Untap |
  // ValidCard$ Creature.EnchantedBy | Layer$ CantHappen`,
  // ../tmp/mtg-forge/forge-gui/res/cardsfolder/s/sleep_magic.txt), now real,
  // executable machinery (not text-only) — see `card.ts`'s own `'CantUntap'`
  // Keyword doc comment for the full writeup and why this is genuinely
  // different in kind from a stun counter (a one-shot consumption vs. this
  // card's own unconditional, always-on lockdown). Broadcast onto whatever
  // creature this Aura is really `equip`-attached to, the SAME
  // `continuousKeywordGrants`/`equippedBySelf` machinery every migrated
  // Equipment card already uses (Dragoon's Lance's own "equipped creature has
  // flying," e.g.) — an Aura's attachment link is the identical
  // `RealCard.attachedToId` relationship, not a separate concept.
  continuousKeywordGrants: [{ keywords: ['CantUntap'], includeSelf: false, equippedBySelf: true }],

  triggers: [
    {
      // "When this Aura enters, tap enchanted creature" — a real targeted
      // Aura-attach (`actions.equip`, the same primitive every migrated
      // Equipment card already uses) THEN a real tap, both against the SAME
      // real object: the creature this Aura's own cast declared
      // (`ctx.declaredTargets`, ENGINE_GAPS.md gap #4) — that array survives
      // untouched from `castSpell`/`stack.resolveTop` into this ETB
      // trigger's own `ctx` (an Aura has no `effects` of its own to have
      // already drained it), falling back to a fresh `chooseTarget` pick
      // when unset (a bare `harness.ts` scenario, which never sets
      // `declaredTargets` — same fallback shape `card.ts`'s own
      // module-private `resolveTargets` establishes for every other
      // targeted effect, reproduced here by hand since this needs BOTH the
      // target AND a follow-up `equip` call against the exact same object,
      // not just a tap).
      name: 'onEnter',
      on: 'enter',
      effects: [
        {
          kind: 'custom',
          describe: 'attaches to enchanted creature and taps it',
          run: (ctx, actions) => {
            const pool = [ctx.you, ...ctx.opponents].flatMap((p) => p.getCardsIn('Battlefield')).filter((c) => c.isCreature());
            let target: (typeof pool)[number] | undefined;
            while (target === undefined && ctx.declaredTargets && ctx.declaredTargets.length > 0) {
              const next = ctx.declaredTargets.shift()!;
              if (pool.some((c) => c.getId() === next.getId())) target = next;
              // else: this declared target is no longer a legal creature (608.2b) — dropped, not replaced.
            }
            if (!target) target = actions.chooseTarget(pool, ctx.preferTarget);
            if (target) {
              actions.equip(ctx.self, target);
              actions.tap(target);
            }
          },
        } satisfies Effect,
      ],
    },
    {
      // "When enchanted creature is dealt damage, sacrifice this Aura" — the
      // trigger CONDITION itself ("is dealt damage") has no real auto-fire
      // hook anywhere in this engine: `Trigger.on` only recognizes
      // `'enter'`/`'upkeep'`/`'endStep'` (card.ts), and `state.dealDamage`
      // (the one real chokepoint gap #8's damage-prevention shields already
      // hook into) fires no trigger of any kind — a genuinely unsupported
      // auto-fire condition, not fabricated here. Kept as a manually-named
      // trigger (same convention every other not-yet-auto-fired trigger in
      // this pool already uses) — exercised directly via this card's own
      // `scenarios.ts` (`trigger: 'onEnchantedDealtDamage'`), same real
      // mechanism, just player/scenario-invoked rather than engine-detected.
      // Real Forge citation for the condition itself: `T:Mode$
      // DamageDoneOnce | ValidTarget$ Card.AttachedBy | ...` — a genuine
      // dealt-damage trigger mode Forge has and this engine doesn't
      // reproduce (ENGINE_GAPS.md).
      //
      // `sacrifice`'s own declarative shape has no "self-only" target option
      // (only `notSelf`, which EXCLUDES self), so this approximates
      // "sacrifice THIS Aura" as "sacrifice an enchantment you control" —
      // correct whenever this Aura is the only enchantment on the
      // battlefield (true in this card's own scenario below).
      name: 'onEnchantedDealtDamage',
      effects: [{ kind: 'sacrifice', owner: 'you', validType: 'enchantment', qty: 1 } satisfies Effect],
    },
  ],
};
