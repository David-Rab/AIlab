// RESEARCH › Know-how (UB-8; UI-IA §1 Know-how, approved mockup design/ux/mockups/rd/knowhow.png; DATA.md "RESEARCH ›
// Know-how"). L1: five area bars, × vs July 2025 on a log axis: Public know-how | Yours (90% range whisker) with the
// Waiting part hatched at its end (never more than Yours); growth over the last 12 months. Side: "Waiting for your next
// model" (link → TRAINING › Next run), "Where it comes from", and the Lab tools the lab owns (DD-03: owned built things;
// the build runs in LAB's build queue). L2: an area's adopted ideas (click a row). Publish policy lives on SAFETY (link).
// HOME of: know-how per area (public, yours, waiting), know-how growth, the idea list per area, Lab tools.
// F1b: the pretraining bar also shows outside know-how (teal, up to the diffused level), your own-research tick, and one line
// saying which is in effect (HOME of: outside know-how vs own).
// Reads beliefs and facts only (UB-2 knowHowAreas / stackViews: believed sums of the adopted results' estimates).
import { useMemo } from 'react';
import { agentsView, dateOf, fmtDate, knowHowAreas, stackViews, toolingView, featureUpkeepTW } from '../../../engine/v2';
import type { GameStateV2, KnowHowArea, StackKey } from '../../../engine/v2';
import { TOOL_BY_ID } from '../../../data/v2/features';
import { store, useV2 } from '../store';
import { ActBtn, Term, Tip, TipCard } from '../ui';
import { Card, Ref } from '../kit';
import { ICON } from '../icons';
import * as F from '../fmt';
import './portfolio.css';
import { AREA_ICON, AREA_NAME, AREA_UNIT, dispName, xf } from './researchWords';

const ui = (k: string, d = '') => store.tab[`research.${k}`] ?? d;
const setUi = (k: string, v: string) => store.setTab(`research.${k}`, v);
const short = (s: GameStateV2, day: number) => fmtDate(dateOf(s, day));
/** × at two decimals below ×2 (know-how moves slowly; the mockup's precision). */
const xk = (v: number, d?: number) => (v >= 1e6 ? `×${(v / 1e6).toFixed(1)}M` : v >= 1e4 ? `×${(v / 1e3).toFixed(0)}K` : v >= 100 ? `×${v.toFixed(0)}` : xf(v, d ?? (v >= 1.995 ? 1 : 2)));
/** Ideas counted with batches (a batch can be fractional): a whole number of ideas. */
const ideasW = (n: number) => { const k = Math.round(n); return `${k} idea${k === 1 ? '' : 's'}`; };
const WAIT_TRAINS: Partial<Record<StackKey, string>> = { pre: 'Only a new base model takes them in.', rlMid: 'A post-training run takes them in.', rlCeil: 'A post-training run takes them in.' };

