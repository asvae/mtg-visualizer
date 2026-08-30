<script setup lang="ts">
// Popup (reka-ui's Toast) for store.dataWarning — fires once whenever a
// scryfall-query load comes back truncated (matched more than the 500-card
// cap; see netlify/functions/cards.mts). Replaces what used to be a quiet
// header banner: easy to miss right after submitting a query, a popup is
// tied to the moment it actually matters.
import { inject, ref, watch } from 'vue';
import { ToastProvider, ToastPortal, ToastRoot, ToastTitle, ToastDescription, ToastClose, ToastViewport } from 'reka-ui';
import { StoreKey } from '../store';

const store = inject(StoreKey)!;
const open = ref(false);

watch(
  () => store.dataWarning.value,
  (msg) => {
    if (msg) open.value = true;
  }
);
</script>

<template>
  <ToastProvider :duration="8000">
    <ToastRoot v-model:open="open" class="toast-root">
      <ToastTitle class="toast-title">⚠ Query truncated</ToastTitle>
      <ToastDescription class="toast-desc">{{ store.dataWarning.value }}</ToastDescription>
      <ToastClose class="toast-close" aria-label="Dismiss">✕</ToastClose>
    </ToastRoot>
    <ToastPortal>
      <ToastViewport class="toast-viewport" />
    </ToastPortal>
  </ToastProvider>
</template>

<style scoped>
.toast-viewport {
  position: fixed;
  bottom: 16px;
  right: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 340px;
  max-width: 90vw;
  z-index: 1000;
  list-style: none;
  padding: 0;
  margin: 0;
}

.toast-root {
  position: relative;
  background: var(--panel);
  color: var(--text);
  border: 1px solid #3a3d4a;
  border-radius: 8px;
  padding: 12px 30px 12px 14px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
}

.toast-title {
  display: block;
  font-size: 13px;
  font-weight: 600;
  margin: 0 0 4px;
  color: #e0a030;
}

.toast-desc {
  display: block;
  font-size: 12px;
  color: var(--muted);
  line-height: 1.4;
}

.toast-close {
  position: absolute;
  top: 10px;
  right: 10px;
  background: transparent;
  border: none;
  color: var(--muted);
  cursor: pointer;
  font-size: 11px;
}

.toast-close:hover {
  color: var(--text);
}
</style>
