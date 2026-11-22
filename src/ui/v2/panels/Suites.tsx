// Models › Suites (model v3 D6; design/notes/D6.md): the lab's RL environment suites, one row per family.
// Home of each suite's fidelity, exploitability, expert data, RL share on the planned run, pending work and the S2 of the
// planned run. L1: the planned run (focus pills, S2 bar split by family) and the suite rows (fidelity and exploitability
// bars with their marks). L2: build and harden buttons with cost and the after value inline. L3: tooltips (the work's
// cost, the suite's before → after, the planned run's ΔG per domain and S2 before → after, builds/hardenings done).
// The Blueprint's post-train card shows only the run's weighted summary and links here; the RL ceiling stack lives on
// Research › Recipe and the engineers' load on Company › Work (links only).
import { useMemo } from 'react';
import { Dumbbell, Hammer, Lock, ShieldCheck, type LucideIcon } from 'lucide-react';
import {
  dateOf, exploitFloor, optionLocked, familyDomain, fmtDate, lockedSuiteFamilies, nodeStatus, postFromParams, suitePending, suitePlanEffect, suiteS2Parts, suitesView,
  suiteWorkPreview, unbuiltSuites,
} from '../../../engine/v2';
import type { GameStateV2, LaunchRunParams, PostDesign, RLFamily, SuiteRow, SuiteWorkPreview } from '../../../engine/v2';
import { RL_FAMILY_LABEL } from '../../../data/v2/suites';
import { TREE_BY_ID } from '../../../data/v2/tree';
import { store } from '../store';
import { Meter, Term, Tip, TipCard, type Params } from '../ui';
import { Card, Ref } from '../kit';
import * as F from '../fmt';
import { DOMAIN_ICON } from '../icons';
import { C } from '../theme';
import './suites.css';

/** store.tab key of the planned run (the Blueprint's post-train params, JSON) and the fields kept. */
export const PLAN_KEY = 'models.plan';
const PLAN_FIELDS = ['baseId', 'rlFocus', 'rlBudget', 'pref', 'cot', 'safety', 'inoculation'] as const;
const DOMS = ['CODE', 'RSCH', 'REASON', 'AGENCY', 'SOCIAL', 'MEDIA', 'CYBER', 'BIO', 'PHYS'] as const;
/** Width of the S2 bar (px, suites.css .sx-s2bar): a segment is labelled when its family name fits. */
const S2_BAR_PX = 400;
const BUDGET_LABEL: Record<string, string> = { light: 'Light', standard: 'Standard', heavy: 'Heavy' };

/** Open Models › Suites; with `p` (the Blueprint's post-train params) as the planned run. */
export function openSuites(p?: Params) {
  if (p) store.setTab(PLAN_KEY, JSON.stringify(Object.fromEntries(PLAN_FIELDS.filter((k) => p[k] !== undefined).map((k) => [k, p[k]]))));
  store.goto('models', { tab: 'suites' });
}
function readPlan(): { p: Params; fromBp: boolean } {
  try {
    const raw = store.tab[PLAN_KEY];
    if (raw) return { p: JSON.parse(raw) as Params, fromBp: true };
  } catch { /* fall through */ }
  return { p: { rlFocus: 'broad' }, fromBp: false };
}
const setFocus = (p: Params, focus: string) => store.setTab(PLAN_KEY, JSON.stringify({ ...p, rlFocus: focus }));

/** OOM deltas: +0.04, −0.01. */
const oom = (x: number) => `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(2)}`;
const fid = (x: number) => `×${x.toFixed(2)}`;
/** Expert data (T tokens): 2.0B, 1.2T. */
const tok = (t: number) => (t >= 1 ? `${t.toFixed(1)}T` : `${+(t * 1000).toFixed(t >= 0.1 ? 0 : 1)}B`);
const famIcon = (f: RLFamily): LucideIcon => DOMAIN_ICON[familyDomain(f)] ?? Dumbbell;

