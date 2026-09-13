// Shared by both recognizers: the exact `{target:'typeLine', start, end}'
// span to anchor a "this card's basic identity licenses this fact" claim to
// — see `synergy.ts`'s own `AnnotationRef`/`FactAnnotationAuthoring` doc
// comments ("Summon: Bahamut's own self-cast/self-enters ... forced this: a
// baseline claim is true because of what's PRINTED ON THE TYPE LINE, not the
// ability text"). Both recognizers below anchor their self-cast/self-enters/
// self-graveyard facts to this same span, for the same reason: none of them
// have anything in the oracle text BODY to point at (a vanilla creature has
// no ability text at all), so the type line is the only real textual basis
// available, same as every hand-authored precedent already established.
//
// Deterministic rule, reverse-engineered from the REAL pool's own existing
// hand-authored annotations (checked directly, not guessed):
//   - 'Instant' / 'Sorcery' (no supertype ever precedes these in practice) →
//     the whole leading word (`battle-menu`, `auron-s-inspiration`, every
//     migrated instant/sorcery in the pool: `{start:0, end:7}` / `{end:8}`).
//   - A permanent type line ('Creature — Dwarf Soldier', 'Artifact —
//     Equipment', 'Enchantment Creature — Saga Dragon', 'Legendary Creature
//     — Human Knight') → every word BEFORE the em dash, MINUS any leading
//     supertype word(s) (`Legendary`/`Basic`/`Snow`/`World`/`Ongoing`/`Elite`/
//     `Host` — CR 205.4a's actual supertype list, restricted to the ones
//     that can ever precede a real card type this pool's permanents use).
//     Confirmed against real annotated facts:
//       - 'Creature — Dwarf Soldier' → {start:0,end:8} ("Creature")
//       - 'Artifact — Equipment' → {start:0,end:8} ("Artifact")
//       - 'Legendary Creature — Human Knight' → {start:10,end:18}
//         ("Creature", NOT "Legendary Creature" — supertype excluded)
//       - 'Enchantment Creature — Saga Dragon' → {start:0,end:20}
//         ("Enchantment Creature" — BOTH words kept: 'Enchantment' is a real
//         card type here, not a supertype, so nothing is stripped)
//     This is a genuinely deterministic rule the existing hand-authored
//     corpus already follows CONSISTENTLY for the narrow "which words" — it
//     is NOT perfectly self-consistent about whether the `cast` fact and the
//     `entersBattlefield` fact get the SAME span or two different ones (e.g.
//     Summon: Bahamut's own `cast` fact only spans "Creature" while its
//     `entersBattlefield` fact spans "Enchantment Creature" — a real,
//     observed inconsistency in today's hand-authored data, not something
//     this file perpetuates). This recognizer library picks ONE rule and
//     applies it identically to both facts every time, which is arguably a
//     real, small consistency IMPROVEMENT a mechanical recognizer offers for
//     free over ad hoc manual authoring — see this prototype's own writeup.
const SUPERTYPES = new Set(['Legendary', 'Basic', 'Snow', 'World', 'Ongoing', 'Elite', 'Host']);

/** Returns the `[start, end)` character range (into the RAW `typeLine`
 * string) of its real card type word(s), with any leading supertype
 * word(s) stripped — or `undefined` if `typeLine` is empty/only supertypes
 * (never observed in the real pool, but a recognizer never assumes a
 * well-formed input). */
export function typeWordsSpan(typeLine: string): { start: number; end: number } | undefined {
  const leftOfDash = typeLine.split('—')[0]!.trimEnd();
  if (leftOfDash.length === 0) return undefined;
  let cursor = 0;
  const words = leftOfDash.split(' ');
  let firstTypeWordIndex = 0;
  for (const word of words) {
    if (SUPERTYPES.has(word)) {
      firstTypeWordIndex += word.length + 1; // +1 for the space after it
      continue;
    }
    break;
  }
  cursor = firstTypeWordIndex;
  const end = leftOfDash.length;
  if (cursor >= end) return undefined; // typeLine was ONLY supertypes — never seen for real, but stay honest
  return { start: cursor, end };
}
