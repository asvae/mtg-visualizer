import type { CardDefinition, Effect } from '../../card';
import { selectUpTo, applyToBound, gainControl, equipTo, anyPlayer, you } from '../../combinator';

export const stolenUniform: CardDefinition = {
  name: 'Stolen Uniform',
  manaCost: '{U}',
  typeLine: 'Instant',

  // Two independent targets (a creature you control AND an Equipment,
  // which can belong to anyone), then chained gainControl+equip against
  // the SAME chosen Equipment. Migrated (2026-09-16, coordinator-routed
  // pilot-triage escalation) off a raw `custom` closure onto
  // `kind:'program'`'s own `SelectUpTo`/`ApplyToBound` combinator —
  // `EachAction`'s `'gainControl'`/`'equip'` variants (built specifically
  // for this real card and its siblings, see that union's own doc comment)
  // chain both real, mechanically wired actions (`state.ts`'s
  // `RealPlayer.gainControl`/`RealCard.attachedToId` mutation via
  // `interfaces.ts`'s real `gainControl`/`equip` signatures) onto the SAME
  // picked Equipment, real matchable `Fact` vocabulary either way
  // (`event:'gainControl'` promoted 2026-09-12 for Stiltzkin, Moogle
  // Merchant/fin-34; `event:'equip'` promoted the same day for THIS card,
  // scripts/verify-synergy.mjs's own `producedEvents` — previously parked).
  // `gainControl`'s own "until end of turn" is a REAL CR duration (the
  // fact's own `untilEndOfTurn: true`, purely documentary) but this engine
  // has no control-reversion mechanism at all — `state.ts`'s `gainControl`
  // is a one-way, permanent-within-scenario reassignment (same
  // simplification zidane-tantalus-thief's/unexpected-request's own
  // identical "until end of turn" gainControl effects already document).
  // The delayed "when you lose control of that Equipment this turn...
  // unattach it" trigger has no `unattach`/detach action anywhere in this
  // model (`equip` only ever attaches, never detaches) AND no delayed-
  // trigger-on-control-loss mechanism exists (`turn.ts`'s only delayed-
  // trigger scheduling is `delayUntil`, keyed on phase/step boundaries, not
  // on a `gainControl` event) — genuinely unmodeled, left undocumented in
  // code beyond `describe` and this comment, same "genuinely out of scope"
  // treatment sidequest-catch-a-fish-cooking-campsite's own mana-ability
  // comment gives a different unreachable mechanic.
  effects: [
    {
      kind: 'program',
      describe:
        "choose target creature you control and target Equipment; gain control of that Equipment until end of turn and attach it to the chosen creature (the end-of-turn control-revert and unattach delayed trigger aren't modeled — no such mechanism exists in this engine)",
      program: selectUpTo(you.creaturesInPlay(), 1, 'creature', [
        selectUpTo(anyPlayer.permanentsInPlay().filter('subtype', 'Equipment'), 1, 'equipment', [
          applyToBound('equipment', 0, gainControl('you')),
          applyToBound('equipment', 0, equipTo('creature', 0)),
        ]),
      ]),
    } satisfies Effect,
  ],
};
