// LAB › AI staff & needs, the needs lists (UB-B; mockup design/ux/mockups/rd/lab-aistaff.png). HOME of the needs in
// priority order for engineers, capability research engineers and safety research engineers: what each need gets
// (people and AI staff together), short in amber, spare last; "Change order" opens the editor (drag or ▲▼, a cap per
// need). The LAB board's rows link here. Scientists have no needs list: Research places them by the priority list.
import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp, GripVertical } from 'lucide-react';
import { engAllocView, reAllocView, safReAllocView, safetySpend, upkeepShares } from '../../../engine/v2';
import type { AllocView, EngNeed, GameStateV2, NeedView, ReNeed, SafReNeed } from '../../../engine/v2';
import { store } from '../store';
import { Term, Tip, TipCard } from '../ui';
import { ICON } from '../icons';
import * as F from '../fmt';
import { BuildLoad } from './BuildLoad';
import './work.css';

// Total over the engine's need keys: a new need is a type error here, not a crash.
type NeedKey = ReNeed | SafReNeed | EngNeed;
const NEED_TERM: Record<NeedKey, string> = {
  ops: 'runOps', exp: 'reNeeds', runs: 'engNeeds', upkeep: 'productUpkeep', builds: 'buildQueue',
  review: 'safeguards', spotCheck: 'spotCheck', cases: 'investigation', validation: 'validation', evals: 'evals', removal: 'footholdRemove', safExp: 'safReNeeds',
};
const NEED_SHORT: Record<NeedKey, string> = {
  ops: 'Run operations', exp: 'Research experiments', runs: 'Run setups', upkeep: 'Upkeep', builds: 'Build queue',
  review: 'Human review', spotCheck: 'Spot-checks', cases: 'Cases', validation: 'Validations', evals: 'Safety evals', removal: 'Foothold removal', safExp: 'Research experiments',
};
const NEED_NONE: Partial<Record<NeedKey, string>> = { ops: 'no run', runs: 'none', builds: 'empty', cases: 'none open' };
const SHARES = [0.25, 0.5, 0.75, 0.9];
const COUNTS = [1, 2, 4, 8, 16];
const t1 = (x: number) => (x > 0 && x < 0.05 ? '< 0.1' : x >= 10 ? F.count(x) : x.toFixed(1).replace(/\.0$/, ''));

