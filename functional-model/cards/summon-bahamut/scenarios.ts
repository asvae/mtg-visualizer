// Real engine-piloted trace (see engine-trace.ts's own header). Chapter
// I/II's "destroy up to one target nonland permanent" has no owner
// restriction, and this model's chooseTarget always picks the first
// candidate in an unrestricted pool — which is self. Scenario A declines
// both times (a real opponent permanent is present, so it's a genuine
// choice); scenario B is a minimal, separate proof that "destroy" actually
// fires (with no other target around, it legally, if pointlessly, destroys
// itself) — needed since declining short-circuits before the real target
// pool is even built (card.ts's own `declineOptional` check).

import { summonBahamut } from './definition';
import { basicLandsFor } from '../../mana';
import type { TraceResult } from '../../harness';
import { setupEnginePilot, pilotActions, pilotCast, pilotResolveTop, advanceToPlayersNextMain1, finishEnginePilotTrace, type EnginePilotSetup } from '../../engine-trace';

function scenarioA(): TraceResult {
  const setup: EnginePilotSetup = {
    you: { libraryCount: 15, basicLands: basicLandsFor('{9}') },
    opponents: [{ tokens: ['c_a_treasure_sac'], libraryCount: 10 }],
  };
  const pilot = setupEnginePilot(setup);

  const bahamutReal = pilot.state.addCard(pilot.you, 'Hand', {
    name: summonBahamut.name,
    types: ['Creature', 'Enchantment'],
    subtypes: ['Saga', 'Dragon'],
    keywords: summonBahamut.keywords,
  });
  const actions = pilotActions(pilot, bahamutReal.id);
  // Same ctx reused verbatim by every later chapter (resolveTop at cast,
  // then advanceSagasAfterDrawStep) — one real "decline" choice, honored
  // automatically each time it applies.
  const ctx = pilot.ctxFor(bahamutReal, { declineOptional: true });

  // Cast Bahamut ({9}), real mana payment
  pilotCast(pilot, bahamutReal, summonBahamut, ctx, actions);
  // Resolves; real 714.2b/c fires chapter I immediately — declines the destroy
  pilotResolveTop(pilot);

  // Real turn passage — chapter II fires on your next draw step, declines again
  advanceToPlayersNextMain1(pilot, pilot.you, bahamutReal);

  // Another real turn — chapter III fires: draw two cards
  advanceToPlayersNextMain1(pilot, pilot.you, bahamutReal);

  // This model has no mana-value field on RealCard — supply the real
  // number chapter IV's "total mana value" read needs.
  ctx.triggerInput = { totalManaValue: 7 };

  // Another real turn — chapter IV fires: 7 damage to the opponent (Mega
  // Flare), then 714.4's real sacrifice (nothing reset lore counters first)
  advanceToPlayersNextMain1(pilot, pilot.you, bahamutReal);
  if (bahamutReal.zone === 'Graveyard') {
    pilot.beginStep('Real 714.4 sacrifice — lore counters were never reset');
    pilot.log.push({ fn: 'sacrifice', player: pilot.you.name, card: summonBahamut.name });
  }

  const result =
    'Bahamut enters, chapter I fires (714.2b) but declines its own destroy — a real opponent Treasure is on the battlefield the whole time, so this is a genuine choice; chapter II declines the same way; chapter III draws two real cards; chapter IV deals real damage equal to a real total mana value, then Bahamut is sacrificed (714.4) since nothing reset its lore counters first.';
  return finishEnginePilotTrace(pilot, setup, 'real engine playthrough: cast -> ETB Saga tick -> chapters over real turns -> 714.4 sacrifice', result);
}

function scenarioB(): TraceResult {
  const setup: EnginePilotSetup = { you: { basicLands: basicLandsFor('{9}') } };
  const pilot = setupEnginePilot(setup);
  const bahamutReal = pilot.state.addCard(pilot.you, 'Hand', {
    name: summonBahamut.name,
    types: ['Creature', 'Enchantment'],
    subtypes: ['Saga', 'Dragon'],
    keywords: summonBahamut.keywords,
  });
  const actions = pilotActions(pilot, bahamutReal.id);
  const ctx = pilot.ctxFor(bahamutReal); // no decline — proves "destroy" really fires

  pilotCast(pilot, bahamutReal, summonBahamut, ctx, actions);
  // Resolves; chapter I fires — Bahamut is the only nonland permanent
  // anywhere, so it legally (if pointlessly) destroys itself.
  pilotResolveTop(pilot);

  const result = 'Chapter I\'s unrestricted "destroy up to one target nonland permanent" has no target but Bahamut itself, so it legally destroys itself for real — documenting the effect actually fires (the sane real line is scenario A above).';
  return finishEnginePilotTrace(pilot, setup, 'real engine playthrough: cast -> ETB Saga tick fires chapter I with no other target', result);
}

export function runEngineScenarios(): TraceResult[] {
  return [scenarioA(), scenarioB()];
}
