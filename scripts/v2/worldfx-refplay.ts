// Reference-play probe for WS5 world-effects tests (V2-SPEC §7.3, F11). Owner: WS5.
//
// While WS1/WS3/WS4 systems are M0 stubs, "reference play" is emulated by one probe system (order 25, after
// computeOnline and before revenue) that follows the AI 2027 reference path for everything WS5 consumes:
//   - player compute: AI 2027 leading-lab average H100e (1M 2025 → 4M 2026 → 7/9/12/15M by quarter 2027) [A27, R02 §1.3]
//     and the reference usage split shareRefAt(year) (§3.2.1);
//   - public release lag: the player's external deployments serve a public version that trails the internal frontier
//     by PUBLIC_LAG levels (AI 2027: Agent-1-mini late 2026; Agent-3-mini ≈ 9.5 in Jul 2027 while internal ≈ 10.7);
//   - chip supply for AI capex: global production 11M (2025), 25M (2026), 60M (2027) H100e at $25K → $20K → $15K
//     [A27 R02 §1.1];
//   - rival revenue run-rates scale with the player's (sector grows together).
// None of this writes WS5 state; it only stands in for other workstreams' systems.
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { decimalYear } from '../../src/engine/v2/core/time';
import { shareRefAt } from '../../src/engine/v2/departments/split';
import { domainsOf, gOfBuild, gOfLevel, levelOfG } from '../../src/engine/v2/models/capability';
import type { EngineSystem, GameStateV2, ModelVersion, SetupV2 } from '../../src/engine/v2/types';
import { revenueReadout } from '../../src/engine/v2/worldfx/revenue';

/** Public release lag in levels (AI 2027: Agent-3-mini ≈ 9.5 public while Agent-3/4 ≈ 10.5–11 internal). */
export const PUBLIC_LAG = 0.5;

function logInterp(pts: [number, number][], x: number): number {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 0; i < pts.length - 1; i++) {
    if (x <= pts[i + 1][0]) {
      const t = (x - pts[i][0]) / (pts[i + 1][0] - pts[i][0]);
      return Math.exp(Math.log(pts[i][1]) + t * (Math.log(pts[i + 1][1]) - Math.log(pts[i][1])));
    }
  }
  const n = pts.length - 1;
  const g = Math.log(pts[n][1] / pts[n - 1][1]) / (pts[n][0] - pts[n - 1][0]);
  return pts[n][1] * Math.exp(g * 0.5 * (x - pts[n][0])); // slower after the table
}

export const REF_COMPUTE: [number, number][] = [[2025.5, 1.2e6], [2026.5, 4e6], [2027.125, 7e6], [2027.375, 9e6], [2027.625, 12e6], [2027.875, 15e6]];
const REF_PROD: [number, number][] = [[2025.5, 11e6], [2026.5, 25e6], [2027.5, 60e6], [2028.5, 101e6]];
const REF_PRICE: [number, number][] = [[2025.5, 25], [2026.5, 20], [2027.5, 15], [2028.5, 12]];

export interface RefPlayOpts { publicLag?: number; compute?: boolean; freezeAt?: number; rebalance?: boolean }

/** Build the probe system for one game (keeps a per-game G history in a closure). `freezeAt` is a G (OOM). */
export function refPlayProbe(s0: GameStateV2, opts: RefPlayOpts = {}): EngineSystem {
  const lag = opts.publicLag ?? PUBLIC_LAG;
  const hist: number[] = [];
  const rivalRev0 = new Map(s0.rivals.map((r) => [r.core.id, r.finance.revenueRun]));
  const cnRev0 = s0.china.lab.finance.revenueRun;
  return {
    id: 'probe-refplay', owner: 'WS5', cadence: 'daily', order: 25, system: 'core',
    run(s) {
      const w = s.hidden.timeline;
      const yr = decimalYear(s);
      const V0 = s.player.models.versions.find((v) => v.id === 'V0')!;
      if (opts.freezeAt !== undefined) {
        // Freeze every lab at a fixed capability (W2 test): Agent-1-level models for a decade.
        // CAL-X: the world effects read a model's domain G from its build when it has one (versionDomainG: the player's
        // versions and, since RD-X03, the rivals'), so the build is shifted onto the frozen G too (its domain profile
        // kept), and the labs' lineup tiers are frozen with them; before, only G was set and the market kept reading
        // the rivals' growing builds (market AGENCY L 6.3 → 10.4, best public 13.1 over the decade).
        const labs = [...s.rivals, s.china.lab];
        for (const m of [V0, ...labs.flatMap((r) => [r.internal, r.publicModel!, ...(r.lineup ?? [])])]) {
          if (!m) continue;
          if (m.build) m.build.gPre += opts.freezeAt - gOfBuild(m.build);
          m.G = opts.freezeAt;
          m.Lg = levelOfG(w, m.G);
          m.domains = domainsOf(w, m.G);
        }
      }
      hist[s.time.day] = V0.G;
      let VP = s.player.models.versions.find((v) => v.id === 'VP');
      if (!VP) {
        VP = JSON.parse(JSON.stringify(V0)) as ModelVersion;
        VP.id = 'VP';
        VP.name = V0.name.replace(/-\d.*$/, '') + '-public';
        VP.status = 'deployed';
        s.player.models.versions.push(VP);
        for (const d of s.player.deployments) if (d.channel !== 'internal') d.versionId = 'VP';
      }
      // Public = internal frontier minus `lag` levels, never below the start model (λ's inverse).
      const g0 = hist.find((x) => x !== undefined) ?? V0.G;
      const Lt = Math.max(levelOfG(w, g0), V0.Lg - lag);
      VP.G = Math.min(Math.max(g0, V0.G), Math.max(g0, gOfLevel(w, Lt)));
      VP.Lg = levelOfG(w, VP.G);
      VP.domains = domainsOf(w, VP.G);
      if (opts.compute !== false) {
        s.player.computeOnline = logInterp(REF_COMPUTE, yr);
        s.player.split = shareRefAt(yr);
        s.market.supplyQ = logInterp(REF_PROD, yr) / 4;
        s.market.listPrice = logInterp(REF_PRICE, yr);
      }
      // Product management: every week re-reserve serving capacity in proportion to each deployment's demand.
      if (opts.rebalance !== false && s.time.day % 7 === 0) {
        const rd = revenueReadout(s);
        const tot = rd.deps.reduce((a, x) => a + x.demand, 0);
        if (tot > 0) {
          for (const x of rd.deps) {
            const d = s.player.deployments.find((y) => y.id === x.id);
            if (d) d.servingShare = Math.max(0.02, x.demand / tot);
          }
          const sum = rd.deps.reduce((a, x) => a + (s.player.deployments.find((y) => y.id === x.id)?.servingShare ?? 0), 0);
          for (const x of rd.deps) {
            const d = s.player.deployments.find((y) => y.id === x.id);
            if (d) d.servingShare /= sum;
          }
        }
      }
      const k = s.player.finance.revenueRun / 12;
      for (const r of s.rivals) r.finance.revenueRun = (rivalRev0.get(r.core.id) ?? 1) * k;
      s.china.lab.finance.revenueRun = cnRev0 * k;
    },
  };
}

export function refGame(over: Partial<SetupV2> = {}): GameStateV2 {
  return newGame(defaultSetupV2({ seed: 2027, world: 'tl-central', alignment: 'medium', baseline: 'classic', ...over }));
}
