// Overview (UI-IA §5 Q4; mockups rd/overview.png, overview-tip.png): a HUB. "Your lab": the lab's loop, one box per
// screen with one verdict and a short reading (hubVerdicts, beliefs and facts); each box opens its screen, its numbers
// live there (tooltip = the breakdown). "The race": the lead lanes, the HOME of the lead detail (leadLanes: best guess
// and likely range per lab, B·intel). No risk number here: your models' risk lives on SAFETY, world risk on World.
// Goals show only while the tutorial runs.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { bestMeasuredVersion, dateOf, fmtDate, hubVerdicts, leadLanes } from '../../../engine/v2';
import type { GameStateV2, HubBox, HubId, LeadLane } from '../../../engine/v2';
import { store } from '../store';
import { Term, Tip, TipCard } from '../ui';
import { Card } from '../kit';
import { ICON } from '../icons';
import { C, labColor as labHue, monogram } from '../theme';
import { Goals, goalsActive } from '../shell/Onboarding';
import './overview.css';

// ───────────────────────────── Your lab (hub) ─────────────────────────────

const BOX: Record<HubId, { name: string; icon: typeof ICON.L; panel: string; tab?: string; desc: string }> = {
  compute: { name: 'Compute', icon: ICON.computePanel, panel: 'compute', desc: 'Chips online, on order and waiting for power.' },
  lab: { name: 'Lab', icon: ICON.company, panel: 'lab', desc: 'Where your compute and people go, and what sits idle.' },
  research: { name: 'Research', icon: ICON.research, panel: 'research', desc: 'Your research programmes and what limits them.' },
  training: { name: 'Training', icon: ICON.runs, panel: 'blueprint', desc: 'Runs in progress and the next run.' },
  models: { name: 'Models', icon: ICON.models, panel: 'models', desc: 'Your models: in use and in testing.' },
  products: { name: 'Products', icon: ICON.deploy, panel: 'products', desc: 'What customers buy and what limits revenue.' },
  finance: { name: 'Finance', icon: ICON.finance, panel: 'finance', desc: 'Cash, runway and raising.' },
  safety: { name: 'Safety', icon: ICON.safety, panel: 'safety', desc: 'Safety staff and what they cover.' },
  world: { name: 'World', icon: ICON.world, panel: 'world', tab: 'risk', desc: 'Risk from rival labs, China, misuse and war.' },
};
const ROW: HubId[] = ['compute', 'lab', 'research', 'training', 'models', 'products', 'finance'];
const EDGE = ['chips', 'people', 'know-how', 'models', 'models', 'revenue'];
const TONE: Record<HubBox['tone'], string> = { good: C.good, warn: C.watch, info: '#8fb8ea', bad: C.bad };

function HubNode({ b, x, y, w, h, side }: { b: HubBox; x: number; y: number; w: number; h: number; side?: boolean }) {
  const d = BOX[b.id];
  const Icon = d.icon;
  return (
    <Tip as="div" className="hub-tipw" style={{ left: x, top: y, width: w, height: h }} content={() => (
      <TipCard title={d.name} value={<span style={{ color: TONE[b.tone] }}>{b.verdict}</span>} rows={b.rows.map((r) => ({ label: r.label, value: r.value }))}>
        {`${d.desc} Click to open ${d.name}.`}
      </TipCard>
    )}>
      <button className={`hn ${b.tone} ${side ? 'side' : ''}`} data-hub={b.id} onClick={() => store.goto(d.panel, d.tab ? { tab: d.tab } : {})}>
        <span className="h"><Icon size={14} />{d.name}<ChevronRight size={14} className="go" /></span>
        <span className="vd" data-test={`hub-verdict.${b.id}`}><i className="dot" />{b.verdict}</span>
        <span className="sb">{b.sub}</span>
      </button>
    </Tip>
  );
}

