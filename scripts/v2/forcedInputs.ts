// Stage 1 forced inputs (design/bal/STAGE1-DESIGN.md): the AI Futures Model's prescribed paths, installed into the engine's
// default-off FORCING hooks (src/engine/v2/core/forcing.ts). Loaded by balrun's worker preload (overridePreload.ts) when
// BAL_FORCED is set, before any game module runs.
//   computePath = total_ai_company_H100e(year), staffPath = L_HUMAN(year) / L_HUMAN(2025.5), both log-linear in the year.
import { existsSync, readFileSync } from 'node:fs';
import { FORCING } from '../../src/engine/v2/core/forcing';

export const AIFM_CSV = process.env.AIFM_CSV ?? 'C:/Users/david/Documents/projects/aifm-runs/repo/inputs/input_data.csv';
export const FORCED_KINDS = ['aifm'] as const;
export type ForcedKind = (typeof FORCED_KINDS)[number];

/** A log-linear interpolator through the (year, value) rows; flat-extrapolated at the ends. */
function logInterp(rows: { t: number; v: number }[]): (year: number) => number {
  return (year) => {
    if (year <= rows[0].t) return rows[0].v;
    const n = rows.length;
    if (year >= rows[n - 1].t) return rows[n - 1].v;
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (rows[m].t <= year) lo = m; else hi = m;
    }
    const f = (year - rows[lo].t) / (rows[hi].t - rows[lo].t);
    return Math.exp(Math.log(rows[lo].v) * (1 - f) + Math.log(rows[hi].v) * f);
  };
}

export function aifmPaths() {
  if (!existsSync(AIFM_CSV)) throw new Error(`forced aifm: ${AIFM_CSV} not found (set AIFM_CSV)`);
  const lines = readFileSync(AIFM_CSV, 'utf8').trim().split(/\r?\n/);
  const head = lines[0].split(',');
  const col = (n: string) => { const i = head.indexOf(n); if (i < 0) throw new Error(`forced aifm: no column ${n}`); return i; };
  const [it, il, ic] = [col('time'), col('L_HUMAN'), col('total_ai_company_H100e')];
  const rows = lines.slice(1).map((l) => l.split(',').map(Number));
  const comp = logInterp(rows.map((r) => ({ t: r[it], v: r[ic] })));
  const lab = logInterp(rows.map((r) => ({ t: r[it], v: r[il] })));
  const l0 = lab(2025.5);
  return { computePath: comp, staffPath: (y: number) => lab(y) / l0 };
}

export function installForced(kind: string) {
  if (kind !== 'aifm') throw new Error(`forced: unknown kind "${kind}" (one of ${FORCED_KINDS.join(', ')})`);
  const p = aifmPaths();
  FORCING.computePath = p.computePath;
  FORCING.staffPath = p.staffPath;
}
