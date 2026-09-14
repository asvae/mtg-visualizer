// PROTOTYPE test (2026-09-13) for Recognizer C (`token-creation-from-forge-
// script.prototype.ts`) — see that file's own module doc comment for the
// full design rationale. Verified against 6 REAL FIN cards' own Forge
// scripts (`tmp/mtg-forge/forge-gui/res/cardsfolder/...`) and real oracle
// text (`data/fin/fin_scryfall.json`, via the same `load-fin-cards.mjs`
// loader the other two recognizers' own tests already use).
//
// The Forge script / token-script text below is a VERBATIM copy of the real
// files as they exist in this project's own `tmp/mtg-forge` checkout as of
// 2026-09-13 (git-ignored, not itself importable from a portable test — see
// this project's own `.claude/ORCHESTRATOR_PRIMER.md` for that checkout's
// real location/history) — embedded here as literal fixture strings rather
// than read live off disk, same "cite the real file, don't re-derive it"
// discipline `interfaces.ts`'s own Forge citations already follow, just
// copy-pasted instead of line-cited since this is throwaway prototype
// fixture data, not a permanent mirror of Forge's own source.
import { describe, expect, it } from 'vitest';
import { loadFinCards } from './load-fin-cards.mjs';
import { findCreateClause, recognizeTokenCreationFromForgeScript } from './token-creation-from-forge-script.prototype';
import { TOKENS } from '../tokens.ts';

const finCards = loadFinCards();

function oracleTextOf(cardName: string): string {
  const card = finCards.get(cardName);
  if (!card) throw new Error(`fixture setup bug: "${cardName}" not found in data/fin/fin_scryfall.json`);
  return card.front.oracleText;
}

const KNOWN_TOKEN_IDS = new Set(Object.keys(TOKENS));
const isKnownTokenId = (id: string) => KNOWN_TOKEN_IDS.has(id);

// --- Real Forge card scripts (verbatim, see this file's own header) --------

const MOOGLES_VALOR_SCRIPT = `Name:Moogles' Valor
ManaCost:3 W W
Types:Instant
A:SP$ Token | TokenAmount$ X | TokenScript$ w_1_2_moogle_lifelink | TokenOwner$ You | SubAbility$ DBPumpAll | SpellDescription$ For each creature you control, create a 1/2 white Moogle creature token with lifelink. Then creatures you control gain indestructible until end of turn.
SVar:DBPumpAll:DB$ PumpAll | ValidCards$ Creature.YouCtrl | KW$ Indestructible
SVar:X:Count$Valid Creature.YouCtrl
Oracle:For each creature you control, create a 1/2 white Moogle creature token with lifelink. Then creatures you control gain indestructible until end of turn.`;

const BATTLE_MENU_SCRIPT = `Name:Battle Menu
ManaCost:1 W
Types:Instant
A:SP$ Charm | Choices$ DBAttack,DBAbility,DBMagic,DBItem | Defined$ You
SVar:DBAttack:DB$ Token | TokenScript$ w_2_2_knight | SpellDescription$ Attack — Create a 2/2 white Knight creature token.
SVar:DBAbility:DB$ Pump | ValidTgts$ Creature | NumDef$ +4 | SpellDescription$ Ability — Target creature gets +0/+4 until end of turn.
SVar:DBMagic:DB$ Destroy | ValidTgts$ Creature.powerGE4 | TgtPrompt$ Select target creature with power 4 or greater | SpellDescription$ Magic — Destroy target creature with power 4 or greater.
SVar:DBItem:DB$ GainLife | LifeAmount$ 4 | SpellDescription$ Item — You gain 4 life.
DeckHas:Ability$Token
Oracle:Choose one —\\n• Attack — Create a 2/2 white Knight creature token.\\n• Ability — Target creature gets +0/+4 until end of turn.\\n• Magic — Destroy target creature with power 4 or greater.\\n• Item — You gain 4 life.`;

