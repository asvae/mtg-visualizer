import type { Meta, StoryObj } from '@storybook/vue3-vite';
import ManaSymbol from './ManaSymbol.vue';

const meta: Meta<typeof ManaSymbol> = {
  title: 'Components/ManaSymbol',
  component: ManaSymbol,
};

export default meta;
type Story = StoryObj<typeof ManaSymbol>;

export const Tap: Story = { args: { code: 'T' } };
export const Untap: Story = { args: { code: 'Q' } };
export const Generic: Story = { args: { code: '3' } };
export const Colorless: Story = { args: { code: 'C' } };
export const White: Story = { args: { code: 'W' } };
export const Blue: Story = { args: { code: 'U' } };
export const Black: Story = { args: { code: 'B' } };
export const Red: Story = { args: { code: 'R' } };
export const Green: Story = { args: { code: 'G' } };
export const Snow: Story = { args: { code: 'S' } };
export const Energy: Story = { args: { code: 'E' } };
export const Variable: Story = { args: { code: 'X' } };
export const Hybrid: Story = { args: { code: 'W/U' } };
export const Phyrexian: Story = { args: { code: 'W/P' } };
export const PhyrexianHybrid: Story = { args: { code: 'B/G/P' } };
export const TwoGenericHybrid: Story = { args: { code: '2/W' } };

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
