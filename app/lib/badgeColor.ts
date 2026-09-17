// Tiny shared helper for rendering a `UBadge` with an arbitrary literal hex
// background (the `/app/engine/*` console tabs' own status colors, e.g.
// gray/purple/blue/yellow/green/re-review — never a themed Nuxt UI `color`
// token) while keeping the label text legible against whichever hex it is.
// Extracted 2026-09-18 out of `EngineConsoleStatusHelp.vue` (its own
// original private copy) once the same computation was ALSO needed for the
// Predicates/Features/Sets detail-pane status badges — one shared home
// rather than three more copies of the same luminance math.

/** Relative-luminance check, generic over any hex — no per-color hardcoding,
 * so a future status color added to any `/app/engine/*` tab's `STATUS_OPTIONS`
 * gets a legible text color automatically. */
export function readableTextColor(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#111827' : '#f8fafc';
}

/** `:style` object for a `UBadge` (or any element) using a status option's
 * own literal hex as its background, with a legible text color computed via
 * `readableTextColor`. */
export function statusBadgeStyle(color: string): { background: string; color: string } {
  return { background: color, color: readableTextColor(color) };
}
