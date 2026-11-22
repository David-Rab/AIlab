// Company › Work (model v3 V2b; mockups-v3/v3-v2b-work, IA v3-v2b-IA.md): who does each kind of work. One card per role
// and work type (engineers · software engineering, research engineers · experiments & runs, scientists · research ideas &
// taste): effective labour of people + AI agents (home; for engineers that is build capacity), the model's fit against
// the median expert and the best human, coverage, and where the labour goes (needs in priority order with caps and
// overflow: the player's broad allocation). Below: the work-type milestones with the distance to each criterion.
import type { ReactNode } from 'react';
import { ChevronDown, ChevronUp, GripVertical } from 'lucide-react';
import { buildSplit, capPriorityList, dateOf, engAllocView, fmtDate, milestoneViews, reAllocView, safReAllocView, workTypeViews } from '../../../engine/v2';
import type { AllocView, GameStateV2, MilestoneView, NeedView, WorkTypeView } from '../../../engine/v2';
import { store } from '../store';
import { Term, Tip, TipCard } from '../ui';
import { Card, Ref } from '../kit';
import { ICON } from '../icons';
import { C } from '../theme';
import * as F from '../fmt';
import { BuildLoad } from './BuildLoad';
import './work.css';

type Role = 'eng' | 're' | 'sci';
const ROLE_OF: Record<string, Role> = { SWE: 'eng', EXP: 're', IDEAS: 'sci' };
const ROLE_NAME: Record<Role, string> = { eng: 'Engineers', re: 'Research engineers', sci: 'Scientists' };
const ROLE_ICON: Record<Role, typeof ICON.L> = { eng: ICON.roleEng, re: ICON.roleRE, sci: ICON.roleSci };
const ROLE_TERM: Record<Role, string> = { eng: 'roleEng', re: 'roleRE', sci: 'roleSci' };
const NEED_TERM: Record<string, string> = { ops: 'runOps', evals: 'evals', exp: 'reNeeds', runs: 'engNeeds', upkeep: 'productUpkeep', builds: 'buildQueue', cases: 'investigation', patches: 'safReNeeds', safExp: 'safReNeeds', reval: 'toolUpkeep' };
const NEED_COLOR: Record<string, string> = { ops: '#9b6be0', evals: '#c06bb0', exp: '#7d55c0', runs: '#9b6be0', upkeep: '#b08e1a', builds: '#3a8ae0', cases: '#d0604a', patches: '#c08a3a', safExp: '#3aa88a', reval: '#4f8fd1' };
const NEED_SHORT: Record<string, string> = { ops: 'Run operations', evals: 'Evaluations', exp: 'Project experiments', runs: 'Setups & adoptions', upkeep: 'Product upkeep', builds: 'Builds', cases: 'Open cases', patches: 'Patches & removals', safExp: 'Line experiments', reval: 'Tool re-validation' };
const SHARES = [0.25, 0.5, 0.75, 0.9];
const COUNTS = [1, 2, 4, 8, 16];
const fmtH = (min: number) => (min >= 60 * 24 * 365 ? `${F.short(min / (60 * 24 * 365))} y` : min >= 60 * 24 ? `${F.short(min / (60 * 24))} d` : min >= 60 ? `${F.short(min / 60)} h` : `${Math.round(min)} min`);
const WT_SHORT: Record<string, string> = { SWE: 'Software', EXP: 'Experiments', IDEAS: 'Research ideas', SAF_EXP: 'Safety experiments', SAF_IDEAS: 'Safety ideas', OTHER: 'Other expert work' };
const oom = (x: number) => `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(2)} OOM`;

