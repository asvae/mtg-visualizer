/**
 * Renders a `compileForgeCard`-produced `CardDefinition` object into real
 * TypeScript source matching `fdn-cards/<slug>/definition.ts`'s own
 * established export convention (`import type { CardDefinition, Effect }
 * from '../../card'; export const <exportName>: CardDefinition = {...};`)
 * — the missing "write the compiler's own output to disk as a real
 * fdn-cards definition" step of the FDN authoring pipeline (2026-09-19,
 * the same day this compiler itself was promoted out of `scripts/
 * experiments/`).
 *
 * Deliberately literal: every value here is exactly what `compileForgeCard`
 * returned, serialized with no cleverness layered on top (no attempt to
 * fold a `createToken` token literal that happens to structurally match a
 * `functional-model/tokens.ts` `TOKENS` registry entry back into a
 * `TOKENS.<key>` reference, even though a couple of real hand-authored
 * files in this pool do that for DRY-ness — that's a human/AI authoring
 * choice this compiler has no concept of, not something "the compiler's
 * own output" can honestly claim to reproduce).
 *
 * `Effect`-shaped object literals (both `CardDefinition.effects` and each
 * `Trigger.effects` entry) get a real `satisfies Effect` suffix, matching
 * every existing hand-authored file's own convention — this is the ONE
 * piece of real syntax knowledge this renderer has beyond plain
 * `JSON.stringify`-style serialization.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import type { CardDefinition, Effect } from '../../card';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Real function VALUES this compiler ever emits (`Effect.kind:'custom'.run`
 * — a `custom` effect's whole real behavior IS a function body, the ONE
 * non-plain-data shape anywhere in a `compileForgeCard` return) get their
 * REAL TypeScript SOURCE TEXT here — extracted directly off THIS repo's own
 * `compile-forge-card.ts` via the TypeScript compiler API, keyed by the
 * closure's own sibling `describe` string (a real, already-vetted per-effect
 * identity this compiler's own translation tables never invent two of).
 *
 * Deliberately NOT `Function.prototype.toString()`: under `vite-node`
 * (esbuild-transpiled at runtime) that reflects the COMPILED JS, not the
 * original TypeScript — double-quoted strings, stripped type annotations,
 * tab indentation, none of which matches this pool's own real hand-authored
 * convention (single-quoted, 2-space, fully typed). Reading the real
 * `.ts` source instead is a single source of truth with zero drift risk:
 * the emitted literal is IDENTICAL to what `compile-forge-card.ts` itself
 * defines and type-checks, not a re-derivation of it.
 */
