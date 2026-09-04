import type { CardDefinition, Effect, EffectContext } from '../../card';

// Real `SVar:X:Count$ValidGraveyard Permanent.YouOwn` — a live count of
// permanent cards in your own graveyard, read fresh at activation. `Card`
// (interfaces.ts) has no single "isPermanent()" predicate, so this composes
// the four permanent-type checks it DOES expose (isCreature/isArtifact/
// isEnchantment/isLand) — a `Computed<number>` field, same narrow-escape-
// hatch scope Beza's own cross-player comparison already established.
const permanentsInYourGraveyard = (ctx: EffectContext) =>
  ctx.you.getCardsIn('Graveyard').filter((c) => c.isCreature() || c.isArtifact() || c.isEnchantment() || c.isLand()).length;

export const granPulseOchu: CardDefinition = {
  name: 'Gran Pulse Ochu',
  manaCost: '{G}',
  typeLine: 'Creature — Plant Beast',

  pt: [1, 1],
  keywords: ['Deathtouch'],

  activationCost: '{8}',
  effects: [{ kind: 'pumpSelf', power: permanentsInYourGraveyard, toughness: permanentsInYourGraveyard } satisfies Effect],
};