function CapSelect({ n, act, cap }: { n: NeedView<NeedKey>; act: string; cap: number }) {
  const cur = n.share !== undefined ? `share:${n.share}` : n.max !== undefined ? `max:${n.max}` : '';
  const opts: [string, string][] = [['', 'no cap'], ...SHARES.map((x) => [`share:${x}`, `≤ ${F.pct(x)}`] as [string, string]), ...COUNTS.map((x) => [`max:${x}`, `≤ ${x}`] as [string, string])];
  if (cur && !opts.some((o) => o[0] === cur)) opts.push([cur, n.share !== undefined ? `≤ ${F.pct(n.share)}` : `≤ ${n.max}`]);
  return (
    <Tip content={() => <TipCard title={<Term id="allocCap">Cap</Term>} value={cur ? opts.find((o) => o[0] === cur)?.[1] : 'none'} rows={[{ label: 'Capacity', value: t1(cap) }]}>A team count or a share of the capacity; what it leaves flows to the needs below.</TipCard>}>
      <select className="chip-select wk-cap" data-test={`cap.${n.k}`} value={cur} onChange={(e) => {
        const [kind, val] = e.target.value.split(':');
        store.act(act, { need: n.k, share: kind === 'share' ? Number(val) : -1, max: kind === 'max' ? Number(val) : -1 });
      }}>
        {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </Tip>
  );
}

/** One needs list. Read-only by default (rank · need · gets bar · what it gets); Change order turns on the editor. */
function NeedList({ a, act, fmt, editing }: { a: AllocView<NeedKey>; act: string; fmt: (x: number) => string; editing: boolean }) {
  const setOrder = (o: string[]) => store.act(act, { order: o.join(',') });
  const move = (k: NeedKey, d: number) => {
    const o: string[] = [...a.order];
    const i = o.indexOf(k);
    const j = i + d;
    if (j < 0 || j >= o.length) return;
    [o[i], o[j]] = [o[j], o[i]];
    setOrder(o);
  };
  const scale = Math.max(1e-9, a.cap);
  const spare = a.idle;
  return (
    <div className={`la-needs ${editing ? 'editing' : ''}`} data-test={`needs.${act}`}>
      {a.needs.map((n, i) => {
        const dem = Number.isFinite(n.demand) ? n.demand : null;
        const none = (dem ?? n.got) <= 1e-9 && n.got <= 1e-9;
        const short = n.short > 0.05 && dem !== null;
        const st = none ? (NEED_NONE[n.k] ?? 'none') : short ? `${t1(n.got)} of ${t1(dem!)}` : fmt(n.got);
        const fill = dem !== null && dem > 0 ? Math.min(1, n.got / dem) : n.got / scale;
        return (
          <div key={n.k} className={`la-need ${short ? 'short' : ''} ${none ? 'nil' : ''}`} data-need={n.k} draggable={editing}
            onDragStart={(e) => e.dataTransfer.setData('text/plain', n.k)} onDragOver={(e) => editing && e.preventDefault()}
            onDrop={(e) => { if (!editing) return; e.preventDefault(); const from = e.dataTransfer.getData('text/plain'); if (!from || from === n.k) return; const o: string[] = a.order.filter((x) => x !== from); o.splice(o.indexOf(n.k), 0, from); setOrder(o); }}>
            {editing ? <span className="rp-grip"><GripVertical size={12} /></span> : null}
            <span className="rk num">{i + 1}</span>
            <span className="nm">{short && <ICON.alert size={12} />} <Term id={NEED_TERM[n.k]}>{NEED_SHORT[n.k]}</Term></span>
            <Tip content={() => <TipCard title={NEED_SHORT[n.k]} rows={[
              { label: 'Gets', value: fmt(n.got) },
              { label: 'Needs', value: dem === null ? 'whatever is left' : fmt(dem) },
              ...(short ? [{ label: 'Short', value: fmt(n.short), tone: 'neg' as const }] : []),
              ...(n.k === 'ops' && short ? [{ label: 'Runs train at', value: F.pct(Math.min(1, n.got / Math.max(1e-9, dem ?? 1))), tone: 'neg' as const }] : []),
            ]}>{none ? 'Nothing to do here today.' : n.capped ? 'Held by its cap: the rest flows down.' : short ? 'The needs above it took the capacity.' : 'Fully served.'}{n.k === 'ops' && short ? ' Running runs slow to the share served.' : ''}</TipCard>}>
              <span className="gb"><i style={{ width: `${Math.min(100, fill * 100)}%` }} /></span>
            </Tip>
            <span className="st num">{st}</span>
            {editing && <><CapSelect n={n} act={act} cap={a.cap} /><span className="rp-mv">
              <button className="btn btn-sm btn-ghost" disabled={i === 0} data-test={`need-up.${n.k}`} onClick={() => move(n.k, -1)} aria-label="Up"><ChevronUp size={11} /></button>
              <button className="btn btn-sm btn-ghost" disabled={i === a.needs.length - 1} data-test={`need-down.${n.k}`} onClick={() => move(n.k, 1)} aria-label="Down"><ChevronDown size={11} /></button>
            </span></>}
          </div>
        );
      })}
      {spare > 1e-6 && (
        <Tip content={() => <TipCard title={<Term id="overflow">Spare</Term>} value={fmt(spare)}>Capacity no need takes.</TipCard>}>
          <div className="la-need spare" data-test={`idle.${act}`}>
            {editing ? <span /> : null}<span className="rk" /><span className="nm"><Term id="overflow">Spare</Term></span>
            <span className="gb"><i style={{ width: `${Math.min(100, (spare / scale) * 100)}%` }} /></span><span className="st num">{fmt(spare)}</span>
          </div>
        </Tip>
      )}
    </div>
  );
}

function NeedsCard({ id, title, sub, chip, a, act, fmt, foot }: { id: string; title: ReactNode; sub: ReactNode; chip?: { text: string; tone: 'short' | 'spare'; tip: string }; a: AllocView<NeedKey>; act: string; fmt: (x: number) => string; foot?: ReactNode }) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="la-ncard" id={`ctl-${id}`} data-home={id}>
      <div className="la-nh">
        <b className="row-i">{title}</b><span className="sp" />
        {chip && <Tip content={() => <TipCard title={chip.tone === 'short' ? 'Short' : <Term id="overflow">Spare</Term>} value={chip.text}>{chip.tip}</TipCard>}><span className={`la-nchip ${chip.tone}`} data-test={`${id}.chip`}>{chip.tone === 'short' && <ICON.alert size={12} />} {chip.text}</span></Tip>}
      </div>
      <div className="la-nsub small">{sub}</div>
      <NeedList a={a} act={act} fmt={fmt} editing={editing} />
      <div className="la-nfoot small dim">
        <span>{foot}</span><span className="sp" />
        <button className={`btn btn-sm ${editing ? 'on' : ''}`} data-test={`order.${act}`} onClick={() => setEditing(!editing)}><ICON.split size={12} /> {editing ? 'Done' : 'Change order'}</button>
      </div>
    </div>
  );
}

