// v2 app root (WS6). Mounted by src/main.tsx when VITE_V2=1 at build time or `?v2` is in the URL.
// Screens: start → setup → game (shell: top strip, nav, center panel, right rail, alert queue) → end screen.
import type { ReactNode } from 'react';
import type { GameStateV2 } from '../../engine/v2';
import { TooltipProvider } from '../Tooltip';
import { EndScreen } from './end/EndScreen';
import { Codex } from './panels/Codex';
import { Compute } from './panels/Compute';
import { Departments } from './panels/Departments';
import { Deployments } from './panels/Deployments';
import { Finance } from './panels/Finance';
import { Models } from './panels/Models';
import { Relations } from './panels/Relations';
import { RiskMap } from './panels/RiskMap';
import { RiskSources } from './panels/RiskSources';
import { RunDesigner } from './panels/RunDesigner';
import { SafetyLab } from './panels/SafetyLab';
import { World } from './panels/World';
import { SetupScreen, StartScreen } from './setup/Setup';
import { AlertQueue } from './shell/AlertQueue';
import { DecisionModal } from './shell/DecisionModal';
import { Nav } from './shell/Nav';
import { RightRail } from './shell/RightRail';
import { TopStrip } from './shell/TopStrip';
import { useV2 } from './store';
import { LockedNote, unlocked } from './ui';
import './v2.css';

const PANELS: Record<string, (p: { s: GameStateV2 }) => ReactNode> = {
  map: RiskMap, finance: Finance, compute: Compute, departments: Departments, models: Models, rundesigner: RunDesigner,
  deployments: Deployments, safety: SafetyLab, relations: Relations, world: World, risk: RiskSources, codex: Codex,
};

function Game({ s }: { s: GameStateV2 }) {
  const st = useV2();
  if (s.ending) return <EndScreen s={s} />;
  const id = PANELS[st.panel] && unlocked(s, st.panel) ? st.panel : 'map';
  const Panel = PANELS[id];
  return (
    <div className="game-v2">
      <TopStrip s={s} />
      <div className="body-v2">
        <Nav s={s} />
        <main className="center" data-center={id}>
          {PANELS[st.panel] && !unlocked(s, st.panel) ? <LockedNote k={st.panel} /> : null}
          <Panel s={s} />
        </main>
        <RightRail s={s} />
      </div>
      <AlertQueue s={s} />
      <DecisionModal s={s} />
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
  return (
    <TooltipProvider useLive={useV2}>
      <Screens />
    </TooltipProvider>
  );
}
