// Onboarding for the first 15 minutes (PROPOSALS §8): goals card (Overview, acts 1–2), coach cards with a spotlight
// (4 in act 1, one per later act), the quarter recap (tutorial on), and the help overlay. Nothing is forced.
import { useLayoutEffect, useState, type ReactNode } from 'react';
import { causeStrip, dateOf, fmtDate } from '../../../engine/v2';
import type { GameStateV2 } from '../../../engine/v2';
import { store, useV2 } from '../store';
import { ACT_NAMES, Term, UNLOCK_ACT } from '../ui';
import { Card, GoBtn, type GoTarget } from '../kit';
import * as F from '../fmt';
import { ICON } from '../icons';
import { NAV } from './Nav';
import { ACT_TRIGGER } from './TopStrip';

const seen = (s: GameStateV2, id: string) => s.tutorial.seen.includes(id);
export const markSeen = (s: GameStateV2, id: string) => { if (!seen(s, id)) s.tutorial.seen.push(id); };

interface Goal { id: string; text: ReactNode; done: boolean; go?: GoTarget; goLabel?: string }
function goals(s: GameStateV2): Goal[] {
  const p = s.player;
  const postLaunched = p.models.runs.some((r) => r.kind === 'post' && r.startDay >= 0);
  const postDone = p.models.runs.some((r) => r.kind === 'post' && r.startDay >= 0 && r.status === 'done');
  if (s.tutorial.act <= 1) {
    return [
      { id: 'race', text: <>Read the race: <Term id="L">capability</Term> vs <Term id="sightLimit">sight limit</Term></>, done: seen(s, 'coach:race') || seen(s, 'coach:skip') },
      { id: 'run', text: 'Launch a post-training run', done: postLaunched, go: { panel: 'blueprint' }, goLabel: 'Blueprint' },
      { id: 'ff', text: <>Fast-forward to the result <span className="kbd">F</span></>, done: postDone },
      { id: 'finding', text: 'Decide on your first finding', done: s.decisions.some((d) => d.eventId === 'E01') },
      { id: 'runway', text: <>Check how long the money lasts (<Term id="runway">runway</Term>)</>, done: seen(s, 'panel:finance'), go: { panel: 'finance' }, goLabel: 'Finance' },
      { id: 'ship', text: <>Put a new model on a <Term id="product">product</Term></>, done: p.deployments.some((d) => d.channel !== 'internal' && ((d.versionSince ?? d.startDay) > 0 || d.startDay > 0)), go: { panel: 'products' }, goLabel: 'Products' },
    ];
  }
  return [
    { id: 'chips', text: 'Order chips or start a site', done: p.orders.some((o) => o.qty > 0) || p.sites.length > 1, go: { panel: 'compute' }, goLabel: 'Compute' },
    { id: 'base', text: <>Launch a <Term id="baseRun">base run</Term></>, done: p.models.runs.some((r) => r.kind === 'base' && r.startDay > 0), go: { panel: 'blueprint' }, goLabel: 'Blueprint' },
    { id: 'agenda', text: <>Staff a safety <Term id="researchLine">research line</Term></>, done: p.teams.some((t) => t.role === 'sci' && t.dept === 'saf' && !!t.projectId), go: { panel: 'safety', tab: 'lines' }, goLabel: 'Research lines' },
    { id: 'company', text: 'See where your compute goes', done: seen(s, 'panel:company'), go: { panel: 'company' }, goLabel: 'Company' },
    { id: 'commit', text: <>Make a public <Term id="commitment">commitment</Term></>, done: s.commitments.length > 0, go: { panel: 'relations' }, goLabel: 'Relations' },
  ];
}
export const goalsActive = (s: GameStateV2) => s.setup.tutorial && s.tutorial.act <= 2 && !seen(s, 'goals:hide');

export function Goals({ s }: { s: GameStateV2 }) {
  const gs = goals(s);
  const next = (s.tutorial.act + 1) as 2 | 3 | 4;
  const unlocks = NAV.filter((n) => UNLOCK_ACT[n.id] === next);
  return (
    <Card title={`Goals · Act ${s.tutorial.act}`} sub={ACT_NAMES[s.tutorial.act]} home="goals" right={<button className="btn btn-sm btn-ghost" data-test="goals-hide" onClick={() => { markSeen(s, 'goals:hide'); store.notify(); }}>Hide</button>}>
      <div className="goals" data-test="goals">
        {gs.map((g) => (
          <div className={`goal ${g.done ? 'done' : ''}`} key={g.id} data-goal={g.id}>
            <span className="goal-ck">{g.done ? <ICON.check size={13} /> : null}</span>
            <span className="goal-tx">{g.text}</span>
            {!g.done && g.go && <GoBtn to={g.go} label={g.goLabel} testId={`goal.${g.id}`} />}
          </div>
        ))}
      </div>
      {next <= 4 && (
        <div className="tip-sec"><div className="tip-cap">Unlocks next · Act {next} at {ACT_TRIGGER[next]}</div>
          {unlocks.map((n) => <div key={n.id} className="small dim"><ICON.locked size={11} /> {n.label}</div>)}
        </div>
      )}
    </Card>
  );
}

