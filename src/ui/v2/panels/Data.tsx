// Models › Data (model v3 D4; design/notes/D4.md): the lab's data portfolio and the four data actions.
// Home of: the portfolio by kind (tokens, quality, unique tokens U, domain mix, today's flows, pending deliveries), the
// natural mix against the reference shares, and the licence / generation / expert / usage-policy forms with their cost
// and before → after in token units. L1: the portfolio table with its U bars and domain heat strip, and the natural-mix
// bars. L2: the four forms. L3: tooltips. The Blueprint shows what one base draws (its drawn mix, specialisation and
// repetition) and links here; each suite's expert data lives on Models › Suites (link only).
import { useMemo, useState, type ReactNode } from 'react';
import { BookOpen, Database, Globe, GraduationCap, MessagesSquare, Sparkles, type LucideIcon } from 'lucide-react';
import { DOMAIN_IDS } from '../../../data/v2/calibration';
import { LICENCE_TIERS, type LicenceTier, type UsageLevel } from '../../../data/v2/dataAssets';
import { SPEC_CAP } from '../../../data/v2/dataAssets';
import {
  dataPortfolioView, dateOf, fmtDate, licenceForm, naturalMixView, synForm, teacherRows, usageLevels,
  type DataDelta, type DataPortfolioView, type DomainMixRow, type KindRow,
} from '../../../engine/v2';
import type { GameStateV2 } from '../../../engine/v2';
import { store } from '../store';
import { ActBtn, Term, Tip, TipCard, type Params } from '../ui';
import { Card, DOMAIN_WORD, effMult, effX, HBar, Ref } from '../kit';
import * as F from '../fmt';
import { DOMAIN_ICON } from '../icons';
import { C, seq } from '../theme';
import './data.css';

type Kind = KindRow['kind'];
const KIND: Record<Kind, { label: string; term: string; icon: LucideIcon }> = {
  public: { label: 'Public web', term: 'publicWeb', icon: Globe },
  licensed: { label: 'Licensed', term: 'licensedData', icon: BookOpen },
  usage: { label: 'Usage', term: 'usageData', icon: MessagesSquare },
  synthetic: { label: 'Synthetic', term: 'syntheticData', icon: Sparkles },
  expert: { label: 'Expert', term: 'expertData', icon: GraduationCap },
};
const DOM_NAME = DOMAIN_WORD;

/** Tokens given in trillions: 310T, 7.5T, 50B, 2.0B, 400M. */
export const tokT = (t: number) => {
  const a = Math.abs(t);
  if (a >= 100) return `${t.toFixed(0)}T`;
  if (a >= 1) return `${t.toFixed(1)}T`;
  if (a >= 0.001) return `${+(t * 1000).toFixed(a >= 0.1 ? 0 : 1)}B`;
  if (a === 0) return '0';
  return `${Math.round(t * 1e6)}M`;
};
/** UB-4: domain display name, never the code. */
const dn = (d?: string) => (d ? DOM_NAME[d] ?? d : '');
const perDay = (t: number) => `${tokT(t)}/day`;

export function DataView({ s }: { s: GameStateV2 }) {
  const key = `${s.time.day}|${s.player.finance.cash.toFixed(3)}|${JSON.stringify(s.player.dataPortfolio)}`;
  const d = useMemo(() => ({ v: dataPortfolioView(s), nat: naturalMixView(s) }), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="dv" data-test="data-view">
      <div className="dv-top">
        <Portfolio s={s} v={d.v} />
        <NaturalMix rows={d.nat} />
      </div>
      <div className="dv-acts">
        <div className="dv-col"><LicenceCard s={s} /></div>
        <div className="dv-col"><SynCard s={s} /><UsageCard s={s} /></div>
      </div>
    </div>
  );
}