/** The three needs lists side by side. */
export function NeedsBoard({ s }: { s: GameStateV2 }) {
  const eng = engAllocView(s);
  const re = reAllocView(s);
  const saf = safReAllocView(s);
  const up = upkeepShares(s);
  const sp = safetySpend(s);
  const engPct = (x: number) => { const f = x / Math.max(1e-9, eng.cap); return F.pct(f, f > 0 && f < 0.01 ? 1 : 0); };
  const engSpare = eng.cap > 0 ? eng.idle / eng.cap : 0;
  const engShort = eng.needs.filter((n) => n.short > 0.05 && Number.isFinite(n.demand));
  const reShort = re.needs.filter((n) => n.short > 0.05 && Number.isFinite(n.demand)).reduce((a, n) => a + n.short, 0);
  const safShort = saf.needs.filter((n) => n.short > 0.05 && Number.isFinite(n.demand)).reduce((a, n) => a + n.short, 0);
  const upParts = ([['products', up.products], ['watchers', up.watchers], ['tools', up.tools], ['environments', up.environments]] as const).filter(([, x]) => x > 1e-4);
  return (
    <section className="la-needs-w">
      <div className="la-sec"><span className="cap2"><ICON.split size={12} /> Needs, in priority order</span><span className="small dim">gets / needs · staff go to the top first · people and AI staff together</span></div>
      <div className="la-ncards">
        <NeedsCard id="needs.eng" act="build.engAlloc" a={eng} fmt={engPct}
          title={<><ICON.roleEng size={15} /><Term id="engNeeds">Engineers</Term></>}
          sub={<BuildLoad s={s} compact inUse={1 - engSpare} />}
          chip={engShort.length ? { text: `short on ${NEED_SHORT[engShort[0].k].toLowerCase()}`, tone: 'short', tip: `${engShort.map((n) => NEED_SHORT[n.k]).join(', ')} get less than they need.` } : engSpare > 0.02 ? { text: `${F.pct(engSpare)} spare`, tone: 'spare', tip: 'Build capacity no need takes this week.' } : undefined}
          foot={upParts.length ? <>Upkeep: {upParts.map(([k, x]) => `${k} ${F.pct(x, x < 0.01 ? 1 : 0)}`).join(' · ')}</> : 'No upkeep'} />
        <NeedsCard id="needs.re.cap" act="research.reAlloc" a={re} fmt={(x) => `${t1(x)} teams`}
          title={<><ICON.roleRE size={15} /><Term id="reNeeds">Research engineers</Term> <span className="dim small lc">capability</span></>}
          sub={<span>{t1(re.cap)} teams · 2 per programme at most</span>}
          chip={reShort > 0.05 ? { text: `short ${t1(reShort)} teams`, tone: 'short', tip: 'Some needs get less than they ask.' } : re.idle >= 0.05 ? { text: `${t1(re.idle)} teams spare`, tone: 'spare', tip: 'Capacity no need takes: add a project to put them to work.' } : undefined} />
        <NeedsCard id="needs.re.saf" act="research.safReAlloc" a={saf} fmt={(x) => `${t1(x)} people`}
          title={<><ICON.roleRE size={15} /><Term id="safReNeeds">Research engineers</Term> <span className="dim small lc">safety</span></>}
          sub={<Tip content={() => <TipCard title="Safety needs spend" value={F.money(sp.total, { perYear: true })} rows={[{ label: 'People', value: F.money(sp.staffCost, { perYear: true }) }, { label: 'Compute', value: F.money(sp.computeCost, { perYear: true }) }]} footer="Not in this total: safety scientists' pay, spare staff and product safeguards.">The people and compute the safety needs got: payroll share plus compute at the rental rate.</TipCard>}><span>{t1(saf.cap)} people · needs spend {F.money(sp.total)}/yr</span></Tip>}
          chip={safShort > 0.05 ? { text: `short ${t1(safShort)} people`, tone: 'short', tip: 'Safety needs get fewer people than they ask: hire safety research engineers or lower the needs above.' } : saf.idle >= 0.5 ? { text: `${t1(saf.idle)} people spare`, tone: 'spare', tip: 'Safety research-engineer capacity no need takes.' } : undefined}
          foot={safShort > 0.05 ? 'Short: safety programmes slow down' : undefined} />
      </div>
    </section>
  );
}
