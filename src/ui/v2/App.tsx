// App root (WS6, M5 UX), mounted by src/main.tsx.
// Screens: start → setup → game → end. Game shell per design/ux/IA.md: L0 = top strip + nav + bottom bar; the
// centre shows the Overview (L1) or one panel (L2). There is no right rail.
import { useEffect, type ReactNode } from 'react';
import type { GameStateV2 } from '../../engine/v2';
import { TooltipProvider } from './Tooltip';
import { EndBanner } from './end/EndBanner';
import { EndScreen } from './end/EndScreen';
import { Codex } from './panels/Codex';
import { Lab } from './panels/Lab';
import { Compute } from './panels/Compute';
import { Products } from './panels/Products';
import { Finance } from './panels/Finance';
import { Models } from './panels/Models';
import { Overview } from './panels/Overview';
import { Relations } from './panels/Relations';
import { Research } from './panels/Research';
import { Training } from './panels/Training';
import { Safety } from './panels/Safety';
import { World } from './panels/World';
import { SetupScreen, StartScreen } from './setup/Setup';
import { AlertQueue } from './shell/AlertQueue';
import { DecisionModal } from './shell/DecisionModal';
import { Nav } from './shell/Nav';
import { Coach, HelpOverlay, QuarterRecap } from './shell/Onboarding';
import { TopStrip } from './shell/TopStrip';
import { useV2 } from './store';
import { LockedNote, unlocked } from './ui';
import './v2.css';
import './kit.css';
import './shell.css';
import './panels.css';
// Base and layout rules load last, as they did when src/main.tsx imported them after the app.
import './base.css';
import './layout.css';

const PANELS: Record<string, (p: { s: GameStateV2 }) => ReactNode> = {
  overview: Overview, research: Research, lab: Lab, finance: Finance, compute: Compute, models: Models, blueprint: Training,
  products: Products, safety: Safety, relations: Relations, world: World, codex: Codex,
};

function Game({ s }: { s: GameStateV2 }) {
  const st = useV2();
  // After the ending: the end screen, or the game panels read-only with time frozen (browse mode).
  if (s.ending && st.endView === 'ending') return <EndScreen s={s} />;
  const ended = !!s.ending;
  const id = PANELS[st.panel] && unlocked(s, st.panel) ? st.panel : 'overview';
  const Panel = PANELS[id];
  return (
    <div className={`game-v2 ${ended ? 'is-ended' : ''}`}>
      {ended && <EndBanner s={s} />}
      <TopStrip s={s} />
      <div className="body-v2">
        <Nav s={s} />
        <main className="center" data-center={id}>
          {PANELS[st.panel] && !unlocked(s, st.panel) ? <LockedNote k={st.panel} /> : null}
          <Panel s={s} />
        </main>
      </div>
      {!ended && <AlertQueue s={s} />}
      {!ended && <DecisionModal s={s} />}
      {!ended && <QuarterRecap s={s} />}
      <HelpOverlay s={s} />
      {!ended && <Coach s={s} />}
    </div>
  );
}

function Screens() {
  const st = useV2();
  if (st.screen === 'setup') return <SetupScreen />;
  if (st.screen === 'game' && st.state) return <Game s={st.state} />;
  return <StartScreen />;
}

export function AppV2() {
  useEffect(() => {
    document.body.classList.add('v2');
    return () => document.body.classList.remove('v2');
  }, []);
  return (
    <TooltipProvider useLive={useV2}>
      <Screens />
    </TooltipProvider>
  );
}
