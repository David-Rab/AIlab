// Model naming (design/MODEL-NAMING.md). Bases and versions carry name parts (BaseNameParts, VersionNameParts); `name`
// is rendered from them and the player's chosen rung theme and tier words, and re-rendered when the choice changes.
// Grammar: <Rung>-<major><C…>.<minor>[.<patch>][-<tier>[-<n>]]. Rivals and China keep their fixed names.
import {
  AGENT_FAMILY, DEFAULT_THEME, DEFAULT_TIERS, IMPORT_FAMILY, RUNG_COUNT, RUNG_EDGES, RUNG_THEME_BY_ID, TIER_EDGES, TIER_SET_BY_ID,
  type RungTheme, type TierSet,
} from '../../../data/v2/naming';
import type { BaseModel, BaseNameParts, GameStateV2, ModelVersion, TrainingRun, VersionNameParts } from '../types';

/** The rung of a measured-scale level (MODEL-NAMING §2): 1 below 6.5 … 7 at 15 and above; no level: rung 1. */
export function rungOfLevel(L: number | undefined): number {
  if (L === undefined || !Number.isFinite(L)) return 1;
  let r = 1;
  for (const e of RUNG_EDGES) if (L >= e) r++;
  return Math.min(RUNG_COUNT, r);
}

/** The size band of a student (0 = ≥ 1/2 of its base's active parameters … 3 = below 1/16). */
export function tierOfRatio(r: number): number {
  let k = 0;
  for (const e of TIER_EDGES) if (r < e) k++;
  return k;
}

export function namingChoice(s: GameStateV2): { theme: RungTheme; tiers: TierSet } {
  const n = s.player.models.naming;
  return {
    theme: RUNG_THEME_BY_ID[n?.theme ?? DEFAULT_THEME] ?? RUNG_THEME_BY_ID[DEFAULT_THEME],
    tiers: TIER_SET_BY_ID[n?.tiers ?? DEFAULT_TIERS] ?? TIER_SET_BY_ID[DEFAULT_TIERS],
  };
}

/** The rung's word in the chosen theme (Agent-n: "Agent-<rung>"); an imported family's word. */
export function rungWord(s: GameStateV2, rung: number): string {
  if (rung === 0) return IMPORT_FAMILY;
  const { theme } = namingChoice(s);
  const r = Math.max(1, Math.min(RUNG_COUNT, rung));
  return theme.words ? theme.words[r - 1] : `${AGENT_FAMILY}-${r}`;
}

/** "Cruiser-2C" from a base's parts. */
export function baseLabel(s: GameStateV2, nm: BaseNameParts): string {
  return `${rungWord(s, nm.rung)}-${nm.major}${'C'.repeat(nm.cont)}`;
}

const baseOf = (s: GameStateV2, id: string): BaseModel | undefined => s.player.models.bases.find((b) => b.id === id);
const versionOf = (s: GameStateV2, id: string | undefined): ModelVersion | undefined =>
  id === undefined ? undefined : s.player.models.versions.find((v) => v.id === id);

/** "Cruiser-2.3" (+ ".57" for a stream patch) of a full or imported version; undefined without parts. */
function fullLabel(s: GameStateV2, v: ModelVersion, patch: number | undefined): string | undefined {
  const b = baseOf(s, v.baseId);
  if (!b?.nm || v.nm?.minor === undefined) return undefined;
  return `${baseLabel(s, b.nm)}.${v.nm.minor}${patch ? `.${patch}` : ''}`;
}

/** A version's name from its parts and the current choice (its stored name when it has no parts). */
export function versionLabel(s: GameStateV2, v: ModelVersion): string {
  const nm = v.nm;
  if (!nm) return v.name;
  if (nm.tier !== undefined) {
    const anc = versionOf(s, nm.anc);
    const head = (anc && fullLabel(s, anc, nm.ancPatch)) ?? anc?.name;
    if (!head) return v.name;
    const word = namingChoice(s).tiers.words[Math.max(0, Math.min(3, nm.tier))];
    return `${head}-${word}${(nm.tierN ?? 1) > 1 ? `-${nm.tierN}` : ''}`;
  }
  return fullLabel(s, v, nm.patch) ?? v.name;
}

const RUN_WORD: Partial<Record<TrainingRun['kind'], string>> = { base: 'Pretraining', continue: 'Continued pretraining' };

/** Re-render every player base, version and pretraining run name from its parts (after a choice changes or parts are
 *  set). Logs keep the names of their day. */
export function renderNames(s: GameStateV2): void {
  const m = s.player.models;
  for (const b of m.bases) if (b.nm) b.name = baseLabel(s, b.nm);
  for (const v of m.versions) if (v.nm) v.name = versionLabel(s, v);
  for (const r of m.runs) if (r.nm && RUN_WORD[r.kind]) r.name = `${RUN_WORD[r.kind]} ${baseLabel(s, r.nm)}`;
}

