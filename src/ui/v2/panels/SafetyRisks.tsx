// UB-9: the SAFETY header (all tabs) and SAFETY › Risks (UI-IA §1 SAFETY, SAFETY-REDESIGN §2.4 / §7; approved mockups
// design/ux/mockups/rd/safety.png, safety-wide.png). HOME of: the model picker, Loss-of-control risk with its range strip
// (the L0 item is the lab's highest, from the same computation), Unstopped harm / yr by severity, the sight curve (how
// often your instruments read a hidden goal, by capability, against the 50% line), the Safety framework's current hold,
// and the harmful-acts table (Would try × Able to × Chances / yr × (1 − Stop rate) = Unstopped / yr). Reads believed,
// measured and fact readouts only (safetyReadouts.ts, lossRisk.ts, sightLimit.ts sightCurve, core/certainty.ts).
import { useMemo, type ReactNode } from 'react';
import { ArrowDown, Drama, Eye, Ghost, Hourglass, ScrollText, Shield } from 'lucide-react';
import {
  actReadouts, chanceCertainty, footholdView, isUnknown, measuredDomainOf, measuredLOf, MILESTONE_NAMES, riskTableOf, runBand, safetyModels, safetyView, sightCurve,
  sightGaps, unstoppedBySeverity, versionById,
} from '../../../engine/v2';
import type { ActReadout, GameStateV2, LossRisk, SafetyModelOption } from '../../../engine/v2';
import { LEVEL_KNOTS } from '../../../data/v2/calibration';
import { store } from '../store';
import { Term, Tip, TipCard } from '../ui';
import { Ref } from '../kit';
import * as F from '../fmt';
import { ICON } from '../icons';
import { C } from '../theme';

/** A chance as the readouts show it: "< 0.1%" below 0.1% (never 0%), one decimal below 10%. */
export const chance = (x: number) => (x < 0.001 ? '< 0.1%' : F.pct(x, x < 0.1 ? 1 : 0));
/** An act count per year: "~0" below 0.0005, else 2–3 significant digits. */
const rate = (x: number) => (x < 0.0005 ? '~0' : x < 0.1 ? x.toFixed(3) : x < 1 ? x.toFixed(2) : x < 10 ? x.toFixed(1) : F.count(x));
const DOMAIN_WORD: Record<string, string> = { CODE: 'Code', RSCH: 'AI research', REASON: 'Math & reasoning', AGENCY: 'Long tasks', SOCIAL: 'Social & general text', MEDIA: 'Media', CYBER: 'Cyber', BIO: 'Bio', PHYS: 'Physical' };
const TAB = (tab: string, anchor?: string) => ({ panel: 'safety', tab, ...(anchor ? { anchor } : {}) });

/** The model SAFETY reads: the picked one if it is still around, else the riskiest model you run. */
export function useSafetyPick(s: GameStateV2): { models: SafetyModelOption[]; pick?: SafetyModelOption; id?: string } {
  const models = useMemo(() => safetyModels(s), [s, store.version]);
  const sel = store.sel.versionId;
  const pick = models.find((m) => m.id === sel) ?? models[0];
  const id = pick?.id ?? (versionById(s, sel) ? sel : undefined);
  return { models, pick, id };
}

