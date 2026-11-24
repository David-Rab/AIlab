// Engineers' load (jank J2 P1): one bar of build capacity split into product upkeep (incl. monitors, features), builds
// (run setups and adoptions first) and idle (RD-B09: research engineers operate running runs, Lab › AI staff & needs); the numbers and every line live in its tooltip. Home of utilisation (Lab › AI staff & needs, engineers card;
// model v3 V2b: build capacity's number lives in that card's hero, so this bar is `compact` there). Products and Models
// show only their own waits (links here).
import type { GameStateV2, RLFamily } from '../../../engine/v2';
import { buildCapacity, buildEtas, buildRates, featureInUse, upkeepLines, upkeepSplit } from '../../../engine/v2';
import { FEATURE_BY_ID, PRODUCT_DEFS, TOOL_BY_ID, type FeatureId, type ToolId } from '../../../data/v2/features';
import { SECTOR_BY_ID } from '../../../data/v2/sectors';
import { AGENT_USE_DEF } from '../../../data/v2/agents';
import { RL_FAMILY_LABEL } from '../../../data/v2/suites';
import { Term, Tip, TipCard } from '../ui';
import * as F from '../fmt';
import { ICON } from '../icons';
import { C } from '../theme';

const SEG = { products: '#b08e1a', builds: '#3a8ae0', idle: '#33435a' } as const;

/** Label of a build-queue item. */
export function buildItemLabel(s: GameStateV2, it: GameStateV2['player']['build']['queue'][number]): string {
  if (it.kind === 'runSetup') return `Setup ${s.player.models.runs.find((r) => r.id === it.ref)?.name ?? it.ref}`;
  if (it.kind === 'feature') return FEATURE_BY_ID[it.ref as FeatureId]?.name ?? it.ref;
  if (it.kind === 'tooling') return TOOL_BY_ID[it.ref as ToolId]?.name ?? it.ref;
  if (it.kind === 'launch') return `Launch ${PRODUCT_DEFS[it.launch?.channel ?? 'api']?.name ?? it.ref}`;
  if (it.kind === 'adaptation') return `${SECTOR_BY_ID[it.ref as keyof typeof SECTOR_BY_ID]?.name ?? it.ref} certification`;
  if (it.kind === 'suite') { const [fam, work] = it.ref.split(':'); return `${work === 'harden' ? 'Harden' : 'Expand'} ${RL_FAMILY_LABEL[fam as RLFamily] ?? fam} environments`; }
  if (it.kind === 'eval') { const t = s.player.models.evals?.find((x) => x.id === it.ref); return `Evals setup ${s.player.models.versions.find((v) => v.id === t?.versionId)?.name ?? ''}`.trim(); }
  return it.ref;
}

/** Label of an upkeep line. */
function upkeepLabel(s: GameStateV2, l: ReturnType<typeof upkeepLines>[number]): string {
  if (l.kind === 'feature') {
    const f = FEATURE_BY_ID[l.ref as FeatureId];
    return `Tool ${f?.name ?? l.ref}${f && !featureInUse(s, f) ? ' (off: upkeep only)' : ''}`;
  }
  if (l.kind === 'tooling') return `Tool ${TOOL_BY_ID[l.ref as ToolId]?.name ?? l.ref}`;
  const d = s.player.deployments.find((x) => x.id === l.ref);
  if (l.kind === 'product') return `${PRODUCT_DEFS[d?.channel ?? 'api']?.name ?? l.ref}`;
  return `Monitor on ${d ? PRODUCT_DEFS[d.channel]?.name ?? d.channel : AGENT_USE_DEF[l.ref as keyof typeof AGENT_USE_DEF]?.name.toLowerCase() ?? l.ref}`;
}

/** Build capacity and the share in use today (inUse: the engineers' needs list, so the card and its spare chip agree;
 *  else the 30-day average); the tooltip breaks it down. */
