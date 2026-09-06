// State-based actions (704) — a narrow, real subset, not full 704. Checked
// against `GameAction.java`'s own state-based-effects pass
// (forge-game/src/main/java/forge/game/GameAction.java) — rule citations
// like `704.5f`/`704.5g`/`704.5h`/`704.5j` appear directly in that method's
// own comments (~lines 1455-1760, 2006-2065 for the legend rule). There is
// no `StateBasedAction` class by that name in real Forge; it's folded into
// `GameAction`'s own method, same here.
//
// Real 704.3: "Whenever a player would get priority... the game checks...
// performs all applicable state-based actions simultaneously... repeats...
// until there are no further state-based actions to be performed."
// `checkStateBasedActions` loops the same way — a card destroyed this
// sweep could change what a LATER sweep sees (a legend-rule removal
// changing nothing else here, but the loop-until-stable shape is the real
// rule, not an arbitrary choice).
//
// Explicit scope — real, but deliberately narrow:
//  - 704.5f: a creature with toughness 0 or less is put into its owner's
//    graveyard UNCONDITIONALLY — this is NOT a "destroy" (Indestructible
//    does not save it; a real 0-toughness creature dies regardless).
//  - 704.5g: a creature with damage marked >= its toughness is DESTROYED
//    (`state.destroy` — DOES respect Indestructible, 702.12b).
//  - 704.5h: a creature dealt any damage by a Deathtouch source is
//    DESTROYED (same Indestructible-respecting path as 704.5g).
//  - 704.5j: the legend rule — already real and pre-existing
//    (`state.checkLegendRule`, state.ts) — folded into this same
//    loop-until-stable sweep rather than left for a caller to remember to
//    call separately.
//  - 704.5a: a player at 0-or-less life, OR one who just attempted to draw
//    more cards than remained in their library (104.3c — the ATTEMPT is
//    what matters, not merely an empty library nobody's asked anything of
//    — `state.drawCards`'s own `attemptedDrawFromEmpty` flag is set right
//    there, before this file ever sees it), loses the game — real,
//    persistent state now (`RealPlayer.hasLost`, state.ts), set here and
//    never cleared. `engine.ts`'s own `advance` refuses to run any further
//    once any player has this set (a real, deliberate stop, not a silent
//    continuation of a game that's already over).
// NOT in scope (real, plainly-flagged gaps):
//  - 704.5i (a planeswalker with loyalty 0) — no FIN card in this pool has
//    a Planeswalker typeLine today (checked); not modeled until one does.
//  - Damage CLEARING at cleanup (514.2) — a real, separate rule (not
//    itself a state-based action) that would need `turn.ts`'s own Cleanup
//    phase to actually do something; deferred to ENGINE_GAPS.md's
//    turn-structure-completeness gap, alongside upkeep/end-step triggers.
//    Until that exists, `damageMarked`/`deathtouchDamaged` only ever grow
//    within one pilot session.
//  - Aura/Equipment illegal-attachment SBAs (704.5m/704.5q-ish) — no
//    attachment-legality tracking exists in this codebase to check against.

import type { GameState, RealCard, RealPlayer } from './state';
import { effectiveTypes, effectivePT, isLethallyDamaged } from './state';

export interface StateBasedActionsResult {
  /** 704.5g/704.5h — destroyed via `state.destroy` (respects Indestructible; a card that WOULD be destroyed but is Indestructible is NOT included here — it stays on the battlefield, still lethally damaged, same as real Forge). */
  destroyed: RealCard[];
  /** 704.5f — toughness <= 0, put directly into the graveyard, bypassing Indestructible entirely (a real, different rule from `destroyed` above). */
  putIntoGraveyard: RealCard[];
  /** 704.5j — the legend rule, via the pre-existing `state.checkLegendRule`. */
  legendRuleRemoved: RealCard[];
  /** 704.5a — players newly marked `hasLost` THIS call (0-or-less life, or an attempted draw from an empty library) — empty on every later call once a player's already lost (a real, persistent loss, not re-detected/re-reported). */
  lost: RealPlayer[];
}

/** One real, narrow sweep of state-based actions — see this file's own header for exactly which ones. Loops until a full pass makes no further change (704.3). */
export function checkStateBasedActions(state: GameState, players: RealPlayer[]): StateBasedActionsResult {
  const destroyed: RealCard[] = [];
  const putIntoGraveyard: RealCard[] = [];
  const legendRuleRemoved: RealCard[] = [];
  const lost: RealPlayer[] = [];

  let changed = true;
  while (changed) {
    changed = false;
    for (const player of players) {
      for (const card of [...player.battlefield]) {
        if (!effectiveTypes(card).includes('Creature')) continue;
        const [, toughness] = effectivePT(state, card);
        if (toughness <= 0) {
          state.move(card, 'Graveyard');
          putIntoGraveyard.push(card);
          changed = true;
          continue;
        }
        if (isLethallyDamaged(state, card)) {
          if (state.destroy(card)) {
            destroyed.push(card);
            changed = true;
          }
          // Indestructible: state.destroy returned false, nothing moved —
          // the card stays lethally damaged and would just be re-detected
          // next sweep with no new consequence, so don't loop on it.
        }
      }
      const removedThisPlayer = state.checkLegendRule(player);
      if (removedThisPlayer.length > 0) {
        legendRuleRemoved.push(...removedThisPlayer);
        changed = true;
      }
      // 704.5a — checked LAST for this player, same real ordering rationale
      // 704.3's own "simultaneously, then re-check" already covers: a loss
      // condition doesn't need to precede/follow any of the above within
      // one sweep, it just needs to be caught before this function returns.
      if (!player.hasLost && (player.life <= 0 || player.attemptedDrawFromEmpty)) {
        player.hasLost = true;
        lost.push(player);
        changed = true;
      }
    }
  }

  return { destroyed, putIntoGraveyard, legendRuleRemoved, lost };
}
