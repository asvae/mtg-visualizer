import type { CardDefinition, Effect } from '../../card';

export const ambrosiaWhiteheart: CardDefinition = {
  name: 'Ambrosia Whiteheart',
  manaCost: '{1}{W}',
  typeLine: 'Legendary Creature — Bird',

  keywords: ['Flash'],

  triggers: [
    {
      // Real Forge: `OptionalDecider$ You` — the whole return is a "you
      // MAY," a real binary decline option, not just "up to one target"
      // (which the pool-exhaustion behavior of `move`'s targeted branch
      // already models for free when nothing else is in play). `optional`
      // is documentary only, like `sacrifice`'s own field — this model has
      // no player-decision engine, so a legal target still gets returned.
      // Mechanization pass (2026-09-14): this effect's own `to:'Hand',
      // from:'Battlefield'` source/sink fact pair stays hand-authored —
      // `recognizers/move-effect-structural.ts` (unwired as of this pass,
      // reads a card's own `kind:'move', target:true` effect) already
      // checked the whole pool and explicitly DECLINES this exact card:
      // `owner`/`notSelf`/`optional` are all set here, and none of the 3 has
      // a confirmed real-English template that file's own module doc
      // comment can safely generalize from ("return ANOTHER target
      // permanent" and "you MAY" are both real, different templating a bare
      // "target <type>" phrase doesn't assert).
      name: 'onEnter',
      on: 'enter',
      effects: [{ kind: 'move', owner: 'you', from: 'Battlefield', to: 'Hand', qty: 1, target: true, notSelf: true, optional: true } satisfies Effect],
    },
    {
      // Landfall — real Forge fires this off ANOTHER permanent (a land)
      // entering, not this creature's own event. This model only dispatches
      // named triggers a scenario explicitly picks (no automatic "a land
      // entered" detection anywhere), so it's modeled the same way every
      // other trigger here is: a real, correctly-shaped effect, invoked
      // on cue rather than auto-detected.
      // Real "Landfall — Whenever a land you control enters, Ambrosia
      // Whiteheart gets +1/+0 until end of turn" — `untilEndOfTurn: true`
      // (2026-09-14) closes the real gap this used to have: a bare `pumpSelf`
      // was a PERMANENT `layers.add` entry with no expiry at all, even
      // though the printed text says otherwise (`state.ts`'s own `pump`/
      // `clearUntilEndOfTurnPumps` doc comments). See `scenarios.ts` for a
      // real engine-piloted demonstration spanning a full Cleanup.
      name: 'onLandfall',
      // Mechanization pass (2026-09-14): this effect's own `event:'pump'`
      // SOURCE fact stays hand-authored — checked the whole pool for a
      // general "fixed pump" recognizer first (34 real `pumpSelf`/
      // `pumpTarget`/`pumpAll` effects across ~27 cards). Found genuine,
      // confirmed template variance no single closed vocabulary safely
      // covers: at least 6 distinct real English subject shapes ("<self>
      // gets"/"it gets" via a bare pronoun/"target creature gets"/"target
      // creature you control gets"/"that creature gets" after a kicker
      // "instead" clause/"creatures you control get"/"Other creatures you
      // control get"/subtype-filtered "Wizards you control get"/"Equipped
      // creature gets"), plus real compound modifiers (Vayne's Treachery's
      // own kicker-conditional SECOND pump effect refers back to the FIRST
      // one's own chosen target via "that creature," not a fresh "target
      // creature" clause — a genuinely different pronoun-carryover problem
      // than `putCounterTarget-effect-structural.ts`'s own documented
      // "immediately preceded by tapTarget" case, with no equally clean
      // structural signal to gate on) — a materially bigger, riskier lift
      // than `destroy`/`drawCard`'s own single-verb templates; not
      // attempted in this pass.
      effects: [{ kind: 'pumpSelf', power: 1, toughness: 0, untilEndOfTurn: true } satisfies Effect],
    },
  ],
  // This card's own "wants a land to enter" sink used to need a tier-3
  // `CardDefinition.authoredFacts` escape hatch (`'onLandfall'` is a
  // free-text `Trigger.name`, not one of `Trigger.on`'s closed
  // 'enter'/'upkeep'/'endStep'/'attacks' vocabulary) — now that Magic's own
  // fixed Landfall ability-word reminder template ("Landfall — Whenever a
  // land you control enters,") has a real recognizer
  // (`recognizers/landfall-trigger-structural.ts`, 2026-09-14), the fact is
  // derived the normal way instead, straight into this card's own
  // `synergy.json` sink array with real provenance — same graduation
  // `ashe-princess-of-dalmasca`'s own `onAttack` trigger already went
  // through for `attacks-trigger-structural`.
};