// ───────── portfolio (L1) ─────────
function Portfolio({ s, v }: { s: GameStateV2; v: DataPortfolioView }) {
  const maxU = Math.max(1e-9, ...v.rows.filter((r) => r.kind !== 'expert').map((r) => r.weightedT));
  const uTip = () => (
    <TipCard title={<Term id="uniqueTokens">Unique tokens</Term>} value={tokT(v.uT)} rows={[
      ...v.rows.filter((r) => r.kind !== 'expert').map((r) => ({ label: <>{KIND[r.kind].label}: {tokT(r.tokensT)} at quality {r.quality.toFixed(2)}</>, value: tokT(r.weightedT) })),
      { label: 'Pretraining tokens', value: tokT(v.tokensT) },
    ]} footer="Expert data is not pretraining data (it lives in the post-training environments).">Pretraining tokens weighted by their [[dataQuality|quality]], over every kind.</TipCard>
  );
  return (
    <Card title={<span className="row-i"><Database size={15} /><Term id="dataPortfolio">Data portfolio</Term></span>} home="dataPortfolio" className="dv-port"
      right={<Tip content={uTip}><span className="dv-hero" data-test="data-u"><span className="k"><Term id="uniqueTokens">Unique</Term></span><b className="num">{tokT(v.uT)}</b><span className="dim small">of {tokT(v.tokensT)} tokens</span></span></Tip>}>
      <div className="dv-grid">
        <span className="ch">Kind</span>
        <span className="ch r">Tokens</span>
        <span className="ch r"><Term id="dataQuality">Quality</Term></span>
        <span className="ch"><Term id="uniqueTokens">Unique tokens</Term> (quality-weighted)</span>
        <span className="ch dv-doms">{DOMAIN_IDS.map((dm) => { const I = DOMAIN_ICON[dm]; return <Tip key={dm} content={() => <TipCard title={<Term id="domains">{dn(dm)}</Term>}>{dn(dm)} data. Each cell is the kind&apos;s share of its quality-weighted tokens in this domain.</TipCard>}><I size={12} /></Tip>; })}</span>
        <span className="ch">Today</span>
        {v.rows.map((r) => <KindLine key={r.kind} s={s} r={r} v={v} maxU={maxU} />)}
      </div>
      <div className="dv-pend" data-test="data-pending">
        <span className="tip-cap"><Term id="pendingData">Pending</Term></span>
        {v.pending.length ? v.pending.map((p, i) => {
          const I = p.domain ? DOMAIN_ICON[p.domain] : Database;
          return (
            <Tip key={i} content={() => <TipCard title={<Term id={p.kind === 'expert' ? 'expertData' : 'licensedData'}>{p.label}</Term>} value={tokT(p.tokensT)} rows={[
              { label: 'Domain', value: p.domain ? dn(p.domain) : 'mixed' }, { label: <Term id="dataQuality">Quality</Term>, value: p.quality.toFixed(1) },
              { label: 'Arrives', value: `${fmtDate(dateOf(s, p.due))} (in ${F.days(Math.max(0, p.due - s.time.day))})` },
              ...(p.kind === 'expert' ? [] : [{ label: <Term id="uniqueTokens">Unique tokens</Term>, value: `+${tokT(p.quality * p.tokensT)}` }]),
            ]}>Paid at signing; joins the portfolio on the due day.</TipCard>}>
              <span className="dch" data-pending={p.kind}><I size={11} /><span className="k">{dn(p.domain)} {p.kind === 'expert' ? 'expert' : p.label.toLowerCase()}</span><b>{tokT(p.tokensT)}</b><span className="k">in {F.days(Math.max(0, p.due - s.time.day))}</span></span>
            </Tip>
          );
        }) : <span className="dim small">no deliveries due</span>}
      </div>
    </Card>
  );
}