function Hub({ s }: { s: GameStateV2 }) {
  const ref = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(1500);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const v = hubVerdicts(s);
  const NW = Math.min(190, (W - 32 - 6 * 50) / 7);
  const NH = 92;
  const Y = 124;
  const gap = (W - 32 - 7 * NW) / 6;
  const X = (i: number) => 16 + i * (NW + gap);
  const cx = (i: number) => X(i) + NW / 2;
  const mid = Y + NH / 2;
  const sy = Y + NH + 58;
  const sx = (cx(4) + cx(5)) / 2 - NW / 2;
  const H = sy + NH + 8;
  const line = '#4a5b72';
  const arrow = (x1: number, x2: number, y: number) => <g key={`a${x1}`}><line x1={x1} y1={y} x2={x2 - 7} y2={y} stroke={line} strokeWidth={2} /><path d={`M${x2 - 8},${y - 5} L${x2},${y} L${x2 - 8},${y + 5}`} fill={line} /></g>;
  const down = (x: number, y: number, col: string) => <path d={`M${x - 5},${y - 10} L${x},${y - 2} L${x + 5},${y - 10}`} fill={col} />;
  return (
    <div className="hub" ref={ref} style={{ height: H }} data-test="hub">
      <svg className="edges" width={W} height={H}>
        <path d={`M${cx(6)},${Y - 2} L${cx(6)},36 L${cx(0)},36 L${cx(0)},${Y - 9}`} fill="none" stroke={line} strokeWidth={2} />{down(cx(0), Y, line)}
        <path d={`M${cx(4)},${Y - 2} L${cx(4)},80 L${cx(1)},80 L${cx(1)},${Y - 9}`} fill="none" stroke="#7fe0cf" strokeWidth={2} strokeDasharray="6 5" />{down(cx(1), Y, '#7fe0cf')}
        {ROW.slice(0, -1).map((_, i) => arrow(X(i) + NW + 4, X(i + 1) - 4, mid))}
        <path d={`M${sx + NW / 2},${sy} L${sx + NW / 2},${sy - 22} M${cx(4)},${Y + NH} L${cx(4)},${sy - 22} L${cx(5)},${sy - 22} L${cx(5)},${Y + NH}`} fill="none" stroke="#22a394" strokeWidth={2} strokeDasharray="3 4" />
        <path d={`M${cx(6)},${sy} L${cx(6)},${Y + NH + 2}`} fill="none" stroke={line} strokeWidth={2} strokeDasharray="3 4" />
      </svg>
      <span className="el" style={{ left: (cx(0) + cx(6)) / 2, top: 27 }}>revenue and investors pay for chips and people</span>
      <span className="el ai" style={{ left: (cx(1) + cx(4)) / 2, top: 71 }}><ICON.agents size={12} /> your models join the lab as <Term id="agentPackage">AI staff</Term>: the <Term id="takeoffLoop">takeoff loop</Term></span>
      <span className="el saf" style={{ left: (cx(4) + cx(5)) / 2, top: sy - 32 }}>watches models at work</span>
      {EDGE.map((t, i) => <span key={i} className="el bare" style={{ left: X(i) + NW + gap / 2, top: mid + 8 }}>{t}</span>)}
      {ROW.map((id, i) => <HubNode key={id} b={v[id]} x={X(i)} y={Y} w={NW} h={NH} />)}
      <HubNode b={v.safety} x={sx} y={sy} w={NW} h={NH} side />
      <HubNode b={v.world} x={X(6)} y={sy} w={NW} h={NH} side />
    </div>
  );
}

// ───────────────────────────── The race (lead lanes) ─────────────────────────────

const days = (d: number) => `${Math.abs(Math.round(d))} d`;
const side = (d: number) => (Math.round(d) > 0 ? 'ahead' : Math.round(d) < 0 ? 'behind' : 'level');
function rangeWords(lo: number, hi: number) {
  if (lo > 0 || hi < 0) return `${Math.min(Math.abs(lo), Math.abs(hi))}–${Math.max(Math.abs(lo), Math.abs(hi))} d ${lo > 0 ? 'ahead' : 'behind'}`;
  const f = (x: number) => (x > 0 ? `${x} ahead` : x < 0 ? `${-x} behind` : 'level');
  return `${f(lo)} – ${f(hi)}`;
}
const labColor = (l: LeadLane) => labHue(l.id);

