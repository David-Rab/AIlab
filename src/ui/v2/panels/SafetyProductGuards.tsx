// UB-F: the product safeguards editor (SAFETY › Safeguards is the one home of every safeguard control, OQ-7 / UI-IA
// "one home per datum"). Opened from a product row of the "What stops harmful acts, where" grid: per product its monitor,
// misuse safeguard level and buyer checks (KYC), edited as a draft with a before → after preview (stop rates from the
// believed act table on a copy with the edit, the monitor's believed catch, revenue and target share from the product
// preview) and applied with product.update. PRODUCTS keeps only a "Safeguards ›" link chip.
import { useMemo, useState, type ReactNode } from 'react';
import { MONITOR_AUTO } from '../../../data/v2/agents';
import { SAFEGUARD_DG } from '../../../data/v2/serving';
import { PRODUCT_DEFS } from '../../../data/v2/features';
import { actTable } from '../../../engine/v2/safety/actTable';
import { catchRate, editBlock, editedProduct, kycDemandFactor, KYC_REFUSE, previewEdit, stopSpread, versionById } from '../../../engine/v2';
import type { Deployment, GameStateV2, ProductChanges, StopSpread } from '../../../engine/v2';
import { productMonitorVersion } from '../../../engine/v2/models/products';
import { autoWatcher } from '../../../engine/v2/safety/trusted';
import { packageBlock } from '../../../engine/v2/safety/packages';
import { ActBtn, Seg, Term, Tip, TipCard, type Params } from '../ui';
import { store } from '../store';
import * as F from '../fmt';
import { PackageRow } from './SafetyControl';

const LEVELS: Deployment['safeguards'][] = ['minimal', 'standard', 'classifiers', 'hardened'];
const LEVEL_WORD: Record<Deployment['safeguards'], string> = { minimal: 'Minimal', standard: 'Standard', classifiers: 'Classifiers', hardened: 'Hardened' };
const LEVEL_SUB: Record<Deployment['safeguards'], string> = { minimal: 'no misuse filter', standard: 'usage policy only', classifiers: 'stop bio, cyber help', hardened: 'stop bio, cyber help, hardened' };
const usable = (s: GameStateV2) => s.player.models.versions.filter((x) => x.status === 'ready' || x.status === 'deployed');
const monName = (s: GameStateV2, id?: string) => (id === MONITOR_AUTO ? 'auto (most capable trusted)' : id ? versionById(s, id)?.name ?? id : 'none');
const spread = (x?: StopSpread) => { const p = (v: number) => `${Math.round(v * 100)}%`; return !x ? '0%' : p(x.lo) === p(x.hi) ? p(x.lo) : `${p(x.lo)}–${p(x.hi)}`; };

/** The editor for one group of product rows (same model and safeguards): one block per product. */
export function ProductGuardsDrawer({ s, ids }: { s: GameStateV2; ids: string[] }) {
  const deps = ids.map((id) => s.player.deployments.find((d) => d.id === id && d.status !== 'withdrawn')).filter((d): d is Deployment => !!d);
  if (!deps.length) return <div className="sfs-none">No live product here.</div>;
  return <>{deps.map((d) => <ProductGuards key={d.id} s={s} d={d} />)}</>;
}