/** Fit on a shared OOM axis: the median expert, the best human, the model. */
function FitAxis({ w }: { w: WorkTypeView }) {
  const gap = Math.max(0.2, w.best - w.med);
  const lo = Math.min(w.med - 0.4 * gap, w.fit - 0.2 * gap);
  const hi = Math.max(w.best + 0.6 * gap, w.fit + 0.2 * gap);
  const x = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`;
  const has = Number.isFinite(w.fit);
  return (
    <Tip content={() => <TipCard title={<Term id="fit">Fit</Term>} value={has ? oom(w.fit - w.best) : 'no model'} rows={[
      { label: 'vs the median expert', value: has ? oom(w.fit - w.med) : '—' },
      { label: 'vs the best human', value: has ? oom(w.fit - w.best) : '—' },
      { label: <Term id="winRate">Win rate vs median expert</Term>, value: F.pct(w.win) },
      { label: <Term id="assist">Assist to people</Term>, value: `×${w.assist.toFixed(2)}` },
    ]}>{`${w.version ?? 'No model'} on ${w.name.toLowerCase()}, in OOM of effective compute in this work's domains.`}</TipCard>}>
      <div className="wk-fit" data-test={`fit.${w.wt}`}>
        <i className="ax" />
        <i className="tick" style={{ left: x(w.med) }} /><span className="tl" style={{ left: x(w.med) }}><Term id="medianExpert">median</Term></span>
        <i className="tick best" style={{ left: x(w.best) }} /><span className="tl" style={{ left: x(w.best) }}><Term id="bestHuman">best human</Term></span>
        {has && <i className="dot" style={{ left: x(w.fit) }} />}
      </div>
    </Tip>
  );
}

function CapSelect({ n, act, cap }: { n: NeedView<string>; act: string; cap: number }) {
  const cur = n.share !== undefined ? `share:${n.share}` : n.max !== undefined ? `max:${n.max}` : '';
  const opts: [string, string][] = [['', 'no cap'], ...SHARES.map((x) => [`share:${x}`, `≤ ${F.pct(x)}`] as [string, string]), ...COUNTS.map((x) => [`max:${x}`, `≤ ${x}`] as [string, string])];
  if (cur && !opts.some((o) => o[0] === cur)) opts.push([cur, n.share !== undefined ? `≤ ${F.pct(n.share)}` : `≤ ${n.max}`]);
  return (
    <Tip content={() => <TipCard title={<Term id="allocCap">Cap</Term>} value={cur ? opts.find((o) => o[0] === cur)?.[1] : 'none'} rows={[{ label: 'Capacity', value: cap.toFixed(1) }]}>A team count or a share of the capacity; what it leaves flows to the needs below.</TipCard>}>
      <select className="chip-select wk-cap" data-test={`cap.${n.k}`} value={cur} onChange={(e) => {
        const [kind, val] = e.target.value.split(':');
        store.act(act, { need: n.k, share: kind === 'share' ? Number(val) : -1, max: kind === 'max' ? Number(val) : -1 });
      }}>
        {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </Tip>
  );
}

/** Needs in priority order: drag or ▲▼ to reorder, a cap per need, bars of what each got vs its demand. */
function NeedList({ a, act, unit, extra }: { a: AllocView<string>; act: string; unit: string; extra?: (k: string) => ReactNode }) {
  const setOrder = (o: string[]) => store.act(act, { order: o.join(',') });
  const move = (k: string, d: number) => {
    const o = [...a.order];
    const i = o.indexOf(k);
    const j = i + d;
    if (j < 0 || j >= o.length) return;
    [o[i], o[j]] = [o[j], o[i]];
    setOrder(o);
  };
  const scale = Math.max(1e-9, a.cap);
  return (
    <div className="wk-needs" data-test={`needs.${act}`}>
      {/* F6d: the unit of the gets / needs column ("0.0/0.0" had none on the card). */}
      <div className="small dim wk-needs-h" data-test={`needs-unit.${act}`}><span>gets / needs · {unit}</span></div>
      {a.needs.map((n, i) => {
        const dem = Number.isFinite(n.demand) ? n.demand : null;
        return (
          <div key={n.k} className="wk-need" data-need={n.k} draggable
            onDragStart={(e) => e.dataTransfer.setData('text/plain', n.k)} onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const from = e.dataTransfer.getData('text/plain'); if (!from || from === n.k) return; const o = a.order.filter((x) => x !== from); o.splice(o.indexOf(n.k), 0, from); setOrder(o); }}>
            <span className="rp-grip"><GripVertical size={12} /></span>
            <span className="rp-rk num">{i + 1}</span>
            <span className="ellip"><Term id={NEED_TERM[n.k]}>{NEED_SHORT[n.k]}</Term>{extra?.(n.k)}</span>
            <Tip content={() => <TipCard title={n.label} rows={[
              { label: 'Gets', value: `${n.got.toFixed(1)} ${unit}` },
              { label: 'Needs', value: dem === null ? 'whatever is left' : `${dem.toFixed(1)} ${unit}` },
              ...(n.short > 0.05 ? [{ label: 'Short', value: `${n.short.toFixed(1)} ${unit}`, tone: 'neg' as const }] : []),
              // RD-B09: run operations short → running runs and the stream advance at the share served.
              ...(n.k === 'ops' && dem !== null && n.short > 0.05 ? [{ label: 'Runs train at', value: F.pct(Math.min(1, n.got / Math.max(1e-9, dem))), tone: 'neg' as const }] : []),
            ]}>{n.capped ? 'Held by its cap: the rest flows down.' : n.short > 0.05 ? 'The needs above it took the capacity.' : 'Fully served.'}{n.k === 'ops' && n.short > 0.05 ? ' Running runs slow to the share served.' : ''}</TipCard>}>
              <span className="wk-nbar"><i style={{ width: `${Math.min(100, (n.got / scale) * 100)}%`, background: NEED_COLOR[n.k] }} />{dem !== null && dem > n.got + 1e-6 && <i className="short" style={{ left: `${Math.min(100, (n.got / scale) * 100)}%`, width: `${Math.min(100, ((dem - n.got) / scale) * 100)}%` }} />}</span>
            </Tip>
            <Tip content={() => <TipCard title={n.label} value={`${n.got.toFixed(1)} of ${dem === null ? 'the rest' : dem.toFixed(1)}`}>{unit}</TipCard>}>
              <span className={`num small ${n.short > 0.05 ? 'tone-neg' : ''}`}>{n.got.toFixed(1)}/{dem === null ? 'rest' : dem.toFixed(1)}</span>
            </Tip>
            <CapSelect n={n} act={act} cap={a.cap} />
            <span className="rp-mv">
              <button className="btn btn-sm btn-ghost" disabled={i === 0} data-test={`need-up.${n.k}`} onClick={() => move(n.k, -1)}><ChevronUp size={11} /></button>
              <button className="btn btn-sm btn-ghost" disabled={i === a.needs.length - 1} data-test={`need-down.${n.k}`} onClick={() => move(n.k, 1)}><ChevronDown size={11} /></button>
            </span>
          </div>
        );
      })}
      <Tip content={() => <TipCard title={<Term id="overflow">Overflow</Term>} value={`${F.short(a.idle)} ${unit} idle`}>Capacity no need takes. Engineers: queue a feature or launch; research engineers stay idle once run operations, evaluations and the projects in experiments are full: add a project to put them to work.</TipCard>}>
        <div className="small dim wk-idle" data-test={`idle.${act}`}><Term id="overflow">idle</Term> {F.short(a.idle)} {unit}</div>
      </Tip>
    </div>
  );
}