function AreaRow({ s, a, X, ticks, open, toggle }: { s: GameStateV2; a: KnowHowArea; X: (v: number) => number; ticks: number[]; open: boolean; toggle: () => void }) {
  const Ic = AREA_ICON[a.key];
  const w = a.waiting && a.waiting.x > 1.0005 ? a.waiting : undefined;
  const base = w ? a.yours / w.x : a.yours;
  const [lo, hi] = a.yoursRange;
  // F1: the pretraining area shows outside know-how. `mult` = the lift outside know-how gives over your own research (1 when
  // your own is ahead); the grey bar is the public start, the teal part reaches the diffused level on the same scale.
  const dif = a.diffusion;
  const inEffect = !!dif && dif.inEffect === 'diffused' && dif.own > 0;
  const mult = inEffect ? dif!.diffused / dif!.own : 1;
  const liftTxt = mult >= 3 ? `×${mult.toFixed(1)}` : F.pct(mult - 1, 0, true);
  const pub0 = a.public / mult;
  const ownPre = a.yours / mult;
  const dPos = dif && dif.own > 0 ? ownPre * (dif.diffused / dif.own) : undefined;
  const outEnd = dPos !== undefined && dPos > pub0 * 1.003 ? dPos : undefined;
  const pubEnd = outEnd ?? pub0;
  return (
    <div className={`kh-ar ${open ? 'open' : ''}`} data-area={a.key} onClick={toggle} role="button" aria-expanded={open}>
      <div>
        <div className="nm"><Ic size={16} /><Term id="recipeStack">{AREA_NAME[a.key]}</Term></div>
        <div className="un">× {AREA_UNIT[a.key]}</div>
      </div>
      <div className="kh-track" style={dif ? { height: 70 } : undefined}>
        {ticks.map((t) => <div key={t} className="gridl" style={{ left: `${X(t)}%` }} />)}
        <Tip as="div" className="kh-bar pub" style={{ left: 0, width: `${X(pub0)}%`, ...(outEnd ? { borderRadius: '4px 0 0 4px' } : {}) }} content={() => <TipCard title={<Term id="publicKnowledge">Public know-how</Term>} value={xk(pub0)}>What every lab knows from published work, × vs July 2025.</TipCard>}><span /></Tip>
        {outEnd !== undefined && dif && <Tip as="div" className={`kh-bar out ${inEffect ? '' : 'idle'}`} style={{ left: `${X(pub0)}%`, width: `${Math.max(0.4, X(outEnd) - X(pub0))}%` }} content={() => <TipCard title={<Term id="diffusion">Outside know-how</Term>} value={xk(outEnd)} rows={[
          { label: 'Your own research alone', value: xk(ownPre) },
          ...(dif.publicLevel !== undefined ? [{ label: dif.from ? `Best public, ${dif.from}` : 'Best public', value: xk(dif.publicLevel * ownPre / dif.own) }] : []),
          { label: 'In effect', value: inEffect ? 'outside' : 'your own' },
        ]}>{inEffect ? 'Know-how from other labs that has reached you and is ahead of your own research.' : 'Know-how from other labs that has reached you. Your own research is ahead of it, so it adds nothing.'}</TipCard>}><span /></Tip>}
        <span className={`kh-vl pub ${outEnd !== undefined ? 'out' : ''}`} style={{ left: `calc(${X(pubEnd)}% + 8px)` }}>{xk(pubEnd)}</span>
        <Tip as="div" className="kh-bar you" style={{ left: 0, width: `${X(base)}%`, ...(w ? { borderRadius: '4px 0 0 4px' } : {}) }} content={() => <TipCard title={<Term id="stackEfficiency">Yours</Term>} value={xk(a.yours)} rows={[
          { label: 'Likely range (9 in 10)', value: `${xk(lo)}–${xk(hi)}` }, { label: 'Certainty', value: a.certainty.word },
          ...(inEffect ? [{ label: 'Your own research alone', value: xk(ownPre) }] : []),
          ...(w ? [{ label: 'In your newest model', value: xk(base) }, { label: <Term id="trainedIn">Waiting</Term>, value: `${xk(w.x)} · ${ideasW(w.ideas)}` }] : []),
        ]}>{inEffect ? 'Outside know-how' : 'Public know-how'} plus your results&apos; expected effects. Believed: your evals measure models, not single ideas.</TipCard>}><span /></Tip>
        {w && <Tip as="div" className="kh-bar wait" style={{ left: `${X(base)}%`, width: `${Math.max(0.4, X(a.yours) - X(base))}%` }} content={() => <TipCard title={<Term id="trainedIn">Waiting</Term>} value={xk(w.x)} rows={[{ label: 'Ideas', value: ideasW(w.ideas) }, { label: 'Since', value: short(s, w.since) }, { label: 'Likely range', value: `${xk(w.range[0])}–${xk(w.range[1])}` }]}>{`Know-how no model of yours has yet. ${WAIT_TRAINS[a.key] ?? ''}`}</TipCard>}><span /></Tip>}
        {inEffect && <div className="kh-ownmark" style={{ left: `${X(ownPre)}%` }} />}
        {hi > lo * 1.002 && <div className="kh-whisk" style={{ left: `${X(lo)}%`, width: `${Math.max(0.3, X(hi) - X(lo))}%` }} />}
        {X(Math.max(hi, a.yours)) > 80 ? <span className="kh-vl you in" style={{ left: `calc(${X(lo)}% - 8px)`, transform: 'translateX(-100%)' }}>{xk(a.yours)}</span> : <span className="kh-vl you" style={{ left: `calc(${X(Math.max(hi, a.yours))}% + 10px)` }}>{xk(a.yours)}</span>}
        {dif && <div className={`kh-outline ${inEffect ? 'on' : ''}`} data-test="outside-knowhow">{inEffect
          ? <><Term id="diffusion">Catching up from outside</Term>: <Tip content={() => <TipCard title={<Term id="diffusion">Outside know-how</Term>} value={liftTxt} rows={[{ label: 'Your own research alone', value: xk(ownPre) }, { label: 'Outside level', value: xk(a.yours) }]}>How far outside know-how is ahead of your own research. It shrinks as your own research catches up.</TipCard>}><b>{liftTxt}</b></Tip>{dif.from ? ` (from ${dif.from})` : ''}</>
          : <>Ahead of public know-how: <Term id="diffusion">outside know-how</Term> adds nothing</>}</div>}
        {w && w.x >= 1.05 && <span className="kh-vl wt" style={{ left: `${X(base)}%` }}>{xk(w.x, 2)} <Term id="trainedIn">waiting</Term> · {ideasW(w.ideas)}</span>}
      </div>
      <Tip content={() => <TipCard title={<Term id="softwareRate">Know-how growth</Term>} value={`${xk(a.perYear, 2)} / yr`} rows={[{ label: 'Ideas built in, last 12 months', value: ideasW(a.perYearIdeas) }]}>From your own results over the last 12 months (your estimate).</TipCard>}>
        <div className="kh-gr"><b>{xk(a.perYear, 2)}</b><div>last 12 months · {ideasW(a.perYearIdeas)}</div></div>
      </Tip>
    </div>
  );
}

