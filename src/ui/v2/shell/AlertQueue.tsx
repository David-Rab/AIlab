// Bottom bar (IA.md L0 item 7, §6.5): decision chips with ring timers; ONE collapsed alert chip (sev ≥ 2, list on
// hover, right-click dismisses); the latest headline (list on hover). Failed player actions flash and never enter
// the headline stream.
import { useState } from 'react';
import { dateOf, eventDef, fmtDate, fmtMonth, isCapProject } from '../../../engine/v2';
import { PROJECT_BY_ID } from '../../../data/v2/tree';
import type { GameStateV2, LogEntry } from '../../../engine/v2';
import { store } from '../store';
import { Rich, Tip, TipCard } from '../ui';
import { ICON } from '../icons';
import { watchItems } from './watch';
import { runText } from '../fmt';
import { C } from '../theme';

export const KIND_PANEL: Record<string, string> = {
  incident: 'safety', research: 'safety', finance: 'finance', gov: 'powers', china: 'powers', rival: 'powers', public: 'powers',
  world: 'world', company: 'lab', milestone: 'models', alert: 'risk', news: 'world', model: 'safety', security: 'lab',
};
export const KIND_ICON: Record<string, typeof ICON.alert> = {
  incident: ICON.incident, research: ICON.finding, finance: ICON.finance, gov: ICON.exec, china: ICON.china, rival: ICON.rival, public: ICON.public,
  world: ICON.world, company: ICON.company, milestone: ICON.milestone, alert: ICON.alert, news: ICON.headline, model: ICON.models, security: ICON.securityEvent,
};
const KIND_TAG: Record<string, string> = { incident: 'SAFETY', research: 'SAFETY', model: 'SAFETY', finance: 'FINANCE', company: 'COMPANY', gov: 'GOVERNMENT', china: 'CHINA', rival: 'RIVALS', public: 'PUBLIC', world: 'WORLD', milestone: 'MODELS', alert: 'RISK', security: 'SECURITY' };
export const kindTag = (k: string) => KIND_TAG[k] ?? k.toUpperCase();

/** B4: where a log entry opens. Entries of kind `research` go to Safety (lines, tools, findings, investigations) except
 *  capability ones: a capability project's result opens its card on Research › Projects, a run, base or version opens
 *  Models (their home). Everything else by kind (KIND_PANEL). */
export interface LogRoute { key: string; panel: string; tab?: string; projectId?: string; tag: string }
export function logRoute(s: GameStateV2, e: Pick<LogEntry, 'kind' | 'ref'>): LogRoute {
  if (e.kind === 'research' && e.ref) {
    if (isCapProject(PROJECT_BY_ID[e.ref])) return { key: 'research.cap', panel: 'research', tab: 'projects', projectId: e.ref, tag: 'RESEARCH' };
    const m = s.player.models;
    if (m.runs.some((r) => r.id === e.ref) || m.bases.some((b) => b.id === e.ref) || m.versions.some((v) => v.id === e.ref)) return { key: 'research.models', panel: 'models', tag: 'MODELS' };
  }
  return { key: e.kind, panel: KIND_PANEL[e.kind] ?? 'overview', tag: kindTag(e.kind) };
}
export function openRoute(r: LogRoute) {
  if (r.projectId) store.setTab('research.drawer', r.projectId);
  store.goto(r.panel, r.tab ? { tab: r.tab } : {});
}

interface AlertGroup { key: string; kind: string; route: LogRoute; items: LogEntry[]; sev: number; last: number }
export function alertGroups(s: GameStateV2): AlertGroup[] {
  const out: AlertGroup[] = [];
  const from = s.time.day - 30;
  for (const e of s.log) {
    if (e.day < from || (e.severity ?? 1) < 2) continue;
    const route = logRoute(s, e);
    const g = out.find((x) => x.route.key === route.key && (route.projectId === undefined || x.route.projectId === route.projectId) && e.day - x.last <= 7);
    if (g) {
      g.items.push(e);
      g.last = e.day;
      g.sev = Math.max(g.sev, e.severity ?? 2);
    } else out.push({ key: `${route.key}${route.projectId ? '.' + route.projectId : ''}@${e.day}`, kind: e.kind, route, items: [e], sev: e.severity ?? 2, last: e.day });
  }
  return out.sort((a, b) => b.sev - a.sev || b.last - a.last);
}

/** Ring timer: fraction of the decision window left. */
export function Ring({ left, total, size = 20 }: { left: number; total: number; size?: number }) {
  const r = size / 2 - 2;
  const f = Math.max(0, Math.min(1, left / Math.max(1, total)));
  const a = 2 * Math.PI * f;
  const x = size / 2 + r * Math.sin(a);
  const y = size / 2 - r * Math.cos(a);
  const col = left <= 3 ? C.bad : left <= 7 ? C.watch : C.und;
  return (
    <svg width={size} height={size} className="ring">
      <circle cx={size / 2} cy={size / 2} r={r} stroke={C.line2} strokeWidth={2.5} fill="none" />
      {f >= 0.999 ? <circle cx={size / 2} cy={size / 2} r={r} stroke={col} strokeWidth={2.5} fill="none" /> : <path d={`M${size / 2} ${size / 2 - r} A${r} ${r} 0 ${f > 0.5 ? 1 : 0} 1 ${x} ${y}`} stroke={col} strokeWidth={2.5} fill="none" />}
    </svg>
  );
}