// ───────── coach cards ─────────
interface Step { id: string; act: number; target: string; title: string; body: ReactNode; when?: (s: GameStateV2) => boolean; action?: { label: string; go: GoTarget; test: string } }
const STEPS: Step[] = [
  { id: 'race', act: 1, target: '[data-test=race]', title: 'Keep understanding ahead', body: <>Violet is how capable your best model is. Teal is the highest level your safety tools can still read. If violet passes teal, you are flying blind.</> },
  { id: 'runs', act: 1, target: '[data-nav=blueprint]', title: 'Train your first model', body: <>A starter recipe is ready. Every choice shows what it pushes, so try one change and watch the arrows.</>, when: (s) => !s.player.models.runs.some((r) => r.kind === 'post' && r.startDay >= 0), action: { label: 'Open Blueprint', go: { panel: 'blueprint' }, test: 'firstRun' } },
  { id: 'why', act: 1, target: '[data-test=cash]', title: 'Hover for why, click to go', body: <>Hover any number to see what moved it. Click it to open the panel that changes it. Dotted words explain themselves.</> },
  { id: 'watch', act: 1, target: '#watch', title: 'Watch: what needs you', body: <>When something goes wrong, it shows up here as cause → fix, with a button to the control.</>, when: () => store.panel === 'overview' },
  { id: 'act2', act: 2, target: '[data-nav=compute]', title: 'Act 2: the frontier race', body: <>Chips, sites and base runs are open. Money starts to bind: watch the runway gauge.</> },
  { id: 'act3', act: 3, target: '[data-nav=world]', title: 'Act 3: automation', body: <>Your agents now do research. The World panel shows jobs and who controls the economy.</> },
  { id: 'act4', act: 4, target: '[data-nav=risk]', title: 'Act 4: takeoff', body: <>Progress is fast now. The Risk panel shows where catastrophe could come from.</> },
];
function currentStep(s: GameStateV2): Step | undefined {
  if ((!s.setup.tutorial && !seen(s, 'coach:replay')) || seen(s, 'coach:skip') || store.modal || store.recap || store.help) return undefined;
  return STEPS.find((x) => x.act <= s.tutorial.act && !seen(s, `coach:${x.id}`) && (x.when?.(s) ?? true) && (x.act === s.tutorial.act || x.act === 1));
}

export function Coach({ s }: { s: GameStateV2 }) {
  useV2();
  const step = currentStep(s);
  const [rect, setRect] = useState<DOMRect>();
  useLayoutEffect(() => {
    const el = step ? document.querySelector(step.target) : null;
    const r = el?.getBoundingClientRect();
    if (r && (!rect || r.x !== rect.x || r.y !== rect.y || r.width !== rect.width)) setRect(r);
    if (!r && rect) setRect(undefined);
  });
  if (!step || !rect) return null;
  const idx = STEPS.filter((x) => x.act === step.act).indexOf(step);
  const total = STEPS.filter((x) => x.act === step.act).length;
  const left = Math.min(window.innerWidth - 360, Math.max(8, rect.left + (rect.width > 300 ? 40 : rect.width + 12)));
  const top = rect.width > 300 || rect.top < 80 ? rect.bottom + 12 : rect.top;
  const done = () => { markSeen(s, `coach:${step.id}`); store.notify(); };
  return (
    <>
      <div className="coach-spot" style={{ left: rect.left - 4, top: rect.top - 4, width: rect.width + 8, height: rect.height + 8 }} />
      <div className="coach-card" style={{ left, top }} data-test="coach" data-coach-step={step.id}>
        <div className="coach-ttl"><ICON.milestone size={14} /> {step.title}</div>
        <div className="coach-body">{step.body}</div>
        <div className="coach-foot">
          <span className="dim small">{idx + 1} / {total}</span>
          <span className="sp" />
          <button className="btn btn-sm btn-ghost" data-test="coach-skip" onClick={() => { markSeen(s, 'coach:skip'); store.notify(); }}>Skip all</button>
          {step.action && <button className="btn btn-sm" data-coach={step.action.test} onClick={() => { done(); store.goto(step.action!.go.panel, step.action!.go); }}>{step.action.label}</button>}
          <button className="btn btn-sm btn-primary" data-test="coach-next" onClick={done}>{step.action ? 'Later' : 'Next'}</button>
        </div>
      </div>
    </>
  );
}

