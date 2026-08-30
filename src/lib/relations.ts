import type { Role } from '../types';

// Every relation type is its own independent role now (produce/consume/atypical/
// grant/magnifier) — a card gets one edge per type that applies, same as
// produce+consume already coexisted as two edges. No more a role plus an
// orthogonal "modifiers" array layered on top of it. colorClass matches the
// edge's own color for that relation type, so a chip and the line it corresponds
// to in the graph read as the same thing. Shared by the card tooltip, the card
// lookup dropdown, and the review session so all three describe a card's
// relations identically.
export const ROLE_VERB: Record<Role, string> = {
  produce: 'Produces',
  consume: 'Consumes',
  atypical: 'Relates to',
  grant: 'Grants',
  magnifier: 'Magnifies',
};

export interface RelationChip {
  verb: string;
  theme: string;
  colorClass: string;
  weight: number;
}

export function describeRelation(themeLabel: string, role: Role, weight = 1): RelationChip[] {
  return [{ verb: ROLE_VERB[role], theme: themeLabel, colorClass: `chip-${role}`, weight }];
}

export interface RelationColumn {
  verb: string;
  colorClass: string;
  themes: { label: string; weight: number }[];
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
    byVerb.get(chip.verb)!.themes.push({ label: chip.theme, weight: chip.weight });
  }
  return order.map((v) => byVerb.get(v)!);
}
