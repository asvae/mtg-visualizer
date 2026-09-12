import { describe, expect, it } from 'vitest';
import { GameState } from './state';
import { parseManaCost, resolveXCost, reduceGenericCost, formatManaCost, canAfford, payMana, untappedManaSources, basicLandsFor, manaAbilityColorFromStaticText, manaAbilityColorsFromStaticText, deriveManaAbility } from './mana';

describe('parseManaCost', () => {
  it('sums generic and counts colored pips separately', () => {
    expect(parseManaCost('{2}{U}{U}')).toEqual({ generic: 2, colors: { U: 2 }, hybrid: [], xCount: 0 });
    expect(parseManaCost('{G}')).toEqual({ generic: 0, colors: { G: 1 }, hybrid: [], xCount: 0 });
    expect(parseManaCost('{5}')).toEqual({ generic: 5, colors: {}, hybrid: [], xCount: 0 });
  });

  it('throws on a mana symbol outside this file\'s declared scope (Phyrexian, a colorless PIP IN A COST — no real FIN card needs either)', () => {
    expect(() => parseManaCost('{U/P}')).toThrow(/unsupported mana symbol/);
    expect(() => parseManaCost('{C}')).toThrow(/unsupported mana symbol/);
  });

  it('parses real Hybrid pips (ENGINE_GAPS.md gap #6, closed 2026-09-12 — Thranduil, Sindarin Liege // Silvan Rally\'s own {1}{G/U}{G/U}/{2}{G/U}{G/U})', () => {
    expect(parseManaCost('{1}{G/U}{G/U}')).toEqual({ generic: 1, colors: {}, hybrid: [['G', 'U'], ['G', 'U']], xCount: 0 });
    expect(parseManaCost('{2}{G/U}{G/U}')).toEqual({ generic: 2, colors: {}, hybrid: [['G', 'U'], ['G', 'U']], xCount: 0 });
  });

  it('parses real {X} symbols, counting repeats rather than throwing (ENGINE_GAPS.md gap #6, closed 2026-09-12 — Choco Comet\'s {X}{R}{R}, Doppelgang\'s {X}{X}{X}{G}{U})', () => {
    expect(parseManaCost('{X}{R}{R}')).toEqual({ generic: 0, colors: { R: 2 }, hybrid: [], xCount: 1 });
    expect(parseManaCost('{X}{X}{X}{G}{U}')).toEqual({ generic: 0, colors: { G: 1, U: 1 }, hybrid: [], xCount: 3 });
  });
});

describe('resolveXCost (CR 601.2b/107.3c — engine.ts\'s effectiveCastCost)', () => {
  it('folds a chosen x into generic, once per real {X} symbol in the cost (multiple {X}s share the same value)', () => {
    expect(resolveXCost(parseManaCost('{X}{R}{R}'), 3)).toEqual({ generic: 3, colors: { R: 2 }, hybrid: [], xCount: 0 });
    expect(resolveXCost(parseManaCost('{X}{X}{X}{G}{U}'), 2)).toEqual({ generic: 6, colors: { G: 1, U: 1 }, hybrid: [], xCount: 0 });
  });

  it('defaults to x=0 (a real, legal CR 107.3b choice) when omitted', () => {
    expect(resolveXCost(parseManaCost('{X}{R}{R}'))).toEqual({ generic: 0, colors: { R: 2 }, hybrid: [], xCount: 0 });
  });

  it('is a no-op (aside from zeroing xCount) on a cost with no {X} at all', () => {
    expect(resolveXCost(parseManaCost('{2}{W}'), 5)).toEqual({ generic: 2, colors: { W: 1 }, hybrid: [], xCount: 0 });
  });
});