function RoleCard({ s, w }: { s: GameStateV2; w: WorkTypeView }) {
  const role = ROLE_OF[w.wt];
  const Ic = ROLE_ICON[role];
  const bs = role === 'eng' ? buildSplit(s) : undefined;
  const L = bs ? bs.capacity : w.L;
  const H = bs ? bs.human : w.humans;
  const m = H > 0 ? L / H : 0;
  const unit = role === 'eng' ? 'team-wk/wk' : 'team-eq';
  const labourTip = () => (
    <TipCard title={<Term id={role === 'eng' ? 'buildCapacity' : 'effectiveLabour'}>{role === 'eng' ? 'Build capacity' : 'Effective labour'}</Term>} value={`${F.short(L)} ${unit}`} rows={[
      { label: 'People (teams × quality)', value: H.toFixed(1) },
      { label: <Term id="assist">Assist on their work</Term>, value: `×${w.assist.toFixed(2)}` },
      { label: <Term id="aiFte">AI FTE</Term>, value: F.count(w.aiFte) },
      { label: <Term id="agentCopies">Copies × speed</Term>, value: `${F.count(w.copies)} × ${w.speed.toFixed(0)}` },
      { label: 'Agent compute', value: `${F.count(w.h100e)} H100e` },
      { label: <Term id="humanShare">Humans' share of the margin</Term>, value: F.pct(w.wH) },
    ]}>People and agents in the coding CES: AI does the covered share. It is not a sum: the bar shows the people and what AI adds.</TipCard>
  );
  const sci = role === 'sci' ? capPriorityList(s) : undefined;
  return (
    <Card className="wk-role" home={`work.${w.wt}`} title={<span className="row-i"><Ic size={15} /><Term id={ROLE_TERM[role]}>{ROLE_NAME[role]}</Term></span>}
      sub={<span className="row-i"><Term id="workType">{w.name.toLowerCase()}</Term> · {w.version ? <Ref id="agentPackage" to={{ panel: 'company', tab: 'people', anchor: 'agents' }}>{w.version}</Ref> : <span className="dim">no model</span>}</span>}>
      <div className="wk-hero" data-wt={w.wt} {...(role === 'eng' ? { 'data-home': 'buildCapacity' } : {})}>
        <Tip content={labourTip}><b className="num" data-test={`labour.${w.wt}`}>{F.short(L)}</b></Tip>
        <span className="dim">{unit}{role === 'eng' ? ' build' : ''}</span>
        <Tip content={labourTip}><span className="wk-m num">×{F.short(m)} with AI</span></Tip>
      </div>
      <Tip content={labourTip}>
        <span className="wk-split"><i style={{ flex: Math.max(1e-6, H), background: '#3a4d66' }} /><i style={{ flex: Math.max(0, L - H), background: '#4fd1bd' }} /></span>
      </Tip>
      <Tip content={labourTip}><div className="small dim wk-split-l"><span><i className="sw" style={{ background: '#3a4d66' }} />people {F.short(H)}</span><span><i className="sw" style={{ background: '#4fd1bd' }} />AI adds {F.short(Math.max(0, L - H))}</span></div></Tip>
      <div className="rp-k" style={{ marginTop: 10 }}><Term id="fit">Fit vs people</Term> · <Term id="coverage">coverage</Term></div>
      <FitAxis w={w} />
      <Tip content={() => <TipCard title={<Term id="coverage">Coverage</Term>} value={F.pct(w.coverage)} rows={[
        { label: <Term id="timeHorizon">50% time horizon</Term>, value: fmtH(w.h50) }, { label: '80% time horizon', value: fmtH(w.h80) },
        { label: <Term id="pAtLength">{`Success at ${w.H} h tasks`}</Term>, value: F.pct(w.pAtH) },
        { label: 'Superhuman mark', value: '90%' },
      ]}>Share of this work AI does on its own: fit around the best human × finishing a task of the work's typical length.</TipCard>}>
        <div className="wk-cov" data-test={`coverage.${w.wt}`}><span className="small">coverage</span><span className="hb"><i style={{ width: `${w.coverage * 100}%` }} /><i className="mk" style={{ left: '90%' }} /></span><b className="num">{F.pct(w.coverage)}</b></div>
      </Tip>
      <div className="rp-k" style={{ marginTop: 10 }}>{role === 'sci' ? 'Where it goes' : <Term id={role === 'eng' ? 'engNeeds' : 'reNeeds'}>Where it goes · priority order</Term>}</div>
      {role === 'eng' && <><BuildLoad s={s} compact /><NeedList a={engAllocView(s)} act="build.engAlloc" unit="team-wk/wk" /></>}
      {role === 're' && <NeedList a={reAllocView(s)} act="research.reAlloc" unit="team-eq" />}
      {role === 'sci' && sci && (
        <div className="small">
          <Tip content={() => <TipCard title="Capability science teams" rows={sci.list.slice(0, 6).map((v) => ({ label: v.name, value: `${v.teams.length} of ${v.want}` }))}>Placed down the priority list (teams wanted, specialty first). Safety scientists work on Safety › Research lines.</TipCard>}>
            <span>{sci.list.length} projects · {sci.list.reduce((a, v) => a + v.teams.length, 0)} teams placed</span>
          </Tip>{' '}
          <Ref id="projectQueue" to={{ panel: 'research', tab: 'projects' }}>Research › Priorities</Ref>
        </div>
      )}
    </Card>
  );
}

function Criterion({ c }: { c: MilestoneView['criteria'][number] }) {
  if (c.kind === 'coverage') return (
    <Tip content={() => <TipCard title={c.label} value={`${F.pct(c.have)} of ${F.pct(c.need)}`} />}>
      <div className="wk-crit"><span className="hb"><i style={{ width: `${Math.min(100, (c.have / c.need) * 100)}%`, background: c.met ? C.good : '#4fd1bd' }} /></span><span className="num small">{F.pct(c.have)}/{F.pct(c.need)}</span></div>
    </Tip>
  );
  if (c.kind === 'cost') return (
    <Tip content={() => <TipCard title={c.label} rows={[{ label: 'AI per work-hour', value: `$${F.short(c.have)}` }, { label: 'Best engineer per hour', value: `$${F.short(c.need)}` }]} />}>
      <div className="small">cost {c.met ? '✓' : '✗'} <span className="num">${F.short(c.have)} vs ${F.short(c.need)}/h</span></div>
    </Tip>
  );
  const d = c.have - c.need;
  return (
    <Tip content={() => <TipCard title={c.label} value={oom(d)}>{c.need > 0 ? 'Beyond the best human by twice the best-to-median gap.' : 'Fit minus the best human\'s.'}</TipCard>}>
      <div className="small">{c.wt ? WT_SHORT[c.wt] : ''} fit <span className={`num ${c.met ? 'tone-pos' : ''}`}>{c.met ? '✓' : oom(d)}</span></div>
    </Tip>
  );
}

/** RD-A04 (OD-9): the safety research engineers' needs list lives here, in LAB, beside the capability one. */
function SafReCard({ s }: { s: GameStateV2 }) {
  const a = safReAllocView(s);
  return (
    <Card className="wk-role" home="work.safRe" title={<span className="row-i"><ICON.roleRE size={15} /><Term id="safReNeeds">Safety research engineers</Term></span>}
      sub={<span className="small dim">{F.short(a.cap)} people · where they go, priority order</span>}>
      <NeedList a={a} act="research.safReAlloc" unit="people" />
    </Card>
  );
}

const MS_TERM = ['milestone', 'reliableAgent', 'researchAgent', 'sc', 'sar', 'siar', 'asi'];
function Milestones({ s }: { s: GameStateV2 }) {
  const ms = milestoneViews(s);
  const next = ms.find((m) => m.reachedDay === undefined);
  const wv = workTypeViews(s);
  const saf = wv.find((w) => w.wt === 'SAF_EXP');
  const safI = wv.find((w) => w.wt === 'SAF_IDEAS');
  return (
    <Card className="wk-ms" home="milestoneCriteria" title={<span className="row-i"><ICON.milestone size={15} /><Term id="milestone">Milestones</Term></span>} sub={<span>what each needs, on your closest live model</span>}>
      <div className="wk-mls">
        {ms.map((m) => (
          <div key={m.idx} className={`wk-ml ${m.reachedDay !== undefined ? 'done' : ''} ${next?.idx === m.idx ? 'next' : ''}`} data-ms={m.idx}>
            <b><Term id={MS_TERM[m.idx]}>{m.name}</Term>{m.reachedDay !== undefined ? ' ✓' : ''}</b>
            {m.reachedDay !== undefined
              ? <Tip content={() => <TipCard title={m.name} value={fmtDate(dateOf(s, m.reachedDay ?? 0))}>First crossed on this day.</TipCard>}><span className="small dim">{fmtDate(dateOf(s, m.reachedDay))}</span></Tip>
              : <>{m.criteria.map((c, i) => <Criterion key={i} c={c} />)}{m.version && <span className="small dim">on {m.version}</span>}</>}
          </div>
        ))}
      </div>
      {saf && safI && <div className="small dim wk-saf">
        <Tip content={() => <TipCard title="Safety work" rows={[
          { label: <>Safety experiments <Term id="coverage">coverage</Term></>, value: F.pct(saf.coverage) }, { label: 'Safety ideas coverage', value: F.pct(safI.coverage) },
          { label: <Term id="aiFte">AI FTE</Term>, value: F.count(saf.aiFte + safI.aiFte) }, { label: <Term id="aiDoneShare">Work AI does</Term>, value: `${F.pct(saf.A)} experiments · ${F.pct(safI.A)} ideas` },
        ]}>The safety research agents' work types, on the same labour function as capabilities work: Trusted to AI hands them a share of safety work and they do the part they cover. Lower verifiability and longer tasks put their coverage behind Experiments and Research ideas.</TipCard>}>
          <span><Term id="workType">Safety work</Term>: used by the safety research agents · coverage {F.pct(saf.coverage)} experiments, {F.pct(safI.coverage)} ideas</span>
        </Tip>{' '}<Ref id="trustedToAI" to={{ panel: 'safety', tab: 'lines' }}>Safety</Ref>
      </div>}
    </Card>
  );
}

export function Work({ s }: { s: GameStateV2 }) {
  const ws = workTypeViews(s).filter((w) => w.wt !== 'SAF_EXP' && w.wt !== 'SAF_IDEAS');
  return (
    <div className="wk-wrap" data-test="work-tab">
      <div className="wk-roles">{ws.map((w) => <RoleCard key={w.wt} s={s} w={w} />)}</div>
      <SafReCard s={s} />
      <Milestones s={s} />
    </div>
  );
}
