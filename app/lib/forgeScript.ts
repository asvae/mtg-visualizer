import type { ForgeCard, ForgeFace, ForgeLineType, ForgeRow } from '../types';

// Parses a real Card-Forge (github.com/Card-Forge/forge) cardsfolder script
// into an outline app/components/ForgeCardScript.vue can walk — Forge's own
// shape, not synergy-model's. A card is a flat list of top-level ability
// lines (A:/T:/S:/R:/K:), each optionally chaining into further `SVar:`
// sub-effects via SubAbility$ (a linked list, not a graph); a `Choices$`
// field (Charm — real "choose one") or `K:Chapter` fans out into several
// such chains instead of one. This mirrors Forge's real engine semantics
// rather than retrofitting synergy-model's `combine`/DAG vocabulary onto it.

const STRUCTURAL_KEYS = new Set(['SubAbility', 'Choices', 'AddTrigger', 'Execute']);
const DESCRIPTION_KEYS = new Set(['SpellDescription', 'TriggerDescription', 'Description']);
// StackDescription$ is Forge's own dynamic stack-narration template (macro
// syntax like `{p:You}`/`{n:Y}`) — real AI/UI plumbing, not gameplay data,
// and it duplicates the human-readable description already shown alongside
// this row. Hidden from the fields column; still visible verbatim in the
// raw-script spoiler.
const HIDDEN_KEYS = new Set(['StackDescription']);
const EFFECT_KEYS = ['AB', 'SP', 'DB'];

function parsePipeFields(text: string): Array<[string, string]> {
  return text
    .split(' | ')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk): [string, string] => {
      const i = chunk.indexOf('$');
      if (i === -1) return [chunk, ''];
      return [chunk.slice(0, i), chunk.slice(i + 1).trim()];
    });
}

function fieldValue(fields: Array<[string, string]>, key: string): string | undefined {
  return fields.find(([k]) => k === key)?.[1];
}

function renderFields(fields: Array<[string, string]>, skip: Set<string>): string {
  return fields
    .filter(([k]) => !skip.has(k) && !HIDDEN_KEYS.has(k) && !EFFECT_KEYS.includes(k))
    .map(([k, v]) => (v ? `${k}=${v}` : k))
    .join('  ');
}

function effectKey(fields: Array<[string, string]>): string | undefined {
  return EFFECT_KEYS.find((k) => fields.some(([fk]) => fk === k));
}

let rowSeq = 0;