/** The lane's range strip for its tooltip: you at 0, their best guess and likely range. */
function RangeStrip({ l, D }: { l: LeadLane; D: number }) {
  const w = 410;
  const x = (d: number) => ((Math.max(-D, Math.min(D, d)) + D) / (2 * D)) * w;
  return (
    <svg width={w} height={46} className="ov-strip">
      <line x1={0} y1={18} x2={w} y2={18} stroke="#33435a" strokeWidth={2} />
      <rect x={x(0)} y={4} width={w - x(0)} height={28} fill="rgba(239,107,107,.07)" />
      <line x1={x(0)} y1={2} x2={x(0)} y2={34} stroke={C.you} strokeWidth={2} />
      <rect x={x(l.lo)} y={13} width={Math.max(2, x(l.hi) - x(l.lo))} height={10} rx={5} fill={labColor(l)} opacity={0.45} />
      <circle cx={x(l.ahead)} cy={18} r={8} fill={labColor(l)} />
      <text x={x(0)} y={44} className="ov-st you" textAnchor="middle">you</text>
      {Math.abs(x(l.lo) - x(0)) > 24 && <text x={x(l.lo)} y={44} className="ov-st" textAnchor="middle">{l.lo < 0 ? '−' : ''}{days(l.lo)}</text>}
      {Math.abs(x(l.hi) - x(0)) > 24 && <text x={x(l.hi)} y={44} className="ov-st" textAnchor="middle">{l.hi < 0 ? '−' : ''}{days(l.hi)}</text>}
    </svg>
  );
}

function LaneTip({ s, l, D }: { s: GameStateV2; l: LeadLane; D: number }) {
  const you = bestMeasuredVersion(s)?.name; // UB-F: "you" = your best measured model (not one still in testing, not the AI-staff model)
  const sd = side(l.ahead);
  const intro: ReactNode = sd === 'behind'
    ? <>How far {l.name}'s <Term id="bestInternal">best internal model</Term> trails your best model, by your estimate.</>
    : <>How long until your best model matches {l.name}'s <Term id="bestInternal">best internal model</Term>, by your estimate.</>;
  return (
    <TipCard title={<span>{l.name} <span className="dim small">{l.china ? 'China' : 'US lab'}</span></span>}
      value={<span className={sd === 'ahead' ? 'tone-neg' : 'tone-pos'}>{days(l.ahead)} {sd}</span>}>
      <div className="ov-tip">
        <div>{intro}</div>
        <div className="tip-cap"><Term id="likelyRange">Likely range</Term></div>
        <RangeStrip l={l} D={D} />
        <div className="tip-cap">How you know</div>
        <div className="ov-brk">
          <span><Term id="intelError">Intel report</Term></span><span className="num">{l.reportDay !== undefined ? fmtDate(dateOf(s, l.reportDay)) : 'none yet'}</span>
          <span className="dim">{l.publicModel ? `Their newest public model (${l.publicModel}), plus the gap their safety framework allows before release` : 'No public model yet: evaluator reports and intel only'}</span><span />
          <span>Your best measured model</span><span className="num">{you ?? '—'}</span>
        </div>
        <div className="ov-links"><button className="ref-chip" data-ref={`lane-risk.${l.id}`} onClick={() => store.goto('world', { tab: 'risk' })}><ICON.world size={12} /> Risk from their models <ICON.go size={11} /></button></div>
      </div>
    </TipCard>
  );
}

