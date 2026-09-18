// Read-only source-extraction for the `/app/engine/schema` reference page —
// slices exactly the type/interface declarations that make up a card's
// authoring schema (rooted at `CardDefinition`) straight out of the real,
// doc-comment-heavy `card.ts` (plus `TokenInfo` from `interfaces.ts`, the
// one referenced type declared elsewhere) rather than hand-copying a
// parallel description that would drift out of sync. NEVER writes to
// `card.ts` — read-only, same "re-resolve from disk on every call, no
// caching" dev convention `source-files.ts`'s own header already
// establishes for this console's other evidence-viewing routes.
//
// Extraction is a small brace/comment-aware text scanner, not a real TS
// parser (no `typescript` package dependency pulled in for this) — walks
// each top-level (column-0) `type NAME` / `interface NAME` declaration,
// tracks `{`/`(`/`[` depth while skipping `//` / `/* */` / string-literal
// content, and finds the real end of the statement: the closing `}` for an
// interface, or the depth-0 terminating `;` for a type alias — the latter
// matters because `Effect` itself is one huge multi-line union of
// object-literal variants with no single wrapping brace, so "next `}` at
// column 0" alone would stop at the wrong variant. Leading doc/comment
// lines directly above a declaration (no blank-line gap) are captured too
// via a simple backward scan — the real payoff of reading this out of the
// live file: every field's real Forge/CR citation stays attached to its
// own section instead of being summarized away.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface CardSchemaTypeEntry {
  name: string;
  /** Repo-root-relative, e.g. `"functional-model/card.ts"`. */
  file: string;
  /** Real source text — leading comment block (if any, directly above with no blank-line gap) plus the full declaration, verbatim. `null` iff `found` is `false`. */
  source: string | null;
  /**
   * `false` iff the scanner couldn't locate/balance this declaration by name
   * in `file` on this run (e.g. it was renamed in `card.ts`) — surfaced
   * visibly on the reference page rather than silently vanishing from the
   * list, per this project's own "no silent failure" posture elsewhere
   * (annotation resolution, etc.).
   */
  found: boolean;
}

// Rendered in THIS order, not file order: `CardDefinition` first (the
// schema's own root, per this page's brief), then every other declaration
// `card.ts` itself reaches, in the order the file declares them (the file
// already reads top-to-bottom as a natural build-up toward
// `CardDefinition`, so keeping that relative order for the "everything
// else" tail avoids an arbitrary second sort).
const CARD_TS_NAMES = [
  'CardDefinition',
  'AuthoredFact',
  'Actions',
  'EffectContext',
  'Computed',
  'EffectOwner',
  'Effect',
  'AlternateCost',
  'CostReduction',
  'ActivationCostReduction',
  'SpellCostReductionGrant',
  'MillModifierGrant',
  'ManaAbility',
  'CounterConditionalGrant',
  'Trigger',
  'Keyword',
  'ContinuousGrantTargeting',
  'TriggerDoublingGrant',
  'BattlefieldValidType',
] as const;

// `TokenInfo` is the one referenced type genuinely NOT declared in
// `card.ts` (it's `import type`'d from `interfaces.ts`) — rendered last.
const INTERFACES_TS_NAMES = ['TokenInfo'] as const;

type DeclKind = 'interface' | 'type';

const DECL_RE = /^(export\s+)?(interface|type)\s+([A-Za-z_]\w*)/;

/**
 * Backward scan from `declLine` (exclusive) for a contiguous run of
 * comment-like lines directly above it — no blank-line gap tolerated,
 * mirroring this file's own convention of a doc block sitting immediately
 * above whatever it documents (confirmed against real declarations here,
 * e.g. `AuthoredFact`/`TokenInfo`'s own headers).
 */
function findLeadingCommentStart(lines: string[], declLine: number): number {
  let i = declLine - 1;
  while (i >= 0) {
    const t = lines[i]!.trim();
    if (t === '') break;
    const isCommentLike = t.startsWith('//') || t.startsWith('/**') || t.startsWith('/*') || t.startsWith('*') || t.endsWith('*/');
    if (!isCommentLike) break;
    i--;
  }
  return i + 1;
}