export function BuildLoad({ s, compact = false, inUse }: { s: GameStateV2; compact?: boolean; inUse?: number }) {
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
  const prods = Math.min(cap, u.products);
  const backlog = q.reduce((a, it) => a + Math.max(0, it.needTW - it.doneTW), 0);
  const builds = Math.max(0, Math.min(cap - prods, s.player.build.last?.queue ?? 0));
  const idle = Math.max(0, cap - prods - builds);
  const short = Math.max(0, u.total - bc.capacity);
  const util = s.player.build.util ?? (u.total / cap);
  const now = inUse ?? util;
  const seg = (x: number, c: string, key: string) => x > 1e-6 && <i key={key} style={{ flex: x, background: c }} />;
  const tip = () => (
    <TipCard title={<Term id="buildCapacity">Build capacity</Term>} value={`${bc.capacity.toFixed(1)} team-weeks/week`} rows={[
      { label: 'People (teams × quality)', value: bc.human.toFixed(1) },
      { label: <><Term id="engAgents">With AI staff</Term></>, value: `${F.mult(bc.capacity / Math.max(1e-9, bc.human))} · can do alone ${F.pct(bc.aEng)} of software engineering` },
      { label: <span className="row-i"><i className="drv-sw" style={{ background: SEG.products }} /><Term id="productUpkeep">Upkeep</Term></span>, value: `${u.products.toFixed(1)} team-weeks/week`, ...(short > 0 ? { tone: 'neg' as const } : {}) },
      ...lines.filter((l) => l.kind !== 'suite').map((l) => ({ label: <span className="dim">· {upkeepLabel(s, l)}</span>, value: l.tw.toFixed(l.tw < 0.1 ? 2 : 1) })),
      ...(suiteTW > 0 ? [{ label: <span className="dim">· <Term id="envSuite">Environments</Term> ({suiteN})</span>, value: suiteTW.toFixed(2) }] : []),
      { label: <span className="row-i"><i className="drv-sw" style={{ background: SEG.builds }} /><Term id="buildQueue">Build queue</Term></span>, value: q.length ? `${backlog.toFixed(1)} team-weeks queued` : 'none queued' },
      ...q.slice(0, 6).map((it) => ({ label: <span className="dim">· {buildItemLabel(s, it)}</span>, value: `${(it.needTW - it.doneTW).toFixed(1)} team-weeks · ${Number.isFinite(etas.get(it.id) ?? 0) ? F.days(etas.get(it.id) ?? 0) : 'waits'}` })),
      { label: 'In use (30-day average)', value: F.pct(util) },
    ]} footer={short > 0 ? `Upkeep needs ${short.toFixed(1)} team-weeks/week more than the engineers have: nothing new ships until you hire engineers or cut products, safeguards or tools.` : `Order: run setups and build-ins, then upkeep, then the rest of the build queue. Free for the queue: ${(rates.builds * 7).toFixed(1)} team-weeks/week. Research engineers keep running runs going (Work › Research engineers).`}>
      What the engineers spend each week. Too few engineers: builds wait.
    </TipCard>
  );
  return (
    <Tip content={tip}>
      <span className="build-load" data-test="build-queue">
        <span className="row-i"><ICON.build size={12} /> <Term id="buildCapacity">Build capacity</Term> <b className="num">{bc.capacity >= 100 ? F.short(bc.capacity) : bc.capacity.toFixed(1)}</b> teams · in use <b className="num" style={{ color: short > 0 ? C.bad : now > 0.9 ? C.watch : undefined }}>{F.pct(Math.min(1, now))}</b>{short > 0 && <span className="tone-neg" data-test="upkeep-short"> · upkeep behind</span>}</span>
        {!compact && <span className="stack2" style={{ width: 140, height: 6, margin: '2px 0 0' }}>{[seg(prods, SEG.products, 'p'), seg(builds, SEG.builds, 'b'), seg(idle, SEG.idle, 'i')]}</span>}
      </span>
    </Tip>
  );
}
