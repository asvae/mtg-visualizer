import { describe, expect, it } from 'vitest';
import { GameState, effectiveTypes, effectivePT, effectiveKeywords, effectiveSubtypes, wrapCard } from './state';

describe('GameState.move', () => {
  it('genuinely splices a card out of one zone and into another (same object, never copied)', () => {
    const state = new GameState();
    const you = state.addPlayer('you');
    const card = state.addCard(you, 'Hand', { name: 'test-card' });
    expect(you.hand).toContain(card);
    state.move(card, 'Graveyard');
    expect(you.hand).not.toContain(card);
    expect(you.graveyard).toContain(card);
    expect(card.zone).toBe('Graveyard');
  });

  it('a token leaving the battlefield ceases to exist entirely (SCHEMA.md §3), never becomes graveyard stock', () => {
    const state = new GameState();
    const you = state.addPlayer('you');
    const token = state.addCard(you, 'Battlefield', { name: 'Treasure', isTokenCard: true });
    state.move(token, 'Graveyard');
    expect(you.battlefield).not.toContain(token);
    expect(you.graveyard).not.toContain(token);
    expect(state.cards.has(token.id)).toBe(false);
  });

  it('a real (non-token) card leaving the battlefield does become graveyard stock', () => {
    const state = new GameState();
    const you = state.addPlayer('you');
    const real = state.addCard(you, 'Battlefield', { name: 'real-permanent', isTokenCard: false });
    state.move(real, 'Graveyard');
    expect(you.graveyard).toContain(real);
    expect(state.cards.has(real.id)).toBe(true);
  });

  it('rule 400.7: counters, layer effects, control, and tapped status reset when a permanent changes zones', () => {
    const state = new GameState();
    const you = state.addPlayer('you');
    const opp = state.addPlayer('opp');
    const card = state.addCard(you, 'Battlefield', { name: 'permanent' });
    state.putCounter(card, '+1/+1', 2);
    state.pump(card, 3, 3);
    state.tap(card);
    state.gainControl(opp, card);
    expect(effectivePT(state, card)).toEqual([1 + 2 + 3, 1 + 2 + 3]);
    expect(card.tapped).toBe(true);
    expect(card.controllerId).toBe(opp.id);

    state.move(card, 'Exile');
    state.move(card, 'Battlefield');

    expect(effectivePT(state, card)).toEqual([1, 1]);
    expect(card.tapped).toBe(false);
    expect(card.controllerId).toBe(card.ownerId);
  });

  it('staying in the same zone (a no-op move) does not reset state', () => {
    const state = new GameState();
    const you = state.addPlayer('you');
    const card = state.addCard(you, 'Battlefield', { name: 'permanent' });
    state.putCounter(card, '+1/+1', 1);
    state.move(card, 'Battlefield');
    expect(card.counters['+1/+1']).toBe(1);
  });
});

