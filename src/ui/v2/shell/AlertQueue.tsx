// Bottom bar (§6.5): decision queue with deadline chips, alert chips (severity ≥ 2, same kind within 7 d collapsed),
// tutorial coach cards (§6.8), and the headline ticker (severity 1). One alert channel.
import { useState } from 'react';
import { AlertTriangle, GraduationCap } from 'lucide-react';
import { eventDef, fmtDate, dateOf } from '../../../engine/v2';
import type { GameStateV2, LogEntry } from '../../../engine/v2';
import { KIND_COLOR, KIND_ICON } from '../../components';
import { store } from '../store';
import { Tip, TipCard } from '../ui';
import { Ticker } from './Ticker';

export const KIND_PANEL: Record<string, string> = {
  incident: 'safety', research: 'safety', finance: 'finance', gov: 'relations', china: 'relations', rival: 'relations', public: 'relations',
  world: 'world', company: 'departments', milestone: 'models', alert: 'risk', news: 'world',
};

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

const KIND_WORD: Record<string, string> = { incident: 'incidents', research: 'findings', finance: 'finance', gov: 'government', china: 'China', rival: 'rivals', public: 'public', world: 'world', company: 'company', milestone: 'milestones', alert: 'alerts', news: 'news' };

/** Coach cards (§6.8 act 1 script), shown until opened. */
function coach(s: GameStateV2): { id: string; text: string; panel: string }[] {
  if (!s.setup.tutorial) return [];
  const out: { id: string; text: string; panel: string }[] = [];
  if (!s.tutorial.seen.includes('firstRun') && !s.player.models.runs.some((r) => r.kind === 'post' && r.startDay >= 0)) out.push({ id: 'firstRun', text: 'Your first run: post-train', panel: 'rundesigner' });
  if (s.time.day >= 60 && !s.tutorial.seen.includes('finTour')) out.push({ id: 'finTour', text: 'Finance: raise ceiling', panel: 'finance' });
  if (s.tutorial.act >= 2 && !s.tutorial.seen.includes('act2')) out.push({ id: 'act2', text: 'Act 2: chips and base runs', panel: 'compute' });
  if (s.tutorial.act >= 3 && !s.tutorial.seen.includes('act3')) out.push({ id: 'act3', text: 'Act 3: AI labour, China', panel: 'world' });
  if (s.tutorial.act >= 4 && !s.tutorial.seen.includes('act4')) out.push({ id: 'act4', text: 'Act 4: risk sources', panel: 'risk' });
  return out;
}

export function AlertQueue({ s }: { s: GameStateV2 }) {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const pend = [...s.events.pending].sort((a, b) => a.deadline - b.deadline);
  const groups = alertGroups(s).filter((g) => !dismissed.includes(g.key)).slice(0, 8);
  return (
    <div className="bottombar">
      <div className="queue-row" data-test="queue">
        {coach(s).map((c) => (
          <button key={c.id} className="coach-chip" data-coach={c.id} onClick={() => { s.tutorial.seen.push(c.id); store.setPanel(c.panel); }}>
            <GraduationCap size={13} /> {c.text}
          </button>
        ))}
        {pend.map((p) => {
          const def = eventDef(p.id);
          const left = p.deadline - s.time.day;
          const Icon = KIND_ICON[def?.icon ?? 'alert'] ?? AlertTriangle;
          return (
            <Tip key={p.instance} content={() => <TipCard title={def?.title ?? p.id} value={`${left} d left`}>{`Default on expiry: ${def?.choices[def.defaultChoice]?.label ?? '—'}. Click to decide.`}</TipCard>}>
              <button className={`dec-chip ${p.crisis ? 'crisis' : ''}`} data-decision={p.instance} onClick={() => store.openDecision(p.instance)}>
                <Icon size={13} style={{ color: KIND_COLOR[def?.icon ?? 'alert'] }} />
                <span>{def?.title ?? p.id}</span>
                <span className={`deadline num ${left <= 3 ? 'tone-neg' : left <= 7 ? 'tone-warn' : 'dim'}`}>{left}d</span>
              </button>
            </Tip>
          );
        })}
        {groups.map((g) => {
          const Icon = KIND_ICON[g.kind] ?? AlertTriangle;
          const label = g.items.length > 1 ? `${g.items.length} ${KIND_WORD[g.kind] ?? g.kind}` : g.items[0].text;
          return (
            <Tip key={g.key} content={() => (
              <TipCard title={`${KIND_WORD[g.kind] ?? g.kind}`} value={`sev ${g.sev}`} rows={g.items.slice(-6).map((e) => ({ label: <span className="small">{e.text}</span>, value: <span className="dim small">{fmtDate(dateOf(s, e.day))}{e.ref ? ` · ${e.ref}` : ''}</span> }))}>
                Click to open the panel; right-click to dismiss.
              </TipCard>
            )}>
              <button
                className={`alert-chip sev-${g.sev}`}
                data-alert={g.kind}
                onClick={() => store.setPanel(KIND_PANEL[g.kind] ?? 'map')}
                onContextMenu={(e) => { e.preventDefault(); setDismissed((h) => [...h, g.key]); }}
              >
                <Icon size={12} style={{ color: KIND_COLOR[g.kind] }} />
                <span className="ellip">{label}</span>
              </button>
            </Tip>
          );
        })}
        {!pend.length && !groups.length && <span className="dim small">No decisions or alerts</span>}
        {store.flash && performance.now() - store.flash.at < 6000 && <span className={`flash tone-${store.flash.tone}`} data-test="flash">{store.flash.text}</span>}
      </div>
      <Ticker s={s} />
    </div>
  );
}
