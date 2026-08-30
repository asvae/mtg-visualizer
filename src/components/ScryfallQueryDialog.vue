<script setup lang="ts">
// Modal (reka-ui's Dialog — headless, gives us focus trap/Esc/ARIA for free)
// for entering the "sf" URL param that switches the whole app over to
// netlify/functions/cards.mts's query-scoped data source instead of the
// static per-set files (see store.ts's scryfallQuery). Submitting or clearing
// does a real navigation, not a client-side state change — SET_CODE and
// scryfallQuery in store.ts are fixed at module-load time, so switching the
// data source needs a fresh page load either way. `submitting` just covers the
// brief window between clicking Apply and the browser actually unloading this
// page, so the click registers as "working" instead of looking unresponsive.
import { ref } from 'vue';
import { DialogRoot, DialogPortal, DialogOverlay, DialogContent, DialogTitle, DialogDescription, DialogClose } from 'reka-ui';

const open = ref(false);
const query = ref('');
const submitting = ref(false);

function openDialog() {
  query.value = new URLSearchParams(window.location.search).get('sf') ?? '';
  submitting.value = false;
  open.value = true;
}

function submit(clear = false) {
  if (submitting.value) return;
  submitting.value = true;
  const q = clear ? '' : query.value.trim();
  window.location.href = q ? `/app/?sf=${encodeURIComponent(q)}` : '/app/';
}

defineExpose({ open: openDialog });
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="dialog-overlay" />
      <DialogContent class="dialog-content">
        <form @submit.prevent="submit()">
          <DialogTitle class="dialog-title">Scryfall query filter</DialogTitle>
          <DialogDescription class="dialog-desc">
            Any <a href="https://scryfall.com/docs/syntax" target="_blank" rel="noopener">Scryfall search syntax</a> — the
            graph rebuilds from just the matching cards (capped at 500) instead of the bundled set.
          </DialogDescription>
          <input
            v-model="query"
            type="text"
            placeholder="e.g. t:legendary c:red"
            autocomplete="off"
            autofocus
            :disabled="submitting"
          />
          <div class="actions">
            <DialogClose as-child>
              <button type="button" class="secondary" :disabled="submitting">Cancel</button>
            </DialogClose>
            <button type="button" class="secondary" :disabled="submitting" @click="submit(true)">Clear filter</button>
            <button type="submit" class="primary" :disabled="submitting">
              <span v-if="submitting" class="spinner" aria-hidden="true"></span>
              {{ submitting ? 'Applying…' : 'Apply' }}
            </button>
          </div>
        </form>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<style scoped>
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 900;
}

.dialog-content {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: var(--panel);
  color: var(--text);
  border: 1px solid #3a3d4a;
  border-radius: 8px;
  padding: 16px 20px;
  width: min(440px, 90vw);
  z-index: 901;
}

.dialog-title {
  margin: 0 0 8px;
  font-size: 15px;
  font-weight: 600;
}

.dialog-desc {
  margin: 0 0 12px;
  font-size: 12px;
  color: var(--muted);
  line-height: 1.4;
}

.dialog-desc a {
  color: var(--text);
}

input {
  width: 100%;
  box-sizing: border-box;
  background: #14151a;
  color: var(--text);
  border: 1px solid #3a3d4a;
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 13px;
}

input:focus {
  outline: none;
  border-color: #6c7086;
}

input:disabled {
  opacity: 0.6;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 14px;
}

button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  border: 1px solid #3a3d4a;
}

button:disabled {
  cursor: default;
  opacity: 0.7;
}

button.secondary {
  background: #2a2c36;
  color: var(--text);
}

button.secondary:hover:not(:disabled) {
  background: #33364280;
}

button.primary {
  background: var(--produce);
  color: #0d0e12;
  border-color: transparent;
  font-weight: 600;
}

button.primary:hover:not(:disabled) {
  filter: brightness(1.1);
}

.spinner {
  width: 11px;
  height: 11px;
  border: 2px solid rgba(13, 14, 18, 0.35);
  border-top-color: #0d0e12;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