const AERITH_RESCUE_MISSION_SCRIPT = `Name:Aerith Rescue Mission
ManaCost:3 W
Types:Sorcery
A:SP$ Charm | Choices$ DBTokens,DBTap
SVar:DBTokens:DB$ Token | TokenScript$ c_1_1_hero | TokenOwner$ You | TokenAmount$ 3 | SpellDescription$ Take the Elevator — Create three 1/1 colorless Hero creature tokens.
SVar:DBTap:DB$ Tap | ValidTgts$ Creature | TargetMin$ 0 | TargetMax$ 3 | TgtPrompt$ Select up to three target creatures | SubAbility$ DBPutCounter | SpellDescription$ Take 59 Flights of Stairs — Tap up to three target creatures. Put a stun counter on one of them.
SVar:DBPutCounter:DB$ PutCounter | Choices$ Creature.targetedBy | CounterType$ Stun | CounterNum$ 1
Oracle:Choose one —\\n• Take the Elevator — Create three 1/1 colorless Hero creature tokens.\\n• Take 59 Flights of Stairs — Tap up to three target creatures. Put a stun counter on one of them. (If a permanent with a stun counter would become untapped, remove one from it instead.)`;

const RETRIEVE_THE_ESPER_SCRIPT = `Name:Retrieve the Esper
ManaCost:3 U
Types:Sorcery
A:SP$ Token | TokenScript$ u_3_3_a_robot_warrior | TokenOwner$ You | RememberTokens$ True | SubAbility$ DBPutCounter | SpellDescription$ Create a 3/3 blue Robot Warrior artifact creature token. Then if this spell was cast from a graveyard, put two +1/+1 counters on that token.
SVar:DBPutCounter:DB$ PutCounter | Defined$ Remembered | CounterType$ P1P1 | CounterNum$ 2 | ConditionDefined$ Self | ConditionPresent$ Card.wasCastFromGraveyard | ConditionCompare$ EQ1 | SubAbility$ DBCleanup
SVar:DBCleanup:DB$ Cleanup | ClearRemembered$ True
K:Flashback:5 U
Oracle:Create a 3/3 blue Robot Warrior artifact creature token. Then if this spell was cast from a graveyard, put two +1/+1 counters on that token.\\nFlashback {5}{U} (You may cast this card from your graveyard for its flashback cost. Then exile it.)`;

const DWARVEN_CASTLE_GUARD_SCRIPT = `Name:Dwarven Castle Guard
ManaCost:1 W
Types:Creature Dwarf Soldier
PT:2/1
T:Mode$ ChangesZone | Origin$ Battlefield | Destination$ Graveyard | ValidCard$ Card.Self | Execute$ TrigToken | TriggerDescription$ When this creature dies, create a 1/1 colorless Hero creature token.
SVar:TrigToken:DB$ Token | TokenScript$ c_1_1_hero | TokenOwner$ You
SVar:SacMe:2
DeckHas:Ability$Token
Oracle:When this creature dies, create a 1/1 colorless Hero creature token.`;

const ANCIENT_ADAMANTOISE_SCRIPT = `Name:Ancient Adamantoise
ManaCost:5 G G G
Types:Creature Turtle
PT:8/20
K:Vigilance
K:Ward:3
S:Mode$ NoCleanupDamage | ValidCard$ Card.Self | Description$ Damage isn't removed from this creature during cleanup steps.
R:Event$ DamageDone | ActiveZones$ Battlefield | ValidTarget$ You,Permanent.Other+YouCtrl | DamageTarget$ Self | ReplaceWith$ DmgMe | Description$ All damage that would be dealt to you and other permanents you control is dealt to this creature instead.
SVar:DmgMe:DB$ ReplaceEffect | VarName$ Affected | VarValue$ Self | VarType$ Card
T:Mode$ ChangesZone | Origin$ Battlefield | Destination$ Graveyard | ValidCard$ Card.Self | Execute$ TrigExile | TriggerDescription$ When this creature dies, exile it and create ten tapped Treasure tokens.
SVar:TrigExile:DB$ ChangeZone | Defined$ TriggeredNewCardLKICopy | Origin$ Graveyard | Destination$ Exile | SubAbility$ DBToken
SVar:DBToken:DB$ Token | TokenScript$ c_a_treasure_sac | TokenAmount$ 10 | TokenTapped$ True
Oracle:Vigilance, ward {3}\\nDamage isn't removed from this creature during cleanup steps.\\nAll damage that would be dealt to you and other permanents you control is dealt to this creature instead.\\nWhen this creature dies, exile it and create ten tapped Treasure tokens.`;

