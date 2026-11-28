// N2b-1 test: the NPC lab's capability core (engine/v2/npc/lab.ts; design/npc/NPC-LABS.md §3, §4). One tl-central game,
// challenger start, 900 days (endings skipped so it runs the whole span), plus pure checks on copies of its state.
// Run: npx tsx scripts/v2/npcLabs.ts
import { newGame, defaultSetupV2 } from '../../src/engine/v2/core/init';
import { tick } from '../../src/engine/v2/core/loop';
import { decimalYear } from '../../src/engine/v2/core/time';
import { DIFFUSION_TAU_DAYS } from '../../src/data/v2/calibration';
import { KINDS, REALISTIC_CAST, RELEASE_CADENCE_DAYS } from '../../src/data/v2/npcLabs';
import { DAYS_PER_MONTH, npcCapabilityDay, npcTarget, refGAt, startLagDays } from '../../src/engine/v2/npc/lab';
import type { GameStateV2, RivalLab } from '../../src/engine/v2/types';
import { check, finish } from './lib';

const clone = (s: GameStateV2): GameStateV2 => JSON.parse(JSON.stringify(s));
const labs = (s: GameStateV2): RivalLab[] => [...s.rivals, s.china.lab];

const s = newGame(defaultSetupV2({ world: 'tl-central', labKind: 'safety', seed: 7, tutorial: false }));
const y0 = decimalYear(s);

// (c) start lags match the cast within a day; the leader-kind lab is present (challenger start) and absent in a leader start.
const cast = new Map(REALISTIC_CAST.map((e) => [e.kind === 'china' ? 'china' : e.id, e]));
for (const r of labs(s)) {
  const e = cast.get(r.core.id)!;
  const want = e.kind === 'leader' ? 0 : DAYS_PER_MONTH * (e.start.publicLagMonths ?? e.start.publicLagBandMonths ?? 0);
  check(!!r.npc && Math.abs(r.npc.d - want) <= 1 && Math.abs(startLagDays(e) - want) <= 1, `(c) ${r.core.name} start lag ${r.npc?.d.toFixed(1)} d = cast ${want.toFixed(1)} d`);
  check(Math.abs(r.internal.G - refGAt(s, y0 - r.npc!.d / 365.25)) < 1e-9, `(c) ${r.core.name} start internal G on the reference at its lag`);
}
check(s.rivals.some((r) => r.npc?.kind === 'leader'), '(c) the leader-kind lab is in a challenger game');
const sl = newGame(defaultSetupV2({ world: 'tl-central', labKind: 'leader', seed: 7, tutorial: false }));
check(!sl.rivals.some((r) => r.npc?.kind === 'leader') && sl.rivals.length === 5, '(c) no leader-kind lab in a leader start', `${sl.rivals.length} US labs`);

// (d) relaxation: a copy with a lab's d set to d0 + 60 relaxes back with time constant tau_D. Against a control copy
// stepped the same way (the target moves the same in both: the dynamics are linear), the kick decays as e^(-t/tau_D).
{
  const c = clone(s), k = clone(s);
  const r = c.rivals.find((x) => x.npc?.kind === 'safety')!;
  const rk = k.rivals.find((x) => x.npc?.kind === 'safety')!;
  rk.npc!.d = rk.npc!.d0 + 60;
  const days = Math.round(DIFFUSION_TAU_DAYS);
  for (let i = 0; i < days; i++) { for (const x of [c, k]) x.time.day++; npcCapabilityDay(c, r, c.time.day); npcCapabilityDay(k, rk, k.time.day); }
  const rest = (rk.npc!.d - r.npc!.d) / 60;
  check(Math.abs(rest - Math.exp(-1)) < 0.1 * Math.exp(-1), `(d) after tau_D (${days} d) ${(rest * 100).toFixed(1)}% of the 60-day kick remains (e^-1 = 36.8%)`);
}
// (e) a forced compute cut of 0.5 OOM raises d* by 0.5 / slope.
{
  const c = clone(s);
  const r = c.rivals.find((x) => x.npc?.kind === 'bigtech')!;
  const a = npcTarget(c, r);
  r.core.computeOnline /= Math.pow(10, 0.5);
  const b = npcTarget(c, r);
  const want = 0.5 / a.slope;
  check(a.short === 0 && Math.abs(b.dStar - a.dStar - want) < 1e-6 * want, `(e) 0.5 OOM cut raises d* by ${(b.dStar - a.dStar).toFixed(1)} d = 0.5 / slope ${want.toFixed(1)} d`);
}

