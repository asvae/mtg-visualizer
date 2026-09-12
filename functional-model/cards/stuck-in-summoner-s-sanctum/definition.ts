import type { CardDefinition, Effect } from '../../card';

export const stuckInSummonersSanctum: CardDefinition = {
  name: "Stuck in Summoner's Sanctum",
  manaCost: '{2}{U}',
  typeLine: 'Enchantment — Aura',

  // Flash affects CAST TIMING only, not board state — same "no fact needed,
  // it's a bare printed keyword" treatment as "can't be countered" elsewhere
  // in this pool (`engine.ts`'s `canCastAtSorcerySpeed`, line ~210, is the
  // real timing hook this keyword feeds).
  keywords: ['Flash'],

  // "Enchant artifact or creature" / "doesn't untap during its controller's
  // untap step" — the "doesn't untap" half stays real, honest, undemonstrated
  // text (same treatment sleep-magic's own identical clause originally had,
  // before ITS OWN 'CantUntap' migration — this card's own equivalent stays
  // OPEN, ENGINE_GAPS.md gap #18's own writeup, unchanged by this pass):
  // `state.ts`'s `untap()` only special-cases a real STUN counter
  // replacement (CR 122.1d); it has no general per-object "can't untap"
  // lock, so this half of the line is genuinely unenforced.
  //
  // The card's OWN second restriction — "its activated abilities can't be
  // activated" — is now REAL, executable machinery (ENGINE_GAPS.md gap #18,
  // closed 2026-09-12): see `card.ts`'s own `CardDefinition.
  // activatedAbilityLock` doc comment for the real Forge citation
  // (`S:Mode$ CantBeActivated | ValidCard$ Permanent.EnchantedBy`) and full
  // design writeup. `{ includeSelf: false, equippedBySelf: true }` is this
  // card's own real shape — the lock follows whatever real, live permanent
  // this Aura is currently attached to (`RealCard.attachedToId`, set by the
  // `onEnter` trigger's own real `equip` call below), the same
  // `equippedBySelf` targeting Equipment's own P/T-grant broadcasts and
  // sleep-magic's own `CantUntap` grant already use.
  staticAbilities: ["Enchanted permanent doesn't untap during its controller's untap step."],
  activatedAbilityLock: [{ includeSelf: false, equippedBySelf: true }],

  triggers: [
    {
      // "When this Aura enters, tap enchanted permanent" — real Forge
      // citation, `res/cardsfolder/s/stuck_in_summoners_sanctum.txt`:
      // `T:Mode$ ChangesZone | ... | Execute$ TrigTap | ...` paired with the
      // real `K:Enchant:Artifact,Creature` keyword line (this model has no
      // separate "which permanent did this Aura's own cast target" tracking
      // distinct from a fresh `chooseTarget` pool pick — Auras have no
      // dedicated attach-state here).
      //
      // **Real bug fix (found migrating this card for ENGINE_GAPS.md gap
      // #18):** this trigger's effect used to be a bare declarative
      // `{kind:'tapTarget', validType:'creature-or-artifact'}` — which taps
      // the chosen permanent but NEVER calls `actions.equip`, so this Aura
      // never actually became attached (`RealCard.attachedToId` stayed
      // `undefined` forever). That's harmless for a mere tap, but it would
      // have made BOTH this Aura's own `activatedAbilityLock` above AND its
      // still-open `CantUntap`-shaped "doesn't untap" restriction
      // permanently, silently inert even if the latter were later modeled —
      // neither can ever qualify via `equippedBySelf` without a real
      // `attachedToId` link. Fixed to a real `custom` effect that performs
      // BOTH the attach and the tap against the SAME chosen permanent, the
      // identical two-step shape sleep-magic's own onEnter trigger (fin's
      // other real Aura) already correctly uses. Also missing before this
      // fix: `on: 'enter'` — without it, `engine.ts`'s real ETB auto-fire
      // (`resolveTop`'s own `card.triggers?.find((t) => t.on === 'enter')`)
      // never picks this trigger up at all when the card is genuinely cast
      // through the real engine path, same real gap sleep-magic's own
      // migration already fixed for itself.
      name: 'onEnter',
      on: 'enter',
      effects: [
        {
          kind: 'custom',
          describe: 'attaches to enchanted artifact or creature and taps it',
          run: (ctx, actions) => {
            const pool = [ctx.you, ...ctx.opponents].flatMap((p) => p.getCardsIn('Battlefield')).filter((c) => c.isCreature() || c.isArtifact());
            let target: (typeof pool)[number] | undefined;
            while (target === undefined && ctx.declaredTargets && ctx.declaredTargets.length > 0) {
              const next = ctx.declaredTargets.shift()!;
              if (pool.some((c) => c.getId() === next.getId())) target = next;
              // else: this declared target is no longer legal (608.2b) — dropped, not replaced.
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
  ],
};