describe('reduceGenericCost / formatManaCost (real CR 601.2f cost-reduction — card.ts\'s CostReduction, engine.ts\'s effectiveCastCost)', () => {
  it('reduces only the generic portion, floored at 0, never touching colored pips (118.9)', () => {
    expect(reduceGenericCost(parseManaCost('{4}{W}'), 2)).toEqual({ generic: 2, colors: { W: 1 }, hybrid: [], xCount: 0 });
    // Fate of the Sun-Cryst's own real shape: {4}{W} minus {2} = {2}{W}.
    expect(reduceGenericCost(parseManaCost('{1}'), 2)).toEqual({ generic: 0, colors: {}, hybrid: [], xCount: 0 });
    expect(reduceGenericCost(parseManaCost('{W}{W}'), 5)).toEqual({ generic: 0, colors: { W: 2 }, hybrid: [], xCount: 0 });
  });

  it('formats a parsed cost back to a printed-style string, omitting a zero generic when colored pips remain', () => {
    expect(formatManaCost(parseManaCost('{4}{W}'))).toBe('{4}{W}');
    // Fate of the Sun-Cryst's own real shape: {4}{W} minus {2} = {2}{W}.
    expect(formatManaCost(reduceGenericCost(parseManaCost('{4}{W}'), 2))).toBe('{2}{W}');
    expect(formatManaCost(reduceGenericCost(parseManaCost('{2}{U}{U}'), 2))).toBe('{U}{U}');
    // Fully reduced away with no colored pips left still prints a real {0}, not an empty string.
    expect(formatManaCost(reduceGenericCost(parseManaCost('{2}'), 5))).toBe('{0}');
  });

  it('renders real Hybrid pips after colored ones, and an X-resolved cost as its real paid total (not the printed {X} template)', () => {
    expect(formatManaCost(parseManaCost('{1}{G/U}{G/U}'))).toBe('{1}{G/U}{G/U}');
    expect(formatManaCost(resolveXCost(parseManaCost('{X}{R}{R}'), 3))).toBe('{3}{R}{R}');
    // No generic left AND no colored pips, but real Hybrid pips remain — omit the {0}.
    expect(formatManaCost(reduceGenericCost(parseManaCost('{1}{G/U}{G/U}'), 1))).toBe('{G/U}{G/U}');
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

describe('canAfford / payMana — real Hybrid pips (ENGINE_GAPS.md gap #6, Thranduil, Sindarin Liege // Silvan Rally\'s own {G/U}-shaped costs)', () => {
  function setupDual(forests: number, islands: number) {
    const state = new GameState();
    const you = state.addPlayer('you');
    for (let i = 0; i < forests; i++) state.addCard(you, 'Battlefield', { name: 'Forest', types: ['Land'], subtypes: ['Forest'] });
    for (let i = 0; i < islands; i++) state.addCard(you, 'Battlefield', { name: 'Island', types: ['Land'], subtypes: ['Island'] });
    return { state, you };
  }

  it('affords {1}{G/U}{G/U} with two Forests and one Island (each Hybrid pip pays with a different color)', () => {
    const { you } = setupDual(2, 1);
    expect(canAfford(untappedManaSources(you), parseManaCost('{1}{G/U}{G/U}'))).toBe(true);
  });

  it('affords {2}{G/U}{G/U} with ALL Forests (both Hybrid pips pay with the SAME legal color)', () => {
    const { you } = setupDual(4, 0);
    expect(canAfford(untappedManaSources(you), parseManaCost('{2}{G/U}{G/U}'))).toBe(true);
  });

  it('does not afford a Hybrid cost when neither legal color has enough sources', () => {
    const { you } = setupDual(1, 0); // 1 Forest, cost needs 2 Hybrid G/U pips + {2} generic = 4 total lands
    expect(canAfford(untappedManaSources(you), parseManaCost('{2}{G/U}{G/U}'))).toBe(false);
  });

  it('two {G/U} pips against exactly one Forest + one Island both get paid (one pip per color)', () => {
    const { you } = setupDual(1, 1);
    expect(canAfford(untappedManaSources(you), parseManaCost('{G/U}{G/U}'))).toBe(true);
    const { state, you: you2 } = setupDual(1, 1);
    payMana(state, untappedManaSources(you2), parseManaCost('{G/U}{G/U}'));
    expect(you2.battlefield.every((c) => c.tapped)).toBe(true);
  });
});

describe('canAfford / payMana — real {X} costs (ENGINE_GAPS.md gap #6, resolved via resolveXCost before either function sees the cost)', () => {
  it('an unresolved {X} cost is affordable as X=0 (a real, legal default) even with few sources', () => {
    const state = new GameState();
    const you = state.addPlayer('you');
    state.addCard(you, 'Battlefield', { name: 'Mountain', types: ['Land'], subtypes: ['Mountain'] });
    state.addCard(you, 'Battlefield', { name: 'Mountain', types: ['Land'], subtypes: ['Mountain'] });
    // Choco Comet's own {X}{R}{R} — X unresolved (0 generic) needs exactly 2 Mountains.
    expect(canAfford(untappedManaSources(you), parseManaCost('{X}{R}{R}'))).toBe(true);
    expect(canAfford(untappedManaSources(you), resolveXCost(parseManaCost('{X}{R}{R}'), 3))).toBe(false);
  });

  it('a real X=3 choice on Choco Comet\'s own {X}{R}{R} needs 5 total mana sources (3 generic + 2 red)', () => {
    const state = new GameState();
    const you = state.addPlayer('you');
    for (let i = 0; i < 2; i++) state.addCard(you, 'Battlefield', { name: 'Mountain', types: ['Land'], subtypes: ['Mountain'] });
    for (let i = 0; i < 3; i++) state.addCard(you, 'Battlefield', { name: 'Forest', types: ['Land'], subtypes: ['Forest'] });
    const cost = resolveXCost(parseManaCost('{X}{R}{R}'), 3);
    expect(canAfford(untappedManaSources(you), cost)).toBe(true);
    payMana(state, untappedManaSources(you), cost);
    expect(you.battlefield.every((c) => c.tapped)).toBe(true);
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

  it('recognizes an exact, single-colorless, unrestricted "{T}: Add {C}." string (2026-09-09 — The Gold Saucer)', () => {
    expect(manaAbilityColorFromStaticText(['{T}: Add {C}.'])).toBe('C');
  });

  it('does not recognize a variable-amount ability', () => {
    expect(manaAbilityColorFromStaticText(['{T}: Add {G} for each Elf you control.'])).toBeUndefined();
  });

  it('returns undefined for no staticAbilities at all', () => {
    expect(manaAbilityColorFromStaticText(undefined)).toBeUndefined();
    expect(manaAbilityColorFromStaticText([])).toBeUndefined();
  });
});

describe('manaAbilityColorsFromStaticText (the choice-of-color-widened counterpart above — now also a real payment primitive via deriveManaAbility, closed 2026-09-12)', () => {
  it('recognizes a single colorless "{T}: Add {C}." string the same way the single-value function does', () => {
    expect(manaAbilityColorsFromStaticText(['{T}: Add {C}.'])).toEqual(['C']);
  });

  it('still does not widen the choice-of-color branch to include colorless (no real card mixes {C} into a choice)', () => {
    expect(manaAbilityColorsFromStaticText(['{T}: Add {C} or {G}.'])).toEqual([]);
  });

  it('recognizes a real dual/choice-of-color ability (Vector, Imperial Capital-shaped, 12 real Town-cycle lands)', () => {
    expect(manaAbilityColorsFromStaticText(['{T}: Add {B} or {R}.'])).toEqual(['B', 'R']);
  });
});

describe('deriveManaAbility (real ETB derivation used by engine.ts\'s resolveTop/playLand — single-color first, then choice-of-color)', () => {
  it('returns a bare ManaColor for a single-color match (unchanged shape from before this pass)', () => {
    expect(deriveManaAbility(['{T}: Add {G}.'])).toBe('G');
  });

  it('returns a ManaColor[] for a real choice-of-color match', () => {
    expect(deriveManaAbility(['{T}: Add {B} or {R}.'])).toEqual(['B', 'R']);
  });

  it('returns undefined for a restricted (Cargo Ship-shaped) or variable (Elvish Archdruid-shaped) ability — neither is on staticAbilities text at all in the real pool, and even if it were, neither regex matches', () => {
    expect(deriveManaAbility(['{T}: Add {C}. Spend this mana only to cast an artifact spell or activate an ability of an artifact source.'])).toBeUndefined();
    expect(deriveManaAbility(['{T}: Add {G} for each Elf you control.'])).toBeUndefined();
  });

  it('returns undefined for no staticAbilities at all', () => {
    expect(deriveManaAbility(undefined)).toBeUndefined();
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

  it('a real dual-color manaAbility source (ManaColor[], Vector-Imperial-Capital-shaped) counts toward EITHER of its two colors (ENGINE_GAPS.md gap #5, closed 2026-09-12)', () => {
    const state = new GameState();
    const you = state.addPlayer('you');
    const townLand = state.addCard(you, 'Battlefield', { name: 'Test Town', types: ['Land'], subtypes: ['Town'], manaAbility: ['B', 'R'] });
    expect(canAfford(untappedManaSources(you), parseManaCost('{B}'))).toBe(true);
    expect(canAfford(untappedManaSources(you), parseManaCost('{R}'))).toBe(true);
    payMana(state, untappedManaSources(you), parseManaCost('{R}'));
    expect(townLand.tapped).toBe(true);
  });

  it('a dual-color source cannot pay a THIRD color it does not offer', () => {
    const state = new GameState();
    const you = state.addPlayer('you');
    state.addCard(you, 'Battlefield', { name: 'Test Town', types: ['Land'], subtypes: ['Town'], manaAbility: ['B', 'R'] });
    expect(canAfford(untappedManaSources(you), parseManaCost('{G}'))).toBe(false);
  });

  it('two dual-color sources correctly split across two DIFFERENT colored pip requirements (real assignment, not a fixed first-color pick)', () => {
    const state = new GameState();
    const you = state.addPlayer('you');
    state.addCard(you, 'Battlefield', { name: 'Test Town A', types: ['Land'], subtypes: ['Town'], manaAbility: ['B', 'R'] });
    state.addCard(you, 'Battlefield', { name: 'Test Town B', types: ['Land'], subtypes: ['Town'], manaAbility: ['B', 'R'] });
    payMana(state, untappedManaSources(you), parseManaCost('{B}{R}'));
    expect(you.battlefield.every((c) => c.tapped)).toBe(true);
  });

  it('genuinely backtracks rather than greedily failing: a dual (B/R) source considered FIRST for {B} must be un-picked and retried once a LATER {R} requirement turns out to have no other source (a naive non-backtracking greedy would wrongly reject this legal payment)', () => {
    const state = new GameState();
    const you = state.addPlayer('you');
    // Insertion order matters here: the dual source is added BEFORE the
    // fixed-color one, so a plain (non-undoing) first-fit scan tries the
    // dual source for the {B} requirement first, greedily "using it up" —
    // only real backtracking (assignManaRequirements's own `used.delete`
    // undo) recovers the one legal assignment (fixed-B source -> {B}, dual
    // source -> {R}).
    const dual = state.addCard(you, 'Battlefield', { name: 'Test Town (dual B/R)', types: ['Land'], subtypes: ['Town'], manaAbility: ['B', 'R'] });
    const fixedB = state.addCard(you, 'Battlefield', { name: 'Test Swamp', types: ['Land'], subtypes: ['Swamp'] });
    expect(canAfford(untappedManaSources(you), parseManaCost('{B}{R}'))).toBe(true);
    payMana(state, untappedManaSources(you), parseManaCost('{B}{R}'));
    expect(dual.tapped).toBe(true);
    expect(fixedB.tapped).toBe(true);
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
    expect(() => basicLandsFor('{C}')).toThrow(/unsupported mana symbol/);
  });

  it('yields one land per real Hybrid pip too (Thranduil, Sindarin Liege // Silvan Rally\'s own {1}{G/U}{G/U}), using the FIRST printed color', () => {
    expect(basicLandsFor('{1}{G/U}{G/U}')).toEqual(['Forest', 'Forest', 'Forest']);
  });

  it('ignores an unresolved {X} (same "resolve X first" convention as canAfford/payMana) — Choco Comet\'s own {X}{R}{R} yields just the 2 Mountains, no extra land for X', () => {
    expect(basicLandsFor('{X}{R}{R}')).toEqual(['Mountain', 'Mountain']);
  });
});
