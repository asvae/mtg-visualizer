import { syncopate } from './definition';
import { fireMagic } from '../fire-magic/definition';
import { basicLandsFor } from '../../mana';
import { canCastSpell, castSpell } from '../../engine';
import type { EffectContext } from '../../card';
import type { TraceResult } from '../../harness';
import { loggingCard, loggingPlayer, loggingActions } from '../../harness';
import { setupEnginePilot, pilotActions, pilotCast, pilotResolveTop, finishEnginePilotTrace, type EnginePilotSetup } from '../../engine-trace';

// Single scenario, per the standing "default 1, real basic function" rule
// (SYNERGY_DESIGN.md) — casts Syncopate with a real, caster-chosen X > 0,
// targeting a real spell genuinely on the stack (Fire Magic, {R} Instant,
// data/fin/fin_scryfall.json fin/9 — a real FIN card, not an invented
// placeholder), and counters it.
//
// Engine-trace (not plain harness.ts) style, needed for the ONE real
// mechanical thing this scenario demonstrates: a genuine `{X}{U}` cast
// paying a caster-chosen X (ENGINE_GAPS.md gap #6's spell-cast {X}
// closure — `canCastSpell`/`castSpell` take an optional `x` and resolve it
// into the affordability/payment check; the closure's own generic test
// (engine.test.ts, "{X} mana costs" describe block) uses a synthetic
// fixture, this is the real card).
//
// The opponent's own Fire Magic is cast directly via the real, low-level
// `canCastSpell`/`castSpell` pair (NOT `pilotCast`, which always casts as
// `pilot.you` — no pilot helper in this file casts as an opponent) so a
// REAL spell genuinely occupies the stack underneath Syncopate — this is
// the actual, correct in-game order too (opponent casts, you respond by
// casting Syncopate, Syncopate resolves FIRST, LIFO, real CR 405/608). Its
// own `ctx`/`actions` are built the same way `setupEnginePilot`'s own
// `ctxFor` builds one, just from the OPPONENT's perspective (`you`/
// `opponents` swapped) — never actually read, since this scenario never
// resolves Fire Magic (it stays on the stack, uninvolved, exactly like a
// countered spell that's never subsequently followed to its own
// resolution).
function countersARealSpellWithARealXValue(): TraceResult {
  const setup: EnginePilotSetup = {
    you: { basicLands: basicLandsFor('{2}{U}') }, // {X}{U} at X=2 resolves to {2}{U}: 2 generic + 1 blue.
    opponents: [{ basicLands: basicLandsFor('{R}') }],
  };
  const pilot = setupEnginePilot(setup);
  const opponent = pilot.opponents[0]!;

  // The opponent's own real target spell, cast for real (its own {R} cost
  // genuinely paid) — an actual object on the stack, not a synthetic
  // stand-in.
  const oppSpellReal = pilot.state.addCard(opponent, 'Hand', { name: fireMagic.name, types: [] });
  const oppCtx: EffectContext = {
    self: loggingCard(pilot.state, oppSpellReal, pilot.log),
    you: loggingPlayer(pilot.state, opponent, pilot.log),
    opponents: [loggingPlayer(pilot.state, pilot.you, pilot.log)],
    castFrom: 'hand',
  };
  const oppActions = loggingActions(pilot.state, pilot.log, oppSpellReal.id);
  pilot.beginStep(`Opponent casts ${fireMagic.name} (${fireMagic.manaCost})`);
  const oppCheck = canCastSpell(pilot.engine, opponent, fireMagic);
  if (!oppCheck.ok) throw new Error(`opponent cast of "${fireMagic.name}" illegal: ${oppCheck.reason}`);
  pilot.log.push({ fn: 'cast', card: fireMagic.name, from: 'hand', cost: fireMagic.manaCost, controller: opponent.name });
  const oppCast = castSpell(pilot.engine, opponent, oppSpellReal, fireMagic, oppCtx, oppActions);
  if (!oppCast.ok) throw new Error(`opponent cast of "${fireMagic.name}": ${oppCast.reason}`);
  for (const source of oppCast.tappedForMana ?? []) pilot.log.push({ fn: 'tapForMana', target: source.name, for: fireMagic.name, controller: opponent.name });

  // In response, you cast Syncopate — a real X=2 announced and paid (CR
  // 601.2b), not the default X=0.
  const cardReal = pilot.state.addCard(pilot.you, 'Hand', { name: syncopate.name, types: [] });
  const actions = pilotActions(pilot, cardReal.id);
  const ctx = pilot.ctxFor(cardReal);
  pilotCast(pilot, cardReal, syncopate, ctx, actions, undefined, undefined, undefined, 2);
  pilotResolveTop(pilot);

  const result =
    "Counters the opponent's Fire Magic — a spell cast onto the stack in the setup above, still sitting there (uninvolved, unresolved) when Syncopate resolves on top of it, LIFO stack order (CR 405/608) — while paying a caster-chosen X=2: the logged `cast` entry's own `cost` reads {2}{U} (2 generic + 1 blue, 3 lands tapped for mana), not the printed template {X}{U} (ENGINE_GAPS.md gap #6, closed for spell-cast {X} — engine.test.ts's own synthetic fixture already covers the general mechanism, this is the {X}{U}-costed card). The `counter` log line fires unconditionally — the same log-only ceiling `kind:'counter'` already has for every card that uses it (Louisoix's Sacrifice's own identical shape): this engine has no stack/object model that lets a resolving spell remove a different object from the stack, so there's nothing a target reference could point at and remove. The 'unless its controller pays {X}' branch (a choice belonging to the COUNTERED spell's controller, made mid-resolution — this engine has no player-decision process for that) and the exile-instead-of-graveyard destination (there's no target reference to redirect in the first place) are both printed text this model can't mechanically enforce — left honestly undemonstrated rather than faked; see definition.ts for the full reasoning on both.";
  return finishEnginePilotTrace(
    pilot,
    setup,
    "engine playthrough: opponent casts Fire Magic ({R} payment) -> you cast Syncopate in response (X=2 payment, {2}{U}) -> resolve (counters unconditionally, per this engine's log-only counter primitive)",
    result,
  );
}

export function runEngineScenarios(): TraceResult[] {
  return [countersARealSpellWithARealXValue()];
}