// Walks one effect definition — either a top-level `A:` line's own fields,
// or an `SVar:`-defined sub-effect reached via SubAbility$/Choices$/Execute$/
// AddTrigger$ — into this row plus whatever it chains into.
function walkEffect(
  fields: Array<[string, string]>,
  depth: number,
  isRoot: boolean,
  lineType: ForgeLineType | undefined,
  svars: Map<string, string>,
  rows: ForgeRow[]
) {
  const key = `r${rowSeq++}`;
  const ek = effectKey(fields);
  const mode = fieldValue(fields, 'Mode');
  const role = ek ? fieldValue(fields, ek) : (mode ?? lineType ?? '?');
  const description = [...DESCRIPTION_KEYS].map((k) => fieldValue(fields, k)).find(Boolean);

  rows.push({
    kind: 'line',
    key,
    depth,
    isRoot,
    lineType,
    role: lineType === 'T' || lineType === 'S' ? `${lineType === 'T' ? 'trigger' : 'static'}(${mode})` : role,
    fields: renderFields(fields, new Set([...STRUCTURAL_KEYS, ...DESCRIPTION_KEYS, 'Mode'])),
    description,
  });

  const choices = fieldValue(fields, 'Choices');
  if (choices) {
    const names = choices.split(',').map((s) => s.trim());
    rows.push({ kind: 'group', key: `${key}-choices`, depth: depth + 1, isRoot: false, groupLabel: 'choose one:' });
    names.forEach((name) => {
      const raw = svars.get(name);
      if (raw) walkEffect(parsePipeFields(raw), depth + 2, false, undefined, svars, rows);
    });
  }

  const addTrigger = fieldValue(fields, 'AddTrigger');
  if (addTrigger) {
    const raw = svars.get(addTrigger);
    if (raw) walkEffect(parsePipeFields(raw), depth + 1, false, 'T', svars, rows);
  }
  // AddStaticAbility$ — the same "grant an ability via a referenced SVar"
  // idea AddTrigger$ already handles, just granting a STATIC (a continuous
  // rule, e.g. Class level 3's "creature tokens you control get +2/+2")
  // instead of a triggered ability. A real, separate Forge field (Caretaker's
  // Talent's level 3 uses it, not AddTrigger$) that had no handling at all —
  // the whole anthem silently had nothing pointing at it.
  const addStatic = fieldValue(fields, 'AddStaticAbility');
  if (addStatic) {
    const raw = svars.get(addStatic);
    if (raw) walkEffect(parsePipeFields(raw), depth + 1, false, 'S', svars, rows);
  }
  // AddReplacementEffect$ — a THIRD "grant an ability via a referenced SVar"
  // field (Innkeeper's Talent's level 3: "if you would put counters on a
  // permanent, put twice that many instead"), same silent-nothing-points-
  // at-it gap AddStaticAbility$ had before it got this same treatment.
  // Routed as an 'S' row same as AddStaticAbility$ — forgeTranslate.ts's
  // static handler has no real replacement-effect role to build a node for
  // (SCHEMA has no representation for "modifies a future event" yet), so
  // this deliberately surfaces as an honest `unmapped` entry there rather
  // than vanishing with zero trace the way it did with no handling at all.
  const addReplacement = fieldValue(fields, 'AddReplacementEffect');
  if (addReplacement) {
    const raw = svars.get(addReplacement);
    if (raw) walkEffect(parsePipeFields(raw), depth + 1, false, 'S', svars, rows);
  }

  const execute = fieldValue(fields, 'Execute');
  if (execute) {
    const raw = svars.get(execute);
    if (raw) walkEffect(parsePipeFields(raw), depth + 1, false, undefined, svars, rows);
  }

  const subAbility = fieldValue(fields, 'SubAbility');
  if (subAbility) {
    const raw = svars.get(subAbility);
    if (raw) walkEffect(parsePipeFields(raw), depth + 1, false, undefined, svars, rows);
  }
}

// K:Chapter:<final>:<svar1>,<svar2>,... — a Saga's chapter abilities, each
// listed once per chapter it fires on (a repeated svar name for a multi-turn
// chapter like Braska's Final Aeon's I/II Jecht Beam), not chained to each
// other — each chapter is its own independent root-adjacent branch.
function walkChapter(params: string[], depth: number, svars: Map<string, string>, rows: ForgeRow[]) {
  const names = (params[1] ?? '').split(',').map((s) => s.trim());
  const key = `r${rowSeq++}-chapters`;
  // Top-level (depth 0) itself — a Saga's chapter list is a K: line just
  // like any other, nothing else on the card points to it.
  rows.push({ kind: 'group', key, depth, isRoot: depth === 0, groupLabel: `chapters (sacrifice after ${params[0]}):` });
  const numerals = ['I', 'II', 'III', 'IV', 'V', 'VI'];
  names.forEach((name, i) => {
    const raw = svars.get(name);
    if (!raw) return;
    const chapterKey = `${key}-${i}`;
    rows.push({ kind: 'group', key: chapterKey, depth: depth + 1, isRoot: false, groupLabel: numerals[i] ?? String(i + 1) });
    walkEffect(parsePipeFields(raw), depth + 2, false, undefined, svars, rows);
  });
}

