// Reader for `functional-model/scripts/experiments/forge-json-mapper/`'s own
// output — 2026-09-19, card page's "Forge JSON" tab. That experiment (a
// fresh, isolated agent given zero context on this repo's own
// `functional-model/card.ts` schema, see its own README.md) converts real
// Forge card-script `.txt` files into JSON that mirrors Forge's own on-disk
// representation as directly as possible — NOT this repo's `CardDefinition`
// shape. It ran against exactly 20 real cards (FDN collector numbers 1-20)
// and wrote one `<slug>.json` per card to its own `output/` directory.
//
// Unlike `forgeScript.ts` (which reads live from the huge, gitignored
// `tmp/mtg-forge/` checkout and is therefore dev-only/NODE_ENV-gated), this
// reads from a small, self-contained directory that's a NORMAL part of this
// repo's own tree (`functional-model/scripts/experiments/forge-json-mapper/`
// — currently untracked/experimental, but not gitignored, and not a large
// external dependency) — so there's no dev-only gate here at all. If that
// output directory or its own JSON files never get committed, `existsSync`
// below simply returns false in any environment that doesn't have them
// (including production, which only ever serves committed files) and this
// degrades to the same "nothing to show" `null` every other optional
// per-card field on this route already tolerates.
//
// Slug resolution reuses `forgeScript.ts`'s own `slugify` (not a second,
// hand-copied implementation) — the mapper script's own `slug_for()`
// (`forge_json_mapper.py`) is just the source `.txt` file's own basename,
// which itself follows the exact same documented Forge filename convention
// `forgeScript.ts`'s `slugify` already implements and verifies (lowercase,
// strip non `[a-z0-9 ]`, collapse whitespace, join with `_`) — confirmed by
// hand against all 20 real output filenames (e.g. "Exemplar of Light" ->
// `exemplar_of_light.json`) before relying on this.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { slugify } from './forgeScript';

// Returns this card's own pretty-printed JSON (the file's raw content,
// already `indent=2`-formatted by the Python mapper — no re-parse/
// re-stringify needed), or `null` when there's no matching output file for
// this card at all — the overwhelmingly common case (every `fin` card, and
// every `fdn` card outside collector numbers 1-20).
export function loadForgeJsonMapperOutput(cardName: string, root: string = process.cwd()): string | null {
  const slug = slugify(cardName);
  if (!slug) return null;
  const path = join(root, 'functional-model', 'scripts', 'experiments', 'forge-json-mapper', 'output', `${slug}.json`);
  if (!existsSync(path)) return null;
  try {
    return readFileSync(path, 'utf8').trim();
  } catch {
    return null;
  }
}
