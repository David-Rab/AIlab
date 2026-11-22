// RD-T03 targeted check (day-400 fixture, mechanism called directly, no simulation): the continual-learning stream
// spends the FLOP it gets. Player: a period with 0 FLOP changes nothing (no free recipe re-application); the gain in
// effective compute is proportional to the FLOP spent; the daily system spends a period's accrued FLOP every 7 days.
// Rivals: the same rule at aggregate level (0 FLOP adds nothing, gain ∝ FLOP) and no level threshold: a lab just under
// and just over the old Research-agent level (8.5) gains the same from the same FLOP.
// Run alone: npx tsx scripts/v2/_t03/check.ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize } from '../../../src/engine/v2/core/save';
import { streamFlopPerDay, streamPeriodBuild, startStream, continualSystem } from '../../../src/engine/v2/models/runs';
import { internalVersion } from '../../../src/engine/v2/models/labs';
import { gOfBuild, gOfLevel, levelOfG } from '../../../src/engine/v2/models/capability';
import { clApply, clFlopPerDay, clRefresh } from '../../../src/engine/v2/actors/rivalModel';
import { STREAM_PERIOD_DAYS } from '../../../src/data/v2/runDesign';
import type { GameStateV2, SystemCtx } from '../../../src/engine/v2/types';
import { FIXTURE_DIR } from '../lib';

const raw = readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8');
const fresh = (): GameStateV2 => deserialize(raw);
const checks: [string, boolean, string][] = [];

// ── player ──
{
  const s = fresh();
  const v = internalVersion(s)!;
  const b0 = v.build!;
  const G0 = gOfBuild(b0);
  const F = streamFlopPerDay(s) * STREAM_PERIOD_DAYS;
  const zero = streamPeriodBuild(s, structuredClone(v), 0);
  checks.push(['player: 0 FLOP adds nothing', gOfBuild(zero) === G0 && zero.gPre === b0.gPre && zero.eRL === b0.eRL, `ΔG ${gOfBuild(zero) - G0}`]);
  // Effective pretraining compute added per FLOP (10^gPre' − 10^gPre) / FLOP_pre and effective RL compute per RL FLOP.
  const per = (k: number) => {
    const nb = streamPeriodBuild(s, structuredClone(v), F * k);
    const pre = nb.flopPre - b0.flopPre;
    const rl = nb.rlFlop - b0.rlFlop;
    const effPre = (Math.pow(10, nb.gPre) - Math.pow(10, b0.gPre)) / pre;
    const effRl = (nb.rlFlop * Math.pow(10, nb.eRL) - b0.rlFlop * Math.pow(10, b0.eRL)) / rl;
    return { k, dG: gOfBuild(nb) - G0, pre, rl, effPre, effRl };
  };
  const rows = [per(0.5), per(1), per(2)];
  for (const r of rows) console.log(`player k ${r.k}: pre ${r.pre.toExponential(3)} FLOP, RL ${r.rl.toExponential(3)} FLOP, ΔG ${r.dG.toFixed(5)} OOM, eff/FLOP pre ${r.effPre.toExponential(4)} RL ${r.effRl.toExponential(4)}`);
  const near = (a: number, b: number, tol: number) => Math.abs(a / b - 1) < tol;
  checks.push(['player: FLOP spent ∝ pool FLOP', near(rows[2].pre, 4 * rows[0].pre, 1e-9) && near(rows[2].rl, 4 * rows[0].rl, 1e-9), '']);
  // Data factor of the added tokens moves a little with the draw size: allow 5%.
  checks.push(['player: effective compute added ∝ FLOP spent (per-FLOP worth constant)', near(rows[0].effPre, rows[2].effPre, 0.05) && near(rows[0].effRl, rows[2].effRl, 1e-9), `${rows[0].effPre.toExponential(3)} vs ${rows[2].effPre.toExponential(3)}`]);
  checks.push(['player: more FLOP, more G', rows[0].dG > 0 && rows[1].dG > rows[0].dG && rows[2].dG > rows[1].dG, rows.map((r) => r.dG.toFixed(5)).join(' < ')]);
  // The daily system: no change for 6 days, the accrued FLOP spent on day 7.
  s.player.paradigms.P08 = { ...(s.player.paradigms.P08 ?? { progress: 1 }), status: 'adopted' } as GameStateV2['player']['paradigms']['P08'];
  const err = startStream(s, v.id, s.time.day);
  const Gs = gOfBuild(v.build!);
  const ctx = (day: number) => ({ day }) as unknown as SystemCtx;
  let early = true;
  for (let d = 1; d <= STREAM_PERIOD_DAYS; d++) {
    continualSystem.run(s, ctx(s.time.day + d));
    if (d < STREAM_PERIOD_DAYS && gOfBuild(v.build!) !== Gs) early = false;
  }
  const dSys = gOfBuild(v.build!) - Gs;
  checks.push(['player: start changes nothing; the system spends the period on day 7', !err && early && dSys > 0 && near(dSys, rows[1].dG, 0.02), `${err ?? ''} ΔG ${dSys.toFixed(5)} vs ${rows[1].dG.toFixed(5)}`]);
}

