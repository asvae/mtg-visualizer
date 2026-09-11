// Real engine-piloted trace (see engine-trace.ts's own header) — a plain
// instant, one real scenario: cast targeting the opponent's only real
// nonland permanent (no other candidate exists on either battlefield, so
// the unrestricted `destroy` pool resolves to it with no preferTarget
// needed). The card's own "costs {2} less if it targets a tapped creature"
// cost-reduction clause is a real, DOCUMENTED engine gap (ENGINE_GAPS.md
// #7 — cost-reduction effects aren't modeled at all, only Flashback-style
// cost REPLACEMENT is) — not exercised here; this scenario pays the full
// printed {4}{W} and just demonstrates the actual destroy effect.
//
// Target is a real, NON-TOKEN permanent (Coeurl, data/fin/fin_scryfall.json:
// {1}{W} Creature — Cat Beast, 2/2 — same real card summon-bahamut's own
// scenario A uses), not a token: `card.ts`'s `destroy` case logs a literal
// `fn:'destroy'` line only for a real permanent; a token instead logs
// `ceasesToExist` (111.7/704.5d — a token ceases to exist rather than ever
// really sitting in a graveyard), which can't back a real `event:'destroy'`
// ACT fact as trace evidence (same reasoning documented on summon-bahamut's
// own scenario file).

import { fateOfTheSunCryst } from './definition';
import { basicLandsFor } from '../../mana';
import type { TraceResult } from '../../harness';
import { setupEnginePilot, pilotActions, pilotCast, pilotResolveTop, finishEnginePilotTrace, type EnginePilotSetup } from '../../engine-trace';

function destroysOpponentCreature(): TraceResult {
  const setup: EnginePilotSetup = {
    you: { basicLands: basicLandsFor('{4}{W}') },
    opponents: [{}],
  };
  const pilot = setupEnginePilot(setup);

  const oppCreature = pilot.state.addCard(pilot.opponents[0]!, 'Battlefield', { name: 'Coeurl', types: ['Creature'], subtypes: ['Cat', 'Beast'], basePower: 2, baseToughness: 2, cmc: 2 });
  pilot.log.push({ fn: 'enters', card: oppCreature.name, zone: 'Battlefield', power: oppCreature.basePower, toughness: oppCreature.baseToughness, controller: pilot.opponents[0]!.name });

  const cardReal = pilot.state.addCard(pilot.you, 'Hand', { name: fateOfTheSunCryst.name, types: [] });
  const actions = pilotActions(pilot, cardReal.id);
  const ctx = pilot.ctxFor(cardReal);

  pilotCast(pilot, cardReal, fateOfTheSunCryst, ctx, actions);
  pilotResolveTop(pilot);

  const result = "Destroys the opponent's real Coeurl, the only nonland permanent on either battlefield (a real, non-token permanent, so it's a real 701.6 destroy, not a token ceasing to exist); the spell itself then goes to its owner's graveyard after resolving (rule 608.2m).";
  return finishEnginePilotTrace(pilot, setup, 'real engine playthrough: cast -> resolve (Destroy target nonland permanent)', result);
}

export function runEngineScenarios(): TraceResult[] {
  return [destroysOpponentCreature()];
}