function KindLine({ s, r, v, maxU }: { s: GameStateV2; r: KindRow; v: DataPortfolioView; maxU: number }) {
  const k = KIND[r.kind];
  const pre = r.kind !== 'expert';
  const job = s.player.dataPortfolio.synJob;
  const today: ReactNode = (() => {
    switch (r.kind) {
      case 'public': return (
        <Tip content={() => <TipCard title={<Term id="publicWeb">Public web</Term>} value={`${F.pct(v.crawl.coverage)} of ${tokT(v.crawl.stockT)}`} rows={[
          { label: 'Your crawl', value: tokT(r.tokensT) }, { label: 'Licensed', value: v.crawl.licensed ? 'yes' : 'no' },
          ...(v.crawl.licensed ? [] : [{ label: 'Unlicensed tokens', value: tokT(v.crawl.unlicensedT), tone: 'neg' as const }]),
        ]} footer="Licensing the crawl (License data › Web crawl) ends the copyright-suit hazard but adds no tokens.">Every lab reads the same finite stock.</TipCard>}>
          <span className="small">{F.pct(v.crawl.coverage)} crawled · {v.crawl.licensed ? <span className="tone-pos">licensed</span> : <span className="tone-warn">unlicensed</span>}</span>
        </Tip>
      );
      case 'licensed': {
        const n = v.pending.filter((p) => p.kind === 'licensed').length;
        return <Tip content={() => <TipCard title={<Term id="licensedData">Licensed data</Term>} rows={[{ label: 'Corpora held', value: String(r.assets) }, { label: <Term id="pendingData">Deals pending</Term>, value: String(n) }]}>One asset per domain and [[licenceTier|tier]]; repeat deals add to it.</TipCard>}><span className="small">{r.assets} {r.assets === 1 ? 'corpus' : 'corpora'}{n ? ` · ${n} pending` : ''}</span></Tip>;
      }
      case 'usage': return (
        <Tip content={() => <TipCard title={<Term id="usageData">Usage data</Term>} value={perDay(v.usagePerDayT)} rows={[{ label: 'Policy', value: v.usageLevel }]} footer="Consumer chats only; set on the usage-data policy below.">Output of your live consumer products × the share your policy keeps.</TipCard>}>
          <span className="small">+{perDay(v.usagePerDayT)} · {v.usageLevel}</span>
        </Tip>
      );
      case 'synthetic': return (
        <Tip content={() => <TipCard title={<Term id="syntheticData">Synthetic data</Term>} value={perDay(v.synPerDayT)} rows={[
          { label: <Term id="poolSynthetic">Data generation</Term>, value: `${F.count(v.synPoolH100e)} H100e` },
          { label: 'Default teacher', value: v.defaultTeacher ?? '–' },
          ...(job ? [{ label: <Term id="synJob">Job</Term>, value: `${F.pct(job.share)} of data generation until ${fmtDate(dateOf(s, job.until))}` }] : []),
        ]} footer="Its compute is set on Compute allocation; the teacher on Generate data below.">Tokens kept per day from data-generation compute. A teacher writes most in the domains it is strongest at.</TipCard>}>
          <span className="small">+{perDay(v.synPerDayT)}{job ? ' · job' : ''}{v.synMixLine ? <span className="dim" data-test="syn-mix"> · {v.synMixLine}</span> : null}</span>
        </Tip>
      );
      case 'expert': {
        return (
          <span className="row-i small">
            <Tip content={() => <TipCard title={<Term id="expertData">Expert data</Term>} rows={[
              { label: 'Built into environments', value: tokT(v.expertInSuitesT) },
            ]} footer="Each family's expert data and realism: Training › Environments.">Not pretraining data. Bought only by expanding environments.</TipCard>}>
              <span>{tokT(v.expertInSuitesT)} in environments</span>
            </Tip>
            <Ref id="expertData" to={{ panel: 'blueprint', tab: 'suites' }}>Environments</Ref>
          </span>
        );
      }
    }
  })();
  return (
    <div className="dv-line" data-kind={r.kind}>
      <span className="dv-kind"><k.icon size={13} /><Term id={k.term}>{k.label}</Term></span>
      <Tip content={() => <TipCard title={<Term id={k.term}>{k.label}</Term>} value={tokT(r.tokensT)} rows={[{ label: 'Assets', value: String(r.assets) }]}>Tokens held (trillions).</TipCard>}><span className="num r">{tokT(r.tokensT)}</span></Tip>
      <Tip content={() => <TipCard title={<Term id="dataQuality">Quality</Term>} value={r.tokensT > 0 ? r.quality.toFixed(2) : '–'}>Token-weighted mean quality of this kind (web = 1).</TipCard>}><span className="num r">{r.tokensT > 0 ? r.quality.toFixed(2) : '–'}</span></Tip>
      {pre ? (
        <Tip content={() => <TipCard title={<Term id="uniqueTokens">Unique tokens from {k.label.toLowerCase()}</Term>} value={tokT(r.weightedT)} rows={[{ label: 'Share of unique tokens', value: F.pct(r.weightedT / Math.max(1e-9, v.uT)) }]}>Quality × tokens.</TipCard>}>
          <span className="dv-u"><HBar v={r.weightedT} max={maxU} w={110} h={8} color={C.und} /><b className="num">{tokT(r.weightedT)}</b></span>
        </Tip>
      ) : <Tip content={() => <TipCard title={<Term id="expertData">Expert data</Term>}>Not pretraining data: it does not count toward unique tokens.</TipCard>}><span className="dim small">not pretraining data</span></Tip>}
      <span className="dv-doms">{DOMAIN_IDS.map((dm) => {
        const x = r.mix[dm] ?? 0;
        return (
          <Tip key={dm} content={() => <TipCard title={<>{k.label} · <Term id="domains">{dm}</Term></>} value={F.pct(x, 1)}>{`Share of this kind's quality-weighted tokens in ${DOM_NAME[dm]}.`}</TipCard>}>
            <i className="dv-cell" style={{ background: x > 0 ? seq(Math.min(1, Math.sqrt(x / 0.6))) : 'transparent' }} />
          </Tip>
        );
      })}</span>
      {today}
    </div>
  );
}

