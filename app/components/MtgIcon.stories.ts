import type { Meta, StoryObj } from '@storybook/vue3-vite';
import MtgIcon from './MtgIcon.vue';

const meta: Meta<typeof MtgIcon> = {
  title: 'Components/MtgIcon',
  component: MtgIcon,
};

export default meta;
type Story = StoryObj<typeof MtgIcon>;

// Every icon MtgIcon.vue's ICON_DEFS supports, in one grid — not one story
// per icon. "tap" is included alongside "tapped" since they're two words
// for the same icon (see ICON_DEFS), a distinct case worth eyeballing.
const NAMES = [
  'tap',
  'tapped',
  'landfall',
  'trample',
  'flash',
  'lifelink',
  'flashback',
  'counter',
  'stun',
  'power',
  'vigilance',
  'indestructible',
  'ward',
  'hexproof',
  'crew',
  'reach',
  'sorcery speed only',
  'first strike',
  'deathtouch',
  'haste',
  'menace',
  'double strike',
  'prowess',
  'cycling',
  'surveil',
  'kicker',
  'charge',
];

export const AllIcons: Story = {
  render: () => ({
    components: { MtgIcon },
    setup: () => ({ names: NAMES }),
    template: `
      <div style="display: flex; flex-wrap: wrap; gap: 8px 16px; font-size: 14px; line-height: 1.6;">
        <span v-for="name in names" :key="name">{{ name }} <MtgIcon :name="name" /></span>
      </div>
    `,
  }),
};

// No entry in ICON_DEFS -> renders as its own plain text, brackets stripped
// (a typo, or a real word just pending an icon — see MtgIcon.vue).
export const UnknownName: Story = { args: { name: 'not-a-real-icon' } };
