// Real engine-piloted trace (see engine-trace.ts's own header). FIN-set
// mechanic coverage — Summon: Knights of Round's real Saga chapters (714),
// automated for real by `saga.ts`'s own `advanceSaga`/
// `advanceSagasAfterDrawStep` (called automatically from inside `advance()`
// — see `advanceToPlayersNextMain1`'s own doc comment on why a caller must
// NOT also invoke it directly): a real lore counter + chapter trigger on
// each of five real turn crossings, then the real 714.4 sacrifice once its
// greatest chapter (V) is reached. Same real pattern already proven for
// summon-bahamut's own (non-transforming) Saga — see that card's own
// scenarios.ts.

import { summonKnightsOfRound } from '../../cards/summon-knights-of-round/definition';
import { basicLandsFor } from '../../mana';
import type { TraceResult } from '../../harness';
import { setupEnginePilot, pilotActions, pilotCast, pilotResolveTop, advanceToPlayersNextMain1, finishEnginePilotTrace, type EnginePilotSetup } from '../../engine-trace';

export function runEngineScenarios(): TraceResult[] {
  const setup: EnginePilotSetup = { you: { basicLands: basicLandsFor('{6}{W}{W}'), libraryCount: 10 } };
  const pilot = setupEnginePilot(setup);

  const knightsReal = pilot.state.addCard(pilot.you, 'Hand', {
    name: summonKnightsOfRound.name,
    types: ['Enchantment', 'Creature'],
    subtypes: ['Saga', 'Knight'],
    keywords: summonKnightsOfRound.keywords,
  });
  const actions = pilotActions(pilot, knightsReal.id);
  const ctx = pilot.ctxFor(knightsReal);

  // Cast ({6}{W}{W}); resolves — real 714.2b fires chapter I immediately (3 Knight tokens)
  pilotCast(pilot, knightsReal, summonKnightsOfRound, ctx, actions);
  pilotResolveTop(pilot);

  // Three more real turns — chapters II, III, IV each auto-fire on your own draw step (714.2c)
  advanceToPlayersNextMain1(pilot, pilot.you, knightsReal);
  advanceToPlayersNextMain1(pilot, pilot.you, knightsReal);
  advanceToPlayersNextMain1(pilot, pilot.you, knightsReal);

  // A fifth real turn — chapter V (Ultimate End) auto-fires, then real 714.4 sacrifice
  advanceToPlayersNextMain1(pilot, pilot.you, knightsReal);
  if (knightsReal.zone === 'Graveyard') {
    pilot.beginStep('714.4 sacrifice — greatest chapter (V) reached');
    pilot.log.push({ fn: 'sacrifice', player: pilot.you.name, card: summonKnightsOfRound.name });
  }

  const result =
    "Summon: Knights of Round enters and 714.2b immediately puts its first lore counter on, firing chapter I (three 2/2 Knight tokens) — each of the next three turns' own draw steps (714.2c) automatically ticks another lore counter and fires the next chapter (II, III each another three tokens; IV likewise), with zero scenario-side scripting of when a chapter fires. A fifth turn ticks chapter V (Ultimate End: the other Knights get +2/+2 and an indestructible counter), and since its own greatest chapter number is now reached, the 714.4 sacrifice removes it automatically.";
  return [
    finishEnginePilotTrace(
      pilot,
      setup,
      'engine playthrough: cast -> automatic Saga lore-counter ticks across 5 turns -> chapters I-V -> 714.4 sacrifice',
      result
    ),
  ];
}
