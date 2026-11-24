// TRAINING › Environments (UB-B; approved mockup design/ux/mockups/rd/train-env.png; DATA-b.md).
// HOME of each family's realism, loopholes, share of the next run's hacking pressure, its Harden / Expand work (cost,
// days, after value; pending work with its ETA), and the next run's hacking pressure (Low / Medium / High), what makes
// it and the ways to lower it. The next run's design (focus, budget) is set on Next run; this tab reads it (the plan
// Next run handed over, else a broad Standard post-training of the latest base).
import { useMemo, type ReactNode } from 'react';
import { AlertTriangle, ChevronRight, Dumbbell, Hammer, Lock, Maximize2, ShieldCheck, type LucideIcon } from 'lucide-react';
import {
  dateOf, demosAvailable, engAllocView, exploitFloor, plannedPressure, familyDomain, fmtDate, lockedSuiteFamilies, nodeStatus, postFromParams, pressureLevel, suitePending,
  suitePlanEffect, suiteS2Parts, suitesView, suiteWorkPreview, unbuiltSuites,
} from '../../../engine/v2';
import type { GameStateV2, LaunchRunParams, PostDesign, RLFamily, SuiteRow, SuiteWorkPreview } from '../../../engine/v2';
import { RL_FAMILY_LABEL } from '../../../data/v2/suites';
import { TREE_BY_ID } from '../../../data/v2/tree';
import { store } from '../store';
import { Term, Tip, TipCard, type Params } from '../ui';
import { Card } from '../kit';
import * as F from '../fmt';
import { DOMAIN_ICON } from '../icons';
import './suites.css';

/** store.tab key of the planned run (Next run's post-training params, JSON) and the fields kept. */
export const PLAN_KEY = 'models.plan';
const PLAN_FIELDS = ['baseId', 'rlFocus', 'rlBudget', 'pref', 'cot', 'safety', 'methods'] as const;
const BUDGET_LABEL: Record<string, string> = { light: 'Light', standard: 'Standard', heavy: 'Heavy' };
/** Realism shown as % of the standard (1 = 100%); bars run to the 1.5 ceiling. */
const FID_MAX = 1.5;
const LOOP_MAX = 0.25;

/** Open Training › Environments; with `p` (Next run's post-training params) as the planned run. */
export function openSuites(p?: Params) {
  if (p) store.setTab(PLAN_KEY, JSON.stringify(Object.fromEntries(PLAN_FIELDS.filter((k) => p[k] !== undefined).map((k) => [k, p[k]]))));
  store.goto('blueprint', { tab: 'suites' });
}
function readPlan(): { p: Params; fromBp: boolean } {
  try {
    const raw = store.tab[PLAN_KEY];
    if (raw) return { p: JSON.parse(raw) as Params, fromBp: true };
  } catch { /* fall through */ }
  return { p: { rlFocus: 'broad' }, fromBp: false };
}
const famIcon = (f: RLFamily): LucideIcon => DOMAIN_ICON[familyDomain(f)] ?? Dumbbell;
const pc1 = (x: number) => F.pct(x, x < 0.1 ? 1 : 0);

interface Plan { lp: LaunchRunParams; post: PostDesign; p: Params; fromBp: boolean; baseName?: string }
function planOf(s: GameStateV2): Plan {
  const { p, fromBp } = readPlan();
  const bases = s.player.models.bases;
  const base = bases.find((b) => b.id === p.baseId) ?? bases[bases.length - 1];
  const post = postFromParams(p);
  return { lp: { kind: 'post', baseId: base?.id ?? '', post }, post, p, fromBp, baseName: base?.name };
}
type Pv = { build: SuiteWorkPreview; harden: SuiteWorkPreview; demos?: SuiteWorkPreview };