// ───────── natural mix vs reference (L1) ─────────
function NaturalMix({ rows }: { rows: DomainMixRow[] }) {
  const f = (x: number) => `${(Math.min(SPEC_CAP, Math.abs(x)) / SPEC_CAP) * 50}%`;
  return (
    <Card title={<Term id="naturalMix">Natural mix</Term>} sub={<>vs <Term id="refShare">reference shares</Term></>} home="naturalMix" className="dv-nat"
      right={<button className="btn btn-sm btn-ghost" data-go="blueprint" onClick={() => store.goto('blueprint', { tab: 'next' })}>Next run ›</button>}>
      <div className="dv-natgrid" data-test="data-natural">
        <span className="ch">Domain</span><span className="ch c"><Term id="dataSpec">Specialisation</Term> (effective compute in the domain)</span><span className="ch r">Share / standard</span>
        {rows.map((r) => {
          const I = DOMAIN_ICON[r.domain];
          const tip = () => (
            <TipCard title={<><Term id="naturalMix">Natural mix</Term> · {dn(r.domain)}</>} value={effX(r.s)} rows={[
              { label: 'Share of your stock', value: F.pct(r.share, 1) }, { label: <Term id="refShare">Reference share</Term>, value: F.pct(r.ref, 1) },
              { label: <Term id="dataSpec">Specialisation</Term>, value: `${effX(r.s)}${Math.abs(r.s) >= SPEC_CAP - 1e-6 ? ' (cap)' : ''}` },
            ]} footer="A Balanced base model draws the standard shares; a Natural one draws these.">{`A domain with ten times the standard share gets ${effX(1.5)} effective compute in it, at most ${effX(SPEC_CAP)}.`}</TipCard>
          );
          return (
            <Tip key={r.domain} as="div" content={tip}>
              <div className="dv-natline" data-dom={r.domain}>
                <span className="row-i small"><I size={12} />{dn(r.domain)}</span>
                <span className="dv-div"><i className="mid" />{Math.abs(r.s) > 0.005 && <i className={`bar ${r.s > 0 ? 'pos' : 'neg'}`} style={r.s > 0 ? { left: '50%', width: f(r.s) } : { right: '50%', width: f(r.s) }} />}</span>
                <span className="num small r">{F.pct(r.share, 1)} <span className="dim">/ {F.pct(r.ref, 1)}</span></span>
              </div>
            </Tip>
          );
        })}
      </div>
    </Card>
  );
}

