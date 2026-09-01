import type { Meta, StoryObj } from '@storybook/vue3-vite';
import ManaSymbol from './ManaSymbol.vue';

const meta: Meta<typeof ManaSymbol> = {
  title: 'Components/ManaSymbol',
  component: ManaSymbol,
};

export default meta;
type Story = StoryObj<typeof ManaSymbol>;

// A representative spread of what data/mana_symbols/manifest.json covers —
// not exhaustive (84 symbols total), just enough to eyeball that every
// category renders: tap/untap, generic, colors, colorless, snow, energy,
// variable, hybrid, phyrexian, phyrexian-hybrid, generic-hybrid.
const SAMPLE_CODES = ['T', 'Q', '3', 'C', 'W', 'U', 'B', 'R', 'G', 'S', 'E', 'X', 'W/U', 'W/P', 'B/G/P', '2/W'];

export const AllSymbols: Story = {
  render: () => ({
    components: { ManaSymbol },
    setup: () => ({ codes: SAMPLE_CODES }),
    template: `
      <div style="display: flex; flex-wrap: wrap; gap: 12px; font-size: 20px;">
        <span v-for="code in codes" :key="code" :title="code"><ManaSymbol :code="code" /></span>
      </div>
    `,
  }),
};

// No entry in manifest.json (a typo, or a genuinely new Scryfall symbol —
// re-run `npm run fetch:mana-symbols` if so) -> renders the literal
// "{code}" text instead of vanishing, braces included (unlike MtgIcon.vue's
// bracket-stripped fallback — braces here are the real oracle-text syntax,
// not decorative).
export const UnknownCode: Story = { args: { code: 'not-a-real-symbol' } };

// A line the way it actually appears in card shorthand notation (see
// CARD_SHORTHAND.md), mixing several symbols inline with text.
export const InlineText: Story = {
  render: () => ({
    components: { ManaSymbol },
    template: `
      <p style="font-size: 16px; line-height: 1.6;">
        <ManaSymbol code="T" />: Add <ManaSymbol code="C" />.
        Cost: <ManaSymbol code="2" /><ManaSymbol code="W" /><ManaSymbol code="W" />
      </p>
    `,
  }),
};
