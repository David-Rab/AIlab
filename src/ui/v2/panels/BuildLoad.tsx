// Engineers' load (jank J2 P1): one bar of build capacity split into run operations, product upkeep (incl. monitors, features),
// builds and idle; the numbers and every line live in its tooltip. Home of utilisation (Company › Work, engineers card;
// model v3 V2b: build capacity's number lives in that card's hero, so this bar is `compact` there). Products and Models
// show only their own waits (links here).
import type { GameStateV2, RLFamily } from '../../../engine/v2';
import { buildCapacity, buildEtas, buildRates, featureInUse, isRunLine, upkeepLines, upkeepSplit } from '../../../engine/v2';
import { FEATURE_BY_ID, PRODUCT_DEFS, type FeatureId } from '../../../data/v2/features';
import { SECTOR_BY_ID } from '../../../data/v2/sectors';
import { AGENT_USE_DEF } from '../../../data/v2/agents';
import { RL_FAMILY_LABEL } from '../../../data/v2/suites';
import { Term, Tip, TipCard } from '../ui';
import * as F from '../fmt';
import { ICON } from '../icons';
import { C } from '../theme';

const SEG = { runs: '#9b6be0', products: '#b08e1a', builds: '#3a8ae0', idle: '#33435a' } as const;

/** Label of a build-queue item. */
export function buildItemLabel(s: GameStateV2, it: GameStateV2['player']['build']['queue'][number]): string {
  if (it.kind === 'runSetup') return `Setup ${s.player.models.runs.find((r) => r.id === it.ref)?.name ?? it.ref}`;
  if (it.kind === 'feature') return FEATURE_BY_ID[it.ref as FeatureId]?.name ?? it.ref;
  if (it.kind === 'launch') return `Launch ${PRODUCT_DEFS[it.launch?.channel ?? 'api']?.name ?? it.ref}`;
  if (it.kind === 'sectorPack') return `${SECTOR_BY_ID[it.ref as keyof typeof SECTOR_BY_ID]?.name ?? it.ref} pack`;
  if (it.kind === 'suite') { const [fam, work] = it.ref.split(':'); return `${work === 'harden' ? 'Harden' : 'Build'} ${RL_FAMILY_LABEL[fam as RLFamily] ?? fam} suite`; }
  if (it.kind === 'eval') { const t = s.player.models.evals?.find((x) => x.id === it.ref); return `Eval harness ${s.player.models.versions.find((v) => v.id === t?.versionId)?.name ?? ''}`.trim(); }
  return it.ref;
}

/** Label of an upkeep line. */
function upkeepLabel(s: GameStateV2, l: ReturnType<typeof upkeepLines>[number]): string {
  if (l.kind === 'run') return `Run ${s.player.models.runs.find((r) => r.id === l.ref)?.name ?? l.ref}`;
  if (l.kind === 'stream') return 'Continual-learning stream';
  if (l.kind === 'feature') {
    const f = FEATURE_BY_ID[l.ref as FeatureId];
    return `Feature ${f?.name ?? l.ref}${f && !featureInUse(s, f) ? ' (off: keep-alive)' : ''}`;
  }
  const d = s.player.deployments.find((x) => x.id === l.ref);
  if (l.kind === 'product') return `${PRODUCT_DEFS[d?.channel ?? 'api']?.name ?? l.ref}`;
  return `Monitor on ${d ? PRODUCT_DEFS[d.channel]?.name ?? d.channel : AGENT_USE_DEF[l.ref as keyof typeof AGENT_USE_DEF]?.name.toLowerCase() ?? l.ref}`;
}