// ───────── before → after (token units) ─────────
function DeltaRows({ d, what }: { d: DataDelta; what: string }) {
  const pc = (x: number) => F.pct(x, 1);
  const rows: { k: string; raw: [number, number]; label: ReactNode; a: string; b: string; tip: string; ch: boolean; neg?: boolean }[] = [
    { k: 'u', raw: d.u, label: <Term id="uniqueTokens">Unique tokens</Term>, a: tokT(d.u[0]), b: tokT(d.u[1]), tip: 'Quality-weighted unique tokens of the portfolio.', ch: Math.abs(d.u[1] - d.u[0]) > 1e-6 },
    { k: 'share', raw: d.share, label: <>{dn(d.domain)} share of stock</>, a: pc(d.share[0]), b: pc(d.share[1]), tip: `${dn(d.domain)}'s share of the natural mix.`, ch: Math.abs(d.share[1] - d.share[0]) > 5e-5 },
    { k: 's', raw: d.s, label: <>{dn(d.domain)} <Term id="dataSpec">specialisation</Term> (natural)</>, a: effX(d.s[0]), b: effX(d.s[1]), tip: 'Effective compute in this domain a Natural-mix base model of your latest size would get.', ch: Math.abs(d.s[1] - d.s[0]) > 5e-3 },
    { k: 'epochs', raw: d.epochs, label: <>Latest base model <Term id="dataTokens">re-reads</Term></>, a: `×${d.epochs[0].toFixed(2)}`, b: `×${d.epochs[1].toFixed(2)}`, tip: 'How often a base model like your latest one re-reads its most-repeated data, with its data mix.', ch: Math.abs(d.epochs[1] - d.epochs[0]) > 5e-3 },
    // model v3 D11 (M3): the quality of the drawn tokens is a G term; data below the draw's mean quality dilutes it.
    { k: 'qG', raw: d.qG, label: <>Latest base model <Term id="dataQuality">data quality</Term></>, a: effX(d.qG[0]), b: effX(d.qG[1]), tip: 'Effective compute the quality of its data gives a base model like your latest one, against the 2025 standard. Data worse than what it already draws lowers it.', ch: Math.abs(d.qG[1] - d.qG[0]) > 5e-4, neg: d.qG[1] < d.qG[0] - 5e-4 },
  ];
  return (
    <div className="dv-delta" data-test={`delta-${what}`}>
      {rows.map((r, i) => (
        <Tip key={i} as="div" content={() => <TipCard title={r.label} value={`${r.a} → ${r.b}`}>{r.tip}</TipCard>}>
          <div className="dv-drow" data-k={r.k} data-a={r.raw[0]} data-b={r.raw[1]}><span className="small">{r.label}</span><span className="num small dim">{r.a}</span><span className="dim">→</span><span className={`num small ${r.neg ? 'tone-neg' : r.ch ? 'tone-pos' : 'dim'}`}>{r.b}</span></div>
        </Tip>
      ))}
    </div>
  );
}

/** A row of pill buttons with a tooltip each. */
function Pills<T extends string | number>({ value, opts, onPick, test }: { value: T; opts: { v: T; label: ReactNode; tip: () => ReactNode }[]; onPick: (v: T) => void; test: string }) {
  return (
    <span className="seg dv-pills" data-test={test}>
      {opts.map((o) => <Tip key={String(o.v)} content={o.tip}><button className={`seg-btn ${o.v === value ? 'active' : ''}`} data-opt={String(o.v)} onClick={() => onPick(o.v)}>{o.label}</button></Tip>)}
    </span>
  );
}
function DomainPills({ value, onPick, test, web }: { value: string; onPick: (d: string) => void; test: string; web?: boolean }) {
  const opts = [
    ...(web ? [{ v: 'web', label: <><Globe size={11} />Web crawl</>, tip: () => <TipCard title={<Term id="publicWeb">Web crawl</Term>}>License the crawled public web: no tokens, ends copyright suits over it.</TipCard> }] : []),
    ...DOMAIN_IDS.map((d) => { const I = DOMAIN_ICON[d]; return { v: d as string, label: <><I size={11} />{dn(d)}</>, tip: () => <TipCard title={<Term id="domains">{dn(d)}</Term>}>Data in {dn(d)}.</TipCard> }; }),
  ];
  return <Pills value={value} opts={opts} onPick={onPick} test={test} />;
}
function FormRow({ label, children }: { label: ReactNode; children: ReactNode }) {
  return <div className="dv-frow"><span className="dv-flab small dim">{label}</span><span className="dv-fctl">{children}</span></div>;
}

