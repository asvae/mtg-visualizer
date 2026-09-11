import type { CardDefinition, Effect } from '../../card';

// "Tiered" (choose one additional cost) maps onto the real "choose one —"
// `modal` shape Battle Menu/Fire Magic already use — each tier is a real,
// mutually exclusive branch, same as a modal spell's own modes. "Tiered"
// itself isn't a recognized `Keyword` (not a real, resolution-affecting
// keyword like Flying/Lifelink), so it stays implicit in each mode's own
// `describe` rather than added to `keywords` — same treatment Fire Magic/
// Ice Magic's own Tiered already got. Unlike those two, this card's three
// tiers don't branch into genuinely DIFFERENT effects — Cure/Cura/Curaga
// are one real escalating effect (same hexproof+indestructible grant,
// widening SCOPE from a single chosen permanent to every permanent you
// control, plus a lifegain bonus at the two higher tiers) — `modal` is
// still the right shape (real per-mode cost/text), just modeled as one
// scaling idea rather than 3 unrelated modes.
//
// `grantKeywordTarget`'s `validType: 'any'` (Cure/Cura's own real "Target
// permanent" — any permanent, not creature-only) and `grantKeywordAll`'s
// `predicate: 'permanents-you-control'` (Curaga's own real "Permanents you
// control") are both NEW engine vocabulary added for this card (card.ts,
// 2026-09-12) — until now every `grantKeywordTarget`/`grantKeywordAll` call
// in the pool only ever needed a creature-only pool, so `validType`/
// `predicate` had no 'any'/'permanents' branch actually wired in the
// `applyEffect` switch (a real, previously-unnoticed gap: `validType` was
// declared in the `Effect` union's own type but silently ignored at
// runtime). Both are safe, additive fixes — `validType` defaults to
// 'creature' when omitted (every existing caller's behavior is unchanged),
// and `'permanents-you-control'` is a new predicate value alongside the
// original 'creatures-you-control', not a replacement.
//
// Two separate `grantKeywordTarget`/`grantKeywordAll` calls per tier (one
// per keyword) rather than one call granting both — no Effect kind grants
// more than one keyword at once. `chooseTarget`'s own deterministic
// "always pick pool[0]" behavior (see Coral Sword's own definition.ts
// comment for the same pattern) means both Cure/Cura grants land on the
// SAME chosen permanent, matching Forge's real `Defined$ Targeted` (the
// second effect targeting whatever the first one targeted) rather than
// two independent targeting decisions.
export const restorationMagic: CardDefinition = {
  name: 'Restoration Magic',
  manaCost: '{W}',
  typeLine: 'Instant',

  effects: [
    {
      kind: 'modal',
      modes: [
        {
          describe: 'Cure — {0} — Target permanent gains hexproof and indestructible until end of turn.',
          effects: [
            { kind: 'grantKeywordTarget', keyword: 'Hexproof', validType: 'any' } satisfies Effect,
            { kind: 'grantKeywordTarget', keyword: 'Indestructible', validType: 'any' } satisfies Effect,
          ],
        },
        {
          describe: 'Cura — {1} — Target permanent gains hexproof and indestructible until end of turn. You gain 3 life.',
          effects: [
            { kind: 'grantKeywordTarget', keyword: 'Hexproof', validType: 'any' } satisfies Effect,
            { kind: 'grantKeywordTarget', keyword: 'Indestructible', validType: 'any' } satisfies Effect,
            { kind: 'gainLife', amount: 3 } satisfies Effect,
          ],
        },
        {
          describe: 'Curaga — {3}{W} — Permanents you control gain hexproof and indestructible until end of turn. You gain 6 life.',
          effects: [
            { kind: 'grantKeywordAll', predicate: 'permanents-you-control', keyword: 'Hexproof' } satisfies Effect,
            { kind: 'grantKeywordAll', predicate: 'permanents-you-control', keyword: 'Indestructible' } satisfies Effect,
            { kind: 'gainLife', amount: 6 } satisfies Effect,
          ],
        },
      ],
    } satisfies Effect,
  ],
};
