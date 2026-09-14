import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const zackFair: CardDefinition = {
  name: 'Zack Fair',
  manaCost: '{W}',
  typeLine: 'Legendary Creature — Human Soldier',

  pt: [0, 1],

  // Real `K:etbCounter:P1P1:1` — semantically an ETB trigger (enters with a
  // +1/+1 counter already on it). No dedicated "enters with counters"
  // replacement-effect mechanism exists anywhere in this engine (checked
  // state.ts's own `addCard`/`move` — neither has an "arrives pre-loaded
  // with counters" hook; every other pool card that puts counters on
  // something ETB-adjacent, torgal-a-fine-hound/summon-fenrir's own
  // "that creature enters with a counter" included, is itself just a named
  // trigger calling `putCounter`/`putCounterTarget`), so this stays modeled
  // as a named `onEnter` trigger the same way it already was — now with
  // `on: 'enter'` added (real 603.6b auto-fire, matching every other
  // ETB-bearing pool card's own convention, needed so an engine-piloted
  // `pilotResolveTop` fires this for real rather than requiring a scenario
  // to name it explicitly). Kept as its own named trigger (not folded into
  // the top-level `effects` field) so that field stays free for this card's
  // own activated ability below (same trigger-for-ETB/
  // effects-for-the-activated-ability split dragoon-s-lance/paladin-s-arms/
  // machinist-s-arsenal already use for their own Job-select ETB + separate
  // Equip ability).
  //
  // recognizer-exception: putCounterSelf-effect-structural — real text
  // reads "Zack Fair enters with a +1/+1 counter on it," never the verb
  // "put" for THIS counter (the card's own LATER "Put Zack Fair's counters
  // on that creature" sentence is a genuinely different action — relocating
  // EXISTING counters onto a chosen other creature, not adding a new one to
  // self — and never contains the literal "+1/+1" substring either, so it
  // correctly never falsely matches). See that recognizer's own module doc
  // comment.
  triggers: [
    {
      name: 'onEnter',
      on: 'enter',
      effects: [{ kind: 'putCounter', target: 'self', counterType: '+1/+1', amount: 1 } satisfies Effect],
    },
  ],

  // "{1}, Sacrifice Zack Fair: ..." — the sacrifice is part of the COST
  // (paid before the ability resolves), folded into `activationCost` text,
  // same convention phoenix-down's own "Exile this artifact" cost uses.
  //
  // Real, documented, general engine gap (engine.ts's own
  // `unsupportedCostComponent` doc comment, which names this exact card by
  // name): a NAMED self-sacrifice cost ("Sacrifice Zack Fair", as opposed to
  // the recognized "Sacrifice another/a/two X" pattern) is never accepted as
  // payable, so `canActivateAbility`/`activateAbility` always reject this
  // ability through the real engine — and that comment explains why this
  // can't be fixed by modeling the sacrifice as a real `{kind:'sacrifice'}`
  // effect either (the way ahriman/phantom-train/quina-qu-gourmet pay their
  // own "Sacrifice another/a X" costs): this effect's own logic below reads
  // Zack Fair's LIVE counters/attached-Equipment, which only stays correct
  // because the sacrifice never actually removes it from the battlefield —
  // genuinely sacrificing `self` first would need real 608.2h
  // last-known-information tracking (a real, separate, unbuilt gap) to keep
  // this card correct. This card's own scenario (scenarios.ts) fires the
  // ability directly via `resolveCard`, bypassing `canActivateAbility`'s
  // cost check, rather than through `pilotActivate` — a real self-sacrifice
  // cost is simply never payable through this engine's own activated-ability
  // pipeline today.
  activationCost: '{1}, Sacrifice Zack Fair',
  effects: [
    {
      kind: 'custom',
      describe:
        "target creature you control gains indestructible until end of turn; put Zack Fair's counters on that creature; attach an Equipment that was attached to Zack Fair to that creature",
      run: (ctx: EffectContext, actions: Actions) => {
        const pool = ctx.you.getCreaturesInPlay().filter((c) => c.getId() !== ctx.self.getId());
        if (pool.length === 0) return;
        const target = actions.chooseTarget(pool, ctx.preferTarget);
        // "gains indestructible until end of turn" — real `grantKeyword`
        // mutation (state.ts: it pushes onto the real card's own
        // `keywords`, so a later `state.destroy` call genuinely sees it),
        // same "permanent within a scenario, no phase/turn-boundary reset"
        // duration caveat every other `grantKeyword` use already carries.
        actions.grantKeyword(target, 'Indestructible');
        // "Put Zack Fair's counters on that creature" — a real counter
        // TRANSFER in spirit (CR 121.3: counters cease to exist once their
        // object leaves the battlefield, so the printed text really means
        // "however many Zack Fair had" at that moment) — no dedicated
        // "move a counter between objects" primitive exists anywhere in
        // this engine (`state.ts`'s own `putCounter` is purely additive),
        // so this reads Zack Fair's own live count, then places that many
        // on the target via the same real `putCounter` every other pool
        // card uses — the correct real mechanism available, not an
        // approximation of a nonexistent one.
        const amount = ctx.self.getCounters('+1/+1');
        if (amount > 0) actions.putCounter(target, '+1/+1', amount);
        // "attach an Equipment that was attached to Zack Fair to that
        // creature" — real, conditional re-attachment. `getEquippedBy`
        // (interfaces.ts/state.ts) DOES expose the reverse "what's attached
        // to THIS card" lookup this effect needs (`state.ts`'s own
        // `attachedToId`-scan, added after this comment was first written —
        // an earlier version of this file incorrectly claimed no such
        // lookup existed at all); `actions.equip` re-attaches the first one
        // found to the target, same real action every Equipment card's own
        // activationCost already uses (this engine has no player-choice
        // model beyond `chooseTarget`'s own deterministic pool[0]
        // convention, so "an Equipment" picks the first real match). A
        // no-op when nothing is attached, matching the real conditional
        // clause exactly.
        const equipped = ctx.self.getEquippedBy();
        if (equipped.length > 0) actions.equip(equipped[0]!, target);
      },
    } satisfies Effect,
  ],
};
