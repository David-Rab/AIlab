// Finance › Story (FINANCE-V3 §1, §11; FIN5a): HOME of the valuation, the sector value and its mood, your share of it
// and the four drivers, with credibility and governance as the share's factors (credibility's score lives in What we
// owe). One card, one selector (engine storyNow). FIN5b: home of the private rivals' valuations (their bars' tooltips).
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { tiesLabel } from '../../../data/v2/deals';
import { capMultiple, credRung, dateOf, dayOfQuarter, DRIVERS, fmtDate, qOf, RIVAL, rivalStructure, STORY, storyNow, structureLabel } from '../../../engine/v2';
import type { Driver, GameStateV2, LabStory, StoryNow } from '../../../engine/v2';
import { Term, Tip, TipCard, Why } from '../ui';
import { Card, GoBtn } from '../kit';
import * as F from '../fmt';
import { ICON } from '../icons';
import { C } from '../theme';

const X = (x: number) => `×${x.toFixed(2)}`;
const tone = (x: number) => (x > 1.005 ? 'tone-pos' : x < 0.995 ? 'tone-neg' : '');

/** Market mood in one word (hype × rates × bust). */
export function moodWord(m: number, bust: boolean): string {
  if (bust) return 'bust';
  return m < 0.7 ? 'cold' : m < 0.9 ? 'cool' : m <= 1.1 ? 'normal' : m <= 1.4 ? 'warm' : 'hot';
}

const DRIVER_UI: Record<Driver, { label: string; term: string; icon: LucideIcon }> = {
  position: { label: 'Position', term: 'storyPosition', icon: ICON.L },
  momentum: { label: 'Momentum', term: 'storyMomentum', icon: ICON.revenue },
  economics: { label: 'Economics', term: 'storyEconomics', icon: ICON.serving },
  capacity: { label: 'Capacity', term: 'storyCapacity', icon: ICON.compute },
};

/** What a driver measures for you and the field, in words for its tile and tooltip. */
function driverRows(st: StoryNow, k: Driver): { you: string; field: string; detail: string } {
  const me = st.me!;
  const f = st.field;
  if (k === 'position') return { you: `L ${F.level(me.level)}${me.floored ? ' (open-weight)' : ''}`, field: `best rival L ${F.level(f.bestLevel)}`, detail: me.floored ? 'No public model yet: investors place you at the best open-weight model.' : 'Your best public model against the best public model of any other lab, big tech included.' };
  if (k === 'momentum') return { you: me.revenue < STORY.preRevenue ? 'pre-revenue (×1)' : `×${me.growth.toFixed(1)} a year`, field: `rivals ×${f.growth.toFixed(1)}`, detail: 'Revenue run-rate now ÷ four quarters ago, in doublings against the rival field\'s average.' };
  if (k === 'economics') return { you: me.margin === null ? 'pre-revenue (field\'s)' : `${F.pct(me.margin)} margin`, field: `rivals ${F.pct(f.margin)} (typical)`, detail: 'Serving gross margin, per 20 points against the rival field. Rivals\' margins are not public: they count at the sector\'s typical 50%.' };
  return { you: `${F.count(me.secured)} H100e`, field: `rivals avg ${F.count(f.secured)}`, detail: 'Compute secured: online plus contracted for the next 8 quarters, in doublings against the rival field\'s average.' };
}

/** A centred bar for a × factor on a log scale (×0.5 … ×2 fill the halves). */
function FactorBar({ x }: { x: number }) {
  const v = Math.max(-1, Math.min(1, Math.log2(x)));
  const w = Math.abs(v) * 50;
  return (
    <span className="story-fbar">
      <i style={{ left: v >= 0 ? '50%' : `${50 - w}%`, width: `${w}%`, background: v >= 0 ? C.good : C.bad }} />
      <b />
    </span>
  );
}

function DriverTile({ s, st, k }: { s: GameStateV2; st: StoryNow; k: Driver }) {
  const me = st.me!;
  const u = DRIVER_UI[k];
  const r = driverRows(st, k);
  const e = st.effect[k];
  void s;
  return (
    <Tip as="div" content={() => (
      <TipCard title={<Term id={u.term}>{u.label}</Term>} value={X(e)} rows={[
        { label: 'You', value: r.you },
        { label: 'Field', value: r.field },
        { label: 'Score against the field', value: `${Math.round(me.x[k] * 100) > 0 ? '+' : Math.round(me.x[k] * 100) < 0 ? '−' : ''}${Math.abs(me.x[k]).toFixed(2)} (±${STORY.clamp} at most)` },
        { label: 'Weight', value: `× ${STORY.weights[k]} ÷ ${STORY.tau}` },
        { label: 'Effect on your weight', value: X(e), tone: e > 1.005 ? 'pos' : e < 0.995 ? 'neg' : 'neutral' },
      ]}>{r.detail}</TipCard>
    )}>
      <div className="story-drv" data-driver={k}>
        <span className="row-i small"><u.icon size={13} /><Term id={u.term}>{u.label}</Term></span>
        <b className={`num ${tone(e)}`}>{X(e)}</b>
        <FactorBar x={e} />
        <span className="dim small ellip">{r.you} · {r.field}</span>
      </div>
    </Tip>
  );
}