const what = (m: SafetyModelOption) => [m.jobs.length ? `AI staff: ${m.jobs.join(', ')}` : '', m.products ? `${m.jobs.length ? 'also in ' : 'in '}${m.products} product${m.products > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ');

// ───────── header ─────────

export function SafetyHeader({ s }: { s: GameStateV2 }) {
  const { models, pick, id } = useSafetyPick(s);
  const rt = useMemo(() => riskTableOf(s, id), [s, store.version, id]);
  const testing = models.find((m) => m.evaluating);
  return (
    <div className="sfh" data-home="safetyHeader">
      <div className="phead sfh-pick">
        <ICON.safety size={20} className="phead-ic" />
        <h1>Safety</h1>
        <Tip content={() => <TipCard title="Model" value={pick?.name ?? '—'}>The model every Safety tab reads. It starts on your riskiest running model (the highest Loss-of-control risk), the one the top bar names.</TipCard>}>
          <label className="sfh-mpick"><ICON.models size={15} />
            <select data-test="sf-model" value={id ?? ''} onChange={(e) => store.select({ versionId: e.target.value })}>
              {models.map((m) => <option key={m.id} value={m.id}>{m.name}{what(m) ? ` · ${what(m)}` : ''}</option>)}
              {id && !models.some((m) => m.id === id) && <option value={id}>{versionById(s, id)?.name ?? id} · not running</option>}
            </select>
          </label>
        </Tip>
        {testing && <Tip content={() => <TipCard title={<>{testing.name} in testing</>}>Its evals have not finished, so its own skills are not measured yet: its Able to reads a measured relative&apos;s skill until they do.</TipCard>}>
          <span className="sfh-chip" data-test="sf-testing"><Hourglass size={12} /> {testing.name} in testing: <Term id="actCapability">Able to</Term> unknown until evals finish</span>
        </Tip>}
      </div>
      <div className="sfh-tiles">
        <RiskTile r={pick?.risk} />
        <HarmTile s={s} rt={rt} />
        <SightTile s={s} id={id} />
        <FrameworkTile s={s} id={id} />
      </div>
    </div>
  );
}

function RiskTile({ r }: { r?: LossRisk }) {
  const unk = !!r && isUnknown(r.lo, r.hi);
  const X = (v: number) => Math.min(100, (v / 0.5) * 100);
  const cert = r ? chanceCertainty(r.lo, r.hi) : undefined;
  const big = !r ? '—' : unk ? 'Unknown' : chance(r.p);
  const sub = !r ? 'no model runs yet' : unk ? `best guess ${chance(r.p)} · range ${chance(r.lo)}–${chance(r.hi)}` : r.hi < 0.001 ? 'range < 0.1%' : `range ${chance(r.lo)} – ${chance(r.hi)}`;
  return (
    <Tip as="div" className="card2 sfh-tile" content={() => <TipCard title={<Term id="lossRisk">Loss-of-control risk</Term>} value={big} rows={r ? [
      { label: 'Best guess', value: chance(r.p) }, { label: '90% range', value: r.hi < 0.001 ? '< 0.1%' : `${chance(r.lo)} – ${chance(r.hi)}` },
      { label: 'Certainty', value: cert!.unknown ? 'Unknown (range wider than 30 points)' : cert!.word },
      { label: <Term id="misalign">Would try (act against the lab)</Term>, value: `${F.pct(r.mis)} (${F.pct(Math.max(0, r.mis - 1.64 * r.misSd))}–${F.pct(Math.min(1, r.mis + 1.64 * r.misSd))})` },
      { label: <Term id="effOversight">Stop rate</Term>, value: F.pct(r.stopRate) },
      { label: <Term id="footholdCapacity">Footholds: known + unfound</Term>, value: `${F.num(r.knownF, 2)} + ${F.num(r.unfoundF, 2)}${r.reach > 0 ? ` · backdoor reach ${F.pct(r.reach)}` : ''}` },
      { label: 'What the world survives', value: 'published range around 0.40' },
    ] : []} footer="If it could act now. The game checks it when the model could act on it: your lab's ASI, or an escaped copy once the frontier is at Superhuman AI researcher. Your estimate only.">
      {r ? `Your believed chance that ${r.name} could act against you with nothing able to stop it. The range comes from how sure you are of what it would try.` : 'No model runs yet.'}
    </TipCard>}>
      <div className="sfh-tt"><ICON.risk size={14} /><Term id="lossRisk">Loss-of-control risk</Term></div>
      <div className={`sfh-big ${unk ? 'unk' : ''}`} data-test="sf-risk" data-risk={(r?.p ?? 0).toFixed(5)}>{big}</div>
      {r && <div className="sfh-strip">
        <span className="band" style={{ left: `${X(r.lo)}%`, width: `max(3px, ${X(r.hi) - X(r.lo)}%)` }} />
        <span className="gt" style={{ left: `${X(r.p)}%` }} />
        <span className="ax" style={{ left: '0%' }}>0%</span><span className="ax" style={{ left: '60%' }}>30%</span><span className="ax" style={{ left: '100%' }}>50%</span>
      </div>}
      <div className="sfh-sub">{sub}{r ? ' · if it could act now' : ''}</div>
    </Tip>
  );
}

function HarmTile({ s, rt }: { s: GameStateV2; rt?: ReturnType<typeof riskTableOf> }) {
  const h = rt ? unstoppedBySeverity(rt.table) : undefined;
  const wide = !!h && h.acts > 0 && h.hi > 3 * Math.max(h.lo, 1e-9);
  const max = Math.max(1e-9, ...(h?.bins.map((b) => b.acts) ?? [0]));
  const per = h && h.acts >= 0.0005 && h.acts < 1 ? `about 1 in ${F.count(Math.round(1 / h.acts))} years` : '';
  void s;
  return (
    <Tip as="div" className="card2 sfh-tile" content={() => <TipCard title={<Term id="unstoppedHarm">Unstopped harm</Term>} value={h ? `${rate(h.acts)} acts / yr` : '—'} rows={h ? [
      { label: '90% range', value: `${rate(h.lo)} – ${rate(h.hi)} / yr` },
      ...(per ? [{ label: 'Best guess', value: per }] : []),
      ...h.bins.map((b) => ({ label: <Term id="severity">{b.word}</Term>, value: `${rate(b.acts)} / yr` })),
      { label: 'Where', value: rt!.where === 'staff' ? 'AI staff work' : rt!.product ?? 'a product' },
    ] : []} footer="Per-year acts of the table below, each binned by its expected severity. Per-work-item acts and Acts against the lab are left out (that row feeds Loss-of-control risk).">The harmful acts your safeguards are expected not to stop in a year; it predicts incidents.</TipCard>}>
      <div className="sfh-tt"><ICON.incident size={14} /><Term id="unstoppedHarm">Unstopped harm</Term></div>
      <div className="sfh-big" data-test="sf-harm">{h ? rate(h.acts) : '—'}<span className="u">acts / yr{wide ? ` (${rate(h!.lo)}–${rate(h!.hi)})` : per ? ` · ${per}` : ''}</span></div>
      <div className="sfh-sev">
        {(h?.bins ?? []).filter((b) => b.acts >= 0.0005).map((b) => (
          <div key={b.word} className="r" data-sev={b.word}><span>{b.word}</span><i style={{ width: `${Math.max(2, (b.acts / max) * 100)}%` }} /><b className="num">{rate(b.acts)}</b></div>
        ))}
        {h && !h.bins.some((b) => b.acts >= 0.0005) && <div className="sfh-sub">none expected</div>}
      </div>
    </Tip>
  );
}

/** Mean believed reading at a level, read off the curve. */
const readAt = (pts: { level: number; mean: number }[], L: number) => {
  for (let i = 0; i < pts.length - 1; i++) if (L <= pts[i + 1].level) return pts[i].mean + ((pts[i + 1].mean - pts[i].mean) * (L - pts[i].level)) / Math.max(1e-9, pts[i + 1].level - pts[i].level);
  return pts[pts.length - 1]?.mean ?? 0;
};

function SightTile({ s, id }: { s: GameStateV2; id?: string }) {
  const sc = useMemo(() => sightCurve(s), [s, store.version]);
  const v = versionById(s, id);
  const L = v ? measuredLOf(s, v).L : sc.L;
  const run = s.player.models.runs.find((r) => r.status === 'running' || r.status === 'paused');
  const band = run ? runBand(s, run) : undefined;
  const nextL = band && band[1] > 0 ? (band[0] + band[1]) / 2 : undefined;
  const sv = safetyView(s);
  const jobs = sv.validation.jobs;
  const gaps = sightGaps(s, nextL);
  const lo = Math.max(0, Math.floor(Math.min(L, nextL ?? L) - 3.5));
  const hi = Math.min(15, Math.max(lo + 8, Math.ceil(Math.max(L, nextL ?? L) + 2)));
  const pts = sc.points.filter((p) => p.level >= lo - 1e-9 && p.level <= hi + 1e-9);
  const W = 500;
  const H = 112;
  const x = (l: number) => 30 + ((l - lo) / (hi - lo)) * (W - 40);
  const y = (p: number) => 8 + (1 - Math.min(0.6, p) / 0.6) * (H - 30);
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.level).toFixed(1)} ${y(p.mean).toFixed(1)}`).join(' ');
  const area = pts.length ? `${path} ${[...pts].reverse().map((p) => `L${x(p.level).toFixed(1)} ${y(p.min).toFixed(1)}`).join(' ')} Z` : '';
  const best = pts.reduce((a, p) => Math.max(a, p.mean), 0);
  const above = pts.filter((p) => p.mean >= 0.5);
  const edge = above.length ? above[above.length - 1].level : undefined;
  const mark = (l: number, label: string, color: string, key: string, row = 0) => {
    const right = x(l) > W - 130;
    return (
      <g key={key} data-mark={key}>
        <line x1={x(l)} y1={6} x2={x(l)} y2={H - 22} stroke={color} strokeWidth={1.5} strokeDasharray="3 3" />
        <circle cx={x(l)} cy={y(readAt(pts, l))} r={4.5} fill={color} />
        <text x={right ? x(l) - 6 : x(l) + 6} y={16 + row * 14} fill={color} textAnchor={right ? 'end' : 'start'} className="sfh-svg-t">{label}</text>
      </g>
    );
  };
  // Milestone names under the axis, skipping one that would overlap the last drawn.
  const ticks: { k: number; n: string; show: boolean }[] = [];
  let lastX = -Infinity;
  LEVEL_KNOTS.forEach((k, i) => { if (k <= lo || k >= hi) return; const show = x(k) - lastX > 120; if (show) lastX = x(k); ticks.push({ k, n: MILESTONE_NAMES[i], show }); });
  const name = v?.name ?? 'your model';
  return (
    <Tip as="div" className="card2 sfh-tile sfh-sight" content={() => <TipCard title={<Term id="sightLimit">Sight</Term>} value={edge !== undefined ? `50% up to level ${F.level(edge)}` : 'below 50% everywhere'} rows={[
      { label: `${name} (level ${F.level(L)})`, value: `~${F.pct(readAt(pts, L))} read` },
      ...(nextL !== undefined ? [{ label: `Next run (level ${F.level(nextL)})`, value: `~${F.pct(readAt(pts, nextL))} read` }] : []),
      { label: 'Against your internal model', value: gaps.current.text },
      ...(gaps.planned && nextL !== undefined ? [{ label: 'Against the next run', value: gaps.planned.text }] : []),
      { label: 'Validations under way', value: jobs.length ? `${jobs.length} on ${jobs[0].model}` : 'none' },
    ]} footer="The line is the average over the hidden-goal traits; the shaded floor is the trait read least. From what you believe of your instruments, not the truth.">How often your instruments together would read a hidden goal in a model of each capability level. Below the 50% line they miss more than they find.</TipCard>}>
      <div className="sfh-tt"><Eye size={14} /><Term id="sightLimit">Sight</Term><span className="sfh-q">how often your instruments read a hidden goal, by capability</span><span className="sp" /><Ref id="instruments" to={TAB('instruments')}>Instruments</Ref></div>
      <div className="sfh-sightrow">
        <svg width={W} height={H} className="sfh-svg" data-test="sight-curve">
          <line x1={30} y1={y(0.5)} x2={W - 10} y2={y(0.5)} stroke={C.good} strokeWidth={1.2} strokeDasharray="5 4" />
          <text x={0} y={y(0.5) + 4} fill={C.good} className="sfh-svg-n">50%</text>
          <text x={0} y={y(0) + 4} fill={C.text3} className="sfh-svg-n">0%</text>
          {area && <path d={area} fill="rgba(34,163,148,.15)" />}
          <path d={path} fill="none" stroke={C.und} strokeWidth={2.5} />
          {ticks.map((t) => <g key={t.k}><line x1={x(t.k)} y1={H - 22} x2={x(t.k)} y2={H - 17} stroke="#5d6f88" />{t.show && <text x={x(t.k)} y={H - 4} fill={C.text3} textAnchor="middle" className="sfh-svg-m">{t.n}</text>}</g>)}
          {mark(L, `${name} ~${F.pct(readAt(pts, L))}`, '#cfe3ff', 'model')}
          {nextL !== undefined && mark(nextL, `next run ~${F.pct(readAt(pts, nextL))}`, C.watch, 'next', Math.abs(x(nextL) - x(L)) < 130 ? 1 : 0)}
        </svg>
        <div className="sfh-side">
          {best < 0.5 ? <span>Below <b className="tone-pos">50%</b> at every level: they miss more than they find.</span>
            : edge !== undefined && <span>At <b className="tone-pos">50%</b> or better up to level <b className="w">{F.level(edge)}</b>; past it they miss more than they find.</span>}
          {jobs.length > 0 && <span className="t3"><Hourglass size={11} /> {jobs.length} instrument{jobs.length > 1 ? 's' : ''} being validated on {jobs[0].model}{Number.isFinite(jobs[0].daysLeft) ? ` · ${F.days(jobs[0].daysLeft)}` : ''}</span>}
        </div>
      </div>
    </Tip>
  );
}