// ── rivals ──
{
  const s = fresh();
  const w = s.hidden.timeline;
  const gain = (k: number, L?: number) => {
    const c = structuredClone(s);
    const r = c.rivals[0];
    if (L !== undefined) r.internal.G = gOfLevel(w, L);
    const G0 = r.internal.G;
    const lv = levelOfG(w, G0);
    clApply(c, r, 0);
    const c0 = r.phys.cl ?? { gPre: r.phys.base.gPre, mid: r.phys.rec.mid };
    const cl0 = { gPre: c0.gPre, mid: c0.mid };
    clApply(c, r, clFlopPerDay(r) * 7 * k);
    const cl1 = r.phys.cl ?? cl0;
    // Effective compute added: pretraining 10^gPre, RL 10^mid (at the reference RL FLOP).
    return { dG: r.internal.G - G0, L: lv, ePre: Math.pow(10, cl1.gPre) - Math.pow(10, cl0.gPre), eRl: Math.pow(10, cl1.mid) - Math.pow(10, cl0.mid) };
  };
  const z = gain(0);
  const g1 = gain(1);
  const g2 = gain(2);
  console.log(`rival ${s.rivals[0].core.id}: ΔG 0 FLOP ${z.dG}, 1 week ${g1.dG.toFixed(5)}, 2 weeks ${g2.dG.toFixed(5)} OOM; effective pretraining compute ratio ${(g2.ePre / g1.ePre).toFixed(4)}, RL ${(g2.eRl / g1.eRl).toFixed(4)}`);
  checks.push(['rival: 0 FLOP adds nothing', z.dG === 0, '']);
  checks.push(['rival: effective compute added ∝ FLOP (pretraining and RL parts ×2 for 2× FLOP)', g1.dG > 0 && g2.dG > g1.dG && Math.abs(g2.ePre / g1.ePre - 2) < 1e-6 && Math.abs(g2.eRl / g1.eRl - 2) < 1e-6, '']);
  const lo = gain(1, 8.4);
  const hi = gain(1, 8.6);
  console.log(`rival at L ${lo.L.toFixed(2)}: ΔG ${lo.dG.toFixed(5)}; at L ${hi.L.toFixed(2)}: ΔG ${hi.dG.toFixed(5)}`);
  checks.push(['rival: no level threshold (same gain under and over L 8.5)', lo.L < 8.5 && hi.L > 8.5 && lo.dG > 0 && Math.abs(lo.dG - hi.dG) < 1e-12, '']);
  // The refresh: first call starts the period, nothing before 7 days, then the accrued FLOP.
  const c = structuredClone(s);
  const r = c.rivals[0];
  delete r.phys.clDay;
  const d0 = c.time.day;
  const G0 = r.internal.G;
  const a = clRefresh(c, r, d0);
  const b = clRefresh(c, r, d0 + 6);
  const moved = clRefresh(c, r, d0 + 7);
  checks.push(['rival: refresh spends the period every 7 days', !a && !b && moved && r.internal.G > G0, `${(r.internal.G - G0).toFixed(5)}`]);
}

let ok = true;
for (const [name, pass, detail] of checks) {
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
  ok &&= pass;
}
if (!ok) process.exit(1);
