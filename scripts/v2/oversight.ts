// E6: oversight measured in capability gaps (OOM of effective compute between the overseen model and its overseer), not
// in the research multiplier M (MODEL-V3 §11.5–11.6, research/20 F4). Monitor catch vs the Engels et al. 2025 anchor,
// same-lineage collusion, tool decay above the validated capability, the control tax (Greenblatt et al. 2023), human
// review, the save migration's equivalence, and a lint: no safety module reads M.
import { addSafeguard, setControl } from '../../src/engine/v2/safety/safeguards';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ENGELS_400, MONITOR_CATCH_BASE, OOM_PER_400_ELO } from '../../src/data/v2/oversight';
import { LEVEL_KNOTS } from '../../src/data/v2/calibration';
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { labourOf, resetSafetyLabour, resetWorkContext } from '../../src/engine/v2/departments/workfit';
import { agentsView } from '../../src/engine/v2/departments/agentActions';
import { gOfLevel, gV0, levelKnotsG, levelOfG } from '../../src/engine/v2/models/capability';
import { catchRate } from '../../src/engine/v2/models/products';
import {
  controlProtocol, gapFactor, humanReviewFactor, levelOfOom, monitorCatchAt, oomOfLevel, oversightGap, useControl, versionOom,
} from '../../src/engine/v2/safety/oversight';
import { decayAt, decayOom, strengthTrue } from '../../src/engine/v2/safety/techniques';
import { sightLimit, trueSightLimit } from '../../src/engine/v2/safety/sightLimit';
// SR-11: the sight limit in the shape these analyses read (U = sight limit, margin = sight limit − level).
const understanding = (s: GameStateV2) => { const r = sightLimit(s); return { U: r.L, margin: r.gap, perTrait: r.perTrait }; };
void trueSightLimit;
import type { GameStateV2, ModelVersion } from '../../src/engine/v2/types';
import { HERE, check, finish } from './lib';

const fresh = (seed = 2027) => newGame(defaultSetupV2({ seed, world: 'ai2027', alignment: 'medium', tutorial: false }));
const near = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) <= tol;
function cloneVersion(s: GameStateV2, from: ModelVersion, id: string, over: Partial<ModelVersion>): ModelVersion {
  const v = { ...JSON.parse(JSON.stringify(from)), id, name: `${from.name}-${id}`, status: 'ready', ...over } as ModelVersion;
  s.player.models.versions.push(v);
  return v;
}
const reset = (s: GameStateV2) => { resetWorkContext(s); resetSafetyLabour(s); };

// ───────────── the level ↔ OOM map ─────────────
{
  const s = fresh();
  const w = s.hidden.timeline;
  const trip = [0.5, 3, 5, 7.5, 10, 11, 12, 13, 14.5].every((L) => near(levelOfOom(w, oomOfLevel(w, L)), L, 1e-9));
  check(trip && near(oomOfLevel(w, LEVEL_KNOTS[0]), 0, 1e-12), 'map: oomOfLevel is the inverse of λ(G) (round trip on 0.5 … 14.5; V0 = 0 OOM)');
  check([0, 1.5, 3, 6, 9].every((x) => near(levelOfOom(w, x), levelOfG(w, gV0(w) + x))), 'map: levelOfOom(x) = λ(G_V0 + x)');
}

