import type { Meta, StoryObj } from '@storybook/vue3-vite';
import MtgIcon from './MtgIcon.vue';

const meta: Meta<typeof MtgIcon> = {
  title: 'Components/MtgIcon',
  component: MtgIcon,
};

export default meta;
type Story = StoryObj<typeof MtgIcon>;

// ICON_DEFS is currently empty (see MtgIcon.vue) — every mana-font
// keyword-ability/counter/stat icon that was tried has since been reverted,
// so any name at all just falls through to this same plain-text fallback,
// brackets stripped. One story is all there is to show right now; re-add a
// gallery-style story here if a real icon ever gets added back.
export const Fallback: Story = { args: { name: 'vigilance' } };
