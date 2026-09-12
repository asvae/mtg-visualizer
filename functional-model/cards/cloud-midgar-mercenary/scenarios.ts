// Real engine-piloted trace (see engine-trace.ts's own header). onEnter is
// a real recognized auto-fire (603.6b) — wired via `on: 'enter'` on this
// card's own definition.ts (same convention Jill's own onEnter uses).
//
// Full real combo line (2026-09-12, per direct user request — "fin 563
// could be used to test"; updated same day once trigger-doubling itself
// became real, ENGINE_GAPS.md gap #13): cast Cloud -> real ETB tutors the
// real Ultima Weapon (fin/563, `cards/ultima-weapon/definition.ts` — reused
// directly, not re-authored, so this exercises the SAME modeled card the
// user asked for) into hand -> cast Ultima Weapon for real ({7}) -> equip
// it onto Cloud for real (Equip {7}, real `actions.equip`) -> real 508.1f
// attack declaration -> Ultima Weapon's own real "Whenever equipped
// creature attacks, destroy target creature an opponent controls" trigger
// fires for real (`onEquippedAttacks`, manually fired via
// `pilotFireTrigger` — no auto-dispatch exists for attack-triggered
// abilities anywhere in this engine, a real, general, already-documented
// gap distinct from Cloud's own doubling gap below — see
// `pilotFireTrigger`'s own doc comment).
//
// Cloud's own "as long as this is equipped, if a triggered ability of this
// or an Equipment attached to it triggers, that ability triggers an
// additional time" is now REAL machinery (`card.ts`'s `triggerDoubling`,
// `triggers.ts`'s shared `fireTrigger`, `state.ts`'s `shouldDoubleTrigger`)
// — Cloud is genuinely equipped with Ultima Weapon by the time it attacks,
// so Ultima Weapon's own attack trigger genuinely fires TWICE, producing
// two real `destroy` log entries against two DIFFERENT real opponent
// creatures (the pool is queried fresh each firing — `card.ts`'s own
// `destroy` effect handler re-reads live battlefield state, so the second
// firing correctly targets whichever opponent creature is still alive
// after the first one is destroyed for real).
import { cloudMidgarMercenary } from './definition';
import { ultimaWeapon } from '../ultima-weapon/definition';
import { basicLandsFor } from '../../mana';
import type { TraceResult } from '../../harness';
import {
  setupEnginePilot,
  pilotActions,
  pilotCast,
  pilotResolveTop,
  pilotActivate,
  pilotFireTrigger,
  advanceToPlayersNextMain1,
  advanceToDeclareAttackersStep,
  pilotDeclareAttackers,
  finishEnginePilotTrace,
  type EnginePilotSetup,
} from '../../engine-trace';

