import type { Meta, StoryObj } from '@storybook/vue3-vite';
import MtgIcon from './MtgIcon.vue';

const meta: Meta<typeof MtgIcon> = {
  title: 'Components/MtgIcon',
  component: MtgIcon,
};

export default meta;
type Story = StoryObj<typeof MtgIcon>;

export const Tapped: Story = { args: { name: 'tapped' } };
// "tap" resolves to the same icon as "tapped" — same word, different
// grammatical form a card might need (see MtgIcon.vue's ICON_DEFS).
export const Tap: Story = { args: { name: 'tap' } };
export const Landfall: Story = { args: { name: 'Landfall' } };
export const Trample: Story = { args: { name: 'trample' } };
export const Flash: Story = { args: { name: 'flash' } };
export const Lifelink: Story = { args: { name: 'lifelink' } };
export const Flashback: Story = { args: { name: 'flashback' } };
export const Counter: Story = { args: { name: 'counter' } };
export const Stun: Story = { args: { name: 'stun' } };
export const Power: Story = { args: { name: 'power' } };
export const Vigilance: Story = { args: { name: 'vigilance' } };
export const Indestructible: Story = { args: { name: 'indestructible' } };
export const Ward: Story = { args: { name: 'ward' } };
export const Hexproof: Story = { args: { name: 'hexproof' } };
export const Crew: Story = { args: { name: 'crew' } };
export const Reach: Story = { args: { name: 'reach' } };

// No entry in ICON_DEFS -> renders as its own plain text, brackets stripped
// (a typo, or a real word just pending an icon — see MtgIcon.vue).
export const UnknownName: Story = { args: { name: 'not-a-real-icon' } };

// Every icon this component supports, inline with text the way it actually
// appears in card shorthand notation (see CARD_SHORTHAND.md) — a quick way
// to eyeball that they all share the same size/alignment.
export const AllIcons: Story = {
  render: () => ({
    components: { MtgIcon },
    template: `
      <p style="font-size: 14px; line-height: 1.6;">
        Tapped <MtgIcon name="tapped" /> &mdash;
        Landfall <MtgIcon name="Landfall" /> &mdash;
        Trample <MtgIcon name="trample" /> &mdash;
        Flash <MtgIcon name="flash" /> &mdash;
        Lifelink <MtgIcon name="lifelink" /> &mdash;
        Flashback <MtgIcon name="flashback" /> &mdash;
        Counter <MtgIcon name="counter" /> &mdash;
        Stun <MtgIcon name="stun" /> &mdash;
        Power <MtgIcon name="power" /> &mdash;
        Vigilance <MtgIcon name="vigilance" /> &mdash;
        Indestructible <MtgIcon name="indestructible" /> &mdash;
        Ward <MtgIcon name="ward" /> &mdash;
        Hexproof <MtgIcon name="hexproof" /> &mdash;
        Crew <MtgIcon name="crew" /> &mdash;
        Reach <MtgIcon name="reach" />
      </p>
    `,
  }),
};