let cachedCustomEffectRunSources: Map<string, string> | undefined;
function loadCustomEffectRunSources(): Map<string, string> {
  if (cachedCustomEffectRunSources) return cachedCustomEffectRunSources;
  const filePath = resolve(__dirname, 'compile-forge-card.ts');
  const text = readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true);
  const map = new Map<string, string>();
  const visit = (node: ts.Node): void => {
    if (ts.isObjectLiteralExpression(node)) {
      const describeProp = node.properties.find(
        (p): p is ts.PropertyAssignment => ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === 'describe',
      );
      const runProp = node.properties.find(
        (p): p is ts.PropertyAssignment => ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === 'run',
      );
      if (describeProp !== undefined && runProp !== undefined && ts.isStringLiteralLike(describeProp.initializer)) {
        map.set(describeProp.initializer.text, runProp.initializer.getText(sourceFile));
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  cachedCustomEffectRunSources = map;
  return map;
}

/** `pad` is the CURRENT line's own indent (spaces) — re-indents a multi-line source snippet (already dedented to column 0 by `getText`'s own leading-whitespace-stripped first line, real body lines keep their RELATIVE indentation) onto `pad`. */
function reindentSource(src: string, pad: number): string {
  const lines = src.split('\n');
  if (lines.length === 1) return src;
  const bodyLines = lines.slice(1);
  const indents = bodyLines.filter((l) => l.trim().length > 0).map((l) => /^\s*/.exec(l)![0].length);
  const minIndent = indents.length > 0 ? Math.min(...indents) : 0;
  const reindented = [lines[0], ...bodyLines.map((l) => (l.trim().length > 0 ? ' '.repeat(pad) + l.slice(minIndent) : ''))];
  return reindented.join('\n');
}

/**
 * `run: <function>` inside an `Effect.kind:'custom'` object literal —
 * looked up by that SAME object's own sibling `describe` string (see
 * `loadCustomEffectRunSources`'s own doc comment). Throws, honestly, for
 * any function value this lookup doesn't recognize — the same "throw on
 * anything unhandled rather than approximate" discipline
 * `compile-forge-card.ts` itself follows; extend that lookup (not this
 * function) the day a second real custom-effect closure needs serializing.
 */
function serializeCustomEffectRun(describe: unknown, pad: number): string {
  if (typeof describe !== 'string') throw new Error(`write-fdn-definition: Effect.kind:'custom' with a function 'run' but no string 'describe' to key its source lookup on`);
  const source = loadCustomEffectRunSources().get(describe);
  if (source === undefined) throw new Error(`write-fdn-definition: no known real TypeScript source for a custom effect's 'run' function (describe: ${JSON.stringify(describe)}) — add it to compile-forge-card.ts's own describe/run object-literal shape, or extend loadCustomEffectRunSources`);
  return reindentSource(source, pad);
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function isIdentifier(key: string): boolean {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key);
}

function quoteKey(key: string): string {
  return isIdentifier(key) ? key : JSON.stringify(key);
}

function quoteString(s: string): string {
  // Single-quoted, matching this pool's own real convention (checked
  // directly against multiple real fdn-cards/ files) — escapes a literal
  // `'` or `\` only, never over-escapes.
  return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function isPrimitiveArray(arr: unknown[]): boolean {
  return arr.every((v) => v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean');
}

/** `pad` is the CURRENT line's own indent (spaces); nested content is rendered at `pad + 2`. `effectContext` is true exactly when serializing an ARRAY ELEMENT that is itself an `Effect` (both `CardDefinition.effects[i]` and `Trigger.effects[i]`) — the one place a real `satisfies Effect` suffix is added. */
function serializeValue(value: unknown, pad: number, effectContext: boolean): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return quoteString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'function') throw new Error(`write-fdn-definition: a bare function value must be serialized via serializeCustomEffectRun (its sibling 'describe' key), never generically`);
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    if (isPrimitiveArray(value)) return `[${value.map((v) => serializeValue(v, pad, false)).join(', ')}]`;
    const inner = pad + 2;
    const items = value.map((v) => `${' '.repeat(inner)}${serializeValue(v, inner, effectContext)},`).join('\n');
    return `[\n${items}\n${' '.repeat(pad)}]`;
  }
  if (isPlainObject(value)) {
    const keys = Object.keys(value);
    if (keys.length === 0) return '{}';
    const inner = pad + 2;
    const lines = keys.map((k) => {
      const isEffectsKey = k === 'effects';
      const v = k === 'run' && typeof value[k] === 'function' ? serializeCustomEffectRun(value['describe'], inner) : serializeValue(value[k], inner, isEffectsKey);
      return `${' '.repeat(inner)}${quoteKey(k)}: ${v},`;
    });
    const suffix = effectContext ? ' satisfies Effect' : '';
    return `{\n${lines.join('\n')}\n${' '.repeat(pad)}}${suffix}`;
  }
  throw new Error(`write-fdn-definition: cannot serialize value of type ${typeof value}: ${JSON.stringify(value)}`);
}

/** True iff `definition` (or any nested `Trigger`) has at least one real `Effect` object anywhere — the `Effect` type import is omitted entirely when false (sire-of-seven-deaths, a pure-keywords vanilla-with-Ward card, is the real precedent: its own hand file imports only `CardDefinition`). */
function usesEffectType(definition: CardDefinition): boolean {
  if (Array.isArray(definition.effects) && definition.effects.length > 0) return true;
  if (Array.isArray(definition.triggers)) {
    for (const t of definition.triggers) {
      if (Array.isArray(t.effects) && t.effects.length > 0) return true;
    }
  }
  return false;
}

/**
 * Renders the complete `definition.ts` source text for one card —
 * `exportName`/`definition` both required, real (never inferred/guessed
 * here); the caller (this compiler's own case table, `fdn-1-50-cases.ts`)
 * already carries the real, checked export name for every card this
 * applies to.
 */
export function renderDefinitionFile(definition: CardDefinition, exportName: string): string {
  const importLine = usesEffectType(definition)
    ? `import type { CardDefinition, Effect } from '../../card';`
    : `import type { CardDefinition } from '../../card';`;
  const body = serializeValue(definition, 0, false);
  return `${importLine}\n\nexport const ${exportName}: CardDefinition = ${body};\n`;
}