describe('GameState.grantKeyword / clearUntilEndOfTurnKeywordGrants', () => {
  it('a plain grantKeyword (no opts) is permanent — clearUntilEndOfTurnKeywordGrants leaves it alone', () => {
    const state = new GameState();
    const you = state.addPlayer('you');
    const card = state.addCard(you, 'Battlefield', { name: 'permanent' });
    state.grantKeyword(card, 'Flying');
    state.clearUntilEndOfTurnKeywordGrants();
    expect(card.keywords).toContain('Flying');
  });

  it('untilEndOfTurn: true registers the grant for real removal at the next Cleanup (real 514.2)', () => {
    // Regression: Dion, Bahamut's Dominant (fin/16) — Bahamut's own "Wings
    // of Light... gain flying until end of turn" had been wired to a bare
    // `grantKeyword` (this pool's own long-standing "permanent within a
    // scenario" default for every OTHER keyword grant), so it never
    // expired — visibly wrong once a real multi-turn engine-piloted
    // scenario kept stepping through several MORE turns after it fired.
    const state = new GameState();
    const you = state.addPlayer('you');
    const card = state.addCard(you, 'Battlefield', { name: 'permanent' });
    state.grantKeyword(card, 'Flying', { untilEndOfTurn: true });
    expect(card.keywords).toContain('Flying');
    state.clearUntilEndOfTurnKeywordGrants();
    expect(card.keywords).not.toContain('Flying');
  });

  it('clearUntilEndOfTurnKeywordGrants is game-wide (real 514.2 — not just the active player\'s own permanents)', () => {
    const state = new GameState();
    const you = state.addPlayer('you');
    const opp = state.addPlayer('opp');
    const mine = state.addCard(you, 'Battlefield', { name: 'mine' });
    const theirs = state.addCard(opp, 'Battlefield', { name: 'theirs' });
    state.grantKeyword(mine, 'Flying', { untilEndOfTurn: true });
    state.grantKeyword(theirs, 'Menace', { untilEndOfTurn: true });
    state.clearUntilEndOfTurnKeywordGrants();
    expect(mine.keywords).not.toContain('Flying');
    expect(theirs.keywords).not.toContain('Menace');
  });

  it('drains its own pending list — a second clear with nothing new granted is a real no-op', () => {
    const state = new GameState();
    const you = state.addPlayer('you');
    const card = state.addCard(you, 'Battlefield', { name: 'permanent' });
    state.grantKeyword(card, 'Flying', { untilEndOfTurn: true });
    state.clearUntilEndOfTurnKeywordGrants();
    state.grantKeyword(card, 'Vigilance'); // unrelated, permanent
    state.clearUntilEndOfTurnKeywordGrants();
    expect(card.keywords).toEqual(['Vigilance']);
  });
});

describe('GameState.tap / untap', () => {
  it('tap and untap really persist on the object', () => {
    const state = new GameState();
    const you = state.addPlayer('you');
    const card = state.addCard(you, 'Battlefield', { name: 'creature' });
    expect(card.tapped).toBe(false);
    state.tap(card);
    expect(card.tapped).toBe(true);
    state.untap(card);
    expect(card.tapped).toBe(false);
  });

  it('CR 122.1d: a stun counter is removed instead of untapping (lowercase key — Tonberry/Ice Flan)', () => {
    const state = new GameState();
    const you = state.addPlayer('you');
    const card = state.addCard(you, 'Battlefield', { name: 'stunned-creature' });
    state.tap(card);
    state.putCounter(card, 'stun', 1);
    state.untap(card);
    expect(card.tapped).toBe(true); // NOT untapped — the stun counter absorbed it
    expect(card.counters['stun']).toBe(0);
  });

  it('CR 122.1d: also checked under the uppercase key (Omega, Heartless Evolution)', () => {
    const state = new GameState();
    const you = state.addPlayer('you');
    const card = state.addCard(you, 'Battlefield', { name: 'stunned-creature' });
    state.tap(card);
    state.putCounter(card, 'Stun', 1);
    state.untap(card);
    expect(card.tapped).toBe(true);
    expect(card.counters['Stun']).toBe(0);
  });

  it('CR 122.1d: a SECOND stun counter absorbs a second untap attempt; the third genuinely untaps', () => {
    const state = new GameState();
    const you = state.addPlayer('you');
    const card = state.addCard(you, 'Battlefield', { name: 'stunned-creature' });
    state.tap(card);
    state.putCounter(card, 'stun', 2);
    state.untap(card);
    expect(card.tapped).toBe(true);
    expect(card.counters['stun']).toBe(1);
    state.untap(card);
    expect(card.tapped).toBe(true);
    expect(card.counters['stun']).toBe(0);
    state.untap(card);
    expect(card.tapped).toBe(false);
  });

  it('a card with no stun counter untaps normally (illegal-path: guard does not fire on an absent/zero counter)', () => {
    const state = new GameState();
    const you = state.addPlayer('you');
    const card = state.addCard(you, 'Battlefield', { name: 'creature' });
    state.tap(card);
    state.putCounter(card, 'stun', 0);
    state.untap(card);
    expect(card.tapped).toBe(false);
  });
});

