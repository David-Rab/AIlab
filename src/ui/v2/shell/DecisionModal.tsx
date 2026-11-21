// Decision modal v2 (PROPOSALS §7): sphere tag and ring timer; "why this happened" cause chain (from the matching
// Watch rule); choice cards with before→after bars on the meters they touch; "lasting fixes" Go buttons; keys 1/2/3
// choose, Esc = later. Also the acknowledgement card for severity 4–5 log entries.
import { useEffect } from 'react';
import { choiceView, choiceVote, eventDef } from '../../../engine/v2';
import type { GameStateV2 } from '../../../engine/v2';
import { store } from '../store';
import { Rich, VoteStrip } from '../ui';
import { ActionCard, CauseChain, GoBtn, type GoTarget } from '../kit';
import { ICON } from '../icons';
import { KIND_ICON, kindTag, logRoute, openRoute, Ring } from './AlertQueue';
import { watchItems } from './watch';

/** Which Watch rules explain an event, by event id first, then by its kind. */
const WHY_BY_EVENT: Record<string, string[]> = { E17: ['unseen'], E01: ['unseen'] };
const WHY_BY_KIND: Record<string, string[]> = { finance: ['runway', 'board'], company: ['morale', 'idle'], model: ['unseen', 'stale'], incident: ['incident', 'unseen'], research: ['unseen'], alert: ['unseen', 'incident'] };
/** Lasting fixes per kind when no Watch rule matches. */
const FIXES: Record<string, { to: GoTarget; label: string }[]> = {
  finance: [{ to: { panel: 'finance', anchor: 'raise' }, label: 'Raise capital' }, { to: { panel: 'finance', anchor: 'ledger' }, label: 'Cut contracts' }],
  company: [{ to: { panel: 'company', tab: 'people' }, label: 'People' }, { to: { panel: 'compute', tab: 'split' }, label: 'Compute split' }],
  model: [{ to: { panel: 'safety', tab: 'graph' }, label: 'Trait graph' }, { to: { panel: 'blueprint' }, label: 'Safer recipe' }],
  incident: [{ to: { panel: 'safety', tab: 'cases' }, label: 'Incident responses' }, { to: { panel: 'company', tab: 'people', anchor: 'agents' }, label: 'Monitors' }],
  gov: [{ to: { panel: 'relations' }, label: 'Government relations' }],
  public: [{ to: { panel: 'relations' }, label: 'Public' }],
  china: [{ to: { panel: 'relations' }, label: 'China' }, { to: { panel: 'company', tab: 'security' }, label: 'Security' }],
  rival: [{ to: { panel: 'overview', anchor: 'leadtrack' }, label: 'Lead track' }],
  world: [{ to: { panel: 'world' }, label: 'World' }],
};

/** Jank E1: what the default choice means when its cost is not obvious from its lines. */
const DEFAULT_NOTE: Record<string, string> = { E32: 'if it is still failing next quarter, a big-tech lab buys it or it shuts down' };

export function DecisionModal({ s }: { s: GameStateV2 }) {
  const p = s.events.pending.find((x) => x.instance === store.modal);
  const def = p ? eventDef(p.id) : undefined;
  useEffect(() => {
    if (!p || !def) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { store.openDecision(undefined); return; }
      const n = Number(e.key);
      if (n >= 1 && n <= def.choices.length && choiceView(s, def.id, n - 1, p.data).ok === true) store.resolve(p.instance, n - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [p?.instance]);
  if (!p) {
    const n = store.notices[0];
    if (!n) return null;
    const Icon = KIND_ICON[n.kind] ?? ICON.alert;
    return (
      <div className="modal-backdrop">
        <div className="modal dm2" data-test="notice">
          <div className="dm2-hd"><span className="dm2-ic"><Icon size={18} /></span><div><div className="dm2-ttl">{logRoute(s, n).tag} · severity {n.severity}</div></div></div>
          <div className="dm2-text"><Rich text={n.text} /></div>
          <div className="btn-row">
            <span className="sp" />
            <button className="btn" data-test="notice-go" onClick={() => { const r = logRoute(s, n); store.ackNotice(); openRoute(r); }}>Open panel</button>
            <button className="btn btn-primary" data-test="notice-ok" onClick={() => store.ackNotice()}>OK</button>
          </div>
        </div>
      </div>
    );
  }
  if (!def) return null;
  let text = '';
  try {
    text = def.text(s, p.data);
  } catch {
    text = def.title;
  }
  const Icon = KIND_ICON[def.icon] ?? ICON.decision;
  const left = p.deadline - s.time.day;
  const ids = WHY_BY_EVENT[def.id] ?? WHY_BY_KIND[def.icon] ?? [];
  const why = watchItems(s).filter((w) => ids.includes(w.id));
  const fixes = why.length ? why.map((w) => ({ to: w.go, label: w.goLabel })) : FIXES[def.icon] ?? [];
  return (
    <div className="modal-backdrop">
      <div className={`modal dm2 ${p.crisis ? 'crisis' : ''}`} data-test="decision" data-event={p.id}>
        <div className="dm2-hd">
          <span className="dm2-ic"><Icon size={20} /></span>
          <div className="dm2-title">
            <div className="dm2-ttl">{def.title}</div>
            <div className="dm2-text"><Rich text={text} /></div>
          </div>
          <span className="tag2">{kindTag(def.icon)}</span>
          {p.crisis && <span className="tag2 bad">crisis</span>}
          <span className="dm2-ring" title={`${left} days left`}><Ring left={left} total={def.deadlineDays} size={38} /><b className="num">{left}d</b></span>
        </div>
        {why.length > 0 && (
          <div className="dm2-why">
            <div className="tip-cap">Why this happened</div>
            {why.map((w) => <div key={w.id} className="dm2-chain"><CauseChain links={w.chain.map((c) => ({ label: c.label, icon: c.icon, kind: c.kind }))} /><span className="dim small">{w.why}</span></div>)}
          </div>
        )}
        <div className="dm2-choices" style={{ gridTemplateColumns: `repeat(${Math.min(3, def.choices.length)}, minmax(0, 1fr))` }}>
          {def.choices.map((c, i) => {
            const v = choiceView(s, def.id, i, p.data);
            // FIN3c: a choice that is a major decision (a merger) shows the board's vote under its card, seat by seat.
            const vote = choiceVote(s, def.id, i, p.data);
            const card = (
              <ActionCard key={i} s={s} v={v} keyHint={String(i + 1)} isDefault={i === def.defaultChoice} disabled={v.ok === true ? undefined : v.ok}
                onClick={() => store.resolve(p.instance, i)} testAttr={{ choice: i }}
                note={i === def.defaultChoice ? `${DEFAULT_NOTE[def.id] ? `${DEFAULT_NOTE[def.id]} · ` : ''}happens on its own in ${left} d` : c.tags?.includes('secrecy') ? 'hidden flaws found later cost three times the trust' : undefined} />
            );
            return vote ? <div key={i} className="dm2-choice">{card}<VoteStrip v={vote} /></div> : card;
          })}
        </div>
        <div className="dm2-foot">
          {fixes.length > 0 && <><span className="tip-cap">Lasting fixes</span>{fixes.map((f, i) => <span key={i} onClick={() => store.openDecision(undefined)}><GoBtn to={f.to} label={f.label} testId={`fix.${i}`} /></span>)}</>}
          <span className="sp" />
          <button className="btn btn-sm" data-test="later" onClick={() => store.openDecision(undefined)}>Later <span className="kbd">Esc</span></button>
        </div>
      </div>
    </div>
  );
}