function FrameworkTile({ s, id }: { s: GameStateV2; id?: string }) {
  const fw = safetyView(s).framework;
  const v = versionById(s, id);
  const hold = fw.holds[0];
  const holdRule = hold ? fw.rules.find((r) => r.id === hold.ruleId) : undefined;
  // The rule closest to holding this model: the capability rule with the smallest gap above its measured skill.
  const next = v ? fw.rules.filter((r) => r.trigger.kind === 'capability').map((r) => {
    const t = r.trigger as { domain: string; level: number };
    const at = measuredDomainOf(s, v, t.domain as never);
    return { r, at, gap: t.level - at };
  }).filter((x) => x.gap > 0).sort((a, b) => a.gap - b.gap)[0] : undefined;
  const nt = next?.r.trigger as { domain: string; level: number } | undefined;
  return (
    <div className="card2 sfh-tile sfh-fw" data-home="frameworkHold">
      <div className="sfh-tt"><ScrollText size={14} /><Term id="safetyFramework">Safety framework</Term></div>
      {hold ? (
        <Tip content={() => <TipCard title={holdRule?.label ?? hold.ruleId} value="Hold" rows={[{ label: 'Holds', value: hold.target === 'training' ? 'frontier training' : 'a product launch' }, { label: 'Needs', value: hold.missing.join(', ') || '—' }]}>A rule of your framework is met and its safeguards or evidence are missing. Meet them, or override it on Safeguards › Policies (with its stated cost).</TipCard>}>
          <div className="sfh-big sfh-hold" data-test="sf-hold"><ICON.wsl size={18} /> Hold</div>
        </Tip>
      ) : <div className="sfh-big sfh-nohold" data-test="sf-hold"><ICON.check size={18} /> No hold</div>}
      <div className="sfh-sub">{hold
        ? <><b className="w">{holdRule?.label ?? hold.ruleId}</b> holds {hold.target === 'training' ? 'training' : 'a launch'}{fw.holds.length > 1 ? ` (+${fw.holds.length - 1} more)` : ''}; needs {hold.missing.join(', ')}</>
        : next && nt ? <Tip content={() => <TipCard title={next.r.label} value={`at ${F.level(nt.level)}`} rows={[{ label: `${v?.name ?? 'Model'}: ${DOMAIN_WORD[nt.domain] ?? nt.domain} (measured)`, value: F.level(next.at) }, { label: 'Levels to go', value: F.level(nt.level - next.at) }]}>The capability rule of your framework closest to this model: when its measured skill reaches the level, the rule {next.r.holds === 'training' ? 'holds frontier training' : 'holds launches'} until its safeguards and evidence are in place.</TipCard>}><span>Next rule: <b className="w">{next.r.label}</b> holds {next.r.holds === 'training' ? 'training' : 'launches'} at {DOMAIN_WORD[nt.domain] ?? nt.domain} {F.level(nt.level)}; {v?.name} is at {F.level(next.at)}.</span></Tip>
          : 'Every capability rule is met or not measured yet.'}</div>
      <span className="sfh-link"><Ref id="safetyFramework" to={TAB('safeguards', 'policy')}>Framework</Ref></span>
    </div>
  );
}