describe('GameState.move — FINALITY counter (real replacement: dying exiles instead, CR-equivalent to Card.java ~7067-7076)', () => {
  it('Relentless X-ATM092-shaped case: a permanent with a finality counter goes to Exile, not Graveyard, when it would die', () => {
    const state = new GameState();
    const you = state.addPlayer('you');
    const card = state.addCard(you, 'Battlefield', { name: 'relentless-x-atm092' });
    state.putCounter(card, 'finality', 1);
    state.move(card, 'Graveyard');
    expect(card.zone).toBe('Exile');
    expect(you.exile).toContain(card);
    expect(you.graveyard).not.toContain(card);
  });

  it('a permanent with NO finality counter dies normally into the graveyard (illegal-path: guard does not fire unconditionally)', () => {
    const state = new GameState();
    const you = state.addPlayer('you');
    const card = state.addCard(you, 'Battlefield', { name: 'plain-permanent' });
    state.move(card, 'Graveyard');
    expect(card.zone).toBe('Graveyard');
    expect(you.graveyard).toContain(card);
  });

  it('a finality counter does not redirect a move to a zone OTHER than the graveyard (e.g. bounced to hand)', () => {
    const state = new GameState();
    const you = state.addPlayer('you');
    const card = state.addCard(you, 'Battlefield', { name: 'relentless-x-atm092' });
    state.putCounter(card, 'finality', 1);
    state.move(card, 'Hand');
    expect(card.zone).toBe('Hand');
    expect(you.hand).toContain(card);
  });
});

describe('GameState.createToken', () => {
  it('creates genuinely distinct objects, not shared references, for qty > 1', () => {
    const state = new GameState();
    const you = state.addPlayer('you');
    const made = state.createToken(you, { name: 'Fish', manaCost: '0', types: ['Creature'], basePower: 1, baseToughness: 1 }, 2);
    expect(made).toHaveLength(2);
    expect(made[0]!.id).not.toBe(made[1]!.id);
    state.move(made[0]!, 'Graveyard');
    // Moving (and destroying, since it's a token) one token must not affect the other.
    expect(state.cards.has(made[1]!.id)).toBe(true);
  });
});

describe('effectiveTypes / wrapCard.isCreature via animate (layer 4)', () => {
  it('animate makes a noncreature permanent a real creature for every subsequent read, without mutating its printed types', () => {
    const state = new GameState();
    const you = state.addPlayer('you');
    const vehicle = state.addCard(you, 'Battlefield', { name: 'Vehicle', types: ['Artifact'] });
    expect(effectiveTypes(vehicle)).toEqual(['Artifact']);
    state.animate(vehicle, ['Creature']);
    expect(effectiveTypes(vehicle)).toEqual(['Artifact', 'Creature']);
    // Printed types are untouched — only the layer computation changed.
    expect(vehicle.types).toEqual(['Artifact']);
    expect(wrapCard(state, vehicle).isCreature()).toBe(true);
  });
});