export function runEngineScenarios(): TraceResult[] {
  // 9 real Plains cover {W}{W} (Cloud) + {7} (cast Ultima Weapon, turn 1) +
  // {7} (Equip, turn 2, same 9 lands after a real untap step) — colored
  // sources freely pay a generic cost (mana.ts's own `canAfford`), so one
  // pool suffices across both turns.
  const setup: EnginePilotSetup = {
    you: { basicLands: basicLandsFor('{W}{W}{7}'), libraryCount: 8 },
    // TWO real, non-token FIN creatures — Coeurl (data/fin/fin_scryfall.json:
    // {1}{W} Creature — Cat Beast, 2/2, the same one summon-bahamut's/
    // fate-of-the-sun-cryst's own scenarios already use as a real destroy
    // target) and Hill Gigas ({4}{R}{R} Creature — Giant, 5/4, the same one
    // diamond-weapon's own scenario already uses as a real attacker) — the
    // doubled destroy trigger below needs TWO distinct, real, legal targets,
    // not one target destroyed twice.
    opponents: [
      {
        libraryCount: 8,
        creatureCards: [
          { name: 'Coeurl', subtypes: ['Cat', 'Beast'], power: 2, toughness: 2 },
          { name: 'Hill Gigas', subtypes: ['Giant'], power: 5, toughness: 4 },
        ],
      },
    ],
  };
  const pilot = setupEnginePilot(setup);

  const cloudReal = pilot.state.addCard(pilot.you, 'Hand', {
    name: cloudMidgarMercenary.name,
    types: ['Creature'],
    subtypes: ['Human', 'Soldier', 'Mercenary', 'Legendary'],
  });
  // The real Ultima Weapon card itself, seeded directly into the library
  // (not the generic `libraryArtifactCount` placeholder) — a real, named,
  // playable Equipment for Cloud's own ETB to find, per this project's own
  // "real cards, not fabricated filler" convention.
  const ultimaWeaponReal = pilot.state.addCard(pilot.you, 'Library', {
    name: ultimaWeapon.name,
    types: ['Artifact'],
    subtypes: ['Equipment'],
  });

  const cloudActions = pilotActions(pilot, cloudReal.id);
  const cloudCtx = pilot.ctxFor(cloudReal);

  // Turn 1: cast Cloud ({W}{W}), real mana payment.
  pilotCast(pilot, cloudReal, cloudMidgarMercenary, cloudCtx, cloudActions);
  // Resolves; real 603.6b ETB auto-fires — searches the real library for
  // the one real Equipment card (Ultima Weapon), puts it into hand.
  pilotResolveTop(pilot);

  const ultimaActions = pilotActions(pilot, ultimaWeaponReal.id);
  const ultimaCtx = pilot.ctxFor(ultimaWeaponReal);

  // Still turn 1: cast Ultima Weapon for real ({7}).
  pilotCast(pilot, ultimaWeaponReal, ultimaWeapon, ultimaCtx, ultimaActions);
  pilotResolveTop(pilot); // enters the battlefield, unattached (no ETB effect)

  // Turn 2 (lands untap for real; Cloud's own 302.6 summoning sickness has
  // now genuinely cleared too, entered turn 1).
  advanceToPlayersNextMain1(pilot, pilot.you);

  // Equip {7}: attach Ultima Weapon to Cloud for real (`actions.equip`,
  // 301.5c sorcery-speed-gated, `canActivateAbility`'s own `isEquipment`
  // check).
  pilotActivate(pilot, pilot.you, ultimaWeaponReal, ultimaWeapon, ultimaCtx, ultimaActions, 'Equip {7}: attach Ultima Weapon to Cloud');
  pilotResolveTop(pilot); // runs the real custom effect: chooses Cloud (the only creature you control), attaches

  advanceToDeclareAttackersStep(pilot);
  // Real 508.1a/508.1f: Cloud, now +7/+7 from Ultima Weapon's static, attacks.
  pilotDeclareAttackers(pilot, [cloudReal], 'Declare Cloud (equipped, +7/+7) as attacker');

  // Ultima Weapon's own real "Whenever equipped creature attacks, destroy
  // target creature an opponent controls" — no auto-dispatch exists for an
  // attack-triggered ability anywhere in this engine (a real, general,
  // already-accepted gap — see `pilotFireTrigger`'s own doc comment, and
  // `cards/ultima-weapon/scenarios.ts`'s own flat harness scenario, which
  // fires this identical trigger the same explicit way), so it's manually
  // fired here exactly like every other real engine-piloted card that hits
  // this same gap.
  // Cloud is genuinely equipped (with Ultima Weapon itself) by this point,
  // so `pilotFireTrigger`'s own internal `fireTrigger` call finds Cloud's
  // real `triggerDoubling` grant and re-runs this SAME trigger a second
  // time for real — logging a second `{fn:'trigger', ...}` bracket AND a
  // second real `destroy` line against the other real opponent creature.
  pilotFireTrigger(pilot, ultimaWeapon, ultimaCtx, ultimaActions, 'onEquippedAttacks', "Ultima Weapon's own attack trigger fires (equipped creature attacks) — doubled by Cloud's own equipped static");

  const result =
    "Cloud enters; ETB (603.6b) searches your library for the Ultima Weapon, puts it into hand. Ultima Weapon is cast ({7}) and equipped onto Cloud (Equip {7}, +7/+7 static). Cloud attacks (508.1f); Ultima Weapon's own attack trigger fires — and, because Cloud is genuinely equipped, his own \"triggers an additional time\" static (ENGINE_GAPS.md gap #13, now real machinery) doubles it, so it fires TWICE, destroying BOTH real opponent creatures (Coeurl, then Hill Gigas).";
  return [
    finishEnginePilotTrace(
      pilot,
      setup,
      "real engine playthrough: cast Cloud -> real ETB tutor -> cast+equip Ultima Weapon -> real attack -> Ultima Weapon's own destroy trigger fires TWICE (Cloud's own doubling static is now real)",
      result,
    ),
  ];
}
