// Real engine-piloted trace (see engine-trace.ts's own header), same real
// "cast -> ETB Saga tick -> chapters over real turns -> 714.4 sacrifice"
// shape summon-bahamut's own scenarioA already establishes for a plain
// (non-transforming) Saga — this card's own max chapter is III, not IV, so
// the 714.4 sacrifice fires one turn sooner.
//
// Chapter I is a real, forced (non-optional, non-targeted) mass bounce —
// "Return EACH creature that isn't a Kraken/Leviathan/Merfolk/Octopus/
// Serpent" — so, unlike Bahamut's own chapter I/II `destroy` (a real choice
// among legal candidates), there's no `preferTarget`/`declineOptional` to
// set here at all: the effect just runs over the real battlefield.
//
// Chapters II/III (Until end of turn, whenever a Kraken/Leviathan/Merfolk/
// Octopus/Serpent attacks, draw a card) GRANT a whole new, temporary
// triggered ability to whichever creature later attacks — the same
// "no vocabulary anywhere in this model grants a fresh triggered ability to
// another permanent" gap class white-mage-s-staff's own migration
// documents (card.ts's `Effect`/`Actions` surface has no such primitive);
// both chapters correctly no-op in this engine (`definition.ts`'s own
// comment), so this scenario cannot itself demonstrate a real draw off
// either chapter — only the real Saga bookkeeping (lore counters ticking,
// chapter triggers firing on cue, the eventual 714.4 sacrifice) is real,
// checkable evidence here.

import { summonLeviathan } from './definition';
import { basicLandsFor } from '../../mana';
import type { TraceResult } from '../../harness';
import { setupEnginePilot, pilotActions, pilotCast, pilotResolveTop, advanceToPlayersNextMain1, finishEnginePilotTrace, type EnginePilotSetup } from '../../engine-trace';

function scenarioA(): TraceResult {
  const setup: EnginePilotSetup = {
    you: { libraryCount: 15, basicLands: basicLandsFor('{4}{U}{U}') },
    opponents: [{ libraryCount: 10 }],
  };
  const pilot = setupEnginePilot(setup);

  // Sahagin (data/fin/fin_scryfall.json #71: {1}{U} Creature — Merfolk
  // Warrior, 1/3) — a real, on-color Merfolk under YOUR OWN control,
  // demonstrating the exclusion actually works: chapter I's mass bounce
  // spares it while sweeping every non-tribal creature away.
  const merfolk = pilot.state.addCard(pilot.you, 'Battlefield', { name: 'Sahagin', types: ['Creature'], subtypes: ['Merfolk', 'Warrior'], basePower: 1, baseToughness: 3, cmc: 2 });
  pilot.log.push({ fn: 'enters', card: merfolk.name, zone: 'Battlefield', power: merfolk.basePower, toughness: merfolk.baseToughness, controller: pilot.you.name });

  // Ahriman (data/fin/fin_scryfall.json: {2}{B} Creature — Eye Horror, 2/2)
  // under YOUR OWN control — real, non-tribal, non-token — same filler
  // creature summon-bahamut's own scenario already uses, reused here as a
  // real "gets bounced" demonstration on YOUR side of the board.
  const yourNonTribal = pilot.state.addCard(pilot.you, 'Battlefield', { name: 'Ahriman', types: ['Creature'], subtypes: ['Eye', 'Horror'], basePower: 2, baseToughness: 2, cmc: 3 });
  pilot.log.push({ fn: 'enters', card: yourNonTribal.name, zone: 'Battlefield', power: yourNonTribal.basePower, toughness: yourNonTribal.baseToughness, controller: pilot.you.name });

  // Coeurl (data/fin/fin_scryfall.json: {1}{W} Creature — Cat Beast, 2/2)
  // under the OPPONENT's control — real, non-tribal, non-token — same
  // "gets bounced" demonstration, on the OPPONENT's side, proving the
  // mass bounce is genuinely symmetric (both players' non-tribal creatures
  // return, per the real unrestricted `ChangeZoneAll` — no owner
  // restriction in the real Forge script).
  const oppNonTribal = pilot.state.addCard(pilot.opponents[0]!, 'Battlefield', { name: 'Coeurl', types: ['Creature'], subtypes: ['Cat', 'Beast'], basePower: 2, baseToughness: 2, cmc: 2 });
  pilot.log.push({ fn: 'enters', card: oppNonTribal.name, zone: 'Battlefield', power: oppNonTribal.basePower, toughness: oppNonTribal.baseToughness, controller: pilot.opponents[0]!.name });

  const leviathanReal = pilot.state.addCard(pilot.you, 'Hand', {
    name: summonLeviathan.name,
    types: ['Creature', 'Enchantment'],
    subtypes: ['Saga', 'Leviathan'],
    basePower: summonLeviathan.pt?.[0],
    baseToughness: summonLeviathan.pt?.[1],
    keywords: summonLeviathan.keywords,
  });
  const actions = pilotActions(pilot, leviathanReal.id);
  const ctx = pilot.ctxFor(leviathanReal);

  // Cast Summon: Leviathan ({4}{U}{U}), real mana payment
  pilotCast(pilot, leviathanReal, summonLeviathan, ctx, actions);
  // Resolves; real 714.2b/c fires chapter I immediately — a forced,
  // unconditional mass bounce (no target choice at all): Ahriman and
  // Coeurl return to their owners' hands; Sahagin (a real Merfolk) stays.
  pilotResolveTop(pilot);

  // Real turn passage — chapter II fires on your next draw step (a
  // temporary grant, correctly a real engine no-op — see this file's own
  // header)
  advanceToPlayersNextMain1(pilot, pilot.you, leviathanReal);

  // Another real turn — chapter III fires (same no-op grant); its lore
  // count (3) is this card's own greatest chapter number, so 714.4's real
  // sacrifice follows immediately (nothing reset its lore counters first)
  advanceToPlayersNextMain1(pilot, pilot.you, leviathanReal);
  if (leviathanReal.zone === 'Graveyard') {
    pilot.beginStep('714.4 sacrifice — lore counters were never reset');
    pilot.log.push({ fn: 'sacrifice', player: pilot.you.name, card: summonLeviathan.name });
  }

  const result =
    "Summon: Leviathan enters; chapter I fires (714.2b) and returns every non-tribal creature to its owner's hand — Ahriman (yours) and Coeurl (the opponent's), both non-token permanents — while Sahagin (a Merfolk) stays put, proving the Kraken/Leviathan/Merfolk/Octopus/Serpent exclusion. Chapter II fires on your next draw step, chapter III the turn after (both grant a temporary 'whenever a [tribal type] attacks, draw a card' ability — a still-open engine gap, correctly inert here); chapter III is this card's own greatest chapter number, so Summon: Leviathan is sacrificed (714.4) right after.";
  return finishEnginePilotTrace(pilot, setup, 'engine playthrough: cast -> ETB Saga tick -> chapters over turns -> 714.4 sacrifice', result);
}

export function runEngineScenarios(): TraceResult[] {
  return [scenarioA()];
}
