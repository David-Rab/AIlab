// Speed controls and fast-forward menu (§1.4): pause, speeds 1–4, FF with targets; auto-stop rules live in store.ts.
import { useEffect, useState } from 'react';
import { FastForward, Pause, Play } from 'lucide-react';
import { dayOfDate } from '../../../engine/v2';
import type { GameStateV2 } from '../../../engine/v2';
import { store, useV2 } from '../store';
import { Tip, TipCard } from '../ui';

const LABELS = ['Paused', '1 · 1 s/day', '2 · 0.45 s/day', '3 · 0.18 s/day', '4 · 70 ms/day', 'FF · 12 ms/day'];

export function SpeedControl({ s }: { s: GameStateV2 }) {
  const st = useV2();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState('');
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.code === 'Space') {
        e.preventDefault();
        store.togglePause();
      } else if (/^Digit[1-4]$/.test(e.code)) store.setSpeed(Number(e.code.slice(5)));
      else if (e.code === 'Digit5') store.fastForward({ kind: 'event' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const ffLabel = st.ff ? { event: 'next decision', runDone: 'run done', quarter: 'next quarter', day: 'date', milestone: 'milestone' }[st.ff.kind] : '';
  const go = (t: Parameters<typeof store.fastForward>[0]) => {
    store.fastForward(t);
    setOpen(false);
  };
  return (
    <div className="speedctl">
      <Tip content={() => <TipCard title={st.speed === 0 ? 'Resume' : 'Pause'} value="Space">{LABELS[st.speed]}</TipCard>}>
        <button className="btn btn-sm btn-icon" data-test="pause" onClick={() => store.togglePause()}>
          {st.speed === 0 ? <Play size={14} /> : <Pause size={14} />}
        </button>
      </Tip>
      {[1, 2, 3, 4].map((n) => (
        <Tip key={n} content={() => <TipCard title={`Speed ${n}`} value={`key ${n}`}>{LABELS[n]}</TipCard>}>
          <button className={`speed-pip ${st.speed >= n && st.speed < 5 ? 'on' : ''}`} data-speed={n} onClick={() => store.setSpeed(n)} />
        </Tip>
      ))}
      <div className="ff-wrap">
        <Tip content={() => <TipCard title="Fast-forward" value="key 5">Stops on any decision, incident ≥ 3, run completion, runway Tight, DISC/NEG/FALSE finding, rival or China milestone, new law, theft.</TipCard>}>
          <button className={`btn btn-sm btn-icon ${st.speed === 5 ? 'active' : ''}`} data-test="ff" onClick={() => setOpen((o) => !o)}>
            <FastForward size={14} />
            {st.speed === 5 && <span className="small">{ffLabel}</span>}
          </button>
        </Tip>
        {open && (
          <div className="ff-menu" data-test="ff-menu">
            <button className="ff-item" data-ff="event" onClick={() => go({ kind: 'event' })}>Next decision</button>
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
