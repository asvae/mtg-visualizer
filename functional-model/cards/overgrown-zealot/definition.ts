import type { CardDefinition } from '../../card';

export const overgrownZealot: CardDefinition = {
  name: 'Overgrown Zealot',
  manaCost: '{1}{G}',
  typeLine: 'Creature — Elf Druid',
  pt: [0, 4],

  // Both are now real, structured `manaAbilities` entries (real Forge
  // citation, `res/cardsfolder/o/overgrown_zealot.txt`). The first
  // (`Produced$ Any`, no restriction) is genuinely payable via `mana.ts`'s
  // `canAfford`/`payMana` — same 5-color unrestricted shape blitzball's own
  // ability uses, creature so 302.6 summoning-sickness applies
  // (`engine.ts`'s `payableManaSources`). The second's own real
  // `RestrictValid$ Static.isTurnFaceUp` restriction (real printed "Spend
  // this mana only to turn permanents face up") is honestly typed but
  // deliberately unenforced (moot here regardless — no morph/face-down
  // mechanic is modeled anywhere either).
  manaAbilities: [
    { colors: ['W', 'U', 'B', 'R', 'G'] },
    { colors: ['W', 'U', 'B', 'R', 'G'], amount: 2, restriction: 'Spend this mana only to turn permanents face up.' },
  ],
};