// ───────── quarter recap ─────────
export function QuarterRecap({ s }: { s: GameStateV2 }) {
  const st = useV2();
  const r = st.recap;
  if (!r) return null;
  const cashCause = causeStrip(s, 'cash', 91, 1)[0];
  const rows: { label: ReactNode; icon: typeof ICON.L; from: string; to: string; d: number; good: boolean; note?: string }[] = [
    { label: <Term id="L">Capability</Term>, icon: ICON.L, from: F.level(r.from.L), to: F.level(r.to.L), d: r.to.L - r.from.L, good: true },
    { label: <Term id="sightLimit">Sight limit</Term>, icon: ICON.U, from: F.level(r.from.U), to: F.level(r.to.U), d: r.to.U - r.from.U, good: r.to.U >= r.from.U },
    { label: <Term id="cash">Cash</Term>, icon: ICON.cash, from: F.money(r.from.cash), to: F.money(r.to.cash), d: r.to.cash - r.from.cash, good: r.to.cash >= r.from.cash, note: cashCause ? `biggest cause: ${cashCause.source}` : undefined },
    { label: <Term id="lead">Lead</Term>, icon: ICON.lead, from: F.lead(r.from.lead), to: F.lead(r.to.lead), d: r.to.lead - r.from.lead, good: r.to.lead >= r.from.lead },
  ];
  const gap0 = r.from.U - r.from.L;
  const gap1 = r.to.U - r.to.L;
  return (
    <div className="modal-backdrop">
      <div className="modal recap" data-test="recap">
        <div className="recap-hd"><ICON.milestone size={18} /><b>{r.label} in one look</b><span className="sp" /><span className="dim small">paused · <span className="kbd">Enter</span> to continue</span></div>
        <div className="recap-rows">
          {rows.map((x, i) => (
            <div className="recap-row" key={i}>
              <span className="recap-l"><x.icon size={14} /> {x.label}</span>
              <span className="num">{x.from} → <b>{x.to}</b></span>
              <span className={`num ${x.d === 0 ? 'dim' : x.good ? 'tone-pos' : 'tone-neg'}`}>{x.d > 0 ? '▲' : x.d < 0 ? '▼' : '·'}</span>
              <span className="dim small">{x.note}</span>
            </div>
          ))}
        </div>
        <div className="small" style={{ marginTop: 8 }}>{gap1 < 0 ? <span className="tone-neg">You are {Math.abs(gap1).toFixed(1)} levels past what your tools can read{gap1 < gap0 ? ', and the gap grew' : ''}.</span> : <span className="tone-pos">Understanding is {gap1.toFixed(1)} levels ahead of capability.</span>}</div>
        <div className="btn-row" style={{ marginTop: 10 }}>
          <span className="sp" />
          <button className="btn btn-primary" data-test="recap-ok" onClick={() => store.closeRecap()} autoFocus>Continue</button>
        </div>
      </div>
    </div>
  );
}

// ───────── help ─────────
export function HelpOverlay({ s }: { s: GameStateV2 }) {
  const st = useV2();
  if (!st.help) return null;
  const keys: [string, string][] = [['Space', 'pause / resume'], ['1–4', 'speed'], ['F', 'fast-forward to the next event'], ['1 2 3', 'choose in a decision'], ['Esc', 'decide later / close'], ['?', 'this help']];
  return (
    <div className="modal-backdrop" onClick={() => store.setHelp(false)}>
      <div className="modal help" data-test="help-overlay" onClick={(e) => e.stopPropagation()}>
        <div className="recap-hd"><ICON.help size={18} /><b>How to play</b><span className="sp" /><button className="btn btn-sm btn-ghost" onClick={() => store.setHelp(false)}>Close</button></div>
        <div className="g2">
          <div>
            <div className="tip-cap">Keys</div>
            {keys.map(([k, v]) => <div className="kv" key={k}><span className="kbd">{k}</span><span className="dim">{v}</span></div>)}
          </div>
          <div>
            <div className="tip-cap">Reading the screen</div>
            <div className="small">The top strip is the whole game in one look: the race, catastrophe risk, money and your lead. The Overview shows who is close, how the race got here and what needs you. Everything else is one click away.</div>
            <div className="small" style={{ marginTop: 6 }}><b>Hover</b> any number for why it moved. <b>Click</b> it to go to the control. <span className="term">Dotted words</span> explain themselves, and their tooltips nest.</div>
          </div>
        </div>
        <div className="btn-row" style={{ marginTop: 12 }}>
          <button className="btn btn-sm" data-test="coach-replay" onClick={() => { s.tutorial.seen = [...s.tutorial.seen.filter((x) => !x.startsWith('coach:')), 'coach:replay']; store.setHelp(false); }}>Replay the coach</button>
          <span className="dim small">Day {s.time.day} · {fmtDate(dateOf(s))}</span>
        </div>
      </div>
    </div>
  );
}
