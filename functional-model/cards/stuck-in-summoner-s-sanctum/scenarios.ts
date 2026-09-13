// Real engine-piloted trace (see engine-trace.ts's own header) — migrated
// off the old plain `harness.ts` `Scenario[]` shape (2026-09-12,
// ENGINE_GAPS.md gap #18's closure) now that this card's own real
// "activated abilities can't be activated" clause is mechanically real
// (`card.ts`'s `CardDefinition.activatedAbilityLock`, checked by
// `engine.ts`'s `canActivateAbility`) — demonstrating a LOCKED activation
// attempt needs the real engine's own `canActivateAbility` legality check,
// which the flat harness.ts model has no concept of at all (no activated-
// ability-attempt step). Dropped the old `keywordScenarios(...)` spread —
// it contributed nothing anyway (this card has no Lifelink/ptFormula CDA
// and isn't Legendary; Flash is a cast-timing-only keyword `keywordScenarios`
// deliberately doesn't probe either, per its own doc comment), so nothing
// real is lost.
import { stuckInSummonersSanctum } from './definition';
import { coeurl } from '../coeurl/definition';
import { basicLandsFor } from '../../mana';
import type { TraceResult } from '../../harness';
import { setupEnginePilot, pilotActions, pilotCast, pilotResolveTop, pilotExpectIllegalActivate, finishEnginePilotTrace, type EnginePilotSetup } from '../../engine-trace';

export function runEngineScenarios(): TraceResult[] {
  const setup: EnginePilotSetup = { you: { basicLands: basicLandsFor('{2}{U}') } };
  const pilot = setupEnginePilot(setup);

  // Coeurl (data/fin/fin_scryfall.json: {1}{W} Creature — Cat Beast, 2/2,
  // real `{1}{W}, {T}: Tap target creature.` activated ability) — the same
  // real, non-token FIN card summon-bahamut's/fate-of-the-sun-cryst's own
  // scenarios already use, chosen here specifically because it HAS a real
  // activated ability of its own — exactly what `activatedAbilityLock`
  // needs to demonstrate genuinely blocked. Seeded directly onto the
  // caster's own battlefield (never cast) — this card's real "Enchant
  // artifact or creature" carries no controller restriction (checked
  // against `../mtg-forge`'s own `K:Enchant:Artifact,Creature`, no
  // `ValidTgts$`-style owner filter), so enchanting your own permanent is
  // exactly as legal a target as an opponent's.
  const coeurlReal = pilot.state.addCard(pilot.you, 'Battlefield', { name: 'Coeurl', types: ['Creature'], subtypes: ['Cat', 'Beast'], basePower: 2, baseToughness: 2, cmc: 2 });
  pilot.log.push({ fn: 'enters', card: coeurlReal.name, zone: 'Battlefield', power: coeurlReal.basePower, toughness: coeurlReal.baseToughness, controller: pilot.you.name });

  const cardReal = pilot.state.addCard(pilot.you, 'Hand', { name: stuckInSummonersSanctum.name, types: [] });
  const actions = pilotActions(pilot, cardReal.id);
  const ctx = pilot.ctxFor(cardReal, { preferTarget: (c) => c.getId() === coeurlReal.id });

  // Flash lets this be cast any time — cast + resolve right away, real
  // Main1 with an empty stack, so ordinary sorcery-speed timing would be
  // legal here too.
  pilotCast(pilot, cardReal, stuckInSummonersSanctum, ctx, actions);
  // Real ETB: attaches to (real `state.equip`, `RealCard.attachedToId`) AND
  // taps Coeurl, both against the same real chosen target — the
  // `onEnter` trigger auto-fires here (`engine.ts`'s real `on:'enter'`
  // auto-fire, `resolveTop`'s own `enterTrigger` branch).
  pilotResolveTop(pilot);

  // Isolate the LOCK from the separate cost-payability question: Coeurl is
  // tapped right now (the ETB trigger's own real tap), so an activation
  // attempt would ALSO be illegal for a completely different, unrelated
  // reason ("already tapped") if left as-is — that wouldn't demonstrate
  // THIS card's own real `activatedAbilityLock` at all. Untapped directly
  // here (`state.untap`, bypassing the real engine's own `untap()` — a
  // direct state mutation for scenario setup, same "represent the real
  // event/state directly" technique other engine-piloted scenarios already
  // use for an off-card event) purely so the ONLY reason left for the
  // rejection below is the real lock. This card's own separate, still-open
  // "doesn't untap during its controller's untap step" clause (ENGINE_GAPS.md
  // gap #18's own unchanged remainder) is NOT modeled or exercised by this —
  // a real untap STEP genuinely reaching this creature stays a different,
  // unrelated, unbuilt mechanism; this is just clearing a stale tap flag
  // for test isolation, not simulating that step.
  pilot.beginStep('(scenario setup) Coeurl is untapped directly, isolating the activation-lock check from its own unrelated tapped-cost state');
  pilot.state.untap(coeurlReal);

  // Real 602.1/613 legality check: Coeurl's own real activated ability is
  // now genuinely LOCKED by this Aura's `activatedAbilityLock` (`state.ts`'s
  // `isActivationLocked`, consulted by `canActivateAbility`) — attempting it
  // is rejected for that real reason, not tap/summoning-sickness/mana.
  pilotExpectIllegalActivate(pilot, pilot.you, coeurlReal, coeurl, "Attempt (expected illegal): Coeurl's own {1}{W}, {T} ability, now locked by Stuck in Summoner's Sanctum");

  const result =
    "Stuck in Summoner's Sanctum is cast (Flash) and enters attached to the caster's own Coeurl, tapping it (the onEnter trigger's attach + tap). Coeurl's own activated ability, which would otherwise be perfectly legal, is now LOCKED by this Aura's 'activated abilities can't be activated' clause (`CardDefinition.activatedAbilityLock`, ENGINE_GAPS.md gap #18, closed) — the attempt is rejected by the engine (`canActivateAbility`), logged as an `illegalAttempt` with the CantBeActivated reason, not silently skipped. This card's own separate 'doesn't untap during its controller's untap step' clause remains an unrelated, still-open gap (ENGINE_GAPS.md) — not touched or exercised by this scenario.";

  return [finishEnginePilotTrace(pilot, setup, "engine playthrough: cast (Flash) -> resolve (attaches + taps Coeurl) -> Coeurl's own activated ability is locked", result)];
}
