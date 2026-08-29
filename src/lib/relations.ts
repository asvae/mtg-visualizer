import type { Modifier, Role } from '../types';

// One edge can produce more than one chip: the base action ("Magnifies Lifegain
// Payoff") plus, when conditional, a separate "Depends on X" chip rather than an
// adverb glued onto the verb — conditionality is its own relation, not a footnote
// on another one. colorClass matches the edge's own color for that relation type,
// so a chip and the line it corresponds to in the graph read as the same thing.
// Shared by the card tooltip and the card review checklist so both describe a
// card's relations identically.
export const ROLE_VERB: Record<Role, string> = {
  produce: 'Produces',
  consume: 'Consumes',
  atypical: 'Relates to',
};
export const MODIFIER_VERB: Partial<Record<Modifier, string>> = {
  magnifier: 'Magnifies',
  granter: 'Grants',
};

export interface RelationChip {
  verb: string;
  theme: string;
  colorClass: string;
}

export function describeRelation(themeLabel: string, role: Role, modifiers: Modifier[]): RelationChip[] {
  const primaryModifier = modifiers.find((m) => m !== 'conditional');
  const verb = primaryModifier ? MODIFIER_VERB[primaryModifier]! : ROLE_VERB[role];
  const colorClass = primaryModifier ? `chip-${primaryModifier}` : `chip-${role}`;
  const chips: RelationChip[] = [{ verb, theme: themeLabel, colorClass }];
  if (modifiers.includes('conditional')) {
    chips.push({ verb: 'Depends on', theme: themeLabel, colorClass: 'chip-conditional' });
  }
  return chips;
}

export interface RelationColumn {
  verb: string;
  colorClass: string;
  themes: string[];
}

// Groups a flat chip list into one entry per verb (relation type), in order of
// first appearance — theme names accumulate underneath instead of one chip per edge.
export function groupChipsByVerb(chips: RelationChip[]): RelationColumn[] {
  const order: string[] = [];
  const byVerb = new Map<string, RelationColumn>();
  for (const chip of chips) {
    if (!byVerb.has(chip.verb)) {
      byVerb.set(chip.verb, { verb: chip.verb, colorClass: chip.colorClass, themes: [] });
      order.push(chip.verb);
    }
    byVerb.get(chip.verb)!.themes.push(chip.theme);
  }
  return order.map((v) => byVerb.get(v)!);
}