// ───────── licence ─────────
const SIZE_MULT = [0.2, 1, 4];
function LicenceCard({ s }: { s: GameStateV2 }) {
  const [dom, setDom] = useState<string>('PHYS');
  const [tier, setTier] = useState<LicenceTier>('bulk');
  const [mi, setMi] = useState(1);
  const sizes = SIZE_MULT.map((m) => +(LICENCE_TIERS[tier].defaultT * m).toPrecision(2));
  const params: Params = dom === 'web' ? { domain: 'web' } : { domain: dom, tier, tokensT: sizes[mi] };
  const f = licenceForm(s, params);
  return (
    <Card title={<span className="row-i"><BookOpen size={14} /><Term id="dataLicence">License data</Term></span>} home="dataLicenceForm" className="dv-form" sub={<Term id="pendingData">delivered in {f.days} d</Term>}>
      <FormRow label={<Term id="domains">Domain</Term>}><DomainPills value={dom} onPick={setDom} test="lic-domain" web /></FormRow>
      {dom !== 'web' && <>
        <FormRow label={<Term id="licenceTier">Tier</Term>}>
          <Pills value={tier} test="lic-tier" onPick={setTier} opts={(Object.keys(LICENCE_TIERS) as LicenceTier[]).map((t) => ({
            v: t, label: <>{LICENCE_TIERS[t].label} <span className="dim">quality {LICENCE_TIERS[t].quality} · ${LICENCE_TIERS[t].priceBPerT}B/T</span></>,
            tip: () => <TipCard title={<Term id="licenceTier">{LICENCE_TIERS[t].label}</Term>} rows={[{ label: <Term id="dataQuality">Quality</Term>, value: String(LICENCE_TIERS[t].quality) }, { label: 'Price', value: `$${LICENCE_TIERS[t].priceBPerT}B per T tokens` }]}>Quality multiplies the tokens it adds to your unique tokens.</TipCard>,
          }))} />
        </FormRow>
        <FormRow label="Size"><Pills value={mi} test="lic-size" onPick={setMi} opts={sizes.map((t, i) => ({ v: i, label: tokT(t), tip: () => <TipCard title={`${tokT(t)} tokens`} value={F.money(t * LICENCE_TIERS[tier].priceBPerT)}>Tokens × the tier&apos;s price.</TipCard> }))} /></FormRow>
      </>}
      <div className="dv-sum">
        {f.web ? (
          <Tip content={() => <TipCard title={<Term id="publicWeb">Licence on the crawl</Term>} value={F.money(f.cashB)} rows={[{ label: 'Unlicensed tokens', value: tokT(f.unlicensedT) }]} footer="$1B + $0.005B per unlicensed T.">Adds no tokens. Ends the copyright-suit hazard; the Creatives bloc approves (+10).</TipCard>}>
            <span className="small">{F.money(f.cashB)} · {f.licensed ? 'already licensed' : <>{tokT(f.unlicensedT)} unlicensed → 0 · copyright suits end</>}</span>
          </Tip>
        ) : (
          <>
            <Tip content={() => <TipCard title="Cost" value={F.money(f.cashB)} rows={[{ label: 'Tokens', value: tokT(f.tokensT) }, { label: 'Price', value: `$${f.priceBPerT}B/T` }]}>Paid at signing; delivered in {f.days} days.</TipCard>}>
              <span className="small" data-test="lic-sum" data-cash={f.cashB} data-tokens={f.tokensT} data-q={f.quality}><b className="num">{F.money(f.cashB)}</b> for {tokT(f.tokensT)} {dn(f.domain)} at quality {f.quality}</span>
            </Tip>
            {f.delta && <DeltaRows d={f.delta} what="licence" />}
          </>
        )}
      </div>
      <div className="dv-go"><ActBtn id="data.license" params={params} primary label={f.web ? 'License the crawl' : 'Sign licence'} reason /></div>
    </Card>
  );
}

