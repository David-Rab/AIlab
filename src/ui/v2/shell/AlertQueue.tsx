// Bottom bar (IA.md L0 item 7, §6.5): decision chips with ring timers; ONE collapsed alert chip (sev ≥ 2, list on
// hover, right-click dismisses); the latest headline (list on hover). Failed player actions flash and never enter
// the headline stream.
import { useState } from 'react';
import { dateOf, eventDef, fmtDate, fmtMonth } from '../../../engine/v2';
import type { GameStateV2, LogEntry } from '../../../engine/v2';
import { store } from '../store';
import { Rich, Tip, TipCard } from '../ui';
import { ICON } from '../icons';
import { C } from '../theme';

export const KIND_PANEL: Record<string, string> = {
  incident: 'safety', research: 'safety', finance: 'finance', gov: 'relations', china: 'relations', rival: 'relations', public: 'relations',
  world: 'world', company: 'company', milestone: 'models', alert: 'risk', news: 'world', model: 'safety', security: 'company',
};
export const KIND_ICON: Record<string, typeof ICON.alert> = {
  incident: ICON.incident, research: ICON.finding, finance: ICON.finance, gov: ICON.exec, china: ICON.china, rival: ICON.rival, public: ICON.public,
  world: ICON.world, company: ICON.company, milestone: ICON.milestone, alert: ICON.alert, news: ICON.headline, model: ICON.models, security: ICON.securityEvent,
};
const KIND_TAG: Record<string, string> = { incident: 'SAFETY', research: 'SAFETY', model: 'SAFETY', finance: 'FINANCE', company: 'COMPANY', gov: 'GOVERNMENT', china: 'CHINA', rival: 'RIVALS', public: 'PUBLIC', world: 'WORLD', milestone: 'MODELS', alert: 'RISK', security: 'SECURITY' };
export const kindTag = (k: string) => KIND_TAG[k] ?? k.toUpperCase();

interface AlertGroup { key: string; kind: string; items: LogEntry[]; sev: number; last: number }
export function alertGroups(s: GameStateV2): AlertGroup[] {
  const out: AlertGroup[] = [];
  const from = s.time.day - 30;
  for (const e of s.log) {
    if (e.day < from || (e.severity ?? 1) < 2) continue;
    const g = out.find((x) => x.kind === e.kind && e.day - x.last <= 7);
    if (g) {
      g.items.push(e);
      g.last = e.day;
      g.sev = Math.max(g.sev, e.severity ?? 2);
    } else out.push({ key: `${e.kind}@${e.day}`, kind: e.kind, items: [e], sev: e.severity ?? 2, last: e.day });
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
  const pend = [...s.events.pending].sort((a, b) => a.deadline - b.deadline);
  const groups = alertGroups(s).filter((g) => !dismissed.includes(g.key));
  const nAlerts = groups.reduce((a, g) => a + g.items.length, 0);
  const sevMax = groups.reduce((a, g) => Math.max(a, g.sev), 0);
  const heads = [
    ...s.headlines.slice(-12).map((h) => ({ day: h.day, text: h.text })),
    ...s.log.filter((e) => (e.severity ?? 1) <= 1 && e.kind !== 'company').slice(-8).map((e) => ({ day: e.day, text: e.text })),
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
        {nAlerts > 0 && (
          <Tip content={() => (
            <TipCard title={`${nAlerts} alert${nAlerts > 1 ? 's' : ''} · 30 d`} rows={groups.slice(0, 10).flatMap((g) => g.items.slice(-2).map((e) => {
              const I = KIND_ICON[g.kind] ?? ICON.alert;
              return { label: <span className="small"><I size={11} /> {e.text}</span>, value: <span className="dim small">{fmtDate(dateOf(s, e.day))}</span> };
            }))}>Click to open the most urgent one's panel; right-click to clear.</TipCard>
          )}>
            <button className={`alert-chip2 sev-${sevMax}`} data-alert={groups[0].kind} onClick={() => store.setPanel(KIND_PANEL[groups[0].kind] ?? 'overview')}
              onContextMenu={(e) => { e.preventDefault(); setDismissed((h) => [...h, ...groups.map((g) => g.key)]); }}>
              <ICON.alerts size={14} /> {nAlerts} alert{nAlerts > 1 ? 's' : ''}
            </button>
          </Tip>
        )}
        {!pend.length && !nAlerts && <span className="dim small">No decisions or alerts</span>}
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
