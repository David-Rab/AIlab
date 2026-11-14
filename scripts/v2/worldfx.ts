// WS5 acceptance: outside world and revenue (V2-SPEC §7.3, F11 with WS3; research/16 §6–7). Owner: WS5.
//
// Reference play = scripts/v2/worldfx-refplay.ts probe (AI 2027 compute path, public release lag, serving
// rebalanced to demand) while WS1/WS3/WS4 systems are M0 stubs. Date targets use ±3 months (R16 §7 test 1).
import { dayOfDate, decimalYear } from '../../src/engine/v2/core/time';
import { makeCtx, tick } from '../../src/engine/v2/core/loop';
import { ACTIONS } from '../../src/engine/v2/core/registry';
import { thresholds } from '../../src/engine/v2/world/calibration';
import { LEVERAGE_THRESHOLDS, leverage, leverageTier } from '../../src/engine/v2/worldfx/control';
import { HEADLINES } from '../../src/engine/v2/worldfx/headlines';
import { automationTfp } from '../../src/engine/v2/worldfx/macro';
import { POLICY_FLAGS } from '../../src/engine/v2/worldfx/policy';
import { firmAdoption, remoteWorkAutomation, youthExposedEmployment } from '../../src/engine/v2/worldfx/readouts';
import { revenueOf } from '../../src/engine/v2/worldfx/revenue';
import type { GameStateV2, SetupV2, TickOptions } from '../../src/engine/v2/types';
import { check, finish, validateJson } from './lib';
import { refGame, refPlayProbe } from './worldfx-refplay';

const START = '2025-07-01';
const D = (iso: string) => dayOfDate(START, iso);
const fmt = (day: number | undefined) => (day === undefined ? 'never' : new Date(Date.parse(START) + day * 864e5).toISOString().slice(0, 10));
const within = (day: number | undefined, iso: string, tol = 92) => day !== undefined && Math.abs(day - D(iso)) <= tol;
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

interface Trace {
  s: GameStateV2;
  annual: Record<number, number>;
  U: number[];
  firstHire10?: number;
  firstRemote25?: number;
  firstU12?: number;
  firstAccept85?: number;
  at: Record<string, { dow: number; U: number; youthSoft: number; youthU: number; friend: number; hireSoft: number; youthX: number; firm: number; rev: number }>;
}

const MARKS = ['2025-07-31', '2026-01-01', '2026-11-01', '2026-12-31', '2027-07-01', '2027-10-01', '2027-12-31'];

function run(over: Partial<SetupV2>, days: number, opts: Parameters<typeof refPlayProbe>[1] = {}, extra: TickOptions = {}): Trace {
  const s = refGame(over);
  const probe = refPlayProbe(s, opts);
  const tr: Trace = { s, annual: {}, U: [], at: {} };
  const marks = new Map(MARKS.map((m) => [D(m), m]));
  const tickOpts: TickOptions = { ...extra, extraSystems: [probe, ...(extra.extraSystems ?? [])] };
  while (s.time.day < days) {
    tick(s, tickOpts);
    const d = s.time.day;
    const W = s.world;
    const rev = s.player.deployments.reduce((a, x) => a + (x.revenueRate ?? 0), 0);
    const y = Math.floor(decimalYear(s));
    tr.annual[y] = (tr.annual[y] ?? 0) + rev / 365;
    tr.U[d] = W.unemployment.US;
    if (tr.firstHire10 === undefined && W.sectors.US.SOFT.hireRate <= 0.1) tr.firstHire10 = d;
    if (tr.firstRemote25 === undefined && remoteWorkAutomation(s) >= 0.25) tr.firstRemote25 = d;
    if (tr.firstU12 === undefined && d >= 365 && W.unemployment.US - tr.U[d - 365] >= 1) tr.firstU12 = d;
    if (tr.firstAccept85 === undefined && W.control.GOV.accept >= 0.85) tr.firstAccept85 = d;
    const m = marks.get(d);
    if (m) {
      tr.at[m] = {
        dow: W.dow, U: W.unemployment.US, youthSoft: W.fx.youthRel.SOFT, youthU: W.youthUnemployment, friend: W.friendShare,
        hireSoft: W.sectors.US.SOFT.hireRate, youthX: youthExposedEmployment(s), firm: firmAdoption(s), rev: s.player.finance.revenueRun,
      };
    }
  }
  return tr;
}

