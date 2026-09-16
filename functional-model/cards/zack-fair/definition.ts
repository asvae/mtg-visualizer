import type { CardDefinition, Effect } from '../../card';
import { you, selfCard, selectUpTo, applyToBound, grantKeyword, putCounter, selfCounters, equipTo } from '../../combinator';

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
  //
  // recognizer-exception: entersBattlefield-self-trigger-structural — same
  // real CR 614.12 divergence, a different recognizer: `on:'enter'` IS set
  // (see this trigger's own comment above), but the real text has no "When/
  // Whenever" trigger-condition wording at all ("Zack Fair enters WITH a
  // +1/+1 counter" is a replacement effect, not a triggered ability) — see
  // that recognizer's own module doc comment for the full reasoning.
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
  // Migrated (2026-09-16, engine-lane primitive build) off the old
  // `kind:'custom'` closure onto `kind:'program'`, now that BOTH real
  // blockers this card's own progress.json documented are closed: (1)
  // `program-ast-walker.ts` gained real occurrence support for a bound
  // `putCounter`/`grantKeyword` `EachAction`, and (2) `combinator.ts`
  // gained a new `Query.source:'equippedSelf'` (`ctx.self.getEquippedBy()`
  // — the reverse of `'permanentsInPlay'`, no existing source could express
  // "attached to THIS card" at all). One `selectUpTo` picks the SAME real
  // target the old closure's own single `chooseTarget` call reused for all
  // 3 consequences; a NESTED `selectUpTo` (same real double-`SelectUpTo`
  // shape `gilgamesh-master-at-arms`'s own "attach one of them to a Samurai
  // you control" already establishes) picks one Equipment off
  // `selfCard.equippedSelf()` and attaches it to the SAME outer `target`
  // binding. `grantKeyword('Indestructible', true)` now correctly sets
  // `untilEndOfTurn: true` — the OLD closure's own bare `actions
  // .grantKeyword(target, 'Indestructible')` call (no options) was a real,
  // pre-existing accuracy gap this migration also fixes for free: the real
  // printed text says "gains indestructible UNTIL END OF TURN" (a genuine,
  // trackable 514.2 duration, unlike Venat/Hydaelyn's own untracked "until
  // your next turn"). `putCounter('+1/+1', selfCounters('+1/+1'))` reads
  // Zack Fair's own LIVE counter count as the transfer magnitude — same
  // real CR 121.3 "however many Zack Fair had" reasoning the old closure's
  // own comment already established (no dedicated counter-MOVE primitive
  // exists, so this is a live read immediately followed by a real additive
  // `putCounter`, the correct available mechanism, not an approximation of
  // a nonexistent one) — `card.ts`'s own `applyEffect` never guards a
  // `putCounter` `EachAction` against a resolved amount of 0 the way the
  // old closure's own `if (amount > 0)` did, but this scenario's own real
  // board state always has Zack Fair's ETB counter present by the time this
  // ability fires, so that only ever differs on an untested, hypothetical
  // 0-counter board state (a real, harmless no-op either way — CR 121.2,
  // "putting 0 counters" is legal and does nothing). The target pool is a
  // BARE `you.creaturesInPlay()` — no `.filter('excludeSelf')` — matching
  // the real printed text exactly ("Target creature you control," no
  // "another" qualifier at all, unlike Venat/Hydaelyn's own real "another
  // target creature"): by the time this ability actually resolves, Zack
  // Fair is legally already gone (sacrificed as part of the COST, paid
  // before resolution — 601.2h/608.2h), so real Magic never needs an
  // explicit "another" here. This engine's own documented self-sacrifice-
  // as-cost gap (see `activationCost`'s own comment above) means `ctx.self`
  // is NOT actually removed from the battlefield first, so `chooseTarget`
  // could in principle land on Zack Fair itself if nothing else steered it
  // — this card's own scenario's `ctx.preferTarget` already deterministically
  // picks the OTHER real creature, same as the old `custom` closure's own
  // (unexplained) `excludeSelf`-equivalent filter did; NOT adding a
  // structural `excludeSelf` here is a deliberate choice to keep the
  // resulting Fact honest to the real "no another" text rather than assert
  // a qualifier this card doesn't print, at the cost of a purely
  // hypothetical (never exercised) "Zack Fair alone" edge case picking
  // itself — an accepted approximation in the same already-heavily-
  // caveated territory this card's own self-sacrifice-cost gap already
  // occupies.
  effects: [
    {
      kind: 'program',
      describe:
        "target creature you control gains indestructible until end of turn; put Zack Fair's counters on that creature; attach an Equipment that was attached to Zack Fair to that creature",
      program: selectUpTo(you.creaturesInPlay(), 1, 'target', [
        applyToBound('target', 0, grantKeyword('Indestructible', true)),
        applyToBound('target', 0, putCounter('+1/+1', selfCounters('+1/+1'))),
        selectUpTo(selfCard.equippedSelf(), 1, 'equipment', [applyToBound('equipment', 0, equipTo('target', 0))]),
      ]),
    } satisfies Effect,
  ],
};