/** L2: the adopted ideas of one area (newest first), each as × with its range and where it has been measured. */
function IdeaList({ s, k }: { s: GameStateV2; k: StackKey }) {
  const sv = stackViews(s).find((v) => v.key === k);
  const ideas = [...(sv?.ideas ?? [])].reverse();
  return (
    <div className="kh-ideas" data-test={`ideas.${k}`}>
      {ideas.length === 0 && <div className="dim small">No results of your own in this area yet.</div>}
      {ideas.slice(0, 12).map((a) => (
        <div key={`${a.id}-${a.day}`} className="kh-idea">
          <span>{dispName(a.name)}{a.b && a.b > 1 ? <span className="dim"> · {a.b} ideas</span> : null}</span>
          <Tip content={() => <TipCard title={<Term id="beliefBand">Expected effect</Term>} value={xk(Math.pow(10, a.est))} rows={[{ label: 'Likely range', value: `${xk(Math.pow(10, a.est - 1.64 * a.estSd))}–${xk(Math.pow(10, a.est + 1.64 * a.estSd))}` }, { label: 'Built in', value: short(s, a.day) }]}>Your estimate when the result came in.</TipCard>}>
            <span className="num">{xk(Math.pow(10, a.est))} <span className="dim">{short(s, a.day)}</span></span>
          </Tip>
          <Tip content={() => <TipCard title={<Term id="realisedEffect">Measured in</Term>} value={a.seenIn ?? 'not yet'}>{a.embodiedBy}</TipCard>}>
            <span className="dim small">{a.seenIn ? `in ${a.seenIn}` : 'not in a measured model yet'}</span>
          </Tip>
        </div>
      ))}
      {ideas.length > 12 && <div className="dim small">and {ideas.length - 12} earlier</div>}
    </div>
  );
}

function Areas({ s, areas }: { s: GameStateV2; areas: KnowHowArea[] }) {
  const open = ui('khOpen');
  const top = Math.max(5, ...areas.map((a) => a.yoursRange[1] * 1.15));
  const LO = Math.log(0.9);
  const HI = Math.log(top);
  const X = (v: number) => ((Math.log(Math.max(0.9, v)) - LO) / (HI - LO)) * 100;
  // Ticks 1-2-5 per decade, kept at least 7% of the axis apart.
  const cand = [1, 1.5, 2, 3, 5, ...Array.from({ length: 8 }, (_, i) => [1, 2, 5].map((m) => m * Math.pow(10, i + 1))).flat()].filter((t) => t <= top);
  const ticks = cand.reduce<number[]>((acc, t) => (acc.length && X(t) - X(acc[acc.length - 1]) < 7 ? acc : [...acc, t]), []);
  return (
    <Card className="kh-areas" home="knowHow" title={<span className="row-i"><ICON.experiments size={16} /><Term id="knowHow">Know-how</Term> <span className="dim small">× vs Jul 2025</span></span>}
      sub={<span className="kh-legend">
        <span><i style={{ background: '#56677e' }} /><Term id="publicKnowledge">Public know-how</Term></span>
        {areas.some((a) => a.diffusion && a.diffusion.inEffect === 'diffused') && <span><i style={{ background: '#2fa89a' }} /><Term id="diffusion">Outside know-how</Term></span>}
        <span><i style={{ background: '#9b6be0' }} /><Term id="stackEfficiency">Yours</Term>, in your models</span>
        <span><i style={{ background: 'repeating-linear-gradient(135deg, rgba(155,107,224,.9) 0 3px, rgba(155,107,224,.25) 3px 6px)', boxShadow: 'inset 0 0 0 1px #c4a5f5' }} /><Term id="trainedIn">Waiting</Term>: not in a model yet</span>
        <span><i style={{ width: 14, height: 2, background: '#fff' }} /><Term id="estimateBand">range</Term></span>
      </span>}
      right={<span className="dim small">growth</span>}>
      {areas.map((a) => (
        <div key={a.key}>
          <AreaRow s={s} a={a} X={X} ticks={ticks} open={open === a.key} toggle={() => setUi('khOpen', open === a.key ? '' : a.key)} />
          {open === a.key && <IdeaList s={s} k={a.key} />}
        </div>
      ))}
      <div className="kh-ar" style={{ cursor: 'default', paddingTop: 4, paddingBottom: 4, borderBottom: 0 }}>
        <span className="dim small">click an area for its results</span>
        <div className="kh-axis">{ticks.map((t) => <span key={t} style={{ left: `${X(t)}%` }}>×{t}</span>)}</div>
        <span />
      </div>
    </Card>
  );
}