export function AlertQueue({ s }: { s: GameStateV2 }) {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const watch = watchItems(s);
  const pend = [...s.events.pending].sort((a, b) => a.deadline - b.deadline);
  const groups = alertGroups(s).filter((g) => !dismissed.includes(g.key));
  const nAlerts = groups.reduce((a, g) => a + g.items.length, 0);
  const sevMax = groups.reduce((a, g) => Math.max(a, g.sev), 0);
  const heads = [
    ...s.headlines.slice(-12).map((h) => ({ day: h.day, text: h.text })),
    ...s.log.filter((e) => (e.severity ?? 1) <= 1 && e.kind !== 'company').slice(-8).map((e) => ({ day: e.day, text: runText(e.text) })),
  ].sort((a, b) => b.day - a.day).filter((x, i, arr) => i === 0 || x.text !== arr[i - 1].text).slice(0, 12);
  return (
    <div className="bottombar2">
      <div className="queue-row" data-test="queue">
        {pend.map((p) => {
          const def = eventDef(p.id);
          const left = p.deadline - s.time.day;
          const Icon = KIND_ICON[def?.icon ?? 'alert'] ?? ICON.decision;
          return (
            <Tip key={p.instance} content={() => <TipCard title={def?.title ?? p.id} value={`${left} d left`}>{`On expiry: ${def?.choices[def.defaultChoice]?.label ?? '—'}. Click to decide.`}</TipCard>}>
              <button className={`dec-chip2 ${p.crisis ? 'crisis' : ''}`} data-decision={p.instance} onClick={() => store.openDecision(p.instance)}>
                <Ring left={left} total={def?.deadlineDays ?? 14} />
                <Icon size={14} />
                <b>{def?.title ?? p.id}</b>
                <span className={`num small ${left <= 3 ? 'tone-neg' : left <= 7 ? 'tone-warn' : 'dim'}`}>{left}d</span>
              </button>
            </Tip>
          );
        })}
        {/* Jank O2: one alert channel. The chip opens a list: Watch items (cause → fix, the same as the Overview's Watch)
            first, then the last 30 days' alerts, each with a jump and a visible Clear. */}
        {(nAlerts > 0 || watch.length > 0) && (
          <span className="alert-wrap">
            <button className={`alert-chip2 sev-${Math.max(sevMax, watch.length ? 3 : 0)}`} data-alert={groups[0]?.kind ?? 'watch'} data-test="alert-chip" onClick={() => setOpen(!open)}
              onContextMenu={(e) => { e.preventDefault(); setDismissed((h) => [...h, ...groups.map((g) => g.key)]); }}>
              <ICON.alerts size={14} /> {watch.length > 0 && <>{watch.length} to watch</>}{watch.length > 0 && nAlerts > 0 && ' · '}{nAlerts > 0 && <>{nAlerts} alert{nAlerts > 1 ? 's' : ''}</>}
            </button>
            {open && (
              <div className="alert-pop" data-test="alert-list">
                {watch.length > 0 && <div className="tip-cap">Watch · cause → fix</div>}
                {watch.map((w) => (
                  <div key={w.id} className="alert-row" data-watch-row={w.id}>
                    <span className="small"><b>{w.chain[0]?.label}</b> <span className="dim">{w.why}</span></span>
                    <span className="sp" />
                    <button className="btn btn-sm" onClick={() => { setOpen(false); store.goto(w.go.panel, w.go); }}>{w.goLabel} ›</button>
                  </div>
                ))}
                {groups.length > 0 && <div className="tip-cap">Alerts · 30 d</div>}
                {groups.slice(0, 8).map((g) => {
                  const I = KIND_ICON[g.kind] ?? ICON.alert;
                  const e = g.items[g.items.length - 1];
                  return (
                    <div key={g.key} className="alert-row" data-alert-row={g.kind} data-route={g.route.panel + (g.route.tab ? '.' + g.route.tab : '')}>
                      <span className="small"><I size={11} /> {runText(e.text)}{g.items.length > 1 ? <span className="dim"> (+{g.items.length - 1})</span> : null} <span className="dim">· {fmtDate(dateOf(s, e.day))}</span></span>
                      <span className="sp" />
                      <button className="btn btn-sm btn-ghost" data-test="alert-open" onClick={() => { setOpen(false); openRoute(g.route); }}>Open ›</button>
                    </div>
                  );
                })}
                <div className="btn-row">
                  {groups.length > 0 && <button className="btn btn-sm" data-test="alerts-clear" onClick={() => { setDismissed((h) => [...h, ...groups.map((g) => g.key)]); setOpen(false); }}>Clear alerts</button>}
                  <span className="sp" />
                  <button className="btn btn-sm btn-ghost" onClick={() => setOpen(false)}>Close</button>
                </div>
              </div>
            )}
          </span>
        )}
        {!pend.length && !nAlerts && !watch.length && <span className="dim small">No decisions or alerts</span>}
        {store.flash && performance.now() - store.flash.at < 6000 && <span className={`flash tone-${store.flash.tone}`} data-test="flash">{store.flash.text}</span>}
        <span className="sp" />
        {heads[0] && (
          <Tip as="div" className="headline" content={() => <TipCard title="Headlines" rows={heads.map((i) => ({ label: <span className="small"><Rich text={i.text} /></span>, value: <span className="dim small">{fmtMonth(dateOf(s, i.day))}</span> }))} />}>
            <span className="headline-in" data-test="ticker"><ICON.headline size={14} /> <span className="ellip">{heads[0].text}</span></span>
          </Tip>
        )}
      </div>
    </div>
  );
}
