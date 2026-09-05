import { describe, expect, it } from 'vitest';
import { parseDecklist } from './deckImport';

describe('parseDecklist', () => {
  it('parses a plain list, with and without the "x" multiplier', () => {
    expect(parseDecklist('4 Lightning Bolt\n2x Counterspell\n1X Black Lotus')).toEqual([
      { name: 'Lightning Bolt', qty: 4 },
      { name: 'Counterspell', qty: 2 },
      { name: 'Black Lotus', qty: 1 },
    ]);
  });

  it('strips MTGO/MTGA/Moxfield-style (SET) NUM suffixes', () => {
    expect(parseDecklist('1 Jeweled Lotus (CMR) 319\n4 Llanowar Elves (M12) 182\n1 Atraxa, Praetors\' Voice')).toEqual([
      { name: 'Jeweled Lotus', qty: 1 },
      { name: 'Llanowar Elves', qty: 4 },
      { name: "Atraxa, Praetors' Voice", qty: 1 },
    ]);
  });

  it('strips Forge .dck pipe-delimited SET|NUM suffixes and tolerates bracket sections', () => {
    const dck = ['[metadata]', 'Name=Aerodoom', 'Deck Type=constructed', '[main]', '4 Island|TMP|1', '1 Ebon Stronghold|FEM', '[sideboard]'].join('\n');
    expect(parseDecklist(dck)).toEqual([
      { name: 'Island', qty: 4 },
      { name: 'Ebon Stronghold', qty: 1 },
    ]);
  });

  it('excludes a Sideboard section from the returned main-deck list', () => {
    const text = ['Deck', '4 Lightning Bolt', '', 'Sideboard', '2 Negate', '1 Rest in Peace'].join('\n');
    expect(parseDecklist(text)).toEqual([{ name: 'Lightning Bolt', qty: 4 }]);
  });

  it('skips comment lines and blank lines without breaking section tracking', () => {
    const text = ['# My burn deck', '4 Lightning Bolt', '// sideboard below', 'Sideboard', '2 Negate'].join('\n');
    expect(parseDecklist(text)).toEqual([{ name: 'Lightning Bolt', qty: 4 }]);
  });

  it('keeps a comma in a card name intact', () => {
    expect(parseDecklist('1 Jecht, Reluctant Guardian')).toEqual([{ name: 'Jecht, Reluctant Guardian', qty: 1 }]);
  });

  it('skips stray/unrecognized lines instead of erroring', () => {
    expect(parseDecklist('My Cool Deck\nWinsToUnlock=0\n4 Lightning Bolt')).toEqual([{ name: 'Lightning Bolt', qty: 4 }]);
  });

  it('sums quantities when the same name appears on multiple lines (e.g. basics split by printing)', () => {
    const dck = ['[main]', '4 Island|TMP|1', '4 Island|TMP|2', '3 Island|TMP|3', '1 Ebon Stronghold|FEM'].join('\n');
    expect(parseDecklist(dck)).toEqual([
      { name: 'Island', qty: 11 },
      { name: 'Ebon Stronghold', qty: 1 },
    ]);
  });

  it('returns an empty list for empty input', () => {
    expect(parseDecklist('')).toEqual([]);
    expect(parseDecklist('   \n\n  ')).toEqual([]);
  });
});