function Waiting({ s, areas }: { s: GameStateV2; areas: KnowHowArea[] }) {
  const w = areas.filter((a) => a.waiting);
  const big = [...w].sort((a, b) => (b.waiting!.x - a.waiting!.x))[0];
  return (
    <Card className="kh-wcard" home="waiting" title={<span className="row-i"><ICON.runs size={16} />Waiting for your next model</span>}>
      {big && big.waiting && big.waiting.x > 1.0005 ? (
        <div className="kh-wbig" data-test="waiting-big">
          <Tip content={() => <TipCard title={<Term id="trainedIn">Waiting</Term>} value={xk(big.waiting!.x)} rows={[{ label: 'Likely range', value: `${xk(big.waiting!.range[0])}–${xk(big.waiting!.range[1])}` }, { label: 'Ideas', value: ideasW(big.waiting!.ideas) }]}>Your estimate of the know-how no model of yours has.</TipCard>}>
            <div className="row-i" style={{ gap: 12, alignItems: 'baseline' }}><span className="n1">{xk(big.waiting.x, big.waiting.x >= 1.995 ? 1 : 2)}</span><span style={{ fontSize: 15, color: '#fff' }}>{AREA_NAME[big.key].toLowerCase()}</span></div>
          </Tip>
          <div className="dim" style={{ marginTop: 4 }}>{ideasW(big.waiting.ideas)} since {short(s, big.waiting.since)} that no model of yours has. {WAIT_TRAINS[big.key]}</div>
          <div className="row-i" style={{ marginTop: 10 }}><Ref id="nextRun" to={{ panel: 'blueprint' }}>Next run</Ref></div>
        </div>
      ) : <div className="dim small" style={{ padding: '6px 0' }}>Nothing waiting: your newest models have all your know-how.</div>}
      {w.filter((a) => a !== big).map((a) => (
        <div key={a.key} className="kh-row">
          <span>{AREA_NAME[a.key]}</span>
          <Tip content={() => <TipCard title="Waiting" value={xk(a.waiting!.x)} rows={[{ label: 'Since', value: short(s, a.waiting!.since) }]}>{WAIT_TRAINS[a.key]}</TipCard>}><b className="num">{xk(a.waiting!.x)}</b></Tip>
          <span className="dim">{ideasW(a.waiting!.ideas)}</span>
        </div>
      ))}
      <div className="kh-row"><span className="dim">Training and serving efficiency</span><span /><span className="dim">apply at once</span></div>
    </Card>
  );
}

function WhereFrom({ areas }: { areas: KnowHowArea[] }) {
  const n = areas.reduce((a, x) => a + x.perYearIdeas, 0);
  return (
    <Card home="knowHowSources" title={<span className="row-i"><ICON.lead size={16} />Where it comes from</span>}>
      <div className="kh-row">
        <span>Your research, last 12 months</span>
        <Tip content={() => <TipCard title="Ideas built in, last 12 months" value={String(Math.round(n))} rows={areas.map((a) => ({ label: AREA_NAME[a.key], value: `${ideasW(a.perYearIdeas)} · ${xk(a.perYear, 2)}` }))}>Results your programmes and projects built into your recipe.</TipCard>}><b className="num">{Math.round(n)}</b></Tip>
        <span className="dim">ideas built in</span>
      </div>
      <div className="kh-row"><span className="dim">The programmes that add to it</span><span /><Ref id="portfolio" to={{ panel: 'research', tab: 'projects' }}>Portfolio</Ref></div>
    </Card>
  );
}