// ENGINE_GAPS.md gap #14 and its own follow-up (closed 2026-09-12) — the
// shared `qualifiesForContinuousGrant` recipient-resolution logic
// (`includeSelf`/`subtype`/`onlyDuringYourTurn`/`equippedBySelf`), exercised
// through all THREE of its real payload families: `effectiveKeywords`
// (Dion's Dragonfire Dive/Ardyn's Demons grant shape — no prior unit test
// existed for this despite ENGINE_GAPS.md's own "functionally verified"
// claim, added here for real), the new fixed-delta `effectivePT` (Dragoon's
// Lance/Paladin's Arms/Crystal Fragments/White Mage's Staff/Sage's Nouliths'
// own "Equipped creature gets +N/+N"), and the new `effectiveSubtypes`
// (Dragoon's Lance/Machinist's Arsenal/Paladin's Arms/White Mage's Staff/
// Sage's Nouliths/Astrologian's Planisphere's own "is a Knight/Cleric/
// Artificer/Wizard in addition to its other types").
describe('effectiveKeywords / effectivePT / effectiveSubtypes — continuous, query-time grants (613, ENGINE_GAPS.md gap #14)', () => {
  it('effectiveKeywords: a subtype-matched, unconditional grant (Ardyn-shaped) applies to every OTHER matching permanent, not the granter itself', () => {
    const state = new GameState();
    const you = state.addPlayer('you');
    const granter = state.addCard(you, 'Battlefield', {
      name: 'granter',
      continuousKeywordGrants: [{ keywords: ['Menace', 'Haste'], includeSelf: false, subtype: 'Demon' }],
    });
    const demon = state.addCard(you, 'Battlefield', { name: 'demon', subtypes: ['Demon'] });
    const nonDemon = state.addCard(you, 'Battlefield', { name: 'non-demon', subtypes: ['Human'] });
    expect(effectiveKeywords(state, demon)).toEqual(expect.arrayContaining(['Menace', 'Haste']));
    expect(effectiveKeywords(state, nonDemon)).toEqual([]);
    expect(effectiveKeywords(state, granter)).toEqual([]); // includeSelf: false, and granter isn't itself a Demon
  });

  it('effectiveKeywords: onlyDuringYourTurn genuinely turns the grant on/off as the active player changes', () => {
    const state = new GameState();
    const you = state.addPlayer('you');
    const opp = state.addPlayer('opp');
    const knight = state.addCard(you, 'Battlefield', {
      name: 'granter-knight',
      subtypes: ['Knight'],
      continuousKeywordGrants: [{ keywords: ['Flying'], includeSelf: true, subtype: 'Knight', onlyDuringYourTurn: true }],
    });
    state.activePlayerId = you.id;
    expect(effectiveKeywords(state, knight)).toContain('Flying');
    state.activePlayerId = opp.id;
    expect(effectiveKeywords(state, knight)).not.toContain('Flying');
  });

  it('effectivePT: a fixed-delta equippedBySelf grant (Dragoon\'s Lance/Paladin\'s Arms-shaped) genuinely follows live re-equip', () => {
    const state = new GameState();
    const you = state.addPlayer('you');
    const equipment = state.addCard(you, 'Battlefield', {
      name: 'equipment',
      continuousPTGrants: [{ power: 2, toughness: 1, includeSelf: false, equippedBySelf: true }],
    });
    const creatureA = state.addCard(you, 'Battlefield', { name: 'creature-a', basePower: 2, baseToughness: 2 });
    const creatureB = state.addCard(you, 'Battlefield', { name: 'creature-b', basePower: 1, baseToughness: 1 });
    // Unequipped — no bonus on either creature.
    expect(effectivePT(state, creatureA)).toEqual([2, 2]);
    expect(effectivePT(state, creatureB)).toEqual([1, 1]);
    state.equip(equipment, creatureA);
    expect(effectivePT(state, creatureA)).toEqual([2 + 2, 2 + 1]);
    expect(effectivePT(state, creatureB)).toEqual([1, 1]);
    // Re-equip to the OTHER creature — the bonus genuinely moves, live.
    state.equip(equipment, creatureB);
    expect(effectivePT(state, creatureA)).toEqual([2, 2]);
    expect(effectivePT(state, creatureB)).toEqual([1 + 2, 1 + 1]);
  });

  it('effectivePT: onlyDuringYourTurn applies to a P/T grant exactly as it does to a keyword grant', () => {
    const state = new GameState();
    const you = state.addPlayer('you');
    const opp = state.addPlayer('opp');
    const equipment = state.addCard(you, 'Battlefield', {
      name: 'turn-conditional-equipment',
      continuousPTGrants: [{ power: 1, toughness: 0, includeSelf: false, equippedBySelf: true, onlyDuringYourTurn: true }],
    });
    const creature = state.addCard(you, 'Battlefield', { name: 'creature', basePower: 2, baseToughness: 2 });
    state.equip(equipment, creature);
    state.activePlayerId = you.id;
    expect(effectivePT(state, creature)).toEqual([3, 2]);
    state.activePlayerId = opp.id;
    expect(effectivePT(state, creature)).toEqual([2, 2]);
  });

  it('effectivePT: two simultaneous grants (a fixed equip bonus AND a +1/+1 counter) both apply additively', () => {
    const state = new GameState();
    const you = state.addPlayer('you');
    const equipment = state.addCard(you, 'Battlefield', {
      name: 'equipment',
      continuousPTGrants: [{ power: 1, toughness: 1, includeSelf: false, equippedBySelf: true }],
    });
    const creature = state.addCard(you, 'Battlefield', { name: 'creature', basePower: 1, baseToughness: 1 });
    state.equip(equipment, creature);
    state.putCounter(creature, '+1/+1', 1);
    expect(effectivePT(state, creature)).toEqual([1 + 1 + 1, 1 + 1 + 1]);
  });

  it('effectiveSubtypes: an equippedBySelf type grant (Dragoon\'s Lance/White Mage\'s Staff-shaped) genuinely follows live re-equip', () => {
    const state = new GameState();
    const you = state.addPlayer('you');
    const equipment = state.addCard(you, 'Battlefield', {
      name: 'equipment',
      continuousTypeGrants: [{ types: ['Knight'], includeSelf: false, equippedBySelf: true }],
    });
    const creatureA = state.addCard(you, 'Battlefield', { name: 'creature-a', subtypes: ['Human'] });
    const creatureB = state.addCard(you, 'Battlefield', { name: 'creature-b', subtypes: ['Elf'] });
    expect(effectiveSubtypes(state, creatureA)).toEqual(['Human']);
    state.equip(equipment, creatureA);
    expect(effectiveSubtypes(state, creatureA)).toEqual(expect.arrayContaining(['Human', 'Knight']));
    expect(effectiveSubtypes(state, creatureB)).toEqual(['Elf']);
    // Printed subtypes are untouched by the grant, same "recalculated on
    // read, never mutated in place" invariant `effectiveTypes`'s own
    // animate test above establishes.
    expect(creatureA.subtypes).toEqual(['Human']);
    // Re-equip — the granted type genuinely moves, live, off creatureA.
    state.equip(equipment, creatureB);
    expect(effectiveSubtypes(state, creatureA)).toEqual(['Human']);
    expect(effectiveSubtypes(state, creatureB)).toEqual(expect.arrayContaining(['Elf', 'Knight']));
  });

  it('effectiveSubtypes: wrapCard.hasSubtype reads a granted type exactly like a printed one', () => {
    const state = new GameState();
    const you = state.addPlayer('you');
    const equipment = state.addCard(you, 'Battlefield', {
      name: 'equipment',
      continuousTypeGrants: [{ types: ['Cleric'], includeSelf: false, equippedBySelf: true }],
    });
    const creature = state.addCard(you, 'Battlefield', { name: 'creature', subtypes: [] });
    expect(wrapCard(state, creature).hasSubtype('Cleric')).toBe(false);
    state.equip(equipment, creature);
    expect(wrapCard(state, creature).hasSubtype('Cleric')).toBe(true);
  });

  it('effectiveSubtypes: a subtype-matched includeSelf grant works identically to the keyword-grant family (proving the shared targeting helper, not a coincidence)', () => {
    const state = new GameState();
    const you = state.addPlayer('you');
    const granter = state.addCard(you, 'Battlefield', {
      name: 'granter',
      subtypes: ['Wizard'],
      continuousTypeGrants: [{ types: ['Artificer'], includeSelf: true, subtype: 'Wizard' }],
    });
    const otherWizard = state.addCard(you, 'Battlefield', { name: 'other-wizard', subtypes: ['Wizard'] });
    const nonWizard = state.addCard(you, 'Battlefield', { name: 'non-wizard', subtypes: ['Human'] });
    expect(effectiveSubtypes(state, granter)).toEqual(expect.arrayContaining(['Wizard', 'Artificer']));
    expect(effectiveSubtypes(state, otherWizard)).toEqual(expect.arrayContaining(['Wizard', 'Artificer']));
    expect(effectiveSubtypes(state, nonWizard)).toEqual(['Human']);
  });
});