// ───────────── RD-U02: one λ (oomOfLevel = gOfLevel − G_V0; versionOom = G − G_V0) ─────────────
{
  // The deleted duplicate (safety/oversight.ts before RD-U02), kept here only to show behaviour is unchanged on [0, 15].
  const LA = [LEVEL_KNOTS[0], LEVEL_KNOTS[3], LEVEL_KNOTS[4], LEVEL_KNOTS[5], LEVEL_KNOTS[6]];
  const oldOom = (w: GameStateV2['hidden']['timeline'], L: number) => {
    const g = levelKnotsG(w);
    const g0 = gV0(w);
    if (L <= LA[0]) return g[0] + (L - LA[0]) * ((g[1] - g[0]) / (LA[1] - LA[0])) - g0;
    for (let i = 0; i < g.length - 1; i++) if (L < LA[i + 1]) return g[i] + ((L - LA[i]) * (g[i + 1] - g[i])) / (LA[i + 1] - LA[i]) - g0;
    return g[g.length - 1] - g0;
  };
  let worst = 0;
  let oneSource = true;
  for (const world of ['ai2027', 'authors2026', 'fast', 'slow'] as const) {
    for (const seed of [1, 7]) {
      const w = newGame(defaultSetupV2({ seed, world, alignment: 'medium', tutorial: false })).hidden.timeline;
      for (let L = 0; L <= 16; L += 0.25) {
        worst = Math.max(worst, Math.abs(oomOfLevel(w, L) - oldOom(w, L)));
        oneSource &&= oomOfLevel(w, L) === gOfLevel(w, L) - gV0(w);
      }
    }
  }
  check(oneSource && worst < 1e-9, 'RD-U02: oomOfLevel = gOfLevel − G_V0 and equals the deleted duplicate on L 0 … 16 (4 worlds × 2 seeds)', `max |Δ| ${worst.toExponential(2)}`);
  const s = fresh();
  const w = s.hidden.timeline;
  const v0 = s.player.models.versions[0];
  const asiG = levelKnotsG(w)[4];
  const a = cloneVersion(s, v0, 'u02a', { G: asiG + 0.5, Lg: 15 });
  const b = cloneVersion(s, v0, 'u02b', { G: asiG + 2, Lg: 15 });
  check(near(versionOom(s, a), asiG + 0.5 - gV0(w)) && versionOom(s, b) - versionOom(s, a) > 1.4, 'RD-U02: two post-ASI models get different versionOom (true G − G_V0)',
    `${versionOom(s, a).toFixed(3)} vs ${versionOom(s, b).toFixed(3)}`);
  const sub = [0.5, 3, 7, 11, 14.5].every((L) => near(versionOom(s, { ...v0, G: gOfLevel(w, L), Lg: L }), oomOfLevel(w, L), 1e-9));
  check(sub, 'RD-U02: below λ 15 versionOom (G − G_V0) equals the old λ⁻¹(Lg) − G_V0');
}

// ───────────── (a) monitor catch rate vs the capability gap (Engels et al. 2025) ─────────────
{
  const gaps = [0, 0.5, 1, 2, 4, OOM_PER_400_ELO, 9, 12];
  const c = gaps.map(monitorCatchAt);
  check(c.every((x, i) => i === 0 || x < c[i - 1]), 'catch: a monitor\'s catch falls with the capability gap (0 → 12 OOM)', c.map((x) => x.toFixed(3)).join(' '));
  check(near(monitorCatchAt(0), MONITOR_CATCH_BASE) && near(monitorCatchAt(OOM_PER_400_ELO), ENGELS_400.backdoorCode, 1e-12),
    'catch: 85% with no gap; Engels\' Backdoor Code 10% at the mapped 400-Elo gap (6.8 OOM)', `${monitorCatchAt(OOM_PER_400_ELO).toFixed(4)}`);
  check(monitorCatchAt(OOM_PER_400_ELO) >= 0.09 && monitorCatchAt(OOM_PER_400_ELO) <= 0.52, 'catch: within Engels\' 9–52% band at 400 Elo');
  check(Math.abs(monitorCatchAt(1) - 0.62) < 0.01, 'catch: a monitor ≈ 1 OOM weaker catches ≈ 62% (Greenblatt et al. 2023: GPT-3.5 trusted monitoring GPT-4)', monitorCatchAt(1).toFixed(3));

  // On real versions: levels → gap in OOM → catch; a weaker monitor catches less.
  // CP3 rewrite (SR-12 / RD-UI0a): the real catch reads the true level (Lg); the measured one only for the believed rate.
  const s = fresh();
  const w = s.hidden.timeline;
  const v0 = s.player.models.versions[0];
  const hi = cloneVersion(s, v0, 'VH', { baseId: 'B-hi' });
  hi.Lg = 12;
  const mons = [12, 11, 10, 8, 5].map((L, i) => { const m = cloneVersion(s, v0, `VM${i}`, { baseId: `B-m${i}` }); m.Lg = L; return m; });
  const rates = mons.map((m) => catchRate(s, hi, m, false, false));
  check(rates.every((r, i) => i === 0 || r.rate < rates[i - 1].rate) && rates[0].gap === 0,
    'catch: on versions, the catch rate falls as the monitor\'s level drops below the watched model\'s (L 12 watched by L 12 → 5)',
    rates.map((r) => `${r.rate.toFixed(2)} (${r.gap.toFixed(1)} OOM)`).join(', '));
  const g = oversightGap(w, 12, 10);
  check(near(rates[2].gap, g.oom) && near(rates[2].base, monitorCatchAt(g.oom)) && near(g.elo, (g.oom * 400) / OOM_PER_400_ELO) && g.levels === 2,
    'catch: catchRate reads the gap in OOM (levels and Elo as readouts)', `L12 vs L10: ${g.oom.toFixed(2)} OOM, ${g.levels} levels, ${Math.round(g.elo)} Elo`);
  // Find the mapped 400-Elo gap on the level map and check the anchor there.
  const xHi = oomOfLevel(w, 15);
  const L400 = levelOfOom(w, xHi - OOM_PER_400_ELO);
  const m400 = cloneVersion(s, v0, 'V400', { baseId: 'B-400' });
  m400.Lg = L400;
  const top = cloneVersion(s, v0, 'VT', { baseId: 'B-top' });
  top.Lg = 14.9999;
  const r400 = catchRate(s, top, m400, false, false);
  check(Math.abs(r400.base - ENGELS_400.backdoorCode) < 0.002, 'catch: a monitor 400 Elo (6.8 OOM) below an ASI-level model catches 10% before control tools', `monitor L ${L400.toFixed(2)}: ${r400.base.toFixed(4)}`);

  // (a) same-lineage collusion kept.
  const copy = cloneVersion(s, hi, 'VC', {});
  const cc = catchRate(s, hi, copy, false, false);
  check(cc.copy && cc.gap === 0 && near(cc.collusion, cc.rate * 0.6), 'collusion: a same-lineage monitor (no gap) catches collusion-relevant acts ×0.6', `${cc.rate.toFixed(3)} → ${cc.collusion.toFixed(3)}`);
  // CP3 rewrite (SR-13): the comms lockdown is a safeguard item on the internal deployment (replaces owning T-LOCK).
  const lock = s.player.safety.techniques['T-LOCK'];
  lock.unlocked = true;
  lock.active = true;
  const lockWhy = addSafeguard(s, s.player.deployments.find((d) => d.channel === 'internal' && d.status === 'live')!, 'lockdown');
  const cl = catchRate(s, hi, copy, false, false);
  check(!lockWhy && near(cl.collusion, cl.rate * 0.8), 'collusion: comms lockdown (safeguard item) halves the same-lineage penalty (×0.8)', lockWhy ?? `${cl.rate.toFixed(3)} → ${cl.collusion.toFixed(3)}`);
  check(!catchRate(s, hi, mons[2], false, false).copy && near(catchRate(s, hi, mons[2], false, false).collusion, catchRate(s, hi, mons[2], false, false).rate), 'collusion: a monitor from another base has no penalty');
}

