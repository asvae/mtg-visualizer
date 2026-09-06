import type { Meta, StoryObj } from '@storybook/vue3-vite';
import AbilityIcon from './AbilityIcon.vue';
import { ABILITY_ICON_NAMES, ABILITY_ICON_PATHS } from '../lib/abilityIconPaths';

const meta: Meta<typeof AbilityIcon> = {
  title: 'Components/AbilityIcon',
  component: AbilityIcon,
};

export default meta;
type Story = StoryObj<typeof AbilityIcon>;

const ALL_KEYWORDS = Array.from(ABILITY_ICON_NAMES);

export const AllKeywords: Story = {
  render: () => ({
    components: { AbilityIcon },
    setup: () => ({ keywords: ALL_KEYWORDS }),
    template: `
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 20px;">
        <div v-for="kw in keywords" :key="kw" style="display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 12px; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-panel);">
          <AbilityIcon :keyword="kw" :size="32" />
          <span style="font-size: 11px; color: var(--color-muted); text-align: center;">{{ kw }}</span>
        </div>
      </div>
    `,
  }),
};

export const AtBadgeSize: Story = {
  render: () => ({
    components: { AbilityIcon },
    setup: () => ({ keywords: ALL_KEYWORDS }),
    template: `
      <div style="display: flex; flex-wrap: wrap; gap: 8px; color: var(--color-text);">
        <span v-for="kw in keywords" :key="kw" :title="kw" style="display: inline-flex; padding: 1px; border-radius: 3px; background: var(--color-surface);">
          <AbilityIcon :keyword="kw" :size="14" />
        </span>
      </div>
    `,
  }),
};

export const UnknownKeyword: Story = { args: { keyword: 'NotARealKeyword' } };

// History: source SVGs (viewBox 0 0 140 120) only use ~47%/55% of their
// canvas for ink, reading tiny at badge size — fixed by cropping. A single
// shared crop then left some icons visibly off-center (each glyph's own ink
// bbox center differs by up to ~10 units). AbilityIcon.vue now centers each
// keyword on its own bbox (ABILITY_ICON_VIEWBOX). This story keeps the
// before/after side by side as a regression check.
const SHARED_VIEWBOX = '33 19 74 75';
const SAMPLE_KEYWORDS = ['Flying', 'Ward', 'Convoke', 'ActivatedAbility', 'Vigilance', 'Menace', 'Ascend', 'DoubleStrike'];
const SIZES = [14, 20, 32];

export const BadgeScaling: Story = {
  render: () => ({
    components: { AbilityIcon },
    setup: () => ({ keywords: SAMPLE_KEYWORDS, sizes: SIZES, shared: SHARED_VIEWBOX, ABILITY_ICON_PATHS }),
    template: `
      <div style="display: flex; flex-direction: column; gap: 24px; color: var(--color-text);">
        <div v-for="kw in keywords" :key="kw">
          <div style="font-size: 12px; color: var(--color-muted); margin-bottom: 6px;">{{ kw }}</div>
          <div style="display: flex; align-items: flex-end; gap: 28px;">
            <div v-for="s in sizes" :key="'shared-' + s" style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
              <span
                :style="{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: s + 'px', height: s + 'px', padding: '1px', borderRadius: '3px', background: 'var(--color-surface)', outline: '1px dashed var(--color-border)' }"
              >
                <svg :width="s" :height="s" :viewBox="shared" fill="currentColor">
                  <path :d="ABILITY_ICON_PATHS[kw]" fill-rule="evenodd" />
                </svg>
              </span>
              <span style="font-size: 9px; color: var(--color-muted);">shared {{ s }}px</span>
            </div>
            <div v-for="s in sizes" :key="'percon-' + s" style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
              <span
                :style="{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: s + 'px', height: s + 'px', padding: '1px', borderRadius: '3px', background: 'var(--color-surface)', outline: '1px dashed var(--color-border)' }"
              >
                <AbilityIcon :keyword="kw" :size="s" />
              </span>
              <span style="font-size: 9px; color: var(--color-muted);">per-icon {{ s }}px</span>
            </div>
          </div>
        </div>
        <div style="font-size: 11px; color: var(--color-muted);">
          Dashed box = badge container bounds. Left group = old shared crop (viewBox {{ shared }} for every icon). Right group = current AbilityIcon, each keyword centered on its own bbox.
        </div>
      </div>
    `,
  }),
};
