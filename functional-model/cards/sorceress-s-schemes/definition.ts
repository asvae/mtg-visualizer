import type { CardDefinition, Effect } from '../../card';
import { flashback } from '../../flashback';

export const sorceresssSchemes: CardDefinition = {
  name: "Sorceress's Schemes",
  manaCost: '{3}{R}',
  typeLine: 'Sorcery',

  // Real text also covers "or exiled card with flashback you own" as an
  // alternate source zone — `move`'s `from` is a single ZoneType, so only
  // the graveyard half is modeled; the exile-with-flashback half is real
  // but rare and left undeclared (documented in progress.json, not
  // silently dropped from this comment).
  //
  // "instant OR SORCERY card" has no filter to express at all: `move`'s
  // `validType` enum is `'creature' | 'artifact' | 'land' | 'any'` (no
  // instant/sorcery option), AND — checked interfaces.ts directly — no
  // Card method anywhere in this model (`isCreature`/`isLand`/
  // `isEnchantment`/`isArtifact` exist; no `isInstant`/`isSorcery`, no
  // `typeLine` accessor either) can even distinguish an instant/sorcery
  // card once it's sitting in a zone, so a `custom` effect couldn't do
  // this filtering by hand either — a genuinely absent capability, not a
  // declarative-shape gap alone. `validType: 'any'` is the closest
  // available approximation; it is real overbroad (would also let this
  // effect "return" a creature or land card sitting in the same
  // graveyard, which the printed card cannot).
  //
  // recognizer-exception: move-effect-structural — `validType:'any'` builds
  // "target card you own," but the real text ("target INSTANT OR SORCERY
  // card ... you own") never contains that phrase — a real, pre-existing,
  // documented approximation (see the comment above), not something this
  // recognizer should silently paper over. See that recognizer's own
  // module doc comment.
  effects: [
    { kind: 'move', owner: 'you', from: 'Graveyard', to: 'Hand', qty: 1, target: true, validType: 'any' } satisfies Effect,
    {
      // "Add {R}" — no mana-pool concept anywhere in this model (same
      // total "no mana engine" gap every mana ability in this project
      // hits, e.g. cavern-of-souls's own two mana abilities).
      kind: 'custom',
      describe: 'add {R} (no mana-pool concept in this model)',
      run: () => {},
    } satisfies Effect,
  ],

  alternateCosts: [flashback('{4}{R}')],
};