// ENGINE_GAPS.md gap #8 — real damage-prevention shields ('DamagePrevention'/
// 'CombatDamagePrevention'), a narrow chokepoint check inside `state.dealDamage`
// itself, same "narrow hook, not a general 614/616 dispatcher" shape the
// STUN/FINALITY counter replacements above already established.
describe('GameState.dealDamage — damage-prevention shields (614.2, ENGINE_GAPS.md gap #8)', () => {
  it("Crystal Fragments/Summon: Alexander-shaped 'DamagePrevention' (printed keyword) prevents ALL damage, not just combat", () => {
    const state = new GameState();
    const you = state.addPlayer('you');
    const creature = state.addCard(you, 'Battlefield', { name: 'shielded-creature', keywords: ['DamagePrevention'], baseToughness: 4 });
    const nonCombat = state.dealDamage(creature, 3);
    expect(nonCombat).toEqual({ lifeGained: 0, prevented: true });
    expect(creature.damageMarked ?? 0).toBe(0);
    const combat = state.dealDamage(creature, 3, undefined, { combat: true });
    expect(combat).toEqual({ lifeGained: 0, prevented: true });
    expect(creature.damageMarked ?? 0).toBe(0);
  });

  it("Diamond Weapon-shaped 'CombatDamagePrevention' (printed keyword) prevents COMBAT damage only", () => {
    const state = new GameState();
    const you = state.addPlayer('you');
    const diamondWeapon = state.addCard(you, 'Battlefield', { name: 'Diamond Weapon', keywords: ['CombatDamagePrevention'], baseToughness: 8 });
    const combat = state.dealDamage(diamondWeapon, 5, undefined, { combat: true });
    expect(combat).toEqual({ lifeGained: 0, prevented: true });
    expect(diamondWeapon.damageMarked ?? 0).toBe(0);
  });

  it("'CombatDamagePrevention' does NOT prevent non-combat damage (illegal-path: the guard is genuinely combat-scoped, not a blanket shield)", () => {
    const state = new GameState();
    const you = state.addPlayer('you');
    const diamondWeapon = state.addCard(you, 'Battlefield', { name: 'Diamond Weapon', keywords: ['CombatDamagePrevention'], baseToughness: 8 });
    const result = state.dealDamage(diamondWeapon, 5);
    expect(result).toEqual({ lifeGained: 0, prevented: false });
    expect(diamondWeapon.damageMarked).toBe(5);
  });

  it("a GRANTED shield (state.grantKeyword — real Crystal Fragments/Summon: Alexander chapter I/II 'grantKeywordAll' shape) is just as real as a printed one, not just a label", () => {
    const state = new GameState();
    const you = state.addPlayer('you');
    const creature = state.addCard(you, 'Battlefield', { name: 'your-creature', baseToughness: 3 });
    expect(creature.keywords).not.toContain('DamagePrevention'); // not printed
    state.grantKeyword(creature, 'DamagePrevention', { untilEndOfTurn: true });
    const result = state.dealDamage(creature, 4);
    expect(result).toEqual({ lifeGained: 0, prevented: true });
    expect(creature.damageMarked ?? 0).toBe(0);
  });

  it('a creature with NO shield takes damage normally (illegal-path: the guard does not fire unconditionally)', () => {
    const state = new GameState();
    const you = state.addPlayer('you');
    const creature = state.addCard(you, 'Battlefield', { name: 'unshielded-creature', baseToughness: 4 });
    const result = state.dealDamage(creature, 3, undefined, { combat: true });
    expect(result).toEqual({ lifeGained: 0, prevented: false });
    expect(creature.damageMarked).toBe(3);
  });

  it('a fully-prevented hit grants NO Lifelink either — the damage event never happened at all (614.2), not merely "0 marked, life still gained"', () => {
    const state = new GameState();
    const you = state.addPlayer('you');
    const opp = state.addPlayer('opp');
    const target = state.addCard(opp, 'Battlefield', { name: 'shielded-creature', keywords: ['DamagePrevention'], baseToughness: 4 });
    const source = state.addCard(you, 'Battlefield', { name: 'lifelink-source', keywords: ['Lifelink'] });
    const before = you.life;
    const result = state.dealDamage(target, 5, source);
    expect(result).toEqual({ lifeGained: 0, prevented: true });
    expect(you.life).toBe(before);
  });

  it('Lifelink still gains real life normally when damage is NOT prevented (multi-source: shield + Lifelink together, only the shielded side is affected)', () => {
    const state = new GameState();
    const you = state.addPlayer('you');
    const opp = state.addPlayer('opp');
    const target = state.addCard(opp, 'Battlefield', { name: 'unshielded-creature', baseToughness: 4 });
    const source = state.addCard(you, 'Battlefield', { name: 'lifelink-source', keywords: ['Lifelink'] });
    const before = you.life;
    const result = state.dealDamage(target, 5, source);
    expect(result).toEqual({ lifeGained: 5, prevented: false });
    expect(you.life).toBe(before + 5);
    expect(target.damageMarked).toBe(5);
  });
});

