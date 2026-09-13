// Bounded PROTOTYPE (2026-09-13), NOT wired into `apply-recognizers.mjs` or
// any real per-card pipeline — see `PRD_AUTOMATED_AUTHORING.md`'s "Prototype
// findings" section for the original oracle-text-only prototype this one
// deliberately mirrors in spirit but NOT in data source. This file is the
// tiny, narrow parser half of a SECOND kind of recognizer: one that reads
// Forge's own card-script DSL (`tmp/mtg-forge/forge-gui/res/cardsfolder/
// <letter>/<name>.txt` — a real, checked-out Forge source tree, git-ignored
// under this project's own `tmp/`, cited per file the way `interfaces.ts`
// already does elsewhere) instead of raw oracle-text prose.
//
// Deliberately narrow: this does NOT attempt to parse Forge's full script
// grammar (nested `SubAbility$` execution chains, `ChangeZone` semantics,
// conditional `Condition*$` clauses, etc.) — only the flat handful of
// `Key$ value` pairs a token-creation ability (`DB$ Token` / `SP$ Token`)
// and its referenced token-script file actually carry, which is all this
// prototype's one recognizer needs.

/** Splits ONE already-isolated Forge script line's own `Key1$ value1 |
 * Key2$ value2 | ...` param list into a flat string map. Forge's real
 * syntax is pipe-delimited with a `$` separating each key from its value
 * (see any real card script, e.g. `moogles_valor.txt`'s own `A:` line). */
export function parseForgeParams(paramsText: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of paramsText.split('|')) {
    const trimmed = part.trim();
    const dollar = trimmed.indexOf('$');
    if (dollar === -1) continue;
    const key = trimmed.slice(0, dollar).trim();
    const value = trimmed.slice(dollar + 1).trim();
    out[key] = value;
  }
  return out;
}

/** One `DB$ Token` / `SP$ Token` ability found anywhere in a card's own
 * script — a top-level `A:`/`T:` line, or (just as often, per the real
 * cards this was checked against — `battle_menu.txt`, `aerith_rescue_
 * mission.txt`, `ancient_adamantoise.txt`) an `SVar:<Name>:...` line a
 * modal/triggered ability chain refers to via `SubAbility$`/`Execute$`. This
 * parser does NOT resolve that chain — it just scans every line for the
 * `DB$ Token`/`SP$ Token` marker directly, which is sufficient to find every
 * token-creating ability regardless of how it's wired into the rest of the
 * card's own trigger/modal structure. */
export interface ForgeTokenAbility {
  tokenScriptId: string;
  /** Raw `TokenAmount$` value, verbatim — a literal integer string ("3",
   * "10") or a variable reference (Moogles' Valor's own "X", resolved
   * elsewhere via a separate `SVar:X:Count$Valid ...` line this parser does
   * NOT chase down — see this prototype's own recognizer for why a variable
   * amount is treated the same as "no fixed literal available" either way. */
  amount: string | undefined;
  tapped: boolean;
}

const TOKEN_MARKER_RE = /\b(?:DB|SP)\$\s*Token\b/;
const PARAMS_START_RE = /\b(?:DB|SP)\$/;

export function findTokenAbilities(cardScript: string): ForgeTokenAbility[] {
  const abilities: ForgeTokenAbility[] = [];
  for (const rawLine of cardScript.split('\n')) {
    if (!TOKEN_MARKER_RE.test(rawLine)) continue;
    const paramsStartMatch = PARAMS_START_RE.exec(rawLine);
    if (!paramsStartMatch) continue; // shouldn't happen given the test above, but never guess
    const params = parseForgeParams(rawLine.slice(paramsStartMatch.index));
    if (!params.TokenScript) continue; // a `DB$ Token` line with no `TokenScript$` is malformed/unexpected — skip, don't guess
    abilities.push({
      tokenScriptId: params.TokenScript,
      amount: params.TokenAmount,
      tapped: params.TokenTapped === 'True',
    });
  }
  return abilities;
}

/** The handful of static attributes a real Forge token-script file
 * (`tmp/mtg-forge/forge-gui/res/tokenscripts/<id>.txt`) prints as its own
 * top-level `Colors:`/`Types:`/`PT:`/`K:` lines — deliberately not the full
 * `TokenInfo`/card shape (a token script can also carry its own `A:`/`T:`
 * ability lines, e.g. `b_0_1_wizard_snipe`'s "deals 1 damage" trigger; this
 * prototype's recognizer only needs the STATIC printed attributes, not the
 * token's own granted abilities). */
export interface ForgeTokenAttributes {
  /** Lowercase color words straight off `Colors:` (e.g. `['white']`) — real
   * Forge token scripts spell these out as plain English words that happen
   * to already match Scryfall/oracle-text wording verbatim, no color-letter
   * (W/U/B/R/G) translation needed. Empty for a colorless token. */
  colors: string[];
  /** Every word off `Types:`, supertypes and subtypes both, in Forge's own
   * order (e.g. `['Artifact', 'Creature', 'Robot', 'Warrior']`) — NOT
   * necessarily the order the real oracle text prints them in (see this
   * prototype's own recognizer doc comment on the Robot Warrior/Treasure
   * "artifact" word-order and omission quirks this forces it to work
   * around). */
  types: string[];
  pt?: [number, number];
  /** Bare keyword names off every `K:<Keyword>[:...]` line (e.g.
   * `['Lifelink']`) — the `:`-delimited cost/parameter tail Forge appends
   * for a costed keyword (`K:Ward:3`) is intentionally discarded here; this
   * prototype's one recognizer never needs it. */
  keywords: string[];
}

export function parseTokenScript(tokenScriptText: string): ForgeTokenAttributes {
  const colors: string[] = [];
  const types: string[] = [];
  let pt: [number, number] | undefined;
  const keywords: string[] = [];
  for (const line of tokenScriptText.split('\n')) {
    if (line.startsWith('Colors:')) {
      colors.push(...line.slice('Colors:'.length).trim().split(/\s+/).filter(Boolean));
    } else if (line.startsWith('Types:')) {
      types.push(...line.slice('Types:'.length).trim().split(/\s+/).filter(Boolean));
    } else if (line.startsWith('PT:')) {
      const m = /^(-?\d+)\/(-?\d+)$/.exec(line.slice('PT:'.length).trim());
      if (m) pt = [Number(m[1]), Number(m[2])];
    } else if (line.startsWith('K:')) {
      const kw = line.slice('K:'.length).split(':')[0]!.trim();
      if (kw) keywords.push(kw);
    }
  }
  return { colors, types, pt, keywords };
}
