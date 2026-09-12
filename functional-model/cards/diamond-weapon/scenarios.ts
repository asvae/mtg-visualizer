// Real engine-piloted trace (see engine-trace.ts's own header) — migrated
// off the old plain `harness.ts` `Scenario[]` shape (a bare "enters the
// battlefield, no resolvable effect" placeholder, since NEITHER of this
// card's two static clauses had any engine mechanism to demonstrate) now
// that its own real "Immune — Prevent all combat damage that would be
// dealt to Diamond Weapon" clause is mechanically real (ENGINE_GAPS.md gap
// #8, closed) — demonstrating it needs REAL combat (an attacker, a block,
// real damage resolution), which the flat harness.ts Scenario model has no
// concept of at all (no attack/block/damage-assignment step — see
// harness.ts's own `Scenario.dealsCombatDamage` doc comment). ONE real
// scenario per the standing "default 1, no edge-case coverage" rule —
// same precedent edgar-king-of-figaro's own migration already established:
// dropped the old `keywordScenarios(diamondWeapon)` spread (which would
// otherwise add an unrequested 704.5j legend-rule edge case since Diamond
// Weapon is Legendary), not carried forward here either.

import { diamondWeapon } from './definition';
import { basicLandsFor } from '../../mana';
import { typesFromTypeLine, subtypesFromTypeLine } from '../../harness';
import type { TraceResult } from '../../harness';
import {
  setupEnginePilot,
  pilotActions,
  pilotCast,
  pilotResolveTop,
  advanceToPlayersNextMain1,
  advanceToDeclareAttackersStep,
  advanceOneStep,
  pilotDeclareAttackers,
  pilotDeclareBlockers,
  pilotResolveCombatDamage,
  finishEnginePilotTrace,
  type EnginePilotSetup,
} from '../../engine-trace';

export function runEngineScenarios(): TraceResult[] {
  const setup: EnginePilotSetup = {
    you: { basicLands: basicLandsFor('{7}{G}{G}'), libraryCount: 10 },
    opponents: [{ basicLands: ['Mountain'], libraryCount: 10 }],
  };
  const pilot = setupEnginePilot(setup);

  const dwReal = pilot.state.addCard(pilot.you, 'Hand', {
    name: diamondWeapon.name,
    types: typesFromTypeLine(diamondWeapon.typeLine),
    subtypes: subtypesFromTypeLine(diamondWeapon.typeLine),
    keywords: diamondWeapon.keywords,
    basePower: diamondWeapon.pt?.[0],
    baseToughness: diamondWeapon.pt?.[1],
  });
  const actions = pilotActions(pilot, dwReal.id);

  // Cast Diamond Weapon ({7}{G}{G}), real mana payment.
  pilotCast(pilot, dwReal, diamondWeapon, pilot.ctxFor(dwReal), actions);
  pilotResolveTop(pilot);

  // A real opponent attacker — Hill Gigas (real FIN creature, 5/4,
  // Trample/Haste) — seeded directly onto the opponent's battlefield
  // (never cast), same "no sickness on a directly-seeded creature"
  // convention every other engine-piloted scenario's own filler already
  // relies on (`engine.enteredThisTurn` has no entry for it either way).
  pilot.beginStep('Real opponent attacker: Hill Gigas (5/4, Trample/Haste)');
  const oppAttacker = pilot.state.addCard(pilot.opponents[0]!, 'Battlefield', {
    name: 'Hill Gigas',
    types: ['Creature'],
    subtypes: ['Giant'],
    basePower: 5,
    baseToughness: 4,
    keywords: ['Trample', 'Haste'],
    cmc: 6,
  });
  pilot.log.push({ fn: 'enters', card: oppAttacker.name, zone: 'Battlefield', power: oppAttacker.basePower, toughness: oppAttacker.baseToughness, controller: pilot.opponents[0]!.name });

  // Real turn passage to the OPPONENT's own turn (508.1: only the active
  // player declares attackers) — blocking itself has no summoning-sickness
  // restriction (302.6 only restricts a creature's OWN attack/{T} ability),
  // so Diamond Weapon can legally block the very turn it resolved.
  advanceToPlayersNextMain1(pilot, pilot.opponents[0]!);
  advanceToDeclareAttackersStep(pilot);
  pilotDeclareAttackers(pilot, [oppAttacker]);
  advanceOneStep(pilot); // -> Declare Blockers
  pilotDeclareBlockers(pilot, [{ blocker: dwReal, attacker: oppAttacker }]);

  // Real 510 combat damage — Diamond Weapon's own real
  // 'CombatDamagePrevention' shield (`state.dealDamage`'s own check)
  // genuinely prevents the 5 combat damage it would otherwise take;
  // Hill Gigas itself still takes Diamond Weapon's real 8 combat damage
  // back (no shield on the attacker's own side).
  pilotResolveCombatDamage(pilot);

  const result =
    "Diamond Weapon is cast for {7}{G}{G}; a real opponent attacker (Hill Gigas, 5/4 Trample) attacks and is blocked by Diamond Weapon — real 510 combat damage resolves, and Diamond Weapon's own 'Immune' shield genuinely PREVENTS the 5 combat damage it would otherwise take (a real fn:'damagePrevented' trace line, not fn:'dealDamage'), while Hill Gigas itself still takes Diamond Weapon's real 8 power back, unshielded. Its own separate 'costs {1} less to cast for each permanent card in your graveyard' clause remains a real, documented, unrelated engine gap (ENGINE_GAPS.md gap #7) — not closed by this pass.";

  return [
    finishEnginePilotTrace(
      pilot,
      setup,
      'real engine playthrough: cast -> opponent attacks -> Diamond Weapon blocks -> real combat damage, combat-damage-prevention shield genuinely fires',
      result
    ),
  ];
}