// ENGINE_GAPS.md gap #8b — real lifegain-doubling replacement ('LifegainDouble'),
// the ONE real chokepoint (`state.gainLife`) every life-total increase in
// this engine now routes through, including `dealDamage`'s own Lifelink
// branch above.
describe('GameState.gainLife — lifegain-doubling replacement (614.2, ENGINE_GAPS.md gap #8b)', () => {
  it("The Wind Crystal-shaped 'LifegainDouble' doubles a real lifegain amount", () => {
    const state = new GameState();
    const you = state.addPlayer('you');
    state.addCard(you, 'Battlefield', { name: 'The Wind Crystal', keywords: ['LifegainDouble'] });
    const before = you.life;
    const applied = state.gainLife(you, 3);
    expect(applied).toBe(6);
    expect(you.life).toBe(before + 6);
  });

  it('a player with NO lifegain doubler on the battlefield gains the plain, undoubled amount (illegal-path: the guard does not fire unconditionally)', () => {
    const state = new GameState();
    const you = state.addPlayer('you');
    const before = you.life;
    const applied = state.gainLife(you, 3);
    expect(applied).toBe(3);
    expect(you.life).toBe(before + 3);
  });

  it("an OPPONENT's own 'LifegainDouble' permanent does not affect a different player's own lifegain (multi-source, cross-player)", () => {
    const state = new GameState();
    const you = state.addPlayer('you');
    const opp = state.addPlayer('opp');
    state.addCard(opp, 'Battlefield', { name: 'The Wind Crystal', keywords: ['LifegainDouble'] });
    const applied = state.gainLife(you, 4);
    expect(applied).toBe(4);
  });

  it('TWO lifegain doublers on the same battlefield still only double once (a real, deliberate simplification — no stacking/multiplicative replacement ordering, same narrow-chokepoint scope this whole gap is built to)', () => {
    const state = new GameState();
    const you = state.addPlayer('you');
    state.addCard(you, 'Battlefield', { name: 'The Wind Crystal', keywords: ['LifegainDouble'] });
    state.addCard(you, 'Battlefield', { name: 'Second Wind Crystal', keywords: ['LifegainDouble'] });
    const applied = state.gainLife(you, 3);
    expect(applied).toBe(6);
  });

  it('a real Lifelink combat/effect hit routes through the SAME chokepoint — its own lifegain is doubled too, not just a direct gainLife call', () => {
    const state = new GameState();
    const you = state.addPlayer('you');
    const opp = state.addPlayer('opp');
    state.addCard(you, 'Battlefield', { name: 'The Wind Crystal', keywords: ['LifegainDouble'] });
    const source = state.addCard(you, 'Battlefield', { name: 'lifelink-source', keywords: ['Lifelink'] });
    const target = state.addCard(opp, 'Battlefield', { name: 'victim', baseToughness: 4 });
    const before = you.life;
    const result = state.dealDamage(target, 5, source);
    expect(result).toEqual({ lifeGained: 10, prevented: false });
    expect(you.life).toBe(before + 10);
  });

  it('a non-positive amount is never doubled (0 stays 0)', () => {
    const state = new GameState();
    const you = state.addPlayer('you');
    state.addCard(you, 'Battlefield', { name: 'The Wind Crystal', keywords: ['LifegainDouble'] });
    expect(state.gainLife(you, 0)).toBe(0);
  });
});

