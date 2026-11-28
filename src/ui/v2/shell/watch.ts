// Watch rules (IA.md L1, PLAN U1.10): each rule reads visible selectors only and yields a cause chain
// (root ▸ symptom), a consequence line and a Go target to the control that fixes it. UI-only; no engine state.
import type { LucideIcon } from 'lucide-react';
import { blockingCommitments, describeTarget, divisionView, engine, eventDef, idleChips, idleShares, idleStocks, idleTeams, internalVersion, revenueReadout, safReAllocView, safetyView, whatWeOwe } from '../../../engine/v2';
import type { GameStateV2, IdleStockId } from '../../../engine/v2';
import { CRITICAL_TRAITS } from '../../../data/v2/traits';
import { ICON } from '../icons';
import * as F from '../fmt';
import type { GoTarget } from '../kit';
import { boardReview, runwayLive } from './selectors';

export interface WatchLink { label: string; icon?: LucideIcon; kind: 'root' | 'bad'; detail?: string }
export interface WatchItem { id: string; sphere: 'company' | 'models' | 'safety' | 'world'; sev: number; chain: WatchLink[]; why: string; go: GoTarget; goLabel: string }

/** The alert of each idle stock (STRUCTURE R5; scripts/v2/idle.ts): a Watch item, or a nav badge where the stock
 *  still has a partial use (science teams with no project add research taste but advance no idea: Research badge). */
export const IDLE_ALERT: Record<IdleStockId, { watch?: string; badge?: string }> = { chips: { watch: 'idle', badge: 'compute' }, scienceTeams: { badge: 'research' }, serving: { watch: 'idleServing' } };