// ───────── generation ─────────
const SHARES = [0.25, 0.5, 1];
const DAYS = [30, 90, 180, 365];
function SynCard({ s }: { s: GameStateV2 }) {
  const rows = teacherRows(s);
  const best = rows.reduce<string | undefined>((a, r) => (!a || r.weightedPerH100eDay > (rows.find((x) => x.id === a)?.weightedPerH100eDay ?? 0) ? r.id : a), undefined);
  const strongest = rows.reduce<string | undefined>((a, r) => (!a || r.g > (rows.find((x) => x.id === a)?.g ?? -1) ? r.id : a), undefined);
  const [teacher, setTeacher] = useState<string>('');
  const [share, setShare] = useState(1);
  const [days, setDays] = useState(90);
  const t = teacher && rows.some((r) => r.id === teacher) ? teacher : strongest ?? '';
  const params: Params = { teacher: t, share, days };
  const f = synForm(s, params);
  const maxY = Math.max(1e-9, ...rows.map((r) => r.weightedPerH100eDay));
  // The strongest five, plus the default and the best-yield teacher (the trade the table is for) and the picked one.
  const top = [...rows].sort((a, b) => b.g - a.g).slice(0, 5).map((r) => r.id);
  const gDef = rows.find((r) => r.isDefault)?.g ?? rows[0]?.g ?? 0;
  const shown = rows.filter((r) => top.includes(r.id) || r.isDefault || r.id === best || r.id === t).sort((a, b) => b.g - a.g);
  return (
    <Card title={<span className="row-i"><Sparkles size={14} /><Term id="synJob">Generate data</Term></span>} home="synJobForm" className="dv-form"
      sub={f.job ? <Tip content={() => <TipCard title={<Term id="synJob">Running job</Term>} rows={[{ label: 'Teacher', value: rows.find((r) => r.id === f.job!.teacher)?.name ?? f.job!.teacher }, { label: 'Share of data generation', value: F.pct(f.job!.share) }, { label: 'Until', value: fmtDate(dateOf(s, f.job!.until)) }]}>The rest of data generation keeps the default teacher.</TipCard>}><span data-test="syn-job">job: {rows.find((r) => r.id === f.job!.teacher)?.name ?? f.job.teacher} · {F.pct(f.job.share)} until {fmtDate(dateOf(s, f.job.until))}</span></Tip> : 'no job: data generation uses the default teacher'}
      right={f.job ? <ActBtn id="data.synthesize" testId="data.synthesize.stop" params={{ days: 0 }} label="Stop job" /> : undefined}>
      <div className="dv-teach" data-test="syn-teachers">
        <span className="ch">Teacher</span><span className="ch r"><Term id="effCompute">Effective compute</Term></span><span className="ch r"><Term id="dataQuality">Quality</Term></span><span className="ch r">tokens / H100e-day</span><span className="ch"><Term id="teacherYield">Yield</Term> (quality-weighted)</span>
        {shown.map((r) => (
          <Tip key={r.id} as="div" content={() => <TipCard title={r.name} value={`${F.short(r.weightedPerH100eDay / 1e6)}M quality-weighted tokens / H100e-day`} rows={[
            { label: <><Term id="effCompute">Effective compute</Term> vs the default teacher</>, value: effMult(r.g - gDef) }, { label: <Term id="dataQuality">Quality</Term>, value: r.quality.toFixed(2) },
            { label: 'Kept tokens per H100e-day', value: `${F.short(r.tokensPerH100eDay / 1e6)}M` },
          ]} footer={r.isDefault ? 'The default teacher (your internal research model).' : undefined}>Bigger teachers write fewer tokens per H100e-day; stronger ones write better tokens.</TipCard>}>
            <button className={`dv-trow ${r.id === t ? 'on' : ''}`} data-teacher={r.id} onClick={() => setTeacher(r.id)}>
              <span className="ellip">{r.name}{r.isDefault && <span className="tag2">default</span>}{r.id === best && <span className="tag2 good">best yield</span>}</span>
              <span className="num r">{effMult(r.g - gDef)}</span><span className="num r">{r.quality.toFixed(2)}</span><span className="num r">{F.short(r.tokensPerH100eDay / 1e6)}M</span>
              <span className="dv-u"><HBar v={r.weightedPerH100eDay} max={maxY} w={90} h={7} color={r.id === best ? C.good : C.und} /><b className="num">{F.short(r.weightedPerH100eDay / 1e6)}M</b></span>
            </button>
          </Tip>
        ))}
      </div>
      <FormRow label="Share"><Pills value={share} test="syn-share" onPick={setShare} opts={SHARES.map((x) => ({ v: x, label: F.pct(x), tip: () => <TipCard title={<Term id="poolSynthetic">Share of data generation</Term>} value={F.pct(x)}>The rest keeps the default teacher.</TipCard> }))} /></FormRow>
      <FormRow label="Days"><Pills value={days} test="syn-days" onPick={setDays} opts={DAYS.map((x) => ({ v: x, label: `${x} d`, tip: () => <TipCard title="Job length" value={F.days(x)}>The job ends after this; data generation goes back to the default teacher.</TipCard> }))} /></FormRow>
      <div className="dv-sum">
        <Tip content={() => <TipCard title="What the job makes" rows={[
          { label: 'Compute', value: `${F.short(f.h100eDays / 1e6)}M H100e-days` },
          { label: `${f.teacherName ?? '–'}`, value: `${tokT(f.tokensT)} at quality ${f.quality.toFixed(2)} → unique +${tokT(f.delta.u[1] - f.delta.u[0])}` },
          { label: `Default (${f.defaultName ?? '–'})`, value: `${tokT(f.defaultTokensT)} at quality ${f.defaultQuality.toFixed(2)} → unique +${tokT(f.defaultDelta.u[1] - f.defaultDelta.u[0])}` },
        ]} footer="The compute is data generation's, already paid for; the cost is what the default teacher would have made.">The data carries its teacher&apos;s traits into base models trained on it.</TipCard>}>
          <span className="small" data-test="syn-sum" data-tokens={f.tokensT} data-days={f.days} data-share={f.share} data-teacher={f.teacher}><b className="num">{F.short(f.h100eDays / 1e6)}M</b> H100e-days → {tokT(f.tokensT)} at quality {f.quality.toFixed(2)} <span className="dim">(default: unique +{tokT(f.defaultDelta.u[1] - f.defaultDelta.u[0])})</span></span>
        </Tip>
        <DeltaRows d={f.delta} what="syn" />
      </div>
      <div className="dv-go"><ActBtn id="data.synthesize" params={params} primary label={f.job ? 'Replace job' : 'Start job'} reason /></div>
    </Card>
  );
}