// ───────────── 1. Classic baseline, ai2027 econ, reference play (§7.3 table, F11) ─────────────
const c = run({ baseline: 'classic', econ: 'ai2027' }, D('2028-04-01'));
const at = c.at;
const U0 = 4.3;
console.log('Classic / ai2027 econ / reference play');
check(Math.abs(refGame().player.finance.revenueRun - 12) < 1e-9, 'F11 revenue run-rate at start = $12B', '');
check(at['2025-07-31'].rev >= 9 && at['2025-07-31'].rev <= 16.5, 'F11 Jul 2025 run-rate ≈ $12B (capacity-bound, ±35%)', `$${at['2025-07-31'].rev.toFixed(1)}B`);
check(c.annual[2026] >= 36 && c.annual[2026] <= 54, 'F7/F11 2026 revenue $45B (±20%)', `$${c.annual[2026].toFixed(1)}B`);
check(c.annual[2027] >= 98 && c.annual[2027] <= 182, 'F11 2027 revenue ~$140B (±30%)', `$${c.annual[2027].toFixed(1)}B`);
const eq26 = at['2026-12-31'].dow / at['2026-01-01'].dow - 1;
check(eq26 >= 0.2 && eq26 <= 0.4, 'Late 2026: equity +30% in 2026 (±10 pp)', pct(eq26));
check(at['2026-12-31'].youthSoft < at['2026-01-01'].youthSoft - 0.03 && at['2026-12-31'].hireSoft < at['2026-01-01'].hireSoft && at['2026-12-31'].youthU > at['2026-01-01'].youthU,
  'Late 2026: SOFT youth employment falling, youth unemployment rising',
  `SOFT 22–25 ${at['2026-01-01'].youthSoft.toFixed(3)} → ${at['2026-12-31'].youthSoft.toFixed(3)}; hire ${at['2026-01-01'].hireSoft.toFixed(2)} → ${at['2026-12-31'].hireSoft.toFixed(2)}; youth U ${at['2026-01-01'].youthU.toFixed(1)} → ${at['2026-12-31'].youthU.toFixed(1)}%`);
check(at['2026-12-31'].U - U0 < 0.3, 'Late 2026: aggregate U < +0.3 pp', `${(at['2026-12-31'].U - U0).toFixed(2)} pp`);
check(within(c.firstHire10, '2027-07-01'), 'Jul 2027 (±3 mo): HireRate_SOFT ≤ 10%', fmt(c.firstHire10));
check(at['2027-07-01'].friend >= 0.07 && at['2027-07-01'].friend <= 0.13, 'Jul 2027: AI-friend share 10% (±3)', pct(at['2027-07-01'].friend));
check(within(c.firstRemote25, '2027-10-01'), 'Oct 2027 (±3 mo): 25% of remote-work jobs done by AI', fmt(c.firstRemote25));
check(within(c.firstU12, '2027-10-01'), 'Oct 2027 (±3 mo): U +1 pp over 12 months', fmt(c.firstU12));
check(within(c.firstAccept85, '2027-12-15'), 'Dec 2027 (±3 mo): GOV T1 Accept ≥ 0.85', fmt(c.firstAccept85));
check(validateJson(c.s).length === 0, 'world state stays plain JSON (classic run)', validateJson(c.s).slice(0, 3).join('; '));
const fired = new Set(c.s.headlines.map((h) => h.id.split(':')[0]));
const once = HEADLINES.filter((h) => h.cooldownDays === undefined).every((h) => c.s.headlines.filter((x) => x.id === h.id).length <= 1);
check(fired.size >= 10 && once, 'headlines: ≥10 distinct fire on the reference path; one-shot ones fire once', [...fired].join(' '));
check(c.s.player.deployments.filter((d) => d.channel !== 'internal').every((d) => d.revenueRate !== undefined && d.demandBound !== undefined && revenueOf(c.s, d.id) === d.revenueRate),
  'revenue writes revenueRate and demandBound on every external deployment');

// ───────────── 2. Reality baseline at Nov 2026 (W4) ─────────────
{
  const r = run({ baseline: 'reality', econ: 'ai2027', world: 'ai2027' }, D('2026-11-02'));
  const a = r.at['2026-11-01'];
  console.log('Reality baseline / ai2027 world');
  check(Math.abs(a.U - U0) <= 0.15, 'W4: aggregate unemployment effect ≈ 0 at Nov 2026', `${(a.U - U0).toFixed(2)} pp`);
  check(a.youthX >= 0.76 && a.youthX <= 0.86, 'W4: exposed 22–25-year-olds −19% vs counterfactual (±5 pp)', `${((a.youthX - 1) * 100).toFixed(1)}%`);
  check(a.firm >= 0.15 && a.firm <= 0.22, 'W4: firm adoption 17–20% (±2 pp)', pct(a.firm));
  // Informational: the slower authors2026 timeline (SC 2029.7) gives weaker 2026 effects.
  const b = run({ baseline: 'reality', econ: 'ai2027', world: 'authors2026' }, D('2026-11-02')).at['2026-11-01'];
  console.log(`INFO  W4 on authors2026 world: U ${(b.U - U0).toFixed(2)} pp, exposed 22–25 ${((b.youthX - 1) * 100).toFixed(1)}%, firm adoption ${pct(b.firm)}`);
}