export function Suites({ s }: { s: GameStateV2 }) {
  const plan = planOf(s);
  const key = `${s.time.day}|${JSON.stringify(plan.p)}|${s.player.build.queue.length}|${s.player.finance.cash.toFixed(3)}|${JSON.stringify(s.player.suites ?? {})}`;
  const d = useMemo(() => {
    const view = suitesView(s, plan.post.rlFocus);
    const before = suitePlanEffect(s, plan.lp);
    const pv = Object.fromEntries(view.rows.map((r) => [r.family, {
      build: suiteWorkPreview(s, r.family, 'build', plan.lp, before), harden: suiteWorkPreview(s, r.family, 'harden', plan.lp, before),
      ...(demosAvailable(s, r.family) ? { demos: suiteWorkPreview(s, r.family, 'build', plan.lp, before, true) } : {}),
    }])) as Record<RLFamily, Pv>;
    const eng = engAllocView(s);
    // The planned run's hacking pressure as Next run shows it (its RL compute against the base sets the pressure).
    const s2Of = (post: PostDesign) => { try { return plannedPressure(s, { ...plan.lp, post })?.rows.find((r) => r.id === 'S2')?.value; } catch { return undefined; } };
    return {
      view, pv, s2: suiteS2Parts(s, plan.post), planned: s2Of(plan.post), light: s2Of({ ...plan.post, rlBudget: 'light' }) ?? suiteS2Parts(s, { ...plan.post, rlBudget: 'light' }).total,
      locked: lockedSuiteFamilies(s), unbuilt: unbuiltSuites(s, plan.lp, before), spare: eng.cap > 0 ? eng.idle / eng.cap : 0,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const sum = d.s2.rows.reduce((a, r) => a + r.s2, 0);
  const partOf = (f: RLFamily) => (sum > 0 ? (d.s2.rows.find((r) => r.family === f)?.s2 ?? 0) / sum : 0);
  const n = d.view.rows.filter((r) => r.share > 0).length;
  return (
    <div className="sx" data-test="suites">
      <Card className="sx-card" home="suites" title={<span className="row-i"><Dumbbell size={15} /><Term id="envSuite">Environments</Term>&nbsp;by family</span>} sub="tasks and graders your models practise on in post-training">
        <div className="sx-grid">
          <span className="ch">Family</span>
          <span className="ch"><Term id="suiteFidelity">Realism</Term> <span className="lc">· tick = standard</span></span>
          <span className="ch"><Term id="suiteExploit">Loopholes</Term></span>
          <span className="ch"><Term id="rewardHackPressure">Share of pressure</Term></span>
          <span className="ch"><Term id="buildCapacity">Work</Term> <Tip content={() => <TipCard title={<Term id="buildCapacity">Engineers spare</Term>} value={F.pct(d.spare)}>Build capacity no need takes today: Harden and Expand start at once while some is spare.</TipCard>}><span className="lc">· engineers {F.pct(d.spare)} spare</span></Tip></span>
          {[...d.view.rows].sort((a, b) => partOf(b.family) - partOf(a.family) || b.share - a.share).map((r) => <SuiteLine key={r.family} s={s} r={r} pv={d.pv[r.family]} part={partOf(r.family)} n={n} />)}
          {d.unbuilt.map((u) => <UnbuiltLine key={u.family} s={s} family={u.family} pv={u.build} />)}
          {d.locked.map((l) => <LockedLine key={l.family} s={s} family={l.family} node={l.node} />)}
        </div>
      </Card>
      <PressureCard s={s} plan={plan} s2={d.s2} planned={d.planned} light={d.light} rows={d.view.rows} pv={d.pv} />
    </div>
  );
}

// ───────── one family ─────────
function SuiteLine({ s, r, pv, part, n }: { s: GameStateV2; r: SuiteRow; pv: Pv; part: number; n: number }) {
  const I = famIcon(r.family);
  const floor = exploitFloor(r.family);
  const pend = suitePending(s, r.family);
  const used = r.share > 0;
  return (
    <div className="sx-line" data-suite={r.family}>
      <span className="sx-fam"><span className="sx-ic"><I size={16} /></span><span><b>{r.label}</b>
        <Tip content={() => <TipCard title={<Term id="suiteRlShare">Share of the next run</Term>} value={F.pct(r.share)}>Share of the next run&apos;s post-training spent in these environments.</TipCard>}>
          <span className={`small ${used ? 'tone-pos' : 'dim'}`} data-test="suite-share">{used ? `✓ in next run · ${n > 0 && Math.abs(r.share - 1 / n) < 0.01 ? `1/${n}` : F.pct(r.share)}` : 'not in next run'}</span>
        </Tip></span></span>
      <Tip content={() => <TipCard title={<Term id="suiteFidelity">Realism</Term>} value={F.pct(r.fid)} rows={[
        { label: 'Live tasks', value: F.count(r.tasks) }, { label: 'Grader quality', value: `×${r.grader.toFixed(2)}` }, { label: 'Builds done', value: String(r.builds) },
        { label: <Term id="expertData">Expert data</Term>, value: `${F.num(r.expertT * 1000, r.expertT < 0.01 ? 1 : 0)}B tokens` },
      ]} footer="100% is the standard; at most 150%. Without upkeep tasks go stale (half in 6 months).">How much of the post-training ceiling this family&apos;s environments let a model reach.</TipCard>}>
        <span className="sx-bar" data-test="suite-fid"><span className="sx-track"><i className="fid" style={{ width: `${Math.min(1, r.fid / FID_MAX) * 100}%` }} /><b className="tick" style={{ left: `${(1 / FID_MAX) * 100}%` }} /></span><b className="num">{F.pct(r.fid)}</b></span>
      </Tip>
      <Tip content={() => <TipCard title={<Term id="suiteExploit">Loopholes</Term>} value={`${pc1(r.exploit)} of tasks`} rows={[{ label: 'Floor', value: pc1(floor) }, { label: 'Hardenings done', value: String(r.hardenings) }]} footer="No red team gets below the floor.">Share of these environments&apos; tasks whose grader a model can game.</TipCard>}>
        <span className="sx-bar" data-test="suite-exploit"><span className="sx-track"><i className={`loop ${r.exploit >= 0.08 ? 'hi' : r.exploit >= 0.03 ? 'mid' : ''}`} style={{ width: `${Math.min(1, r.exploit / LOOP_MAX) * 100}%` }} /></span><b className={`num ${r.exploit >= 0.08 ? 'tone-warn' : ''}`}>{pc1(r.exploit)}</b></span>
      </Tip>
      <Tip content={() => <TipCard title={<Term id="rewardHackPressure">Share of hacking pressure</Term>} value={F.pct(part)}>This family&apos;s part of the next run&apos;s hacking pressure: its loopholes times its share of the run.</TipCard>}>
        <span className="sx-bar sm" data-test="suite-part"><span className="sx-track sm"><i className={`loop ${part >= 0.3 ? 'hi' : part >= 0.1 ? 'mid' : ''}`} style={{ width: `${part * 100}%` }} /></span><span className="num small">{F.pct(part)}</span></span>
      </Tip>
      <span className="sx-work-col">
        <WorkCell s={s} r={r} pv={pv.harden} pend={pend.find((x) => x.work === 'harden')} />
        <WorkCell s={s} r={r} pv={pv.build} pend={pend.find((x) => x.work === 'build')} demos={pv.demos} />
      </span>
    </div>
  );
}

/** A Harden or Expand button with its after value, days and cash, or the pending item with its ETA. */
function WorkCell({ s, r, pv, pend, demos }: { s: GameStateV2; r: SuiteRow; pv: SuiteWorkPreview; pend?: { leftTW: number; etaDays: number }; demos?: SuiteWorkPreview }) {
  const build = pv.work === 'build';
  const id = build ? 'suite.build' : 'suite.harden';
  const Ic = build ? Maximize2 : ShieldCheck;
  if (pend) {
    const eta = Number.isFinite(pend.etaDays) ? pend.etaDays : undefined;
    return (
      <Tip content={() => <TipCard title={`${build ? 'Expanding' : 'Hardening'} ${r.label} environments`} value={eta !== undefined ? fmtDate(dateOf(s, s.time.day + eta)) : 'waits'} rows={[{ label: 'Left', value: `${pend.leftTW.toFixed(1)} team-weeks` }]} footer="On the engineers' build queue; paid when queued.">One {build ? 'expansion' : 'hardening'} per family at a time.</TipCard>}>
        <span className="sx-work pend" data-pending={`${r.family}:${pv.work}`}><span className="btn btn-sm is-off"><Ic size={12} />{build ? 'Expanding' : 'Hardening'}</span><span className="small">{build ? <><Term id="suiteFidelity">Realism</Term> → <b className="num">{F.pct(pv.effect.fid[1])}</b></> : <><Term id="suiteExploit">Loopholes</Term> → <b className="num">{pc1(pv.effect.exploit[1])}</b></>} · {eta !== undefined ? `done in ${F.days(eta)}` : 'waits for engineers'}</span></span>
      </Tip>
    );
  }
  const dS2 = pv.after.s2 - pv.before.s2;
  const tip = () => (
    <TipCard title={<Term id={build ? 'suiteBuild' : 'suiteHarden'}>{build ? 'Expand' : 'Harden'} {r.label} environments</Term>} value={pv.block ? <span className="tone-neg">{pv.block}</span> : undefined} rows={[
      { label: build ? <Term id="expertData">Expert data (cash, now)</Term> : 'Expert red-teamers (cash, now)', value: F.money(pv.cost.cashB), tone: 'neg' },
      { label: <Term id="teamWeek">Engineers</Term>, value: `${pv.cost.tw.toFixed(1)} team-weeks`, tone: 'neg' },
      { label: 'Done in', value: F.days(pv.waitDays) },
      build ? { label: <Term id="suiteFidelity">Realism</Term>, value: `${F.pct(pv.effect.fid[0])} → ${F.pct(pv.effect.fid[1])}`, tone: 'pos' } : { label: <Term id="suiteExploit">Loopholes</Term>, value: `${pc1(pv.effect.exploit[0])} → ${pc1(pv.effect.exploit[1])}`, tone: 'pos' },
      { label: <>Next run: <Term id="rewardHackPressure">hacking pressure</Term></>, value: pv.before.s2 > 0 ? `−${F.pct((pv.before.s2 - pv.after.s2) / pv.before.s2)}` : '–', ...(dS2 < -0.0005 ? { tone: 'pos' as const } : {}) },
    ]} footer={build ? 'Realism raises this family\'s post-training ceiling; runs launched later use it.' : 'Fewer loopholes: less hacking pressure on runs launched later. Returns fall toward the floor.'} />
  );
  return (
    <span className="sx-work">
      <Tip content={tip}>
        <button className={`btn btn-sm act-btn ${pv.block ? 'is-off' : ''}`} disabled={!!pv.block} data-act={id} data-family={r.family} onClick={() => store.act(id, { family: r.family })}><Ic size={12} /><span>{build ? 'Expand' : 'Harden'}</span></button>
      </Tip>
      <Tip content={tip}><span className="small sx-after" data-test={`suite-after.${pv.work}`}>{build ? <><Term id="suiteFidelity">Realism</Term> → <b className="num">{F.pct(pv.effect.fid[1])}</b></> : <><Term id="suiteExploit">Loopholes</Term> → <b className="num">{pc1(pv.effect.exploit[1])}</b></>} <span className="dim">· {F.days(pv.waitDays)} · {F.money(pv.cost.cashB)}</span></span></Tip>
      {demos && <DemosBtn r={r} pv={demos} />}
    </span>
  );
}

/** RD-T06: the long-tasks demonstrations build (unlocked by P12): a build that also buys recorded expert work. */
function DemosBtn({ r, pv }: { r: SuiteRow; pv: SuiteWorkPreview }) {
  return (
    <Tip content={() => <TipCard title={<Term id="suiteBuild">Expand with human demonstrations</Term>} value={pv.block ? <span className="tone-neg">{pv.block}</span> : undefined} rows={[
      { label: <Term id="expertData">Expert data (cash, now)</Term>, value: F.money(pv.cost.cashB), tone: 'neg' },
      { label: <Term id="teamWeek">Engineers</Term>, value: `${pv.cost.tw.toFixed(1)} team-weeks`, tone: 'neg' },
      { label: <Term id="suiteFidelity">Realism</Term>, value: `${F.pct(pv.effect.fid[0])} → ${F.pct(pv.effect.fid[1])}`, tone: 'pos' },
    ]} footer="Experts record days-long work into the long-task environments." />}>
      <button className={`btn btn-sm act-btn ${pv.block ? 'is-off' : ''}`} disabled={!!pv.block} data-act="suite.build" data-family={r.family} data-demos="1" onClick={() => store.act('suite.build', { family: r.family, demos: true })}>
        <Hammer size={12} /><span>+ demos</span><span className="small dim">{F.money(pv.cost.cashB)}</span>
      </button>
    </Tip>
  );
}

/** A family whose idea is known but whose first environments are not built: no post-training on it until they are. */
function UnbuiltLine({ s, family, pv }: { s: GameStateV2; family: RLFamily; pv: SuiteWorkPreview }) {
  const I = famIcon(family);
  const label = RL_FAMILY_LABEL[family];
  const r: SuiteRow = { family, label, fid: 0, exploit: 0, expertT: 0, tasks: 0, grader: 1, share: 0, builds: 0, hardenings: 0, pending: [] };
  const pend = suitePending(s, family).find((x) => x.work === 'build');
  return (
    <div className="sx-line unbuilt" data-suite={family} data-unbuilt={family}>
      <span className="sx-fam"><span className="sx-ic dash"><I size={16} /></span><span><b>{label}</b><span className="small dim">no environments</span></span></span>
      <span className="sx-span3 small dim" data-test="suite-none">Not in any run until its first environments are built</span>
      <span className="sx-work-col"><WorkCell s={s} r={r} pv={pv} pend={pend} /></span>
    </div>
  );
}

/** A family that needs a discovery first (click opens it in Discoveries). */
function LockedLine({ s, family, node }: { s: GameStateV2; family: RLFamily; node: string }) {
  const I = famIcon(family);
  const n = TREE_BY_ID[node];
  const st = nodeStatus(s, node);
  const pr = s.player.tree[node]?.progress ?? 0;
  return (
    <div className="sx-line locked" data-suite={family} data-locked={node}>
      <span className="sx-fam"><span className="sx-ic dash"><I size={16} /></span><span><b>{RL_FAMILY_LABEL[family]}</b><span className="small dim">no environments</span></span></span>
      <Tip className="sx-span4" content={() => <TipCard title={<>{RL_FAMILY_LABEL[family]} <Lock size={11} /></>} rows={[{ label: 'Unlocked by', value: n?.name ?? 'a discovery' }, { label: 'Status', value: st === 'active' ? `${F.pct(pr)} researched` : (({ open: 'Available', locked: 'Locked', queued: 'Queued', failed: 'Failed', known: 'Known' } as Record<string, string>)[st] ?? st) }]}>Once the discovery is made, build its first environments here.</TipCard>}>
        <span className="small dim row-i sx-lock"><Lock size={12} />Locked: needs the discovery <b>{n?.name ?? 'a discovery'}</b>{st === 'active' ? ` (${F.pct(pr)})` : ''}
          <button className="dv-chip" data-node={node} onClick={() => { store.setTab('research.sel', node); store.goto('research', { tab: 'tree' }); }}>Discoveries <ChevronRight size={11} /></button></span>
      </Tip>
    </div>
  );
}

// ───────── hacking pressure of the next run (L1) ─────────
function PressureCard({ s, plan, s2, planned, light, rows, pv }: { s: GameStateV2; plan: Plan; s2: ReturnType<typeof suiteS2Parts>; planned?: number; light: number; rows: SuiteRow[]; pv: Record<RLFamily, Pv> }) {
  const sum = s2.rows.reduce((a, r) => a + r.s2, 0);
  const total = planned ?? s2.total;
  /** The suites preview reads the budget's nominal pressure; Next run's reads the run's own RL compute: scale to it. */
  const k = sum > 0 ? Math.max(0, total - s2.p11) / sum : 1;
  const lvl = pressureLevel(total);
  const parts = [...s2.rows].filter((r) => r.s2 > 1e-6).sort((a, b) => b.s2 - a.s2);
  const big = parts.slice(0, 3);
  const rest = parts.slice(3);
  const restSum = rest.reduce((a, r) => a + r.s2, 0);
  const canHarden = (f: RLFamily) => pv[f] && !pv[f].harden.block && !suitePending(s, f).some((x) => x.work === 'harden');
  const top = big.find((r) => canHarden(r.family));
  const drop = (f: RLFamily) => (pv[f] ? k * (pv[f].harden.before.s2 - pv[f].harden.after.s2) : 0);
  const three = big.filter((r) => canHarden(r.family));
  const after3 = Math.max(0, total - three.reduce((a, r) => a + drop(r.family), 0));
  const cost3 = three.reduce((a, r) => a + pv[r.family].harden.cost.cashB, 0);
  const days3 = Math.max(0, ...three.map((r) => pv[r.family].harden.waitDays));
  const x = (v: number) => `${Math.min(1, Math.max(0, v)) * 100}%`;
  const maxPart = Math.max(1e-9, ...parts.map((r) => r.s2));
  const Way = ({ label, sub, to, act, test }: { label: ReactNode; sub: ReactNode; to: number; act: ReactNode; test: string }) => (
    <div className="sx-way" data-test={test}><span><span>{label}</span><span className="small dim">{sub}</span></span><b className="num">{lvl} <span className="dim">→</span> <span className={pressureLevel(to) !== lvl ? 'tone-warn' : ''}>{pressureLevel(to)}</span></b>{act}</div>
  );
  return (
    <Card className="sx-press" home="suitePlan" title={<span className="row-i"><AlertTriangle size={15} /><Term id="rewardHackPressure">Hacking pressure</Term>&nbsp;of the next run</span>}
      sub={<>{plan.baseName ?? 'no base model'} · {BUDGET_LABEL[plan.post.rlBudget] ?? plan.post.rlBudget} budget{plan.fromBp ? '' : ' · standard plan'}</>}>
      <Tip as="div" content={() => <TipCard title={<Term id="rewardHackPressure">Hacking pressure</Term>} value={lvl} rows={[
        ...parts.map((r) => ({ label: `${RL_FAMILY_LABEL[r.family]}: ${F.pct(r.share)} of the run, ${pc1(r.exploit)} loopholes`, value: F.pct(r.s2 / Math.max(1e-9, sum)) })),
        { label: <><Term id="rlBudget">Post-training budget</Term> ({BUDGET_LABEL[plan.post.rlBudget]})</>, value: `×${(k * s2.pressure).toFixed(1)}` },
        ...(s2.p11 > 0 ? [{ label: 'Automated research', value: 'adds some' }] : []),
      ]} footer="Low, Medium and High are thirds of the scale. It pushes the Gaming tendencies.">How strongly the next run rewards gaming the graders.</TipCard>}>
        <div className="sx-phd" data-test="suites-s2" data-level={lvl}><b className={`sx-lvl ${lvl}`}>{lvl}</b><span className="dim">pushes <span className="tone-warn">▲ <Term id="riskFamily">Gaming</Term></span> in the next model</span><span className="sp" /><button className="dv-chip" onClick={() => store.goto('blueprint', { tab: 'next' })}>Pushes <ChevronRight size={11} /></button></div>
        <div className="sx-pg"><i className="z lo" /><i className="z md" /><i className="z hi" />{three.length > 0 && <b className="after" style={{ left: x(after3) }} />}<b className="mk" style={{ left: x(total) }} /></div>
        <div className="sx-pgl small dim"><span>Low</span><span>Medium</span><span>High</span></div>
      </Tip>
      <div className="sx-sec"><div className="cap">What makes it</div>
        {big.map((r) => <div key={r.family} className="sx-part" data-part={r.family}><span>{RL_FAMILY_LABEL[r.family]}</span><span className="sx-ptrack"><i style={{ width: `${(r.s2 / maxPart) * 100}%` }} /></span><Tip content={() => <TipCard title={RL_FAMILY_LABEL[r.family]} value={F.pct(r.s2 / Math.max(1e-9, sum))} rows={[{ label: 'Share of the run', value: F.pct(r.share) }, { label: <Term id="suiteExploit">Loopholes</Term>, value: pc1(r.exploit) }]}>Its part of the hacking pressure: loopholes times its share of the run.</TipCard>}><span className="num small">{F.pct(r.s2 / Math.max(1e-9, sum))}</span></Tip></div>)}
        {rest.length > 0 && <div className="sx-part"><span>{rest.map((r) => RL_FAMILY_LABEL[r.family]).join(', ')}</span><span className="sx-ptrack"><i style={{ width: `${(restSum / maxPart) * 100}%` }} /></span><Tip content={() => <TipCard title="The rest" value={F.pct(restSum / Math.max(1e-9, sum))}>The other families' part of the hacking pressure.</TipCard>}><span className="num small">{F.pct(restSum / Math.max(1e-9, sum))}</span></Tip></div>}
        <div className="small dim">The graders&apos; loopholes, by each family&apos;s share of the run. The <b>{BUDGET_LABEL[plan.post.rlBudget]}</b> post-training budget multiplies it by <Tip content={() => <TipCard title={<Term id="rlBudget">Post-training budget</Term>} value={`×${(k * s2.pressure).toFixed(1)}`}>More post-training compute on the same base optimises harder against the graders.</TipCard>}><b className="num">{(k * s2.pressure).toFixed(1)}</b></Tip>.</div>
      </div>
      <div className="sx-sec"><div className="cap">Ways to lower it</div>
        {top && <Way test="way-top" label={<>Harden {RL_FAMILY_LABEL[top.family]}</>} sub={<Tip content={() => <TipCard title={<Term id="suiteHarden">Harden {RL_FAMILY_LABEL[top.family]}</Term>} rows={[{ label: 'Done in', value: F.days(pv[top.family].harden.waitDays) }, { label: 'Cash', value: F.money(pv[top.family].harden.cost.cashB) }]}>Expert red-teamers and engineers close loopholes in its graders.</TipCard>}><span>{F.days(pv[top.family].harden.waitDays)} · {F.money(pv[top.family].harden.cost.cashB)} · engineers</span></Tip>} to={total - drop(top.family)}
          act={<button className="btn btn-sm" data-act="suite.harden" data-family={top.family} onClick={() => store.act('suite.harden', { family: top.family })}>Do</button>} />}
        {three.length > 1 && <Way test="way-three" label={<>Harden {three.map((r) => RL_FAMILY_LABEL[r.family]).join(', ')}</>} sub={<Tip content={() => <TipCard title={<Term id="suiteHarden">Harden all three</Term>} rows={[{ label: 'Done in', value: F.days(days3) }, { label: 'Cash', value: F.money(cost3) }]}>The three hardenings queue together; the pressure after adds up their single drops.</TipCard>}><span>{F.days(days3)} · {F.money(cost3)} · engineers</span></Tip>} to={after3}
          act={<button className="btn btn-sm" data-test="harden-three" onClick={() => three.forEach((r) => store.act('suite.harden', { family: r.family }))}>Do</button>} />}
        {plan.post.rlBudget !== 'light' && <Way test="way-light" label="Light post-training budget" sub="the run gives less skill" to={light} act={<button className="dv-chip" onClick={() => store.goto('blueprint', { tab: 'next' })}>Next run <ChevronRight size={11} /></button>} />}
        {three.length > 0 && <div className="small dim row-i"><b className="sx-afterkey" />after hardening {three.length === 1 ? 'it' : `all ${three.length === 3 ? 'three' : 'two'}`}</div>}
        {rows.length === 0 && <div className="small dim">No environments yet.</div>}
      </div>
    </Card>
  );
}
