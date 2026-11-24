// Speed controls and fast-forward menu (§1.4): pause, speeds 1–4 with key hints, FF with targets; auto-stop rules
// live in store.ts. Keys: Space pause, 1–4 speed, F fast-forward to the next event, ? help.
import { useEffect, useState } from 'react';
import { dayOfDate } from '../../../engine/v2';
import type { GameStateV2 } from '../../../engine/v2';
import { store, useV2 } from '../store';
import { Tip, TipCard } from '../ui';
import { ICON } from '../icons';

const LABELS = ['Paused', 'Speed 1 · 1 s per day', 'Speed 2 · 0.45 s per day', 'Speed 3 · 0.18 s per day', 'Speed 4 · 70 ms per day', 'Fast-forward · 12 ms per day'];
const SPEED_ICON = [ICON.pause, ICON.play, ICON.speed2, ICON.speed3, ICON.speed3];

export function SpeedControl({ s }: { s: GameStateV2 }) {
  const st = useV2();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState('');
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (store.modal) return; // the decision modal owns digits
      if (e.code === 'Space') {
        e.preventDefault();
        store.togglePause();
      } else if (/^Digit[1-4]$/.test(e.code)) store.setSpeed(Number(e.code.slice(5)));
      else if (e.code === 'Digit5' || e.code === 'KeyF') store.fastForward({ kind: 'event' });
      else if (e.key === '?') store.setHelp(!store.help);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const ffLabel = st.ff ? { event: 'next event', runDone: 'run done', quarter: 'next quarter', day: 'date', milestone: 'milestone' }[st.ff.kind] : '';
  const go = (t: Parameters<typeof store.fastForward>[0]) => {
    store.fastForward(t);
    setOpen(false);
  };
  if (s.ending) {
    return (
      <div className="speedctl2 is-frozen" data-test="time-frozen">
        <Tip content={() => <TipCard title="Time frozen">The game has ended. You can look around, but nothing moves.</TipCard>}>
          <span className="spd-frozen"><ICON.pause size={14} /> Time frozen</span>
        </Tip>
      </div>
    );
  }
  return (
    <div className="speedctl2">
      <Tip content={() => <TipCard title={st.speed === 0 ? 'Resume' : 'Pause'} value="Space">{LABELS[st.speed]}</TipCard>}>
        <button className={`spd ${st.speed === 0 ? 'on' : ''}`} data-test="pause" onClick={() => store.togglePause()}>
          {st.speed === 0 ? <ICON.play size={14} /> : <ICON.pause size={14} />}<span className="k">␣</span>
        </button>
      </Tip>
      {[1, 2, 3, 4].map((n) => {
        const I = SPEED_ICON[n];
        return (
          <Tip key={n} content={() => <TipCard title={`Speed ${n}`} value={`key ${n}`}>{LABELS[n]}</TipCard>}>
            <button className={`spd ${st.speed === n ? 'on' : ''}`} data-speed={n} onClick={() => store.setSpeed(n)}><I size={13} />{n === 4 && <span className="spd-plus">+</span>}<span className="k">{n}</span></button>
          </Tip>
        );
      })}
      <div className="ff-wrap">
        <Tip content={() => <TipCard title="Fast-forward to…" value="F">Stops on any decision, incident ≥ 3, run completion, runway tight, key finding, rival or China milestone, new law, theft.</TipCard>}>
          <button className={`spd ${st.speed === 5 ? 'on' : ''}`} data-test="ff" onClick={() => setOpen((o) => !o)}>
            <ICON.ff size={14} /><span className="k">F</span>
            {st.speed === 5 && <span className="small spd-ff">{ffLabel}</span>}
          </button>
        </Tip>
        {open && (
          <div className="ff-menu" data-test="ff-menu">
            <button className="ff-item" data-ff="event" onClick={() => go({ kind: 'event' })}>Next decision or event <span className="kbd">F</span></button>
            <button className="ff-item" data-ff="runDone" onClick={() => go({ kind: 'runDone' })} disabled={!s.player.models.runs.some((r) => r.status === 'running')}>Next run done</button>
            <button className="ff-item" data-ff="quarter" onClick={() => go({ kind: 'quarter' })}>Next quarter</button>
            <button className="ff-item" data-ff="milestone" onClick={() => go({ kind: 'milestone' })}>Next milestone</button>
            <div className="ff-item ff-date">
              <input type="date" className="text-input" data-test="ff-date" value={date} onChange={(e) => setDate(e.target.value)} />
              <button className="btn btn-sm" data-ff="day" disabled={!date} onClick={() => go({ kind: 'day', day: dayOfDate(s.time.startDate, date) })}>Go</button>
            </div>
            <button className="ff-item" data-ff="step" onClick={() => { store.step(1); setOpen(false); }}>+1 day</button>
            <button className="ff-item" data-ff="stop" onClick={() => { store.setSpeed(0); setOpen(false); }}>Stop</button>
          </div>
        )}
      </div>
    </div>
  );
}
