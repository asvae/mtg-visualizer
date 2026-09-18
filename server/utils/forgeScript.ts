// Dev-only Forge card-script reader — 2026-09-19, card page's "real Forge
// script next to our own CardDefinition" reviewer tool. GPL-3.0-safety note
// (see `.claude/agent-memory/card/topics/forge-model-deletion.md` for the
// prior `forge-model/` deletion this deliberately does NOT repeat): this
// reads live, on-demand, from the local gitignored `tmp/mtg-forge/` checkout
// (~816M, dev-machine-only per `.claude/ORCHESTRATOR_PRIMER.md`) — nothing
// here is ever committed to this repo or bundled into a deployed build,
// unlike the old `forge-model/` (verbatim Forge scripts copied INTO the repo
// itself, shipped in the bundle/history regardless of environment — the
// actual exposure that deletion fixed). Confirmed with the user directly
// before building this (orchestrator relay, 2026-09-19): "could live in
// gitignored tmp folder" — explicit go-ahead on this distinction.
//
// Same dev-only posture as `server/utils/fdnDefinitionPool.ts`: none of this
// survives a production Netlify Function bundle (the checkout itself
// wouldn't exist there even if this ran) — callers gate on
// `process.env.NODE_ENV !== 'production'` before calling in; this module
// also defensively refuses in production itself as a second layer, not just
// a documentation promise resting on callers behaving.
//
// Filename convention (`tmp/mtg-forge/docs/Card-scripting-API/Card-
// scripting-API.md`'s own "Conventions" section): "filename: all lowercase,
// skip special characters, underscore for spaces." Confirmed against real
// checkout content before relying on it: "Kongming's Contraptions" ->
// `kongmings_contraptions.txt` (apostrophe DROPPED, not replaced),
// "Urza, Lord High Artificer" -> `urza_lord_high_artificer.txt` (comma
// dropped, space -> underscore), "Kefka, Court Mage // Kefka, Ruler of
// Ruin" -> `kefka_court_mage_kefka_ruler_of_ruin.txt` (commas AND `//`
// dropped, the resulting run of whitespace collapses to one underscore) —
// `slugify` below mirrors exactly this: lowercase, strip everything but
// `[a-z0-9 ]`, collapse whitespace runs, join with `_`.
//
// A derived slug is still VERIFIED against the file's own `Name:` line
// before being trusted (never assumed from the slug alone — Forge's stated
// convention is descriptive, not a hard guarantee for every card, and a
// stale/incomplete local checkout is expected, not exceptional). Falls back
// to scanning every `.txt` file in the same first-letter subdirectory for a
// matching `Name:` line — still narrow (Forge's own convention already
// buckets by first letter) rather than a full-corpus scan.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export interface ForgeScriptFound {
  available: true;
  found: true;
  content: string;
  // Repo-relative, for display only (e.g. "tmp/mtg-forge/forge-gui/res/
  // cardsfolder/e/exemplar_of_light.txt") — never a caller-supplied path,
  // always one this module itself resolved and verified.
  path: string;
}
export interface ForgeScriptNotFound {
  available: true;
  found: false;
}
export interface ForgeScriptUnavailable {
  available: false;
  reason: 'dev-only' | 'no-checkout';
}
export type ForgeScriptResult = ForgeScriptFound | ForgeScriptNotFound | ForgeScriptUnavailable;

// Exported (2026-09-19) so `server/utils/forgeJsonMapper.ts` — a sibling
// reader for the separate forge-json-mapper experiment's own output, which
// needs this exact same Forge-filename convention to resolve a card's own
// output file — can import it directly rather than re-deriving a second
// copy that could silently drift from this one.
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '_');
}

function nameMatches(fileContent: string, wanted: string): boolean {
  const wantedLower = wanted.trim().toLowerCase();
  return fileContent
    .split('\n')
    .some((line) => line.startsWith('Name:') && line.slice('Name:'.length).trim().toLowerCase() === wantedLower);
}

export function loadForgeScript(cardName: string, root: string = process.cwd()): ForgeScriptResult {
  if (process.env.NODE_ENV === 'production') return { available: false, reason: 'dev-only' };

  const cardsfolderRel = join('tmp', 'mtg-forge', 'forge-gui', 'res', 'cardsfolder');
  const cardsfolderAbs = join(root, cardsfolderRel);
  if (!existsSync(cardsfolderAbs)) return { available: false, reason: 'no-checkout' };

  const slug = slugify(cardName);
  const letter = slug.charAt(0);
  if (!letter) return { available: true, found: false };
  const dirAbs = join(cardsfolderAbs, letter);
  if (!existsSync(dirAbs)) return { available: true, found: false };

  const candidateName = `${slug}.txt`;
  const candidateAbs = join(dirAbs, candidateName);
  if (existsSync(candidateAbs)) {
    const content = readFileSync(candidateAbs, 'utf8');
    if (nameMatches(content, cardName)) {
      return { available: true, found: true, content, path: join(cardsfolderRel, letter, candidateName) };
    }
  }

  // Fallback: the derived candidate is missing or names a different card —
  // scan the rest of this same letter's directory for a real Name: match.
  let entries: string[];
  try {
    entries = readdirSync(dirAbs).filter((f) => f.endsWith('.txt'));
  } catch {
    return { available: true, found: false };
  }
  for (const entry of entries) {
    if (entry === candidateName) continue; // already checked above
    const entryAbs = join(dirAbs, entry);
    let content: string;
    try {
      content = readFileSync(entryAbs, 'utf8');
    } catch {
      continue;
    }
    if (nameMatches(content, cardName)) {
      return { available: true, found: true, content, path: join(cardsfolderRel, letter, entry) };
    }
  }
  return { available: true, found: false };
}