// ───────── usage policy ─────────
function UsageCard({ s }: { s: GameStateV2 }) {
  const lv = usageLevels(s);
  return (
    <Card title={<span className="row-i"><MessagesSquare size={14} /><Term id="usageData">Usage-data policy</Term></span>} home="usagePolicy" className="dv-form" sub="consumer chats only">
      <div className="dv-usage" data-test="usage-levels">
        {lv.map((l) => (
          <div key={l.level} className={`dv-ulevel ${l.current ? 'on' : ''}`} data-level={l.level} data-civlib={l.civlib} data-share={l.share}>
            <b className="small">{l.label}</b>
            <Tip content={() => <TipCard title="Kept for training" value={F.pct(l.share)}>Share of eligible consumer output tokens kept.</TipCard>}><span className="num">{F.pct(l.share)} kept</span></Tip>
            <Tip content={() => <TipCard title={<Term id="usageData">Usage data</Term>} value={perDay(l.perDayT)} rows={[{ label: <Term id="uniqueTokens">Unique tokens a year</Term>, value: `+${tokT(l.yearUT)}` }]}>At today&apos;s traffic (quality 0.5).</TipCard>}><span className="num small">+{perDay(l.perDayT)}</span></Tip>
            <Tip content={() => <TipCard title={<Term id="approval">Civil Liberties approval</Term>} value={`${l.civlib > 0 ? '+' : ''}${l.civlib}`}>The bloc&apos;s approval of you at this level (applied as the difference on a change).</TipCard>}>
              <span className={`small ${l.civlib > 0 ? 'tone-pos' : l.civlib < 0 ? 'tone-neg' : 'dim'}`}>civil liberties {l.civlib > 0 ? '+' : ''}{l.civlib}</span>
            </Tip>
            {l.current ? <span className="tag2">current</span> : <ActBtn id="data.usagePolicy" testId={`data.usagePolicy.${l.level}`} params={{ level: l.level as UsageLevel }} label="Switch" />}
          </div>
        ))}
      </div>
    </Card>
  );
}