// ───────────── 3. W2: Normal Technology + Agent-1-level models → TFP +0.5–1% per decade ─────────────
{
  const s = refGame({ econ: 'normal' });
  const pmA1 = thresholds(s.hidden.timeline)[1];
  const probe = refPlayProbe(s, { freezeAt: pmA1, publicLag: 0 });
  const opts: TickOptions = { extraSystems: [probe], skip: ['production', 'continual'] };
  tick(s, opts);
  const tfp0 = automationTfp(s);
  while (s.time.day < 3651) tick(s, opts);
  const dT = automationTfp(s) - tfp0;
  check(dT >= 0.005 && dT <= 0.01, 'W2: Normal Technology, Agent-1-level models: automation TFP +0.5–1% over a decade (Acemoglu band)', pct(dT));
}

// ───────────── 4. W3: cognitive-only automation ≤ 2.2× GDP without W17 ─────────────
for (const econ of ['ai2027', 'gate'] as const) {
  const t = run({ econ }, D('2031-01-01'), { publicLag: 0 });
  const X = Math.max(...(['US', 'CN', 'ROW'] as const).map((r) => t.s.world.fx.autoLevel[r]));
  check(t.s.world.techs.W17.discoveredDay === undefined && X <= 2.2, `W3 ${econ}: no SEZ → no W17, automation output factor ≤ 2.2`, `X ${X.toFixed(2)}, ASI-level models, g ${pct(t.s.world.macro.US.g)}`);
}

// ───────────── 5. SEZ path: robots, W17, explosive growth ─────────────
{
  const s = refGame();
  const probe = refPlayProbe(s, { publicLag: 0 });
  const opts: TickOptions = { extraSystems: [probe] };
  while (s.time.day < D('2028-01-01')) tick(s, opts);
  s.flags[POLICY_FLAGS.sez] = true;
  let maxG = 0;
  let d1M: number | undefined;
  while (s.time.day < D('2031-01-01')) {
    tick(s, opts);
    maxG = Math.max(maxG, s.world.macro.US.g);
    if (d1M === undefined && (s.world.robots.prodPerYear + s.world.fx.humanoidProd) / 12 >= 1e6) d1M = s.time.day;
  }
  check(s.world.robots.sezOpen && d1M !== undefined && d1M <= D('2029-06-01'), 'SEZ (Jan 2028): ~1M robots/month within about a year (AI 2027: end-2028)', fmt(d1M));
  check(s.world.techs.W17.discoveredDay !== undefined && maxG >= 0.3, 'SEZ + W17: explosive growth (> 30%/yr) becomes possible', `W17 ${fmt(s.world.techs.W17.discoveredDay)}, max g ${pct(maxG)}`);
}

// ───────────── 6. Control / leverage and actions ─────────────
{
  const s = c.s;
  const lev = leverage(s, 'player');
  check(lev >= 0 && lev < 1 && ['none', 'entrenched', 'indispensable', 'decisive'].includes(leverageTier(s, lev)), 'leverage(player) in [0,1) with a tier', `${lev.toFixed(3)} (${leverageTier(s, lev)}; thresholds ${Object.values(LEVERAGE_THRESHOLDS).join('/')})`);
  const s2 = refGame();
  for (let i = 0; i < 30; i++) tick(s2);
  const ctx = makeCtx(s2);
  const wa = ACTIONS.filter((a) => a.owner === 'WS5');
  check(wa.length === 3, 'three World actions registered', wa.map((a) => a.id).join(', '));
  const cash0 = s2.player.finance.cash;
  const tf = wa.find((a) => a.id === 'wfx.transitionFund')!;
  tf.apply(s2, ctx, { amount: 10 });
  for (let i = 0; i < 365; i++) tick(s2);
  check(s2.player.policies.transitionFund === 10 && s2.player.finance.cash < cash0 + 1e3, 'transition fund: set and paid from cash');
  const sp = wa.find((a) => a.id === 'wfx.sectorProduct')!;
  const ok = sp.available(s2);
  sp.apply(s2, makeCtx(s2), { sector: 'LEGAL' });
  const host = s2.player.deployments.find((d) => d.sectorFocus.includes('LEGAL'));
  check(ok === true && !!host && s2.world.fx.certDay.LEGAL === s2.time.day + 120, 'sector product: focus added, certification in 120 days');
  const ms = wa.find((a) => a.id === 'wfx.moonshot')!;
  const pv = ms.preview(s2, { tech: 'W03', share: 0.05 });
  ms.apply(s2, makeCtx(s2), { tech: 'W03', share: 0.05 });
  const prog0 = s2.world.techs.W03.prog;
  for (let i = 0; i < 60; i++) tick(s2);
  check((s2.world.techs.W03.playerProject?.computeShare ?? 0) > 0 && (s2.world.techs.W03.prog > prog0 || s2.world.techs.W03.discoveredDay !== undefined) && pv.costs.some((x) => x.currency === 'compute'),
    'moonshot: compute assigned, tech advances, preview costs compute', `W03 ${prog0.toFixed(3)} → ${s2.world.techs.W03.prog.toFixed(3)}`);
}

finish('worldfx');
