// TRAINING › Data (UB-B; approved mockups design/ux/mockups/rd/train-data.png, train-data-drawer.png; DATA-b.md).
// HOME of: whether the data is enough for the next new base (reads per token against the 1 and 4 marks), the quality
// it reads, new data a day, data by domain and source (with the next base's draw per domain), generated data by teacher,
// the five sources (tokens, quality, today's flow; usage policy, the generating teacher) and the licence drawer (L2:
// domain, kind, amount, before → after). Reads facts and the lab's own forecasts only (runCard of the default new base).
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { BookOpen, ChevronRight, Database, Gem, Globe, GraduationCap, Info, Layers, MessagesSquare, ShoppingCart, Sparkles, TrendingUp, X, type LucideIcon } from 'lucide-react';
import { DOMAIN_IDS } from '../../../data/v2/calibration';
import { LICENCE_SIZE_T, LICENCE_TIERS, type LicenceTier, type UsageLevel } from '../../../data/v2/dataAssets';
import { dataPortfolioView, dateOf, fmtDate, licenceForm, poolsOf, usageLevels, versionById, type DataPortfolioView, type runCard } from '../../../engine/v2';
import type { DomainId, GameStateV2 } from '../../../engine/v2';
import { store } from '../store';
import { ActBtn, Term, Tip, TipCard, type Params } from '../ui';
import { Card, DOMAIN_WORD } from '../kit';
import * as F from '../fmt';
import { DOMAIN_ICON } from '../icons';
import { fmtParams } from './Models';
import './data.css';

type Src = 'public' | 'licensed' | 'usage' | 'synthetic' | 'expert';
/** Source colours (DATA-b.md; dataviz validator, dark mode on the panel surface). */
const SRC: Record<Src, { label: string; term: string; icon: LucideIcon; color: string }> = {
  public: { label: 'Public web', term: 'publicWeb', icon: Globe, color: '#3987e5' },
  licensed: { label: 'Licensed', term: 'licensedData', icon: BookOpen, color: '#d55181' },
  usage: { label: 'Usage', term: 'usageData', icon: MessagesSquare, color: '#c98500' },
  synthetic: { label: 'Generated', term: 'syntheticData', icon: Sparkles, color: '#9085e9' },
  expert: { label: 'Expert', term: 'expertData', icon: GraduationCap, color: '#199e70' },
};
const STACK: Src[] = ['public', 'licensed', 'usage', 'synthetic'];
/** Re-reading up to about 4 times costs almost nothing (Muennighoff et al. 2023; production/data.ts). */
const FREE_READS = 4;

/** Tokens given in trillions: 310T, 7.5T, 50B, 2.0B, 400M. */
export const tokT = (t: number) => {
  const a = Math.abs(t);
  if (a >= 100) return `${Math.round(t).toLocaleString('en-US')}T`;
  if (a >= 1) return `${t.toFixed(1)}T`;
  if (a >= 0.001) return `${+(t * 1000).toFixed(a >= 0.1 ? 0 : 1)}B`;
  if (a === 0) return '0T';
  return `${Math.round(t * 1e6)}M`;
};
const dn = (d?: string) => (d ? DOMAIN_WORD[d] ?? d : '');
export type BaseCard = ReturnType<typeof runCard> | undefined;

/** Data verdict for a new base (NEW readout, DATA-b): Enough while the draw keeps its effective compute (re-reading up to
 *  ~4 times is nearly free), Short once repetition costs it. The same rule as Next run's Data limit. */
export function dataVerdict(card: BaseCard): { reads: number; short: boolean } | undefined {
  const L = card?.limits;
  if (!L) return undefined;
  return { reads: L.tokens / Math.max(1, L.tokensUnique), short: L.fData < 0.99 };
}

/** Tokens held per domain and source (T): each source's tokens × its domain mix. */
function byDomain(v: DataPortfolioView): Record<DomainId, Record<Src, number>> {
  const out = {} as Record<DomainId, Record<Src, number>>;
  for (const d of DOMAIN_IDS) out[d] = { public: 0, licensed: 0, usage: 0, synthetic: 0, expert: 0 };
  for (const r of v.rows) for (const d of DOMAIN_IDS) out[d][r.kind as Src] += r.tokensT * (r.mix[d] ?? 0);
  return out;
}