// ───────────── (b) technique decay above the validated capability ─────────────
{
  const s = fresh();
  const w = s.hidden.timeline;
  const t = s.player.safety.techniques['T-PROP']; // AG08, v2 M½ 25 (SAR), k 1
  const xs = [0, 2, 4, 6, 8, 10, 12];
  const str = xs.map((x) => strengthTrue(s, t, x));
  check(str.every((x, i) => i === 0 || x < str[i - 1]), 'decay: a tool\'s strength falls as the overseen model grows past its validated capability (0 → 12 OOM)', str.map((x) => x.toFixed(3)).join(' '));
  check(near(decayAt(s, t, t.oHalf, false), 0.5) && near(t.oHalf, oomOfLevel(w, 12), 0.005), 'decay: half strength at oHalf; AG08\'s is the SAR level (v2 M½ 25)', `oHalf ${t.oHalf} ≈ L${levelOfOom(w, t.oHalf).toFixed(2)}`);
  // v2 equivalence at the half points: 1/(1 + (M/M½)^k) = ½ at M = M½; RD-U03 stores those points as OOM literals.
  const pts: [string, number][] = [['T-PROP', 4.218], ['T-TMON', 4.678], ['T-PROBE', 10.018], ['T-COTMON', 10.018]];
  check(pts.every(([id, x]) => near(decayAt(s, s.player.safety.techniques[id], x, false), 0.5, 0.01)), 'decay: v2\'s half points kept as OOM literals (AG08 4.218, AG07 4.678, AG02/AG09 10.018)');
  // Re-validation (tool upkeep) raises oHalf: the same model is seen better.
  const x = oomOfLevel(w, 12.5);
  const before = strengthTrue(s, t, x);
  t.oHalf += 1;
  check(strengthTrue(s, t, x) > before, 'decay: raising the validated capability (upkeep: oHalf +1 OOM) restores strength on the same model', `${before.toFixed(3)} → ${strengthTrue(s, t, x).toFixed(3)}`);
  check(decayOom(50, 1e9, 1) === 1 && decayOom(50, 3, 0) === 1, 'decay: k = 0 or oHalf = ∞ never decays');
  // AG05: Engels' debate rate per 400-Elo gap above an overseer at the SC level.
  const deb = { ...t, id: 'T-DEBATE', agenda: 'AG05' as const };
  const xo = oomOfLevel(w, 10);
  check(near(decayAt(s, deb, xo, false), 1) && near(decayAt(s, deb, xo + OOM_PER_400_ELO, false), ENGELS_400.debate, 1e-12),
    'decay: AG05 scalable oversight = 1 at the overseer\'s level, Engels\' debate 51.7% at a 400-Elo gap above it');
  // U is computed on levels through the OOM map (no M): it still exists and lies in [0, 15].
  const u = understanding(s);
  check(u.U >= 0 && u.U <= 15 && Number.isFinite(u.margin), 'understanding: U and its margin computed in levels', `U ${u.U}, margin ${u.margin}`);
}

