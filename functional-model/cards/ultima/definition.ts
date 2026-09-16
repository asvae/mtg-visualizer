import type { CardDefinition, Effect } from '../../card';
import { anyPlayer, destroyEach } from '../../combinator';

export const ultima: CardDefinition = {
  name: 'Ultima',
  manaCost: '{3}{W}{W}',
  typeLine: 'Sorcery',

  effects: [
    {
      // Real `SP$ DestroyAll | ValidCards$ Artifact,Creature` — Forge's own
      // real UNCHOSEN mass-destroy ApiType, genuinely different from the
      // `destroy` Effect kind here (which mirrors the targeted
      // `DestroyEffect`: a player-CHOSEN pool of `qty` picks). `destroy`'s
      // own `validType` also only offers 'permanent'|'creature' — neither
      // covers "artifacts AND creatures, but not lands/enchantments."
      // Migrated 2026-09-16 off a `kind:'custom'` closure onto the real
      // combinator DSL (2026-09-16 `cardType` Filter predicate + `destroy`
      // EachAction, built for exactly this card) — a battlefield-wide pool
      // (both players, `anyPlayer.permanentsInPlay()`, unfiltered by type —
      // broader than `creaturesInPlay()`), narrowed by `filter('cardType',
      // ['artifact', 'creature'])` (an OR-match of the two real printed
      // types), then `destroyEach()` on every match. Same real behavior,
      // now recognizer-readable data instead of an opaque closure.
      kind: 'program',
      describe: 'destroy all artifacts and creatures',
      program: anyPlayer.permanentsInPlay().filter('cardType', ['artifact', 'creature']).each(destroyEach()),
    } satisfies Effect,
    {
      // "End the turn." — real 721.1a machinery, built for real 2026-09-16
      // (previously an honest, documented `kind:'custom'` no-op — no
      // turn-ending primitive existed anywhere in this model at all). Now a
      // genuine `kind:'endTurn'` effect: exiles everything still on the
      // stack (legally always empty for THIS card by the time it resolves —
      // a plain Sorcery can only ever be CAST with an already-empty stack,
      // 307.1a/117.1a, so nothing can be pending underneath it — see
      // `cards/ultima/progress.json` for the full reasoning), exiles Ultima
      // ITSELF instead of letting it go to the graveyard (real Gatherer
      // ruling on Time Stop, the same real ability: "This includes Time
      // Stop, though it will continue to resolve" — `card.ts`'s own
      // `EffectContext.selfToExile`), ends combat, checks state-based
      // actions, then jumps straight to Cleanup (discard down to maximum
      // hand size, damage/until-end-of-turn effects end) — see
      // `interfaces.ts`'s own `endTurn` doc comment for the full real
      // `EndTurnEffect.java` citation.
      kind: 'endTurn',
    } satisfies Effect,
  ],
};