export function BuildLoad({ s, compact = false }: { s: GameStateV2; compact?: boolean }) {
  const bc = buildCapacity(s);
  const u = upkeepSplit(s);
  const lines = upkeepLines(s);
  // Model v3 D5: the RL environment suites' upkeep as one line.
  const suiteLines = lines.filter((l) => l.kind === 'suite');
  const suiteTW = suiteLines.reduce((a, l) => a + l.tw, 0);
  const suiteN = suiteLines.length;
  const q = s.player.build.queue;
  const etas = buildEtas(s).etas;
  const rates = buildRates(s);
  const cap = Math.max(1e-9, bc.capacity);
  const runs = Math.min(cap, u.runs);
  const prods = Math.min(cap - runs, u.products);
  const backlog = q.reduce((a, it) => a + Math.max(0, it.needTW - it.doneTW), 0);
  const builds = Math.max(0, Math.min(cap - runs - prods, s.player.build.last?.queue ?? 0));
  const idle = Math.max(0, cap - runs - prods - builds);
  const short = Math.max(0, u.total - bc.capacity);
  const util = s.player.build.util ?? (u.total / cap);
  const seg = (x: number, c: string, key: string) => x > 1e-6 && <i key={key} style={{ flex: x, background: c }} />;
  const tip = () => (
    <TipCard title={<Term id="buildCapacity">Build capacity</Term>} value={`${bc.capacity.toFixed(1)} team-wk/wk`} rows={[
      { label: 'Human (teams × quality)', value: bc.human.toFixed(1) },
      { label: <><Term id="engAgents">With AI</Term></>, value: `${F.mult(bc.capacity / Math.max(1e-9, bc.human))} · covers ${F.pct(bc.aEng)} of software work` },
      { label: <span className="row-i"><i className="drv-sw" style={{ background: SEG.runs }} /><Term id="runOps">Runs</Term></span>, value: `${u.runs.toFixed(1)} t-wk/wk` },
      ...lines.filter(isRunLine).map((l) => ({ label: <span className="dim">· {upkeepLabel(s, l)}</span>, value: l.tw.toFixed(1) })),
      { label: <span className="row-i"><i className="drv-sw" style={{ background: SEG.products }} /><Term id="productUpkeep">Product upkeep</Term></span>, value: `${u.products.toFixed(1)} t-wk/wk`, ...(short > 0 ? { tone: 'neg' as const } : {}) },
      ...lines.filter((l) => !isRunLine(l) && l.kind !== 'suite').map((l) => ({ label: <span className="dim">· {upkeepLabel(s, l)}</span>, value: l.tw.toFixed(l.tw < 0.1 ? 2 : 1) })),
      ...(suiteTW > 0 ? [{ label: <span className="dim">· <Term id="envSuite">Environment suites</Term> ({suiteN})</span>, value: suiteTW.toFixed(2) }] : []),
      { label: <span className="row-i"><i className="drv-sw" style={{ background: SEG.builds }} /><Term id="buildQueue">Builds</Term></span>, value: q.length ? `${backlog.toFixed(1)} t-wk queued` : 'none queued' },
      ...q.slice(0, 6).map((it) => ({ label: <span className="dim">· {buildItemLabel(s, it)}</span>, value: `${(it.needTW - it.doneTW).toFixed(1)} t-wk · ${Number.isFinite(etas.get(it.id) ?? 0) ? F.days(etas.get(it.id) ?? 0) : 'waits'}` })),
      { label: 'In use (30-day average)', value: F.pct(util) },
    ]} footer={short > 0 ? `Upkeep needs ${short.toFixed(1)} t-wk/wk more than the engineers have: nothing new ships until you hire engineers or cut products, monitors or features.` : `Order: runs (and run setups), then product upkeep, then builds. Free for builds: ${(rates.builds * 7).toFixed(1)} t-wk/wk.`}>
      What the engineers spend each week. Too few engineers: builds wait.
    </TipCard>
  );
  return (
    <Tip content={tip}>
      <span className="build-load" data-test="build-queue">
        <span className="row-i"><ICON.build size={12} /> {!compact && <><Term id="buildCapacity">build</Term> <b className="num">{bc.capacity.toFixed(1)}</b> team-wk/wk · </>}<b className="num" style={{ color: short > 0 ? C.bad : util > 0.9 ? C.watch : undefined }}>{F.pct(Math.min(1, util))}</b> busy{short > 0 && <span className="tone-neg" data-test="upkeep-short"> · upkeep behind</span>}</span>
        <span className="stack2" style={{ width: 140, height: 6, margin: '2px 0 0' }}>{[seg(runs, SEG.runs, 'r'), seg(prods, SEG.products, 'p'), seg(builds, SEG.builds, 'b'), seg(idle, SEG.idle, 'i')]}</span>
      </span>
    </Tip>
  );
}