// ENGINE_GAPS.md gap #15 — a real, minimal coin-flip resolution primitive
// (`state.flipCoin`), plus Edgar, King of Figaro's own narrow "first flip
// each turn always wins" replacement ('TwoHeadedCoin').
describe('GameState.flipCoin — coin-flip resolution + Two-Headed Coin replacement (ENGINE_GAPS.md gap #15)', () => {
  it("Edgar-shaped 'TwoHeadedCoin' forces a WIN on the first flip this turn, overriding the caller's own requested outcome", () => {
    const state = new GameState();
    const you = state.addPlayer('you');
    state.addCard(you, 'Battlefield', { name: 'Edgar, King of Figaro', keywords: ['TwoHeadedCoin'] });
    expect(state.flipCoin(you, false)).toBe(true);
  });

  it('with NO TwoHeadedCoin present, the caller-supplied outcome passes through unchanged, both ways (illegal-path: the guard does not fire unconditionally)', () => {
    const state = new GameState();
    const you = state.addPlayer('you');
    expect(state.flipCoin(you, true)).toBe(true);
    expect(state.flipCoin(you, false)).toBe(false);
  });

  it('a SECOND flip the same turn is unaffected — only the FIRST flip each turn is forced (real Count$YouFlipThisTurn/EQ0 scoping)', () => {
    const state = new GameState();
    const you = state.addPlayer('you');
    state.addCard(you, 'Battlefield', { name: 'Edgar, King of Figaro', keywords: ['TwoHeadedCoin'] });
    expect(state.flipCoin(you, false)).toBe(true); // first flip: forced
    expect(state.flipCoin(you, false)).toBe(false); // second flip: NOT forced
  });

  it('resetFlippedCoinThisTurn (real Cleanup reset) makes the NEXT flip the "first" one again', () => {
    const state = new GameState();
    const you = state.addPlayer('you');
    state.addCard(you, 'Battlefield', { name: 'Edgar, King of Figaro', keywords: ['TwoHeadedCoin'] });
    expect(state.flipCoin(you, false)).toBe(true);
    expect(state.flipCoin(you, false)).toBe(false);
    state.resetFlippedCoinThisTurn();
    expect(state.flipCoin(you, false)).toBe(true); // forced again, a "new turn"
  });

  it("an OPPONENT's own 'TwoHeadedCoin' permanent does not force a different player's own flip (multi-source, cross-player)", () => {
    const state = new GameState();
    const you = state.addPlayer('you');
    const opp = state.addPlayer('opp');
    state.addCard(opp, 'Battlefield', { name: 'Edgar, King of Figaro', keywords: ['TwoHeadedCoin'] });
    expect(state.flipCoin(you, false)).toBe(false);
  });
});
