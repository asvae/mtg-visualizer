// Real engine-piloted trace (see engine-trace.ts's own header). Chapter
// I/II's "destroy up to one target nonland permanent" has no owner
// restriction, so the real pool is BOTH players' nonland permanents.
// Chapter I genuinely prefers the opponent's real Coeurl (`preferTarget`) —
// a real, non-token FIN creature (data/fin/fin_scryfall.json, {1}{W}
// Creature — Cat Beast) — over Bahamut itself, then chapter II — Bahamut is
// the only nonland permanent left — genuinely declines rather than
// destroying itself (a real choice, not forced; declining is what lets the
// rest of the Saga's own chapters play out at all).
//
// (2026-09-10/2026-09-11: this card briefly had a second scenario B — a
// minimal, separate proof that "destroy" fires for real when forced to (no
// decline, no other target around, so Bahamut legally destroys itself) —
// reinstated once to back a new literal `destroy-act` event fact (CR 701.6,
// the ACT of destroying, as its own event distinct from the `dies`
// consequence): scenario A's own kill target at the time was a Treasure
// TOKEN, which harness.ts's own `destroy` handler logs as `ceasesToExist`
// instead of a literal `fn:'destroy'` line (111.7/704.5d — a token ceases
// to exist rather than ever really sitting in the graveyard), so it
// couldn't back a `destroy` event fact the way it backs `dies`. Once
// scenario A's own opponent target was switched to Coeurl — a real,
// non-token permanent — its own kill produces that literal `fn:'destroy'`
// line directly (confirmed via `verify-synergy.mjs`/the regenerated trace
// log), so scenario B went back to being redundant and was removed again,
// same evidence-check discipline as its original 2026-09-10 removal.)

import { summonBahamut } from './definition';
import { basicLandsFor } from '../../mana';
import type { TraceResult } from '../../harness';
import { setupEnginePilot, pilotActions, pilotCast, pilotResolveTop, advanceToPlayersNextMain1, finishEnginePilotTrace, type EnginePilotSetup } from '../../engine-trace';

function scenarioA(): TraceResult {
  const setup: EnginePilotSetup = {
    you: { libraryCount: 15, basicLands: basicLandsFor('{9}') },
    opponents: [{ libraryCount: 10 }],
  };
  const pilot = setupEnginePilot(setup);

  // A real, nonzero-mana-value permanent under your own control — without
  // one, chapter IV's real "total mana value of other permanents" sum would
  // be a true but unillustrative 0 (your 9 lands are all mana value 0).
  // Ahriman (data/fin/fin_scryfall.json: {2}{B} Creature — Eye Horror, 2/2,
  // mana value 3) — legendary-ness was never load-bearing here (chapter IV's
  // own "total mana value of other permanents you control" has no legendary
  // restriction), just a nonzero mana value under your control.
  const allyLegend = pilot.state.addCard(pilot.you, 'Battlefield', { name: 'Ahriman', types: ['Creature'], subtypes: ['Eye', 'Horror'], basePower: 2, baseToughness: 2, cmc: 3 });
  // A real `enters` entry — without one, it never shows up on the replay
  // board at all (it's never itself a log `target`/`card` later — chapter
  // IV's damage is computed off it, not targeted at it), even though it's
  // really there on the battlefield from the start.
  pilot.log.push({ fn: 'enters', card: allyLegend.name, zone: 'Battlefield', power: allyLegend.basePower, toughness: allyLegend.baseToughness, controller: pilot.you.name });

  // A real, non-token nonland permanent under the OPPONENT's control for
  // chapter I to destroy — Coeurl (data/fin/fin_scryfall.json: {1}{W}
  // Creature — Cat Beast, 2/2). Added directly via `addCard` (not
  // `PlayerState.tokens` — Coeurl isn't a token) so it needs its own
  // `enters` entry below, same reasoning as `allyLegend` above.
  const oppCreature = pilot.state.addCard(pilot.opponents[0]!, 'Battlefield', { name: 'Coeurl', types: ['Creature'], subtypes: ['Cat', 'Beast'], basePower: 2, baseToughness: 2, cmc: 2 });
  pilot.log.push({ fn: 'enters', card: oppCreature.name, zone: 'Battlefield', power: oppCreature.basePower, toughness: oppCreature.baseToughness, controller: pilot.opponents[0]!.name });

  const bahamutReal = pilot.state.addCard(pilot.you, 'Hand', {
    name: summonBahamut.name,
    types: ['Creature', 'Enchantment'],
    subtypes: ['Saga', 'Dragon'],
    keywords: summonBahamut.keywords,
  });
  const actions = pilotActions(pilot, bahamutReal.id);
  // Chapter I genuinely prefers the opponent's Coeurl over Bahamut itself —
  // the real pool (card.ts's own unrestricted `destroy` case) is BOTH
  // players' nonland permanents, so without this it'd pick Bahamut (first
  // in an unrestricted pool) and blow itself up before chapter III/IV ever
  // get to run.
  const ctx = pilot.ctxFor(bahamutReal, { preferTarget: (c) => c.getName() === 'Coeurl' });

  // Cast Bahamut ({9}), real mana payment
  pilotCast(pilot, bahamutReal, summonBahamut, ctx, actions);
  // Resolves; real 714.2b/c fires chapter I immediately — destroys the
  // opponent's real Coeurl (a real, non-token permanent, so this logs a
  // literal harness.ts `fn:'destroy'` line, CR 701.6)
  pilotResolveTop(pilot);

  // Chapter II: Coeurl's gone now, so Bahamut itself is the only legal
  // nonland target left — decline (a real choice, not forced) rather than
  // destroying itself, same reasoning `preferTarget` avoided above.
  ctx.declineOptional = true;

  // Real turn passage — chapter II fires on your next draw step, declines
  advanceToPlayersNextMain1(pilot, pilot.you, bahamutReal);

  // Another real turn — chapter III fires: draw two cards
  advanceToPlayersNextMain1(pilot, pilot.you, bahamutReal);

  // Another real turn — chapter IV fires: real damage to the opponent (Mega
  // Flare) equal to the real total mana value of Ahriman (lands are 0),
  // then 714.4's real sacrifice (nothing reset lore counters first)
  advanceToPlayersNextMain1(pilot, pilot.you, bahamutReal);
  if (bahamutReal.zone === 'Graveyard') {
    pilot.beginStep('Real 714.4 sacrifice — lore counters were never reset');
    pilot.log.push({ fn: 'sacrifice', player: pilot.you.name, card: summonBahamut.name });
  }

  const result =
    "Bahamut enters, chapter I fires (714.2b) and destroys the opponent's Coeurl (a choice between it and Bahamut itself — a non-token permanent, so it's a 701.6 destroy, not a token ceasing to exist); chapter II fires again next turn but only Bahamut itself remains as a legal target, so it declines rather than destroying itself; chapter III draws two cards; chapter IV deals damage equal to the total mana value of the other permanent you control (Ahriman, mana value 3 — your lands are all 0), then Bahamut is sacrificed (714.4) since nothing reset its lore counters first.";
  return finishEnginePilotTrace(pilot, setup, 'real engine playthrough: cast -> ETB Saga tick -> chapters over real turns -> 714.4 sacrifice', result);
}

export function runEngineScenarios(): TraceResult[] {
  return [scenarioA()];
}