const CIRCLE_OF_POWER_SCRIPT = `Name:Circle of Power
ManaCost:3 B
Types:Sorcery
A:SP$ Draw | NumCards$ 2 | SubAbility$ DBLoseLife | SpellDescription$ You draw two cards and you lose 2 life. Create a 0/1 black Wizard creature token with "Whenever you cast a noncreature spell, this token deals 1 damage to each opponent." Wizards you control get +1/+0 and gain lifelink until end of turn.
SVar:DBLoseLife:DB$ LoseLife | LifeAmount$ 2 | SubAbility$ DBToken
SVar:DBToken:DB$ Token | TokenScript$ b_0_1_wizard_snipe | TokenOwner$ You | SubAbility$ DBPumpAll
SVar:DBPumpAll:DB$ PumpAll | ValidCards$ Wizard.YouCtrl | NumAtt$ +1 | KW$ Lifelink
Oracle:You draw two cards and you lose 2 life. Create a 0/1 black Wizard creature token with "Whenever you cast a noncreature spell, this token deals 1 damage to each opponent."\\nWizards you control get +1/+0 and gain lifelink until end of turn.`;

// --- Real Forge token-script files (verbatim) -------------------------------

const TOKEN_SCRIPTS: Record<string, string> = {
  w_1_2_moogle_lifelink: `Name:Moogle Token
ManaCost:no cost
Colors:white
Types:Creature Moogle
PT:1/2
K:Lifelink
Oracle:Lifelink`,
  w_2_2_knight: `Name:Knight Token
ManaCost:no cost
Colors:white
Types:Creature Knight
PT:2/2
Oracle:`,
  c_1_1_hero: `Name:Hero Token
ManaCost:no cost
Types:Creature Hero
PT:1/1
Oracle:`,
  u_3_3_a_robot_warrior: `Name:Robot Warrior Token
ManaCost:no cost
Colors:blue
Types:Artifact Creature Robot Warrior
PT:3/3
Oracle:`,
  c_a_treasure_sac: `Name:Treasure Token
ManaCost:no cost
Types:Artifact Treasure
A:AB$ Mana | Cost$ T Sac<1/CARDNAME/this token> | Produced$ Any | Amount$ 1 | SpellDescription$ Add one mana of any color.
Oracle:{T}, Sacrifice this token: Add one mana of any color.`,
  b_0_1_wizard_snipe: `Name:Wizard Token
ManaCost:no cost
Colors:black
Types:Creature Wizard
PT:0/1
T:Mode$ SpellCast | ValidCard$ Card.nonCreature | ValidActivatingPlayer$ You | TriggerZones$ Battlefield | Execute$ TrigDamage | TriggerDescription$ Whenever you cast a noncreature spell, this token deals 1 damage to each opponent.
SVar:TrigDamage:DB$ DealDamage | Defined$ Player.Opponent | NumDmg$ 1
Oracle:Whenever you cast a noncreature spell, this token deals 1 damage to each opponent.`,
};

function resolveTokenScript(id: string): string | undefined {
  return TOKEN_SCRIPTS[id];
}