function ProductGuards({ s, d }: { s: GameStateV2; d: Deployment }) {
  const [c, setC] = useState<ProductChanges>({});
  const v = versionById(s, d.versionId);
  const mon = productMonitorVersion(s, d);
  const autoWhy = d.monitorId === MONITOR_AUTO ? autoWatcher(s, v).reason : undefined;
  const set = (x: ProductChanges) => setC((o) => ({ ...o, ...x }));
  const n = editedProduct(d, c);
  const kyc = d.channel === 'api' || d.channel === 'agents';
  const name = PRODUCT_DEFS[d.channel]?.name ?? d.channel;
  return (
    <div className="card2 sfs-dsec" data-test={`pg.${d.id}`}>
      <div className="sfs-dcap">{name} · {v?.name ?? 'a model'}</div>
      <div className="sfs-pgrid">
        <Tip content={() => <TipCard title={<Term id="monitor">Monitor</Term>} value={monName(s, d.monitorId)}>Reads the product&apos;s outputs and reasoning and stops harmful acts before customers see them.{autoWhy ? ` Auto: ${mon ? `${mon.name}, the most capable model you trust` : 'no trusted model yet'}.` : ''}</TipCard>}><span className="k"><Term id="monitor">Monitor</Term></span></Tip>
        <select className="sfs-sel" data-test={`pg-monitor.${d.id}`} value={n.monitorId ?? ''} onChange={(e) => set({ monitorId: e.target.value || null })}>
          <option value={MONITOR_AUTO}>auto · most capable trusted{d.monitorId === MONITOR_AUTO && mon ? ` (${mon.name})` : ''}</option>
          <option value="">no monitor</option>
          {usable(s).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
        <Tip content={() => <TipCard title={<Term id="safeguards">Product safeguards</Term>} rows={[
          { label: 'Misuse hazard', value: 'minimal ×1 · standard ×0.7 · classifiers ×0.4 · hardened ×0.15' },
          { label: 'Skill cost', value: `classifiers ×${(10 ** SAFEGUARD_DG.classifiers).toFixed(2)} · hardened ×${(10 ** SAFEGUARD_DG.hardened).toFixed(2)} effective compute` },
        ]}>Misuse protection: higher levels block more bio and cyber misuse and cost some skill.</TipCard>}><span className="k"><Term id="safeguards">Level</Term></span></Tip>
        <Seg testId={`pg-level.${d.id}`} value={n.safeguards} options={LEVELS.map((g) => ({ v: g, label: LEVEL_WORD[g], tip: LEVEL_SUB[g] }))} onChange={(g) => set({ safeguards: g })} />
        {kyc && <>
          <Tip content={() => <TipCard title={<Term id="kyc">KYC</Term>}>Each level verifies ten times more of the anonymous buyers distillers hide among: the leak through this product falls by about a quarter; {F.pct(KYC_REFUSE, 0)} of those asked leave rather than verify (demand ×{F.num(kycDemandFactor(n), 3)}).</TipCard>}><span className="k"><Term id="kyc">KYC</Term></span></Tip>
          <Seg testId={`pg-kyc.${d.id}`} value={n.kyc} options={[0, 1, 2, 3].map((k) => ({ v: k as Deployment['kyc'], label: String(k) }))} onChange={(k) => set({ kyc: k })} />
        </>}
      </div>
      {!packageBlock(s, d) && <div className="row-i"><PackageRow s={s} depId={d.id} testId={`pg-package.${d.id}`} /></div>}
      {Object.keys(c).some((k) => (c as Record<string, unknown>)[k] !== undefined && (n as unknown as Record<string, unknown>)[k] !== (d as unknown as Record<string, unknown>)[k])
        ? <GuardPreview s={s} d={d} c={c} reset={() => setC({})} />
        : <div className="t3 sfs-note">Change a setting to see what it does before you apply it.</div>}
    </div>
  );
}

function GuardPreview({ s, d, c, reset }: { s: GameStateV2; d: Deployment; c: ProductChanges; reset: () => void }) {
  const block = editBlock(s, d, c);
  const n = editedProduct(d, c);
  const view = useMemo(() => {
    if (block) return undefined;
    const s2: GameStateV2 = { ...s, player: { ...s.player, deployments: s.player.deployments.map((x) => (x.id === d.id ? n : x)) } };
    const a = actTable(s, { deploymentId: d.id }, true);
    const b = actTable(s2, { deploymentId: d.id }, true);
    const v = versionById(s, d.versionId);
    const pv = previewEdit(s, d, c);
    return {
      misuse: [stopSpread(a, 'misuse'), stopSpread(b, 'misuse')] as const,
      misb: [stopSpread(a, 'misbehaviour'), stopSpread(b, 'misbehaviour')] as const,
      catch: [d.monitorId ? catchRate(s, v, productMonitorVersion(s, d), false, true).rate : 0, n.monitorId ? catchRate(s2, v, productMonitorVersion(s2, n), false, true).rate : 0] as const,
      rev: [pv.before?.revenue, pv.after?.revenue] as const,
      tgt: [pv.before?.cust.target, pv.after?.cust.target] as const,
    };
  }, [s, store.version, d, JSON.stringify(c)]);
  const params: Params = { id: d.id };
  if (c.monitorId !== undefined) params.monitorId = c.monitorId ?? '';
  if (c.safeguards) params.safeguards = c.safeguards;
  if (c.kyc !== undefined) params.kyc = c.kyc;
  const row = (k: ReactNode, a: string, b: string, better?: boolean, test?: string) => (
    <><span className="k">{k}</span><span className="sfs-prev" data-test={test}>{a} → <b className={better === undefined || a === b ? '' : better ? 'good' : 'bad'}>{b}</b></span></>
  );
  return (
    <div className="sfs-pv" data-test={`pg-preview.${d.id}`}>
      {block ? <div className="warn">{block}</div> : view && (
        <div className="sfs-pgrid">
          {row(<Term id="actOversight">Stop rate, misuse</Term>, spread(view.misuse[0]), spread(view.misuse[1]), (view.misuse[1]?.hi ?? 0) >= (view.misuse[0]?.hi ?? 0), `pg-stop.${d.id}`)}
          {row(<Term id="actOversight">Stop rate, misbehaviour</Term>, spread(view.misb[0]), spread(view.misb[1]), (view.misb[1]?.hi ?? 0) >= (view.misb[0]?.hi ?? 0))}
          {(d.monitorId || n.monitorId) && row(<Term id="catchRate">Monitor catch</Term>, F.pct(view.catch[0]), F.pct(view.catch[1]), view.catch[1] >= view.catch[0])}
          {view.rev[0] !== undefined && view.rev[1] !== undefined && row(<Term id="revenueNow">Revenue now</Term>, F.money(view.rev[0]), F.money(view.rev[1]), view.rev[1] >= view.rev[0])}
          {view.tgt[0] !== undefined && view.tgt[1] !== undefined && row(<Term id="targetShare">Target share</Term>, F.pct(view.tgt[0], 1), F.pct(view.tgt[1], 1), view.tgt[1] >= view.tgt[0])}
        </div>
      )}
      <div className="row-i sfs-dfoot">
        <span className="t3">From your beliefs; applies at once.</span><span className="sp" />
        <button className="btn btn-sm" data-test={`pg-cancel.${d.id}`} onClick={reset}>Cancel</button>
        <ActBtn id="product.update" testId={`pg-apply.${d.id}`} params={params} label="Apply" primary block={block} onDone={reset} />
      </div>
    </div>
  );
}