function FactorTile({ label, term, icon: I, x, you, children, refTo }: { label: string; term: string; icon: LucideIcon; x: number; you: string; children: ReactNode; refTo?: ReactNode }) {
  return (
    <Tip as="div" content={() => <TipCard title={<Term id={term}>{label}</Term>} value={X(x)} rows={[{ label: 'You', value: you }]}>{children}</TipCard>}>
      <div className="story-drv" data-driver={term}>
        <span className="row-i small"><I size={13} /><Term id={term}>{label}</Term></span>
        <b className={`num ${tone(x)}`}>{X(x)}</b>
        <FactorBar x={x} />
        <span className="dim small ellip">{you}{refTo}</span>
      </div>
    </Tip>
  );
}

const atCap = (a: LabStory) => a.cap !== undefined && a.cap <= a.valuation * 1.001;
/** The valuation cap rule as it applies to this lab (FIN6a: one rule for every private lab, rivalFinance.ts valueCap). */
const capRule = (a: LabStory) => `max(${F.money(RIVAL.team)} team value, ${capMultiple(a.growth).toFixed(0)}× revenue)`;
/** What sets the cap now: the team value, or the growth-scaled multiple of revenue. */
const capWhy = (a: LabStory) => (a.revenue < STORY.preRevenue || (a.cap ?? 0) <= RIVAL.team ? 'team value' : `${capMultiple(a.growth).toFixed(0)}× revenue at ×${a.growth.toFixed(1)} a year`);

/** FIN6b: a rival's story details, one level down from its bar's tooltip (hover "details"). */
function RivalWhy({ s, a }: { s: GameStateV2; a: LabStory }) {
  const npc = s.rivals.find((r) => r.core.id === a.id)?.npc;
  const gov = rivalStructure(npc?.kind ?? '');
  const ties = tiesLabel(npc?.owner, npc?.backers);
  return (
    <Tip content={() => <TipCard title={`${a.name}: its story`} value={`weight ${a.weight.toFixed(2)}`} rows={[
      { label: 'Best public level', value: `L ${F.level(a.level)}${a.floored ? ' (open-weight)' : ''}` },
      { label: 'Revenue growth', value: `×${a.growth.toFixed(1)} a year` },
      { label: 'Story score', value: a.z.toFixed(2) },
      { label: <Term id="investorCred">Investor credibility</Term>, value: a.rung },
      { label: <Term id="govFactor">Governance</Term>, value: `${X(a.gov)} ${gov}` },
      ...(ties ? [{ label: <Term id={npc?.owner ? 'ownedBy' : 'backedBy'}>Company ties</Term>, value: ties }] : []),
      { label: <Term id="valuationCap">Cap</Term>, value: `${F.money(a.cap ?? 0)} = ${capRule(a)}` },
    ]}>{`Weight = credibility × governance × exp(score ÷ ${STORY.tau}), as yours; its share is its weight ÷ every private lab's. The mark moves half-way each quarter.`}</TipCard>}>
      <span className="term" data-test="rival-why">details</span>
    </Tip>
  );
}

/** Today's story shares of every private lab: you first, then the rivals (big-tech labs are not in the sector). A
 *  rival's tooltip is the home of its valuation (S × its marked share, at most its cap). */