// ───────────── (c) human review falls with the gap above expert humans ─────────────
{
  const s = fresh();
  const v = s.player.models.versions[0];
  const f = [5, 10, 11, 12, 13.5, 15].map((L) => { v.Lg = L; return humanReviewFactor(s, v); });
  check(f[0] === 1 && f[1] === 1 && f.slice(1).every((x, i) => i === 0 || x < f[i]), 'human review: full below expert-human level (L 10), then falls with the gap',
    f.map((x) => x.toFixed(3)).join(' '));
  check(near(gapFactor(OOM_PER_400_ELO), ENGELS_400.backdoorCode / MONITOR_CATCH_BASE), 'human review: the monitor rule as a factor');
}

// ───────────── (e) control tax on AI labour, and control raises catch ─────────────
{
  const p = controlProtocol(1);
  check(near(p.usefulness, 0.93) && near(p.missMult, 0.17 / 0.38) && near(controlProtocol(0).usefulness, 0.97) && near(controlProtocol(0.5).usefulness, 0.95),
    'control: Greenblatt trusted monitoring with 10% deferral: 93% usefulness at a 1-OOM-weaker trusted model, 97% with no gap; misses ×0.45',
    `u(1 OOM) ${p.usefulness.toFixed(3)}, u(0) ${controlProtocol(0).usefulness.toFixed(3)}, miss ×${p.missMult.toFixed(3)}`);
  const s = fresh();
  const v = s.player.models.versions[0];
  for (const k of Object.keys(v.traitsTrue) as (keyof typeof v.traitsTrue)[]) v.traitsTrue[k] = 0.4;
  const internal = s.player.deployments.find((d) => d.channel === 'internal')!;
  reset(s);
  const offSwe = labourOf(s, 'SWE');
  setControl(internal, true); for (const a of Object.values(s.player.agents)) a.control = true;
  reset(s);
  // CP3: three controlLayer-era checks deleted (SR-13: control is a safeguard item with settings; its Slowdown and stop
  // rates are _sr13/check.ts's): EXP ×0.97 / SWE ×0.93 labour, misses ×0.45, lane taxes 3% / 7%.
  // A weaker trusted monitor: the per-deferral loss grows with the gap.
  const mini = cloneVersion(s, v, 'VMINI', { baseId: 'B-mini' });
  mini.evals.measuredL = (v.evals.measuredL ?? v.Lg) - 1;
  const c1 = useControl(s, v, mini, true, false);
  check(c1.tax > 0.03 && c1.tax <= 0.07 + 1e-12, 'control tax: grows with the gap to the trusted model (between 3% and 7%)', `${c1.gapOom.toFixed(2)} OOM: ${(c1.tax * 100).toFixed(1)}%`);
  setControl(internal, false); for (const a of Object.values(s.player.agents)) delete a.control;
  reset(s);
  check(!agentsView(s).lanes.eng.control.on && near(labourOf(s, 'SWE').aiFte, offSwe.aiFte), 'control tax: none without the control layer');
}

// ───────────── lint: no safety module reads the research multiplier ─────────────
{
  const root = join(HERE, '..', '..', 'src', 'engine', 'v2');
  const files = [...readdirSync(join(root, 'safety')).filter((f) => f.endsWith('.ts')).map((f) => join(root, 'safety', f)), join(root, 'models/products.ts'), join(root, 'departments/agents.ts')];
  const bad = /\b(multiplierAt|multiplierRef|versionM|mAtLevel|mAtPm|bridgeQ|researchSpeed)\b|prodCache\??\.M\b/;
  // No exceptions: E4's successor pull replaced the lineage inheritance κ·(1 − 1/M) and reads E6's internalOversight (E7 step 0).
  const hits: string[] = [];
  for (const f of files) {
    const lines = readFileSync(f, 'utf8').split('\n');
    lines.forEach((l, i) => {
      const code = l.replace(/\/\/.*$/, '');
      if (/^\s*(\*|\/\*\*)/.test(l) || !bad.test(code)) return;
      hits.push(`${f.slice(root.length + 1)}:${i + 1}`);
    });
  }
  check(hits.length === 0, 'lint: no safety module (nor the monitor catch code) reads M (multiplierAt / versionM / mAtLevel / the M bridge)', hits.join(', ') || 'none (E4 removed the lineage-inheritance read)');
}

finish('oversight');