export function watchItems(s: GameStateV2): WatchItem[] {
  const out: WatchItem[] = [];
  const p = s.player;
  // 1. chips bought but dark
  const idle = idleChips(s);
  if (idle > 0.05 * Math.max(1, p.computeOnline + idle)) {
    const share = idle / Math.max(1, p.computeOnline + idle);
    out.push({
      id: 'idle', sphere: 'company', sev: 2 + share * 2,
      chain: [{ label: 'racks full', icon: ICON.noPower, kind: 'root', detail: 'Live sites have no free megawatts for delivered chips' }, { label: 'chips idle', icon: ICON.idle, kind: 'bad', detail: `${F.count(idle)} H100e dark (${F.pct(share)} of your chips)` }],
      why: 'chips you paid for earn nothing', go: { panel: 'compute', tab: 'overview' }, goLabel: 'Compute',
    });
  }
  // 1b. serving compute no product needs (R5). Science teams with no project show on the Research nav badge.
  for (const st of idleStocks(s)) {
    if (st.id === 'serving') out.push({
      id: 'idleServing', sphere: 'company', sev: 1.5 + st.share,
      chain: [{ label: 'demand below serving', icon: ICON.serving, kind: 'root', detail: `Products need ${F.pct(1 - st.share)} of the serving pool` }, { label: `${F.count(st.amount)} H100e idle`, icon: ICON.idle, kind: 'bad', detail: 'Idle on the serving line (headroom)' }],
      why: 'lower the serving share or turn on Auto-split on Lab', go: { panel: 'lab', anchor: 'split' }, goLabel: 'Lab',
    });
  }
  // 2. products capped by serving capacity (R6: what the Auto split cuts, lowest $ per H100e first)
  const rd = revenueReadout(s);
  const capped = rd.deps.filter((d) => d.bound === 'capacity');
  if (capped.length) {
    const cutH = rd.deps.reduce((a, d) => a + d.cutH100e, 0);
    out.push({
      id: 'capped', sphere: 'models', sev: 2 + Math.min(2, (rd.demand - rd.total) / Math.max(1, rd.total)),
      chain: [{ label: 'serving compute short', icon: ICON.serving, kind: 'root', detail: `Serving pool gets ${F.pct(p.split.serving)} of compute; ${p.policies.servingAuto ? 'Auto' : 'your shares'} cut ${F.count(cutH)} H100e` }, { label: `${capped.length} product${capped.length > 1 ? 's' : ''} capped`, icon: ICON.product, kind: 'bad', detail: `Demand ${F.money(rd.demand, { perYear: true })} vs capacity ${F.money(rd.capacity, { perYear: true })}` }],
      why: 'demand you are not booking', go: { panel: 'lab', anchor: 'split' }, goLabel: 'Lab',
    });
  }
  // 3. critical traits the stack can no longer read at L
  const u = engine.sightLimit(s);
  const unseen = CRITICAL_TRAITS.filter((t) => (u.perTrait[t] ?? 1) < 0.5);
  if (internalVersion(s) && unseen.length) {
    const sv = safetyView(s);
    const tool = sv.techniques.filter((t) => t.unlocked && t.active && t.role !== 'fix').sort((a, b) => b.decay - a.decay)[0];
    const root: WatchLink = tool && tool.decay > 0.3
      ? { label: `${tool.name} decayed`, icon: ICON.revalidate, kind: 'root', detail: `${F.pct(tool.decay)} of its strength lost as capability grew` }
      : { label: 'no tool covers them', icon: ICON.safety, kind: 'root', detail: 'Staff a detection research line' };
    out.push({
      id: 'unseen', sphere: 'safety', sev: 2 + unseen.length / 2,
      chain: [root, { label: `${unseen.length} trait${unseen.length > 1 ? 's' : ''} unseen`, icon: ICON.blind, kind: 'bad', detail: 'Detection below 50% at your level' }],
      why: 'your tools no longer read them at this level', go: { panel: 'research', tab: 'projects' }, goLabel: tool && tool.decay > 0.3 ? 'Tool upkeep' : 'Research lines',
    });
  }
  // 4. runway state will change at the next board review
  const rl = runwayLive(s);
  if (rl.flips && (rl.live === 'tight' || rl.live === 'distress')) {
    out.push({
      id: 'runway', sphere: 'company', sev: rl.live === 'distress' ? 4 : 2.5,
      chain: [{ label: 'burn exceeds income', icon: ICON.cash, kind: 'root', detail: `Net burn ${F.money(rl.rw.burnQ, { perQ: true })}` }, { label: `runway ${rl.live}`, icon: ICON.runway, kind: 'bad', detail: `${F.runway(rl.rw.q)} left` }],
      why: `the board reviews it on ${rl.review.toISOString().slice(0, 10)}`, go: { panel: 'finance', anchor: 'raise' }, goLabel: 'Finance',
    });
  }
  // 4b. (FIN2) one alert when an investor promise turns behind or a covenant nears (What we owe; no events, nothing to
  // click): the cause is the promise or covenant, the consequence what it would move if judged or tested today.
  const owe = whatWeOwe(s);
  if (owe.behind.length || owe.near.length) {
    const cov = owe.near[0];
    const pr = owe.behind[0];
    const root: WatchLink = cov
      ? { label: `${cov.label} ${cov.state === 'breach' ? 'failing' : 'near'}`, icon: ICON.debt, kind: 'root', detail: cov.rule }
      : { label: `${pr.p.by === 'parent' ? 'parent goal' : 'promise'} behind${owe.behind.length > 1 ? ` (${owe.behind.length})` : ''}`, icon: ICON.commitment, kind: 'root', detail: `${describeTarget(pr.p)}: ${F.pct(Math.max(0, pr.progress))} of the gain, ${F.pct(pr.neededProgress)} needed by now` };
    const sym: WatchLink = cov
      ? { label: cov.state === 'breach' ? 'breach at quarter end' : 'covenant at risk', icon: ICON.alert, kind: 'bad', detail: 'A breach at the quarter-end test means distress' }
      : pr.p.by === 'parent'
        ? { label: pr.ifJudgedNow.board < 0 ? `parent confidence ${Math.round(pr.ifJudgedNow.board)} if judged now` : 'goal at risk', icon: ICON.board, kind: 'bad', detail: `it sets the next budget; due in ${pr.daysLeft} d` }
        : { label: pr.ifJudgedNow.cred < 0 ? `credibility ${Math.round(pr.ifJudgedNow.cred)} if judged now` : 'promise at risk', icon: ICON.credibility, kind: 'bad', detail: `board ${Math.round(pr.ifJudgedNow.board)}; due in ${pr.daysLeft} d` };
    out.push({
      id: 'owe', sphere: 'company', sev: cov ? (cov.state === 'breach' ? 4 : 3) : 2.5, chain: [root, sym],
      why: cov ? 'tested at the next quarter end' : pr.p.by === 'parent' ? 'the parent judges it at its review' : 'investors judge it at its deadline', go: { panel: 'finance', tab: 'owe' }, goLabel: 'What we owe',
    });
  }
  // 5. (R6) eval suites no longer expire: the auto-evaluate policy keeps the internal model current, so the old
  // "evals older than 30 d" alert is gone (rule R7, no chores).
  // 6. board
  const bc = p.board.confidence;
  const dv = divisionView(s);
  if (dv && bc < 40 && bc >= 35) {
    // FIN5c: low parent confidence cuts the next budget; below the warning line the ouster item below takes over (the
    // parent's seats vote on removing you like any board's, C3).
    out.push({
      id: 'board', sphere: 'company', sev: 2.5,
      chain: [{ label: 'parent confidence low', icon: ICON.board, kind: 'root', detail: `Confidence ${Math.round(bc)} (the full budget needs 60)` }, { label: `next budget ${F.pct(dv.next.factor)} of plan`, icon: ICON.cash, kind: 'bad', detail: `≈ ${F.money(dv.next.budget)} of the ${F.money(dv.next.plan)} plan` }],
      why: `set at the parent review in ${Math.max(0, dv.reviewDay - s.time.day)} d: goals met and staying within budget restore it`, go: { panel: 'finance', tab: 'owners', anchor: 'board' }, goLabel: 'Parent budget',
    });
  } else if (bc < 40) {
    // Jank ST3: say when the board decides and what it needs.
    const br = boardReview(s);
    out.push({
      id: 'board', sphere: 'company', sev: bc < 30 ? 4 : 3,
      chain: [{ label: 'board confidence low', icon: ICON.board, kind: 'root', detail: `Confidence ${Math.round(bc)} (warning below 35, ouster risk below 25)` }, { label: br.live ? `ouster vote: ${br.vote.yes} of ${br.vote.total} for` : 'ouster risk', icon: ICON.alert, kind: 'bad', detail: br.passesBelow !== undefined ? `the vote passes below confidence ${Math.round(br.passesBelow)}` : 'no majority to remove you on this board' }],
      why: `board review in ${br.inDays} d: confidence ${Math.round(bc)}, needs ${br.line}+ to rule out a vote`, go: { panel: 'finance', anchor: 'board' }, goLabel: 'Board',
    });
  }
  // 7. morale
  if (p.morale.overall < 40) {
    out.push({
      id: 'morale', sphere: 'company', sev: 2,
      chain: [{ label: 'morale low', icon: ICON.morale, kind: 'root', detail: `Morale ${Math.round(p.morale.overall)}` }, { label: 'hiring slows', icon: ICON.staff, kind: 'bad' }],
      why: 'productivity drops and hiring slows', go: { panel: 'lab', tab: 'people' }, goLabel: 'People',
    });
  }
  // 8. an incident about to go public
  const inc = p.safety.incidents.find((i) => i.status === 'open' && i.publicTimerDays !== undefined && i.publicTimerDays <= 14);
  if (inc) {
    out.push({
      id: 'incident', sphere: 'safety', sev: 3 + inc.severity / 5,
      chain: [{ label: `incident S${inc.severity} open`, icon: ICON.incident, kind: 'root', detail: inc.apparent }, { label: `public in ${inc.publicTimerDays} d`, icon: ICON.headline, kind: 'bad' }],
      why: 'respond or disclose before it leaks', go: { panel: 'safety', tab: 'cases' }, goLabel: 'Incidents',
    });
  }
  return out.sort((a, b) => b.sev - a.sev);
}