function ShareBar({ s, st }: { s: GameStateV2; st: StoryNow }) {
  const labs = st.labs;
  const shades = ['#d4732a', '#b8652a', '#9c5729', '#7f4a29', '#6b3f25'];
  let i = 0;
  return (
    <div className="story-sbar" data-test="story-shares" style={{ gridTemplateColumns: labs.map((a) => `${Math.max(0.005, a.share)}fr`).join(' ') }}>
      {labs.map((a) => {
        const you = a.id === 'player';
        const c = you ? C.you : shades[i++ % shades.length];
        return (
          <Tip key={a.id} content={() => (you
            ? <TipCard title="You" value={F.pct(a.share)} rows={[
              { label: <Term id="valuationCap">Your cap</Term>, value: `${F.money(a.cap ?? 0)} = ${capRule(a)}` },
              ...(atCap(a) ? [{ label: 'At your cap', value: capWhy(a), tone: 'neg' as const }] : []),
            ]}>{'Your share of the sector value by today\'s story. What it is made of: the equation above and the six tiles below.'}</TipCard>
            : <TipCard title={a.name} value={<><Term id="rivalValuation">valued</Term> {F.money(a.valuation)}</>} rows={[
              { label: 'Share today', value: F.pct(a.share) },
              { label: 'Revenue', value: a.revenue >= STORY.preRevenue ? F.money(a.revenue, { perYear: true }) : 'pre-revenue' },
              ...(a.revenue >= STORY.preRevenue ? [{ label: 'Multiple', value: `${(a.valuation / a.revenue).toFixed(0)}× revenue` }] : []),
              ...(atCap(a) ? [{ label: <Term id="valuationCap">At its cap</Term>, value: capWhy(a), tone: 'neg' as const }] : []),
              { label: 'Why this share', value: <RivalWhy s={s} a={a} /> },
            ]}>A private rival: the sector value × its share at the last mark, at most its valuation cap.</TipCard>)}>
            <span className="story-seg" style={{ background: c }} data-lab={a.id}>{a.share >= (you ? 0.05 : 0.12) ? <em>{you ? 'you' : a.name.split(' ')[0]} {F.pct(a.share)}</em> : null}</span>
          </Tip>
        );
      })}
    </div>
  );
}

