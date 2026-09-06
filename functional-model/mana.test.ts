import { describe, expect, it } from 'vitest';
import { GameState } from './state';
import { parseManaCost, canAfford, payMana, untappedManaSources, basicLandsFor, manaAbilityColorFromStaticText } from './mana';

describe('parseManaCost', () => {
  it('sums generic and counts colored pips separately', () => {
    expect(parseManaCost('{2}{U}{U}')).toEqual({ generic: 2, colors: { U: 2 } });
    expect(parseManaCost('{G}')).toEqual({ generic: 0, colors: { G: 1 } });
    expect(parseManaCost('{5}')).toEqual({ generic: 5, colors: {} });
  });

  it('throws on a mana symbol outside this file\'s declared scope', () => {
    expect(() => parseManaCost('{W/U}')).toThrow(/unsupported mana symbol/);
    expect(() => parseManaCost('{X}')).toThrow(/unsupported mana symbol/);
    expect(() => parseManaCost('{C}')).toThrow(/unsupported mana symbol/);
  });
});

describe('canAfford / payMana', () => {
  function setup() {
    const state = new GameState();
    const you = state.addPlayer('you');
    const island1 = state.addCard(you, 'Battlefield', { name: 'Island', types: ['Land'], subtypes: ['Island'] });
    const island2 = state.addCard(you, 'Battlefield', { name: 'Island', types: ['Land'], subtypes: ['Island'] });
    const forest = state.addCard(you, 'Battlefield', { name: 'Forest', types: ['Land'], subtypes: ['Forest'] });
    return { state, you, island1, island2, forest };
  }

  it('affords a cost when colored pips + generic both have enough sources', () => {
    const { you } = setup();
    expect(canAfford(untappedManaSources(you), parseManaCost('{1}{U}'))).toBe(true);
    expect(canAfford(untappedManaSources(you), parseManaCost('{2}{U}'))).toBe(true);
  });

  it('does not afford a cost needing more colored pips than sources of that color exist', () => {
    const { you } = setup();
    expect(canAfford(untappedManaSources(you), parseManaCost('{U}{U}{U}'))).toBe(false);
  });

  it('does not afford a cost needing more total mana than untapped sources exist', () => {
    const { you } = setup();
    expect(canAfford(untappedManaSources(you), parseManaCost('{10}'))).toBe(false);
  });

  it('a tapped source no longer counts', () => {
    const { state, you, island1 } = setup();
    state.tap(island1);
    expect(canAfford(untappedManaSources(you), parseManaCost('{U}{U}'))).toBe(false);
  });

  it('payMana taps exactly enough sources to cover the cost, colored pips first', () => {
    const { state, you } = setup();
    payMana(state, untappedManaSources(you), parseManaCost('{1}{U}'));
    expect(you.battlefield.filter((c) => c.tapped)).toHaveLength(2);
    expect(you.battlefield.filter((c) => !c.tapped)).toHaveLength(1);
    // The one still untapped must be an Island (the payment used one Island for {U} and one land for {1}).
  });

  it('payMana throws (and taps nothing) when the cost cannot be afforded', () => {
    const { state, you } = setup();
    expect(() => payMana(state, untappedManaSources(you), parseManaCost('{U}{U}{U}'))).toThrow(/cannot afford/);
    expect(you.battlefield.every((c) => !c.tapped)).toBe(true);
  });
});

describe('manaAbilityColorFromStaticText (a narrow real slice of gap #5 — non-basic mana sources)', () => {
  it('recognizes an exact, single-color, unrestricted "{T}: Add {X}." string', () => {
    expect(manaAbilityColorFromStaticText(['{T}: Add {G}.'])).toBe('G');
    expect(manaAbilityColorFromStaticText(['{T}: Add {W}.'])).toBe('W');
  });

  it('returns the FIRST qualifying entry, correctly skipping a later restricted one (Willowrush Verge-shaped)', () => {
    expect(manaAbilityColorFromStaticText(['{T}: Add {U}.', '{T}: Add {G}. Activate only if you control a Forest or an Island.'])).toBe('U');
  });

  it('does not recognize a restricted ability text', () => {
    expect(manaAbilityColorFromStaticText(['{T}: Add {G}. Activate only if you control a Forest or an Island.'])).toBeUndefined();
    expect(manaAbilityColorFromStaticText(['{T}: Add {C}. Spend this mana only to cast an artifact spell or activate an ability of an artifact source.'])).toBeUndefined();
  });

  it('does not recognize a dual/choice-of-color ability', () => {
    expect(manaAbilityColorFromStaticText(['{T}: Add {G} or {U}.'])).toBeUndefined();
  });

  it('does not recognize a colorless or variable-amount ability', () => {
    expect(manaAbilityColorFromStaticText(['{T}: Add {C}.'])).toBeUndefined();
    expect(manaAbilityColorFromStaticText(['{T}: Add {G} for each Elf you control.'])).toBeUndefined();
  });

  it('returns undefined for no staticAbilities at all', () => {
    expect(manaAbilityColorFromStaticText(undefined)).toBeUndefined();
    expect(manaAbilityColorFromStaticText([])).toBeUndefined();
  });
});

describe('untappedManaSources — a real manaAbility-derived source (non-Land, e.g. an artifact)', () => {
  it('counts a card with a real manaAbility field as a source of that color', () => {
    const state = new GameState();
    const you = state.addPlayer('you');
    const rock = state.addCard(you, 'Battlefield', { name: 'Test Rock', types: ['Artifact'], manaAbility: 'W' });
    expect(canAfford(untappedManaSources(you), parseManaCost('{W}'))).toBe(true);
    payMana(state, untappedManaSources(you), parseManaCost('{W}'));
    expect(rock.tapped).toBe(true);
  });

  it('a tapped manaAbility source no longer counts', () => {
    const state = new GameState();
    const you = state.addPlayer('you');
    const rock = state.addCard(you, 'Battlefield', { name: 'Test Rock', types: ['Artifact'], manaAbility: 'W' });
    state.tap(rock);
    expect(canAfford(untappedManaSources(you), parseManaCost('{W}'))).toBe(false);
  });

  it('a card with no manaAbility and no basic-land subtype is not a mana source', () => {
    const state = new GameState();
    const you = state.addPlayer('you');
    state.addCard(you, 'Battlefield', { name: 'Plain Artifact', types: ['Artifact'] });
    expect(canAfford(untappedManaSources(you), parseManaCost('{W}'))).toBe(false);
  });
});

describe('basicLandsFor', () => {
  it('yields one matching basic land per colored pip', () => {
    expect(basicLandsFor('{2}{U}{U}')).toEqual(expect.arrayContaining(['Island', 'Island']));
    expect(basicLandsFor('{2}{U}{U}')).toHaveLength(4);
  });

  it('fills generic pips by round-robining the colors the cost already needs', () => {
    expect(basicLandsFor('{2}{G}')).toEqual(['Forest', 'Forest', 'Forest']);
    expect(basicLandsFor('{2}{W}{U}')).toEqual(['Plains', 'Island', 'Plains', 'Island']);
  });

  it('falls back to Forest when the cost has zero colored pips', () => {
    expect(basicLandsFor('{3}')).toEqual(['Forest', 'Forest', 'Forest', 'Forest']);
    expect(basicLandsFor('{0}')).toEqual(['Forest']);
  });

  it('throws on an unsupported mana symbol, same as parseManaCost', () => {
    expect(() => basicLandsFor('{X}')).toThrow(/unsupported mana symbol/);
  });
});
