// Real engine-piloted trace (see engine-trace.ts's own header). Chapter
// I/II's "destroy up to one target nonland permanent" has no owner
// restriction, so the real pool is BOTH players' nonland permanents.
// Scenario A: chapter I genuinely prefers the opponent's real Treasure over
// Bahamut itself (`preferTarget`, real 704.5d — the token then ceases to
// exist), then chapter II — Bahamut is the only nonland permanent left —
// genuinely declines rather than destroying itself (a real choice, not
// forced; declining is what lets the rest of the Saga's own chapters play
// out at all). Scenario B is a minimal, separate proof that "destroy"
// actually fires when it's forced to (no decline, no other target around —
// it legally, if pointlessly, destroys itself).

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

  // A real, nonzero-mana-value permanent under your own control — without
  // one, chapter IV's real "total mana value of other permanents" sum would
  // be a true but unillustrative 0 (your 9 lands are all mana value 0).
  const allyLegend = pilot.state.addCard(pilot.you, 'Battlefield', { name: 'Ally Legend', types: ['Creature'], basePower: 2, baseToughness: 2, cmc: 3 });
  // A real `enters` entry — without one, it never shows up on the replay
  // board at all (it's never itself a log `target`/`card` later — chapter
  // IV's damage is computed off it, not targeted at it), even though it's
  // really there on the battlefield from the start.
  pilot.log.push({ fn: 'enters', card: allyLegend.name, zone: 'Battlefield', power: allyLegend.basePower, toughness: allyLegend.baseToughness });

  const bahamutReal = pilot.state.addCard(pilot.you, 'Hand', {
    name: summonBahamut.name,
    types: ['Creature', 'Enchantment'],
    subtypes: ['Saga', 'Dragon'],
    keywords: summonBahamut.keywords,
  });
  const actions = pilotActions(pilot, bahamutReal.id);
  // Chapter I genuinely prefers the opponent's Treasure over Bahamut itself
  // — the real pool (card.ts's own unrestricted `destroy` case) is BOTH
  // players' nonland permanents, so without this it'd pick Bahamut (first
  // in an unrestricted pool) and blow itself up before chapter III/IV ever
  // get to run.
  const ctx = pilot.ctxFor(bahamutReal, { preferTarget: (c) => c.getName() === 'Treasure' });

  // Cast Bahamut ({9}), real mana payment
  pilotCast(pilot, bahamutReal, summonBahamut, ctx, actions);
  // Resolves; real 714.2b/c fires chapter I immediately — destroys the real
  // Treasure (704.5d: a destroyed token ceases to exist)
  pilotResolveTop(pilot);

  // Chapter II: the Treasure's gone now, so Bahamut itself is the only
  // legal nonland target left — decline (a real choice, not forced) rather
  // than destroying itself, same reasoning `preferTarget` avoided above.
  ctx.declineOptional = true;

  // Real turn passage — chapter II fires on your next draw step, declines
  advanceToPlayersNextMain1(pilot, pilot.you, bahamutReal);

  // Another real turn — chapter III fires: draw two cards
  advanceToPlayersNextMain1(pilot, pilot.you, bahamutReal);

  // Another real turn — chapter IV fires: real damage to the opponent (Mega
  // Flare) equal to the real total mana value of Ally Legend (lands are 0),
  // then 714.4's real sacrifice (nothing reset lore counters first)
  advanceToPlayersNextMain1(pilot, pilot.you, bahamutReal);
  if (bahamutReal.zone === 'Graveyard') {
    pilot.beginStep('Real 714.4 sacrifice — lore counters were never reset');
    pilot.log.push({ fn: 'sacrifice', player: pilot.you.name, card: summonBahamut.name });
  }

  const result =
    "Bahamut enters, chapter I fires (714.2b) and destroys the opponent's real Treasure (a genuine choice between it and Bahamut itself — the token then ceases to exist, 704.5d); chapter II fires again next turn but only Bahamut itself remains as a legal target, so it genuinely declines rather than destroying itself; chapter III draws two real cards; chapter IV deals real damage equal to the real total mana value of the other permanent you control (Ally Legend, mana value 3 — your lands are all 0), then Bahamut is sacrificed (714.4) since nothing reset its lore counters first.";
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
