// End screen (§5.4). The ONLY UI allowed to read hidden truth (lint-hidden exempts end/). Everything shown comes from
// one selector, endingView (engine/v2/endings/view.ts); this file only lays it out (approved mockup:
// design/ux/mockups/end). First viewport: header + actions, hero (who holds the future, the epilogue, the
// superintelligence steps), the world at the end (four tiles), scores. Below the fold: the race, then what you
// couldn't see.
import { useEffect, type ReactNode } from 'react';
import { MILESTONE_NAMES, dateOf, endingView, fmtDate, selectHidden } from '../../../engine/v2';
import type { EndingView, EndStep, GameStateV2, HiddenLab, RaceLab, ScoreView } from '../../../engine/v2';
import { CONTROL_DOMAIN_ICON, ICON, POWER_ICON, STEP_ICON } from '../icons';
import { store } from '../store';
import { C, labColor, monogram } from '../theme';
import * as F from '../fmt';
import { Rich, Term, termEntry, Tip, TipCard } from '../ui';
import './end.css';

type View = EndingView;
const LOSS_IDS = new Set(['war', 'catastropheBio', 'catastropheCyber', 'rogue']);
const POWERS: [string, string][] = [
  ['democratic', 'Democratic'], ['treaty', 'Treaty'], ['multipolar', 'Multipolar'], ['committee', 'Committee'],
  ['government', 'Government'], ['corporate', 'Corporate'], ['beijing', 'Beijing'], ['ai', 'The AI'],
];
const POWER_TERM: Record<string, string> = {
  democratic: 'pwDemocratic', treaty: 'pwTreaty', multipolar: 'pwMultipolar', committee: 'pwCommittee', government: 'pwGovernment',
  corporate: 'pwCorporate', beijing: 'pwBeijing', ai: 'pwAI', contested: 'pwContested',
};
const SCORE_META: Record<ScoreView['key'], { name: string; icon: keyof typeof ICON; term: string }> = {
  survival: { name: 'Survival', icon: 'scoreSurvival', term: 'scoreSurvival' },
  freedom: { name: 'Freedom', icon: 'scoreFreedom', term: 'scoreFreedom' },
  prosperity: { name: 'Prosperity', icon: 'scoreProsperity', term: 'scoreProsperity' },
  company: { name: 'Company', icon: 'scoreCompany', term: 'scoreCompany' },
  geopolitics: { name: 'Geopolitics', icon: 'scoreGeopolitics', term: 'scoreGeopolitics' },
};
/** Milestone levels on the display scale (glossary L): Agent 5 … Superintelligence 15. */
const LEVEL = [5, 6.5, 8.5, 10, 12, 13.5, 15];
const MS_SHORT = ['Agent', 'Reliable agent', 'Research agent', 'SC', 'SAR', 'SIAR', 'ASI'];
/** Axis tick: 25M, 2.5M, 500K, 0. */
const tick = (n: number) => (n >= 1e6 ? `${+(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${+(n / 1e3).toFixed(1)}K` : `${n}`);
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const RSQ = '’';

