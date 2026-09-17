// Ground-truth lookup helper — given a real card NAME, finds and prints the
// real Forge cardsfolder script (`tmp/mtg-forge`, primary source per project
// convention — see `.claude/agents/engine.md`/`SHARED.md`) and, if present,
// the matching XMage card source (`tmp/xmage`, secondary cross-check only,
// never a replacement). Both `definition`/`card-results` lanes should use
// this instead of hand-grepping `tmp/mtg-forge`/`tmp/xmage` every time —
// same normalization/search logic in one place, not re-derived per agent.
//
// Both checkouts are real, git-ignored, live under THIS project's own
// `tmp/` (not a sibling directory) — confirmed present 2026-09-12. If
// either is somehow missing, this script says so plainly; check for a real
// Forge game install before falling back to trained-knowledge guesses (see
// `.claude/agents/engine.md`'s own fallback note — a real install has been
// found at `/mnt/c/Games/ForgeInstaller` on this machine, WSL, with real
// card scripts in `res/cardsfolder/cardsfolder.zip`).
//
// Usage: npx tsx functional-model/scripts/forge-lookup.mjs "<card name>"
//   npx tsx functional-model/scripts/forge-lookup.mjs "Dragoon's Lance"
//   npx tsx functional-model/scripts/forge-lookup.mjs "Serah Farron // Crystallized Serah"
//
// Forge's own real cardsfolder script uses a `Name:<name>` line INSIDE the
// file (`res/cardsfolder/<a-z>/<normalized_name>.txt`) — this script
// content-greps that line rather than guessing the filename's own
// normalization (apostrophe/comma-stripping, DFC front+back concatenation,
// etc. are all real but inconsistent enough across cards that a robust
// content match is safer than reverse-engineering every edge case).
//
// XMage has no per-card `Name:` line to grep (a compiled Java class, not a
// data file) — its own real name->class mapping lives in
// `Mage.Sets/src/mage/sets/<SetName>.java`'s `new SetCardInfo("<name>", ...,
// mage.cards.<letter>.<ClassName>.class)` registrations, so this script
// greps THOSE instead, extracts the referenced class, and prints that
// class file directly.
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');
const FORGE_CARDSFOLDER = join(ROOT, 'tmp/mtg-forge/forge-gui/res/cardsfolder');
const XMAGE_SETS_DIR = join(ROOT, 'tmp/xmage/Mage.Sets/src/mage/sets');
const XMAGE_CARDS_ROOT = join(ROOT, 'tmp/xmage/Mage.Sets/src/mage/cards');

function walkFiles(dir, suffix, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, suffix, out);
    else if (entry.name.endsWith(suffix)) out.push(full);
  }
  return out;
}

/** A DFC/split/adventure card's own real Scryfall-style combined name
 * ("Serah Farron // Crystallized Serah") is rarely how EITHER checkout
 * indexes it — Forge folds both faces into one filename/Name: line
 * ("Serah Farron, Crystallized Serah"-shaped), XMage only ever registers
 * the FRONT face's own name. Try the full name first, then just the part
 * before " // " if that fails. */
function nameCandidates(name) {
  const candidates = [name];
  const slashIdx = name.indexOf(' // ');
  if (slashIdx !== -1) candidates.push(name.slice(0, slashIdx));
  return candidates;
}

export function findForge(name) {
  if (!existsSync(FORGE_CARDSFOLDER)) {
    return { found: false, message: `tmp/mtg-forge not found at ${FORGE_CARDSFOLDER} — see this script's own header for the fallback (real Forge install check) before trusting trained-knowledge instead.` };
  }
  const files = walkFiles(FORGE_CARDSFOLDER, '.txt');
  for (const candidate of nameCandidates(name)) {
    const needle = `name:${candidate.toLowerCase()}`;
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      const firstLine = text.split('\n', 1)[0] ?? '';
      if (firstLine.toLowerCase().trim() === `name:${candidate.toLowerCase()}`.trim() || firstLine.toLowerCase().startsWith(needle)) {
        return { found: true, file, text };
      }
    }
  }
  return { found: false, message: `no Forge cardsfolder script found with a "Name:" line matching "${name}" (tried: ${nameCandidates(name).join(', ')}).` };
}

function findXMageClassRef(name) {
  if (!existsSync(XMAGE_SETS_DIR)) return undefined;
  const setFiles = walkFiles(XMAGE_SETS_DIR, '.java');
  for (const candidate of nameCandidates(name)) {
    const quoted = `"${candidate}"`;
    for (const file of setFiles) {
      const text = readFileSync(file, 'utf8');
      const idx = text.indexOf(quoted);
      if (idx === -1) continue;
      // Line shape: new SetCardInfo("<name>", <num>, Rarity.X, mage.cards.<l>.<Class>.class)
      const lineEnd = text.indexOf(')', idx);
      const line = text.slice(idx, lineEnd === -1 ? undefined : lineEnd + 1);
      const classMatch = /mage\.cards\.([a-z0-9])\.([A-Za-z0-9]+)\.class/.exec(line);
      if (classMatch) return { setFile: file, letter: classMatch[1], className: classMatch[2] };
    }
  }
  return undefined;
}

export function findXMage(name) {
  if (!existsSync(XMAGE_CARDS_ROOT)) {
    return { found: false, message: `tmp/xmage not found at ${XMAGE_CARDS_ROOT} — secondary source only, missing is not blocking.` };
  }
  const ref = findXMageClassRef(name);
  if (!ref) return { found: false, message: `no XMage set registration ("new SetCardInfo(...)") found matching "${name}".` };
  const classFile = join(XMAGE_CARDS_ROOT, ref.letter, `${ref.className}.java`);
  if (!existsSync(classFile)) {
    return { found: false, message: `XMage set registration found (${ref.setFile}) but its own referenced class file is missing: ${classFile}` };
  }
  return { found: true, file: classFile, text: readFileSync(classFile, 'utf8') };
}

// CLI entry point only — guarded so `findForge`/`findXMage` can also be
// imported as a module (e.g. `functional-model/scripts/prep-card-
// context.mjs`) without this file's own argv-driven printing firing on
// import using the IMPORTING script's argv instead of this one's.
if (import.meta.url === `file://${process.argv[1]}`) {
  const name = process.argv[2];
  if (!name) {
    console.error('Usage: npx tsx functional-model/scripts/forge-lookup.mjs "<card name>"');
    process.exit(1);
  }

  console.log(`=== Forge (primary) — "${name}" ===`);
  const forge = findForge(name);
  if (forge.found) {
    console.log(`# ${forge.file}\n`);
    console.log(forge.text);
  } else {
    console.log(forge.message);
  }

  console.log(`\n=== XMage (secondary cross-check only) — "${name}" ===`);
  const xmage = findXMage(name);
  if (xmage.found) {
    console.log(`# ${xmage.file}\n`);
    console.log(xmage.text);
  } else {
    console.log(xmage.message);
  }
}