describe('Recognizer C (prototype) — token creation from Forge script', () => {
  it("Moogles' Valor — the motivating case: extracts the token fact AND a real annotation anchor", () => {
    const oracleText = oracleTextOf("Moogles' Valor");
    const result = recognizeTokenCreationFromForgeScript({
      name: "Moogles' Valor",
      oracleText,
      cardScript: MOOGLES_VALOR_SCRIPT,
      resolveTokenScript,
      isKnownTokenId,
    });
    expect(result.matched, `expected a match, got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    expect(result.facts).toEqual([
      {
        role: 'source',
        fact: {
          event: 'entersBattlefield',
          to: 'Battlefield',
          controller: 'you',
          subject: { token: 'w_1_2_moogle_lifelink' },
          annotations: [{ target: 'oracle', line: 0, start: 31, end: 85 }],
        },
        provenance: { origin: 'parser', rule: 'token-creation-from-forge-script' },
      },
    ]);
    // Matches the real, existing hand-authored annotation in
    // `cards/moogles-valor/synergy.json` EXACTLY (start:31, end:85) — this
    // recognizer's independently-derived span lines up with the span a human
    // agent chose by hand, not just "some" plausible span.
    const { start, end } = (result.facts[0]!.fact.annotations as { start: number; end: number }[])[0]!;
    expect(oracleText.slice(start, end)).toBe('create a 1/2 white Moogle creature token with lifelink');
  });

  it('Aerith Rescue Mission — modal bullet-point phrasing, still resolves', () => {
    const oracleText = oracleTextOf('Aerith Rescue Mission');
    const result = recognizeTokenCreationFromForgeScript({
      name: 'Aerith Rescue Mission',
      oracleText,
      cardScript: AERITH_RESCUE_MISSION_SCRIPT,
      resolveTokenScript,
      isKnownTokenId,
    });
    expect(result.matched, `expected a match, got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    const ann = result.facts[0]!.fact.annotations![0] as { target: string; line: number; start: number; end: number };
    expect(ann.target).toBe('oracle');
    expect(ann.line).toBe(1); // the "Take the Elevator —" bullet line
    expect(oracleText.split('\n')[ann.line]!.slice(ann.start, ann.end)).toBe('Create three 1/1 colorless Hero creature tokens');
  });

  it('Battle Menu — modal bullet-point phrasing, still resolves', () => {
    const oracleText = oracleTextOf('Battle Menu');
    const result = recognizeTokenCreationFromForgeScript({
      name: 'Battle Menu',
      oracleText,
      cardScript: BATTLE_MENU_SCRIPT,
      resolveTokenScript,
      isKnownTokenId,
    });
    expect(result.matched, `expected a match, got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    const ann = result.facts[0]!.fact.annotations![0] as { target: string; line: number; start: number; end: number };
    expect(oracleText.split('\n')[ann.line]!.slice(ann.start, ann.end)).toBe('Create a 2/2 white Knight creature token');
  });

  it('Dwarven Castle Guard — token made by a death trigger, not on cast, still resolves', () => {
    const oracleText = oracleTextOf('Dwarven Castle Guard');
    const result = recognizeTokenCreationFromForgeScript({
      name: 'Dwarven Castle Guard',
      oracleText,
      cardScript: DWARVEN_CASTLE_GUARD_SCRIPT,
      resolveTokenScript,
      isKnownTokenId,
    });
    expect(result.matched, `expected a match, got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    const ann = result.facts[0]!.fact.annotations![0] as { target: string; line: number; start: number; end: number };
    expect(oracleText.split('\n')[ann.line]!.slice(ann.start, ann.end)).toBe('create a 1/1 colorless Hero creature token');
  });

  it('Circle of Power — MESSY case, genuinely declined: TokenScript$ "b_0_1_wizard_snipe" is not in tokens.ts AT ALL (this app\'s own real definition.ts builds this exact token inline instead, unresolvable via the shared catalog) — a real catalog-completeness gap, distinct from Retrieve the Esper\'s naming-drift decline', () => {
    const result = recognizeTokenCreationFromForgeScript({
      name: 'Circle of Power',
      oracleText: oracleTextOf('Circle of Power'),
      cardScript: CIRCLE_OF_POWER_SCRIPT,
      resolveTokenScript,
      isKnownTokenId,
    });
    expect(result.matched).toBe(false);
    if (result.matched) return;
    expect(result.reason).toContain('b_0_1_wizard_snipe');
  });

  it('Circle of Power\'s own oracle text, probed directly: the quote-aware clause-bounding logic alone (independent of the catalog gap above) correctly spans the WHOLE quoted self-granted ability without being cut short by its own internal period, and without bleeding into the next, unrelated sentence', () => {
    const oracleText = oracleTextOf('Circle of Power');
    const span = findCreateClause(oracleText, ['Wizard'], 'black', [0, 1]);
    expect(span).toBeDefined();
    expect(oracleText.slice(span!.start, span!.end)).toBe(
      'Create a 0/1 black Wizard creature token with "Whenever you cast a noncreature spell, this token deals 1 damage to each opponent."',
    );
  });

  it('Ancient Adamantoise — MESSY case: mid-sentence clause after "and", a common/iconic token type (Treasure) whose oracle wording omits "artifact" entirely, and a real Forge/catalog quantity mismatch (script says 10, real synergy.json ends up 5) that this recognizer correctly ignores by never trusting a literal count', () => {
    const oracleText = oracleTextOf('Ancient Adamantoise');
    const result = recognizeTokenCreationFromForgeScript({
      name: 'Ancient Adamantoise',
      oracleText,
      cardScript: ANCIENT_ADAMANTOISE_SCRIPT,
      resolveTokenScript,
      isKnownTokenId,
    });
    expect(result.matched, `expected a match, got: ${!result.matched && result.reason}`).toBe(true);
    if (!result.matched) return;
    // `Fact.value` (formerly asserted here as `-1`, "never the Forge-literal
    // 10") was removed from the schema entirely, 2026-09-14 — nothing left
    // to assert about a literal-count/magnitude field that no longer exists.
    const ann = result.facts[0]!.fact.annotations![0] as { target: string; line: number; start: number; end: number };
    const claimed = oracleText.split('\n')[ann.line]!.slice(ann.start, ann.end);
    // Clause starts at the word "create" itself (same convention every other
    // case here follows), NOT at the start of the enclosing sentence — "When
    // this creature dies, exile it and" is real text but outside this fact's
    // own claimed span, same as every other recognizer in this pool only
    // ever claiming the token-creation clause itself.
    expect(claimed).toBe('create ten tapped Treasure tokens');
  });

  it('Retrieve the Esper — MESSY case, genuinely declined: Forge\'s own TokenScript$ id ("u_3_3_a_robot_warrior") does not exactly match this app\'s real tokens.ts catalog key ("u_3_3_robot_warrior") — a real naming drift, not fabricated here', () => {
    const oracleText = oracleTextOf('Retrieve the Esper');
    const result = recognizeTokenCreationFromForgeScript({
      name: 'Retrieve the Esper',
      oracleText,
      cardScript: RETRIEVE_THE_ESPER_SCRIPT,
      resolveTokenScript,
      isKnownTokenId,
    });
    expect(result.matched).toBe(false);
    if (result.matched) return;
    expect(result.reason).toContain('u_3_3_a_robot_warrior');
    expect(result.reason).toContain('naming drift');
  });

  it('a card with no Forge "DB$ Token"/"SP$ Token" ability declines cleanly', () => {
    const result = recognizeTokenCreationFromForgeScript({
      name: 'Ahriman',
      oracleText: oracleTextOf('Ahriman'),
      cardScript: 'Name:Ahriman\nManaCost:3 U\nTypes:Creature Demon\nPT:3/4\nOracle:Flying',
      resolveTokenScript,
      isKnownTokenId,
    });
    expect(result.matched).toBe(false);
  });
});