/**
 * Forward scan from `startLine` for the real end of one top-level
 * `type`/`interface` statement — a comment/string-aware `{`/`(`/`[` depth
 * counter. Returns -1 (never guessed) if the scan runs off the end of the
 * file still unbalanced, so a caller can skip rather than emit a truncated
 * section.
 */
function findDeclarationEnd(lines: string[], startLine: number, kind: DeclKind): number {
  let depth = 0;
  let seenOpen = false;
  let state: 'normal' | 'line-comment' | 'block-comment' | 'single' | 'double' | 'template' = 'normal';

  for (let li = startLine; li < lines.length; li++) {
    if (state === 'line-comment') state = 'normal';
    const line = lines[li]!;
    for (let ci = 0; ci < line.length; ci++) {
      const c = line[ci]!;
      const next = line[ci + 1];

      if (state === 'block-comment') {
        if (c === '*' && next === '/') {
          state = 'normal';
          ci++;
        }
        continue;
      }
      if (state === 'single') {
        if (c === '\\') { ci++; continue; }
        if (c === "'") state = 'normal';
        continue;
      }
      if (state === 'double') {
        if (c === '\\') { ci++; continue; }
        if (c === '"') state = 'normal';
        continue;
      }
      if (state === 'template') {
        if (c === '\\') { ci++; continue; }
        if (c === '`') state = 'normal';
        continue;
      }

      // state === 'normal'
      if (c === '/' && next === '/') { state = 'line-comment'; break; }
      if (c === '/' && next === '*') { state = 'block-comment'; ci++; continue; }
      if (c === "'") { state = 'single'; continue; }
      if (c === '"') { state = 'double'; continue; }
      if (c === '`') { state = 'template'; continue; }

      if (c === '{' || c === '(' || c === '[') { depth++; seenOpen = true; continue; }
      if (c === '}' || c === ')' || c === ']') {
        depth--;
        if (kind === 'interface' && seenOpen && depth === 0) return li;
        continue;
      }
      if (kind === 'type' && c === ';' && depth === 0) return li;
    }
  }
  return -1;
}

function extractDeclarations(text: string, wantedNames: readonly string[]): Map<string, string> {
  const lines = text.split('\n');
  const found = new Map<string, string>();

  for (let i = 0; i < lines.length; i++) {
    const m = DECL_RE.exec(lines[i]!);
    if (!m) continue;
    const kind = m[2] as DeclKind;
    const name = m[3]!;
    if (!wantedNames.includes(name) || found.has(name)) continue;

    const endLine = findDeclarationEnd(lines, i, kind);
    if (endLine === -1) continue; // malformed/unbalanced — skip rather than emit a guess

    const commentStart = findLeadingCommentStart(lines, i);
    found.set(name, lines.slice(commentStart, endLine + 1).join('\n'));
  }
  return found;
}

/**
 * Loads every real card-authoring schema type declaration this reference
 * page shows, fresh off disk (no caching — an edit to `card.ts` shows up on
 * the next request, same convention every other `/app/engine/*` evidence
 * route already follows).
 */
export function loadCardDefinitionSchema(repoRoot: string): CardSchemaTypeEntry[] {
  const cardTs = readFileSync(join(repoRoot, 'functional-model', 'card.ts'), 'utf8');
  const interfacesTs = readFileSync(join(repoRoot, 'functional-model', 'interfaces.ts'), 'utf8');

  const cardDecls = extractDeclarations(cardTs, CARD_TS_NAMES);
  const interfaceDecls = extractDeclarations(interfacesTs, INTERFACES_TS_NAMES);

  const entries: CardSchemaTypeEntry[] = [];
  for (const name of CARD_TS_NAMES) {
    const source = cardDecls.get(name) ?? null;
    entries.push({ name, file: 'functional-model/card.ts', source, found: source !== null });
  }
  for (const name of INTERFACES_TS_NAMES) {
    const source = interfaceDecls.get(name) ?? null;
    entries.push({ name, file: 'functional-model/interfaces.ts', source, found: source !== null });
  }
  return entries;
}
