import type { Meta, StoryObj } from '@storybook/vue3-vite';
import CardRelations from './CardRelations.vue';

const meta: Meta<typeof CardRelations> = {
  title: 'Components/CardRelations',
  component: CardRelations,
};

export default meta;
type Story = StoryObj<typeof CardRelations>;

// The three weight levels stacked in one column — this is the "bar" element
// under discussion: three ascending bars per theme row, filled up to `weight`
// (1-3), meant to read as strength at a glance without a number.
export const WeightLevels: Story = {
  args: {
    columns: [
      {
        verb: 'Produces',
        color: 'var(--color-produce)',
        themes: [
          { label: 'Weight 1 (light)', weight: 1 },
          { label: 'Weight 2 (medium)', weight: 2 },
          { label: 'Weight 3 (strong)', weight: 3 },
        ],
      },
    ],
  },
};

// Same data, but marked "removed" (ReviewSession's relations-to-remove
// styling: dashed border, struck-through labels) — for comparing both states.
export const Removed: Story = {
  args: {
    ...WeightLevels.args,
    removed: true,
  },
};

// Multiple relation-type columns side by side, matching how a real card's
// tooltip/review panel actually renders more than one verb at once.
export const MultipleColumns: Story = {
  args: {
    columns: [
      {
        verb: 'Produces',
        color: 'var(--color-produce)',
        themes: [
          { label: 'Graveyard', weight: 3 },
          { label: 'Sacrifice', weight: 1 },
        ],
      },
      {
        verb: 'Consumes',
        color: 'var(--color-consume)',
        themes: [{ label: 'Artifacts', weight: 2 }],
      },
      {
        verb: 'Relates to',
        color: 'var(--color-atypical)',
        themes: [{ label: 'Landfall', weight: 1 }],
      },
    ],
  },
};