function Race({ s }: { s: GameStateV2 }) {
  const lanes = leadLanes(s);
  const far = Math.max(365, ...lanes.map((l) => Math.max(Math.abs(l.lo), Math.abs(l.hi))));
  const D = far <= 365 ? 365 : Math.ceil(far / 180) * 180;
  const P = (d: number) => ((Math.max(-D, Math.min(D, d)) + D) / (2 * D)) * 100;
  const ticks = [-730, -540, -365, -180, -90, 90, 180, 365, 540, 730].filter((t) => Math.abs(t) <= D && (D <= 365 || Math.abs(t) !== 90));
  const tl = (t: number) => `${t > 0 ? '+' : '−'}${Math.abs(t) === 365 ? '1 yr' : Math.abs(t) === 730 ? '2 yr' : `${Math.abs(t)} d`}`;
  const you = bestMeasuredVersion(s)?.name; // UB-F: "you" = your best measured model (not one still in testing, not the AI-staff model)
  return (
    <div className="lanes" data-home="leadTrack" data-test="leadtrack">
      <div className="lane-ax">
        <div className="zone" style={{ left: `${P(0)}%` }} />
        {ticks.map((t) => <span key={t}><i className="axg" style={{ left: `${P(t)}%` }} /><span className="axl" style={{ left: `${P(t)}%` }}>{tl(t)}</span></span>)}
        <span className="zl behind" style={{ right: `${100 - P(0) + 1}%` }}>← behind you</span>
        <span className="zl ahead" style={{ left: `${P(0) + 1}%` }}>ahead of you →</span>
        <i className="youline" style={{ left: `calc(${P(0)}% - 1px)` }} />
        <span className="youtag" style={{ left: `${P(0)}%` }}>YOU{you ? ` · ${you}` : ''}</span>
      </div>
      {lanes.map((l) => (
        <Tip as="div" key={l.id} className="lane-w" content={() => <LaneTip s={s} l={l} D={D} />}>
          <div className="lane" data-lane={l.id}>
            <span className="ln">{l.name}<span className={`fl ${l.china ? 'cn' : ''}`}>{l.china ? 'China' : 'US'}</span></span>
            <div className="tr">
              <i className="base" />
              <i className="rg" style={{ left: `${P(l.lo)}%`, width: `${Math.max(0.4, P(l.hi) - P(l.lo))}%`, background: labColor(l) }} />
              <span className="dt" style={{ left: `${P(l.ahead)}%`, background: labColor(l) }}>{monogram(l.name)}</span>
            </div>
            <div className="lval">
              <b className={`num ${side(l.ahead)}`}>{days(l.ahead)}</b><span className="w2">{side(l.ahead) === 'level' ? 'level with you' : `${side(l.ahead)} ${side(l.ahead) === 'ahead' ? 'of ' : ''}you`}</span>
              <div className="rg2">likely {rangeWords(l.lo, l.hi)}</div>
            </div>
          </div>
        </Tip>
      ))}
      {!lanes.length && <div className="dim small">No rival lab is active.</div>}
    </div>
  );
}

export function Overview({ s }: { s: GameStateV2 }) {
  const goals = goalsActive(s);
  return (
    <div className="panel-v2 overview" data-panel="overview">
      <Card title={<span className="ov-ttl"><ICON.company size={18} /> Your lab</span>} sub="how the parts feed each other · each box opens its screen" id="ctl-coreloop">
        <Hub s={s} />
      </Card>
      <Card className="ov-race" title={<span className="ov-ttl"><ICON.lead size={18} /> The race</span>} sub="how far each lab's best model is from yours, in days of progress · your estimate" id="ctl-leadtrack"
        right={<span className="legend2"><span><i className="ov-dot" style={{ background: C.rival }} />US lab</span><span><i className="ov-dot" style={{ background: '#e05a9c' }} />China</span><span><i style={{ background: C.rival, opacity: 0.4, width: 22, height: 8, borderRadius: 4 }} /><Term id="likelyRange">likely range</Term></span></span>}>
        <Race s={s} />
      </Card>
      {goals && <Goals s={s} />}
    </div>
  );
}