/** Lab tools (DD-03): internal tools the lab owns, each with the AI-staff work it lifts, build and upkeep. */
function LabTools({ s }: { s: GameStateV2 }) {
  const tools = toolingView(s);
  const lift = useMemo(() => {
    const now = agentsView(s);
    const out: Record<string, { exp: number; ideas: number; build: number }> = {};
    for (const t of tools) {
      const owned = (s.player.tooling ?? []).includes(t.id);
      const other = agentsView({ ...s, player: { ...s.player, tooling: owned ? (s.player.tooling ?? []).filter((x) => x !== t.id) : [...(s.player.tooling ?? []), t.id] } });
      const [a, b] = owned ? [other, now] : [now, other];
      out[t.id] = { exp: b.mExp / Math.max(1e-9, a.mExp) - 1, ideas: b.mIdeas / Math.max(1e-9, a.mIdeas) - 1, build: b.build - a.build };
    }
    return out;
  }, [s, s.time.day, (s.player.tooling ?? []).join(','), s.player.build.queue.length]);
  const WHAT: Record<string, string> = { codingHarness: 'AI staff on engineering', researchHarness: 'AI staff on research ideas', agentMemory: 'all AI staff work' };
  return (
    <Card id="ctl-labTools" home="labTools" title={<span className="row-i"><ICON.build size={16} /><Term id="agentTooling">Lab tools</Term></span>}
      right={<Ref id="buildQueue" to={{ panel: 'lab', tab: 'work' }}>build queue</Ref>}>
      {tools.map((t) => {
        const l = lift[t.id];
        const parts = [l.exp > 0.0005 ? `experiments +${F.pct(l.exp, 1)}` : '', l.ideas > 0.0005 ? `ideas +${F.pct(l.ideas, 1)}` : '', l.build > 0.005 ? `build capacity +${F.num(l.build, 1)} team-wk/wk` : ''].filter(Boolean);
        const up = featureUpkeepTW(TOOL_BY_ID[t.id]);
        return (
          <div key={t.id} className="kh-tool" data-tool={t.id}>
            <span className="tn">{t.name}
              <Tip content={() => <TipCard title={t.name} value={t.owned ? 'owned' : t.etaDays !== undefined ? 'building' : 'not built'} rows={[{ label: 'Build', value: `${t.buildTW} engineer team-weeks · ${F.money(t.cash)}` }, { label: 'Upkeep', value: `${F.num(up, 2)} team-weeks a week` }]}>Engineers build it once on the build queue; it keeps a little upkeep.</TipCard>}>
                <span className={`chip2 ${t.owned ? 'good' : ''}`} data-test={`tool.${t.id}`}>{t.owned ? 'owned' : t.etaDays !== undefined ? `building · ${Math.ceil(t.etaDays)} d` : 'not built'}</span>
              </Tip>
            </span>
            <span>{!t.owned && t.etaDays === undefined && <ActBtn id="tooling.build" testId={`tooling.build.${t.id}`} params={{ id: t.id }} label="Build" block={t.block} />}</span>
            <Tip content={() => <TipCard title={`What ${t.name} helps`} rows={[{ label: 'Experiments (AI staff)', value: F.pct(l.exp, 1, true) }, { label: 'Research ideas (AI staff)', value: F.pct(l.ideas, 1, true) }, { label: 'Build capacity', value: `${F.num(l.build, 1, true)} team-weeks a week` }]}>{`Helps ${WHAT[t.id] ?? 'AI staff'}; ${t.owned ? 'what it adds today' : 'what it would add once built'} (your estimate).`}</TipCard>}>
              <span className="tw">{WHAT[t.id] ?? 'AI staff'}{parts.length ? `: ${parts.join(' · ')}` : ''} · upkeep {F.num(up, 2)} team-wk/wk</span>
            </Tip>
          </div>
        );
      })}
    </Card>
  );
}

export function KnowHow({ s }: { s: GameStateV2 }) {
  useV2();
  const areas = useMemo(() => knowHowAreas(s), [s, s.time.day, s.player.research.adopted?.length]);
  return (
    <div className="kh" data-test="knowhow-tab">
      <Areas s={s} areas={areas} />
      <div className="kh-side">
        <Waiting s={s} areas={areas} />
        <WhereFrom areas={areas} />
        <LabTools s={s} />
      </div>
    </div>
  );
}
