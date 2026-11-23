// The core loop of STRUCTURE §2 (design/diagrams/STRUCT1) as a clickable diagram. Overview: live, each system with a
// one-word verdict and a short reading that links to the system's home (no datum is homed here). Codex: static.
//   Financing → Cash → Teams → Research → Models → Assurance → Products → Customers → (Cash)
//   Compute feeds Research, Models and Products; the takeoff loop: internal agents take over the teams' work.
import type { ReactNode } from 'react';
import {
  aiShareByRole, bestPlayerVersion, divisionView, engine, idleChips, idleTeams, measuredLOf, productReadouts, runwayOf,
} from '../../../engine/v2';
import type { GameStateV2 } from '../../../engine/v2';
import { PRODUCT_DEFS } from '../../../data/v2/features';
import { store } from '../store';
import { Term, Tip, TipCard } from '../ui';
import * as F from '../fmt';
import { ICON } from '../icons';
import { C, runwayState, STATE_COLOR } from '../theme';
import type { GoTarget } from '../kit';
import { isDivision } from '../../../data/v2/starts';
import { customerCount, customerShare, divisionStatus } from '../shell/selectors';

type Tone = 'good' | 'watch' | 'bad' | 'neutral';
const TONE: Record<Tone, string> = { good: C.good, watch: C.watch, bad: C.bad, neutral: C.text3 };

interface LoopNode { id: string; n?: number; name: string; term: string; sub: string; icon: typeof ICON.L; to: GoTarget; x: number; y: number; w?: number; store?: boolean }
const W = 1500;
const NW = 158;
const NH = 50;
const Y0 = 60;
const NODES: LoopNode[] = [
  { id: 'financing', name: 'Financing', term: 'raiseCeiling', sub: 'raises · debt · deals', icon: ICON.raise, to: { panel: 'finance' }, x: 8, y: Y0 },
  { id: 'cash', name: 'Cash', term: 'cash', sub: 'buys people and compute', icon: ICON.cash, to: { panel: 'finance' }, x: 196, y: Y0, store: true },
  { id: 'teams', n: 1, name: 'Teams', term: 'team', sub: 'engineers · RE · scientists', icon: ICON.staff, to: { panel: 'company', tab: 'people' }, x: 384, y: Y0 },
  { id: 'research', n: 2, name: 'Research', term: 'techTree', sub: 'projects · recipe', icon: ICON.research, to: { panel: 'research' }, x: 572, y: Y0 },
  { id: 'models', n: 3, name: 'Models', term: 'blueprint', sub: 'blueprint → training run', icon: ICON.models, to: { panel: 'models' }, x: 760, y: Y0 },
  { id: 'assurance', n: 4, name: 'Assurance', term: 'sightLimit', sub: 'sight limit', icon: ICON.U, to: { panel: 'safety' }, x: 948, y: Y0 },
  { id: 'products', n: 5, name: 'Products', term: 'product', sub: 'features · price · safeguards', icon: ICON.product, to: { panel: 'products' }, x: 1136, y: Y0 },
  { id: 'customers', n: 6, name: 'Customers', term: 'customerStock', sub: 'share of spend', icon: ICON.staff, to: { panel: 'products' }, x: 1324, y: Y0, w: 168 },
  { id: 'compute', name: 'Compute', term: 'computeOnline', sub: 'H100e online', icon: ICON.compute, to: { panel: 'compute' }, x: 384, y: Y0 + 82, store: true },
];
const BY = Object.fromEntries(NODES.map((n) => [n.id, n]));
const R = (id: string) => BY[id].x + (BY[id].w ?? NW);
const L = (id: string) => BY[id].x;
const MY = (id: string) => BY[id].y + NH / 2;

export interface Reading { text: ReactNode; tone: Tone; tip?: { label: ReactNode; value: ReactNode }[] }

