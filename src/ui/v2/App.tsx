// v2 app root (WS6 owns). M0 placeholder: proves the v2 engine bundles and boots via selectors only.
// Mounted by src/main.tsx when VITE_V2=1 at build time or `?v2` is in the URL.
import { useState } from 'react';
import { dateOf, defaultSetupV2, engine, fmtDate, measuredL } from '../../engine/v2';
import type { GameStateV2 } from '../../engine/v2';

export function AppV2() {
  const [s, setS] = useState<GameStateV2>(() => engine.newGame(defaultSetupV2({ seed: 2027 })));
  const [, force] = useState(0);
  const advance = (n: number) => {
    for (let i = 0; i < n; i++) engine.tick(s);
    setS(s);
    force((x) => x + 1);
  };
  return (
    <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h1>AI27 v2 under construction</h1>
      <p>
        {fmtDate(dateOf(s))} · day {s.time.day} · L {measuredL(s).toFixed(2)} · M {engine.production(s, 'player').M.toFixed(2)}×
      </p>
      <button onClick={() => advance(30)}>+30 days</button>
    </div>
  );
}