// ───────── nav badges (moved from Nav.tsx so node scripts can read the alert channel) ─────────
const EVENT_PANEL: Record<string, string> = { finance: 'finance', company: 'lab', model: 'safety', incident: 'safety', research: 'safety', alert: 'risk', gov: 'powers', china: 'powers', rival: 'powers', public: 'powers', world: 'world', milestone: 'models', security: 'lab' };

/** Badge per nav id: number, '!' or undefined. */
export function navBadges(s: GameStateV2): Record<string, { n: string; tone: 'warn' | 'info' | 'bad' }> {
  const b: Record<string, { n: string; tone: 'warn' | 'info' | 'bad' }> = {};
  const w = watchItems(s);
  if (w.length) b.overview = { n: String(w.length), tone: w.some((x) => x.sev >= 3.5) ? 'bad' : 'warn' };
  const dec: Record<string, number> = {};
  for (const p of s.events.pending) { const id = EVENT_PANEL[eventDef(p.id)?.icon ?? ''] ?? 'overview'; dec[id] = (dec[id] ?? 0) + 1; }
  for (const [id, n] of Object.entries(dec)) if (id !== 'overview') b[id] = { n: String(n), tone: 'warn' };
  // Powers: a binding pledge waits for Honour, Amend or Break (the decision count above already holds its events).
  const binding = blockingCommitments(s).length;
  if (binding) b.powers = { n: String(Number(b.powers?.n ?? 0) + binding), tone: 'warn' };
  const fresh = s.player.safety.findings.filter((f) => s.time.day - f.day <= 30).length;
  if (fresh && !b.safety) b.safety = { n: String(fresh), tone: 'info' };
  const idleSci = idleTeams(s).length;
  if (idleSci) b.research = { n: String(idleSci), tone: 'warn' };
  // UB-5: LAB badge: idle compute (over 5% of compute online) or a short safety research-engineer need.
  if (!b.lab) {
    if (idleShares(s).total > 0.05) b.lab = { n: 'idle', tone: 'warn' };
    else if (safReAllocView(s).needs.some((n) => n.short >= 1)) b.lab = { n: 'short', tone: 'warn' };
  }
  if (w.some((x) => x.id === 'idle') && !b.compute) b.compute = { n: '!', tone: 'warn' };
  if (w.some((x) => x.id === 'capped') && !b.products) b.products = { n: '!', tone: 'warn' };
  return b;
}
