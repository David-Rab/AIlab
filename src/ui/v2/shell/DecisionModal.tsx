// Decision modal (§4, §6.5 severity 4–5): event card with terse text, deadline, and each choice's cost/gain preview.
// Also the acknowledgement card for severity 4–5 log entries.
import { AlertTriangle } from 'lucide-react';
import { eventDef } from '../../../engine/v2';
import type { GameStateV2 } from '../../../engine/v2';
import { KIND_COLOR, KIND_ICON } from '../../components';
import { store } from '../store';
import { ChoiceBtn, Rich } from '../ui';
import { KIND_PANEL } from './AlertQueue';

export function DecisionModal({ s }: { s: GameStateV2 }) {
  const p = s.events.pending.find((x) => x.instance === store.modal);
  if (!p) {
    const n = store.notices[0];
    if (!n) return null;
    const Icon = KIND_ICON[n.kind] ?? AlertTriangle;
    return (
      <div className="modal-backdrop">
        <div className="modal" data-test="notice">
          <div className="modal-head">
            <Icon size={18} style={{ color: KIND_COLOR[n.kind] }} />
            <div className="modal-title">{n.kind} · severity {n.severity}</div>
          </div>
          <div className="modal-text"><Rich text={n.text} /></div>
          <div className="btn-row">
            <button className="btn" data-test="notice-go" onClick={() => { store.ackNotice(); store.setPanel(KIND_PANEL[n.kind] ?? 'map'); }}>Open panel</button>
            <button className="btn btn-primary" data-test="notice-ok" onClick={() => store.ackNotice()}>OK</button>
          </div>
        </div>
      </div>
    );
  }
  const def = eventDef(p.id);
  if (!def) return null;
  let text = '';
  try {
    text = def.text(s, p.data);
  } catch {
    text = def.title;
  }
  const Icon = KIND_ICON[def.icon] ?? AlertTriangle;
  const left = p.deadline - s.time.day;
  return (
    <div className="modal-backdrop">
      <div className={`modal decision ${p.crisis ? 'crisis' : ''}`} data-test="decision" data-event={p.id}>
        <div className="modal-head">
          <Icon size={18} style={{ color: KIND_COLOR[def.icon] }} />
          <div className="modal-title">{def.title}</div>
          {p.crisis && <span className="chip-mini tone-neg">crisis</span>}
          <span className={`chip-mini num ${left <= 3 ? 'tone-neg' : ''}`}>{left} d left</span>
        </div>
        <div className="modal-text"><Rich text={text} /></div>
        <div className="modal-choices">
          {def.choices.map((_, i) => <ChoiceBtn key={i} s={s} eventId={def.id} instance={p.instance} idx={i} isDefault={i === def.defaultChoice} />)}
        </div>
        <div className="modal-foot">
          <span className="dim small">On expiry: {def.choices[def.defaultChoice]?.label}</span>
          <button className="btn btn-sm btn-ghost" data-test="later" onClick={() => store.openDecision(undefined)}>Later</button>
        </div>
      </div>
    </div>
  );
}
