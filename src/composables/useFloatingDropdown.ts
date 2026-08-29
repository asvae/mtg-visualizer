import { autoUpdate, computePosition, flip, offset, shift } from '@floating-ui/dom';
import { watch, onBeforeUnmount, type Ref } from 'vue';

// Positions a dropdown panel relative to its toggle button, auto-flipping to
// whichever side actually fits and nudging (shift) to stay clear of the viewport
// edges — replaces hand-rolled edge-clamping with the same collision-detection
// approach floating-ui uses everywhere. `strategy: 'fixed'` sidesteps having to
// reason about offset-parent nesting: coordinates are always viewport-relative,
// matching the panel's `position: fixed` in CSS.
export function useFloatingDropdown(referenceEl: Ref<HTMLElement | null>, floatingEl: Ref<HTMLElement | null>, open: Ref<boolean>) {
  let stopAutoUpdate: (() => void) | null = null;

  function updatePosition() {
    if (!referenceEl.value || !floatingEl.value) return;
    computePosition(referenceEl.value, floatingEl.value, {
      strategy: 'fixed',
      placement: 'bottom-end',
      middleware: [offset(8), flip(), shift({ padding: 8 })],
    }).then(({ x, y }) => {
      if (!floatingEl.value) return;
      floatingEl.value.style.left = `${x}px`;
      floatingEl.value.style.top = `${y}px`;
    });
  }

  watch(open, (isOpen) => {
    stopAutoUpdate?.();
    stopAutoUpdate = null;
    if (isOpen && referenceEl.value && floatingEl.value) {
      stopAutoUpdate = autoUpdate(referenceEl.value, floatingEl.value, updatePosition);
    }
  });

  onBeforeUnmount(() => stopAutoUpdate?.());
}