// (a) the game runs 900 days; record daily what (b), (f), (g) read.
type Rec = { day: number; y: number; G: number; ref: number; short: number; pubId?: string; pubG?: number; d: number };
const hist = new Map<string, Rec[]>();
for (const r of labs(s)) hist.set(r.core.id, [{ day: 0, y: y0, G: r.internal.G, ref: refGAt(s, y0), short: 0, pubId: r.publicModel?.id, pubG: r.publicModel?.G, d: r.npc!.d }]);
let err: unknown;
try {
  while (s.time.day < 900) {
    tick(s, { skip: ['endings'] });
    for (const r of labs(s)) {
      if (r.core.status !== 'active' || !r.npc) continue;
      const y = decimalYear(s);
      (hist.get(r.core.id) ?? hist.set(r.core.id, []).get(r.core.id)!).push({ day: s.time.day, y, G: r.internal.G, ref: refGAt(s, y), short: r.npc.short, pubId: r.publicModel?.id, pubG: r.publicModel?.G, d: r.npc.d });
    }
  }
} catch (e) { err = e; console.log(e); }
check(!err && s.time.day === 900, `(a) tl-central challenger game ran ${s.time.day} days without errors`);
for (const r of labs(s)) {
  const h = hist.get(r.core.id) ?? [];
  const last = h[h.length - 1];
  console.log(`     ${r.core.name.padEnd(12)} ${r.core.status.padEnd(9)} d ${last?.d.toFixed(0).padStart(4)} d  d0 ${r.npc?.d0.toFixed(0).padStart(4)}  shortfall ${last?.short.toFixed(2)} OOM  C ${(r.core.computeOnline / 1e6).toFixed(2)}M  G ${r.internal.G.toFixed(2)} (ref ${last?.ref.toFixed(2)})  ms ${JSON.stringify(r.core.milestoneDays)}`);
}

// (b) the leader-kind lab sits on the reference while it has no shortfall.
{
  const r = s.rivals.find((x) => x.npc?.kind === 'leader')!;
  const h = hist.get(r.core.id)!;
  const first = h.findIndex((x) => x.short > 0);
  const clean = first < 0 ? h : h.slice(0, first);
  const worst = Math.max(0, ...clean.map((x) => Math.abs(x.G - x.ref)));
  check(clean.length > 0 && worst < 0.01, `(b) leader-kind lab internal G = refG(t) within 0.01 OOM while no shortfall`, `${clean.length} days, worst ${worst.toFixed(4)}; first shortfall day ${first < 0 ? 'none' : h[first].day}`);
  const sh = h.filter((x) => x.short > 0).length;
  console.log(`     leader-kind lab: ${sh} of ${h.length} days with a shortfall; max ${Math.max(0, ...h.map((x) => x.short)).toFixed(3)} OOM; max lag ${Math.max(...h.map((x) => x.d)).toFixed(1)} d`);
}

// (f) public models step every 119 days and lag the internal by one release lag; (g) China's lab follows the same rules.
for (const r of labs(s)) {
  const h = hist.get(r.core.id) ?? [];
  const steps = h.filter((x, i) => i > 0 && x.pubId !== h[i - 1].pubId);
  const gaps = steps.slice(1).map((x, i) => x.day - steps[i].day);
  const L = KINDS[r.npc!.kind].releaseLagDays;
  // the public model at its release = the internal model L days earlier (tolerance: the lag moves over tau_D)
  let worst = 0;
  for (const x of steps) {
    const then = h.find((z) => z.day === x.day - L);
    if (then) worst = Math.max(worst, Math.abs(x.pubG! - then.G));
  }
  const tag = r.core.kind === 'china' ? '(g)' : '(f)';
  const lastDay = h.length ? h[h.length - 1].day : 0;
  const want = lastDay >= r.npc!.phase ? Math.floor((lastDay - r.npc!.phase) / RELEASE_CADENCE_DAYS) + 1 : 0;
  check(steps.length === want && want >= 5 && gaps.every((g) => g === RELEASE_CADENCE_DAYS), `${tag} ${r.core.name}: ${steps.length} releases (${want} release days while active), every ${[...new Set(gaps)].join("/")} d`);
  check(worst < 0.02, `${tag} ${r.core.name}: public at release = internal ${L} d earlier`, `worst ${worst.toFixed(4)} OOM`);
}
{
  const r = s.china.lab;
  const h = hist.get('china')!;
  const ok = h.every((x) => Math.abs(x.G - refGAt(s, x.y - x.d / 365.25)) < 1e-9);
  check(ok, '(g) China: internal G = refG(t − d) every day');
  check(!!r.npc && r.npc.kind === 'china' && r.core.name === 'Xuanmu Lab', '(g) China\'s lab is the cast\'s Xuanmu Lab');
}
const rel = new Set(labs(s).map((r) => r.npc!.phase));
check(rel.size === labs(s).length, '(f) release days are staggered', [...rel].join(', '));

finish('npcLabs');