/** One verdict and short reading per system (live). Readings are summaries; each links to the system's home. */
function readings(s: GameStateV2): Record<string, Reading> {
  const p = s.player;
  const out: Record<string, Reading> = {};
  const rw = runwayOf(s);
  const st = runwayState(rw.q);
  if (isDivision(s)) {
    // Jank F2: a division cannot go broke; its verdict is the budget, not the runway.
    const v = divisionView(s)!;
    const st = divisionStatus(v);
    out.cash = { text: st.short, tone: st.tone === 'good' ? 'good' : st.tone === 'watch' ? 'watch' : 'bad', tip: [{ label: <Term id="parentBudget">Budget this year</Term>, value: F.money(v.budget) }, { label: 'Spent so far', value: F.money(v.spent) }, { label: <Term id="parentConf">Parent confidence</Term>, value: F.idx(v.confidence) }] };
  } else out.cash = { text: `runway ${st}`, tone: st === 'healthy' ? 'good' : st === 'tight' ? 'watch' : 'bad', tip: [{ label: <Term id="runway">Runway</Term>, value: <span style={{ color: STATE_COLOR[st] }}>{F.runway(rw.q, 12)}</span> }] };
  out.financing = p.board.preset === 'parent' ? { text: 'parent budget', tone: 'neutral' } : { text: p.finance.ws3.pendingRound ? 'round pending' : 'raise · borrow', tone: 'neutral' };
  const teams = p.teams;
  const idle = idleTeams(s).length;
  const ai = aiShareByRole(s);
  out.teams = {
    text: `${teams.length} teams${idle ? ` · ${idle} idle` : ''}`, tone: idle > 0 ? 'watch' : 'good',
    tip: [
      { label: <Term id="roleEng">Engineers</Term>, value: `${teams.filter((t) => t.role === 'eng').length} teams · AI ${F.pct(ai.eng)}` },
      { label: <Term id="roleRE">Research engineers</Term>, value: `${teams.filter((t) => t.role === 're').length} teams · AI ${F.pct(ai.re)}` },
      { label: <Term id="roleSci">Scientists</Term>, value: `${teams.filter((t) => t.role === 'sci').length} teams · AI ${F.pct(ai.sci)}` },
      ...(idle ? [{ label: 'Science teams with no project', value: String(idle) }] : []),
    ],
  };
  const active = p.research.queue.filter((id) => p.teams.some((t) => t.projectId === id)).length;
  const pr = engine.production(s, 'player');
  out.research = { text: `${active} project${active === 1 ? '' : 's'} active`, tone: active > 0 ? 'good' : 'watch', tip: [{ label: <Term id="rdmult">Research speed</Term>, value: pr ? `AI labour ${F.mult(p.research.last?.x?.mExp ?? 1)} in experiments · ${pr.label}` : '—' }] };
  const best = bestPlayerVersion(s);
  const running = p.models.runs.filter((r) => r.status === 'running').length;
  out.models = { text: best ? `${best.name}${running ? ` · ${running} run${running > 1 ? 's' : ''}` : ''}` : 'no model', tone: best ? (running ? 'good' : 'watch') : 'bad', tip: best ? [{ label: 'Best model', value: `${best.name} · L ${F.level(measuredLOf(s, best).L)}` }, { label: 'Runs in progress', value: String(running) }] : [] };
  const u = engine.sightLimit(s);
  out.assurance = { text: `sight limit L ${F.level(u.L)}`, tone: u.gap >= 0.3 ? 'good' : u.gap >= 0 ? 'watch' : 'bad', tip: [{ label: <Term id="sightLimit">Sight limit</Term>, value: `L ${F.level(u.L)} (${F.level(u.lo)}–${F.level(u.hi)}) · ${F.num(u.gap, 1, true)} vs capability` }] };
  const rd = productReadouts(s);
  const live = p.deployments.filter((d) => d.status === 'live' && rd.has(d.id));
  const capBound = live.filter((d) => rd.get(d.id)!.bound === 'capacity').length;
  out.products = { text: `${live.length} live${capBound ? ` · ${capBound} capacity-bound` : ''}`, tone: !live.length ? 'bad' : capBound ? 'watch' : 'good', tip: live.map((d) => ({ label: PRODUCT_DEFS[d.channel]?.name ?? d.channel, value: rd.get(d.id)!.bound })) };
  const shares = live.map((d) => rd.get(d.id)!.share);
  const top = shares.length ? Math.max(...shares) : 0;
  const behind = live.filter((d) => { const r = rd.get(d.id)!; return !!r.rival && r.rival.share > r.share; }).length;
  out.customers = {
    text: live.length ? `top share ${F.pct(top)}${behind ? ` · behind in ${behind}` : ''}` : 'none', tone: !live.length ? 'bad' : behind ? 'watch' : 'good',
    tip: live.map((d) => { const r = rd.get(d.id)!; return { label: PRODUCT_DEFS[d.channel]?.name ?? d.channel, value: [customerCount(r), customerShare(r), r.rival ? `best rival ${r.rival.name} ${F.pct(r.rival.share, 1)}` : ''].filter(Boolean).join(' · ') }; }),
  };
  const ic = idleChips(s);
  out.compute = { text: ic > 1 ? `${F.count(ic)} chips idle` : 'all chips powered', tone: ic > 1 ? 'watch' : 'good', tip: [{ label: <Term id="computeOnline">Online</Term>, value: `${F.count(p.computeOnline)} H100e` }] };
  out.takeoff = { text: `AI share: engineers ${F.pct(ai.eng)} · research eng. ${F.pct(ai.re)} · scientists ${F.pct(ai.sci)}`, tone: 'neutral' };
  return out;
}

