// Mockup data (set A): PRODUCTS, Overview hub (lead lanes, world risk sources), RESEARCH › Discoveries, on the day-400
// fixture, via the view functions the UI panels call. Run from the worktree root:
//   npx tsx design/ux/mockups/rd/_data-a.ts  → design/ux/mockups/rd/data400a.json
// Reads only player-facing views (beliefs, measured, facts); never s.hidden or true traits.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize } from '../../../../src/engine/v2/core/save';
import { FIXTURE_DIR } from '../../../../scripts/v2/lib';
import * as E from '../../../../src/engine/v2';
import type { GameStateV2 } from '../../../../src/engine/v2';
import { TREE, isLineNode } from '../../../../src/data/v2/tree';
import { PRODUCT_DEFS, FEATURES } from '../../../../src/data/v2/features';
import { SECTORS } from '../../../../src/data/v2/sectors';

const s = deserialize(readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8')) as GameStateV2;
const p = s.player;
const r3 = (x: unknown): unknown => (typeof x === 'number' ? (Number.isFinite(x) ? Math.round(x * 1000) / 1000 : String(x)) : x);
const clean = (o: unknown): unknown => {
  if (typeof o === 'number') return r3(o);
  if (Array.isArray(o)) return o.map(clean);
  if (o && typeof o === 'object' && !(o instanceof Map)) return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && typeof v !== 'function').map(([k, v]) => [k, clean(v)]));
  return o;
};
const errors: Record<string, string> = {};
const tryy = <T>(k: string, f: () => T): T | undefined => { try { return f(); } catch (e) { errors[k] = String((e as Error)?.stack ?? e).split('\n').slice(0, 3).join(' | '); return undefined; } };
const date = (d: number) => E.fmtDate(E.dateOf(s, d));
const vname = (id?: string) => (id ? E.versionById(s, id)?.name : undefined);

// ───────── PRODUCTS ─────────
const reads = tryy('productReadouts', () => E.productReadouts(s));
const products = p.deployments.map((d) => {
  const r = reads?.get(d.id);
  const v = E.versionById(s, d.versionId);
  return {
    id: d.id, kind: d.kind, channel: d.channel, status: d.status, name: PRODUCT_DEFS[d.channel as keyof typeof PRODUCT_DEFS]?.name,
    main: v?.name, mainParams: v?.params, measuredL: v?.evals.measuredL, lineup: (d.lineup ?? []).map(vname), freeTier: tryy('free' + d.id, () => E.freeTierVersion(s, d)?.name),
    price: d.price, effort: d.effort, features: d.features, safeguards: d.safeguards, guards: d.guards?.map((g) => (g as { kind?: string }).kind ?? g),
    adaptations: (d.adaptations ?? []).map((a) => ({ ...a, sectorName: SECTORS.find((x) => x.id === a.sector)?.name, certified: tryy('cert', () => E.certified(a, s.time.day)) })),
    monitor: vname(d.monitorId), servingShare: d.servingShare, held: d.held, startDay: d.startDay, start: date(d.startDay),
    read: r ? { ...r, cust: r.cust } : undefined,
    demandMods: tryy('dm' + d.id, () => E.demandModifiers(s, d)),
    horizonH: tryy('hz' + d.id, () => E.measuredHorizonH(v)),
  };
});
const features = Object.values(FEATURES).map((f) => ({ id: f.id, name: f.name, built: p.features?.includes?.(f.id), view: tryy('fv' + f.id, () => E.featureView(f)), rivals: tryy('tr' + f.id, () => E.toolRivalsView(s, f.id)) }));
const serving = { pool: tryy('pool', () => E.servingPool(s)), idle: tryy('idle', () => E.idleServing(s)), online: p.computeOnline, split: p.split, policies: p.policies };
const finance = { revenueSeries: (s as unknown as { series?: Record<string, unknown> }).series ? Object.keys((s as unknown as { series: Record<string, unknown> }).series) : [] };

// ───────── LEAD LANES ─────────
const labs = [...E.activeRivals(s), ...(s.china.lab.core.status === 'active' ? [s.china.lab] : [])];
const lead = labs.map((r) => ({ id: r.core.id, name: r.core.name, china: r === s.china.lab, ...E.leadDays(s, r.core.id), intel: clean(r.intel), compute: (r as unknown as { compute?: unknown }).compute, publicModel: (r as unknown as { publicModel?: unknown }).publicModel }));

// ───────── RISK SOURCES (Company & world › Risk) ─────────
const risk = tryy('riskSources', () => [...E.engine.riskSources(s)].sort((a, b) => b.estimate - a.estimate));
const levers = tryy('riskLevers', () => E.riskLevers(s));

// ───────── DISCOVERIES ─────────
const tree = TREE.map((n) => ({
  id: n.id, name: n.name, column: n.column, layer: n.layer, needs: n.needs, kind: n.kind, line: isLineNode(n), star: n.star, soon: n.soon, paradigm: n.paradigm, agenda: n.agenda,
  technique: n.technique, finding: n.finding, followUp: n.followUp, fx: n.fx, cap: n.cap, saf: n.saf, cost: n.cost, payoff: n.payoff, effect: n.effect,
  status: tryy('st' + n.id, () => E.nodeStatus(s, n.id)), odds: tryy('od' + n.id, () => E.nodeOdds(s, n.id)),
  missing: tryy('mi' + n.id, () => (E as unknown as { missingNeeds: (s: GameStateV2, id: string) => unknown }).missingNeeds(s, n.id)),
  state: clean(p.tree[n.id]),
}));
const counts = tryy('treeCounts', () => E.treeCounts(s));

// ───────── CORE LOOP verdicts (for the hub) ─────────
const hub = {
  runway: tryy('runway', () => (E as unknown as Record<string, (s: GameStateV2) => unknown>).runwayLive?.(s)),
  milestones: p.milestoneDays, cash: p.cash, computeOnline: p.computeOnline,
  runs: (p.models as unknown as { runs?: unknown[] }).runs?.length,
  incidents: (p.safety as unknown as { incidents?: unknown[] }).incidents?.length,
};

writeFileSync('design/ux/mockups/rd/data400a.json', JSON.stringify(clean({ day: s.time.day, date: date(s.time.day), products, features, serving, finance, lead, risk, levers, tree, counts, hub, errors }), null, 1));
console.log('ok', Object.keys(errors).length, 'errors', Object.keys(errors).slice(0, 20));