// ───────── Risks tab ─────────

const GROUPS: { id: string; label: string; icon: typeof Drama }[] = [
  { id: 'misbehaviour', label: 'Misbehaviour', icon: Drama },
  { id: 'lab', label: 'Against the lab', icon: Ghost },
];

function Bar({ v, max, color, range }: { v: number; max: number; color: string; range?: [number, number] }) {
  const p = (x: number) => `${Math.max(0, Math.min(100, (x / max) * 100))}%`;
  return (
    <span className="sfr-bt">
      <i style={{ width: p(v), background: color }} />
      {range && <span className="rg" style={{ left: p(range[0]), width: `calc(${p(range[1])} - ${p(range[0])})` }} />}
    </span>
  );
}

const UnknownChip = () => <span className="sfr-unk" data-test="unknown">Unknown</span>;

function ActRowView({ r, maxU, maxC }: { r: ActReadout; maxU: number; maxC: number }) {
  const wt = <Tip content={() => <TipCard title={<Term id="disposition">Would try</Term>} value={r.unknown ? 'Unknown' : chance(r.wouldTry)} rows={[
    { label: '90% range', value: `${chance(r.wouldTryRange[0])} – ${chance(r.wouldTryRange[1])}` },
    { label: 'Certainty', value: r.unknown ? 'Unknown (range wider than 30 points)' : r.certainty.word },
  ]} footer="Your estimate from its trait beliefs, not the truth.">How strongly the model tends to this act.</TipCard>}>
    <span className="sfr-cell" data-col="try"><Bar v={r.wouldTry} max={0.5} color="#c4a5f5" range={r.wouldTryRange} />{r.unknown ? <UnknownChip /> : <span className="v">{chance(r.wouldTry)}</span>}</span>
  </Tip>;
  const stop = <Tip content={() => <TipCard title={<Term id="actOversight">Stop rate</Term>} value={F.pct(r.stopRate)}>Share of attempts at this act your safeguards block or catch.</TipCard>}>
    <span className="sfr-cell" data-col="stop"><span className="v l">{r.stopRate > 0 ? F.pct(r.stopRate) : '—'}</span></span>
  </Tip>;
  if (r.per === 'exposure') {
    return (
      <div className="sfr-tr hero" data-act={r.id}>
        <span className="an"><ICON.risk size={14} /><Term id="misalign">{r.name}</Term></span>
        {wt}
        <span className="t3 sm">any capability</span>
        <span className="t3 sm">—</span>
        {stop}
        <span className="sfr-feeds"><span className="t2">feeds</span><Ref id="lossRisk" to={TAB('risks')}>Loss-of-control risk</Ref></span>
      </div>
    );
  }
  const c = r.chancesPerYear ?? 0;
  const top = r.unstopped >= 0.005 && r.per === 'year';
  return (
    <div className={`sfr-tr ${top ? 'top' : ''}`} data-act={r.id}>
      <span className="an">{r.name}</span>
      {wt}
      <Tip content={() => <TipCard title={<Term id="actCapability">Able to</Term>} value={F.pct(r.ableTo)} footer={r.ableToMeasured ? 'From its measured skill.' : 'Not measured yet: read from a measured relative until its evals finish.'}>Whether the model can carry the act out, from its measured skill against what the act needs.</TipCard>}>
        <span className="sfr-cell" data-col="able"><Bar v={r.ableTo} max={1} color="#8da2bd" /><span className={`v ${r.ableTo < 0.05 || !r.ableToMeasured ? 't3' : ''}`}>{r.ableTo < 0.01 ? '~0' : F.pct(r.ableTo)}{r.ableToMeasured ? '' : '?'}</span></span>
      </Tip>
      <Tip content={() => <TipCard title={<Term id="opportunity">Chances</Term>} value={`${c ? rate(c) : '0'} ${r.chancesUnit}`}>{r.per === 'item' ? 'Chances per work item it touches.' : 'Opportunities per year at this site: use and copies, task autonomy and access.'} Would try × Able to × Chances = attempts.</TipCard>}>
        <span className="sfr-cell" data-col="chances"><Bar v={c} max={maxC} color="#6f8fb5" /><span className={`v ${c ? '' : 't3'}`}>{c ? rate(c) : '0'}{r.per === 'item' && <span className="t3 per"> /item</span>}</span></span>
      </Tip>
      {stop}
      <Tip content={() => <TipCard title={<Term id="unstoppedHarm">Unstopped</Term>} value={`${rate(r.unstopped)} ${r.per === 'item' ? 'per item' : '/ yr'}`} rows={[
        { label: '90% range', value: `${rate(r.unstoppedRange[0])} – ${rate(r.unstoppedRange[1])}` },
        ...(r.severity ? [{ label: <Term id="severity">Expected severity</Term>, value: r.severity }] : []),
      ]}>Would try × Able to × Chances × (1 − Stop rate).</TipCard>}>
        <span className="sfr-cell" data-col="unstopped">{r.unstopped >= 0.0005 ? <><Bar v={r.unstopped} max={maxU} color={C.watch} range={r.per === 'year' ? r.unstoppedRange : undefined} /><span className="v">{rate(r.unstopped)}</span></> : <><span className="sfr-bt none" /><span className="v t3">~0</span></>}</span>
      </Tip>
    </div>
  );
}