interface Plan { lp: LaunchRunParams; post: PostDesign; p: Params; fromBp: boolean; baseName?: string }
function planOf(s: GameStateV2): Plan {
  const { p, fromBp } = readPlan();
  const bases = s.player.models.bases;
  const base = bases.find((b) => b.id === p.baseId) ?? bases[bases.length - 1];
  const post = postFromParams(p);
  return { lp: { kind: 'post', baseId: base?.id ?? '', post }, post, p, fromBp, baseName: base?.name };
}

export function Suites({ s }: { s: GameStateV2 }) {
  const plan = planOf(s);
  const key = `${s.time.day}|${JSON.stringify(plan.p)}|${s.player.build.queue.length}|${s.player.finance.cash.toFixed(3)}|${JSON.stringify(s.player.suites ?? {})}`;
  const d = useMemo(() => {
    const view = suitesView(s, plan.post.rlFocus);
    const before = suitePlanEffect(s, plan.lp);
    const pv = Object.fromEntries(view.rows.map((r) => [r.family, {
      build: suiteWorkPreview(s, r.family, 'build', plan.lp, before), harden: suiteWorkPreview(s, r.family, 'harden', plan.lp, before),
    }])) as Record<RLFamily, { build: SuiteWorkPreview; harden: SuiteWorkPreview }>;
    return { view, before, pv, s2: suiteS2Parts(s, plan.post), locked: lockedSuiteFamilies(s), unbuilt: unbuiltSuites(s, plan.lp, before) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return (
    <div className="sx" data-test="suites">
      <PlanCard s={s} plan={plan} rows={d.view.rows} s2={d.s2} reason={d.before.reason} />
      <Card title={<span className="row-i"><Dumbbell size={15} /><Term id="envSuite">Environment suites</Term></span>} home="suites" className="sx-card"
        sub={<>{d.view.rows.length} families</>}
        right={<span className="row-i"><Ref id="rlCeiling" to={{ panel: 'research', tab: 'recipe' }}>RL ceiling stack</Ref><Ref id="buildCapacity" to={{ panel: 'company', tab: 'work' }}>Engineers</Ref></span>}>
        <div className="sx-grid">
          <span className="ch">Family</span>
          <span className="ch"><Term id="suiteFidelity">Fidelity</Term></span>
          <span className="ch"><Term id="suiteExploit">Exploitable</Term></span>
          <span className="ch r"><Term id="expertData">Expert data</Term></span>
          <span className="ch r"><Term id="suiteRlShare">RL share</Term></span>
          <span className="ch"><Term id="suiteBuild">Build</Term></span>
          <span className="ch"><Term id="suiteHarden">Harden</Term></span>
          {d.view.rows.map((r) => <SuiteLine key={r.family} s={s} r={r} pv={d.pv[r.family]} />)}
          {d.unbuilt.map((u) => <UnbuiltLine key={u.family} s={s} family={u.family} pv={u.build} />)}
          {d.locked.map((l) => <LockedLine key={l.family} s={s} family={l.family} node={l.node} />)}
        </div>
        <div className="sx-chain" data-test="suites-chain">
          <span><Hammer size={12} /><Term id="suiteBuild">Build</Term><span className="arr">→</span><Term id="expertData">expert data</Term><span className="arr">→</span><Term id="suiteFidelity">fidelity</Term><span className="arr">→</span>the family&apos;s <Term id="rlBudget">RL ceiling</Term><span className="arr">→</span>ΔG of later runs</span>
          <span><ShieldCheck size={12} /><Term id="suiteHarden">Harden</Term><span className="arr">→</span><Term id="suiteExploit">exploitable</Term><span className="arr">→</span><Term id="rewardHackPressure">S2</Term><span className="arr">→</span><Term id="riskFamily">gaming traits</Term></span>
        </div>
      </Card>
    </div>
  );
}

// ───────── planned run (L1: focus, S2 split by family) ─────────
function PlanCard({ s, plan, rows, s2, reason }: { s: GameStateV2; plan: Plan; rows: SuiteRow[]; s2: ReturnType<typeof suiteS2Parts>; reason?: string }) {
  const focus = plan.post.rlFocus === 'broad' ? 'broad' : plan.post.rlFocus.join(',');
  const pills: { v: string; label: string }[] = [{ v: 'broad', label: 'Broad' }, ...rows.filter((r) => !optionLocked(s, 'rlFocus', r.family)).map((r) => ({ v: r.family, label: r.label }))];
  if (focus !== 'broad' && !pills.some((x) => x.v === focus)) pills.push({ v: focus, label: focus.split(',').map((f) => RL_FAMILY_LABEL[f as RLFamily] ?? f).join(' + ') });
  const parts = [...s2.rows].filter((r) => r.s2 > 1e-6).sort((a, b) => b.s2 - a.s2);
  const s2Tip = () => (
    <TipCard title={<Term id="rewardHackPressure">Reward-hacking pressure</Term>} value={s2.total.toFixed(2)} rows={[
      ...parts.map((r) => ({ label: `${RL_FAMILY_LABEL[r.family]}: ${F.pct(r.share)} of RL × ${F.pct(r.exploit, 1)}`, value: `+${r.s2.toFixed(3)}` })),
      { label: <><Term id="rlBudget">RL budget</Term> pressure ({BUDGET_LABEL[plan.post.rlBudget]})</>, value: `×${s2.pressure.toFixed(1)}` },
      ...(s2.p11 > 0 ? [{ label: 'P11', value: `+${s2.p11.toFixed(1)}` }] : []),
    ]} footer="Signal S2 of the planned run (at most 1); it pushes the gaming traits. Harden the suites with the biggest segment first.">
      Each family adds its RL share × its suite&apos;s exploitability.
    </TipCard>
  );
  return (
    <Card title={<Term id="plannedRun">Planned run</Term>} home="suitePlan" className="sx-plan"
      sub={<>{plan.baseName ?? 'no base'} · <Term id="postTrain">post-train</Term> · <Term id="rlBudget">{BUDGET_LABEL[plan.post.rlBudget] ?? plan.post.rlBudget} RL</Term>{plan.fromBp ? ' · from Blueprint' : ' · reference design'}</>}
      right={<button className="btn btn-sm" data-go="blueprint" onClick={() => store.goto('blueprint')}>Blueprint ›</button>}>
      <div className="sx-plan-body">
        <div className="sx-focus">
          <span className="tip-cap"><Term id="rlFocus">Focus</Term></span>
          <span className="seg" data-test="suites-focus">
            {pills.map((x) => <button key={x.v} className={`seg-btn ${focus === x.v ? 'active' : ''}`} data-focus={x.v} onClick={() => setFocus(plan.p, x.v)}>{x.label}</button>)}
          </span>
          {reason && <span className="small tone-warn">{reason}</span>}
        </div>
        <Tip as="div" content={s2Tip}>
          <div className="sx-s2" data-test="suites-s2">
            <span className="tip-cap"><Term id="rewardHackPressure">Hacking pressure S2</Term></span>
            <b className="num">{s2.total.toFixed(2)}</b>
            <span className="sx-s2bar">
              {parts.map((r, i) => <i key={r.family} style={{ width: `${Math.min(100, r.s2 * 100)}%`, background: C.bad, opacity: 1 - Math.min(0.6, i * 0.14) }}>{r.s2 * S2_BAR_PX >= 46 ? RL_FAMILY_LABEL[r.family] : ''}</i>)}
              {s2.p11 > 0 && <i style={{ width: `${s2.p11 * 100}%`, background: C.watch }}>P11</i>}
            </span>
            <span className="small dim">max 1</span>
          </div>
        </Tip>
      </div>
    </Card>
  );
}

// ───────── one family ─────────
function SuiteLine({ s, r, pv }: { s: GameStateV2; r: SuiteRow; pv: { build: SuiteWorkPreview; harden: SuiteWorkPreview } }) {
  const I = famIcon(r.family);
  const floor = exploitFloor(r.family);
  const pend = suitePending(s, r.family);
  const xMax = 0.5;
  return (
    <div className="sx-line" data-suite={r.family}>
      <span className="sx-fam"><I size={14} /><b>{r.label}</b></span>
      <Tip content={() => <TipCard title={<Term id="suiteFidelity">Fidelity</Term>} value={fid(r.fid)} rows={[
        { label: <Term id="expertData">Expert data built in</Term>, value: `${tok(r.expertT)} tokens` },
        { label: 'Builds done', value: String(r.builds) },
        { label: 'Next build', value: `${fid(pv.build.effect.fid[0])} → ${fid(pv.build.effect.fid[1])}` },
      ]} footer="The family's RL ceiling × this; 1 at the start, never above 1.5.">How much of the RL ceiling this family&apos;s environments let a model reach.</TipCard>}>
        <span className="sx-bar" data-test="suite-fid"><Meter value={r.fid - 0.5} max={1} marker={0.5} color={C.good} width={96} /><b className="num">{fid(r.fid)}</b></span>
      </Tip>
      <Tip content={() => <TipCard title={<Term id="suiteExploit">Exploitable</Term>} value={`${F.pct(r.exploit, 1)} of tasks`} rows={[
        { label: 'Floor', value: F.pct(floor, 1) },
        { label: 'Hardenings done', value: String(r.hardenings) },
        { label: 'Next hardening', value: `${F.pct(pv.harden.effect.exploit[0], 1)} → ${F.pct(pv.harden.effect.exploit[1], 1)}` },
      ]} footer="White mark: the floor no red team gets below.">Hack rate: the share of this suite&apos;s tasks whose scorer a model can game.</TipCard>}>
        <span className="sx-bar" data-test="suite-exploit"><Meter value={Math.min(r.exploit, xMax)} max={xMax} marker={floor} color={C.bad} width={96} /><b className="num">{F.pct(r.exploit, 1)}</b></span>
      </Tip>
      <Tip className="sx-r" content={() => <TipCard title={<Term id="expertData">Expert data</Term>} value={`${tok(r.expertT)} tokens`} rows={[{ label: 'Tasks (≈ 20k tokens each)', value: F.count(r.expertT * 1e12 / 2e4) }]}>Expert-written tasks built into this suite; more raises its fidelity.</TipCard>}>
        <span className="num" data-test="suite-expert">{tok(r.expertT)} <span className="dim">tok</span></span>
      </Tip>
      <Tip className="sx-r" content={() => <TipCard title={<Term id="suiteRlShare">RL share</Term>} value={F.pct(r.share)}>Share of the planned run&apos;s RL compute spent in this suite.</TipCard>}>
        <span className={`num ${r.share > 0 ? '' : 'dim'}`} data-test="suite-share">{F.pct(r.share)}</span>
      </Tip>
      <WorkCell s={s} r={r} pv={pv.build} pend={pend.find((x) => x.work === 'build')} />
      <WorkCell s={s} r={r} pv={pv.harden} pend={pend.find((x) => x.work === 'harden')} />
    </div>
  );
}

/** A build or harden button with its cost and the suite's after value, or the pending item with its ETA. */
function WorkCell({ s, r, pv, pend }: { s: GameStateV2; r: SuiteRow; pv: SuiteWorkPreview; pend?: { leftTW: number; etaDays: number } }) {
  const build = pv.work === 'build';
  const id = build ? 'suite.build' : 'suite.harden';
  if (pend) {
    const eta = Number.isFinite(pend.etaDays) ? pend.etaDays : undefined;
    return (
      <Tip content={() => <TipCard title={`${build ? 'Building out' : 'Hardening'} the ${r.label} suite`} value={eta !== undefined ? fmtDate(dateOf(s, s.time.day + eta)) : 'waits'} rows={[
        { label: 'Left', value: `${pend.leftTW.toFixed(1)} team-wk` },
        { label: 'Done in', value: eta !== undefined ? F.days(eta) : 'waits for engineers' },
        { label: 'Then', value: build ? `fidelity ${fid(pv.effect.fid[0])} → ${fid(pv.effect.fid[1])}` : `exploitable ${F.pct(pv.effect.exploit[0], 1)} → ${F.pct(pv.effect.exploit[1], 1)}` },
      ]} footer="On the build queue (Company › Work); paid when queued.">One {build ? 'build' : 'hardening'} per family at a time.</TipCard>}>
        <span className="sx-work pend" data-pending={`${r.family}:${pv.work}`}>{build ? <Hammer size={12} /> : <ShieldCheck size={12} />}<span>{build ? 'building' : 'hardening'}</span><b className="num">{eta !== undefined ? F.days(eta) : 'waits'}</b></span>
      </Tip>
    );
  }
  const a = pv.after.rl;
  const b = pv.before.rl;
  const dG = a && b ? a.general - b.general : 0;
  const doms = a && b ? DOMS.map((x) => [x, a.perDomain[x] - b.perDomain[x]] as const).filter(([, v]) => Math.abs(v) >= 0.005).sort((x, y) => y[1] - x[1]).slice(0, 4) : [];
  const dS2 = pv.after.s2 - pv.before.s2;
  const after = build ? fid(pv.effect.fid[1]) : F.pct(pv.effect.exploit[1], 1);
  const effect = build ? (Math.abs(dG) >= 0.005 ? `ΔG ${oom(dG)}` : 'ΔG –') : (Math.abs(dS2) >= 0.0005 ? `S2 −${Math.abs(dS2).toFixed(Math.abs(dS2) >= 0.01 ? 2 : 3)}` : 'S2 –');
  const tip = () => (
    <TipCard title={build ? <Term id="suiteBuild">Build out the {r.label} suite</Term> : <Term id="suiteHarden">Harden the {r.label} suite</Term>} value={pv.block ? <span className="tone-neg">{pv.block}</span> : <span className="tag2">preview</span>} rows={[
      { label: build ? <Term id="expertData">Expert data (cash, now)</Term> : 'Expert red-teamers (cash, now)', value: F.money(pv.cost.cashB), tone: 'neg' },
      { label: <Term id="teamWeek">Engineers</Term>, value: `${pv.cost.tw.toFixed(1)} team-wk`, tone: 'neg' },
      { label: 'Done in', value: F.days(pv.waitDays) },
      build ? { label: <Term id="suiteFidelity">Fidelity</Term>, value: `${fid(pv.effect.fid[0])} → ${fid(pv.effect.fid[1])}`, tone: 'pos' } : { label: <Term id="suiteExploit">Exploitable</Term>, value: `${F.pct(pv.effect.exploit[0], 1)} → ${F.pct(pv.effect.exploit[1], 1)}`, tone: 'pos' },
      { label: <><Term id="plannedRun">Planned run</Term>: RL ΔG</>, value: a && b ? `${oom(b.general)} → ${oom(a.general)} OOM` : '—', ...(dG >= 0.005 ? { tone: 'pos' as const } : {}) },
      ...doms.map(([x, v]) => ({ label: <span className="dim">· {x}</span>, value: `${oom(v)} OOM` })),
      { label: <><Term id="plannedRun">Planned run</Term>: <Term id="rewardHackPressure">S2</Term></>, value: `${pv.before.s2.toFixed(3)} → ${pv.after.s2.toFixed(3)}`, ...(dS2 < -0.0005 ? { tone: 'pos' as const } : {}) },
    ]} footer={build ? 'Fidelity raises this family\'s RL ceiling; other domains gain through transfer. Runs launched later use it.' : 'Lower exploitability: less reward-hacking pressure on runs launched later. Diminishing returns down to the floor.'} />
  );
  return (
    <Tip content={tip}>
      <span className="sx-work">
        <button className={`btn btn-sm act-btn ${pv.block ? 'is-off' : ''}`} disabled={!!pv.block} data-act={id} data-family={r.family} onClick={() => store.act(id, { family: r.family })}>
          {build ? <Hammer size={12} /> : <ShieldCheck size={12} />}<span>{build ? 'Build' : 'Harden'}</span>
        </button>
        <span className="sx-cost small dim">{pv.cost.tw.toFixed(1)} t-wk · {F.money(pv.cost.cashB)}</span>
        <span className="sx-after small" data-test={`suite-after.${pv.work}`}>→ {after} <span className={(build ? dG >= 0.005 : dS2 < -0.0005) ? 'tone-pos' : 'dim'}>{effect}</span></span>
      </span>
    </Tip>
  );
}

/** A family whose idea is known but whose first suite is not built (RD-B03): no RL on it until the build finishes. The
 *  Build cell is the usual one (cost, ETA, the planned run's before → after); there is nothing to harden yet. */
function UnbuiltLine({ s, family, pv }: { s: GameStateV2; family: RLFamily; pv: SuiteWorkPreview }) {
  const I = famIcon(family);
  const label = RL_FAMILY_LABEL[family];
  const r: SuiteRow = { family, label, fid: 0, exploit: 0, expertT: 0, share: 0, builds: 0, hardenings: 0, pending: [] };
  const pend = suitePending(s, family).find((x) => x.work === 'build');
  return (
    <div className="sx-line unbuilt" data-suite={family} data-unbuilt={family}>
      <span className="sx-fam"><I size={14} /><b>{label}</b></span>
      <Tip className="sx-none" content={() => <TipCard title={label} value={<span className="tag2">no suite</span>} rows={[
        { label: <Term id="suiteFidelity">Fidelity</Term>, value: 'none' },
        { label: 'First build', value: `${fid(pv.effect.fid[1])} · ${F.pct(pv.effect.exploit[1], 1)} exploitable` },
      ]} footer="Runs cannot train on this family until its first suite is built.">No environments yet: broad RL leaves this family out, it cannot be a focus and it costs no upkeep.</TipCard>}>
        <span className="small dim" data-test="suite-none">No environments yet — build a suite</span>
      </Tip>
      <WorkCell s={s} r={r} pv={pv} pend={pend} />
      <span />
    </div>
  );
}

/** A family with no suite yet: the idea that unlocks it (click opens it in Research). */
function LockedLine({ s, family, node }: { s: GameStateV2; family: RLFamily; node: string }) {
  const I = famIcon(family);
  const n = TREE_BY_ID[node];
  const st = nodeStatus(s, node);
  const pr = s.player.tree[node]?.progress ?? 0;
  return (
    <div className="sx-line locked" data-suite={family} data-locked={node}>
      <span className="sx-fam"><I size={14} /><b>{RL_FAMILY_LABEL[family]}</b></span>
      <Tip content={() => <TipCard title={<>{RL_FAMILY_LABEL[family]} <Lock size={11} /></>} value={<span className="tag2">no suite</span>} rows={[{ label: 'Unlocked by', value: `${n?.name ?? node} (${node})` }, { label: 'Status', value: st === 'active' ? `${F.pct(pr)} researched` : st }]} footer="Click to open the idea in Research.">No environments for this family yet: runs cannot train on it. Once the idea is known, build its first suite here.</TipCard>}>
        <button className="bp-opt locked sx-lock" data-node={node} onClick={() => { store.setTab('research.sel', node); store.goto('research', { tab: 'tree' }); }}>
          <Lock size={11} />needs {n?.name ?? node} <span className="dim">({node})</span>{st === 'active' ? <span className="dim"> · {F.pct(pr)}</span> : st === 'queued' ? <span className="dim"> · queued</span> : null}
        </button>
      </Tip>
    </div>
  );
}