/** Reserve the next major number in the rung of a forecast level (a base run's launch, §3: gaps are kept). */
export function reserveBaseName(s: GameStateV2, forecastL: number | undefined): BaseNameParts {
  const rung = rungOfLevel(forecastL);
  const majors = (s.player.models.majors ??= []);
  const major = (majors[rung - 1] ?? 0) + 1;
  majors[rung - 1] = major;
  return { rung, major, cont: 0 };
}

/** A continued base's parts (§4): its parent's rung and major with one more C (the next free count when another
 *  continued run of the same parent already holds it). */
export function continuedName(s: GameStateV2, parent: BaseNameParts): BaseNameParts {
  const m = s.player.models;
  const taken = (c: number) =>
    m.bases.some((b) => b.nm && b.nm.rung === parent.rung && b.nm.major === parent.major && b.nm.cont === c)
    || m.runs.some((r) => r.nm && r.status !== 'cancelled' && r.status !== 'failed' && r.nm.rung === parent.rung && r.nm.major === parent.major && r.nm.cont === c);
  let cont = parent.cont + 1;
  while (taken(cont)) cont++;
  return { rung: parent.rung, major: parent.major, cont };
}

/** The next minor number on a base (§5): its full post-trains (amplify included), from .0; students never count. */
export function nextMinor(s: GameStateV2, baseId: string): number {
  let n = -1;
  for (const v of s.player.models.versions) if (v.baseId === baseId && v.variant !== 'mini' && v.nm?.minor !== undefined) n = Math.max(n, v.nm.minor);
  return n + 1;
}

/** The first full (or imported) version up a student's teacher chain: the version its name hangs on (§7). */
export function fullAncestor(s: GameStateV2, v: ModelVersion): ModelVersion | undefined {
  let x: ModelVersion | undefined = v;
  for (let k = 0; x && x.variant === 'mini' && k < 50; k++) x = versionOf(s, x.parentVersionId);
  return x && x.variant !== 'mini' ? x : undefined;
}

/** A student's parts (§7): its size band against its base, its full-size ancestor (and that one's stream patch now),
 *  and its number among the ancestor's students in that band. */
export function studentName(s: GameStateV2, v: ModelVersion): VersionNameParts {
  const b = baseOf(s, v.baseId);
  const anc = fullAncestor(s, v);
  const tier = tierOfRatio(b && v.params ? v.params / b.params : 1);
  const ancPatch = anc?.nm?.patch;
  const nm: VersionNameParts = { tier, ...(anc ? { anc: anc.id } : {}), ...(ancPatch ? { ancPatch } : {}) };
  let n = 0;
  for (const x of s.player.models.versions) if (x !== v && x.nm?.tier === tier && x.nm.anc === nm.anc && (x.nm.ancPatch ?? 0) === (ancPatch ?? 0)) n = Math.max(n, x.nm.tierN ?? 1);
  nm.tierN = n + 1;
  return nm;
}

/** Fill the parts of every player base and version that has none (the start state; a save from before naming): bases in
 *  creation order (rung from the measured level of their first full version), versions by day (full: the next minor;
 *  students: their band). Then render. */
export function deriveNames(s: GameStateV2): void {
  const m = s.player.models;
  for (const b of m.bases) {
    if (b.nm) continue;
    const par = b.parentBaseId ? baseOf(s, b.parentBaseId) : undefined;
    if (par?.nm) {
      b.nm = continuedName(s, par.nm);
      continue;
    }
    const on = m.versions.filter((v) => v.baseId === b.id && v.variant !== 'mini').sort((x, y) => x.day - y.day);
    if (on.some((v) => v.variant === 'imported')) {
      b.nm = { rung: 0, major: 1, cont: 0 };
      continue;
    }
    const L = on.find((v) => v.evals.measuredL !== undefined)?.evals.measuredL;
    b.nm = reserveBaseName(s, L);
  }
  const order = [...m.versions].sort((x, y) => x.day - y.day);
  for (const v of order) if (!v.nm && v.variant !== 'mini') v.nm = { minor: nextMinor(s, v.baseId) };
  for (const v of order) if (!v.nm && v.variant === 'mini') v.nm = studentName(s, v);
  renderNames(s);
}

/** The player's choice of rung theme and tier words (MODELS tab); every name re-renders. */
export function setNaming(s: GameStateV2, theme: string | undefined, tiers: string | undefined): string | undefined {
  const cur = namingChoice(s);
  const t = theme ?? cur.theme.id;
  const k = tiers ?? cur.tiers.id;
  if (!RUNG_THEME_BY_ID[t]) return 'Unknown naming theme';
  if (!TIER_SET_BY_ID[k]) return 'Unknown tier words';
  s.player.models.naming = { theme: t, tiers: k };
  renderNames(s);
  return undefined;
}