function Edge({ d, dashed, color = '#4b5d77' }: { d: string; dashed?: boolean; color?: string }) {
  return <path d={d} fill="none" stroke={color} strokeWidth={dashed ? 1.6 : 2} strokeDasharray={dashed ? '5 4' : undefined} markerEnd="url(#cl-arrow)" />;
}

/** The loop. `live` = Overview (readings + verdicts, clickable); otherwise the static codex version. */
export function CoreLoop({ s, live }: { s: GameStateV2; live: boolean }) {
  const rd = live ? readings(s) : undefined;
  const H = Y0 + 82 + NH + 8;
  const go = (n: LoopNode) => live && store.goto(n.to.panel, n.to);
  const main = ['financing', 'cash', 'teams', 'research', 'models', 'assurance', 'products', 'customers'];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="coreloop" data-test={live ? 'coreloop' : 'coreloop-static'}>
      <defs>
        <marker id="cl-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#6b7c91" /></marker>
      </defs>
      {/* main chain */}
      {main.slice(0, -1).map((id, i) => <Edge key={id} d={`M${R(id)},${MY(id)} L${L(main[i + 1]) - 3},${MY(main[i + 1])}`} />)}
      {/* customers pay → cash */}
      <Edge d={`M${BY.customers.x + 84},${Y0} L${BY.customers.x + 84},14 L${BY.cash.x + 79},14 L${BY.cash.x + 79},${Y0 - 3}`} />
      <text x={(BY.cash.x + BY.customers.x) / 2 + 80} y={10} textAnchor="middle" className="cl-edge">customers pay</text>
      {/* takeoff loop: models → teams (dotted) */}
      <Edge dashed color={C.cap} d={`M${BY.models.x + 40},${Y0} C${BY.models.x + 20},${Y0 - 40} ${BY.teams.x + 110},${Y0 - 40} ${BY.teams.x + 100},${Y0 - 3}`} />
      <text x={(BY.teams.x + BY.models.x) / 2 + 70} y={Y0 - 34} textAnchor="middle" className="cl-edge takeoff">takeoff loop: internal agents do more of the teams' work{rd ? ` · ${rd.takeoff.text}` : ''}</text>
      {/* cash → compute; compute → research, models, products */}
      <Edge d={`M${BY.cash.x + 79},${Y0 + NH} L${BY.cash.x + 79},${MY('compute')} L${L('compute') - 3},${MY('compute')}`} />
      {(['research', 'models', 'products'] as const).map((id) => <Edge key={id} d={`M${R('compute')},${MY('compute')} L${BY[id].x + 60},${MY('compute')} L${BY[id].x + 60},${Y0 + NH + 3}`} />)}
      {NODES.map((n) => {
        const r = rd?.[n.id];
        const w = n.w ?? NW;
        const Ic = n.icon;
        const body = (
          <g className={`cl-node ${live ? 'live' : ''}`} data-loop={n.id} onClick={() => go(n)}>
            <rect x={n.x} y={n.y} width={w} height={NH} rx={n.store ? 14 : 6} fill={C.panel2} stroke={r ? TONE[r.tone] : C.line2} strokeWidth={r ? 1.6 : 1} />
            {r && <circle cx={n.x + w - 10} cy={n.y + 10} r={4} fill={TONE[r.tone]} />}
            <foreignObject x={n.x + 8} y={n.y + 6} width={w - 16} height={NH - 10}>
              <div className="cl-in">
                <div className="cl-t"><Ic size={13} />{n.n ? <span className="cl-n">{n.n}</span> : null}<b>{n.name}</b></div>
                <div className={`cl-r ${r ? `tone-${r.tone}` : ''}`}>{r ? r.text : n.sub}</div>
              </div>
            </foreignObject>
          </g>
        );
        return live ? (
          <Tip as="g" key={n.id} content={() => <TipCard title={<Term id={n.term}>{n.name}</Term>} rows={r?.tip}>{n.sub}. Click to open its home screen.</TipCard>}>{body}</Tip>
        ) : <g key={n.id}>{body}</g>;
      })}
    </svg>
  );
}