function parseFace(block: string): ForgeFace {
  const lines = block.split('\n').map((l) => l.trimEnd()).filter((l) => l.length > 0);

  const header: Record<string, string> = {};
  const svars = new Map<string, string>();
  const topLevel: { type: ForgeLineType; body: string }[] = [];
  const meta: string[] = [];
  let oracle: string | null = null;

  const HEADER_KEYS = new Set(['Name', 'ManaCost', 'Types', 'PT', 'Colors', 'Loyalty']);
  for (const line of lines) {
    if (line.startsWith('SVar:')) {
      const rest = line.slice('SVar:'.length);
      const i = rest.indexOf(':');
      if (i !== -1) svars.set(rest.slice(0, i), rest.slice(i + 1));
      continue;
    }
    if (line.startsWith('Oracle:')) {
      oracle = line.slice('Oracle:'.length).replace(/\\n/g, '\n');
      continue;
    }
    if (/^[ATSRK]:/.test(line)) {
      topLevel.push({ type: line[0] as ForgeLineType, body: line.slice(2) });
      continue;
    }
    const headerMatch = /^([A-Za-z]+):(.*)$/.exec(line);
    const headerKey = headerMatch?.[1];
    if (headerKey && HEADER_KEYS.has(headerKey)) {
      header[headerKey] = headerMatch?.[2] ?? '';
      continue;
    }
    meta.push(line);
  }

  const rows: ForgeRow[] = [];
  for (const { type, body } of topLevel) {
    if (type === 'K') {
      const params = body.split(':');
      const name = params[0];
      if (name === 'Chapter') {
        walkChapter(params.slice(1), 0, svars, rows);
        continue;
      }
      // Gift (702.199) always references a SVar literally named
      // `GiftAbility` — a hardcoded engine convention, not a `Choices$`/
      // `Execute$`/`AddTrigger$` field pointer this parser would otherwise
      // follow — so it never becomes a row on its own. Walking it explicitly
      // here surfaces the real gift (a token to whichever opponent is
      // promised it) as a normal effect row instead of `K:Gift` staying an
      // opaque bare keyword with no content behind it.
      if (name === 'Gift') {
        const giftRaw = svars.get('GiftAbility');
        if (giftRaw) {
          // lineType 'A' (not undefined) — app/lib/forgeTranslate.ts's own
          // top-level walk only picks up rows typed A/T/S/K; `undefined` is
          // for a non-root chained row (a child reached via SubAbility$
          // etc), invisible to that walk, which is exactly the class of bug
          // this whole Gift/Class effort exists to close (see report).
          // A synthetic GiftOptional$True field (not a real Forge field) —
          // Gift (702.199) is ALWAYS "you MAY promise a gift," but that
          // optionality is baked into the K:Gift keyword mechanic itself,
          // never appearing as an Optional$/OptionalDecider$ field on
          // GiftAbility's own SVar the way other optional effects mark it —
          // so forgeTranslate.ts's Token handler has no field to read it
          // from without this being injected here.
          walkEffect([...parsePipeFields(giftRaw), ['GiftOptional', 'True']], 0, true, 'A', svars, rows);
          continue;
        }
      }
      // Class (702.140): `K:Class:<level>:<cost>:AddTrigger$ <SVar>` — one
      // line per level, each paying its own cost to permanently grant a
      // trigger. Synthesized as `AB$ ClassLevel` (a made-up effect name
      // app/lib/forgeTranslate.ts special-cases, same idea as SP$/AB$/DB$)
      // carrying the real Cost$/ClassLevel$ fields plus the level's own
      // AddTrigger$ — walkEffect's existing generic AddTrigger$ handling
      // (see above) then resolves and nests the granted trigger as this
      // row's child automatically, no separate lookup needed.
      if (name === 'Class' && params.length >= 4) {
        const [, level, cost, addTriggerField] = params;
        walkEffect(
          [
            ['AB', 'ClassLevel'],
            ['ClassLevel', level ?? ''],
            ['Cost', cost ?? ''],
            [addTriggerField?.split('$')[0]?.trim() ?? 'AddTrigger', addTriggerField?.split('$')[1]?.trim() ?? ''],
          ],
          0,
          true,
          'A', // see the Gift branch's comment above — must be a root-visible type
          svars,
          rows
        );
        continue;
      }
      rows.push({
        kind: 'line',
        key: `r${rowSeq++}`,
        depth: 0,
        isRoot: true,
        lineType: 'K',
        role: name,
        fields: params.slice(1).join(':'),
      });
      continue;
    }
    walkEffect(parsePipeFields(body), 0, true, type, svars, rows);
  }

  return {
    name: header.Name ?? '',
    manaCost: header.ManaCost ?? null,
    typeLine: header.Types ?? null,
    pt: header.PT ?? null,
    oracle,
    rows,
    meta,
  };
}

export function parseForgeScript(raw: string): ForgeCard {
  const faces = raw
    .split(/\n\s*ALTERNATE\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map(parseFace);
  return { faces };
}

// Forge writes mana costs as space-separated symbols ("2 B B", "3 B") rather
// than oracle text's `{2}{B}{B}` — converts to the latter so the existing
// `{X}`-splitting ManaSymbol rendering (parseManaSegments) works unchanged.
export function forgeManaCostToBraced(cost: string): string {
  return cost
    .split(' ')
    .filter(Boolean)
    .map((sym) => `{${sym}}`)
    .join('');
}