export function DataView({ s, nextBase }: { s: GameStateV2; nextBase: () => BaseCard }) {
  const key = `${s.time.day}|${s.player.finance.cash.toFixed(3)}|${JSON.stringify(s.player.dataPortfolio)}`;
  const d = useMemo(() => {
    const v = dataPortfolioView(s);
    const card = nextBase();
    return { v, card, verdict: dataVerdict(card), dom: byDomain(v) };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const [drawer, setDrawer] = useState(false);
  return (
    <div className="dv" data-test="data-view">
      <div className="dv-tiles">
        <EnoughTile s={s} card={d.card} verdict={d.verdict} />
        <QualityTile v={d.v} card={d.card} />
        <NewDataTile v={d.v} card={d.card} />
      </div>
      <div className="dv-main">
        <div className="dv-left">
          <DomainChart dom={d.dom} card={d.card} />
          <TeacherChart s={s} v={d.v} />
        </div>
        <Sources s={s} v={d.v} openLicence={() => setDrawer(true)} />
      </div>
      {drawer && <LicenceDrawer s={s} dom={d.dom} verdict={d.verdict} close={() => setDrawer(false)} />}
    </div>
  );
}

// ───────── L1 tiles ─────────
function EnoughTile({ s, card, verdict }: { s: GameStateV2; card: BaseCard; verdict?: { reads: number; short: boolean } }) {
  const L = card?.limits;
  if (!L || !verdict) {
    return (
      <Card className="dv-tile" home="dataEnough" title={<span className="row-i"><Database size={15} />Enough for the next run?</span>}>
        <div className="dim small">{s.player.models.bases.length ? 'Only a new base model reads pretraining data.' : 'No new base model can be planned yet.'}</div>
      </Card>
    );
  }
  const MAX = 6;
  const x = (r: number) => `${(Math.min(MAX, r) / MAX) * 100}%`;
  const tip = () => (
    <TipCard title={<Term id="dataTokens">Reads per token</Term>} value={F.num(verdict.reads, 2)} rows={[
      { label: 'Tokens the new base draws', value: tokT(L.tokens / 1e12) },
      { label: <Term id="uniqueTokens">Unique tokens its mix can use</Term>, value: tokT(L.tokensUnique / 1e12) },
      { label: <Term id="dataWall">Effective compute kept</Term>, value: F.pct(L.fData) },
    ]} footer="Up to 1: no token read twice. Up to about 4: re-reading costs almost nothing. Beyond: each extra read is worth less.">How many times the next new base reads each unique token it can use.</TipCard>
  );
  return (
    <Card className="dv-tile" home="dataEnough" title={<span className="row-i"><Database size={15} />Enough for the next run?</span>}
      right={<Tip content={() => <TipCard title={verdict.short ? 'Short' : 'Enough'}>{verdict.short ? 'The next new base re-reads its data so often that it loses effective compute.' : 'The next new base can read its data without losing effective compute.'}</TipCard>}><span className={`dv-verdict ${verdict.short ? 'short' : 'ok'}`} data-test="data-verdict">{verdict.short ? 'Short' : '✓ Enough'}</span></Tip>}>
      <div className="dv-enough">
        <Tip content={tip}><span className="dv-big" data-test="data-reads"><b className="num">{F.num(verdict.reads, 2)}</b> <Term id="dataTokens">reads per token</Term></span></Tip>
        <Tip as="div" content={tip}>
          <div className="dv-gauge" data-test="data-gauge">
            <i className="z z1" style={{ left: 0, width: x(1) }} /><i className="z z2" style={{ left: x(1), width: `calc(${x(FREE_READS)} - ${x(1)})` }} /><i className="z z3" style={{ left: x(FREE_READS), right: 0 }} />
            <b className="mk" style={{ left: x(verdict.reads) }} />
            <span className="t" style={{ left: 0 }}>0</span><span className="t" style={{ left: x(1) }}>1</span><span className="t" style={{ left: x(FREE_READS) }}>4</span><span className="t warn" style={{ left: `calc(${x(FREE_READS)} + 30px)` }}>short</span>
          </div>
        </Tip>
      </div>
      <div className="dv-sub small dim">New base, {fmtParams(L.params)} parameters, draws {tokT(L.tokens / 1e12)}{verdict.reads <= 1 ? ', no token read twice' : ''} <button className="tr-link" data-test="data-to-next" onClick={() => store.goto('blueprint', { tab: 'next' })}>Next run <ChevronRight size={11} /></button></div>
    </Card>
  );
}

function QualityTile({ v, card }: { v: DataPortfolioView; card: BaseCard }) {
  const q = card?.limits?.draw.quality;
  const gen = v.rows.find((r) => r.kind === 'synthetic');
  const genShare = gen ? gen.tokensT / Math.max(1e-9, v.tokensT) : 0;
  return (
    <Card className="dv-tile" home="dataReadQuality" title={<span className="row-i"><Gem size={15} /><Term id="dataQuality">Quality</Term>&nbsp;of what it reads</span>}>
      <Tip content={() => <TipCard title={<Term id="dataQuality">Mean quality drawn</Term>} value={q !== undefined ? F.num(q, 2) : '—'} rows={v.rows.filter((r) => r.kind !== 'expert').map((r) => ({ label: `${SRC[r.kind as Src].label}: ${tokT(r.tokensT)}`, value: `quality ${F.num(r.quality, 2)}` }))}>Token-weighted quality of the next new base&apos;s draw; the public web is 1.</TipCard>}>
        <span className="dv-big" data-test="data-quality"><b className="num">{q !== undefined ? F.num(q, 2) : '—'}</b> <span className="dim">× public web</span></span>
      </Tip>
      <Tip as="div" content={() => <TipCard title={<Term id="syntheticData">Generated data</Term>} rows={[{ label: 'Share of your pretraining tokens', value: F.pct(genShare) }, { label: <Term id="dataQuality">Quality</Term>, value: gen && gen.tokensT > 0 ? F.num(gen.quality, 2) : '—' }]}>Data your models wrote; its quality follows the teacher&apos;s skill.</TipCard>}><div className="dv-sub small dim">Generated data is {F.pct(genShare)} of your tokens at {gen && gen.tokensT > 0 ? F.num(gen.quality, 2) : '—'}</div></Tip>
    </Card>
  );
}

function NewDataTile({ v, card }: { v: DataPortfolioView; card: BaseCard }) {
  const total = v.synPerDayT + v.usagePerDayT;
  const draws = card?.limits ? card.limits.tokens / 1e12 : undefined;
  return (
    <Card className="dv-tile" home="dataNewPerDay" title={<span className="row-i"><TrendingUp size={15} />New data</span>}>
      <Tip content={() => <TipCard title="New data a day" value={`+${tokT(total)}`} rows={[{ label: <Term id="syntheticData">Generated</Term>, value: `+${tokT(v.synPerDayT)}` }, { label: <Term id="usageData">Usage</Term>, value: `+${tokT(v.usagePerDayT)}` }]}>Tokens your models write and your products collect each day.</TipCard>}>
        <span className="dv-big" data-test="data-perday"><b className="num">+{tokT(total)}</b> <span className="dim">a day</span></span>
      </Tip>
      <div className="dv-sub small dim">Generated {tokT(v.synPerDayT)} · Usage {tokT(v.usagePerDayT)}{draws !== undefined ? ` · a new base draws ${tokT(draws)}` : ''}</div>
    </Card>
  );
}

// ───────── data by domain (L1) ─────────
function DomainChart({ dom, card }: { dom: Record<DomainId, Record<Src, number>>; card: BaseCard }) {
  const L = card?.limits;
  const drawT = (d: DomainId) => (L ? (L.tokens / 1e12) * (L.draw.share[d] ?? 0) : 0);
  const tot = (d: DomainId) => STACK.reduce((a, k) => a + dom[d][k], 0);
  const max = Math.max(1e-9, ...DOMAIN_IDS.map((d) => Math.max(tot(d), drawT(d))));
  const ticks = niceTicks(max);
  const w = (t: number) => `${(t / ticks[ticks.length - 1]) * 100}%`;
  return (
    <Card className="dv-dom" home="dataByDomain" title={<span className="row-i"><Layers size={15} />Data by domain</span>} sub="tokens you own, by source"
      right={<span className="dv-legend small">{STACK.map((k) => <span key={k}><i style={{ background: SRC[k].color }} />{SRC[k].label}</span>)}{L && <span><i className="bk" />next run reads</span>}</span>}>
      <div className="dv-domgrid" data-test="data-domains">
        {DOMAIN_IDS.map((d) => {
          const I = DOMAIN_ICON[d];
          const t = tot(d);
          const tip = () => (
            <TipCard title={<Term id="domains">{dn(d)}</Term>} value={tokT(t)} rows={[
              ...STACK.filter((k) => dom[d][k] > 1e-6).map((k) => ({ label: SRC[k].label, value: tokT(dom[d][k]) })),
              ...(L ? [{ label: 'Next new base reads', value: tokT(drawT(d)) }] : []),
              ...(L && t > 1e-9 ? [{ label: <Term id="dataTokens">Reads per token here</Term>, value: F.num(drawT(d) / t, 2) }] : []),
            ]}>Tokens you own in {dn(d)}, by source. The bracket is what the next new base reads.</TipCard>
          );
          return (
            <Tip key={d} as="div" content={tip}>
              <div className="dv-domrow" data-dom={d}>
                <span className="dv-domname row-i small"><I size={13} />{dn(d)}</span>
                <span className="dv-track">
                  <span className="dv-stack" style={{ width: w(t) }}>{STACK.map((k) => dom[d][k] > 0 ? <i key={k} style={{ width: `${(dom[d][k] / Math.max(1e-9, t)) * 100}%`, background: SRC[k].color }} /> : null)}</span>
                  {L && <b className="dv-reads" style={{ width: w(drawT(d)) }} />}
                </span>
                <span className="num small r">{tokT(t)}</span>
              </div>
            </Tip>
          );
        })}
        <div className="dv-axis"><span /><span className="dv-ticks">{ticks.map((x) => <Tip key={x} content={() => <TipCard title="Tokens">Trillions of tokens you own in each domain.</TipCard>}><span className="tk" style={{ left: w(x) }}>{x === 0 ? 0 : `${x.toLocaleString('en-US')}T`}</span></Tip>)}</span><span /></div>
      </div>
    </Card>
  );
}
function niceTicks(max: number): number[] {
  const step = [10, 20, 50, 100, 200, 500, 1000, 2000].find((x) => max / x <= 5) ?? 5000;
  const out: number[] = [];
  for (let x = 0; x <= max + step * 0.999; x += step) out.push(x);
  return out;
}

// ───────── generated data by teacher (L1) ─────────
function TeacherChart({ s, v }: { s: GameStateV2; v: DataPortfolioView }) {
  const job = s.player.dataPortfolio.synJob;
  const writer = job ? versionById(s, job.teacherId)?.name : v.defaultTeacher;
  const bars = s.player.dataPortfolio.assets
    .filter((a) => a.kind === 'synthetic' && a.tokensT > 0)
    .map((a) => {
      const o = a as { id: string; tokensT: number; quality: number; day?: number; teacherId?: string };
      const t = versionById(s, o.teacherId);
      return { id: o.id, name: t?.name ?? 'Earlier', base: t ? baseName(s, t.baseId) : '', day: t?.day ?? o.day ?? -1, tokensT: o.tokensT, quality: o.quality, since: o.day };
    })
    .sort((a, b) => a.day - b.day);
  const max = Math.max(1e-9, ...bars.map((b) => b.tokensT));
  const byBase = new Map<string, number[]>();
  for (const b of bars) if (b.base) byBase.set(b.base, [...(byBase.get(b.base) ?? []), b.quality]);
  const range = (xs: number[]) => { const lo = Math.min(...xs); const hi = Math.max(...xs); return Math.abs(hi - lo) < 0.005 ? F.num(lo, 2) : `${F.num(lo, 2)}–${F.num(hi, 2)}`; };
  return (
    <Card className="dv-teach" home="dataByTeacher" title={<span className="row-i"><Sparkles size={15} /><Term id="syntheticData">Generated data</Term>&nbsp;by teacher</span>} sub="tokens each model wrote · hatched: writing now"
      right={<Tip content={() => <TipCard title={<Term id="dataQuality">Quality by teacher</Term>} rows={[...byBase.entries()].map(([b, q]) => ({ label: `${b} teachers`, value: range(q) }))}>Each model's data is as good as its skill; newer bases write better data.</TipCard>}><span className="small dim" data-test="teacher-quality">{[...byBase.entries()].map(([b, q], i) => <span key={b}>{i ? ' · ' : ''}{b} teachers <b className="num">{range(q)}</b> <Term id="dataQuality">quality</Term></span>)}</span></Tip>}>
      {bars.length === 0 ? <div className="dim small">No generated data yet.</div> : (
        <div className="dv-tbars" data-test="teacher-bars">
          {bars.map((b) => {
            const now = b.name === writer;
            return (
              <Tip key={b.id} as="div" content={() => <TipCard title={b.name} value={tokT(b.tokensT)} rows={[{ label: <Term id="dataQuality">Quality</Term>, value: F.num(b.quality, 2) }, ...(b.since !== undefined ? [{ label: 'Since', value: fmtDate(dateOf(s, b.since)) }] : []), ...(now ? [{ label: 'Status', value: 'writing now' }] : [])]}>Tokens this model has written for training. Their quality follows the teacher&apos;s skill.</TipCard>}>
                <div className="dv-tcol" data-teacher={b.name}>
                  <span className="dv-tbar-wrap"><i className={`dv-tbar ${now ? 'now' : ''}`} style={{ height: `${Math.max(1, (b.tokensT / max) * 100)}%`, opacity: 0.45 + 0.55 * Math.min(1, b.quality / 0.8) }} /></span>
                  <span className="small dim ellip">{shortName(b.name, b.base)}</span>
                </div>
              </Tip>
            );
          })}
        </div>
      )}
    </Card>
  );
}
const baseName = (s: GameStateV2, id: string) => s.player.models.bases.find((b) => b.id === id)?.name ?? '';
/** "Atlas-2.6" → "2.6" (the axis keeps the full name on a base's first version). */
const shortName = (n: string, base: string) => (base && n.startsWith(`${base}.`) && !n.startsWith(`${base}.0`) ? n.slice(base.lastIndexOf('-') + 1) : n);

// ───────── sources (L1 list, L2 controls) ─────────
function Sources({ s, v, openLicence }: { s: GameStateV2; v: DataPortfolioView; openLicence: () => void }) {
  const row = (k: Src) => v.rows.find((r) => r.kind === k);
  const lic = v.pending.filter((p) => p.kind === 'licensed');
  const job = s.player.dataPortfolio.synJob;
  const writer = job ? versionById(s, job.teacherId) : undefined;
  const pools = poolsOf(s);
  const online = Object.values(pools).reduce((a, x) => a + x, 0);
  const genShare = online > 0 ? pools.synthetic / online : 0;
  const q = (k: Src) => { const r = row(k); return r && r.tokensT > 0 ? <> · <Term id="dataQuality">quality</Term> <Tip content={() => <TipCard title={<Term id="dataQuality">Quality</Term>} value={F.num(r.quality, 2)}>Token-weighted quality of this source; the public web is 1.</TipCard>}><span className="dv-q num">{F.num(r.quality, r.quality >= 1 ? 1 : 2)}</span></Tip></> : null; };
  const licAssets = s.player.dataPortfolio.assets.filter((a) => a.kind === 'licensed');
  const licWord = !licAssets.length ? 'none bought yet' : licAssets.every((a) => (a as { day?: number }).day === undefined) ? `bought before ${fmtDate(dateOf(s, 0)).replace(/ \d+,/, '')}` : `${licAssets.length} ${licAssets.length === 1 ? 'corpus' : 'corpora'} bought`;
  const lv = usageLevels(s);
  const cur = lv.find((l) => l.current);
  const teachers = s.player.models.versions.filter((x) => x.status !== 'retired' && x.status !== 'rolledBack' && x.build);
  return (
    <Card className="dv-srcs" home="dataSources" title={<span className="row-i"><Layers size={15} /><Term id="dataPortfolio">Sources</Term></span>} sub="what you own and what each adds">
      <SrcLine k="public" r={row('public')} sub={<><Tip content={() => <TipCard title={<Term id="publicWeb">Public web crawled</Term>} value={F.pct(v.crawl.coverage)} rows={[{ label: 'Web stock', value: tokT(v.crawl.stockT) }]}>Every lab reads the same finite web.</TipCard>}><span>{F.pct(v.crawl.coverage)}</span></Tip> of the public web crawled{q('public')}{v.crawl.licensed ? <> · <span className="tone-pos">licensed</span></> : null}</>}
        extra={<Tip as="div" content={() => <TipCard title={<Term id="publicWeb">Not crawled</Term>} value={tokT(Math.max(0, v.crawl.stockT * (1 - v.crawl.coverage)))}>Public web your crawl has not reached.</TipCard>}><div className="small dim">{tokT(Math.max(0, v.crawl.stockT * (1 - v.crawl.coverage)))} of the web not crawled</div></Tip>} />
      <SrcLine k="licensed" r={row('licensed')} sub={<>{licWord}{q('licensed')}</>}
        extra={<div className="row-i dv-sact"><button className="btn btn-sm" data-test="data-buy-licence" onClick={openLicence}><ShoppingCart size={13} />Buy a licence</button>
          <Tip content={() => <TipCard title="On the way" rows={lic.map((p) => ({ label: `${dn(p.domain)} ${p.label.toLowerCase()} ${tokT(p.tokensT)}`, value: fmtDate(dateOf(s, p.due)) }))}>Licensed data arrives on its due day.</TipCard>}><span className="small dim" data-test="data-pending">{lic.length ? `${lic.length} on the way` : 'none on the way'}</span></Tip></div>} />
      <SrcLine k="usage" r={row('usage')} sub={<>from your products&apos; conversations{q('usage')} · <Tip content={() => <TipCard title={<Term id="usageData">Usage data a day</Term>} value={`+${tokT(v.usagePerDayT)}`}>At today's traffic and your usage policy.</TipCard>}><b className="num">+{tokT(v.usagePerDayT)}</b></Tip> a day</>}
        extra={<div className="row-i dv-sact" data-test="usage-levels"><span className="small dim"><Term id="usageData">Usage policy</Term></span>
          <span className="seg">{lv.map((l) => l.current
            ? <Tip key={l.level} content={() => <TipCard title={l.label} rows={[{ label: 'Kept', value: F.pct(l.share) }, { label: 'A day', value: `+${tokT(l.perDayT)}` }]}>Your current policy.</TipCard>}><button className="seg-btn active" data-level={l.level}>{l.label}</button></Tip>
            : <span key={l.level} className="dv-useg" data-level={l.level}><ActBtn id="data.usagePolicy" testId={`data.usagePolicy.${l.level}`} params={{ level: l.level as UsageLevel }} label={l.label} /></span>)}</span>
          {lv.filter((l) => !l.current && cur && l.perDayT > cur.perDayT).map((l) => <span key={l.level} className="small dim">{l.label}: +{tokT(l.perDayT - (cur?.perDayT ?? 0))} a day</span>)}
        </div>} />
      <SrcLine k="synthetic" r={row('synthetic')} sub={<>written by your models{q('synthetic')} · <Tip content={() => <TipCard title={<Term id="syntheticData">Generated data a day</Term>} value={`+${tokT(v.synPerDayT)}`}>What data-generation compute writes a day with today's teacher.</TipCard>}><b className="num">+{tokT(v.synPerDayT)}</b></Tip> a day</>}
        extra={<div className="row-i dv-sact">
          <span className="small dim"><Term id="synJob">Teacher</Term></span>
          <Tip content={() => <TipCard title={<Term id="synJob">Teacher</Term>} value={writer?.name ?? v.defaultTeacher ?? '—'} rows={job ? [{ label: 'Until', value: fmtDate(dateOf(s, job.until)) }, { label: 'Share of data generation', value: F.pct(job.share) }] : []} footer="A model you pick writes for a year; your internal research model writes otherwise.">The model that writes your generated data. Stronger models write better data; bigger ones write fewer tokens per H100e-day.</TipCard>}>
            <span className="dv-tsel"><select className="chip-select" data-test="data-teacher" value={writer?.id ?? ''} onChange={(e) => { const id = e.target.value; store.act('data.synthesize', id ? { teacher: id, share: 1, days: 365 } : { days: 0 }); }}>
              <option value="">{v.defaultTeacher ?? 'default'} (default)</option>
              {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select></span>
          </Tip>
          <Tip content={() => <TipCard title={<Term id="poolSynthetic">Data generation</Term>} value={F.pct(genShare)}>Share of your compute that writes generated data. Set on LAB.</TipCard>}>
            <button className="dv-chip" data-test="data-to-lab" onClick={() => store.goto('lab')}><Term id="poolSynthetic">Data generation</Term>&nbsp;{F.pct(genShare)} of compute ▸ LAB</button>
          </Tip>
        </div>} />
      <SrcLine k="expert" r={row('expert')} sub={<>written by hired experts{q('expert')} · used in environments, not in pretraining</>}
        extra={<div className="dv-sact"><button className="dv-chip" data-test="data-to-env" onClick={() => store.goto('blueprint', { tab: 'suites' })}>Environments <ChevronRight size={11} /></button></div>} />
    </Card>
  );
}
function SrcLine({ k, r, sub, extra }: { k: Src; r?: DataPortfolioView['rows'][number]; sub: ReactNode; extra?: ReactNode }) {
  const I = SRC[k].icon;
  return (
    <div className="dv-src" data-src={k}>
      <span className="dv-sic" style={{ background: SRC[k].color }}><I size={16} /></span>
      <div className="dv-sbody">
        <div className="row-i"><b><Term id={SRC[k].term}>{SRC[k].label}</Term></b><span className="sp" /><Tip content={() => <TipCard title={SRC[k].label} value={tokT(r?.tokensT ?? 0)} rows={[{ label: <Term id="dataQuality">Quality</Term>, value: r && r.tokensT > 0 ? F.num(r.quality, 2) : '—' }]}>Tokens you hold from this source.</TipCard>}><b className="num dv-stok" data-test={`src-tokens.${k}`}>{tokT(r?.tokensT ?? 0)}</b></Tip></div>
        <div className="small dim">{sub}</div>
        {extra}
      </div>
    </div>
  );
}

// ───────── licence drawer (L2) ─────────
const AMOUNTS = [0.1, 0.25, 0.5, 1, 2, 5, 10, 20].filter((x) => x >= LICENCE_SIZE_T.min && x <= LICENCE_SIZE_T.max);
function LicenceDrawer({ s, dom, verdict, close }: { s: GameStateV2; dom: Record<DomainId, Record<Src, number>>; verdict?: { reads: number; short: boolean }; close: () => void }) {
  const [domain, setDomain] = useState<string>('CODE');
  const [tier, setTier] = useState<LicenceTier>('bulk');
  const [ai, setAi] = useState(Math.max(0, AMOUNTS.indexOf(10)));
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('.tip')) close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);
  const web = domain === 'web';
  const params: Params = web ? { domain: 'web' } : { domain, tier, tokensT: AMOUNTS[ai] };
  const f = licenceForm(s, params);
  const d = f.delta;
  const have = web ? 0 : STACK.reduce((a, k) => a + dom[domain as DomainId][k], 0);
  const sk = d ? d.s[1] - d.s[0] : 0;
  const rows: { k: string; label: ReactNode; a: ReactNode; b: ReactNode; tip: string }[] = web ? [
    { k: 'cost', label: 'Cost', a: '—', b: F.money(f.cashB), tip: '$1B plus a fee per crawled token not yet licensed.' },
    { k: 'unlicensed', label: 'Unlicensed tokens', a: tokT(f.unlicensedT), b: '0', tip: 'Ends the copyright-suit hazard on your crawl; the Creatives bloc approves.' },
  ] : [
    { k: 'cost', label: 'Cost', a: '—', b: F.money(f.cashB), tip: 'Paid at signing.' },
    { k: 'arrives', label: 'Arrives', a: '', b: <>{fmtDate(dateOf(s, s.time.day + f.days))} <span className="dim">({f.days} d)</span></>, tip: 'Licensed data joins your data on its due day.' },
    { k: 'tokens', label: <>{dn(f.domain)} tokens</>, a: tokT(have), b: tokT(have + f.tokensT), tip: `Tokens you own in ${dn(f.domain)}.` },
    ...(d ? [
      { k: 'share', label: <>{dn(f.domain)} share of your data</>, a: F.pct(d.share[0], 1), b: F.pct(d.share[1], 1), tip: 'Quality-weighted share of your pretraining data.' },
      { k: 'skill', label: <>{dn(f.domain)} skill of a new base</>, a: '—', b: sk > 0.005 ? <span className="tone-pos">▲ {sk > 0.05 ? 'some' : 'small'}</span> : <span className="dim">no change</span>, tip: 'A new base drawing your own mix specialises more in this domain.' },
    ] : []),
  ];
  const doms = ['web', ...DOMAIN_IDS] as string[];
  return (
    <>
      <div className="pf-scrim" onClick={close} />
      <aside className="pf-drawer dv-drawer" data-test="licence-drawer">
        <div className="pf-dh"><BookOpen size={18} className="dim" /><h2>Buy a licence</h2><span className="sp" /><button className="btn btn-sm btn-ghost" aria-label="Close" data-test="drawer-close" onClick={close}><X size={16} /></button></div>
        <div className="pf-sec"><div className="cap"><Term id="domains">Domain</Term></div>
          <div className="dv-pills" data-test="lic-domain">{doms.map((x) => <button key={x} className={`dv-pill ${x === domain ? 'on' : ''}`} data-opt={x} onClick={() => setDomain(x)}>{x === 'web' ? 'Web crawl' : dn(x)}</button>)}</div>
        </div>
        {!web && <>
          <div className="pf-sec"><div className="cap"><Term id="licenceTier">Kind</Term></div>
            <div className="dv-kinds" data-test="lic-tier">{(Object.keys(LICENCE_TIERS) as LicenceTier[]).map((t) => (
              <Tip key={t} as="div" content={() => <TipCard title={<Term id="licenceTier">{LICENCE_TIERS[t].label}</Term>} rows={[{ label: <Term id="dataQuality">Quality</Term>, value: String(LICENCE_TIERS[t].quality) }, { label: 'Price', value: `$${LICENCE_TIERS[t].priceBPerT}B per T tokens` }]}>Higher quality counts for more in what a base learns, and repeats sooner.</TipCard>}>
                <button className={`dv-kind ${t === tier ? 'on' : ''}`} data-opt={t} onClick={() => setTier(t)}><b>{LICENCE_TIERS[t].label}</b><span><Term id="dataQuality">quality</Term> <b className="num">{F.num(LICENCE_TIERS[t].quality, 1)}</b></span><span className="dim">${LICENCE_TIERS[t].priceBPerT}B per T</span></button>
              </Tip>
            ))}</div>
          </div>
          <div className="pf-sec"><div className="row-i"><span className="cap">Amount</span><span className="sp" /><b className="num" data-test="lic-amount">{tokT(AMOUNTS[ai])}</b></div>
            <input type="range" className="dv-range" min={0} max={AMOUNTS.length - 1} step={1} value={ai} data-test="lic-size" onChange={(e) => setAi(Number(e.target.value))} />
            <div className="row-i small dim"><span>{tokT(AMOUNTS[0])}</span><span className="sp" /><span>{tokT(AMOUNTS[AMOUNTS.length - 1])}</span></div>
          </div>
        </>}
        <div className="pf-sec"><div className="cap">Before → after</div>
          <div className="dv-ba" data-test="delta-licence">{rows.map((r) => (
            <Tip key={r.k} as="div" content={() => <TipCard title={r.label}>{r.tip}</TipCard>}>
              <div className="dv-barow" data-k={r.k}><span>{r.label}</span><span className="num">{r.a}</span><span className="dim">{r.a === '' ? '' : '→'}</span><b className="num">{r.b}</b></div>
            </Tip>
          ))}</div>
        </div>
        {!web && <div className="dv-note small" data-test="lic-note"><Info size={13} />A base launched before it arrives won&apos;t read it.{verdict ? <> Your data is {verdict.short ? '' : 'not '}short: <Tip content={() => <TipCard title={<Term id="dataTokens">Reads per token</Term>} value={F.num(verdict.reads, 2)}>Of the next new base (Enough for the next run?).</TipCard>}><b className="num">{F.num(verdict.reads, 2)}</b></Tip> reads per token.</> : null}</div>}
        <span className="sp" />
        <div className="row-i dv-dfoot"><span className="sp" /><button className="btn btn-sm" onClick={close}>Cancel</button><ActBtn id="data.license" params={params} primary label={web ? `License the crawl for ${F.money(f.cashB)}` : `Buy for ${F.money(f.cashB)}`} reason onDone={close} /></div>
      </aside>
    </>
  );
}
