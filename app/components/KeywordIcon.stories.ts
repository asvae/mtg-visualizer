import type { Meta, StoryObj } from '@storybook/vue3-vite';
import KeywordIcon from './KeywordIcon.vue';

const meta: Meta<typeof KeywordIcon> = {
  title: 'Components/KeywordIcon',
  component: KeywordIcon,
};

export default meta;
type Story = StoryObj<typeof KeywordIcon>;

// Every keyword functional-model card definitions actually use today (see
// this file's own sibling KeywordIcon.vue for the full PATHS map) — one
// grid, label under each icon, so a mismatch (wrong glyph for the name) is
// obvious at a glance.
const ALL_KEYWORDS = [
  'Flying',
  'Reach',
  'Trample',
  'Vigilance',
  'Deathtouch',
  'Lifelink',
  'FirstStrike',
  'DoubleStrike',
  'Haste',
  'Menace',
  'Unblockable',
  'Ward',
  'Hexproof',
  'Indestructible',
  'Defender',
  'Flash',
  'Convoke',
];

export const AllKeywords: Story = {
  render: () => ({
    components: { KeywordIcon },
    setup: () => ({ keywords: ALL_KEYWORDS }),
    template: `
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 20px;">
        <div v-for="kw in keywords" :key="kw" style="display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 12px; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-panel);">
          <KeywordIcon :keyword="kw" :size="28" />
          <span style="font-size: 11px; color: var(--color-muted); text-align: center;">{{ kw }}</span>
        </div>
      </div>
    `,
  }),
};

// At the actual size/color it'll render at on a card chip (scenario replay
// board) — a small badge, muted color, not the oversized review grid above.
export const AtBadgeSize: Story = {
  render: () => ({
    components: { KeywordIcon },
    setup: () => ({ keywords: ALL_KEYWORDS }),
    template: `
      <div style="display: flex; flex-wrap: wrap; gap: 8px; color: var(--color-text);">
        <span v-for="kw in keywords" :key="kw" :title="kw" style="display: inline-flex; padding: 3px; border-radius: 3px; background: var(--color-surface);">
          <KeywordIcon :keyword="kw" :size="14" />
        </span>
      </div>
    `,
  }),
};

export const UnknownKeyword: Story = { args: { keyword: 'NotARealKeyword' } };