/** Lab hue lifted toward white for text on dark panels. */
function ink(hex: string, t = 0.3): string {
  const n = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgb(${n.map((q) => Math.round(q + (255 - q) * t)).join(',')})`;
}
const pctI = (x: number) => `${Math.round(x * 100)}%`;
/** Signed with d decimals; a change that rounds to zero reads "0" (never "+0.0" or "−0"). */
const signed = (x: number, d = 0) => (Math.abs(x) < 0.5 * Math.pow(10, -d) ? (0).toFixed(d) : F.num(x, d, true));
/** A score term: whole points, one decimal under ±0.5 (never "−0"). */
const termPts = (x: number) => (Math.abs(x) < 0.05 ? '0' : Math.abs(x) < 0.5 ? F.num(x, 1, true) : signed(Math.round(x)));
const multTxt = (m: number) => `×${m >= 10 ? m.toFixed(0) : m.toFixed(1)}`;
const scroll = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
const termCard = (id: string, value?: ReactNode, extra?: ReactNode) => () => {
  const g = termEntry(id);
  return <TipCard title={g?.title ?? id} value={value}>{g && <Rich text={g.body} />}{extra}</TipCard>;
};
/** Day 0 of the game from the end date and day (the view carries both). */
const startOf = (v: View) => new Date(Date.parse(`${v.date} UTC`) - v.day * 864e5);

export function EndScreen({ s }: { s: GameStateV2 }) {
  const v = endingView(s)!;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'w' || e.ctrlKey || e.metaKey || e.altKey) return;
      if ((e.target as HTMLElement | null)?.closest?.('input, textarea, select')) return;
      store.setEndView('world');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const lost = v.future.holder === 'ai' || LOSS_IDS.has(v.id);
  const names = new Map(v.race.labs.map((l) => [l.id as string, l.name]));
  const summary = () => {
    const h = selectHidden(s);
    return JSON.stringify({
      setup: s.setup, ending: s.ending, day: s.time.day, world: { preset: s.setup.world, label: h.timeline.label, latents: h.latents, difficulty: h.difficultyMult },
      milestones: Object.fromEntries(Object.entries(s.player.milestoneDays).map(([i, d]) => [MILESTONE_NAMES[Number(i)], fmtDate(dateOf(s, d!))])),
      final: { cash: s.player.finance.cash, valuation: s.player.finance.valuation, compute: s.player.computeOnline },
    }, null, 2);
  };
  return (
    <div className={`es ${lost ? 'es-lost' : ''}`} data-test="endscreen">
      <div className="es-page">
        <header className="es-hdr">
          <div className="es-hdr-l">
            <div className="es-date num">{v.date}</div>
            <h1 data-test="ending-title">{v.title}</h1>
            <div className="es-lede">{v.text}</div>
          </div>
          <div className="es-acts">
            <div className="es-acts-row">
              <Tip content={() => <TipCard title="View the world">The game as it stood at the end, read-only with time frozen. The banner brings you back here.</TipCard>}>
                <button className="es-btn es-btn-primary" data-test="view-world" onClick={() => store.setEndView('world')}>
                  <ICON.world size={16} />View the world <span className="kbd">W</span>
                </button>
              </Tip>
              <button className="es-btn" data-test="end-new" onClick={() => store.go('setup')}><ICON.newGame size={16} />New game</button>
              <button className="es-btn" data-test="end-menu" onClick={() => store.go('start')}><ICON.menu size={16} />Menu</button>
            </div>
            <Tip content={() => <TipCard title="Export run summary">Downloads this run as a file: setup, ending, the world you played in, your milestones and your final numbers.</TipCard>}>
              <button className="es-quiet" data-test="export-summary" onClick={() => store.download(`ai27-run-${s.setup.seed}.json`, summary())}>
                <ICON.download size={14} /><u>Export run summary</u>
              </button>
            </Tip>
          </div>
        </header>
        <Hero v={v} lost={lost} names={names} />
        <Tiles v={v} />
        <Scores v={v} />
        <button className="es-scroll-hint" onClick={() => scroll('es-race')}><ICON.scrollDown size={14} />The race · What you couldn{RSQ}t see</button>
        <div className="es-fold">
          <Race v={v} />
          <Hidden v={v} />
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────── hero ─────────────────────────────

/** The epilogue with lab names in their colours. */
function Epilogue({ text, names }: { text: string; names: Map<string, string> }) {
  const list = [...names.entries()].filter(([, n]) => n.length > 1).sort((a, b) => b[1].length - a[1].length);
  if (!list.length) return <>{text}</>;
  const re = new RegExp(`(${list.map(([, n]) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g');
  return <>{text.split(re).map((part, i) => {
    const hit = list.find(([, n]) => n === part);
    return hit ? <b key={i} style={{ color: ink(labColor(hit[0])) }}>{part}</b> : part;
  })}</>;
}

function Hero({ v, lost, names }: { v: View; lost: boolean; names: Map<string, string> }) {
  const f = v.future;
  const Icon = POWER_ICON[f.holder] ?? POWER_ICON.none;
  const onKey = f.holder === 'contested' ? 'ai' : f.holder;
  const term = POWER_TERM[f.holder];
  const asiSteps = v.steps.some((x) => x.icon === 'sparkles');
  return (
    <div className="es-card es-hero">
      <div className="es-pw">
        <div className="es-cap">Who holds the future{f.projected && (
          <Tip content={termCard('projectedEnd')}><span className="es-pw-tag">Projected</span></Tip>
        )}</div>
        <Tip content={term ? termCard(term) : () => <TipCard title={f.label}>{f.sub}.</TipCard>}>
          <div className={`es-pw-ic ${lost ? 'lost' : f.holder === 'contested' ? 'warn' : f.holder === 'none' ? 'neu' : ''} ${f.projected ? 'proj' : ''}`}><Icon size={42} strokeWidth={1.6} /></div>
        </Tip>
        <div className="es-pw-name">{term ? <Term id={term}>{f.label}</Term> : f.label}</div>
        <div className="es-pw-sub">{f.sub}</div>
        <div className="es-spec">
          {POWERS.map(([k]) => {
            const I = POWER_ICON[k];
            return (
              <Tip key={k} content={termCard(POWER_TERM[k], k === onKey ? 'this ending' : undefined)}>
                <span className={k === onKey ? `on ${k === 'ai' ? 'lost' : ''}` : ''} data-power={k}><I size={15} /></span>
              </Tip>
            );
          })}
        </div>
        <div className="es-spec-l"><Term id="powerOutcome">Democratic</Term><span>The AI</span></div>
      </div>
      <div className="es-epi">
        <div className="es-cap">{f.projected ? 'What happened next' : 'The world after'}</div>
        <p><Epilogue text={v.epilogue} names={names} /></p>
        <button className="es-more" onClick={() => scroll('es-hidden')}>
          <ICON.jumpDown size={13} />{v.hidden.why ? 'Why it ended this way:' : 'Hidden during play:'} <u>What you couldn{RSQ}t see</u>
        </button>
      </div>
      <div className="es-tl">
        <div className="es-cap">{asiSteps ? 'Superintelligence' : 'How it ended'}</div>
        <div className="es-tl-steps">{v.steps.map((x, i) => <Step key={i} x={x} />)}</div>
      </div>
    </div>
  );
}

function Step({ x }: { x: EndStep }) {
  const I = STEP_ICON[x.icon] ?? STEP_ICON.minus;
  const cls = x.tone === 'pos' ? 'good' : x.tone === 'neg' ? 'bad' : x.tone === 'warn' ? 'warn' : '';
  const col = x.lab && !cls ? labColor(x.lab) : undefined;
  return (
    <div className={`es-tl-step ${x.projected ? 'proj' : ''}`}>
      <div className={`es-tl-dot ${cls} ${x.projected ? 'dashed' : ''}`} style={col ? { borderColor: col, color: ink(col) } : undefined}><I size={14} /></div>
      <div>
        {x.approx
          ? <Tip content={() => <TipCard title={x.when}>{x.projected ? 'Projected from the race at your exit.' : 'Approximate: what followed the ending.'}</TipCard>}><div className="es-tl-when num">{x.when}</div></Tip>
          : <div className="es-tl-when num">{x.when}</div>}
        <div className="es-tl-what">{x.title}{x.sub && <small>{x.sub}</small>}</div>
      </div>
    </div>
  );
}

// ───────────────────────────── world tiles ─────────────────────────────

function Spark({ vals, color, w = 300, h = 42 }: { vals: number[]; color: string; w?: number; h?: number }) {
  if (vals.length < 2) return <svg className="es-spark" width={w} height={h} />;
  const mn = Math.min(...vals);
  const mx = Math.max(...vals);
  const x = (i: number) => (i / (vals.length - 1)) * (w - 6) + 2;
  const y = (q: number) => h - 3 - ((q - mn) / (mx - mn || 1)) * (h - 6);
  const d = vals.map((q, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(q).toFixed(1)}`).join('');
  return (
    <svg className="es-spark" width={w} height={h}>
      <path d={`${d}L${x(vals.length - 1)},${h}L${x(0)},${h}Z`} fill={color} opacity={0.12} />
      <path d={d} fill="none" stroke={color} strokeWidth={1.6} />
      <circle cx={x(vals.length - 1)} cy={y(vals[vals.length - 1])} r={2.5} fill={color} />
    </svg>
  );
}

function KV({ k, children, tip }: { k: ReactNode; children: ReactNode; tip: () => ReactNode }) {
  return <div className="es-kv"><span className="k">{k}</span><Tip content={tip}><span className="es-kv-v">{children}</span></Tip></div>;
}
const delta = (d: number, text: string, badUp: boolean) => {
  const flat = text.replace(/[^1-9]/g, '') === '';
  return <span className={`d num ${flat ? 'flat' : (d > 0) === badUp ? 'up-bad' : 'up-good'}`}>{text}</span>;
};
const OWN = ['#3a8ae0', '#6fa7e6', '#6b7c91', '#b08e1a', '#8a6fb0', '#22a394'];

function Tiles({ v }: { v: View }) {
  const w = v.world;
  const order = v.race.labs.map((l) => l.id as string);
  const rank = (id: string) => { const i = order.indexOf(id === 'player:open' ? 'player' : id); return i < 0 ? 99 : i + (id === 'player:open' ? 0.5 : 0); };
  const present = [...new Set(w.power.flatMap((d) => d.labs.map((l) => l.lab)))].sort((a, b) => rank(a) - rank(b));
  const labName = (id: string) => w.power.flatMap((d) => d.labs).find((l) => l.lab === id)?.name ?? id;
  const e = w.economy;
  const g = w.geopolitics;
  const co = w.company;
  const statusTone = co.status === 'independent' ? 'good' : co.status === 'retired' || co.status === 'under committee' ? 'neu' : 'bad';
  const tensionTone = g.tension === 0 ? 'good' : g.tension <= 2 ? 'warn' : 'bad';
  const taiwanTone = g.taiwan === 'calm' ? 'good' : g.taiwan === 'recovered' ? 'neu' : g.taiwan === 'disrupted' ? 'warn' : 'bad';
  const own = [...co.ownership].sort((a, b) => Number(b.you) - Number(a.you));
  const lagLine = g.chinaLagDays === 0 ? `China${RSQ}s lab was level with the best US lab.` : g.chinaLagDays > 0 ? `China${RSQ}s lab was ${F.days(g.chinaLagDays)} behind the best US lab.` : `China${RSQ}s lab was ${F.days(-g.chinaLagDays)} ahead of the best US lab.`;
  return (
    <>
      <div className="es-sec-hd"><h2>The world at the end</h2><span className="sub">{v.date}{v.future.holder === 'ai' && !v.future.projected ? ' · the last day people ran it' : ''}</span></div>
      <div className="es-tiles">
        <div className="es-card es-tile">
          <div className="es-card-hd"><ICON.congress size={16} /><span className="ttl">Power</span><span className="sub">whose AI does the work</span></div>
          {w.power.map((d) => {
            const DI = CONTROL_DOMAIN_ICON[d.id];
            const labs = [...d.labs].sort((a, b) => rank(a.lab) - rank(b.lab));
            return (
              <div className="es-dom" key={d.id}>
                <span className="es-dom-l"><DI size={14} />{d.name}</span>
                <Tip content={termCard('aiDomainShare', F.pct(d.aiShare), <div className="tipcard-foot">{d.name}: {F.pct(d.aiShare)} of its work done by AI at the end.</div>)}><span className="es-dom-p num">AI {F.pct(d.aiShare)}</span></Tip>
                <div className="es-stack">
                  {labs.length ? labs.map((l) => (
                    <Tip key={l.lab} style={{ flex: l.share, background: labColor(l.lab) }} className="es-seg" content={() => <TipCard title={l.name} value={F.pct(l.share)}>{F.pct(l.share)} of the AI-run work in {d.name.toLowerCase()} runs on {l.name}{RSQ}s models: {F.pct(l.share * d.aiShare, 1)} of all of it.</TipCard>}>
                      {l.share >= 0.1 ? monogram(l.name) : ''}
                    </Tip>
                  )) : <span className="es-stack-none">No AI at work</span>}
                </div>
              </div>
            );
          })}
          <div className="es-leg">
            {present.map((id) => <span key={id}><b style={{ background: labColor(id) }} />{labName(id)}{id === 'player' ? ' (you)' : ''}</span>)}
          </div>
        </div>

        <div className="es-card es-tile">
          <div className="es-card-hd"><ICON.economy size={16} /><span className="ttl">Economy</span><span className="sub">US</span></div>
          <div className="es-big">
            <Tip content={termCard('gdpChange', F.pct(e.gdpChange, 1, true), <div className="tipcard-foot">Real GDP since {e.gdpSince}.</div>)}><span className="v num">{F.pct(e.gdpChange, 1, true)}</span></Tip>
            <span className="u"><Term id="gdpChange">GDP</Term> since {e.gdpSince}</span>
          </div>
          <Tip content={() => <TipCard title="GDP" value={F.pct(e.gdpChange, 1, true)}>US real GDP from {e.gdpSince} to the end.</TipCard>}><Spark vals={e.gdpIndex} color={C.good} /></Tip>
          <KV k={<><ICON.public size={14} /><Term id="unemployment">Unemployment</Term></>} tip={termCard('unemployment', `${F.num(e.unemployment, 1)}%`, <div className="tipcard-foot">{signed(e.unemploymentChange, 1)} points since the start.</div>)}>
            <span className="v num">{F.num(e.unemployment, 1)}%</span>{delta(e.unemploymentChange, `${signed(e.unemploymentChange, 1)} pt`, true)}
          </KV>
          <KV k={<><ICON.inequality size={14} /><Term id="aiIncomeShare">AI share of income</Term></>} tip={termCard('aiIncomeShare', F.pct(e.aiIncomeShare, 1), <div className="tipcard-foot">AI companies' revenue as a share of US GDP.</div>)}>
            <span className="v num">{F.pct(e.aiIncomeShare, 1)}</span>
          </KV>
        </div>

        <div className="es-card es-tile">
          <div className="es-card-hd"><ICON.china size={16} /><span className="ttl">Geopolitics</span><span className="sub">US–China</span></div>
          <div className="es-t3">China&apos;s lab</div>
          <div className="es-rungname">{lagLine}</div>
          <div className="es-gap" />
          <KV k={<><ICON.china size={14} /><Term id="chinaTension">Tension</Term></>} tip={termCard('chinaTension', g.tensionName)}><span className={`es-tag ${tensionTone}`}>{g.tensionName}</span></KV>
          <KV k={<><ICON.commitment size={14} /><Term id="treaty">Treaty</Term></>} tip={termCard('treaty', g.treatyLabel)}><span className={`es-tag ${g.treaty === 'verified' ? 'good' : 'neu'}`}>{g.treatyLabel}</span></KV>
          <KV k={<><ICON.taiwan size={14} /><Term id="taiwanStatus">Taiwan</Term></>} tip={termCard('taiwanStatus', g.taiwanLabel)}><span className={`es-tag ${taiwanTone}`}>{g.taiwanLabel}</span></KV>
        </div>

        <div className="es-card es-tile">
          <div className="es-card-hd"><ICON.you size={16} /><span className="ttl">{co.name}</span><span className="sub">your company</span>
            <Tip className="es-ml" content={termCard('companyStatus', co.status)}><span className={`es-tag ${statusTone}`}>{co.status[0].toUpperCase() + co.status.slice(1)}</span></Tip>
          </div>
          <div className="es-big">
            <Tip content={termCard('valuation', F.money(co.valuation), <div className="tipcard-foot">{multTxt(co.multiple)} its first recorded valuation.</div>)}><span className="v num">{F.money(co.valuation)}</span></Tip>
            <span className="u"><Term id="valuation">valuation</Term> · <span className={`num ${co.multiple >= 1 ? 'up-good' : 'up-bad'}`}>{multTxt(co.multiple)}</span></span>
          </div>
          <Tip content={() => <TipCard title="Valuation" value={F.money(co.valuation)}>Your company{RSQ}s valuation over the game.</TipCard>}><Spark vals={co.valuationHistory} color={C.you} h={38} /></Tip>
          <KV k={<><ICON.ownership size={14} /><Term id="ownership">Ownership</Term></>} tip={() => <TipCard title="Ownership" rows={own.map((o) => ({ label: o.name, value: F.pct(o.share) }))} />}>
            <span className="es-t3">you {F.pct(co.playerShare)} · largest outside {F.pct(co.largestOutside.share)}</span>
          </KV>
          <div className="es-own">
            {own.map((o, i) => <Tip key={o.name} className="es-seg" style={{ flex: o.share, background: o.you ? OWN[0] : OWN[1 + ((i - 1) % (OWN.length - 1))] }} content={() => <TipCard title={o.name} value={F.pct(o.share)}>{o.you ? `Your founders${RSQ} stake.` : 'An outside holder.'}</TipCard>}>{''}</Tip>)}
          </div>
        </div>
      </div>
    </>
  );
}

// ───────────────────────────── scores ─────────────────────────────

function Scores({ v }: { v: View }) {
  return (
    <div className="es-scores">
      <span className="es-cap">Scores <span className="es-t3 plain">/100</span></span>
      {v.scores.map((x) => {
        const m = SCORE_META[x.key];
        const I = ICON[m.icon];
        const max = Math.max(1, ...x.terms.map((t) => Math.abs(t.value)));
        return (
          <Tip key={x.key} className="es-sc" content={() => (
            <div className="es-sctip" data-test={`score-tip-${x.key}`}>
              <div className="tipcard-head"><span className="tipcard-title">{m.name}</span><span className="tipcard-value">{x.value}</span></div>
              <div className="tipcard-body">{termEntry(m.term)?.body}</div>
              {x.terms.map((t, i) => (
                <div className="es-sctip-row" key={i}>
                  <span>{t.label}</span>
                  <span className="bx"><i style={{ width: `${(Math.abs(t.value) / max) * 100}%`, background: t.value >= 0 ? C.good : C.bad }} /></span>
                  <span className="val num">{termPts(t.value)}</span>
                </div>
              ))}
              <div className="es-sctip-sum num"><span>Total</span><span>{x.value}</span></div>
              {Math.round(x.raw) !== x.value && <div className="tipcard-foot">The terms add to {termPts(x.raw)}; a score stays within 0–100.</div>}
            </div>
          )}>
            <I size={15} /><span>{m.name}</span><span className="n num">{x.value}</span>
            <span className="bar"><i style={{ width: `${x.value}%` }} /></span>
          </Tip>
        );
      })}
    </div>
  );
}

// ───────────────────────────── the race ─────────────────────────────

function Race({ v }: { v: View }) {
  return (
    <>
      <div className="es-sec-hd" id="es-race"><h2>The race</h2><span className="sub">capability of every lab, one scale · ◆ = <Term id="ai2027">AI 2027 scenario</Term> dates · ○ = your milestones</span></div>
      <div className="es-race">
        <div className="es-card"><RaceChart v={v} /></div>
        <div className="es-card"><ComputeChart v={v} /></div>
      </div>
    </>
  );
}

function RaceChart({ v }: { v: View }) {
  const r = v.race;
  const W = 1150, H = 330, l = 158, rp = 64, t = 22, b = 58;
  const endDay = r.endDay;
  const xMax = Math.max(endDay + 30, (r.projected?.day ?? 0) + 40);
  const x = (d: number) => l + (d / xMax) * (W - l - rp);
  const y = (L: number) => t + (1 - (Math.min(15.6, Math.max(3.5, L)) - 3.5) / (15.6 - 3.5)) * (H - t - b);
  const start = startOf(v);
  const fmtD = (d: number) => { const dt = new Date(start.getTime() + d * 864e5); return `${MON[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`; };
  const ticks: { d: number; label: string }[] = [];
  for (let yr = start.getUTCFullYear(); yr <= start.getUTCFullYear() + 12; yr++) for (const m of [0, 6]) { const d = Math.round((Date.UTC(yr, m, 1) - start.getTime()) / 864e5); if (d >= 0 && d <= xMax) ticks.push({ d, label: `${MON[m]} ${yr}` }); }
  const step = Math.ceil(ticks.length / 9);
  const asiLab = v.future.lab && v.future.asiDay !== undefined && !v.future.projected ? v.future.lab : undefined;
  const labs = [...r.labs].sort((a, b) => (a.kind === 'player' ? 1 : b.kind === 'player' ? -1 : 0));
  const ends: { id: string; name: string; X: number; Y: number; c: string }[] = [];
  const paths = labs.map((lab: RaceLab) => {
    let pts = lab.days.map((d, i) => [d, lab.level[i]] as [number, number]).filter(([d, L]) => Number.isFinite(d) && Number.isFinite(L));
    const dead = lab.status !== 'active';
    if (dead && pts.length) {
      let lc = 0;
      pts.forEach((p, i) => { if (i && p[1] !== pts[i - 1][1]) lc = i; });
      const cut = lab.exitDay ?? pts[Math.min(pts.length - 1, lc + 1)][0];
      pts = pts.filter(([d]) => d <= cut);
    }
    if (asiLab === lab.id && v.future.asiDay !== undefined) pts.push([v.future.asiDay, 15]);
    if (!pts.length) return null;
    const c = labColor(lab.id);
    const d = pts.map(([dd, L], i) => (i ? `H${x(dd).toFixed(1)}V${y(L).toFixed(1)}` : `M${x(dd).toFixed(1)},${y(L).toFixed(1)}`)).join('');
    const [ld, lL] = pts[pts.length - 1];
    if (!dead) ends.push({ id: lab.id, name: lab.name, X: x(ld), Y: y(lL), c });
    return (
      <Tip as="g" key={lab.id} content={() => <TipCard title={lab.name} value={F.level(pts[pts.length - 1][1])}>{lab.kind === 'player' ? 'Your lab. ' : ''}Capability of its best model on the shared scale (10 = superhuman coder, 15 = superintelligence).{dead ? ` Left the race: ${lab.status}.` : ''}</TipCard>}>
        <path d={d} fill="none" stroke={c} strokeWidth={lab.kind === 'player' ? 3 : 1.8} opacity={dead ? 0.45 : 1} strokeLinejoin="round" />
        <path d={d} fill="none" stroke="transparent" strokeWidth={10} />
        {dead && <>
          <text x={x(ld)} y={y(lL) + 4} fill={c} fontSize={13} textAnchor="middle" fontWeight={700}>×</text>
          <text x={x(ld)} y={y(lL) + 17} className="es-svg-t3" textAnchor="middle">{monogram(lab.name)} {lab.status}</text>
        </>}
      </Tip>
    );
  });
  ends.sort((a, b) => a.Y - b.Y);
  let last = -99;
  const endLabels = ends.map((e) => { const yy = Math.max(e.Y, last + 12); last = yy; return <text key={e.id} x={e.X + 8} y={yy + 4} fill={ink(e.c, 0.15)} className="es-svg-mono b">{monogram(e.name)}</text>; });
  const player = r.labs.find((q) => q.kind === 'player');
  const XE = x(endDay);
  const proj = r.projected;
  const projLab = proj ? r.labs.find((q) => q.id === proj.lab) : undefined;
  const canon = r.canon.filter((c) => c.day >= 0 && c.day <= xMax);
  let lastX = -999, row = 0;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="es-race-svg">
      {LEVEL.map((k, i) => (
        <g key={i}>
          <line x1={l} x2={W - rp} y1={y(k)} y2={y(k)} stroke={C.line} strokeDasharray={i === 6 ? undefined : '2 4'} />
          <text x={l - 8} y={y(k) + 4} className={i === 6 ? 'es-svg-t1' : 'es-svg-t3'} textAnchor="end">{MILESTONE_NAMES[i]}</text>
        </g>
      ))}
      {ticks.filter((_, i) => i % step === 0).map((tk) => (
        <g key={tk.d}>
          <line x1={x(tk.d)} x2={x(tk.d)} y1={t} y2={H - b} stroke="#1b2430" />
          <text x={x(tk.d)} y={H - b + 15} className="es-svg-mono" textAnchor="middle">{tk.label}</text>
        </g>
      ))}
      <text x={l - 8} y={H - 16} className="es-svg-t2" textAnchor="end">AI 2027 scenario</text>
      {canon.map((c) => {
        const X = x(c.day);
        row = X - lastX < 46 ? 1 - row : 0;
        lastX = X;
        return (
          <Tip as="g" key={c.idx} content={() => <TipCard title={c.name} value={c.when}>The <Term id="ai2027">AI 2027 scenario</Term>{RSQ}s date for this milestone.</TipCard>}>
            <path d={`M${X},${H - 36} l5,5 l-5,5 l-5,-5Z`} fill={C.text3} />
            <text x={X} y={H - 14 + row * 11} className="es-svg-t2 sm" textAnchor="middle">{MS_SHORT[c.idx]}</text>
          </Tip>
        );
      })}
      {paths}
      {proj && projLab && (() => {
        const lx = Math.min(endDay, projLab.days[projLab.days.length - 1] ?? endDay);
        const lL = projLab.level[projLab.level.length - 1] ?? 10;
        const X0 = x(lx), Y0 = y(lL), X1 = x(proj.day), Y1 = y(15);
        const lostP = v.hidden.why?.outcome === 'lost';
        return (
          <Tip as="g" content={() => <TipCard title={`${projLab.name}: superintelligence`} value={v.future.asiWhen}>Projected from the race at your exit: {projLab.name}{RSQ}s pace at the end, carried forward.</TipCard>}>
            <path d={`M${X0},${Y0} C${X0 + 90},${Y0 - 10} ${X1 - 60},${Y1 + 40} ${X1},${Y1}`} fill="none" stroke={C.watch} strokeWidth={2} strokeDasharray="5 4" />
            <circle cx={X1} cy={Y1} r={6} fill="none" stroke={lostP ? C.crit : C.good} strokeWidth={2} />
            <text x={Math.min(XE + 8, W - 270)} y={t - 6} className="es-svg-proj" textAnchor="start">{projLab.name} superintelligence {v.future.asiWhen} · projected</text>
          </Tip>
        );
      })()}
      {endLabels}
      {player && player.milestones.filter((m) => m.idx > 0 && m.idx < LEVEL.length).map((m) => {
        const X = x(m.day), Y = y(LEVEL[m.idx]);
        const label = m.idx < 6 && XE - X > 70;
        return (
          <Tip as="g" key={m.idx} content={() => <TipCard title={MILESTONE_NAMES[m.idx]} value={fmtD(m.day)}>Your lab reached this milestone.</TipCard>}>
            <circle cx={X} cy={Y} r={5} fill={C.panel} stroke={C.you} strokeWidth={2} />
            {label && <text x={X - 8} y={Y - 8} className="es-svg-mono you" textAnchor="end">{fmtD(m.day)}</text>}
          </Tip>
        );
      })}
      <line x1={XE} x2={XE} y1={t} y2={H - b} stroke={C.text} strokeWidth={1} strokeDasharray="3 3" />
      <text x={XE - 6} y={t - 6} className="es-svg-t1" textAnchor="end">{v.future.projected ? 'You leave' : 'End'} · {v.date}</text>
    </svg>
  );
}

function ComputeChart({ v }: { v: View }) {
  const c = v.race.compute;
  const W = 300, H = 236, l = 42, r = 14, t = 12, b = 26;
  const xMax = Math.max(1, v.race.endDay);
  // The AI 2027 table up to the end, its line cut at the end day (interpolated, not clamped).
  const all = v.race.ai2027;
  const ai = all.filter((p) => p.day <= xMax);
  const nxt = all.find((p) => p.day > xMax);
  const prv = ai[ai.length - 1];
  if (nxt && prv) ai.push({ day: xMax, h100e: prv.h100e + ((nxt.h100e - prv.h100e) * (xMax - prv.day)) / (nxt.day - prv.day) });
  const top = Math.max(1, ...c.h100e, ...ai.map((p) => p.h100e));
  const mag = Math.pow(10, Math.floor(Math.log10(top)));
  const stepV = [0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10].map((k) => k * mag).find((k) => top / k <= 5) ?? mag * 10;
  const yMax = Math.ceil(top / stepV) * stepV;
  const x = (d: number) => l + (Math.min(d, xMax) / xMax) * (W - l - r);
  const y = (q: number) => t + (1 - q / yMax) * (H - t - b);
  const path = (pts: [number, number][]) => pts.map(([d, q], i) => `${i ? 'L' : 'M'}${x(d).toFixed(1)},${y(q).toFixed(1)}`).join('');
  const start = startOf(v);
  const years: { d: number; yr: number }[] = [];
  for (let yr = start.getUTCFullYear() + 1; yr <= start.getUTCFullYear() + 12; yr++) { const d = Math.round((Date.UTC(yr, 0, 1) - start.getTime()) / 864e5); if (d <= xMax) years.push({ d, yr }); }
  const you = c.h100e[c.h100e.length - 1] ?? 0;
  const aiPts = ai.map((p) => [Math.max(0, p.day), p.h100e] as [number, number]);
  const aiLast = aiPts[aiPts.length - 1];
  const youUp = !aiLast || you >= aiLast[1];
  const youPath = path(c.days.map((d, i) => [d, c.h100e[i]]));
  return (
    <>
      <div className="es-card-hd"><ICON.compute size={16} /><span className="ttl">Your compute</span><span className="sub"><Term id="h100e">H100e</Term> · vs the <Term id="ai2027">AI 2027</Term> leading lab</span></div>
      <svg width={W} height={H}>
        {Array.from({ length: Math.round(yMax / stepV) + 1 }, (_, i) => i * stepV).map((gv) => (
          <g key={gv}><line x1={l} x2={W - r} y1={y(gv)} y2={y(gv)} stroke={C.line} /><text x={l - 6} y={y(gv) + 4} className="es-svg-mono" textAnchor="end">{tick(gv)}</text></g>
        ))}
        {years.map((q) => <text key={q.yr} x={x(q.d)} y={H - 8} className="es-svg-mono" textAnchor="middle">{q.yr}</text>)}
        {aiPts.length > 1 && <path d={path(aiPts)} fill="none" stroke={C.text2} strokeWidth={1.6} strokeDasharray="4 3" />}
        <Tip as="g" content={() => <TipCard title="Your compute" value={F.h100e(you)}>Compute online at the end, in <Term id="h100e">H100e</Term>.{aiLast ? ` The AI 2027 leading lab by then: ${F.h100e(aiLast[1])}.` : ''}</TipCard>}>
          <path d={youPath} fill="none" stroke={C.you} strokeWidth={2.4} />
          <path d={youPath} fill="none" stroke="transparent" strokeWidth={10} />
        </Tip>
        <text x={x(c.days[c.days.length - 1] ?? 0) - 4} y={y(you) + (youUp ? -6 : 14)} className="es-svg-mono you" textAnchor="end">{tick(+you.toPrecision(3))}</text>
        {aiLast && Math.abs(y(aiLast[1]) - y(you)) > 12 && <text x={x(aiLast[0]) - 4} y={y(aiLast[1]) + (youUp ? 14 : -6)} className="es-svg-mono" textAnchor="end">{tick(+aiLast[1].toPrecision(3))}</text>}
      </svg>
      <div className="es-chart-cap">
        <span><b className="ln" style={{ background: C.you }} />{v.world.company.name}</span>
        <span><b className="ln dash" />AI 2027 leading lab</span>
      </div>
    </>
  );
}

// ───────────────────────────── what you couldn't see ─────────────────────────────

function Hidden({ v }: { v: View }) {
  const h = v.hidden;
  return (
    <>
      <div className="es-sec-hd" id="es-hidden"><h2>What you couldn{RSQ}t see</h2><span className="sub">hidden during play</span></div>
      <div className={`es-hid ${h.why ? '' : 'no-why'}`}>
        {h.why && <Why v={v} />}
        <Labs labs={h.labs} />
        <WorldFacts v={v} />
        <Agendas v={v} />
      </div>
    </>
  );
}

function Gauge({ label, value, fill, marks, hatch }: { label: ReactNode; value: number; fill?: string; marks: { at: number; text?: string }[]; hatch?: boolean }) {
  return (
    <div className="es-gauge-row">
      <span>{label}</span>
      <div className={`es-gtrack ${fill ? '' : 'bare'}`}>
        {fill && <i className={hatch ? 'hatch' : ''} style={{ width: `${Math.min(100, value * 100)}%`, background: hatch ? undefined : fill }} />}
        {marks.map((m, i) => <b key={i} style={{ left: `${m.at * 100}%` }}>{m.text && <span className={m.at > 0.6 ? 'l' : 'r'}>{m.text}</span>}</b>)}
      </div>
      <span className="es-gval num">{pctI(value)}</span>
    </div>
  );
}

function Why({ v }: { v: View }) {
  const w = v.hidden.why!;
  const tol = w.tolerance;
  const playerLab = v.hidden.labs.find((l) => l.kind === 'player');
  const verdict = w.outcome === 'held'
    ? <><b>Control held.</b> {w.afterOversight !== undefined ? 'What it could act on after your oversight' : 'What it would try'} stayed under what the world could absorb{w.afterOversight !== undefined && playerLab ? ` (you had estimated ${pctI(playerLab.lo)}–${pctI(playerLab.hi)} for what it would try)` : ''}.</>
    : w.outcome === 'contained'
      ? <><b>Contained.</b> {w.labName}{RSQ}s AI went past what the world could absorb, but containment reached what was needed to hold it.</>
      : <><b>Control lost.</b> {w.labName}{RSQ}s AI would try more than the world could absorb{w.containment !== undefined ? ', and containment fell short of what was needed' : ', and nothing contained it'}.</>;
  return (
    <div className="es-card">
      <div className="es-card-hd"><ICON.safety size={16} /><span className="ttl">Why it ended this way</span><span className="sub">{w.labName}{RSQ}s superintelligence, {w.projected ? `projected for ${w.when}` : w.when}</span></div>
      <Tip as="div" content={termCard('wouldTry', pctI(w.wouldTry))}>
        <Gauge label={<><Term id="wouldTry">Would try</Term>{w.afterOversight !== undefined && <span className="es-t3"> (no oversight)</span>}</>} value={w.wouldTry} fill={w.afterOversight !== undefined ? C.text3 : labColor(w.lab)} hatch={w.projected} marks={[{ at: tol }]} />
      </Tip>
      {w.afterOversight !== undefined && (
        <Tip as="div" content={termCard('afterOversight', pctI(w.afterOversight))}>
          <Gauge label={<Term id="afterOversight">After your oversight</Term>} value={w.afterOversight} fill={labColor('player')} marks={[{ at: tol }]} />
        </Tip>
      )}
      <Tip as="div" content={termCard('tolerance', pctI(tol))}>
        <Gauge label={<Term id="tolerance">World could absorb</Term>} value={tol} marks={[{ at: tol, text: 'tolerance' }]} />
      </Tip>
      {w.containment !== undefined && (
        <Tip as="div" content={termCard('containment', pctI(w.containment), <div className="tipcard-foot">Needed: {pctI(w.containmentNeeded ?? 0)}.</div>)}>
          <Gauge label={<Term id="containment">Containment</Term>} value={w.containment} fill={w.outcome === 'contained' ? C.watch : C.crit} marks={[{ at: w.containmentNeeded ?? 0, text: `needed ${pctI(w.containmentNeeded ?? 0)}` }]} />
        </Tip>
      )}
      <div className={`es-verdict ${w.outcome === 'held' ? 'good' : w.outcome === 'contained' ? 'warn' : 'bad'}`}>
        {w.outcome === 'held' ? <ICON.check size={16} /> : <STEP_ICON.x size={16} />}<span>{verdict}</span>
      </div>
    </div>
  );
}

function BandRow({ chip, name, small, lo, hi, truth, outside, color, tip }: { chip?: ReactNode; name: ReactNode; small?: string; lo: number; hi: number; truth: number; outside: boolean; color?: string; tip: () => ReactNode }) {
  return (
    <Tip as="div" className={`es-lab ${chip ? '' : 'nochip'}`} content={tip}>
      {chip}
      <span className="nm">{name}{small && <small>{small}</small>}</span>
      <div className="es-band"><i style={{ left: `${lo * 100}%`, width: `${Math.max(0.5, (hi - lo) * 100)}%`, background: color }} /><b className={outside ? 'miss' : ''} style={{ left: `calc(${truth * 100}% - 1px)` }} /></div>
      <span className="vv num">{pctI(lo).replace('%', '')}–{pctI(hi)} · <b className={outside ? 'miss' : ''}>{pctI(truth)}</b></span>
    </Tip>
  );
}

function Labs({ labs }: { labs: HiddenLab[] }) {
  return (
    <div className="es-card">
      <div className="es-card-hd"><ICON.rival size={16} /><span className="ttl">The labs</span><span className="sub"><Term id="wouldTry">Would try</Term> (act against its makers): your estimate vs the truth, at the end</span></div>
      {labs.map((l) => (
        <BandRow key={l.id} chip={<span className="es-chip" style={{ background: labColor(l.id) }}>{monogram(l.name)}</span>} name={l.name} small={l.status !== 'active' && l.kind !== 'player' ? l.status : undefined}
          lo={l.lo} hi={l.hi} truth={l.truth} outside={l.outside}
          tip={() => <TipCard title={l.name} value={pctI(l.truth)} rows={[{ label: l.kind === 'player' ? 'Your safety estimate (best model)' : 'Their public safety posture', value: `${pctI(l.lo)}–${pctI(l.hi)}` }, { label: 'The truth', value: pctI(l.truth), tone: l.outside ? 'neg' : undefined }]}>
            How strongly its best model would try to act against its makers.{l.outside ? ' The truth lay outside your range.' : ''}
          </TipCard>} />
      ))}
      <div className="es-axis"><span /><span /><div><span>0%</span><span>50%</span><span>100%</span></div><span /></div>
      <div className="es-chart-cap"><span><b className="rng" />your range</span><span><b className="tk" />truth</span><span><b className="tk miss" />truth outside your range</span></div>
    </div>
  );
}

function WorldFacts({ v }: { v: View }) {
  const d = v.hidden.difficulty;
  return (
    <div className="es-card">
      <div className="es-card-hd"><ICON.world size={16} /><span className="ttl"><Term id="worldFacts">This world</Term></span><span className="sub">how hard alignment really was · fixed at the start</span></div>
      {v.hidden.facts.map((f) => {
        const I = f.polarity === 'good' ? ICON.factGood : f.polarity === 'bad' ? ICON.factBad : ICON.factMid;
        const cell = Math.min(4, Math.max(0, Math.round(f.pos * 4)));
        return (
          <Tip as="div" key={f.id} className={`es-fact ${f.polarity}`} content={() => <TipCard title={f.text}>Where this world fell between “{f.lo}” and “{f.hi}”: {f.polarity === 'good' ? 'good' : f.polarity === 'bad' ? 'bad' : 'neither good nor bad'} for alignment. Drawn at the start; you never saw it during play.</TipCard>}>
            <I size={15} /><span className="tx">{f.text}</span>
            <div><div className="es-dv">{[0, 1, 2, 3, 4].map((i) => <i key={i} className={i === cell ? `on ${f.polarity}` : ''} />)}</div><div className="es-dv-l"><span>{f.lo}</span><span>{f.hi}</span></div></div>
          </Tip>
        );
      })}
      <div className="es-foot">Alignment was {d.word} in this world (<Tip content={termCard('alignDifficulty', `×${d.mult.toFixed(2)}`)}><span className="num es-dotted">difficulty ×{d.mult.toFixed(2)}</span></Tip>).</div>
    </div>
  );
}

function Agendas({ v }: { v: View }) {
  const h = v.hidden;
  const fm = h.failureModes;
  return (
    <div className="es-card">
      <div className="es-card-hd"><ICON.safety size={16} /><span className="ttl">Safety research</span>
        <span className="sub"><Tip content={() => <TipCard title="Programmes you funded">{h.agendaRule}</TipCard>}><span className="es-dotted">programmes you funded</span></Tip> · <Term id="agendaEfficacy">efficacy</Term>: your range vs the truth</span>
      </div>
      {h.agendas.length ? h.agendas.map((a) => (
        <BandRow key={a.id} name={a.name} lo={a.lo} hi={a.hi} truth={a.truth} outside={a.outside} color="rgba(34,163,148,.38)"
          tip={() => <TipCard title={a.name} value={pctI(a.truth)} rows={[{ label: 'Your range', value: `${pctI(a.lo)}–${pctI(a.hi)}` }, { label: 'The truth', value: pctI(a.truth), tone: a.outside ? 'neg' : undefined }]}>
            How well this programme really works in this world.{a.outside ? ' The truth lay outside your range.' : ''}
          </TipCard>} />
      )) : <div className="es-empty">You funded no safety programmes.</div>}
      <Tip as="div" className="es-fm" content={() => <TipCard title="Hidden failure modes" value={String(fm.count)}>{fm.count ? <>Present in your models{RSQ} bases:<ul className="es-fm-list">{fm.names.map((n) => <li key={n}>{n}</li>)}</ul></> : 'None of your models carried one.'}</TipCard>}>
        <ICON.failureModes size={15} /><span className="n num">{fm.count}</span><span>hidden <Term id="umode">failure modes</Term> {fm.count === 1 ? 'was' : 'were'} in your models</span>{fm.count > 0 && <span className="es-t3 es-ml">hover for names</span>}
      </Tip>
    </div>
  );
}