export function StoryCard({ s }: { s: GameStateV2 }) {
  const st = storyNow(s);
  const f = s.player.finance;
  const me = st.me;
  if (!me) return null;
  const mark = f.ws3.mark;
  const markS = mark?.S ?? st.sector.S;
  const markShare = mark?.share ?? st.share;
  const nextShare = markShare + STORY.blend * (st.share - markShare);
  // FIN6a: the mark is at most the valuation cap (one rule for every private lab).
  const nextV = Math.min(st.sector.S * nextShare, me.cap ?? Infinity);
  const nextCapped = st.sector.S * nextShare > nextV;
  const nextDay = dayOfQuarter(s.time.startDate, qOf(s) + 1);
  const sec = st.sector;
  const busted = sec.bust < 1;
  const rung = credRung(f.credibility);
  return (
    <Card title={<Term id="storyShare">Story</Term>} home="story" id="ctl-story"
      right={<span className="row-i"><span className="dim small"><Term id="valuation">valuation</Term></span>
        <Why k="player.finance.valuation" title={<Term id="valuation">Valuation</Term>} value={F.money(f.valuation)} fmt={(x) => F.money(x)}
          rows={[{ label: 'Sector value at the last mark', value: F.money(markS) }, { label: 'Your share at the last mark', value: F.pct(markShare, 1) }, { label: <Term id="valuationCap">Valuation cap</Term>, value: `${F.money(me.cap ?? 0)}${atCap(me) ? ` · at the cap (${capWhy(me)})` : ''}`, tone: atCap(me) ? 'neg' as const : 'neutral' as const }, { label: 'Next mark if it were today', value: `${F.money(nextV)} on ${fmtDate(dateOf(s, nextDay))}` }]}
          body="Sector value × your share, at most your valuation cap, marked at each quarter start; a priced round sets it to the post-money until the next mark.">
          <b className="num big" data-home="valuation">{F.money(f.valuation)}</b>
        </Why></span>}>
      {/* L1: the equation. */}
      <div className="story-eq" data-test="story-eq">
        <Tip content={() => <TipCard title={<Term id="sectorValue">Sector value</Term>} value={F.money(sec.S)} rows={[
          { label: 'Private labs\' revenue', value: F.money(sec.R, { perYear: true }) },
          { label: `Frontier factor (L ${F.level(sec.L)} ÷ ${STORY.phiRef})^${STORY.phi}`, value: X(sec.phi) },
          { label: <Term id="hype">Hype</Term>, value: sec.H.toFixed(2) },
          { label: <Term id="rates">Rates</Term>, value: X(sec.M) },
          ...(busted ? [{ label: <Term id="bubble">Bust</Term>, value: X(sec.bust), tone: 'neg' as const }] : []),
          { label: 'At the last mark', value: F.money(markS) },
        ]}>{`${STORY.kappa} × revenue^${STORY.alpha} × the frontier factor × mood: what investors pay for all private frontier labs together.`}</TipCard>}>
          <span className="story-term"><span className="dim small"><Term id="sectorValue">Sector</Term></span><b className="num">{F.money(sec.S)}</b></span>
        </Tip>
        <Tip content={() => <TipCard title={<Term id="marketMood">Market mood</Term>} value={sec.mood.toFixed(2)} rows={[{ label: <Term id="hype">Hype</Term>, value: sec.H.toFixed(2) }, { label: <Term id="rates">Rates</Term>, value: X(sec.M) }, { label: <Term id="bubble">Bust</Term>, value: busted ? X(sec.bust) : 'none' }]}>Hype × rates × bust. It moves every lab's valuation and the investor pool.</TipCard>}>
          <span className={`tag2 ${busted ? 'bad' : sec.mood > 1.1 ? 'good' : sec.mood < 0.9 ? 'warn' : ''}`} data-test="story-mood">mood {moodWord(sec.mood, busted)}</span>
        </Tip>
        <span className="story-op">×</span>
        <Tip content={() => <TipCard title={<Term id="storyShare">Your share</Term>} value={F.pct(st.share, 1)} rows={[
          { label: 'Your weight', value: me.weight.toFixed(2) },
          { label: 'All private labs\' weights', value: st.labs.reduce((a, x) => a + x.weight, 0).toFixed(2) },
          { label: 'At the last mark', value: F.pct(markShare, 1) },
          { label: 'Next mark (half-way)', value: F.pct(nextShare, 1) },
        ]}>Your weight ÷ every private lab's. Weight = credibility × governance × the four drivers below. Each quarter the mark moves half-way from the last share to today's.</TipCard>}>
          <span className="story-term"><span className="dim small"><Term id="storyShare">Your share</Term></span><b className="num">{F.pct(st.share, 1)}</b></span>
        </Tip>
        <span className="story-op">→</span>
        <Tip content={() => <TipCard title="Next mark" value={F.money(nextV)} rows={[{ label: 'Sector value today', value: F.money(sec.S) }, { label: 'Share at the mark', value: F.pct(nextShare, 1) }, { label: <Term id="valuationCap">Valuation cap</Term>, value: `${F.money(me.cap ?? 0)}${nextCapped ? ` · binds (${capWhy(me)})` : ''}`, tone: nextCapped ? 'neg' as const : 'neutral' as const }, { label: 'Date', value: fmtDate(dateOf(s, nextDay)) }]}>If the quarter ended today: the sector value × the share at the mark, at most your valuation cap. The valuation now is the last mark (or the last round's post-money).</TipCard>}>
          <span className="story-term"><span className="dim small">next mark</span><b className={`num ${nextV > f.valuation * 1.005 ? 'tone-pos' : nextV < f.valuation * 0.995 ? 'tone-neg' : ''}`} data-test="story-next">{F.money(nextV)}</b></span>
        </Tip>
      </div>
      <ShareBar s={s} st={st} />
      {/* L2: what your weight is made of. */}
      <div className="story-drvs" data-test="story-drivers">
        {DRIVERS.map((k) => <DriverTile key={k} s={s} st={st} k={k} />)}
        <FactorTile label="Investor credibility" term="investorCred" icon={ICON.board} x={me.cred} you={rung.id} refTo={<span data-ref="investorCred"> · in What we owe</span>}>
          Investor credibility's rung (Doubted ×0.7, Unproven ×0.9, Credible ×1, Proven ×1.15). Its score and the promises that move it are in What we owe.
        </FactorTile>
        <FactorTile label="Governance" term="govFactor" icon={ICON.exec} x={me.gov} you={`${structureLabel(s)}${s.player.charter.profitCap ? ', profit cap' : ''}${f.dualClass ? ', dual-class' : ''}`}>
          The charter's appeal to investors: a profit cap ×0.67, a mission body ×0.9, dual-class shares ×0.95, otherwise ×1. Rivals by kind (their bars' details).
        </FactorTile>
      </div>
      <div className="fin-foot">
        <Tip content={() => <TipCard title={<Term id="investorPool">Investor pool</Term>} value={F.money(s.capital.poolAnnual, { perYear: true })} rows={[{ label: `${F.pct(STORY.pi)} of the sector value`, value: F.money(STORY.pi * (mark?.S ?? sec.S), { perYear: true }) }, { label: 'IPO window', value: s.capital.ipoWindow ? `open (+${F.pct(STORY.ipoBump)})` : 'closed' }, { label: 'Your part this quarter', value: F.money(s.capital.ws3.playerPoolQ) }]}>Set at each quarter start, split by the shares at the mark. Unused carries over at 50%.</TipCard>}>
          <span className="small"><span className="dim"><Term id="investorPool">investor pool</Term></span> <b className="num">{F.money(s.capital.poolAnnual, { perYear: true })}</b> <span className="dim">· your part is a limit on the Raise card</span></span>
        </Tip>
        <span className="sp" />
        <GoBtn to={{ panel: 'finance', anchor: 'raise' }} label="Raise" testId="fin.go.storyRaise" />
      </div>
    </Card>
  );
}
