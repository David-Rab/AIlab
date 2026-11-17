// Watch rules (IA.md L1, PLAN U1.10): each rule reads visible selectors only and yields a cause chain
// (root ▸ symptom), a consequence line and a Go target to the control that fixes it. UI-only; no engine state.
import type { LucideIcon } from 'lucide-react';
import { engine, idleChips, internalVersion, revenueReadout, safetyView } from '../../../engine/v2';
import type { GameStateV2 } from '../../../engine/v2';
import { CRITICAL_TRAITS } from '../../../data/v2/traits';
import { ICON } from '../icons';
import * as F from '../fmt';
import type { GoTarget } from '../kit';
import { runwayLive } from './TopStrip';

export interface WatchLink { label: string; icon?: LucideIcon; kind: 'root' | 'bad'; detail?: string }
export interface WatchItem { id: string; sphere: 'company' | 'models' | 'safety' | 'world'; sev: number; chain: WatchLink[]; why: string; go: GoTarget; goLabel: string }

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
  // 2. products capped by serving capacity (R6: what the Auto split cuts, lowest $ per H100e first)
  const rd = revenueReadout(s);
  const capped = rd.deps.filter((d) => d.bound === 'capacity');
  if (capped.length) {
    const cutH = rd.deps.reduce((a, d) => a + d.cutH100e, 0);
    out.push({
      id: 'capped', sphere: 'models', sev: 2 + Math.min(2, (rd.demand - rd.total) / Math.max(1, rd.total)),
      chain: [{ label: 'serving compute short', icon: ICON.serving, kind: 'root', detail: `Serving pool gets ${F.pct(p.split.serving)} of compute; ${p.policies.servingAuto ? 'Auto' : 'your shares'} cut ${F.count(cutH)} H100e` }, { label: `${capped.length} product${capped.length > 1 ? 's' : ''} capped`, icon: ICON.product, kind: 'bad', detail: `Demand ${F.money(rd.demand, { perYear: true })} vs capacity ${F.money(rd.capacity, { perYear: true })}` }],
      why: 'demand you are not booking', go: { panel: 'compute', tab: 'split', anchor: 'split-serving' }, goLabel: 'Split',
    });
  }
  // 3. critical traits the stack can no longer read at L
  const u = engine.understanding(s);
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
      why: 'your tools no longer read them at this level', go: { panel: 'safety', tab: 'lines' }, goLabel: tool && tool.decay > 0.3 ? 'Tool upkeep' : 'Research lines',
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
  // 5. (R6) eval suites no longer expire: the auto-evaluate policy keeps the internal model current, so the old
  // "evals older than 30 d" alert is gone (rule R7, no chores).
  // 6. board
  const bc = p.board.confidence;
  if (bc < 40) {
    out.push({
      id: 'board', sphere: 'company', sev: bc < 30 ? 4 : 3,
      chain: [{ label: 'board confidence low', icon: ICON.board, kind: 'root', detail: `Confidence ${Math.round(bc)} (warning below 35, ouster risk below 25)` }, { label: 'ouster risk', icon: ICON.alert, kind: 'bad' }],
      why: 'missed plans, burn and incidents erode it', go: { panel: 'finance', anchor: 'board' }, goLabel: 'Board',
    });
  }
  // 7. morale
  if (p.morale.overall < 40) {
    out.push({
      id: 'morale', sphere: 'company', sev: 2,
      chain: [{ label: 'morale low', icon: ICON.morale, kind: 'root', detail: `Morale ${Math.round(p.morale.overall)}` }, { label: 'staff leaving', icon: ICON.staff, kind: 'bad' }],
      why: 'productivity drops and attrition rises', go: { panel: 'company', tab: 'people' }, goLabel: 'People',
    });
  }
  // 8. an incident about to go public
  const inc = p.safety.incidents.find((i) => i.status === 'open' && i.publicTimerDays !== undefined && i.publicTimerDays <= 14);
  if (inc) {
    out.push({
      id: 'incident', sphere: 'safety', sev: 3 + inc.severity / 5,
      chain: [{ label: `incident S${inc.severity} open`, icon: ICON.incident, kind: 'root', detail: inc.apparent }, { label: `public in ${inc.publicTimerDays} d`, icon: ICON.headline, kind: 'bad' }],
      why: 'respond or disclose before it leaks', go: { panel: 'safety', tab: 'incidents' }, goLabel: 'Incidents',
    });
  }
  return out.sort((a, b) => b.sev - a.sev);
}
