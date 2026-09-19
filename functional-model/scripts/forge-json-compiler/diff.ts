/**
 * Structural diff shared between `run-experiment.ts` (this tool's own
 * standalone CLI runner) and `server/utils/forgeJsonCompiler.ts` (the card
 * page's "Forge Compiler" dev tab) — lifted out of `run-experiment.ts` so
 * neither has to hand-copy the other's logic. Key-order-insensitive, reports
 * every leaf mismatch with a JSON-path-like breadcrumb.
 */

type Json = unknown;

export function structuralDiff(actual: Json, expected: Json, path = '$', out: string[] = []): string[] {
  if (Array.isArray(expected) || Array.isArray(actual)) {
    if (!Array.isArray(actual) || !Array.isArray(expected)) {
      out.push(`${path}: array-ness differs (compiled=${JSON.stringify(actual)} authored=${JSON.stringify(expected)})`);
      return out;
    }
    if (actual.length !== expected.length) out.push(`${path}: length ${actual.length} vs authored ${expected.length}`);
    for (let i = 0; i < Math.max(actual.length, expected.length); i++) structuralDiff(actual[i], expected[i], `${path}[${i}]`, out);
    return out;
  }
  if (expected !== null && typeof expected === 'object' && actual !== null && typeof actual === 'object') {
    const keys = new Set([...Object.keys(actual as object), ...Object.keys(expected as object)]);
    for (const k of [...keys].sort()) {
      const a = (actual as Record<string, Json>)[k];
      const e = (expected as Record<string, Json>)[k];
      if (!(k in (actual as object))) { out.push(`${path}.${k}: MISSING from compiled (authored=${JSON.stringify(e)})`); continue; }
      if (!(k in (expected as object))) { out.push(`${path}.${k}: EXTRA in compiled (=${JSON.stringify(a)})`); continue; }
      structuralDiff(a, e, `${path}.${k}`, out);
    }
    return out;
  }
  if (typeof actual === 'function' || typeof expected === 'function') {
    if (typeof actual !== typeof expected) out.push(`${path}: ${typeof actual} vs authored ${typeof expected}`);
    return out;
  }
  if (actual !== expected) out.push(`${path}: ${JSON.stringify(actual)} vs authored ${JSON.stringify(expected)}`);
  return out;
}