export function RisksTab({ s }: { s: GameStateV2 }) {
  const { pick, id } = useSafetyPick(s);
  const rt = useMemo(() => riskTableOf(s, id), [s, store.version, id]);
  const rows = rt ? actReadouts(rt.table) : [];
  const fv = footholdView(s);
  const known = fv.suspected + fv.located;
  if (!rt) return <div className="card2 sfr"><div className="sfr-empty dim">{pick ? `${pick.name} runs nowhere yet: no AI staff work and no product.` : 'No model runs yet: Risks fill in once a model does AI staff work or serves a product.'}</div></div>;
  const yearRows = rows.filter((r) => r.per === 'year');
  const maxU = Math.max(0.001, ...yearRows.map((r) => r.unstoppedRange[1] > r.unstopped * 3 ? r.unstopped * 3 : r.unstoppedRange[1]), ...rows.map((r) => r.unstopped));
  const maxC = Math.max(1e-9, ...rows.map((r) => r.chancesPerYear ?? 0));
  // The composite row first, then per-item acts, then per-year acts by Unstopped (mockup order).
  const rank = (r: ActReadout) => (r.per === 'exposure' ? 0 : r.per === 'item' ? 1 : 2);
  const sort = (a: ActReadout, b: ActReadout) => rank(a) - rank(b) || b.unstopped - a.unstopped;
  const misuse = rows.filter((r) => r.group === 'misuse');
  const vName = pick?.name ?? versionById(s, id)?.name ?? '';
  const guards = rt.table.guards;
  return (
    <div className="card2 sfr" data-home="actTable">
      <div className="sfr-th">
        <span>Harmful act <span className="lc">· {vName} {rt.where === 'staff' ? 'doing AI staff work' : `in ${rt.product}`}</span></span>
        <span><Term id="disposition">Would try</Term> <span className="op">×</span></span>
        <span><Term id="actCapability">Able to</Term> <span className="op">×</span></span>
        <span><Term id="opportunity">Chances</Term> / yr <span className="op">×</span></span>
        <span><Term id="actOversight">Stop rate</Term> <span className="op">→</span></span>
        <span><Term id="unstoppedHarm">Unstopped</Term> / yr <ArrowDown size={12} /></span>
      </div>
      {GROUPS.map((g) => {
        const gr = rows.filter((r) => r.group === g.id).sort(sort);
        if (!gr.length) return null;
        return (
          <div key={g.id} data-group={g.id}>
            <div className="sfr-grp"><g.icon size={14} /> {g.label}</div>
            {gr.map((r) => <ActRowView key={r.id} r={r} maxU={maxU} maxC={maxC} />)}
          </div>
        );
      })}
      <div data-group="misuse">
        {rt.where === 'staff' || !misuse.length
          ? <div className="sfr-grp"><ICON.misuse size={14} /> Misuse by people <span className="lc">· no outside users on AI staff work. Helps with bio / cyber: see the product deployments</span><Ref id="products" to={{ panel: 'products' }}>Products</Ref></div>
          : <><div className="sfr-grp"><ICON.misuse size={14} /> Misuse by people</div>{misuse.sort(sort).map((r) => <ActRowView key={r.id} r={r} maxU={maxU} maxC={maxC} />)}</>}
      </div>
      {known > 0 && <div className="sfr-fh" data-test="sfr-footholds"><ICON.foothold size={14} /><span><Term id="foothold">Footholds</Term>: {fv.suspected} suspected · {fv.located} located</span><span className="sp" /><Ref id="foothold" to={TAB('safeguards', 'footholds')}>Footholds</Ref></div>}
      <div className="sfr-foot" data-test="sfr-guards">
        <Shield size={14} />
        <span>Safeguards here: {guards.length ? guards.map((gl, i): ReactNode => (
          <Tip key={gl.kind} content={() => <TipCard title={gl.label} rows={[{ label: <Term id="actOversight">Stop on every act</Term>, value: F.pct(gl.stop) }, { label: <Term id="controlTax">Slowdown</Term>, value: F.pct(gl.slowdown) }, ...(gl.people ? [{ label: 'Safety research engineers', value: F.count(gl.people) }] : [])]}>A safeguard on this deployment; change it on Safeguards.</TipCard>}>
            <span>{i > 0 && ' · '}<b className="w">{gl.label.split(':')[0]}</b>{gl.kind === 'review' ? ` (${F.count(gl.people)} people)` : gl.label.includes(':') ? `: ${gl.label.split(':').slice(1).join(':').trim()}` : ''}{gl.slowdown > 0 ? `, slowdown ${F.pct(gl.slowdown)}` : ''}</span>
          </Tip>
        )) : <span className="t3">none</span>}</span>
        <span className="sp" />
        <Ref id="safeguardsTab" to={TAB('safeguards')}>Safeguards</Ref>
      </div>
    </div>
  );
}
